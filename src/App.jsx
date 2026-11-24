import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import { Loader2 } from 'lucide-react';
import ConfiguracionPortal from './pages/ConfiguracionPortal';
import UsuariosRoles from './pages/UsuariosRoles';
import PortalPublico from './pages/PortalPublico';
import Dashboard from './pages/Dashboard';
import GestionDocumental from './pages/GestionDocumental';
import Inmuebles from './pages/Inmuebles';
import Prospectos from './pages/Prospectos';
import CalculadoraFinanzas from './pages/CalculadoraFinanzas';

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
              element={<Dashboard />}
              />

            <Route 
            path="inmuebles" 
            element={<Inmuebles />} 
            />

            <Route 
            path="prospectos" 
            element={<Prospectos />}
            />

            <Route 
            path="contratos" 
            element={<GestionDocumental />} 
            />
            <Route 
            path="finanzas" 
            element={<CalculadoraFinanzas />} 
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