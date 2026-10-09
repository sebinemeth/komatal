import { describe, expect, it } from 'vitest'
import { FREQUENCIES, TIMEZONE, addDays, formatDay, slotDate, todayHu } from './schedule'

describe('addDays', () => {
  it('handles leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
  })
  it('supports zero and negative offsets', () => {
    expect(addDays('2026-05-10', 0)).toBe('2026-05-10')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('supports large offsets and is unaffected by DST changes', () => {
    expect(addDays('2026-03-20', 20)).toBe('2026-04-09')
    expect(addDays('2026-10-20', 10)).toBe('2026-10-30')
    expect(addDays('2026-01-01', 365)).toBe('2027-01-01')
  })
})

describe('todayHu', () => {
  it('rolls over at Hungarian midnight in winter (UTC+1) and summer (UTC+2)', () => {
    expect(todayHu(new Date('2026-01-15T22:59:00Z'))).toBe('2026-01-15')
    expect(todayHu(new Date('2026-01-15T23:00:00Z'))).toBe('2026-01-16')
    expect(todayHu(new Date('2026-07-15T21:59:00Z'))).toBe('2026-07-15')
    expect(todayHu(new Date('2026-07-15T22:00:00Z'))).toBe('2026-07-16')
  })
  it('uses the Budapest time zone', () => {
    expect(TIMEZONE).toBe('Europe/Budapest')
  })
  it('returns an ISO date for the current moment', () => {
    expect(todayHu()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('slotDate', () => {
  it('gives consecutive days for daily deliveries', () => {
    expect([0, 1, 2, 11].map((i) => slotDate('2026-11-28', i, 1))).toEqual(['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-10'])
  })
  it('spaces deliveries by the frequency', () => {
    expect([0, 1, 2].map((i) => slotDate('2026-12-30', i, 3))).toEqual(['2026-12-31', '2027-01-03', '2027-01-06'])
  })
})

describe('formatDay', () => {
  it('formats Hungarian long dates', () => {
    expect(formatDay('2026-10-09')).toBe('2026. október 9.')
    expect(formatDay('2026-01-01')).toBe('2026. január 1.')
  })
  it('does not shift the day with the local time zone', () => {
    expect(formatDay('2026-03-29')).toBe('2026. március 29.')
    expect(formatDay('2026-12-31')).toBe('2026. december 31.')
  })
  it('accepts custom options', () => {
    expect(formatDay('2026-10-09', { month: 'short', day: 'numeric' })).toBe('okt. 9.')
  })
})

describe('FREQUENCIES', () => {
  it('offers daily to weekly options with unique values', () => {
    expect(FREQUENCIES.map((f) => f.value)).toEqual([1, 2, 3, 7])
    expect(new Set(FREQUENCIES.map((f) => f.label)).size).toBe(FREQUENCIES.length)
  })
})
