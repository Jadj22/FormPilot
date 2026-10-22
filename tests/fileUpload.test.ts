// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { applyFileValue } from '~/lib/fill/fill';

// ─── DataTransfer mock ────────────────────────────────────────────────────────
// jsdom does not implement DataTransfer.items or writable `el.files`.
// We mock DataTransfer so we can verify the File is built correctly, and
// we use Object.defineProperty to make el.files writable for the injection test.

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PNG_DATA_URL = `data:image/png;base64,${TINY_PNG_B64}`;

/** Build a DataTransfer stub whose .files can be set on an input element. */
function stubDataTransfer(capturedFiles: File[]) {
  return class DataTransferStub {
    private _file: File | null = null;

    get files(): FileList {
      // Return a minimal FileList-like object
      const arr = this._file ? [this._file] : [];
      return Object.assign(arr, {
        item: (i: number) => arr[i] ?? null,
        length: arr.length,
        [Symbol.iterator]: arr[Symbol.iterator].bind(arr),
      }) as unknown as FileList;
    }

    items = {
      add: (file: File) => {
        capturedFiles.push(file);
        this._file = file;
      },
    };
  };
}

describe('applyFileValue (FR-21)', () => {
  let capturedFiles: File[];

  beforeEach(() => {
    capturedFiles = [];
    vi.stubGlobal('DataTransfer', stubDataTransfer(capturedFiles));
  });

  it('returns false for non-file inputs', () => {
    const el = document.createElement('input');
    el.type = 'text';
    expect(applyFileValue(el, PNG_DATA_URL, 'image/png', 'photo.png')).toBe(false);
  });

  it('returns false for an invalid data URL (no comma)', () => {
    const el = document.createElement('input');
    el.type = 'file';
    document.body.appendChild(el);
    expect(applyFileValue(el, 'data:image/png;base64', 'image/png', 'bad.png')).toBe(false);
    el.remove();
  });

  it('builds a File with correct name, type, and decoded size', () => {
    const el = document.createElement('input');
    el.type = 'file';
    // Make el.files writable so the assignment in applyFileValue succeeds
    Object.defineProperty(el, 'files', { writable: true, value: null });
    document.body.appendChild(el);

    applyFileValue(el, PNG_DATA_URL, 'image/png', 'id_photo.png');

    expect(capturedFiles).toHaveLength(1);
    const file = capturedFiles[0]!;
    expect(file.name).toBe('id_photo.png');
    expect(file.type).toBe('image/png');
    expect(file.size).toBe(atob(TINY_PNG_B64).length);

    el.remove();
  });

  it('dispatches input and change events after file injection', () => {
    const el = document.createElement('input');
    el.type = 'file';
    Object.defineProperty(el, 'files', { writable: true, value: null });
    document.body.appendChild(el);

    const events: string[] = [];
    el.addEventListener('input', () => events.push('input'));
    el.addEventListener('change', () => events.push('change'));

    applyFileValue(el, PNG_DATA_URL, 'image/png', 'passport.png');
    expect(events).toContain('input');
    expect(events).toContain('change');

    el.remove();
  });

  it('returns true when DataTransfer assignment succeeds', () => {
    const el = document.createElement('input');
    el.type = 'file';
    Object.defineProperty(el, 'files', { writable: true, value: null });
    document.body.appendChild(el);

    const result = applyFileValue(el, PNG_DATA_URL, 'image/png', 'test.png');
    expect(result).toBe(true);

    el.remove();
  });
});
