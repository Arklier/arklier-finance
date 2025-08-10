export function toPgByteaHex(buf: Buffer): string {
  // Postgres wants a \\x-prefixed hex string over PostgREST
  return '\\x' + buf.toString('hex')
}

export function fromPgBytea(value: unknown): Buffer {
  // Handles: \\xHEX, base64, Uint8Array, number[] (rare)
  if (value instanceof Uint8Array) return Buffer.from(value)
  if (Array.isArray(value)) return Buffer.from(value as number[]) // edge case
  if (typeof value === 'string') {
    const s = value.trim()
    if (s.startsWith('\\x') || s.startsWith('\\X')) return Buffer.from(s.slice(2), 'hex')
    // try base64 as fallback
    try { return Buffer.from(s, 'base64') } catch {}
  }
  throw new Error('Unsupported bytea representation from database')
}
