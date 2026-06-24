import type { SupabaseClient } from '@supabase/supabase-js'

export interface WhatsAppConfigRow {
  id: string
  account_id: string
  phone_number_id: string
  access_token: string
  waba_id?: string | null
  status?: string | null
  [key: string]: unknown
}

interface ResolveWhatsAppConfigOptions {
  conversationId?: string
  preferWaba?: boolean
}

interface ResolveWhatsAppConfigResult {
  config: WhatsAppConfigRow | null
  error: string | null
}

export async function resolveWhatsAppConfigForAccount(
  supabase: SupabaseClient,
  accountId: string,
  options: ResolveWhatsAppConfigOptions = {},
): Promise<ResolveWhatsAppConfigResult> {
  let conversationConfigId: string | null = null

  if (options.conversationId) {
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('whatsapp_config_id')
      .eq('id', options.conversationId)
      .eq('account_id', accountId)
      .maybeSingle()

    if (conversationError) {
      return { config: null, error: conversationError.message }
    }

    conversationConfigId =
      (conversation as { whatsapp_config_id?: string | null } | null)
        ?.whatsapp_config_id ?? null
  }

  const { data, error } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })

  if (error) {
    return { config: null, error: error.message }
  }

  const configs = (data ?? []) as WhatsAppConfigRow[]
  if (configs.length === 0) {
    return { config: null, error: null }
  }

  if (conversationConfigId) {
    const conversationConfig = configs.find(
      (config) => config.id === conversationConfigId,
    )
    if (conversationConfig) {
      return { config: conversationConfig, error: null }
    }
  }

  if (options.preferWaba) {
    const wabaConfig =
      configs.find(
        (config) => config.status === 'connected' && Boolean(config.waba_id),
      ) ?? configs.find((config) => Boolean(config.waba_id))

    if (wabaConfig) {
      return { config: wabaConfig, error: null }
    }
  }

  const connectedConfig = configs.find(
    (config) => config.status === 'connected',
  )

  return { config: connectedConfig ?? configs[0], error: null }
}
