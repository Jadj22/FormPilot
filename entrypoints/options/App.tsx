import { useCallback, useEffect, useState } from 'react';
import {
  createVault,
  destroyVault,
  exportVault,
  importVault,
  isUnlocked,
  isVaultInitialized,
  loadVault,
  saveVault,
  unlockVault,
  unlockWithRecoveryKey,
} from '~/lib/vault';
import { uid, type FieldValue, type FileAttachment, type Profile, type SemanticType, type VaultData } from '~/lib/types';

import {
  AUTHORIZED_FIELD_TYPES,
  AUTHORIZED_TYPE_LABELS,
  COUNTRIES,
  NATIONALITIES,
  COMMON_LANGUAGES,
} from '~/lib/authorizedFields';
import { DatePickerTriple } from './DatePickerTriple';

const FIELD_TYPES: SemanticType[] = AUTHORIZED_FIELD_TYPES;

const TYPE_LABELS: Record<SemanticType, string> = AUTHORIZED_TYPE_LABELS;

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [vault, setVault] = useState<VaultData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [status, setStatus] = useState('');
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);

  useEffect(() => {
    (async () => {
      const init = await isVaultInitialized();
      setInitialized(init);
      if (init && isUnlocked()) {
        setVault(await loadVault());
        setUnlocked(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next: VaultData) => {
    await saveVault(next);
    setVault(next);
  }, []);

  const handleCreate = async () => {
    setError('');
    if (password.length < 8) {
      setError('8 caractères minimum.');
      return;
    }
    const { recoveryKey: rk } = await createVault(password);
    setRecoveryKey(rk);
    setVault(await loadVault());
    setUnlocked(true);
    setInitialized(true);
    setPassword('');
  };

  const handleUnlock = async () => {
    setError('');
    const ok = useRecovery
      ? await unlockWithRecoveryKey(recoveryInput)
      : await unlockVault(password);
    if (!ok) {
      setError(useRecovery ? 'Clé de récupération incorrecte.' : 'Mot de passe incorrect.');
      return;
    }
    setVault(await loadVault());
    setUnlocked(true);
    setPassword('');
    setRecoveryInput('');
    setUseRecovery(false);
  };

  const addProfile = async () => {
    if (!vault) return;
    const profile: Profile = {
      id: uid(),
      name: 'Nouveau profil',
      color: '#0ea5e9',
      fields: [],
    };
    await persist({
      ...vault,
      profiles: [...vault.profiles, profile],
      defaultProfileId: vault.defaultProfileId ?? profile.id,
    });
    setSelectedId(profile.id);
  };

  const updateProfile = async (profile: Profile) => {
    if (!vault) return;
    await persist({
      ...vault,
      profiles: vault.profiles.map((p) => (p.id === profile.id ? profile : p)),
    });
  };

  const removeProfile = async (id: string) => {
    if (!vault) return;
    const profiles = vault.profiles.filter((p) => p.id !== id);
    await persist({
      ...vault,
      profiles,
      defaultProfileId:
        vault.defaultProfileId === id ? (profiles[0]?.id ?? null) : vault.defaultProfileId,
    });
    setSelectedId(null);
  };

  const setDefault = async (id: string) => {
    if (!vault) return;
    await persist({ ...vault, defaultProfileId: id });
  };

  const addField = (profile: Profile, type: SemanticType) => {
    const field: FieldValue = {
      id: uid(),
      type,
      label: TYPE_LABELS[type],
      value: '',
    };
    updateProfile({ ...profile, fields: [...profile.fields, field] });
  };

  const updateField = (profile: Profile, fieldId: string, value: string) => {
    updateProfile({
      ...profile,
      fields: profile.fields.map((f) => (f.id === fieldId ? { ...f, value } : f)),
    });
  };

  const removeField = (profile: Profile, fieldId: string) => {
    updateProfile({
      ...profile,
      fields: profile.fields.filter((f) => f.id !== fieldId),
    });
  };

  // ── FR-21: attachment handlers ─────────────────────────────────────────────────

  const addAttachment = (profile: Profile, file: File, type: FileAttachment['type']) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const attachment: FileAttachment = {
        id: uid(),
        type,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataUrl,
        sizeBytes: file.size,
      };
      updateProfile({
        ...profile,
        attachments: [
          ...(profile.attachments ?? []).filter((a) => a.type !== type),
          attachment,
        ],
      });
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = (profile: Profile, attachmentId: string) => {
    updateProfile({
      ...profile,
      attachments: (profile.attachments ?? []).filter((a) => a.id !== attachmentId),
    });
  };

  const handleExport = async () => {
    const json = await exportVault();
    await navigator.clipboard.writeText(json);
    setStatus('Coffre chiffré copié dans le presse-papiers.');
  };

  const handleImport = async () => {
    setError('');
    const ok = await importVault(importText, importPassword);
    if (!ok) {
      setError('Import invalide ou mot de passe incorrect.');
      return;
    }
    setVault(await loadVault());
    setUnlocked(true);
    setInitialized(true);
    setImportText('');
    setImportPassword('');
    setStatus('Coffre importé.');
  };

  const handleDestroy = async () => {
    if (!confirm('Supprimer définitivement toutes les données ?')) return;
    await destroyVault();
    setVault(null);
    setUnlocked(false);
    setInitialized(false);
    setStatus('Coffre supprimé.');
  };

  if (recoveryKey && unlocked) {
    return (
      <div className="mx-auto w-[28rem] max-w-full space-y-4 p-10">
        <h1 className="text-xl font-semibold">Clé de récupération</h1>
        <p className="text-sm text-amber-400">
          Notez cette clé et conservez-la en lieu sûr. Sans mot de passe ni clé, vos
          données sont irrécupérables. Elle n&apos;est plus affichée ensuite.
        </p>
        <code className="block break-all rounded border border-neutral-700 bg-neutral-900 p-3 text-sm text-emerald-400 select-all">
          {recoveryKey}
        </code>
        <div className="flex gap-2">
          <button
            onClick={() => navigator.clipboard.writeText(recoveryKey)}
            className="rounded border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-900"
          >
            Copier
          </button>
          <button
            onClick={() => setRecoveryKey(null)}
            className="rounded bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500"
          >
            J&apos;ai noté ma clé — Continuer
          </button>
        </div>
      </div>
    );
  }

  if (!initialized || !unlocked || !vault) {
    return (
      <div className="mx-auto w-[28rem] max-w-full space-y-4 p-10">
        <h1 className="text-xl font-semibold">FormPilot — Options</h1>
        {!initialized ? (
          <>
            <p className="text-sm text-neutral-400">
              Créez votre coffre chiffré avec un mot de passe maître.
            </p>
            <input
              type="password"
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
              placeholder="Mot de passe maître"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              onClick={handleCreate}
              className="rounded bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500"
            >
              Créer le coffre
            </button>
          </>
        ) : (
          <>
            {useRecovery ? (
              <>
                <textarea
                  className="h-20 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs"
                  placeholder="Collez votre clé de récupération"
                  value={recoveryInput}
                  onChange={(e) => setRecoveryInput(e.target.value)}
                />
                <button
                  onClick={handleUnlock}
                  className="rounded bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500"
                >
                  Déverrouiller avec la clé
                </button>
              </>
            ) : (
              <>
                <input
                  type="password"
                  className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
                  placeholder="Mot de passe maître"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                />
                <button
                  onClick={handleUnlock}
                  className="rounded bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500"
                >
                  Déverrouiller
                </button>
              </>
            )}
            <button
              onClick={() => setUseRecovery(!useRecovery)}
              className="text-xs text-sky-400 hover:underline"
            >
              {useRecovery
                ? '← Utiliser le mot de passe maître'
                : 'Mot de passe oublié ? Utiliser la clé de récupération'}
            </button>
          </>
        )}
        <hr className="border-neutral-800" />
        <h2 className="text-sm font-semibold">Importer un coffre</h2>
        <textarea
          className="h-24 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs"
          placeholder="Collez le JSON exporté"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
        <input
          type="password"
          className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          placeholder="Mot de passe du coffre importé"
          value={importPassword}
          onChange={(e) => setImportPassword(e.target.value)}
        />
        <button
          onClick={handleImport}
          className="rounded border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-900"
        >
          Importer
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  const selected = vault.profiles.find((p) => p.id === selectedId) ?? null;
  const usedTypes = new Set(selected?.fields.map((f) => f.type) ?? []);
  const availableTypes = FIELD_TYPES.filter((t) => !usedTypes.has(t));

  return (
    <div className="mx-auto flex w-[48rem] max-w-full gap-8 p-10">
      <aside className="w-64 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Profils</h1>
          <button
            onClick={addProfile}
            className="rounded bg-sky-600 px-2 py-1 text-xs font-medium hover:bg-sky-500"
          >
            + Nouveau
          </button>
        </div>
        <ul className="space-y-1">
          {vault.profiles.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => setSelectedId(p.id)}
                className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-sm ${
                  selectedId === p.id ? 'bg-neutral-800' : 'hover:bg-neutral-900'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  {p.name}
                </span>
                {vault.defaultProfileId === p.id && (
                  <span className="text-[10px] text-emerald-400">défaut</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className="space-y-2 border-t border-neutral-800 pt-3">
          <button
            onClick={handleExport}
            className="w-full rounded border border-neutral-700 px-2 py-1.5 text-xs hover:bg-neutral-900"
          >
            Exporter le coffre (chiffré)
          </button>
          <button
            onClick={handleDestroy}
            className="w-full rounded border border-red-900 px-2 py-1.5 text-xs text-red-400 hover:bg-red-950"
          >
            Supprimer toutes les données
          </button>
        </div>
        {status && <p className="text-xs text-emerald-400">{status}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </aside>

      <main className="min-w-0 flex-1">
        {!selected ? (
          <p className="text-sm text-neutral-400">
            Sélectionnez ou créez un profil à gauche.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={selected.name}
                onChange={(e) =>
                  updateProfile({ ...selected, name: e.target.value })
                }
                className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm"
              />
              <button
                onClick={() => setDefault(selected.id)}
                className="whitespace-nowrap rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-900"
              >
                Définir par défaut
              </button>
              <button
                onClick={() => removeProfile(selected.id)}
                className="whitespace-nowrap rounded border border-red-900 px-2 py-1 text-xs text-red-400 hover:bg-red-950"
              >
                Supprimer
              </button>
            </div>

            <div className="space-y-3">
              {selected.fields.map((f) => {
                const isDate =
                  f.type === 'birthDate' ||
                  f.type === 'idIssueDate' ||
                  f.type === 'idExpiryDate';

                return (
                  <div
                    key={f.id}
                    className="flex flex-col gap-1 rounded border border-neutral-800 bg-neutral-900/60 p-2.5 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <span className="w-52 shrink-0 text-xs font-medium text-neutral-300">
                      {f.label}
                    </span>

                    <div className="min-w-0 flex-1">
                      {/* Civilité */}
                      {f.type === 'civility' && (
                        <select
                          value={f.value}
                          onChange={(e) => updateField(selected, f.id, e.target.value)}
                          className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
                        >
                          <option value="">Sélectionner…</option>
                          <option value="Monsieur">Monsieur</option>
                          <option value="Madame">Madame</option>
                        </select>
                      )}

                      {/* Pays de naissance */}
                      {f.type === 'birthCountry' && (
                        <select
                          value={f.value}
                          onChange={(e) => updateField(selected, f.id, e.target.value)}
                          className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
                        >
                          <option value="">Sélectionner un pays…</option>
                          {COUNTRIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Nationalité */}
                      {f.type === 'nationality' && (
                        <select
                          value={f.value}
                          onChange={(e) => updateField(selected, f.id, e.target.value)}
                          className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
                        >
                          <option value="">Sélectionner une nationalité…</option>
                          {NATIONALITIES.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Langue(s) usuelle(s) : sélection multiple */}
                      {f.type === 'languages' && (
                        <div className="flex flex-wrap gap-2 text-xs">
                          {COMMON_LANGUAGES.map((lang) => {
                            const current = f.value
                              ? f.value.split(',').map((s) => s.trim())
                              : [];
                            const checked = current.includes(lang);
                            return (
                              <label
                                key={lang}
                                className={`flex items-center gap-1.5 rounded border px-2 py-1 cursor-pointer select-none ${
                                  checked
                                    ? 'border-sky-500 bg-sky-950/60 text-sky-200'
                                    : 'border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-600'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    const next = checked
                                      ? current.filter((l) => l !== lang)
                                      : [...current, lang];
                                    updateField(selected, f.id, next.join(', '));
                                  }}
                                  className="sr-only"
                                />
                                <span>{lang}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {/* Champs de dates */}
                      {isDate && (
                        <DatePickerTriple
                          value={f.value}
                          onChange={(val) => updateField(selected, f.id, val)}
                        />
                      )}

                      {/* E-mail */}
                      {f.type === 'email' && (
                        <input
                          type="email"
                          value={f.value}
                          placeholder="nom@exemple.com"
                          onChange={(e) => updateField(selected, f.id, e.target.value)}
                          className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
                        >
                        </input>
                      )}

                      {/* Téléphone */}
                      {f.type === 'phoneMobile' && (
                        <input
                          type="tel"
                          value={f.value}
                          placeholder="ex. 90 12 34 56 ou +22890123456"
                          onChange={(e) => updateField(selected, f.id, e.target.value)}
                          className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
                        >
                        </input>
                      )}

                      {/* Autres champs texte (Nom, Prénom, Pièce d'identité, Résidence, Profession, Ville de naissance) */}
                      {!isDate &&
                        f.type !== 'civility' &&
                        f.type !== 'birthCountry' &&
                        f.type !== 'nationality' &&
                        f.type !== 'languages' &&
                        f.type !== 'email' &&
                        f.type !== 'phoneMobile' && (
                          <input
                            type="text"
                            value={f.value}
                            onChange={(e) => updateField(selected, f.id, e.target.value)}
                            className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
                          />
                        )}
                    </div>

                    <button
                      type="button"
                      title="Supprimer ce champ"
                      onClick={() => removeField(selected, f.id)}
                      className="self-end sm:self-center text-xs text-neutral-500 hover:text-red-400 p-1"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>

            {availableTypes.length > 0 && (
              <select
                className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
                value=""
                onChange={(e) => {
                  if (e.target.value) addField(selected, e.target.value as SemanticType);
                }}
              >
                <option value="">+ Ajouter un champ…</option>
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            )}

            {/* ── FR-21: Pièces jointes ───────────────────────────────── */}
            <div className="mt-6 border-t border-neutral-800 pt-4">
              <h3 className="mb-3 text-sm font-semibold text-neutral-300">
                📎 Pièces jointes (auto-upload)
              </h3>
              <p className="mb-3 text-xs text-neutral-500">
                Les fichiers sont chiffrés dans le coffre et injectés automatiquement
                dans les champs <code>input[type=file]</code> des formulaires.
              </p>

              {(
                [
                  { key: 'idPhotoFile', label: 'Photo d\'identité (passeport / CNI recto)' },
                  { key: 'idDocumentFile', label: 'Document d\'identité complet (PDF ou image)' },
                ] as { key: FileAttachment['type']; label: string }[]
              ).map(({ key, label }) => {
                const current = selected.attachments?.find((a) => a.type === key);
                return (
                  <div key={key} className="mb-3 rounded border border-neutral-700 bg-neutral-900 p-3">
                    <p className="mb-1.5 text-xs font-medium text-neutral-400">{label}</p>
                    {current ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-lg">
                            {current.mimeType.startsWith('image/') ? '🖼️' : '📄'}
                          </span>
                          <span className="truncate text-xs text-neutral-300">{current.name}</span>
                          <span className="shrink-0 text-[10px] text-neutral-500">
                            {(current.sizeBytes / 1024).toFixed(1)} Ko
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(selected, current.id)}
                          className="shrink-0 rounded px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/30"
                        >
                          Supprimer
                        </button>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer flex-col items-center gap-1 rounded border-2 border-dashed border-neutral-700 px-3 py-3 text-center text-xs text-neutral-500 hover:border-indigo-600 hover:text-indigo-400">
                        <span className="text-xl">⬆️</span>
                        <span>Cliquer ou glisser un fichier ici</span>
                        <span className="text-[10px]">JPG, PNG, PDF — max 5 Mo</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && file.size <= 5 * 1024 * 1024) {
                              addAttachment(selected, file, key);
                            } else if (file) {
                              setError('Fichier trop volumineux (max 5 Mo).');
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}