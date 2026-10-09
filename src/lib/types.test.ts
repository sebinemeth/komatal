import { describe, expect, it } from 'vitest'
import { EMOJIS, VISIT_LABELS } from './types'
import { MAX_IMAGES, MAX_SIDE, bytesToUrl } from './images'

describe('constants', () => {
  it('has a label for every visit rule', () => {
    expect(Object.keys(VISIT_LABELS).sort()).toEqual(['ask', 'no', 'ring', 'yes'])
    for (const l of Object.values(VISIT_LABELS)) expect(l.length).toBeGreaterThan(3)
  })
  it('offers unique reaction emojis, including the celebration one', () => {
    expect(new Set(EMOJIS).size).toBe(EMOJIS.length)
    expect(EMOJIS).toContain('🎉')
  })
  it('limits pictures', () => {
    expect(MAX_IMAGES).toBe(5)
    expect(MAX_SIDE).toBe(1600)
  })
  it('turns bytes into an object URL', () => {
    const url = bytesToUrl(new Uint8Array([1, 2, 3]))
    expect(url).toMatch(/^blob:/)
  })
})
