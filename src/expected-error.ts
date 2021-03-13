export function expectedError(msg: string, code: number = 1) {
  const err = new Error(msg)
  ;(err as any).expected = true
  ;(err as any).code = code
  return err
}
