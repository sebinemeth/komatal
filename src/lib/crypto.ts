// All personal data is encrypted in the browser with WebCrypto.
// - K: AES-GCM key derived (PBKDF2) from the komatál password carried in the invite link's #fragment.
// - Organiser key pair (ECDH P-256): helper contact details are sealed to the organiser's public key.

const te = new TextEncoder()
const td = new TextDecoder()

export const PBKDF2_ITERATIONS = { value: 600_000 }

export function toB64u(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromB64u(s: string): Uint8Array<ArrayBuffer> {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(b.length))
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i)
  return out
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(n))
  crypto.getRandomValues(out)
  return out
}

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789' // no look-alike characters

function randomChars(n: number): string {
  let out = ''
  const limit = 256 - (256 % ALPHABET.length)
  while (out.length < n) {
    for (const b of randomBytes(n * 2)) {
      if (b < limit && out.length < n) out += ALPHABET[b % ALPHABET.length]
    }
  }
  return out
}

/** Random password for a komatál: 12 characters, about 59 bits, shown as xxxx-xxxx-xxxx. */
export function generatePassword(): string {
  return randomChars(12).match(/.{4}/g)!.join('-')
}

/** Recovery code for the organiser vault: 16 characters, about 79 bits. */
export function generateRecoveryCode(): string {
  return randomChars(16).match(/.{4}/g)!.join('-')
}

/** Makes "K7QM x2ph-9wzd" and "k7qmx2ph9wzd" the same password. */
export function normalizePassword(p: string): string {
  return p.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export async function deriveKey(secret: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', te.encode(secret), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS.value, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function newSalt(): string {
  return toB64u(randomBytes(16))
}

export function deriveKomatalKey(password: string, saltB64: string): Promise<CryptoKey> {
  return deriveKey(normalizePassword(password), fromB64u(saltB64))
}

async function encryptBytesRaw(key: CryptoKey, data: Uint8Array<ArrayBuffer>): Promise<string> {
  const iv = randomBytes(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  return `v1.${toB64u(iv)}.${toB64u(ct)}`
}

async function decryptBytesRaw(key: CryptoKey, s: string): Promise<Uint8Array<ArrayBuffer>> {
  const [v, iv, ct] = s.split('.')
  if (v !== 'v1' || !iv || !ct) throw new Error('Invalid ciphertext')
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64u(iv) }, key, fromB64u(ct)))
}

export const encryptBytes = encryptBytesRaw
export const decryptBytes = decryptBytesRaw

export async function encryptJson(key: CryptoKey, value: unknown): Promise<string> {
  return encryptBytesRaw(key, te.encode(JSON.stringify(value)) as Uint8Array<ArrayBuffer>)
}

export async function decryptJson<T = unknown>(key: CryptoKey, s: string): Promise<T> {
  return JSON.parse(td.decode(await decryptBytesRaw(key, s))) as T
}

const CHECK_VALUE = { komatal: 1 }

export function makeCheck(key: CryptoKey): Promise<string> {
  return encryptJson(key, CHECK_VALUE)
}

export async function verifyCheck(key: CryptoKey, check: string): Promise<boolean> {
  try {
    const v = await decryptJson<{ komatal: number }>(key, check)
    return v.komatal === 1
  } catch {
    return false
  }
}

// ---- organiser key pair and sealed boxes ----

export interface OrgKeyPair {
  publicJwk: JsonWebKey
  privateJwk: JsonWebKey
}

export async function generateOrgKeyPair(): Promise<OrgKeyPair> {
  const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])
  return {
    publicJwk: await crypto.subtle.exportKey('jwk', kp.publicKey),
    privateJwk: await crypto.subtle.exportKey('jwk', kp.privateKey),
  }
}

const ECDH = { name: 'ECDH', namedCurve: 'P-256' }

/** Encrypts a value so that only the holder of the matching private key can read it. */
export async function sealJson(publicJwk: JsonWebKey, value: unknown): Promise<string> {
  const pub = await crypto.subtle.importKey('jwk', publicJwk, ECDH, false, [])
  const eph = await crypto.subtle.generateKey(ECDH, true, ['deriveKey'])
  const key = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: pub },
    eph.privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  )
  const iv = randomBytes(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(value)))
  const ephPub = await crypto.subtle.exportKey('raw', eph.publicKey)
  return `s1.${toB64u(ephPub)}.${toB64u(iv)}.${toB64u(ct)}`
}

export async function openSealedJson<T = unknown>(privateJwk: JsonWebKey, s: string): Promise<T> {
  const [v, ephPub, iv, ct] = s.split('.')
  if (v !== 's1' || !ephPub || !iv || !ct) throw new Error('Invalid sealed box')
  const priv = await crypto.subtle.importKey('jwk', privateJwk, ECDH, false, ['deriveKey'])
  const pub = await crypto.subtle.importKey('raw', fromB64u(ephPub), ECDH, false, [])
  const key = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: pub },
    priv,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64u(iv) }, key, fromB64u(ct))
  return JSON.parse(td.decode(pt)) as T
}
