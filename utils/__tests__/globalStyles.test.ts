import { globalStyles } from '../globalStyles'

describe('globalStyles', () => {
  it('should match the expected style object', () => {
    expect(globalStyles).toEqual({
      picker: {
        color: 'white',
      },
      pickerItem: {
        color: 'white',
      },
    })
  })
})
