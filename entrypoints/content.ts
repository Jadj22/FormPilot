import {
  classifyFields,
  getRawField,
  refreshFieldCache,
  getDetectionResults,
} from '~/lib/detection/classify';
import {
  applyFileValue,
  applyValue,
  restore,
  snapshot,
  type UndoEntry,
} from '~/lib/fill/fill';
import { normalizeForType } from '~/lib/normalize';
import { classifyWeezevent, isWeezeventHost } from '~/lib/weezevent/rules';
import type {
  ContentPushMessage,
  ContentRequest,
  ContentResponse,
  DetectedField,
  FillItem,
  LearnedMapping,
  Profile,
} from '~/lib/types';
import { resolveValue } from '~/lib/fill/fill';

let lastDetection: DetectedField[] = [];
let undoStack: UndoEntry[] = [];
/** Cached from last DETECT call so the MutationObserver can re-detect autonomously. */
let lastLearnedMappings: LearnedMapping[] = [];
let stepObserver: MutationObserver | null = null;
let stepDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let floatingBtn: HTMLElement | null = null;
let floatDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const STEP_DEBOUNCE_MS = 400;
const FLOAT_DELAY_MS = 800;

function applyLearnedMappings(
  fields: DetectedField[],
  hostname: string,
  mappings: LearnedMapping[] = [],
): DetectedField[] {
  if (!mappings || mappings.length === 0) return fields;

  // Use the new rules-based detection from the detection module
  return fields.map((f) => {
    // Try learned mappings first, but also consider new signaling
    const hostMappings = mappings.filter((m) =>
      m.hostname === hostname || m.hostname === '*',
    );

    if (hostMappings.length === 0) return f;

    // Check for learned mapping match
    const hit = hostMappings.find((m) => {
      // Match by normalized label using new signaling
      if (m.fieldSignature && f.label) {
        const normalizedLabel = f.label.toLowerCase().trim();
        return normalizedLabel.includes(m.fieldSignature.toLowerCase());
      }
      return false;
    });

    if (hit) {
      // Use learned type but also check confidence with new signaling
      const newClassification = classifyField(
        document.createElement('div'),
        f.label || '',
      );
      const effectiveType = newClassification.type || hit.type;
      const effectiveConfidence = Math.max(hit.confidence, newClassification.confidence);

      return {
        ...f,
        type: effectiveType,
        confidence: effectiveConfidence,
        selected: effectiveConfidence >= 70,
        isLearned: true,
      };
    }

    return f;
  });
}

function reclassifyWithSiteRules(
  fields: DetectedField[],
  hostname: string,
): DetectedField[] {
  if (!isWeezeventHost(hostname)) return fields;
  return fields.map((f) => {
    if (f.isLearned) return f;
    // Use the new multi-signaling classifyField instead of simple pattern matching
    const newClassification = classifyField(
      document.createElement('div'),
      f.label || '',
    );
    if (newClassification.type) {
      return {
        ...f,
        type: newClassification.type,
        confidence: Math.max(f.confidence, newClassification.confidence),
        selected: newClassification.confidence >= 70,
      };
    }
    return f;
  });
}

function collectWarnings(): string[] {
  const warnings: string[] = [];
  const forms = Array.from(document.querySelectorAll('form'));
  for (const form of forms) {
    const action = form.getAttribute('action');
    if (!action) continue;
    try {
      const url = new URL(action, location.href);
      if (url.protocol === 'http:' && location.protocol === 'https:') {
        warnings.push('Un formulaire envoie ses données en HTTP non sécurisé.');
      }
      if (url.origin !== location.origin) {
        warnings.push(
          `Un formulaire envoie ses données vers un autre domaine (${url.origin}).`,
        );
      }
    } catch {
      // action invalide, on ignore
    }
  }
  return [...new Set(warnings)];
}

// ─── Multi-step / MutationObserver helpers ───────────────────────────────────

