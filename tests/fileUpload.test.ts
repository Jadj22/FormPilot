// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyFileValue } from '~/lib/fill/fill';

// A minimal 1x1 transparent PNG in base64 (for realistic testing)
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PNG_DATA_URL = `data:image/png;base64,${TINY_PNG_B64}`;

describe('applyFileValue (FR-21)', () => {
  it('returns false for non-file inputs', () => {
    const el = document.createElement('input');
    el.type = 'text';
    expect(applyFileValue(el, PNG_DATA_URL, 'image/png', 'photo.png')).toBe(false);
  });

  it('injects a file into input[type=file]', () => {
    const el = document.createElement('input');
    el.type = 'file';
    document.body.appendChild(el);

    const result = applyFileValue(el, PNG_DATA_URL, 'image/png', 'id_photo.png');
    expect(result).toBe(true);
    expect(el.files).not.toBeNull();
    expect(el.files!.length).toBe(1);
    expect(el.files![0]!.name).toBe('id_photo.png');
    expect(el.files![0]!.type).toBe('image/png');

    el.remove();
  });

  it('dispatches input and change events after file injection', () => {
    const el = document.createElement('input');
    el.type = 'file';
    document.body.appendChild(el);
    const events: string[] = [];
    el.addEventListener('input', () => events.push('input'));
    el.addEventListener('change', () => events.push('change'));

    applyFileValue(el, PNG_DATA_URL, 'image/png', 'passport.png');
    expect(events).toContain('input');
    expect(events).toContain('change');

    el.remove();
  });

  it('returns false for an invalid data URL (no comma)', () => {
    const el = document.createElement('input');
    el.type = 'file';
    document.body.appendChild(el);
    expect(applyFileValue(el, 'data:image/png;base64', 'image/png', 'bad.png')).toBe(false);
    el.remove();
  });

  it('sets the correct file size from the base64 data', () => {
    const el = document.createElement('input');
    el.type = 'file';
    document.body.appendChild(el);
    applyFileValue(el, PNG_DATA_URL, 'image/png', 'tiny.png');
    const file = el.files![0]!;
    // decoded bytes count: atob(TINY_PNG_B64).length
    const expectedSize = atob(TINY_PNG_B64).length;
    expect(file.size).toBe(expectedSize);
    el.remove();
  });
});
