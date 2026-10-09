import { describe, expect, it } from 'vitest'
import { randomAlias } from './alias'

describe('randomAlias', () => {
  it('is an adjective and an animal, both capitalised', () => {
    for (let i = 0; i < 100; i++) expect(randomAlias()).toMatch(/^\p{Lu}[\p{L}-]+ \p{Lu}\p{L}+$/u)
  })
  it('varies between calls', () => {
    const seen = new Set(Array.from({ length: 200 }, randomAlias))
    expect(seen.size).toBeGreaterThan(20)
  })
})
