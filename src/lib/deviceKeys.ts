// Remembers the (non-extractable) vault data key on this device, so the organiser only
// types the login password once per device.
const DB = 'komatal-device'
const STORE = 'keys'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveDeviceKey(uid: string, dk: CryptoKey): Promise<void> {
  try {
    await tx('readwrite', (s) => s.put(dk, uid))
  } catch {
    /* private mode etc.: the organiser will be asked again next time */
  }
}

export async function loadDeviceKey(uid: string): Promise<CryptoKey | null> {
  try {
    return ((await tx('readonly', (s) => s.get(uid))) as CryptoKey | undefined) ?? null
  } catch {
    return null
  }
}

export async function clearDeviceKey(uid: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(uid))
  } catch {
    /* ignore */
  }
}
