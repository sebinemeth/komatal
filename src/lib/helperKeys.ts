// A helper's komatál password lives in the invite link (#fragment). With consent, this device remembers it.
const prefix = 'komatal:pw:'

export function rememberedPassword(id: string): string | null {
  try {
    return localStorage.getItem(prefix + id) ?? sessionStorage.getItem(prefix + id)
  } catch {
    return null
  }
}

export function storePassword(id: string, password: string, persist: boolean) {
  try {
    sessionStorage.setItem(prefix + id, password)
    if (persist) localStorage.setItem(prefix + id, password)
    else localStorage.removeItem(prefix + id)
  } catch {
    /* storage blocked: the link still works */
  }
}

export function isPersisted(id: string): boolean {
  try {
    return localStorage.getItem(prefix + id) !== null
  } catch {
    return false
  }
}
