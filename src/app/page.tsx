import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function RootPage() {
  const hostname = (await headers()).get('host')?.split(':')[0] ?? ''
  const isMobileHost =
    hostname === 'mobile.mgteamoficial.site' || hostname.startsWith('mobile.')

  redirect(isMobileHost ? '/app' : '/dashboard')
}
