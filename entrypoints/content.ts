import {
  detectFields,
  getRawField,
  refreshFieldCache,
} from '~/lib/detection/classify';
import {
  applyValue,
  restore,
  snapshot,
  type UndoEntry,
} from '~/lib/fill/fill';
import { normalizeForType } from '~/lib/normalize';
import { classifyWeezevent, isWeezeventHost } from '~/lib/weezevent/rules';
import type {
  ContentRequest,
  ContentResponse,
  DetectedField,
  FillItem,
  Profile,
} from '~/lib/types';
import { resolveValue } from '~/lib/fill/fill';

let lastDetection: DetectedField[] = [];
let undoStack: UndoEntry[] = [];

function reclassifyWithSiteRules(
  fields: DetectedField[],
  hostname: string,
): DetectedField[] {
  if (!isWeezeventHost(hostname)) return fields;
  return fields.map((f) => {
    const hit = classifyWeezevent(f.label);
    if (hit) {
      return {
        ...f,
        type: hit.type,
        confidence: Math.max(f.confidence, 90),
        selected: true,
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

async function handleDetect(): Promise<ContentResponse> {
  refreshFieldCache();
  let fields = detectFields();
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
    const baseValue =
      item.overrideValue ?? resolveValue(profile, type);
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
              sendResponse(await handleDetect());
            } else if (message.type === 'FILL') {
              sendResponse(await handleFill(message.items, message.profile));
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

    ctx.onInvalidated(() => {
      undoStack = [];
      lastDetection = [];
    });
  },
});
