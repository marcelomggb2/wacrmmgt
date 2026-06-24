import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/whatsapp/channels
 *
 * Returns all WhatsApp channel configurations for the authenticated
 * user's account. Used by the inbox channel selector and the Settings
 * multi-channel list. Sensitive fields (access_token, verify_token)
 * are excluded — callers only need the metadata.
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile?.account_id) {
      return NextResponse.json({ channels: [] })
    }

    const { data: channels, error } = await supabase
      .from('whatsapp_config')
      .select(
        'id, phone_number_id, waba_id, label, status, registered_at, last_registration_error, created_at, updated_at',
      )
      .eq('account_id', profile.account_id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[channels GET] db error:', error)
      return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 })
    }

    return NextResponse.json({ channels: channels ?? [] })
  } catch (err) {
    console.error('[channels GET] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
