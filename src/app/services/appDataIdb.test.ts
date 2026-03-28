import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAppData, setAppData } from './appDataIdb';
import type { AppData } from './appDataIdb';

describe('appDataIdb', () => {
  let fakeStore: Record<string, unknown>;

  beforeEach(() => {
    fakeStore = {};
    vi.stubGlobal('indexedDB', {
      open: vi.fn((_name: string, _version: number) => {
        const req = { result: undefined as IDBDatabase | undefined, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null, onupgradeneeded: null as (() => void) | null };
        const store = {
          get: () => {
            const r = { result: fakeStore['state'], onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
            setTimeout(() => r.onsuccess?.(), 0);
            return r;
          },
          put: (value: unknown, key: string) => {
            fakeStore[key] = value;
            const r = { oncomplete: null as (() => void) | null, onerror: null as (() => void) | null };
            setTimeout(() => { r.oncomplete?.(); (tx as { oncomplete: (() => void) | null }).oncomplete?.(); }, 0);
            return r;
          },
        };
        const tx = { oncomplete: null as (() => void) | null, onerror: null as (() => void) | null, objectStore: () => store };
        req.result = {
          objectStoreNames: { contains: () => true },
          transaction: () => tx as unknown as IDBTransaction,
          close: () => {},
        } as unknown as IDBDatabase;
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getAppData returns default when no data', async () => {
    const data = await getAppData();
    expect(data.assistantMessages).toEqual([]);
  });

  it('setAppData then getAppData roundtrips', async () => {
    const appData: AppData = {
      assistantMessages: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
      ],
    };
    await setAppData(appData);
    const loaded = await getAppData();
    expect(loaded.assistantMessages).toHaveLength(2);
    expect(loaded.assistantMessages[0].content).toBe('Hi');
  });

  it('normalizes invalid assistantMessages to empty', async () => {
    fakeStore['state'] = { assistantMessages: 'not an array' };
    const data = await getAppData();
    expect(data.assistantMessages).toEqual([]);
  });

  it('filters invalid message entries', async () => {
    await setAppData({
      assistantMessages: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Ok' },
        null as unknown as AppData['assistantMessages'][0],
        { role: 'invalid', content: 'x' } as unknown as AppData['assistantMessages'][0],
      ],
    });
    const loaded = await getAppData();
    expect(loaded.assistantMessages).toHaveLength(2);
    expect(loaded.assistantMessages[0].content).toBe('Hi');
    expect(loaded.assistantMessages[1].content).toBe('Ok');
  });

  it('caps assistant messages to last 500 (security hardening)', async () => {
    const over500 = Array.from({ length: 600 }, (_, i) =>
      i % 2 === 0
        ? { role: 'user' as const, content: `user ${i}` }
        : { role: 'assistant' as const, content: `assistant ${i}` }
    );
    await setAppData({ assistantMessages: over500 });
    const loaded = await getAppData();
    expect(loaded.assistantMessages).toHaveLength(500);
    expect(loaded.assistantMessages[0].content).toBe('user 100');
    expect(loaded.assistantMessages[loaded.assistantMessages.length - 1].content).toBe('assistant 599');
  });

  it('truncates message content over 5000 chars (security hardening)', async () => {
    const longContent = 'x'.repeat(6000);
    await setAppData({
      assistantMessages: [{ role: 'user', content: longContent }],
    });
    const loaded = await getAppData();
    expect(loaded.assistantMessages).toHaveLength(1);
    expect(loaded.assistantMessages[0].content).toHaveLength(5001);
    expect(loaded.assistantMessages[0].content.slice(-1)).toBe('…');
    expect(loaded.assistantMessages[0].content.slice(0, 5000)).toBe('x'.repeat(5000));
  });
});
