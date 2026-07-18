import { evaluateSetDeletion } from '../setDeletion'

describe('evaluateSetDeletion', () => {
  const base = {
    setNumber: 4,
    totalSets: 4,
    completedSets: [] as number[],
    isRunning: false,
    currentSet: 1,
  }

  it('removes a pending set without completing the exercise', () => {
    const verdict = evaluateSetDeletion({ ...base, completedSets: [1] })
    expect(verdict).toEqual({
      allowed: true,
      newTotal: 3,
      completesExercise: false,
    })
  })

  it('blocks deleting a logged set', () => {
    const verdict = evaluateSetDeletion({
      ...base,
      setNumber: 2,
      completedSets: [1, 2],
    })
    expect(verdict).toEqual({ allowed: false, reason: 'completed' })
  })

  it('blocks removing the only set', () => {
    const verdict = evaluateSetDeletion({
      ...base,
      setNumber: 1,
      totalSets: 1,
    })
    expect(verdict).toEqual({ allowed: false, reason: 'lastSet' })
  })

  it('blocks trimming below a logged set (gap in completions)', () => {
    // Sets 1 and 3 logged, set 2 pending: removing one set would make the
    // total 2 and orphan the logged set 3.
    const verdict = evaluateSetDeletion({
      ...base,
      setNumber: 2,
      totalSets: 3,
      completedSets: [1, 3],
    })
    expect(verdict).toEqual({ allowed: false, reason: 'completed' })
  })

  it('blocks removing the set currently being performed', () => {
    const verdict = evaluateSetDeletion({
      ...base,
      completedSets: [1, 2, 3],
      isRunning: true,
      currentSet: 4,
    })
    expect(verdict).toEqual({ allowed: false, reason: 'inProgress' })
  })

  it('allows removal mid-set when the current set survives', () => {
    // Performing set 3 of 4, deleting the pending 4th makes set 3 final.
    const verdict = evaluateSetDeletion({
      ...base,
      completedSets: [1, 2],
      isRunning: true,
      currentSet: 3,
    })
    expect(verdict).toEqual({
      allowed: true,
      newTotal: 3,
      completesExercise: false,
    })
  })

  it('completes the exercise when every remaining set is logged', () => {
    // Resting toward set 4 with 1-3 logged: deleting set 4 finishes the
    // exercise.
    const verdict = evaluateSetDeletion({
      ...base,
      completedSets: [1, 2, 3],
      currentSet: 4,
    })
    expect(verdict).toEqual({
      allowed: true,
      newTotal: 3,
      completesExercise: true,
    })
  })

  it('does not complete the exercise while a set is running', () => {
    // Even when every remaining set already has a log (e.g. set 3 is being
    // redone), deleting the 4th must not end the exercise mid-set.
    const verdict = evaluateSetDeletion({
      ...base,
      completedSets: [1, 2, 3],
      isRunning: true,
      currentSet: 3,
    })
    expect(verdict).toEqual({
      allowed: true,
      newTotal: 3,
      completesExercise: false,
    })
  })
})
