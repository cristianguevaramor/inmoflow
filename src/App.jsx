import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import { Loader2 } from 'lucide-react';
import ConfiguracionPortal from './pages/ConfiguracionPortal';
import UsuariosRoles from './pages/UsuariosRoles';
import PortalPublico from './pages/PortalPublico';

function RutaProtegida({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-800" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function ModuloEnConstruccion({ titulo, descripcion }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">{titulo}</h2>
      <p className="text-slate-500 mt-1 text-sm">{descripcion}</p>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
           <Route 
            path="/p/:slug" 
            element={<PortalPublico />} 
          />
          <Route
            path="/"
            element={
              <RutaProtegida>
                <Layout />
              </RutaProtegida>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route
              path="dashboard"
              element={
                <ModuloEnConstruccion
                  titulo="Dashboard BI"
                  descripcion="Indicadores ejecutivos y rendimiento comercial."
                />
              }
            />
            <Route
              path="inmuebles"
              element={
                <ModuloEnConstruccion
                  titulo="Gestión de Inmuebles"
                  descripcion="Inventario de propiedades y publicación en portal web."
                />
              }
            />
            <Route
              path="prospectos"
              element={
                <ModuloEnConstruccion
                  titulo="Prospectos Kanban"
                  descripcion="Embudo comercial y bitácora cronológica."
                />
              }
            />
            <Route
              path="fichas-roi"
              element={
                <ModuloEnConstruccion
                  titulo="Fichas PDF y Simulador ROI"
                  descripcion="Generación de fichas comerciales y análisis de rentabilidad."
                />
              }
            />
            <Route
              path="contratos"
              element={
                <ModuloEnConstruccion
                  titulo="Contratos y Alertas"
                  descripcion="Control documental y vencimientos."
                />
              }
            />
            <Route
              path="finanzas"
              element={
                <ModuloEnConstruccion
                  titulo="Finanzas y Comisiones"
                  descripcion="Liquidación de comisiones por operación."
                />
              }
            />
            <Route
              path="configuracion-portal"
              element={<ConfiguracionPortal />}
            />
            <Route
              path="usuarios-roles"
              element={<UsuariosRoles />}
            />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}