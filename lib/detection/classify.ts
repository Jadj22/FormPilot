import type { DetectedField, SemanticType } from '../types';
import { dateGroupLabel } from '../datePart';
import { AUTOCOMPLETE_MAP, DICT_RULES } from './dictionary';
import {
  NAME_ID_PATTERNS,
  applyNegativeRules,
  calculateConfidence,
  isAuthorizedType,
  normalizeLabel,
} from './rules';

export interface RawField {
  el: HTMLElement;
  key: string;
}

const SENSITIVE_INPUT_TYPES = new Set(['password', 'hidden', 'file', 'image', 'submit', 'button', 'reset']);

let keyCounter = 0;
const elementKeys = new WeakMap<HTMLElement, string>();

export function getFieldKey(el: HTMLElement): string {
  let key = elementKeys.get(el);
  if (!key) {
    key = `f${++keyCounter}`;
    elementKeys.set(el, key);
  }
  return key;
}

function isVisible(el: HTMLElement): boolean {
  const input = el as HTMLInputElement;
  if (input.disabled || el.hidden) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) < 0.1) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  return true;
}

function isHoneypot(el: HTMLElement): boolean {
  const name = (el.getAttribute('name') || '').toLowerCase();
  const id = (el.getAttribute('id') || '').toLowerCase();
  if (/honeypot|botcheck|trap|anti.?spam/.test(name + id)) return true;
  const autocomplete = (el.getAttribute('autocomplete') || '').toLowerCase();
  if (autocomplete === 'off') {
    const style = window.getComputedStyle(el);
    if (parseFloat(style.opacity) < 0.1 || style.position === 'absolute') return true;
  }
  return false;
}

function labelTextFor(el: HTMLElement): string {
  const parts: string[] = [];
  const aria = el.getAttribute('aria-label');
  if (aria) parts.push(aria);
  const placeholder = el.getAttribute('placeholder');
  if (placeholder) parts.push(placeholder);
  const title = el.getAttribute('title');
  if (title) parts.push(title);
  const name = el.getAttribute('name');
  if (name) parts.push(name);
  const id = el.getAttribute('id');
  if (id) {
    parts.push(id);
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label?.textContent) parts.push(label.textContent);
  }
  const parentLabel = el.closest('label');
  if (parentLabel?.textContent) parts.push(parentLabel.textContent);
  const previous = el.previousElementSibling;
  if (previous && /^(LABEL|SPAN|DIV|P)$/.test(previous.tagName)) {
    const text = previous.textContent?.trim();
    if (text && text.length < 80) parts.push(text);
  }
  // Date en trois listes (Jour / Mois / Année) : le libellé est sur la 1re liste
  if (el instanceof HTMLSelectElement) {
    const group = dateGroupLabel(el);
    if (group) parts.push(group);
  }
  // Un même texte (ex. <label for> + <label> voisin) ne doit compter qu'une fois
  const unique = parts
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p, i, all) => p && all.indexOf(p) === i);
  return unique
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export function collectFields(root: ParentNode = document): RawField[] {
  const selector = 'input:not([type]), input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="date"], input[type="search"], input[type="url"], select, textarea';
  const elements = Array.from(root.querySelectorAll<HTMLElement>(selector));
  return elements
    .filter((el) => {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (SENSITIVE_INPUT_TYPES.has(type)) return false;
      if (isHoneypot(el)) return false;
      return isVisible(el);
    })
    .map((el) => ({ el, key: getFieldKey(el) }));
}

export interface ScoredClassification {
  type: SemanticType | null;
  confidence: number;
}

/** Type sémantique suggéré par le type HTML de l'input (signal faible). */
function getTypeFromInputType(type: string): SemanticType | null {
  switch (type) {
    case 'email':
      return 'email';
    case 'tel':
      return 'phoneMobile';
    case 'date':
      return 'birthDate';
    default:
      return null;
  }
}

/**
 * Mots qui identifient un champ à eux seuls mais que le dictionnaire ne couvre pas
 * (ex. « Nom » tout court). Le libellé contient aussi name/id, donc on cherche le
 * mot entier n'importe où et non au début.
 */
const LABEL_WORD_RULES: ReadonlyArray<readonly [SemanticType, RegExp, number]> = [
  ['lastName', /\bnom\b/, 70],
];