/** True only when a mutation record contains an added/removed form element. */
function hasFormElementMutation(mutations: MutationRecord[]): boolean {
  const formTags = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'FORM', 'FIELDSET']);
  for (const m of mutations) {
    for (const node of [...m.addedNodes, ...m.removedNodes]) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as Element;
      if (formTags.has(el.tagName)) return true;
      if (el.querySelector?.('input, select, textarea')) return true;
    }
  }
  return false;
}

/** True when the set of field keys or their order has changed. */
function fieldsSignatureChanged(next: DetectedField[], prev: DetectedField[]): boolean {
  if (next.length !== prev.length) return true;
  return next.some((f, i) => f.key !== prev[i]?.key);
}

/** Debounced handler called by the MutationObserver after a form-element mutation. */
function onDomMutation(): void {
  if (stepDebounceTimer) clearTimeout(stepDebounceTimer);
  stepDebounceTimer = setTimeout(async () => {
    refreshFieldCache();
    let fields = detectFields();
    fields = applyLearnedMappings(fields, location.hostname, lastLearnedMappings);
    fields = reclassifyWithSiteRules(fields, location.hostname);

    if (!fieldsSignatureChanged(fields, lastDetection)) return;

    lastDetection = fields;
    const msg: ContentPushMessage = {
      type: 'STEP_CHANGED',
      detected: fields,
      warnings: collectWarnings(),
    };
    try {
      await browser.runtime.sendMessage(msg);
    } catch {
      // Popup is closed — message is silently dropped, no action needed.
    }
  }, STEP_DEBOUNCE_MS);
}

function startStepObserver(): MutationObserver {
  const obs = new MutationObserver((mutations) => {
    if (hasFormElementMutation(mutations)) onDomMutation();
  });
  obs.observe(document.body, { childList: true, subtree: true });
  return obs;
}

// ─── Request handlers ─────────────────────────────────────────────────────────

async function handleDetect(learnedMappings?: LearnedMapping[]): Promise<ContentResponse> {
  lastLearnedMappings = learnedMappings ?? [];
  refreshFieldCache();
  let fields = detectFields();
  fields = applyLearnedMappings(fields, location.hostname, lastLearnedMappings);
  fields = reclassifyWithSiteRules(fields, location.hostname);
  lastDetection = fields;
  return { ok: true, detected: fields, warnings: collectWarnings() };
}

async function handleFill(items: FillItem[], profile: Profile): Promise<ContentResponse> {
  undoStack = [];
  const onWeezevent = isWeezeventHost(location.hostname);
  let filled = 0;

  for (const item of items) {
    if (!item.selected) continue;
    const raw = getRawField(item.key);
    if (!raw) continue;
    const detected = lastDetection.find((d) => d.key === item.key);
    const type = item.overrideType ?? detected?.type ?? null;

    // ─ FR-21: input[type=file] branch ───────────────────────────────────────
    if (raw.el instanceof HTMLInputElement && raw.el.type === 'file') {
      // Explicit override dataUrl from FillItem, or resolve from profile attachments
      const dataUrl =
        item.fileDataUrl ??
        profile.attachments?.find((a) => a.type === type)?.dataUrl;
      const mimeType =
        item.fileMimeType ??
        profile.attachments?.find((a) => a.type === type)?.mimeType ??
        'application/octet-stream';
      const fileName =
        item.fileName ??
        profile.attachments?.find((a) => a.type === type)?.name ??
        'document';
      if (dataUrl) {
        undoStack.push(snapshot(raw.el));
        if (applyFileValue(raw.el as HTMLInputElement, dataUrl, mimeType, fileName)) filled++;
      }
      continue;
    }

    // ─ Standard text / select / textarea branch ───────────────────────────
    const baseValue = item.overrideValue ?? resolveValue(profile, type);
    if (!baseValue) continue;
    let value = normalizeForType(type, baseValue);
    if (onWeezevent && detected) {
      const hit = classifyWeezevent(detected.label);
      if (hit?.transform === 'uppercase') value = value.toUpperCase();
    }
    undoStack.push(snapshot(raw.el));
    if (applyValue(raw.el, value)) filled++;
  }
  return { ok: true, filled };
}

