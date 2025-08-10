export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptSecret } from '@/lib/crypto/secrets'
import { fromPgBytea } from '@/lib/crypto/pg-bytea'


export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: conn, error: connErr } = await supabase
    .from('exchange_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('exchange', 'firi')
    .single()

  if (connErr || !conn) {
    return NextResponse.json({ error: 'no-connection' }, { status: 400 })
  }

  try {
    const blob = fromPgBytea(conn.api_secret) // ✅ works for \\xHEX/base64/Uint8Array
    const secretPlain = decryptSecret(blob)
    
    // TODO: Implement sync flow using secretPlain
    return NextResponse.json({ 
      message: 'Sync endpoint ready', 
      hasSecret: !!secretPlain 
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'decrypt-failed', detail: msg }, { status: 500 })
  }
}
