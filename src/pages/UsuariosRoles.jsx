import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  ShieldCheck,
  Search,
  UserPlus,
  Edit3,
  Power,
  Download,
  Plus,
  Save,
  X,
  Loader2,
  CheckSquare,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const PERMISOS_DEFAULT = {
  dashboard_global: false,
  inmuebles_global: false,
  comisiones_global: false,
  exportar_fichas_roi: true,
  configurar_portal_web: false,
  gestionar_usuarios_roles: false,
};

export default function UsuariosRoles() {
  const { agencia, perfil: perfilActual, recargarPerfil } = useAuth();

  const [tabActiva, setTabActiva] = useState('usuarios'); // 'usuarios' | 'matriz'
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  // Filtros de lista de usuarios
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('TODOS');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');

  // Modal Crear / Editar Usuario
  const [modalUsuarioAbierto, setModalUsuarioAbierto] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);
  const [formUsuario, setFormUsuario] = useState({
    nombre_completo: '',
    correo: '',
    telefono: '',
    password: '',
    rol_id: '',
  });

  // Estado edición Matriz de Permisos
  const [matrizEditada, setMatrizEditada] = useState({});
  const [guardandoMatriz, setGuardandoMatriz] = useState(false);

  // Modal Nuevo Rol Personalizado
  const [modalRolAbierto, setModalRolAbierto] = useState(false);
  const [nuevoRolNombre, setNuevoRolNombre] = useState('');
  const [nuevoRolDesc, setNuevoRolDesc] = useState('');
  const [creandoRol, setCreandoRol] = useState(false);

  const cargarDatos = async () => {
    if (!agencia?.id) return;
    setCargando(true);
    try {
      const [{ data: dataRoles, error: errRoles }, { data: dataUsuarios, error: errUsers }] =
        await Promise.all([
          supabase
            .from('roles')
            .select('*')
            .eq('agencia_id', agencia.id)
            .order('created_at', { ascending: true }),
          supabase
            .from('perfiles')
            .select('*, rol:roles(id, nombre)')
            .eq('agencia_id', agencia.id)
            .order('created_at', { ascending: true }),
        ]);

      if (errRoles) throw errRoles;
      if (errUsers) throw errUsers;

      setRoles(dataRoles || []);
      setUsuarios(dataUsuarios || []);

      const mapaMatriz = {};
      (dataRoles || []).forEach((r) => {
        mapaMatriz[r.id] = { ...PERMISOS_DEFAULT, ...(r.permisos || {}) };
      });
      setMatrizEditada(mapaMatriz);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: `Error al cargar datos: ${err.message}` });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [agencia?.id]);

  // Filtrado de usuarios
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((u) => {
      const texto = busqueda.toLowerCase();
      const coincideTexto =
        u.nombre_completo?.toLowerCase().includes(texto) ||
        u.correo?.toLowerCase().includes(texto) ||
        u.telefono?.toLowerCase().includes(texto);

      const coincideRol = filtroRol === 'TODOS' || u.rol_id === filtroRol;
      const coincideEstado =
        filtroEstado === 'TODOS' ||
        (filtroEstado === 'ACTIVO' && u.activo) ||
        (filtroEstado === 'INACTIVO' && !u.activo);

      return coincideTexto && coincideRol && coincideEstado;
    });
  }, [usuarios, busqueda, filtroRol, filtroEstado]);

  // Abrir modal nuevo usuario
  const abrirModalNuevoUsuario = () => {
    setUsuarioEditando(null);
    setFormUsuario({
      nombre_completo: '',
      correo: '',
      telefono: '',
      password: '',
      rol_id: roles[0]?.id || '',
    });
    setModalUsuarioAbierto(true);
  };

  // Abrir modal editar usuario
  const abrirModalEditarUsuario = (userItem) => {
    setUsuarioEditando(userItem);
    setFormUsuario({
      nombre_completo: userItem.nombre_completo || '',
      correo: userItem.correo || '',
      telefono: userItem.telefono || '',
      password: '',
      rol_id: userItem.rol_id || '',
    });
    setModalUsuarioAbierto(true);
  };

  // Guardar usuario (Crear vía RPC o Actualizar perfil)
  const handleGuardarUsuario = async (e) => {
    e.preventDefault();
    setGuardandoUsuario(true);
    setMensaje({ tipo: '', texto: '' });

    try {
      if (usuarioEditando) {
        const { error } = await supabase
          .from('perfiles')
          .update({
            nombre_completo: formUsuario.nombre_completo.trim(),
            telefono: formUsuario.telefono.trim(),
            rol_id: formUsuario.rol_id,
          })
          .eq('id', usuarioEditando.id);

        if (error) throw error;
        setMensaje({ tipo: 'exito', texto: 'Usuario actualizado correctamente.' });
      } else {
        if (formUsuario.password.length < 6) {
          throw new Error('La contraseña inicial debe tener al menos 6 caracteres.');
        }
        const { error } = await supabase.rpc('crear_usuario_agencia', {
          p_email: formUsuario.correo,
          p_password: formUsuario.password,
          p_nombre_completo: formUsuario.nombre_completo,
          p_telefono: formUsuario.telefono,
          p_rol_id: formUsuario.rol_id,
        });

        if (error) throw error;
        setMensaje({
          tipo: 'exito',
          texto: `Usuario ${formUsuario.nombre_completo} creado y habilitado para iniciar sesión.`,
        });
      }

      setModalUsuarioAbierto(false);
      await cargarDatos();
      if (usuarioEditando?.id === perfilActual?.id) {
        await recargarPerfil();
      }
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setGuardandoUsuario(false);
    }
  };

  // Activar / Desactivar usuario
  const toggleEstadoUsuario = async (userItem) => {
    if (userItem.id === perfilActual?.id) {
      setMensaje({
        tipo: 'error',
        texto: 'No puedes desactivar tu propia cuenta de administrador.',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('perfiles')
        .update({ activo: !userItem.activo })
        .eq('id', userItem.id);

      if (error) throw error;
      await cargarDatos();
      setMensaje({
        tipo: 'exito',
        texto: `Estado de ${userItem.nombre_completo} actualizado a ${
          !userItem.activo ? 'Activo' : 'Inactivo'
        }.`,
      });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  };

  // Cambiar permiso en matriz
  const actualizarPermisoRol = (rolId, clave, valor) => {
    setMatrizEditada((prev) => ({
      ...prev,
      [rolId]: {
        ...prev[rolId],
        [clave]: valor,
      },
    }));
  };

  // Guardar matriz de permisos en Supabase
  const handleGuardarMatriz = async () => {
    setGuardandoMatriz(true);
    setMensaje({ tipo: '', texto: '' });

    try {
      for (const rolItem of roles) {
        const nuevosPermisos = matrizEditada[rolItem.id];
        if (nuevosPermisos) {
          const { error } = await supabase
            .from('roles')
            .update({ permisos: nuevosPermisos })
            .eq('id', rolItem.id);
          if (error) throw error;
        }
      }

      await recargarPerfil();
      setMensaje({
        tipo: 'exito',
        texto: 'Matriz de permisos RBAC actualizada para todos los roles.',
      });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: `Error al guardar permisos: ${err.message}` });
    } finally {
      setGuardandoMatriz(false);
    }
  };

  // Crear nuevo rol personalizado
  const handleCrearRol = async (e) => {
    e.preventDefault();
    if (!nuevoRolNombre.trim() || !agencia?.id) return;

    setCreandoRol(true);
    try {
      const { error } = await supabase.from('roles').insert({
        agencia_id: agencia.id,
        nombre: nuevoRolNombre.trim(),
        descripcion: nuevoRolDesc.trim() || 'Rol personalizado de agencia',
        permisos: PERMISOS_DEFAULT,
      });

      if (error) throw error;

      setNuevoRolNombre('');
      setNuevoRolDesc('');
      setModalRolAbierto(false);
      await cargarDatos();
      setMensaje({ tipo: 'exito', texto: 'Nuevo rol personalizado creado.' });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setCreandoRol(false);
    }
  };

  // Exportar CSV de Roles y Perfiles
  const exportarCSV = () => {
    const encabezados = ['Nombre Completo', 'Correo', 'Telefono', 'Rol', 'Estado'];
    const filas = usuariosFiltrados.map((u) => [
      `"${u.nombre_completo || ''}"`,
      `"${u.correo || ''}"`,
      `"${u.telefono || ''}"`,
      `"${u.rol?.nombre || ''}"`,
      u.activo ? 'Activo' : 'Inactivo',
    ]);

    const contenido = [encabezados.join(','), ...filas.map((f) => f.join(','))].join('\n');
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `matriz_usuarios_roles_${agencia?.slug || 'agencia'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filasAlcance = [
    { clave: 'dashboard_global', label: 'Dashboard & Analítica' },
    { clave: 'inmuebles_global', label: 'Inmuebles' },
    { clave: 'comisiones_global', label: 'Control de Comisiones & Balances' },
  ];

  const filasBooleanas = [
    { clave: 'exportar_fichas_roi', label: 'Exportar Fichas PDF y Calculadora ROI' },
    { clave: 'configurar_portal_web', label: 'Configurar Portal Web (/p/slug)' },
    { clave: 'gestionar_usuarios_roles', label: 'Crear / Eliminar Usuarios y Roles' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Usuarios & Roles</h1>
          <p className="text-sm text-slate-500 mt-1">
            Administra el equipo comercial y configura el control de acceso basado en roles (RBAC).
          </p>
        </div>

        {tabActiva === 'usuarios' ? (
          <button
            onClick={abrirModalNuevoUsuario}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition cursor-pointer self-start"
          >
            <UserPlus className="w-4 h-4" />
            + Registrar nuevo usuario
          </button>
        ) : (
          <button
            onClick={() => setModalRolAbierto(true)}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition cursor-pointer self-start"
          >
            <Plus className="w-4 h-4" />
            + Crear nuevo Rol personalizado
          </button>
        )}
      </div>

      {mensaje.texto && (
        <div
          className={`p-4 rounded-xl border text-sm font-medium ${
            mensaje.tipo === 'exito'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      {/* Pestañas: Lista de usuarios | Matriz de permisos */}
      <div className="border-b border-slate-200 flex gap-2">
        <button
          onClick={() => setTabActiva('usuarios')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer ${
            tabActiva === 'usuarios'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Lista de usuarios ({usuarios.length})
        </button>

        <button
          onClick={() => setTabActiva('matriz')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer ${
            tabActiva === 'matriz'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Matriz de permisos ({roles.length} roles)
        </button>
      </div>

      {cargando ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-slate-700" />
        </div>
      ) : tabActiva === 'usuarios' ? (
        /* ==================== PESTAÑA 1: LISTA DE USUARIOS ==================== */
        <div className="space-y-4">
          {/* Barra de búsqueda y filtros */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, correo o teléfono..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <select
              value={filtroRol}
              onChange={(e) => setFiltroRol(e.target.value)}
              className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="TODOS">Todos los roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>

            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="TODOS">Todos los estados</option>
              <option value="ACTIVO">Activos</option>
              <option value="INACTIVO">Inactivos</option>
            </select>
          </div>

          {/* Tabla principal de usuarios */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-900 px-6 py-3.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
                Tabla Principal de Usuarios de la Agencia
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                    <th className="py-3.5 px-5">Usuario / Nombre</th>
                    <th className="py-3.5 px-5">Correo</th>
                    <th className="py-3.5 px-5">Teléfono</th>
                    <th className="py-3.5 px-5">Rol</th>
                    <th className="py-3.5 px-5">Estado</th>
                    <th className="py-3.5 px-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {usuariosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No se encontraron usuarios con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    usuariosFiltrados.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-5 font-semibold text-slate-900">
                          {u.nombre_completo}
                        </td>
                        <td className="py-3.5 px-5 text-slate-600">{u.correo || '—'}</td>
                        <td className="py-3.5 px-5 text-slate-600">{u.telefono || '—'}</td>
                        <td className="py-3.5 px-5">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            {u.rol?.nombre || 'Sin rol'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              u.activo
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-300'
                            }`}
                          >
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => abrirModalEditarUsuario(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-medium text-slate-700 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Editar
                            </button>

                            <button
                              onClick={() => toggleEstadoUsuario(u)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                                u.activo
                                  ? 'border-red-200 text-red-700 hover:bg-red-50'
                                  : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                              {u.activo ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex justify-end">
              <button
                onClick={exportarCSV}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Descargar Matriz Roles y Perfiles
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ==================== PESTAÑA 2: MATRIZ DE PERMISOS ==================== */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-900 px-6 py-3.5 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
              Matriz de Permisos por Rol
            </h2>
            <span className="text-xs text-slate-400">
              Define alcance Global vs. Solo propios por módulo
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase">
                  <th className="py-4 px-6 min-w-[240px]">Funcionalidad</th>
                  {roles.map((r) => (
                    <th key={r.id} className="py-4 px-6 text-center min-w-[220px]">
                      {r.nombre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {/* Filas con selector Global vs Solo propios */}
                {filasAlcance.map((fila) => (
                  <tr key={fila.clave} className="hover:bg-slate-50/70">
                    <td className="py-4 px-6 font-medium text-slate-800">{fila.label}</td>
                    {roles.map((r) => {
                      const esGlobal = Boolean(matrizEditada[r.id]?.[fila.clave]);
                      return (
                        <td key={r.id} className="py-4 px-6">
                          <div className="flex items-center justify-center gap-4">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={esGlobal}
                                onChange={() => actualizarPermisoRol(r.id, fila.clave, true)}
                                className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                              />
                              Global
                            </label>

                            <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={!esGlobal}
                                onChange={() => actualizarPermisoRol(r.id, fila.clave, false)}
                                className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                              />
                              Solo propios
                            </label>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Filas booleanas estándar */}
                {filasBooleanas.map((fila) => (
                  <tr key={fila.clave} className="hover:bg-slate-50/70">
                    <td className="py-4 px-6 font-medium text-slate-800">{fila.label}</td>
                    {roles.map((r) => {
                      const activo = Boolean(matrizEditada[r.id]?.[fila.clave]);
                      return (
                        <td key={r.id} className="py-4 px-6 text-center">
                          <input
                            type="checkbox"
                            checked={activo}
                            onChange={(e) =>
                              actualizarPermisoRol(r.id, fila.clave, e.target.checked)
                            }
                            className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
            <button
              onClick={handleGuardarMatriz}
              disabled={guardandoMatriz}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition cursor-pointer"
            >
              {guardandoMatriz ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando cambios...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ==================== MODAL CREAR / EDITAR USUARIO ==================== */}
      {modalUsuarioAbierto && (
        <div className="fixed inset-0 bg-slate-900/60 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-semibold text-sm">
                {usuarioEditando ? 'Editar usuario de la agencia' : 'Registrar nuevo usuario'}
              </h3>
              <button
                onClick={() => setModalUsuarioAbierto(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarUsuario} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre completo
                </label>
                <input
                  type="text"
                  required
                  value={formUsuario.nombre_completo}
                  onChange={(e) =>
                    setFormUsuario({ ...formUsuario, nombre_completo: e.target.value })
                  }
                  placeholder="Ej: Carlos Ruiz"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Correo corporativo
                </label>
                <input
                  type="email"
                  required
                  disabled={Boolean(usuarioEditando)}
                  value={formUsuario.correo}
                  onChange={(e) =>
                    setFormUsuario({ ...formUsuario, correo: e.target.value })
                  }
                  placeholder="agente@inmoflow.co"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              {!usuarioEditando && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Contraseña inicial de acceso
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formUsuario.password}
                    onChange={(e) =>
                      setFormUsuario({ ...formUsuario, password: e.target.value })
                    }
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="text"
                  value={formUsuario.telefono}
                  onChange={(e) =>
                    setFormUsuario({ ...formUsuario, telefono: e.target.value })
                  }
                  placeholder="+57 310 000 0000"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Seleccionar rol
                </label>
                <select
                  required
                  value={formUsuario.rol_id}
                  onChange={(e) =>
                    setFormUsuario({ ...formUsuario, rol_id: e.target.value })
                  }
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalUsuarioAbierto(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoUsuario}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer"
                >
                  {guardandoUsuario && <Loader2 className="w-4 h-4 animate-spin" />}
                  Guardar usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL CREAR NUEVO ROL PERSONALIZADO ==================== */}
      {modalRolAbierto && (
        <div className="fixed inset-0 bg-slate-900/60 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-blue-400" />
                <h3 className="font-semibold text-sm">Crear nuevo Rol personalizado</h3>
              </div>
              <button
                onClick={() => setModalRolAbierto(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCrearRol} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre del rol
                </label>
                <input
                  type="text"
                  required
                  value={nuevoRolNombre}
                  onChange={(e) => setNuevoRolNombre(e.target.value)}
                  placeholder="Ej: Coordinador Comercial o Analista Financiero"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descripción breve
                </label>
                <input
                  type="text"
                  value={nuevoRolDesc}
                  onChange={(e) => setNuevoRolDesc(e.target.value)}
                  placeholder="Alcance operativo del rol en la agencia"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalRolAbierto(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creandoRol}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer"
                >
                  {creandoRol && <Loader2 className="w-4 h-4 animate-spin" />}
                  Crear Rol
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}