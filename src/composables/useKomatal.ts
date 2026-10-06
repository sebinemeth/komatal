import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import {
  decryptDetails,
  decryptHelperPublic,
  decryptPost,
  decryptSlot,
  komatalKey,
  watchHelper,
  watchHelpers,
  watchKomatal,
  watchPosts,
  watchSlots,
} from '@/lib/api'
import { openSealedJson, verifyCheck } from '@/lib/crypto'
import { session, vault } from '@/lib/session'
import type { Details, Helper, HelperContact, HelperPublic, Komatal, Post, PostBody, Slot, SlotData } from '@/lib/types'

/** Live, decrypted view of one komatál for the organiser or a helper. */
export function useKomatal(id: string) {
  const komatal = ref<Komatal | null | undefined>(undefined)
  const key = shallowRef<CryptoKey | null>(null)
  const password = ref('')
  const details = ref<Details | null>(null)
  const slots = ref<Slot[]>([])
  const slotsHidden = ref(false)
  const slotData = ref<Record<number, SlotData | null>>({})
  const helpers = ref<Helper[]>([])
  const helperPublic = ref<Record<string, HelperPublic>>({})
  const contacts = ref<Record<string, HelperContact>>({})
  const myHelper = ref<Helper | null>(null)
  const posts = ref<Post[]>([])
  const postBodies = ref<Record<string, PostBody>>({})

  const unsubs: Array<() => void> = []
  onScopeDispose(() => unsubs.forEach((u) => u()))

  const isOrganiserOf = computed(() => !!komatal.value && !!session.user && komatal.value.organiserUid === session.user.uid && !session.user.isAnonymous)

  unsubs.push(watchKomatal(id, (k) => (komatal.value = k), () => (komatal.value = null)))

  let subscribed = false
  watch(
    [komatal, () => session.user?.uid],
    ([k, uid]) => {
      if (!k || !uid || subscribed) return
      subscribed = true
      unsubs.push(
        watchSlots(id, (s) => ((slotsHidden.value = false), (slots.value = s)), () => ((slotsHidden.value = true), (slots.value = []))),
        watchPosts(id, (p) => (posts.value = p)),
      )
      if (k.organiserUid === uid && !session.user?.isAnonymous) unsubs.push(watchHelpers(id, (h) => (helpers.value = h)))
      else unsubs.push(watchHelper(id, uid, (h) => (myHelper.value = h)))
    },
    { immediate: true },
  )

  /** Derives the key from the password and checks it. */
  async function unlock(password_: string): Promise<boolean> {
    if (!komatal.value) return false
    const k = await komatalKey(komatal.value, password_)
    if (!(await verifyCheck(k, komatal.value.check))) return false
    key.value = k
    password.value = password_
    return true
  }

  watch([komatal, key], async ([k, kk]) => {
    if (k && kk) details.value = await decryptDetails(kk, k).catch(() => null)
  })

  watch([slots, key], async ([s, kk]) => {
    if (!kk) return
    const out: Record<number, SlotData | null> = {}
    await Promise.all(s.map(async (sl) => (out[sl.index] = await decryptSlot(kk, sl).catch(() => null))))
    slotData.value = out
  })

  watch([helpers, myHelper, key], async ([hs, mine, kk]) => {
    if (!kk) return
    const list = [...hs, ...(mine ? [mine] : [])]
    const out: Record<string, HelperPublic> = {}
    await Promise.all(list.map(async (h) => { const p = await decryptHelperPublic(kk, h).catch(() => null); if (p) out[h.uid] = p }))
    helperPublic.value = out
  })

  // Contact details are sealed to the organiser: only they can open them.
  watch([helpers, () => vault.content], async ([hs, content]) => {
    if (!content) return
    const out: Record<string, HelperContact> = {}
    await Promise.all(hs.map(async (h) => { const c = await openSealedJson<HelperContact>(content.orgPrivateJwk, h.sealed).catch(() => null); if (c) out[h.uid] = c }))
    contacts.value = out
  })

  watch([posts, key], async ([ps, kk]) => {
    if (!kk) return
    const out: Record<string, PostBody> = {}
    await Promise.all(ps.map(async (p) => { const b = await decryptPost(kk, p).catch(() => null); if (b) out[p.id] = b }))
    postBodies.value = out
  })

  /** Name shown for a reserved day: the helper's name if they allowed it, else their alias. */
  const label = (uid: string | null) => (uid ? slotData.value[slots.value.find((s) => s.reservedBy === uid)?.index ?? -1]?.label ?? '' : '')

  return { komatal, key, password, details, slots, slotsHidden, slotData, helpers, helperPublic, contacts, myHelper, posts, postBodies, isOrganiserOf, unlock, label }
}
