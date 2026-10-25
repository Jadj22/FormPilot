import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  // Sans ces délais, une action sur un élément introuvable attend jusqu au
  // timeout global et l erreur ne dit pas quelle étape bloque.
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    headless: false,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
});
