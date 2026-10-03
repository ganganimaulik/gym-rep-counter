// Loads utils/demoMode as a build would see it: the platform and the inlined demo flag.
const load = (platform: string, flag: string | undefined) => {
  let mod: typeof import('../demoMode') | undefined
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({ Platform: { OS: platform } }))
    if (flag === undefined) delete process.env.EXPO_PUBLIC_DEMO_MODE
    else process.env.EXPO_PUBLIC_DEMO_MODE = flag
    mod = require('../demoMode')
  })
  return mod!
}

describe('demoMode', () => {
  const original = process.env.EXPO_PUBLIC_DEMO_MODE
  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_DEMO_MODE
    else process.env.EXPO_PUBLIC_DEMO_MODE = original
  })

  it('adds nothing to a build people use', () => {
    for (const { DEMO_MODE, demoHint } of [
      load('web', undefined),
      load('ios', undefined),
      load('android', undefined),
      // A native build can't be a demo build, whatever the flag says.
      load('ios', '1'),
    ]) {
      expect(DEMO_MODE).toBe(false)
      expect(demoHint({ role: 'radio', 'aria-checked': true })).toEqual({})
      expect(demoHint({ 'aria-label': 'Add a set' })).toEqual({})
    }
  })

  it('names things for DemoPilot in a web demo build', () => {
    const { DEMO_MODE, demoHint } = load('web', '1')
    expect(DEMO_MODE).toBe(true)
    expect(demoHint({ role: 'radio', 'aria-checked': true })).toEqual({
      role: 'radio',
      'aria-checked': true,
    })
    expect(demoHint({ 'aria-label': 'Add a set' })).toEqual({
      'aria-label': 'Add a set',
    })
  })
})
