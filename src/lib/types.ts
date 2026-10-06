export type Status = 'waiting' | 'active' | 'closed'
export type VisitRule = 'no' | 'ring' | 'ask' | 'yes'

/** Readable by the server: needed for lists, scheduling and notifications. */
export interface Komatal {
  id: string
  name: string
  dueDate: string
  status: Status
  organiserUid: string
  orgPub: JsonWebKey
  salt: string
  check: string
  /** Encrypted {@link Details}. */
  details: string
  dayCount: number
  everyNDays: number
  birthDate: string | null
  createdAt: number
  closedAt: number | null
}

/** Encrypted with the komatál key; helpers see it after reserving a day. */
export interface Details {
  deliveryFrom: string
  deliveryTo: string
  visit: VisitRule
  allergies: string
  preferences: string
  address: string
  notes: string
  contactName: string
  contactPhone: string
}

export interface Slot {
  index: number
  date: string | null
  status: 'free' | 'reserved'
  reservedBy: string | null
  /** Encrypted {@link SlotData}. */
  enc: string | null
}

export interface SlotData {
  meal: string
  note: string
  label: string
}

export interface Helper {
  uid: string
  joinedAt: number
  /** Sealed to the organiser's public key: {@link HelperContact}. */
  sealed: string
  /** Encrypted with the komatál key: {@link HelperPublic}. */
  enc: string
}

export interface HelperContact {
  name: string
  phone: string
  email: string
}

export interface HelperPublic {
  name: string
  nameVisible: boolean
  alias: string
}

export type PostKind = 'post' | 'birth' | 'close'

export interface Post {
  id: string
  kind: PostKind
  enc: string
  imageCount: number
  createdAt: number
}

export interface PostBody {
  text: string
}

export const VISIT_LABELS: Record<VisitRule, string> = {
  no: 'Nem, csak az ajtóig',
  ring: 'Csengessenek, ajtóban átadás',
  ask: 'Kérdezzenek előtte',
  yes: 'Igen, bejöhetnek',
}

export const EMOJIS = ['❤️', '🎉', '😍', '🙏', '👏']
