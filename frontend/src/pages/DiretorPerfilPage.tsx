import { PageContainer } from '../components/PageContainer'
import { useCorporateIdentity } from '../features/profile/useCorporateIdentity'
import { CorporateIdentityPanel } from '../features/profile/CorporateIdentityPanel'

export function DiretorPerfilPage() {
  const identity = useCorporateIdentity()
  return (
    <PageContainer title="Meu perfil" description="Informações preenchidas automaticamente a partir do seu login Microsoft.">
      {identity ? <CorporateIdentityPanel identity={identity} /> : (
        <p role="alert" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-sm font-semibold">
          O perfil é preenchido pelo login Microsoft do Ecossistema SM&amp;A. Entre pelo Ecossistema para ver seus dados.
        </p>
      )}
    </PageContainer>
  )
}
