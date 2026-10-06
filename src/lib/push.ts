import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { app } from './firebase'
import { firebaseConfig } from './firebase-config'
import { savePushToken } from './api'
import type { Komatal } from './types'

export type PushResult = 'granted' | 'denied' | 'unsupported' | 'error'

export async function pushAvailable(): Promise<boolean> {
  try {
    return 'Notification' in window && (await isSupported())
  } catch {
    return false
  }
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  return 'Notification' in window ? Notification.permission : 'unsupported'
}

/** Asks for permission, registers the device for push and stores the token (server-only) for this komatál. */
export async function enablePush(k: Komatal, uid: string): Promise<PushResult> {
  if (!(await pushAvailable())) return 'unsupported'
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'denied'
    const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?k=${encodeURIComponent(firebaseConfig.apiKey)}`)
    const token = await getToken(getMessaging(app), { serviceWorkerRegistration: registration })
    if (!token) return 'error'
    await savePushToken(k, uid, token)
    return 'granted'
  } catch (e) {
    console.warn('push', e)
    return 'error'
  }
}
