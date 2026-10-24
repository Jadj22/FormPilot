import { useCallback, useEffect, useState } from 'react';
import {
  addLearnedMappings,
  createVault,
  getKeepUnlocked,
  isUnlocked,
  isVaultInitialized,
  loadVault,
  saveVault,
  setKeepUnlocked,
  tryRestoreSession,
  unlockVault,
} from '~/lib/vault';
import { resolveValue } from '~/lib/fill/fill';
import { formatDateFrench } from '~/lib/normalize';
import type {
  ContentPushMessage,
  DetectedField,
  FillItem,
  LearnedMapping,
  Profile,
  SemanticType,
  VaultData,
} from '~/lib/types';
import { sortProfilesByUsage, uid } from '~/lib/types';

// ─── Local types ──────────────────────────────────────────────────────────────

/** Transient per-field override set by the user in the detected view. */
interface FieldOverride {
  type: SemanticType | null;
  memorize: boolean;
}

type ViewState =
  | { kind: 'loading' }
  | { kind: 'setup' }
  | { kind: 'recovery'; recoveryKey: string }
  | { kind: 'locked' }
  | { kind: 'ready'; profiles: Profile[] }
  | {
      kind: 'detected';
      profiles: Profile[];
      fields: DetectedField[];
      profileId: string;
      warnings: string[];
      hostname: string;
    }
  | { kind: 'filled'; profiles: Profile[]; count: number; profileId: string }
  | { kind: 'error'; message: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  firstName: 'Prénom',
  lastName: 'Nom',
  fullName: 'Nom complet',
  civility: 'Civilité',
  email: 'E-mail',
  phoneMobile: 'Téléphone mobile',
  phoneHome: 'Téléphone fixe',
  addressLine1: 'Adresse',
  addressLine2: 'Complément',
  city: 'Ville',
  postalCode: 'Code postal',
  region: 'Région',
  country: 'Pays',
  birthDate: 'Date de naissance',
  nationality: 'Nationalité',
  gender: 'Genre',
  companyName: 'Entreprise',
  siret: 'SIRET',
  vatNumber: 'TVA',
  iban: 'IBAN',
  jobTitle: 'Poste',
  passportNumber: 'N° passeport',
  idCardNumber: "N° pièce d'identité",
  idIssueDate: "Date d'émission",
  idExpiryDate: "Date d'expiration",
  birthCountry: 'Pays de naissance',
  birthCity: 'Ville de naissance',
  languages: 'Langue(s) usuelle(s)',
  residence: 'Résidence',
};

const SEMANTIC_TYPE_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({
  value: value as SemanticType,
  label,
}));

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function confidenceColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-neutral-400';
}

async function sendToActiveTab<T>(message: unknown): Promise<T> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('Aucun onglet actif');
  return browser.tabs.sendMessage(tab.id, message);
}

function hostnameFromTab(url: string | undefined): string {
  try {
    return new URL(url ?? '').hostname;
  } catch {
    return '';
  }
}

/**
 * Compute a stable field signature matching the format used in content.ts
 * (getFieldSignature), so saved mappings are resolved correctly on next detect.
 */
function fieldSignatureFrom(f: DetectedField): string {
  if (f.name) return `name:${f.name.toLowerCase().trim()}`;
  if (f.id) return `id:${f.id.toLowerCase().trim()}`;
  return `label:${f.label.toLowerCase().trim()}`;
}

