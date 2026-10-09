import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { clearDeviceKey, loadDeviceKey, saveDeviceKey } from './deviceKeys'

const newKey = () => crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])

describe('device key store', () => {
  it('returns null for an unknown user', async () => {
    expect(await loadDeviceKey('nobody')).toBeNull()
  })

  it('saves and loads a non-extractable key that still works', async () => {
    const key = await newKey()
    await saveDeviceKey('u1', key)
    const loaded = await loadDeviceKey('u1')
    expect(loaded).toBeTruthy()
    expect(loaded!.extractable).toBe(false)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode('hi'))
    expect(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, loaded!, ct))).toBe('hi')
  })

  it('keeps users separate and clears only the requested one', async () => {
    await saveDeviceKey('a', await newKey())
    await saveDeviceKey('b', await newKey())
    await clearDeviceKey('a')
    expect(await loadDeviceKey('a')).toBeNull()
    expect(await loadDeviceKey('b')).toBeTruthy()
  })

  it('overwrites an existing key', async () => {
    const k1 = await newKey()
    const k2 = await newKey()
    await saveDeviceKey('c', k1)
    await saveDeviceKey('c', k2)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k2, new Uint8Array([1]))
    await expect(crypto.subtle.decrypt({ name: 'AES-GCM', iv }, (await loadDeviceKey('c'))!, ct)).resolves.toBeTruthy()
  })
})
