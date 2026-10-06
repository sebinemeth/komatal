// Firestore access. Everything personal is encrypted before it is written here.
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import {
  decryptBytes,
  decryptJson,
  deriveKomatalKey,
  encryptBytes,
  encryptJson,
  makeCheck,
  newSalt,
  sealJson,
} from './crypto'
import { slotDate } from './schedule'
import { randomAlias } from './alias'
import type {
  Details,
  Helper,
  HelperContact,
  HelperPublic,
  Komatal,
  Post,
  PostBody,
  PostKind,
  Slot,
  SlotData,
} from './types'

const komatalRef = (id: string) => doc(db, 'komatals', id)
const err = (e: unknown) => console.warn('firestore', e)

export const MAX_DAYS = 60

// ---- watching ----

export function watchKomatal(id: string, cb: (k: Komatal | null) => void, onError: (e: unknown) => void = err): Unsubscribe {
  return onSnapshot(komatalRef(id), (s) => cb(s.exists() ? ({ ...(s.data() as Komatal), id: s.id }) : null), onError)
}

export function watchMyKomatals(uid: string, cb: (k: Komatal[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'komatals'), where('organiserUid', '==', uid)),
    (s) => cb(s.docs.map((d) => ({ ...(d.data() as Komatal), id: d.id })).sort((a, b) => b.createdAt - a.createdAt)),
    err,
  )
}

export function watchSlots(id: string, cb: (s: Slot[]) => void, onError: (e: unknown) => void = err): Unsubscribe {
  return onSnapshot(
    collection(komatalRef(id), 'slots'),
    (s) => cb(s.docs.map((d) => d.data() as Slot).sort((a, b) => a.index - b.index)),
    onError,
  )
}

export function watchHelpers(id: string, cb: (h: Helper[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(komatalRef(id), 'helpers'), orderBy('joinedAt')),
    (s) => cb(s.docs.map((d) => ({ ...(d.data() as Helper), uid: d.id }))),
    err,
  )
}

export function watchHelper(id: string, uid: string, cb: (h: Helper | null) => void): Unsubscribe {
  return onSnapshot(doc(komatalRef(id), 'helpers', uid), (s) => cb(s.exists() ? ({ ...(s.data() as Helper), uid }) : null), err)
}

export function watchPosts(id: string, cb: (p: Post[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(komatalRef(id), 'posts'), orderBy('createdAt', 'desc')),
    (s) => cb(s.docs.map((d) => ({ ...(d.data() as Post), id: d.id }))),
    err,
  )
}

export function watchReactions(id: string, pid: string, cb: (r: Record<string, string>) => void): Unsubscribe {
  return onSnapshot(collection(komatalRef(id), 'posts', pid, 'reactions'), (s) => {
    const out: Record<string, string> = {}
    s.docs.forEach((d) => (out[d.id] = (d.data() as { emoji: string }).emoji))
    cb(out)
  }, err)
}

// ---- decrypt helpers ----

export const komatalKey = (k: Pick<Komatal, 'salt'>, password: string) => deriveKomatalKey(password, k.salt)
export const decryptDetails = (key: CryptoKey, k: Komatal) => decryptJson<Details>(key, k.details)
export const decryptSlot = (key: CryptoKey, s: Slot) => (s.enc ? decryptJson<SlotData>(key, s.enc) : Promise.resolve(null))
export const decryptHelperPublic = (key: CryptoKey, h: Helper) => decryptJson<HelperPublic>(key, h.enc)
export const decryptPost = (key: CryptoKey, p: Post) => decryptJson<PostBody>(key, p.enc)

export async function loadPostImages(key: CryptoKey, id: string, pid: string, count: number): Promise<Uint8Array[]> {
  const out: Uint8Array[] = []
  for (let n = 0; n < count; n++) {
    const s = await getDoc(doc(komatalRef(id), 'posts', pid, 'images', String(n)))
    if (s.exists()) out.push(await decryptBytes(key, (s.data() as { enc: string }).enc))
  }
  return out
}

// ---- organiser actions ----

export interface NewKomatal {
  name: string
  dueDate: string
  details: Details
  dayCount: number
  everyNDays: number
}

export async function createKomatal(input: NewKomatal, opts: { password: string; orgPub: JsonWebKey; uid: string }): Promise<string> {
  const ref = doc(collection(db, 'komatals'))
  const salt = newSalt()
  const key = await deriveKomatalKey(opts.password, salt)
  const data: Omit<Komatal, 'id'> = {
    name: input.name,
    dueDate: input.dueDate,
    status: 'waiting',
    organiserUid: opts.uid,
    orgPub: opts.orgPub,
    salt,
    check: await makeCheck(key),
    details: await encryptJson(key, input.details),
    dayCount: input.dayCount,
    everyNDays: input.everyNDays,
    birthDate: null,
    createdAt: Date.now(),
    closedAt: null,
  }
  const batch = writeBatch(db)
  batch.set(ref, data)
  for (let i = 0; i < input.dayCount; i++) {
    const slot: Slot = { index: i, date: null, status: 'free', reservedBy: null, enc: null }
    batch.set(doc(ref, 'slots', String(i)), slot)
  }
  await batch.commit()
  return ref.id
}

