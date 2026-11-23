import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Kanban,
  FileSpreadsheet,
  FileSignature,
  BadgeDollarSign,
  Globe,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { perfil, agencia, rol, cerrarSesion, tienePermiso } = useAuth();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await cerrarSesion();
    navigate('/login');
  };

  const navegacion = [
    {
      nombre: 'Dashboard BI',
      ruta: '/dashboard',
      icono: LayoutDashboard,
      visible: true,
    },
    {
      nombre: 'Inmuebles',
      ruta: '/inmuebles',
      icono: Building2,
      visible: true,
    },
    {
      nombre: 'Prospectos Kanban',
      ruta: '/prospectos',
      icono: Kanban,
      visible: true,
    },
    {
      nombre: 'Fichas y ROI',
      ruta: '/fichas-roi',
      icono: FileSpreadsheet,
      visible: tienePermiso('exportar_fichas_roi'),
    },
    {
      nombre: 'Contratos',
      ruta: '/contratos',
      icono: FileSignature,
      visible: true,
    },
    {
      nombre: 'Finanzas y Comisiones',
      ruta: '/finanzas',
      icono: BadgeDollarSign,
      visible: true,
    },
    {
      nombre: 'Portal Web Público',
      ruta: '/configuracion-portal',
      icono: Globe,
      visible: tienePermiso('configurar_portal_web'),
    },
    {
      nombre: 'Usuarios y Roles',
      ruta: '/usuarios-roles',
      icono: ShieldCheck,
      visible: tienePermiso('gestionar_usuarios_roles'),
    },
  ].filter((item) => item.visible);

  const colorMarca = agencia?.color_primario || '#0F172A';

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Overlay móvil */}
      {menuAbierto && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-20 lg:hidden"
          onClick={() => setMenuAbierto(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        style={{ backgroundColor: colorMarca }}
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 text-white flex flex-col transition-transform duration-200 ${
          menuAbierto ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            {agencia?.logo_url ? (
              <img
                src={agencia.logo_url}
                alt={agencia.nombre}
                className="w-9 h-9 rounded-lg object-cover bg-white"
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="truncate">
              <p className="font-bold text-sm truncate">{agencia?.nombre || 'InmoFlow'}</p>
              <span className="text-xs text-white/70 block truncate">{rol?.nombre}</span>
            </div>
          </div>
          <button
            onClick={() => setMenuAbierto(false)}
            className="lg:hidden text-white/70 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navegacion.map((item) => {
            const Icono = item.icono;
            return (
              <NavLink
                key={item.ruta}
                to={item.ruta}
                onClick={() => setMenuAbierto(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-white/20 text-white shadow-sm'
                      : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icono className="w-4 h-4 shrink-0" />
                <span>{item.nombre}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          {agencia?.slug && (
            <a
              href={`/p/${agencia.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition"
            >
              <span>Ver Portal Público</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="truncate pr-2">
              <p className="text-xs font-semibold truncate">{perfil?.nombre_completo}</p>
              <p className="text-[11px] text-white/60">Sesión activa</p>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Contenedor Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 lg:px-8 h-16 flex items-center justify-between sticky top-0 z-10">
          <button
            onClick={() => setMenuAbierto(true)}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="text-sm text-slate-500 hidden sm:block">
            Entorno Operativo • <span className="font-medium text-slate-800">{agencia?.nombre}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              {rol?.nombre}
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}