function toAlnum(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function classifyField(el: HTMLElement, label: string): ScoredClassification {
  const scores = new Map<SemanticType, number>();
  const bump = (type: SemanticType, score: number) => {
    scores.set(type, Math.max(scores.get(type) ?? 0, score));
  };

  const labelNormalized = normalizeLabel(label);
  const inputType = (el.getAttribute('type') || 'text').toLowerCase();

  // 1. Attribut autocomplete (100 points s'il correspond exactement)
  const autocomplete = (el.getAttribute('autocomplete') || '').toLowerCase();
  const fromAutocomplete = AUTOCOMPLETE_MAP[autocomplete];
  if (fromAutocomplete) bump(fromAutocomplete, 100);

  // 2. Type HTML de l'input : +30 (plafonné à 100)
  const typeFromInput = getTypeFromInputType(inputType);
  if (typeFromInput) {
    scores.set(typeFromInput, Math.min(100, (scores.get(typeFromInput) ?? 0) + 30));
  }

  // 3. Libellé via le dictionnaire (poids variables)
  if (labelNormalized) {
    for (const r of DICT_RULES) {
      if (r.pattern.test(labelNormalized)) bump(r.type, Math.round(r.weight * 100));
    }
  }

  // 4. Attributs name / id
  const nameId = [el.getAttribute('name'), el.getAttribute('id')]
    .filter((v): v is string => !!v)
    .map(toAlnum);
  if (nameId.length > 0) {
    for (const { type, names } of NAME_ID_PATTERNS) {
      if (names.some((n) => nameId.includes(n))) bump(type, 25);
    }
  }

  // 5. Mots entiers dans le libellé
  for (const [type, pattern, score] of LABEL_WORD_RULES) {
    if (pattern.test(labelNormalized)) bump(type, score);
  }

  // 6. Pénalités : règles négatives + incohérences avec le type HTML
  const adjusted: Array<{ type: SemanticType; score: number }> = [];
  for (const [type, rawScore] of scores) {
    if (!isAuthorizedType(type)) continue;
    let score = applyNegativeRules(type, rawScore, labelNormalized);
    if (inputType === 'email' && type === 'addressLine1') score -= 60;
    if (inputType === 'tel' && type === 'email') score -= 50;
    adjusted.push({ type, score: Math.max(0, score) });
  }

  // 7. Type gagnant
  adjusted.sort((a, b) => b.score - a.score);
  const best = adjusted[0];
  if (!best || best.score <= 0) return { type: null, confidence: 0 };

  let bestScore = best.score;
  const second = adjusted[1];
  // Égalité entre deux types : on baisse la confiance
  if (second && second.score === bestScore && bestScore < 80) {
    bestScore = Math.max(40, bestScore - 25);
  }

  const confidence = calculateConfidence(bestScore);
  return { type: confidence > 0 ? best.type : null, confidence };
}

export function getFieldSignature(el: HTMLElement, label: string): string {
  const name = el.getAttribute('name');
  if (name) return `name:${name.toLowerCase().trim()}`;
  const id = el.getAttribute('id');
  if (id) return `id:${id.toLowerCase().trim()}`;
  return `label:${label.toLowerCase().trim()}`;
}

export function detectFields(root: ParentNode = document): DetectedField[] {
  return collectFields(root).map(({ el, key }) => {
    const label = labelTextFor(el);
    const { type, confidence } = classifyField(el, label);
    const current =
      el instanceof HTMLSelectElement
        ? (el.selectedOptions[0]?.textContent?.trim() ?? '')
        : ((el as HTMLInputElement).value ?? '');
    const name = el.getAttribute('name') ?? undefined;
    const id = el.getAttribute('id') ?? undefined;

    return {
      key,
      label: label || '(sans libellé)',
      name,
      id,
      type,
      confidence,
      value: current,
      selected: type !== null && confidence >= 60,
    };
  });
}

const rawFieldCache = new Map<string, RawField>();

export function refreshFieldCache(root: ParentNode = document): void {
  rawFieldCache.clear();
  for (const f of collectFields(root)) {
    rawFieldCache.set(f.key, f);
  }
}

export function getRawField(key: string): RawField | undefined {
  return rawFieldCache.get(key);
}
