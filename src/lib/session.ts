// Sign-in state plus the organiser vault (private key and komatál passwords, encrypted).
import { computed, reactive } from 'vue'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { generateOrgKeyPair } from './crypto'
import {
  createVault,
  openVaultWithKey,
  openVaultWithPassword,
  rewrapVaultPassword,
  sealVault,
  type VaultContent,
  type VaultDoc,
} from './vault'
import { clearDeviceKey, loadDeviceKey, saveDeviceKey } from './deviceKeys'

export const session = reactive({ ready: false, user: null as User | null })

export const vault = reactive({
  status: 'none' as 'none' | 'loading' | 'ready' | 'locked' | 'missing',
  doc: null as VaultDoc | null,
  dk: null as CryptoKey | null,
  content: null as VaultContent | null,
})

export const isOrganiser = computed(() => !!session.user && !session.user.isAnonymous)

const vaultRef = (uid: string) => doc(db, 'users', uid, 'vault', 'main')
let busy = false

function resetVault() {
  vault.status = 'none'
  vault.doc = null
  vault.dk = null
  vault.content = null
}

async function loadVault(uid: string) {
  vault.status = 'loading'
  const snap = await getDoc(vaultRef(uid))
  if (!snap.exists()) {
    vault.status = 'missing'
    return
  }
  vault.doc = snap.data() as VaultDoc
  const dk = await loadDeviceKey(uid)
  if (dk) {
    try {
      vault.content = await openVaultWithKey(vault.doc, dk)
      vault.dk = dk
      vault.status = 'ready'
      return
    } catch {
      /* stale device key: ask for the password */
    }
  }
  vault.status = 'locked'
}

let resolveReady: () => void
const readyPromise = new Promise<void>((r) => (resolveReady = r))

onAuthStateChanged(auth, async (user) => {
  session.user = user
  if (user && !user.isAnonymous) {
    if (!busy) await loadVault(user.uid).catch(() => (vault.status = 'locked'))
  } else resetVault()
  session.ready = true
  resolveReady()
})

export const whenReady = () => readyPromise

export async function ensureHelperAuth(): Promise<User> {
  await whenReady()
  if (!auth.currentUser) await signInAnonymously(auth)
  return auth.currentUser!
}

function setReady(dk: CryptoKey, content: VaultContent, docu: VaultDoc) {
  vault.dk = dk
  vault.content = content
  vault.doc = docu
  vault.status = 'ready'
}

/** Creates the account and its vault. Returns the recovery code, shown once. */
export async function signUpOrganiser(email: string, password: string): Promise<string> {
  busy = true
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    const keys = await generateOrgKeyPair()
    const content: VaultContent = { orgPrivateJwk: keys.privateJwk, orgPublicJwk: keys.publicJwk, passwords: {} }
    const { doc: vdoc, recoveryCode, dk } = await createVault(content, password)
    await setDoc(vaultRef(cred.user.uid), vdoc)
    await saveDeviceKey(cred.user.uid, dk)
    setReady(dk, content, vdoc)
    return recoveryCode
  } finally {
    busy = false
  }
}

export async function signInOrganiser(email: string, password: string) {
  busy = true
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    await loadVault(cred.user.uid)
    if (vault.status === 'locked') await unlockWithPassword(password).catch(() => undefined)
  } finally {
    busy = false
  }
}

export async function unlockWithPassword(password: string) {
  if (!vault.doc || !session.user) throw new Error('no vault')
  const { dk, content } = await openVaultWithPassword(vault.doc, password)
  await saveDeviceKey(session.user.uid, dk)
  setReady(dk, content, vault.doc)
}

/** Forgotten password: unlock with the recovery code, then protect the vault with the current login password. */
export async function unlockWithRecovery(code: string, newLoginPassword: string) {
  if (!vault.doc || !session.user) throw new Error('no vault')
  const { doc: next, dk, content } = await rewrapVaultPassword(vault.doc, code, newLoginPassword)
  await setDoc(vaultRef(session.user.uid), next)
  await saveDeviceKey(session.user.uid, dk)
  setReady(dk, content, next)
}

export async function logout() {
  const uid = session.user?.uid
  if (uid) await clearDeviceKey(uid)
  await signOut(auth)
}

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email)

export function passwordFor(komatalId: string): string | null {
  return vault.content?.passwords[komatalId] ?? null
}

export async function rememberKomatalPassword(komatalId: string, password: string) {
  if (!vault.doc || !vault.dk || !vault.content || !session.user) return
  const content: VaultContent = { ...vault.content, passwords: { ...vault.content.passwords, [komatalId]: password } }
  const next = await sealVault(vault.doc, vault.dk, content)
  await setDoc(vaultRef(session.user.uid), next)
  vault.content = content
  vault.doc = next
}
