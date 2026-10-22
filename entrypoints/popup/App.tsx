import { useCallback, useEffect, useState } from 'react';
import {
  createVault,
  isUnlocked,
  isVaultInitialized,
  loadVault,
  unlockVault,
} from '~/lib/vault';
import { resolveValue } from '~/lib/fill/fill';
import { formatDateFrench } from '~/lib/normalize';
import type { DetectedField, FillItem, Profile, VaultData } from '~/lib/types';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'setup' }
  | { kind: 'recovery'; recoveryKey: string }
  | { kind: 'locked' }
  | { kind: 'ready'; profiles: Profile[] }
  | { kind: 'detected'; profiles: Profile[]; fields: DetectedField[]; profileId: string; warnings: string[] }
  | { kind: 'filled'; profiles: Profile[]; count: number; profileId: string }
  | { kind: 'error'; message: string };

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
  idCardNumber: 'N° pièce d’identité',
  idIssueDate: 'Date d’émission',
  idExpiryDate: 'Date d’expiration',
  birthCountry: 'Pays de naissance',
  birthCity: 'Ville de naissance',
  languages: 'Langue(s) usuelle(s)',
  residence: 'Résidence',
};

// Place le profil par défaut en premier : profiles[0] est celui utilisé partout dans le popup.
function defaultFirst(vault: VaultData): Profile[] {
  const id = vault.defaultProfileId;
  if (!id) return vault.profiles;
  return [...vault.profiles].sort((a, b) => Number(b.id === id) - Number(a.id === id));
}

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

