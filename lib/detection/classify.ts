import type { DetectedField, SemanticType } from '../types';
import { AUTOCOMPLETE_MAP, normalizeLabel, isAuthorizedType, calculateScore, applyNegativeRules, NAME_ID_PATTERNS, NEGATIVE_RULES, AUTHORIZED_SEMANTIC_TYPES } from './rules';
import { DICT_RULES } from './dictionary';

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
  return parts
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

export function classifyField(el: HTMLElement, label: string): ScoredClassification {
  const scores = new Map<SemanticType, number>();

  // 1. Signal autocomplete (100 points s'il correspond exactement)
  const autocomplete = (el.getAttribute('autocomplete') || '').toLowerCase();
  if (autocomplete && AUTOCOMPLETE_MAP[autocomplete]) {
    scores.set(AUTOCOMPLETE_MAP[autocomplete], 100);
  }

  // 2. Signal type d'input (type HTML)
  const inputType = (el.getAttribute('type') || 'text').toLowerCase();
  const typeFromInput = getTypeFromInputType(inputType);
  if (typeFromInput && !scores.has(typeFromInput)) {
    scores.set(typeFromInput, 30); // 30 points pour type compatible
  } else if (typeFromInput && scores.has(typeFromInput)) {
    scores.set(typeFromInput, scores.get(typeFromInput)! + 30);
  }

  // 3. Signal libellé via règles DICT (weights variables)
  const haystack = normalizeLabel(label);
  if (scores.size === 0 || haystack) {
    for (const r of DICT_RULES) {
      if (r.pattern.test(haystack)) {
        const current = scores.get(r.type) ?? 0;
        scores.set(r.type, Math.max(current, Math.round(r.weight * 100)));
      }
    }
  }

  // 4. Signal name/id correspondant
  const name = (el.getAttribute('name') || '').toLowerCase();
  const id = (el.getAttribute('id') || '').toLowerCase();
  for (const [type, patterns] of Object.entries(NAME_ID_PATTERNS)) {
    if (patterns.includes(name) || patterns.includes(id)) {
      const current = scores.get(type as SemanticType) ?? 0;
      scores.set(type as SemanticType, Math.max(current, 25)); // 25 points
    }
  }

  // 5. Signal label text direct (matching précis)
  const labelNormalized = normalizeLabel(label);
  for (const [type, pattern] of [
    ['firstName', /^(prenom|given|firstname)/],
    ['lastName', /^(nom|surname|lastname)/],
    ['email', /^email|mail|courriel/],
    ['phone', /^(tel|phone|mobile)/],
    ['address', /^(adresse|street)/],
    ['city', /^(ville|city)/],
    ['country', /^(pays|country)/],
    ['birthDate', /^(date.*naiss|dob)/],
  ]) {
    if (pattern.test(labelNormalized)) {
      const current = scores.get(type as SemanticType) ?? 0;
      scores.set(type as SemanticType, Math.max(current, 35));
    }
  }

  // 6. Appliquer les règles négatives (exclusions)
  const matchedNegatives: SemanticType[] = [];
  for (const rule of NEGATIVE_RULES) {
    if (rule.pattern.test(labelNormalized)) {
      matchedNegatives.push(rule.type);
    }
  }
  // Vérifications spécifiques par type
  if (typeFromInput === 'email' && /adresse|street/.test(labelNormalized)) {
    matchedNegatives.push('exclude');
  }
  if (typeFromInput === 'phone' && /email|mail/.test(labelNormalized)) {
    matchedNegatives.push('exclude');
  }

  // Appliquer les pénalités négatives
  let finalScore = 0;
  for (const [type, score] of scores) {
    if (!isAuthorizedType(type as string)) continue;
    let typeScore = score;
    if (matchedNegatives.includes(type)) {
      typeScore = applyNegativeRules(score, [type]);
    }
    if (typeScore > finalScore) {
      finalScore = typeScore;
    }
  }

  // Déterminer le niveau de confiance
  let confidence: number;
  if (finalScore >= 70) confidence = 100;
  else if (finalScore >= 40) confidence = 70;
  else if (finalScore >= 20) confidence = 40;
  else confidence = 0;

  // Trouver le type gagnant
  let best: SemanticType | null = null;
  for (const [type, score] of scores) {
    if (!isAuthorizedType(type as string)) continue;
    if (score >= finalScore || (finalScore > 0 && !best)) {
      best = type;
      finalScore = score;
    }
  }

  /**
 * Détermine le type sémantique à partir du type HTML de l'entrée
 */
function getTypeFromInputType(type: string): SemanticType | null {
  const map: Record<string, SemanticType> = {
    'text': null,
    'email': 'email',
    'tel': 'phoneMobile',
    'number': null,
    'date': 'birthDate',
    'search': null,
    'url': null,
    'password': null,
  };
  return map[type] || null;
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
