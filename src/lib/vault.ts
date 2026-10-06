// The organiser vault holds the organiser's private key and the passwords of their komatáls.
// It is encrypted with a random data key (DK); DK is wrapped twice: with a key derived from the
// login password and with a one-time recovery code. The server only ever sees ciphertext.
import {
  decryptBytes,
  decryptJson,
  deriveKey,
  encryptBytes,
  encryptJson,
  fromB64u,
  generateRecoveryCode,
  newSalt,
  normalizePassword,
  randomBytes,
} from './crypto'

export interface VaultContent {
  orgPrivateJwk: JsonWebKey
  orgPublicJwk: JsonWebKey
  passwords: Record<string, string>
}

export interface VaultDoc {
  v: 1
  pwSalt: string
  pwWrap: string
  recSalt: string
  recWrap: string
  ct: string
}

async function importDk(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function wrap(secret: string, salt: string, rawDk: Uint8Array<ArrayBuffer>): Promise<string> {
  return encryptBytes(await deriveKey(secret, fromB64u(salt)), rawDk)
}

async function unwrap(secret: string, salt: string, wrapped: string): Promise<Uint8Array<ArrayBuffer>> {
  return decryptBytes(await deriveKey(secret, fromB64u(salt)), wrapped)
}

export async function createVault(
  content: VaultContent,
  loginPassword: string,
): Promise<{ doc: VaultDoc; recoveryCode: string; dk: CryptoKey }> {
  const rawDk = randomBytes(32)
  const dk = await importDk(rawDk)
  const recoveryCode = generateRecoveryCode()
  const pwSalt = newSalt()
  const recSalt = newSalt()
  const doc: VaultDoc = {
    v: 1,
    pwSalt,
    pwWrap: await wrap(loginPassword, pwSalt, rawDk),
    recSalt,
    recWrap: await wrap(normalizePassword(recoveryCode), recSalt, rawDk),
    ct: await encryptJson(dk, content),
  }
  return { doc, recoveryCode, dk }
}

export async function openVaultWithPassword(doc: VaultDoc, loginPassword: string) {
  const rawDk = await unwrap(loginPassword, doc.pwSalt, doc.pwWrap)
  const dk = await importDk(rawDk)
  return { dk, content: await decryptJson<VaultContent>(dk, doc.ct) }
}

export async function openVaultWithRecovery(doc: VaultDoc, recoveryCode: string) {
  const rawDk = await unwrap(normalizePassword(recoveryCode), doc.recSalt, doc.recWrap)
  const dk = await importDk(rawDk)
  return { dk, rawDk, content: await decryptJson<VaultContent>(dk, doc.ct) }
}

export async function openVaultWithKey(doc: VaultDoc, dk: CryptoKey): Promise<VaultContent> {
  return decryptJson<VaultContent>(dk, doc.ct)
}

/** After a password reset: unlock with the recovery code, then protect the vault with the new password. */
export async function rewrapVaultPassword(doc: VaultDoc, recoveryCode: string, newLoginPassword: string) {
  const { dk, rawDk, content } = await openVaultWithRecovery(doc, recoveryCode)
  const pwSalt = newSalt()
  const next: VaultDoc = { ...doc, pwSalt, pwWrap: await wrap(newLoginPassword, pwSalt, rawDk) }
  return { doc: next, dk, content }
}

export async function sealVault(doc: VaultDoc, dk: CryptoKey, content: VaultContent): Promise<VaultDoc> {
  return { ...doc, ct: await encryptJson(dk, content) }
}