export default function App() {
  const [view, setView] = useState<ViewState>({ kind: 'loading' });
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      if (!(await isVaultInitialized())) {
        setView({ kind: 'setup' });
        return;
      }
      if (isUnlocked()) {
        try {
          const vault = await loadVault();
          setView({ kind: 'ready', profiles: defaultFirst(vault) });
        } catch {
          setView({ kind: 'locked' });
        }
        return;
      }
      setView({ kind: 'locked' });
    })();
  }, []);

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
    const { recoveryKey } = await createVault(password);
    setView({ kind: 'recovery', recoveryKey });
    setPassword('');
    setPassword2('');
  }, [password, password2]);

  const handleUnlock = useCallback(async () => {
    setError('');
    const ok = await unlockVault(password);
    if (!ok) {
      setError('Mot de passe incorrect.');
      return;
    }
    const vault = await loadVault();
    setView({ kind: 'ready', profiles: defaultFirst(vault) });
    setPassword('');
  }, [password]);

  const handleDetect = useCallback(async () => {
    setError('');
    try {
      const resp = await sendToActiveTab<{
        ok: boolean;
        detected?: DetectedField[];
        warnings?: string[];
        error?: string;
      }>({
        type: 'DETECT',
      });
      if (!resp.ok || !resp.detected) {
        setError(resp.error ?? 'Détection impossible sur cette page.');
        return;
      }
      setView((v) => {
        if (v.kind !== 'ready') return v;
        const defaultId = v.profiles[0]?.id ?? '';
        return {
          kind: 'detected',
          profiles: v.profiles,
          fields: resp.detected!,
          warnings: resp.warnings ?? [],
          profileId: defaultId,
        };
      });
    } catch (e) {
      setError('Impossible de joindre cette page (rechargez-la).');
      console.error(e);
    }
  }, []);

  const handleFill = useCallback(
    async (fields: DetectedField[], profileId: string) => {
      const profile = view.kind === 'detected'
        ? view.profiles.find((p) => p.id === profileId)
        : undefined;
      if (!profile) {
        setError('Profil introuvable.');
        return;
      }
      const items: FillItem[] = fields.map((f) => ({
        key: f.key,
        selected: f.selected,
      }));
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
    [view],
  );

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

  const toggleField = (key: string) => {
    setView((v) => {
      if (v.kind !== 'detected') return v;
      return {
        ...v,
        fields: v.fields.map((f) =>
          f.key === key ? { ...f, selected: !f.selected } : f,
        ),
      };
    });
  };

  const setAllFields = (selected: boolean) => {
    setView((v) => {
      if (v.kind !== 'detected') return v;
      return {
        ...v,
        fields: v.fields.map((f) => ({ ...f, selected })),
      };
    });
  };

  const proposedValue = (profile: Profile | undefined, f: DetectedField) => {
    if (!profile) return f.value || '—';
    const val = resolveValue(profile, f.type);
    if (!val) return f.value || '—';
    if (f.type === 'birthDate' || f.type === 'idIssueDate' || f.type === 'idExpiryDate') {
      return formatDateFrench(val);
    }
    return val;
  };

  if (view.kind === 'loading') {
    return <div className="p-4 text-sm text-neutral-400">Chargement…</div>;
  }

  if (view.kind === 'setup') {
    return (
      <div className="w-80 space-y-3 p-4">
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
      <div className="w-80 space-y-3 p-4">
        <h1 className="text-base font-semibold">Clé de récupération</h1>
        <p className="text-xs text-amber-400">
          Notez cette clé et conservez-la en lieu sûr. Sans mot de passe ni clé, vos
          données sont irrécupérables. Elle n&apos;est plus affichée ensuite.
        </p>
        <code className="block break-all rounded border border-neutral-700 bg-neutral-900 p-2 text-xs text-emerald-400 select-all">
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
            setView({ kind: 'ready', profiles: defaultFirst(vault) });
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
      <div className="w-80 space-y-3 p-4">
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
      </div>
    );
  }

  if (view.kind === 'ready') {
    return (
      <div className="w-80 space-y-3 p-4">
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
            <p className="text-xs text-neutral-400">
              Profil :{' '}
              <span className="text-neutral-200">{view.profiles[0]?.name ?? ''}</span>
            </p>
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
    return (
      <div className="w-80 space-y-2 p-4">
        <h1 className="text-base font-semibold">
          Aperçu ({selectedCount}/{view.fields.length})
        </h1>
        {view.profiles.length > 1 && (
          <select
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs"
            value={view.profileId}
            onChange={(e) =>
              setView((v) =>
                v.kind === 'detected' ? { ...v, profileId: e.target.value } : v,
              )
            }
          >
            {view.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
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
          <button
            type="button"
            onClick={() => setAllFields(true)}
            className="text-sky-400 hover:underline"
          >
            Tout cocher
          </button>
          <button
            type="button"
            onClick={() => setAllFields(false)}
            className="text-neutral-400 hover:underline"
          >
            Tout décocher
          </button>
        </div>

        <div className="max-h-64 space-y-1 overflow-y-auto">
          {view.fields.length === 0 ? (
            <p className="text-xs text-amber-400">Aucun champ détecté sur cette page.</p>
          ) : (
            view.fields.map((f) => (
              <label
                key={f.key}
                className="flex cursor-pointer items-start gap-2 rounded border border-neutral-800 bg-neutral-900 px-2 py-2 hover:border-neutral-600"
              >
                <input
                  type="checkbox"
                  checked={f.selected}
                  onChange={() => toggleField(f.key)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-sky-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs text-neutral-200">{f.label}</div>
                  <div className="truncate text-[11px] text-sky-300/90">
                    → {proposedValue(profile, f)}
                  </div>
                  <div className="text-[10px] text-neutral-500">
                    {f.type ? TYPE_LABELS[f.type] ?? f.type : 'non reconnu'} ·{' '}
                    <span className={confidenceColor(f.confidence)}>{f.confidence}%</span>
                  </div>
                </div>
              </label>
            ))
          )}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView({ kind: 'ready', profiles: view.profiles })}
            className="flex-1 rounded border border-neutral-700 py-1.5 text-sm hover:bg-neutral-900"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => handleFill(view.fields, view.profileId)}
            disabled={selectedCount === 0}
            className="flex-1 rounded bg-sky-600 py-1.5 text-sm font-medium hover:bg-sky-500 disabled:opacity-40"
          >
            Remplir
          </button>
        </div>
      </div>
    );
  }

  if (view.kind === 'error') {
    return (
      <div className="w-80 space-y-3 p-4">
        <h1 className="text-base font-semibold text-red-400">Erreur</h1>
        <p className="text-xs text-neutral-400">{view.message}</p>
      </div>
    );
  }

  return (
    <div className="w-80 space-y-3 p-4">
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