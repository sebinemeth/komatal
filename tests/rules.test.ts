// Run with: npm run test:rules (needs the Firestore emulator and Java)
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, writeBatch } from 'firebase/firestore'

let env: RulesTestEnvironment
const ORG = 'org1'
const KID = 'k1'

const org = () => env.authenticatedContext(ORG, { firebase: { sign_in_provider: 'password' } }).firestore()
const helper = (uid: string) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore()
const anon = () => env.unauthenticatedContext().firestore()

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'komatal-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})
afterAll(() => env.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'komatals', KID), { name: 'Kovács család', status: 'active', organiserUid: ORG })
    await setDoc(doc(db, 'komatals', KID, 'slots', '0'), { index: 0, date: '2026-11-11', status: 'free', reservedBy: null, enc: null })
    await setDoc(doc(db, 'komatals', KID, 'slots', '1'), { index: 1, date: '2026-11-12', status: 'reserved', reservedBy: 'h2', enc: 'x' })
    await setDoc(doc(db, 'komatals', KID, 'helpers', 'h1'), { sealed: 's' })
  })
})

describe('komatals', () => {
  it('lets signed-in users read but not anonymous visitors', async () => {
    await assertSucceeds(getDoc(doc(helper('h1'), 'komatals', KID)))
    await assertFails(getDoc(doc(anon(), 'komatals', KID)))
  })

  it('only email users can create, only as themselves and in waiting state', async () => {
    const data = { name: 'A', status: 'waiting', organiserUid: ORG }
    await assertSucceeds(setDoc(doc(org(), 'komatals', 'new'), data))
    await assertFails(setDoc(doc(helper('h1'), 'komatals', 'new2'), { ...data, organiserUid: 'h1' }))
    await assertFails(setDoc(doc(org(), 'komatals', 'new3'), { ...data, status: 'active' }))
    await assertFails(setDoc(doc(org(), 'komatals', 'new4'), { ...data, organiserUid: 'someone-else' }))
  })

  it('lets the organiser create a komatál and its slots in one batch, but nobody else', async () => {
    const make = (db: ReturnType<typeof org>, uid: string) => {
      const b = writeBatch(db)
      b.set(doc(db, 'komatals', 'batch1'), { name: 'A', status: 'waiting', organiserUid: uid })
      b.set(doc(db, 'komatals', 'batch1', 'slots', '0'), { index: 0, date: null, status: 'free', reservedBy: null, enc: null })
      return b.commit()
    }
    await assertSucceeds(make(org(), ORG))
    await env.clearFirestore()
    await assertFails(make(helper('h9'), 'h9'))
  })

  it('only the organiser updates a komatál', async () => {
    await assertSucceeds(updateDoc(doc(org(), 'komatals', KID), { name: 'X' }))
    await assertFails(updateDoc(doc(helper('h1'), 'komatals', KID), { name: 'X' }))
    await assertFails(updateDoc(doc(org(), 'komatals', KID), { organiserUid: 'h1' }))
  })
})

describe('slots', () => {
  it('lets a joined helper reserve a free day, only changing allowed fields', async () => {
    const ref = doc(helper('h1'), 'komatals', KID, 'slots', '0')
    await assertFails(updateDoc(ref, { status: 'reserved', reservedBy: 'h1', enc: 'c', date: '2030-01-01' }))
    await assertSucceeds(updateDoc(ref, { status: 'reserved', reservedBy: 'h1', enc: 'c' }))
  })

  it('does not let a helper who has not joined reserve', async () => {
    await assertFails(updateDoc(doc(helper('stranger'), 'komatals', KID, 'slots', '0'), { status: 'reserved', reservedBy: 'stranger', enc: 'c' }))
  })

  it('does not let anyone take a reserved day or reserve in the name of another helper', async () => {
    await assertFails(updateDoc(doc(helper('h1'), 'komatals', KID, 'slots', '1'), { status: 'reserved', reservedBy: 'h1', enc: 'c' }))
    await assertFails(updateDoc(doc(helper('h1'), 'komatals', KID, 'slots', '0'), { status: 'reserved', reservedBy: 'h2', enc: 'c' }))
  })

  it('lets a helper give their day back, but not someone else\'s', async () => {
    await assertSucceeds(updateDoc(doc(helper('h2'), 'komatals', KID, 'slots', '1'), { status: 'free', reservedBy: null, enc: null }))
    await assertFails(updateDoc(doc(helper('h1'), 'komatals', KID, 'slots', '1'), { status: 'free', reservedBy: null, enc: null }))
  })

  it('hides dates from helpers once the komatál is closed, but not from the organiser', async () => {
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'komatals', KID), { status: 'closed' }))
    await assertFails(getDocs(collection(helper('h1'), 'komatals', KID, 'slots')))
    await assertSucceeds(getDocs(collection(org(), 'komatals', KID, 'slots')))
    await assertFails(updateDoc(doc(helper('h2'), 'komatals', KID, 'slots', '1'), { status: 'free', reservedBy: null, enc: null }))
  })
})

describe('helpers and private data', () => {
  it('lets helpers write only their own wait-list entry, organiser reads all', async () => {
    await assertSucceeds(setDoc(doc(helper('h3'), 'komatals', KID, 'helpers', 'h3'), { sealed: 's' }))
    await assertFails(setDoc(doc(helper('h3'), 'komatals', KID, 'helpers', 'h4'), { sealed: 's' }))
    await assertSucceeds(getDocs(collection(org(), 'komatals', KID, 'helpers')))
    await assertFails(getDocs(collection(helper('h3'), 'komatals', KID, 'helpers')))
    await assertSucceeds(getDoc(doc(helper('h1'), 'komatals', KID, 'helpers', 'h1')))
  })

  it('never lets clients read notification addresses', async () => {
    const ref = doc(helper('h1'), 'komatals', KID, 'private', 'h1')
    await assertSucceeds(setDoc(ref, { email: 'a@example.hu' }))
    await assertFails(getDoc(ref))
    await assertFails(getDoc(doc(org(), 'komatals', KID, 'private', 'h1')))
  })
})

describe('feed and vault', () => {
  it('lets only the organiser post, helpers react as themselves', async () => {
    await assertSucceeds(setDoc(doc(org(), 'komatals', KID, 'posts', 'p1'), { kind: 'post', enc: 'e' }))
    await assertFails(setDoc(doc(helper('h1'), 'komatals', KID, 'posts', 'p2'), { kind: 'post', enc: 'e' }))
    await assertSucceeds(setDoc(doc(helper('h1'), 'komatals', KID, 'posts', 'p1', 'reactions', 'h1'), { emoji: '❤️' }))
    await assertFails(setDoc(doc(helper('h1'), 'komatals', KID, 'posts', 'p1', 'reactions', 'h2'), { emoji: '❤️' }))
  })

  it('keeps the vault private to its owner and to email accounts', async () => {
    await assertSucceeds(setDoc(doc(org(), 'users', ORG, 'vault', 'main'), { ct: 'x' }))
    await assertFails(getDoc(doc(helper('h1'), 'users', ORG, 'vault', 'main')))
    await assertFails(setDoc(doc(helper(ORG), 'users', ORG, 'vault', 'main'), { ct: 'x' }))
  })
})
