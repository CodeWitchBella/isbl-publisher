export function expectedError(msg: string) {
  const err = new Error(msg)
  ;(err as any).expected = true
  return err
}
