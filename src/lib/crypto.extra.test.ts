import { beforeAll, describe, expect, it } from 'vitest'
import {
  PBKDF2_ITERATIONS,
  decryptBytes,
  decryptJson,
  deriveKomatalKey,
  encryptBytes,
  encryptJson,
  fromB64u,
  generateOrgKeyPair,
  generatePassword,
  generateRecoveryCode,
  makeCheck,
  newSalt,
  normalizePassword,
  openSealedJson,
  randomBytes,
  sealJson,
  toB64u,
  verifyCheck,
} from './crypto'

beforeAll(() => {
  PBKDF2_ITERATIONS.value = 1000
})

describe('base64url', () => {
  it('round-trips arbitrary bytes without padding or unsafe characters', () => {
    for (const n of [0, 1, 2, 3, 31, 32, 255]) {
      const bytes = randomBytes(n)
      const s = toB64u(bytes)
      expect(s).toMatch(/^[A-Za-z0-9_-]*$/)
      expect(Array.from(fromB64u(s))).toEqual(Array.from(bytes))
    }
  })

  it('handles buffers larger than the chunk size', () => {
    const bytes = new Uint8Array(new ArrayBuffer(100_000)).map((_, i) => i % 251)
    expect(Array.from(fromB64u(toB64u(bytes)))).toEqual(Array.from(bytes))
  })

  it('accepts an ArrayBuffer as well as a Uint8Array', () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 251, 252])
    expect(toB64u(bytes.buffer)).toBe(toB64u(bytes))
  })

  it('encodes known values', () => {
    expect(toB64u(new Uint8Array([0xfb, 0xff, 0xfe]))).toBe('-__-')
    expect(toB64u(new TextEncoder().encode('hello'))).toBe('aGVsbG8')
  })
})

describe('random helpers', () => {
  it('randomBytes returns the requested length and differs between calls', () => {
    expect(randomBytes(16)).toHaveLength(16)
    expect(toB64u(randomBytes(16))).not.toBe(toB64u(randomBytes(16)))
  })

  it('salts decode to 16 bytes and are unique', () => {
    const a = newSalt()
    expect(fromB64u(a)).toHaveLength(16)
    expect(a).not.toBe(newSalt())
  })

  it('passwords avoid look-alike characters and are unique', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const p = generatePassword()
      expect(p).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/)
      expect(p).not.toMatch(/[ilo01]/)
      seen.add(p)
    }
    expect(seen.size).toBe(200)
  })

  it('recovery codes are 4 groups of 4 and avoid look-alike characters', () => {
    for (let i = 0; i < 50; i++) {
      const c = generateRecoveryCode()
      expect(c).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/)
      expect(c).not.toMatch(/[ilo01]/)
    }
  })

  it('normalizePassword strips separators, whitespace and case', () => {
    expect(normalizePassword('K7QM x2ph-9wzd')).toBe('k7qmx2ph9wzd')
    expect(normalizePassword('  ')).toBe('')
    expect(normalizePassword('abcd_efgh.jkmn')).toBe('abcdefghjkmn')
  })
})

describe('symmetric encryption', () => {
  it('uses a fresh IV, so the same value never encrypts the same way twice', async () => {
    const k = await deriveKomatalKey('pw', newSalt())
    const a = await encryptJson(k, { x: 1 })
    const b = await encryptJson(k, { x: 1 })
    expect(a).not.toBe(b)
    expect(await decryptJson(k, a)).toEqual(await decryptJson(k, b))
  })

  it('round-trips unicode, null, arrays and empty objects', async () => {
    const k = await deriveKomatalKey('pw', newSalt())
    for (const v of [{ s: 'árvíztűrő tükörfúrógép 🎉' }, null, [1, 'két', null], {}, '']) {
      expect(await decryptJson(k, await encryptJson(k, v))).toEqual(v)
    }
  })

  it('round-trips raw bytes', async () => {
    const k = await deriveKomatalKey('pw', newSalt())
    const data = randomBytes(5000)
    const out = await decryptBytes(k, await encryptBytes(k, data))
    expect(Array.from(out)).toEqual(Array.from(data))
  })

  it('rejects tampered ciphertext', async () => {
    const k = await deriveKomatalKey('pw', newSalt())
    const ct = await encryptJson(k, { a: 1 })
    const [v, iv, body] = ct.split('.')
    const bytes = fromB64u(body!)
    bytes[0] = bytes[0]! ^ 1
    await expect(decryptJson(k, `${v}.${iv}.${toB64u(bytes)}`)).rejects.toBeTruthy()
  })

  it('rejects malformed or wrong-version ciphertext', async () => {
    const k = await deriveKomatalKey('pw', newSalt())
    const ct = await encryptJson(k, 1)
    await expect(decryptJson(k, '')).rejects.toThrow('Invalid ciphertext')
    await expect(decryptJson(k, 'v1.onlyiv')).rejects.toThrow('Invalid ciphertext')
    await expect(decryptJson(k, ct.replace(/^v1/, 'v2'))).rejects.toThrow('Invalid ciphertext')
  })

  it('derives the same key for equivalent passwords and different keys for different salts', async () => {
    const salt = newSalt()
    const k1 = await deriveKomatalKey('abcd-efgh-jkmn', salt)
    const k2 = await deriveKomatalKey('ABCD EFGH JKMN', salt)
    const ct = await encryptJson(k1, 'x')
    expect(await decryptJson(k2, ct)).toBe('x')
    const other = await deriveKomatalKey('abcd-efgh-jkmn', newSalt())
    await expect(decryptJson(other, ct)).rejects.toBeTruthy()
  })
})

describe('password check', () => {
  it('rejects garbage and checks made with a different value', async () => {
    const k = await deriveKomatalKey('pw', newSalt())
    expect(await verifyCheck(k, 'garbage')).toBe(false)
    expect(await verifyCheck(k, await encryptJson(k, { komatal: 2 }))).toBe(false)
    expect(await verifyCheck(k, await encryptJson(k, 'komatal'))).toBe(false)
    expect(await verifyCheck(k, await makeCheck(k))).toBe(true)
  })
})

describe('sealed boxes', () => {
  it('produces different ciphertext each time and still opens', async () => {
    const org = await generateOrgKeyPair()
    const a = await sealJson(org.publicJwk, { n: 1 })
    const b = await sealJson(org.publicJwk, { n: 1 })
    expect(a).not.toBe(b)
    expect(await openSealedJson(org.privateJwk, a)).toEqual({ n: 1 })
  })

  it('rejects tampered or malformed sealed data', async () => {
    const org = await generateOrgKeyPair()
    const sealed = await sealJson(org.publicJwk, { n: 1 })
    await expect(openSealedJson(org.privateJwk, sealed.slice(0, -4) + 'AAAA')).rejects.toBeTruthy()
    await expect(openSealedJson(org.privateJwk, 'nonsense')).rejects.toBeTruthy()
  })

  it('exports usable JWK key pairs that never leak the private part into the public key', async () => {
    const org = await generateOrgKeyPair()
    expect(org.publicJwk.kty).toBe('EC')
    expect(org.publicJwk.d).toBeUndefined()
    expect(org.privateJwk.d).toBeTruthy()
  })
})
