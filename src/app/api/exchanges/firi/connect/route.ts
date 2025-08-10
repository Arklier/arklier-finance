export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { encryptSecret } from '@/lib/crypto/secrets'
import { toPgByteaHex } from '@/lib/crypto/pg-bytea'

const Body = z.object({
  apiKey: z.string().min(10),
  clientId: z.string().min(3),
  secret: z.string().min(10),
  label: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = Body.parse(await req.json())
  const encrypted = encryptSecret(body.secret)
  const api_secret = toPgByteaHex(encrypted) // ✅ write as \\xHEX

  const { error } = await supabase
    .from('exchange_connections')
    .upsert({
      user_id: user.id,
      exchange: 'firi',
      label: body.label ?? 'Firi',
      api_key: body.apiKey,
      client_id: body.clientId,
      api_secret, // bytea column
    }, { onConflict: 'user_id,exchange' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