function proposedValue(
  profile: Profile | undefined,
  effectiveType: SemanticType | null,
  currentValue: string,
): string {
  if (!profile) return currentValue || '—';
  const val = resolveValue(profile, effectiveType);
  if (!val) return currentValue || '—';
  if (
    effectiveType === 'birthDate' ||
    effectiveType === 'idIssueDate' ||
    effectiveType === 'idExpiryDate'
  ) {
    return formatDateFrench(val);
  }
  return val;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ProfileListProps {
  profiles: Profile[];
  onToggleUsed: (id: string) => void;
}

/** Displays profiles sorted by usage with checkboxes (used = done). */
function ProfileList({ profiles, onToggleUsed }: ProfileListProps) {
  const sorted = sortProfilesByUsage(profiles);
  return (
    <ul className="space-y-1">
      {sorted.map((p) => (
        <li key={p.id}>
          <label
            className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-opacity ${
              p.used ? 'opacity-40' : 'hover:bg-neutral-800'
            }`}
          >
            <input
              type="checkbox"
              checked={p.used ?? false}
              onChange={() => onToggleUsed(p.id)}
              className="h-4 w-4 shrink-0 accent-sky-600"
            />
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span className={p.used ? 'line-through text-neutral-500' : 'text-neutral-200'}>
              {p.name}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

interface KeepUnlockedCheckboxProps {
  checked: boolean;
  onChange: (v: boolean) => void;
}

/** "Garder le coffre déverrouillé" checkbox with security note. */
function KeepUnlockedCheckbox({ checked, onChange }: KeepUnlockedCheckboxProps) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-900/60 p-2 space-y-1">
      <label className="flex cursor-pointer items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 accent-sky-600"
        />
        <span className="text-neutral-200">Garder le coffre déverrouillé</span>
      </label>
      <p className="pl-6 text-[10px] text-neutral-500">
        ⚠️ La clé reste en mémoire locale. Pratique sur un appareil personnel,
        déconseillé sur un appareil partagé.
      </p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<ViewState>({ kind: 'loading' });
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [keepUnlocked, setKeepUnlockedState] = useState(false);
  /** Transient per-field overrides set by the user during the detected view. */
  const [overrides, setOverrides] = useState<Record<string, FieldOverride>>({});
  /** Non-null when the MutationObserver detected a step change while popup is open. */
  const [pendingStep, setPendingStep] = useState<{ detected: DetectedField[]; warnings: string[] } | null>(null);

  // ── Init ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const ku = await getKeepUnlocked();
      setKeepUnlockedState(ku);

      if (!(await isVaultInitialized())) {
        setView({ kind: 'setup' });
        return;
      }

      // Try to restore persisted session (keepUnlocked mode)
      if (!isUnlocked()) {
        await tryRestoreSession();
      }

      if (isUnlocked()) {
        try {
          const vault = await loadVault();
          setView({ kind: 'ready', profiles: sortProfilesByUsage(vault.profiles) });
        } catch {
          setView({ kind: 'locked' });
        }
        return;
      }

      setView({ kind: 'locked' });
    })();
  }, []);

  // ── Step-change listener (FR-20) ─────────────────────────────────────────────

  useEffect(() => {
    const onMessage = (msg: ContentPushMessage) => {
      if (msg.type !== 'STEP_CHANGED') return;
      setPendingStep({ detected: msg.detected, warnings: msg.warnings });
    };
    browser.runtime.onMessage.addListener(
      onMessage as Parameters<typeof browser.runtime.onMessage.addListener>[0],
    );
    return () =>
      browser.runtime.onMessage.removeListener(
        onMessage as Parameters<typeof browser.runtime.onMessage.removeListener>[0],
      );
  }, []);

  // ── Auth handlers ─────────────────────────────────────────────────────────────

  const handleSetup = useCallback(async () => {
    setError('');
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (password !== password2) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    await setKeepUnlocked(keepUnlocked);
    // createVault is now idempotent - no password needed, just initialize if not exists
    const { recoveryKey } = await createVault();
    setView({ kind: 'recovery', recoveryKey });
    setPassword('');
    setPassword2('');
  }, [password, password2, keepUnlocked]);

  const handleUnlock = useCallback(async () => {
    setError('');
    const ok = await unlockVault();
    if (!ok) {
      setError('Vault not initialized.');
      return;
    }
    const vault = await loadVault();
    setView({ kind: 'ready', profiles: sortProfilesByUsage(vault.profiles) });
    setPassword('');
  }, [password]);

  // ── Toggle profile used status ────────────────────────────────────────────────

  const handleToggleUsed = useCallback(async (profileId: string) => {
    try {
      const vault = await loadVault();
      const updated: VaultData = {
        ...vault,
        profiles: vault.profiles.map((p) =>
          p.id === profileId ? { ...p, used: !(p.used ?? false) } : p,
        ),
      };
      await saveVault(updated);
      setView((v) => {
        if (v.kind !== 'ready' && v.kind !== 'detected' && v.kind !== 'filled') return v;
        return { ...v, profiles: sortProfilesByUsage(updated.profiles) };
      });
    } catch (e) {
      console.error('FormPilot: failed to toggle profile used status', e);
    }
  }, []);

  // ── Detect ────────────────────────────────────────────────────────────────────

  const handleDetect = useCallback(async () => {
    setError('');
    setOverrides({});
    try {
      const vault = await loadVault();
      const learnedMappings = vault.learnedMappings ?? [];

      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      const hostname = hostnameFromTab(tab?.url);

      const resp = await sendToActiveTab<{
        ok: boolean;
        detected?: DetectedField[];
        warnings?: string[];
        error?: string;
      }>({ type: 'DETECT', learnedMappings });

      if (!resp.ok || !resp.detected) {
        setError(resp.error ?? 'Détection impossible sur cette page.');
        return;
      }

      setView((v) => {
        if (v.kind !== 'ready') return v;
        // Pre-select the first unused profile
        const firstUnused = v.profiles.find((p) => !(p.used ?? false));
        return {
          kind: 'detected',
          profiles: v.profiles,
          fields: resp.detected!,
          warnings: resp.warnings ?? [],
          profileId: firstUnused?.id ?? v.profiles[0]?.id ?? '',
          hostname,
        };
      });
    } catch (e) {
      setError('Impossible de joindre cette page (rechargez-la).');
      console.error(e);
    }
  }, []);

  // ── Fill ──────────────────────────────────────────────────────────────────────

  const handleFill = useCallback(
    async (fields: DetectedField[], profileId: string) => {
      if (view.kind !== 'detected') return;
      const profile = view.profiles.find((p) => p.id === profileId);
      if (!profile) {
        setError('Profil introuvable.');
        return;
      }
      const { hostname } = view;

      const toSave: LearnedMapping[] = [];
      const items: FillItem[] = fields.map((f) => {
        const override = overrides[f.key];
        const hasTypeOverride = override !== undefined;
        const effectiveType = hasTypeOverride ? override.type : f.type;

        if (override?.memorize && hasTypeOverride && effectiveType !== null && hostname) {
          toSave.push({
            id: uid(),
            hostname,
            fieldSignature: fieldSignatureFrom(f),
            type: effectiveType,
            createdAt: Date.now(),
          });
        }

        return {
          key: f.key,
          selected: f.selected,
          overrideType: hasTypeOverride ? effectiveType : undefined,
        };
      });

      if (toSave.length > 0) {
        try {
          await addLearnedMappings(toSave);
        } catch (e) {
          console.warn('FormPilot: failed to save learned mappings', e);
        }
      }

      try {
        const resp = await sendToActiveTab<{ ok: boolean; filled?: number; error?: string }>({
          type: 'FILL',
          items,
          profile,
        });
        if (!resp.ok) {
          setError(resp.error ?? 'Remplissage impossible.');
          return;
        }
        setView((v) => {
          if (v.kind !== 'detected') return v;
          return { kind: 'filled', profiles: v.profiles, count: resp.filled ?? 0, profileId };
        });
      } catch (e) {
        setError('Impossible de joindre cette page.');
        console.error(e);
      }
    },
    [view, overrides],
  );

  // ── Undo ──────────────────────────────────────────────────────────────────────

  const handleUndo = useCallback(async () => {
    try {
      await sendToActiveTab({ type: 'UNDO' });
      setView((v) => {
        if (v.kind !== 'filled') return v;
        return { kind: 'ready', profiles: v.profiles };
      });
    } catch {
      setError('Annulation impossible.');
    }
  }, []);

  // ── Field selection helpers ───────────────────────────────────────────────────

  const toggleField = (key: string) => {
    setView((v) => {
      if (v.kind !== 'detected') return v;
      return {
        ...v,
        fields: v.fields.map((f) => (f.key === key ? { ...f, selected: !f.selected } : f)),
      };
    });
  };

  const setAllFields = (selected: boolean) => {
    setView((v) => {
      if (v.kind !== 'detected') return v;
      return { ...v, fields: v.fields.map((f) => ({ ...f, selected })) };
    });
  };

  // ── Override helpers ──────────────────────────────────────────────────────────

  const setFieldOverrideType = (key: string, type: SemanticType | null) => {
    setOverrides((prev) => ({
      ...prev,
      [key]: { type, memorize: true },
    }));
  };

  const toggleFieldMemorize = (key: string, effectiveType: SemanticType | null) => {
    setOverrides((prev) => ({
      ...prev,
      [key]: { type: effectiveType, memorize: !(prev[key]?.memorize ?? false) },
    }));
  };

  // ─── Views ────────────────────────────────────────────────────────────────────

  if (view.kind === 'loading') {
    return <div className="p-4 text-sm text-neutral-400">Chargement…</div>;
  }

  if (view.kind === 'setup') {
    return (
      <div className="w-full max-w-sm space-y-3 p-4">
        <h1 className="text-base font-semibold">Créer le coffre</h1>
        <p className="text-xs text-neutral-400">
          Choisissez un mot de passe maître. Il chiffre toutes vos données localement.
        </p>
        <input
          type="password"
          className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
          placeholder="Mot de passe maître"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          type="password"
          className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
          placeholder="Confirmer"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
        />
        <KeepUnlockedCheckbox
          checked={keepUnlocked}
          onChange={async (v) => {
            setKeepUnlockedState(v);
            await setKeepUnlocked(v);
          }}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          onClick={handleSetup}
          className="w-full rounded bg-sky-600 py-1.5 text-sm font-medium hover:bg-sky-500"
        >
          Créer
        </button>
        <button
          type="button"
          onClick={() => browser.runtime.openOptionsPage()}
          className="block w-full text-center text-xs text-sky-400 hover:underline"
        >
          Gérer les profils dans les options
        </button>
      </div>
    );
  }

  if (view.kind === 'recovery') {
    return (
      <div className="w-full max-w-sm space-y-3 p-4">
        <h1 className="text-base font-semibold">Clé de récupération</h1>
        <p className="text-xs text-amber-400">
          Notez cette clé et conservez-la en lieu sûr. Sans mot de passe ni clé, vos données sont
          irrécupérables. Elle n&apos;est plus affichée ensuite.
        </p>
        <code className="block select-all break-all rounded border border-neutral-700 bg-neutral-900 p-2 text-xs text-emerald-400">
          {view.recoveryKey}
        </code>
        <button
          onClick={() => navigator.clipboard.writeText(view.recoveryKey)}
          className="w-full rounded border border-neutral-700 py-1.5 text-sm hover:bg-neutral-900"
        >
          Copier la clé
        </button>
        <button
          onClick={async () => {
            const vault = await loadVault();
            setView({ kind: 'ready', profiles: sortProfilesByUsage(vault.profiles) });
          }}
          className="w-full rounded bg-sky-600 py-1.5 text-sm font-medium hover:bg-sky-500"
        >
          J&apos;ai noté ma clé — Continuer
        </button>
      </div>
    );
  }

  if (view.kind === 'locked') {
    return (
      <div className="w-full max-w-sm space-y-3 p-4">
        <h1 className="text-base font-semibold">Coffre verrouillé</h1>
        <input
          type="password"
          className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
          placeholder="Mot de passe maître"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
          autoFocus
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          onClick={handleUnlock}
          className="w-full rounded bg-sky-600 py-1.5 text-sm font-medium hover:bg-sky-500"
        >
          Déverrouiller
        </button>
        <KeepUnlockedCheckbox
          checked={keepUnlocked}
          onChange={async (v) => {
            setKeepUnlockedState(v);
            await setKeepUnlocked(v);
          }}
        />
      </div>
    );
  }

  if (view.kind === 'ready') {
    return (
      <div className="w-full max-w-sm space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold">FormPilot</h1>
          <button
            onClick={() => browser.runtime.openOptionsPage()}
            className="text-xs text-sky-400 hover:underline"
          >
            Options
          </button>
        </div>

        {view.profiles.length === 0 ? (
          <p className="text-xs text-amber-400">
            Aucun profil. Ouvrez les options pour en créer un.
          </p>
        ) : (
          <>
            <p className="text-[10px] text-neutral-500 uppercase tracking-wide">
              Profils (cochez ceux déjà utilisés)
            </p>
            <ProfileList profiles={view.profiles} onToggleUsed={handleToggleUsed} />
            <button
              onClick={handleDetect}
              className="w-full rounded bg-sky-600 py-1.5 text-sm font-medium hover:bg-sky-500"
            >
              Détecter les champs
            </button>
          </>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  if (view.kind === 'detected') {
    const selectedCount = view.fields.filter((f) => f.selected).length;
    const profile = view.profiles.find((p) => p.id === view.profileId);

    const applyStepChange = () => {
      if (!pendingStep) return;
      setView((v) => {
        if (v.kind !== 'detected') return v;
        return { ...v, fields: pendingStep.detected, warnings: pendingStep.warnings };
      });
      setOverrides((prev) => {
        const nextKeys = new Set(pendingStep.detected.map((f) => f.key));
        return Object.fromEntries(Object.entries(prev).filter(([k]) => nextKeys.has(k)));
      });
      setPendingStep(null);
    };

    return (
      <div className="w-full max-w-sm space-y-2 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold">
            Aperçu ({selectedCount}/{view.fields.length})
          </h1>
          <button
            type="button"
            onClick={() => setView({ kind: 'ready', profiles: view.profiles })}
            className="text-sm text-neutral-400 hover:text-neutral-200"
            title="Retour"
          >
            ✕
          </button>
        </div>

        {/* Step-change banner */}
        {pendingStep && (
          <div className="flex items-center justify-between gap-2 rounded border border-sky-700 bg-sky-950/60 px-2 py-1.5">
            <p className="text-[11px] text-sky-300">
              🔄 Nouvelle étape ({pendingStep.detected.length} champ
              {pendingStep.detected.length > 1 ? 's' : ''} détecté
              {pendingStep.detected.length > 1 ? 's' : ''})
            </p>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={applyStepChange}
                className="rounded bg-sky-600 px-2 py-0.5 text-[11px] font-medium hover:bg-sky-500"
              >
                Rafraîchir
              </button>
              <button
                type="button"
                onClick={() => setPendingStep(null)}
                className="text-[11px] text-neutral-500 hover:text-neutral-300"
                title="Ignorer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Profile selector */}
        {view.profiles.length > 1 && (
          <select
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs"
            value={view.profileId}
            onChange={(e) =>
              setView((v) => (v.kind === 'detected' ? { ...v, profileId: e.target.value } : v))
            }
          >
            {sortProfilesByUsage(view.profiles).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.used ? ' ✓' : ''}
              </option>
            ))}
          </select>
        )}

        {view.warnings.length > 0 && (
          <div className="space-y-1 rounded border border-amber-700 bg-amber-950/50 p-2">
            {view.warnings.map((w) => (
              <p key={w} className="text-[11px] text-amber-400">
                ⚠ {w}
              </p>
            ))}
          </div>
        )}

        <div className="flex gap-2 text-[11px]">
          <button type="button" onClick={() => setAllFields(true)} className="text-sky-400 hover:underline">
            Tout cocher
          </button>
          <button type="button" onClick={() => setAllFields(false)} className="text-neutral-400 hover:underline">
            Tout décocher
          </button>
        </div>

        <div className="max-h-72 space-y-1.5 overflow-y-auto">
          {view.fields.length === 0 ? (
            <p className="text-xs text-amber-400">Aucun champ détecté sur cette page.</p>
          ) : (
            view.fields.map((f) => {
              const override = overrides[f.key];
              const effectiveType: SemanticType | null =
                override !== undefined ? override.type : f.type;
              const hasOverride = override !== undefined && override.type !== f.type;

              return (
                <div
                  key={f.key}
                  className="space-y-1.5 rounded border border-neutral-800 bg-neutral-900 px-2 py-2"
                >
                  {/* Row 1 : checkbox + label + value preview */}
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      checked={f.selected}
                      onChange={() => toggleField(f.key)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-sky-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-xs text-neutral-200">
                        <span className="truncate">{f.label}</span>
                        {f.isLearned && (
                          <span title="Règle mémorisée pour ce site" className="shrink-0 text-[10px]">
                            🧠
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[11px] text-sky-300/90">
                        → {proposedValue(profile, effectiveType, f.value)}
                      </div>
                    </div>
                  </label>

                  {/* Row 2 : type dropdown + memorize checkbox */}
                  <div className="flex items-center gap-2 pl-6">
                    <select
                      className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 text-[11px] text-neutral-300"
                      value={effectiveType ?? '__none__'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFieldOverrideType(
                          f.key,
                          val === '__none__' ? null : (val as SemanticType),
                        );
                      }}
                    >
                      <option value="__none__">— non reconnu —</option>
                      {SEMANTIC_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[10px] text-neutral-400">
                      <input
                        type="checkbox"
                        className="accent-sky-600"
                        checked={override?.memorize ?? false}
                        onChange={() => toggleFieldMemorize(f.key, effectiveType)}
                      />
                      Mémoriser
                    </label>
                  </div>

                  {/* Row 3 : confidence + override notice */}
                  <div className="flex items-center gap-2 pl-6">
                    <span className={`text-[10px] ${confidenceColor(f.confidence)}`}>
                      {f.confidence}%
                    </span>
                    {hasOverride && (
                      <span className="text-[10px] text-amber-400">
                        ✎ {TYPE_LABELS[effectiveType ?? ''] ?? '—'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="button"
          onClick={() => handleFill(view.fields, view.profileId)}
          disabled={selectedCount === 0}
          className="w-full rounded bg-sky-600 py-1.5 text-sm font-medium hover:bg-sky-500 disabled:opacity-40"
        >
          Remplir
        </button>
      </div>
    );
  }

  if (view.kind === 'error') {
    return (
      <div className="w-full max-w-sm space-y-3 p-4">
        <h1 className="text-base font-semibold text-red-400">Erreur</h1>
        <p className="text-xs text-neutral-400">{view.message}</p>
      </div>
    );
  }

  // kind === 'filled'
  return (
    <div className="w-full max-w-sm space-y-3 p-4">
      <h1 className="text-base font-semibold">
        {view.count} champ{view.count > 1 ? 's' : ''} rempli{view.count > 1 ? 's' : ''}
      </h1>
      <p className="text-xs text-neutral-400">
        Vérifiez le formulaire, puis envoyez-le vous-même.
      </p>
      <button
        onClick={handleUndo}
        className="w-full rounded border border-neutral-700 py-1.5 text-sm hover:bg-neutral-900"
      >
        Annuler le remplissage
      </button>
    </div>
  );
}
