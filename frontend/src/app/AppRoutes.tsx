import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import { ColaboradorPage } from '../pages/ColaboradorPage'
import { HistoricoPage } from '../pages/HistoricoPage'
import { LoginPage } from '../pages/LoginPage'
import { NovoApontamentoPage } from '../pages/NovoApontamentoPage'
import { PerfilPage } from '../pages/PerfilPage'
import { FolgasPage } from '../pages/FolgasPage'
import { ProtectedRoute } from '../features/session/ProtectedRoute'
import { PublicOnlyRoute } from '../features/session/PublicOnlyRoute'
import { SupervisorPage } from '../pages/SupervisorPage'
import { DiretoriaPage } from '../pages/DiretoriaPage'
import { EquipesPage } from '../pages/EquipesPage'
import { AvisosPage } from '../pages/AvisosPage'
import { RelatoriosPage } from '../pages/RelatoriosPage'
import { DiretoriaHistoricoPage } from '../pages/DiretoriaHistoricoPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
      <Route path="/colaborador" element={<ProtectedRoute allowedRoles={['COLLABORATOR']}><AppLayout /></ProtectedRoute>}>
        <Route index element={<ColaboradorPage />} />
        <Route path="apontamentos/novo" element={<NovoApontamentoPage />} />
        <Route path="apontamentos/:entryId/editar" element={<NovoApontamentoPage />} />
        <Route path="historico" element={<HistoricoPage />} />
        <Route path="folgas" element={<FolgasPage />} />
        <Route path="avisos" element={<AvisosPage />} />
        <Route path="perfil" element={<PerfilPage />} />
      </Route>
      <Route path="/supervisor" element={<ProtectedRoute allowedRoles={['SUPERVISOR']}><SupervisorPage /></ProtectedRoute>} />
      <Route path="/administracao" element={<ProtectedRoute allowedRoles={['DIRECTOR_ADMIN']}><DiretoriaPage /></ProtectedRoute>} />
      <Route path="/administracao/equipes" element={<ProtectedRoute allowedRoles={['DIRECTOR_ADMIN']}><EquipesPage /></ProtectedRoute>} />
      <Route path="/administracao/historico" element={<ProtectedRoute allowedRoles={['DIRECTOR_ADMIN']}><AppLayout /></ProtectedRoute>}>
        <Route index element={<DiretoriaHistoricoPage />} />
      </Route>
      <Route path="/relatorios" element={<ProtectedRoute allowedRoles={['DIRECTOR_ADMIN']}><AppLayout /></ProtectedRoute>}>
        <Route index element={<RelatoriosPage />} />
      </Route>
      <Route path="/avisos" element={<ProtectedRoute allowedRoles={['SUPERVISOR', 'DIRECTOR_ADMIN']}><AppLayout /></ProtectedRoute>}>
        <Route index element={<AvisosPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
