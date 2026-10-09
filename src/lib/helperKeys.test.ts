import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isPersisted, rememberedPassword, storePassword } from './helperKeys'

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('sessionStorage', memoryStorage())
})

describe('helper password memory', () => {
  it('returns null when nothing is stored', () => {
    expect(rememberedPassword('k1')).toBeNull()
    expect(isPersisted('k1')).toBe(false)
  })

  it('keeps the password only for the session unless persistence is allowed', () => {
    storePassword('k1', 'aaaa-bbbb-cccc', false)
    expect(rememberedPassword('k1')).toBe('aaaa-bbbb-cccc')
    expect(isPersisted('k1')).toBe(false)
    expect(localStorage.getItem('komatal:pw:k1')).toBeNull()
  })

  it('persists across sessions when allowed', () => {
    storePassword('k1', 'aaaa-bbbb-cccc', true)
    sessionStorage.clear()
    expect(rememberedPassword('k1')).toBe('aaaa-bbbb-cccc')
    expect(isPersisted('k1')).toBe(true)
  })

  it('forgets the persisted copy when the helper declines', () => {
    storePassword('k1', 'aaaa-bbbb-cccc', true)
    storePassword('k1', 'aaaa-bbbb-cccc', false)
    expect(isPersisted('k1')).toBe(false)
  })

  it('keeps komatáls separate', () => {
    storePassword('k1', 'one', true)
    storePassword('k2', 'two', false)
    expect(rememberedPassword('k1')).toBe('one')
    expect(rememberedPassword('k2')).toBe('two')
    expect(rememberedPassword('k3')).toBeNull()
  })

  it('does not throw when storage is blocked', () => {
    const blocked = new Proxy({}, { get() { throw new Error('SecurityError') } }) as unknown as Storage
    vi.stubGlobal('localStorage', blocked)
    vi.stubGlobal('sessionStorage', blocked)
    expect(() => storePassword('k1', 'x', true)).not.toThrow()
    expect(rememberedPassword('k1')).toBeNull()
    expect(isPersisted('k1')).toBe(false)
  })
})
