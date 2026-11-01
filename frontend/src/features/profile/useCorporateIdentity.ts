import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useSession } from '../session/useSession'
import { getEcosystemAuthUser } from '../../services/ecosystemLogin'
import { buildCorporateIdentity, type CorporateIdentityView } from './corporateIdentity'

/** Identidade do usuário que entrou pela Microsoft (qualquer cargo). Null em sessões de demonstração. */
export function useCorporateIdentity(): CorporateIdentityView | null {
  const { session } = useSession()
  const isEcosystem = session?.authProvider === 'ecosystem'
  const [authUser, setAuthUser] = useState<User | null>(null)

  useEffect(() => {
    if (!isEcosystem) return
    let active = true
    void getEcosystemAuthUser().then((user) => { if (active) setAuthUser(user) })
    return () => { active = false }
  }, [isEcosystem])

  return useMemo(() => (session && isEcosystem ? buildCorporateIdentity(session, authUser) : null), [session, isEcosystem, authUser])
}