export async function updateDetails(k: Komatal, key: CryptoKey, details: Details, name: string, dueDate: string) {
  await updateDoc(komatalRef(k.id), { details: await encryptJson(key, details), name, dueDate })
}

function postData(kind: PostKind, enc: string, imageCount: number): Omit<Post, 'id'> {
  return { kind, enc, imageCount, createdAt: Date.now() }
}

export async function markBorn(k: Komatal, key: CryptoKey, birthDate: string, text: string) {
  const batch = writeBatch(db)
  batch.update(komatalRef(k.id), { status: 'active', birthDate })
  for (let i = 0; i < k.dayCount; i++) {
    batch.update(doc(komatalRef(k.id), 'slots', String(i)), { date: slotDate(birthDate, i, k.everyNDays) })
  }
  const body: PostBody = { text }
  batch.set(doc(collection(komatalRef(k.id), 'posts')), postData('birth', await encryptJson(key, body), 0))
  await batch.commit()
}

export async function closeKomatal(k: Komatal, key: CryptoKey, text: string) {
  const batch = writeBatch(db)
  batch.update(komatalRef(k.id), { status: 'closed', closedAt: Date.now() })
  const body: PostBody = { text }
  batch.set(doc(collection(komatalRef(k.id), 'posts')), postData('close', await encryptJson(key, body), 0))
  await batch.commit()
}

export async function extendDays(k: Komatal, extra: number) {
  const total = Math.min(MAX_DAYS, k.dayCount + extra)
  const batch = writeBatch(db)
  for (let i = k.dayCount; i < total; i++) {
    const date = k.birthDate ? slotDate(k.birthDate, i, k.everyNDays) : null
    const slot: Slot = { index: i, date, status: 'free', reservedBy: null, enc: null }
    batch.set(doc(komatalRef(k.id), 'slots', String(i)), slot)
  }
  batch.update(komatalRef(k.id), { dayCount: total })
  await batch.commit()
}

export async function createPost(k: Komatal, key: CryptoKey, text: string, images: Uint8Array[]) {
  const ref = doc(collection(komatalRef(k.id), 'posts'))
  const batch = writeBatch(db)
  const body: PostBody = { text }
  batch.set(ref, postData('post', await encryptJson(key, body), images.length))
  for (let n = 0; n < images.length; n++) {
    batch.set(doc(ref, 'images', String(n)), { enc: await encryptBytes(key, images[n] as Uint8Array<ArrayBuffer>) })
  }
  await batch.commit()
}

export async function removeHelper(k: Komatal, uid: string) {
  await deleteDoc(doc(komatalRef(k.id), 'helpers', uid))
}

// ---- helper actions ----

export interface JoinInput {
  name: string
  phone: string
  email: string
  nameVisible: boolean
  emailOptIn: boolean
}

export async function joinAsHelper(k: Komatal, key: CryptoKey, uid: string, input: JoinInput, existing?: Helper | null) {
  const contact: HelperContact = { name: input.name, phone: input.phone, email: input.email }
  const prev = existing ? await decryptHelperPublic(key, existing).catch(() => null) : null
  const pub: HelperPublic = { name: input.name, nameVisible: input.nameVisible, alias: prev?.alias ?? randomAlias() }
  const helper: Omit<Helper, 'uid'> = {
    joinedAt: existing?.joinedAt ?? Date.now(),
    sealed: await sealJson(k.orgPub, contact),
    enc: await encryptJson(key, pub),
  }
  await setDoc(doc(komatalRef(k.id), 'helpers', uid), helper)
  // Server-only copy of the notification address (never readable by other clients).
  await setDoc(
    doc(komatalRef(k.id), 'private', uid),
    { email: input.emailOptIn && input.email ? input.email : null, emailOptIn: input.emailOptIn, updatedAt: Date.now() },
    { merge: true },
  )
}

export async function savePushToken(k: Komatal, uid: string, token: string) {
  await setDoc(doc(komatalRef(k.id), 'private', uid), { pushTokens: arrayUnion(token), pushOptIn: true, updatedAt: Date.now() }, { merge: true })
}

export async function reserveSlot(k: Komatal, key: CryptoKey, uid: string, index: number, data: { meal: string; note: string }, label: string) {
  const ref = doc(komatalRef(k.id), 'slots', String(index))
  const enc = await encryptJson(key, { ...data, label } satisfies SlotData)
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref)
    if (!s.exists() || (s.data() as Slot).status !== 'free') throw new Error('taken')
    tx.update(ref, { status: 'reserved', reservedBy: uid, enc })
  })
}

export async function cancelSlot(k: Komatal, index: number) {
  await updateDoc(doc(komatalRef(k.id), 'slots', String(index)), { status: 'free', reservedBy: null, enc: null })
}

export async function setReaction(k: Komatal, pid: string, uid: string, emoji: string | null) {
  const ref = doc(komatalRef(k.id), 'posts', pid, 'reactions', uid)
  if (emoji) await setDoc(ref, { emoji })
  else await deleteDoc(ref)
}
