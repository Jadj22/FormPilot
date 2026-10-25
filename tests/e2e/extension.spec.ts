import { test, expect, chromium } from '@playwright/test';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = resolve(HERE, '../../.output/chrome-mv3').replace(/\\/g, '/');
const FIXTURE_PATH = resolve(HERE, '../fixture/form.html').replace(/\\/g, '/');
const FIXTURE_URL = `file:///${FIXTURE_PATH}`;

declare const chrome: {
  tabs: {
    query(q: { url?: string }): Promise<Array<{ id?: number }>>;
    sendMessage<T>(tabId: number, msg: unknown): Promise<T>;
  };
};

const TEST_PROFILE = {
  id: 'p-test',
  name: 'Awa Test',
  color: '#0ea5e9',
  fields: [
    { id: 'f1', type: 'firstName', label: 'Prénom', value: 'Awa' },
    { id: 'f2', type: 'lastName', label: 'Nom', value: 'Dupont' },
    { id: 'f3', type: 'email', label: 'E-mail', value: 'awa@example.com' },
    { id: 'f4', type: 'phoneMobile', label: 'Téléphone mobile', value: '90 12 34 56' },
    { id: 'f5', type: 'addressLine1', label: 'Adresse', value: '12 rue de la Paix' },
    { id: 'f6', type: 'city', label: 'Ville', value: 'Lomé' },
    { id: 'f7', type: 'postalCode', label: 'Code postal', value: '00123' },
    { id: 'f8', type: 'country', label: 'Pays', value: 'Togo' },
    { id: 'f9', type: 'passportNumber', label: 'N° passeport', value: 'AB123456' },
  ],
};

test.describe('FormPilot E2E', () => {
  test('creates vault, detects and fills the fixture form', async () => {
    const userDataDir = resolve(HERE, '../../.tmp/playwright-profile');
    rmSync(userDataDir, { recursive: true, force: true });
    mkdirSync(userDataDir, { recursive: true });

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });

    try {
      const sw = await context.waitForEvent('serviceworker', { timeout: 30_000 });
      const extensionId = sw.url().split('/')[2];
      expect(extensionId).toBeTruthy();

      // --- 1. Create vault + profile via options page ---
      const optionsPage = await context.newPage();
      await optionsPage.goto(`chrome-extension://${extensionId}/options.html`);
      await optionsPage.fill('input[type="password"]', 'test-password-123');
      await optionsPage.getByRole('button', { name: 'Créer le coffre' }).click();

      // Recovery key screen appears after creation — dismiss it.
      await optionsPage
        .getByRole('button', { name: /Continuer/ })
        .click({ timeout: 10_000 });

      await optionsPage.getByRole('button', { name: '+ Nouveau' }).click();
      await optionsPage.locator('main input').first().fill('Awa Test');

      const addField = async (label: string, value: string) => {
        await optionsPage.locator('select').selectOption({ label });
        // On exclut les inputs fichier (pièces jointes) et cases à cocher (langues),
        // qui viennent après les champs texte dans le DOM.
        await optionsPage
          .locator('main input:not([type="file"]):not([type="checkbox"])')
          .last()
          .fill(value);
      };
      await addField('Prénom(s)', 'Awa');
      await addField('Nom', 'Dupont');
      await addField('Adresse e-mail', 'awa@example.com');

      // --- 2. Popup smoke test: renders, unlocks, shows profile ---
      const popupPage = await context.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
      const unlockBtn = popupPage.getByRole('button', { name: 'Déverrouiller' });
      await expect(unlockBtn).toBeVisible({ timeout: 10_000 });
      await popupPage.fill('input[type="password"]', 'test-password-123');
      await unlockBtn.click();
      await expect(popupPage.getByText('Awa Test')).toBeVisible({ timeout: 10_000 });
      await expect(
        popupPage.getByRole('button', { name: 'Détecter les champs' }),
      ).toBeVisible();
      await popupPage.close();

      // --- 3. Detect + fill via content script (driven from the service worker) ---
      const fixturePage = await context.newPage();
      await fixturePage.goto(FIXTURE_URL);

      interface SwResult {
        error?: string;
        detected?: Array<{ key: string; selected: boolean; type: string | null; label: string }>;
        fill?: { ok: boolean; filled?: number };
        undone?: boolean;
      }

      const result = await sw.evaluate<SwResult, typeof TEST_PROFILE>(async (profile) => {
        const [tab] = await chrome.tabs.query({ url: 'file:///*' });
        if (!tab?.id) return { error: 'no fixture tab' };
        const det = await chrome.tabs.sendMessage<{ ok: boolean; detected?: SwResult['detected'] }>(tab.id, { type: 'DETECT' });
        if (!det?.ok) return { error: 'detect failed' };

        const detected = det.detected ?? [];
        const items = detected.map((d) => ({ key: d.key, selected: d.selected }));
        const fill = await chrome.tabs.sendMessage<SwResult['fill']>(tab.id, {
          type: 'FILL',
          items,
          profile,
        });
        return { detected, fill };
      }, TEST_PROFILE);

      expect(result.error).toBeUndefined();
      expect(result.fill).toMatchObject({ ok: true, filled: expect.any(Number) });
      expect(result.fill!.filled).toBeGreaterThan(5);

      // file:// hostname → no Weezevent rules, generic fill, no uppercase transform.
      expect(await fixturePage.locator('input[name="lastname"]').inputValue()).toBe('Dupont');
      expect(await fixturePage.locator('input[name="firstname"]').inputValue()).toBe('Awa');
      expect(await fixturePage.locator('input[name="email"]').inputValue()).toBe('awa@example.com');
      expect(await fixturePage.locator('input[name="city"]').inputValue()).toBe('Lomé');
      expect(await fixturePage.locator('input[name="phone"]').inputValue()).toBe('+22890123456');

      // --- 4. Undo restores empty values ---
      const undone = await sw.evaluate<SwResult>(async () => {
        const [tab] = await chrome.tabs.query({ url: 'file:///*' });
        if (!tab?.id) return { error: 'no tab' };
        return chrome.tabs.sendMessage<SwResult>(tab.id, { type: 'UNDO' });
      });
      expect(undone).toMatchObject({ ok: true, undone: true });
      expect(await fixturePage.locator('input[name="lastname"]').inputValue()).toBe('');
    } finally {
      await context.close();
    }
  });
});
