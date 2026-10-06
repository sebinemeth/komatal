import { beforeAll, describe, expect, it } from 'vitest'
import {
  PBKDF2_ITERATIONS,
  decryptJson,
  deriveKomatalKey,
  encryptJson,
  generateOrgKeyPair,
  generatePassword,
  makeCheck,
  newSalt,
  normalizePassword,
  openSealedJson,
  sealJson,
  verifyCheck,
} from './crypto'
import { createVault, openVaultWithKey, openVaultWithPassword, openVaultWithRecovery, rewrapVaultPassword, sealVault } from './vault'
import { addDays, slotDate, todayHu } from './schedule'
import { randomAlias } from './alias'

beforeAll(() => {
  PBKDF2_ITERATIONS.value = 1000
})

describe('crypto', () => {
  it('generates 12 char passwords and normalises them', () => {
    const p = generatePassword()
    expect(p).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/)
    expect(normalizePassword(p.toUpperCase())).toBe(p.replace(/-/g, ''))
  })

  it('round-trips JSON and rejects the wrong password', async () => {
    const salt = newSalt()
    const k = await deriveKomatalKey('abcd-efgh-jkmn', salt)
    const ct = await encryptJson(k, { address: 'Budapest, Fő utca 1.', tej: true })
    expect(ct.startsWith('v1.')).toBe(true)
    expect(ct).not.toContain('Budapest')
    expect(await decryptJson(k, ct)).toEqual({ address: 'Budapest, Fő utca 1.', tej: true })
    const same = await deriveKomatalKey('ABCDEFGHJKMN', salt)
    expect(await decryptJson(same, ct)).toBeTruthy()
    const wrong = await deriveKomatalKey('abcd-efgh-jkmp', salt)
    await expect(decryptJson(wrong, ct)).rejects.toBeTruthy()
  })

  it('verifies the password with the stored check value', async () => {
    const salt = newSalt()
    const k = await deriveKomatalKey('pw1', salt)
    const check = await makeCheck(k)
    expect(await verifyCheck(k, check)).toBe(true)
    expect(await verifyCheck(await deriveKomatalKey('pw2', salt), check)).toBe(false)
  })

  it('seals contact details to the organiser only', async () => {
    const org = await generateOrgKeyPair()
    const other = await generateOrgKeyPair()
    const sealed = await sealJson(org.publicJwk, { name: 'Anna', phone: '+36301234567' })
    expect(sealed).not.toContain('Anna')
    expect(await openSealedJson(org.privateJwk, sealed)).toEqual({ name: 'Anna', phone: '+36301234567' })
    await expect(openSealedJson(other.privateJwk, sealed)).rejects.toBeTruthy()
  })
})

describe('vault', () => {
  it('unlocks with the login password and with the recovery code', async () => {
    const org = await generateOrgKeyPair()
    const content = { orgPrivateJwk: org.privateJwk, orgPublicJwk: org.publicJwk, passwords: { a: 'pw-a' } }
    const { doc, recoveryCode, dk } = await createVault(content, 'login-secret')
    expect(JSON.stringify(doc)).not.toContain('pw-a')
    expect((await openVaultWithPassword(doc, 'login-secret')).content.passwords.a).toBe('pw-a')
    await expect(openVaultWithPassword(doc, 'nope')).rejects.toBeTruthy()
    expect((await openVaultWithRecovery(doc, recoveryCode.toUpperCase())).content.passwords.a).toBe('pw-a')
    expect((await openVaultWithKey(doc, dk)).passwords.a).toBe('pw-a')
  })

  it('saves new passwords and survives a password reset', async () => {
    const org = await generateOrgKeyPair()
    const base = { orgPrivateJwk: org.privateJwk, orgPublicJwk: org.publicJwk, passwords: {} as Record<string, string> }
    const { doc, recoveryCode, dk } = await createVault(base, 'old-password')
    const updated = await sealVault(doc, dk, { ...base, passwords: { k1: 'secret-1' } })
    const re = await rewrapVaultPassword(updated, recoveryCode, 'new-password')
    expect((await openVaultWithPassword(re.doc, 'new-password')).content.passwords.k1).toBe('secret-1')
    await expect(openVaultWithPassword(re.doc, 'old-password')).rejects.toBeTruthy()
  })
})

describe('schedule', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('starts the day after the birth and respects the frequency', () => {
    expect(slotDate('2026-11-10', 0, 1)).toBe('2026-11-11')
    expect(slotDate('2026-11-10', 2, 2)).toBe('2026-11-15')
    expect(slotDate('2026-11-10', 1, 7)).toBe('2026-11-18')
  })
  it('uses the Hungarian date, not UTC', () => {
    expect(todayHu(new Date('2026-06-30T22:30:00Z'))).toBe('2026-07-01')
  })
})

describe('alias', () => {
  it('creates two-word aliases', () => {
    expect(randomAlias().split(' ')).toHaveLength(2)
  })
})
