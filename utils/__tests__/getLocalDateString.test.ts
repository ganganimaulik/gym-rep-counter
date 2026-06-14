import getLocalDateString from '../getLocalDateString'

describe('getLocalDateString', () => {
  it('should return date in YYYY-MM-DD format', () => {
    const result = getLocalDateString()
    // Check format matches YYYY-MM-DD pattern
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('should zero-pad single-digit months and days', () => {
    const result = getLocalDateString()
    const parts = result.split('-')

    expect(parts[1].length).toBe(2) // Month should be 2 digits
    expect(parts[2].length).toBe(2) // Day should be 2 digits
  })

  it('should return current date', () => {
    const result = getLocalDateString()
    const now = new Date()
    const expected = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`

    expect(result).toBe(expected)
  })
})
