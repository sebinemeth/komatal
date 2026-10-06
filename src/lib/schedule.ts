// Day arithmetic on ISO dates (YYYY-MM-DD). All times in the app are Hungarian time.
export const TIMEZONE = 'Europe/Budapest'

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y!, m! - 1, d! + days))
  return t.toISOString().slice(0, 10)
}

/** Today's date in Hungary. */
export function todayHu(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TIMEZONE }).format(now)
}

/** The first delivery is the day after the birth; then every `everyNDays`. */
export function slotDate(birthDate: string, index: number, everyNDays: number): string {
  return addDays(birthDate, 1 + index * everyNDays)
}

export function formatDay(iso: string, opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('hu-HU', { ...opts, timeZone: 'UTC' }).format(new Date(Date.UTC(y!, m! - 1, d!)))
}

export const FREQUENCIES = [
  { label: 'Minden nap', value: 1 },
  { label: 'Kétnaponta', value: 2 },
  { label: 'Háromnaponta', value: 3 },
  { label: 'Hetente', value: 7 },
] as const
