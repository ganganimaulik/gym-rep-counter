export function bgSetTimeout(
  callback: (...args: unknown[]) => void,
  delay?: number,
  ...args: unknown[]
): number {
  return setTimeout(
    callback as (...args: unknown[]) => void,
    delay,
    ...args,
  ) as unknown as number
}

export function bgClearTimeout(timeoutId: number | undefined): void {
  if (timeoutId !== undefined) {
    clearTimeout(timeoutId)
  }
}

export function enableBackgroundExecution(): void {
  // No-op on web
}

export function disableBackgroundExecution(): void {
  // No-op on web
}