function handleUndo(): ContentResponse {
  for (let i = undoStack.length - 1; i >= 0; i--) {
    const entry = undoStack[i];
    if (entry) restore(entry);
  }
  const count = undoStack.length;
  undoStack = [];
  return { ok: true, undone: count > 0 };
}

// ─── FR-28 : Floating icon ──────────────────────────────────────────────────

function hasInteractiveFormFields(): boolean {
  return document.querySelectorAll('input:not([type=hidden]), select, textarea').length > 0;
}

function mountFloatingButton(): void {
  if (floatingBtn || !hasInteractiveFormFields()) return;

  const btn = document.createElement('button');
  btn.id = 'formpilot-float-btn';
  btn.setAttribute('aria-label', 'FormPilot — remplir ce formulaire');
  btn.title = 'Ouvrir FormPilot';
  btn.style.cssText = [
    'position:fixed', 'bottom:20px', 'right:20px', 'z-index:2147483647',
    'width:44px', 'height:44px', 'border-radius:50%', 'border:none',
    'background:linear-gradient(135deg,#6366f1,#8b5cf6)',
    'color:#fff', 'font-size:22px', 'cursor:pointer',
    'box-shadow:0 4px 14px rgba(99,102,241,.55)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'transition:transform .15s,box-shadow .15s',
  ].join(';');
  btn.textContent = '✈️';
  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'scale(1.1)';
    btn.style.boxShadow = '0 6px 20px rgba(99,102,241,.75)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 4px 14px rgba(99,102,241,.55)';
  });
  btn.addEventListener('click', () => {
    try {
      // @ts-expect-error — sidePanel API MV3
      chrome.sidePanel.open({ tabId: undefined });
    } catch {
      browser.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    }
  });

  document.body.appendChild(btn);
  floatingBtn = btn;
}

function scheduleFloatingButton(): void {
  if (floatDebounceTimer) clearTimeout(floatDebounceTimer);
  floatDebounceTimer = setTimeout(mountFloatingButton, FLOAT_DELAY_MS);
}

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,

  runAt: 'document_idle',
  async main(ctx) {
    browser.runtime.onMessage.addListener(
      (message: ContentRequest, _sender, sendResponse) => {
        (async () => {
          try {
            if (message.type === 'DETECT') {
              // Use new multi-signaling detection pipeline
              const detected = await startDetectionLib(document, ctx?.url?.hostname ?? '', message.learnedMappings);
              sendResponse(await getDetectionResults(detected));
            } else if (message.type === 'FILL') {
              // Use new fill pipeline with detected fields
              sendResponse(await handleFillNew(message.items, message.profile));
            } else if (message.type === 'UNDO') {
              sendResponse(handleUndo());
            } else if (message.type === 'STATUS') {
              sendResponse({
                ok: true,
                status: { fields: lastDetection.length, filled: undoStack.length },
              });
            } else {
              sendResponse({ ok: false, error: 'Message inconnu' });
            }
          } catch (e) {
            sendResponse({ ok: false, error: String(e) });
          }
        })();
        return true;
      },
    );

    stepObserver = startStepObserver();
    scheduleFloatingButton();

    ctx.onInvalidated(() => {
      undoStack = [];
      lastDetection = [];
      lastLearnedMappings = [];
      if (stepDebounceTimer) clearTimeout(stepDebounceTimer);
      if (floatDebounceTimer) clearTimeout(floatDebounceTimer);
      stepObserver?.disconnect();
      stepObserver = null;
      floatingBtn?.remove();
      floatingBtn = null;
    });
  },
});
