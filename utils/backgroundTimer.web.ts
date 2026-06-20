export function bgSetTimeout(
  callback: (...args: any[]) => void,
  delay?: number,
  ...args: any[]
): number {
  return setTimeout(callback, delay, ...args) as unknown as number
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
