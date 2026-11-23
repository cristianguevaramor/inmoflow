import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Plus,
  Search,
  Eye,
  Edit3,
  Trash2,
  X,
  Upload,
  Image as ImageIcon,
  FileText,
  Loader2,
  BedDouble,
  Bath,
  Car,
  MapPin,
  Globe,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function Inmuebles() {
  const { agencia, perfil, tienePermiso } = useAuth();
  const puedeVerTodos = tienePermiso('inmuebles_global');

  const [inmuebles, setInmuebles] = useState([]);
  const [agentes, setAgentes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  // Filtros de tabla
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');

  // Modal Registro / Edición (RF02 / RF11)
  const [modalAbierto, setModalAbierto] = useState(false);
  const [tabModal, setTabModal] = useState('datos'); // 'datos' | 'multimedia' | 'documentos'
  const [inmuebleEditando, setInmuebleEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);

  // Modal Vista Rápida (Ojo)
  const [inmuebleDetalle, setInmuebleDetalle] = useState(null);

  const [form, setForm] = useState({
    codigo: '',
    titulo: '',
    tipo_negocio: 'Venta',
    precio: '',
    agente_id: '',
    estado: 'Disponible',
    ciudad: 'Bogotá',
    direccion: '',
    habitaciones: 2,
    banos: 2,
    parqueaderos: 1,
    area_m2: '',
    descripcion: '',
    publicado_web: true,
    fotos: [],
    documentos_legales: [],
  });

  const cargarDatos = async () => {
    if (!agencia?.id) return;
    setCargando(true);

    try {
      let queryInmuebles = supabase
        .from('inmuebles')
        .select('*, agente:perfiles(id, nombre_completo)')
        .eq('agencia_id', agencia.id)
        .order('created_at', { ascending: false });

      if (!puedeVerTodos && perfil?.id) {
        queryInmuebles = queryInmuebles.eq('agente_id', perfil.id);
      }

      const [resInm, resAgentes] = await Promise.all([
        queryInmuebles,
        supabase
          .from('perfiles')
          .select('id, nombre_completo')
          .eq('agencia_id', agencia.id)
          .eq('activo', true),
      ]);

      if (resInm.error) throw resInm.error;
      setInmuebles(resInm.data || []);
      setAgentes(resAgentes.error ? [] : resAgentes.data || []);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: `Error al cargar inventario: ${err.message}` });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [agencia?.id, perfil?.id, puedeVerTodos]);

  const generarSiguienteCodigo = () => {
    const consecutivo = inmuebles.length + 1;
    return `INM-${String(consecutivo).padStart(3, '0')}`;
  };

  const abrirModalNuevo = () => {
    setInmuebleEditando(null);
    setTabModal('datos');
    setForm({
      codigo: generarSiguienteCodigo(),
      titulo: '',
      tipo_negocio: 'Venta',
      precio: '',
      agente_id: perfil?.id || agentes[0]?.id || '',
      estado: 'Disponible',
      ciudad: 'Bogotá',
      direccion: '',
      habitaciones: 2,
      banos: 2,
      parqueaderos: 1,
      area_m2: '',
      descripcion: '',
      publicado_web: true,
      fotos: [],
      documentos_legales: [],
    });
    setModalAbierto(true);
  };

  const abrirModalEditar = (item) => {
    setInmuebleEditando(item);
    setTabModal('datos');
    setForm({
      codigo: item.codigo || 'INM-001',
      titulo: item.titulo || '',
      tipo_negocio: item.tipo_negocio || 'Venta',
      precio: item.precio || '',
      agente_id: item.agente_id || perfil?.id || '',
      estado: item.estado || 'Disponible',
      ciudad: item.ciudad || 'Bogotá',
      direccion: item.direccion || '',
      habitaciones: item.habitaciones ?? 0,
      banos: item.banos ?? 0,
      parqueaderos: item.parqueaderos ?? 0,
      area_m2: item.area_m2 || '',
      descripcion: item.descripcion || '',
      publicado_web: item.publicado_web !== false,
      fotos: Array.isArray(item.fotos) ? item.fotos : [],
      documentos_legales: Array.isArray(item.documentos_legales)
        ? item.documentos_legales
        : [],
    });
    setModalAbierto(true);
  };

  // Subir imágenes en la pestaña Multimedia
  const handleSubirFotos = async (e) => {
    const archivos = Array.from(e.target.files || []);
    if (!archivos.length || !agencia?.id) return;

    setSubiendoArchivo(true);
    try {
      const nuevasUrls = [];
      for (const file of archivos) {
        const ext = file.name.split('.').pop();
        const path = `galeria/${agencia.id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from('inmuebles')
          .upload(path, file, { upsert: true });

        if (upErr) throw upErr;

        const { data: pub } = supabase.storage.from('inmuebles').getPublicUrl(path);
        if (pub?.publicUrl) {
          nuevasUrls.push(pub.publicUrl);
        }
      }

      setForm((prev) => ({
        ...prev,
        fotos: [...prev.fotos, ...nuevasUrls],
      }));
    } catch (err) {
      setMensaje({ tipo: 'error', texto: `Error al subir imágenes: ${err.message}` });
    } finally {
      setSubiendoArchivo(false);
    }
  };

  // Subir documento legal en la pestaña Documentos
  const handleSubirDocumentoLegal = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !agencia?.id) return;

    setSubiendoArchivo(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `legales-inmuebles/${agencia.id}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('inmuebles')
        .upload(path, file, { upsert: true });

      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('inmuebles').getPublicUrl(path);

      setForm((prev) => ({
        ...prev,
        documentos_legales: [
          ...prev.documentos_legales,
          {
            nombre: file.name,
            url: pub?.publicUrl || '',
            fecha: new Date().toLocaleDateString('es-CO'),
          },
        ],
      }));
    } catch (err) {
      setMensaje({ tipo: 'error', texto: `Error al subir documento: ${err.message}` });
    } finally {
      setSubiendoArchivo(false);
    }
  };

  const handleGuardarInmueble = async (e) => {
    e.preventDefault();
    if (!agencia?.id) return;

    setGuardando(true);
    setMensaje({ tipo: '', texto: '' });

    const payload = {
      agencia_id: agencia.id,
      codigo: form.codigo.trim() || generarSiguienteCodigo(),
      titulo: form.titulo.trim(),
      tipo_negocio: form.tipo_negocio,
      precio: Number(form.precio) || 0,
      agente_id: form.agente_id || perfil?.id || null,
      estado: form.estado,
      ciudad: form.ciudad.trim() || 'Bogotá',
      direccion: form.direccion.trim(),
      habitaciones: Number(form.habitaciones) || 0,
      banos: Number(form.banos) || 0,
      parqueaderos: Number(form.parqueaderos) || 0,
      area_m2: Number(form.area_m2) || 0,
      descripcion: form.descripcion.trim(),
      publicado_web: Boolean(form.publicado_web),
      fotos: form.fotos,
      documentos_legales: form.documentos_legales,
    };

    try {
      if (inmuebleEditando) {
        const { error } = await supabase
          .from('inmuebles')
          .update(payload)
          .eq('id', inmuebleEditando.id);
        if (error) throw error;
        setMensaje({
          tipo: 'exito',
          texto: `Inmueble ${payload.codigo} actualizado correctamente.`,
        });
      } else {
        const { error } = await supabase.from('inmuebles').insert(payload);
        if (error) throw error;
        setMensaje({
          tipo: 'exito',
          texto: `Inmueble ${payload.codigo} registrado en el inventario.`,
        });
      }

      setModalAbierto(false);
      await cargarDatos();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: `Error al guardar inmueble: ${err.message}` });
    } finally {
      setGuardando(false);
    }
  };

  // Alternar publicación en portal web directamente desde la tabla
  const togglePublicadoWeb = async (item) => {
    try {
      const nuevoEstadoWeb = !(item.publicado_web !== false);
      const { error } = await supabase
        .from('inmuebles')
        .update({ publicado_web: nuevoEstadoWeb })
        .eq('id', item.id);

      if (error) throw error;
      await cargarDatos();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  };

  const eliminarInmueble = async (item) => {
    try {
      const { error } = await supabase.from('inmuebles').delete().eq('id', item.id);
      if (error) throw error;
      await cargarDatos();
      setMensaje({
        tipo: 'exito',
        texto: `Inmueble ${item.codigo || item.titulo} eliminado del inventario.`,
      });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  };

  const inmueblesFiltrados = useMemo(() => {
    return inmuebles.filter((item) => {
      const q = busqueda.toLowerCase();
      const coincideTexto =
        item.codigo?.toLowerCase().includes(q) ||
        item.titulo?.toLowerCase().includes(q) ||
        item.ciudad?.toLowerCase().includes(q) ||
        item.direccion?.toLowerCase().includes(q);

      const coincideTipo =
        filtroTipo === 'TODOS' ||
        (item.tipo_negocio || '').toLowerCase() === filtroTipo.toLowerCase();

      const coincideEstado =
        filtroEstado === 'TODOS' ||
        (item.estado || '').toLowerCase() === filtroEstado.toLowerCase();

      return coincideTexto && coincideTipo && coincideEstado;
    });
  }, [inmuebles, busqueda, filtroTipo, filtroEstado]);

  const formatoCOP = (valor) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(Number(valor) || 0);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Inmuebles</h1>
          <p className="text-sm text-slate-500 mt-1">
            Administra el portafolio de propiedades, galería multimedia, documentación y visibilidad web.
          </p>
        </div>

        <button
          type="button"
          onClick={abrirModalNuevo}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition cursor-pointer self-start"
        >
          <Plus className="w-4 h-4" />
          + Registrar nuevo inmueble
        </button>
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

      {/* Barra de búsqueda y filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código (INM-001), barrio, dirección o título..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="TODOS">Todos los tipos</option>
          <option value="Venta">Venta</option>
          <option value="Arriendo">Arriendo</option>
        </select>

        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="TODOS">Todos los estados</option>
          <option value="Disponible">Disponible</option>
          <option value="Reservado">Reservado</option>
          <option value="Arrendado">Arrendado</option>
          <option value="Vendido">Vendido</option>
        </select>
      </div>

      {/* Tabla Principal de Inmuebles (RF02) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="bg-slate-900 px-6 py-3.5 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
            Tabla Principal de Inmuebles (RF02)
          </h2>
          <span className="text-xs text-slate-400">
            {inmueblesFiltrados.length}{' '}
            {inmueblesFiltrados.length === 1 ? 'propiedad' : 'propiedades'}
          </span>
        </div>

        {cargando ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-slate-700" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                  <th className="py-3.5 px-4">Foto</th>
                  <th className="py-3.5 px-4">Código</th>
                  <th className="py-3.5 px-4">Ubicación</th>
                  <th className="py-3.5 px-4">Tipo</th>
                  <th className="py-3.5 px-4">Precio</th>
                  <th className="py-3.5 px-4">Agente Asignado</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4 text-center">Public. Web</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {inmueblesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-500 text-xs">
                      No hay inmuebles registrados con los filtros actuales. Haz clic en &quot;+ Registrar nuevo inmueble&quot;.
                    </td>
                  </tr>
                ) : (
                  inmueblesFiltrados.map((item) => {
                    const portada = Array.isArray(item.fotos) && item.fotos[0];
                    const activoWeb = item.publicado_web !== false;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4">
                          <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center">
                            {portada ? (
                              <img
                                src={portada}
                                alt={item.titulo}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Building2 className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-slate-800 text-xs">
                          {item.codigo || 'INM-001'}
                        </td>

                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">{item.titulo}</p>
                          <p className="text-xs text-slate-500">
                            {[item.ciudad, item.direccion].filter(Boolean).join(' • ')}
                          </p>
                        </td>

                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {item.tipo_negocio || 'Venta'}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-bold text-slate-900">
                          {formatoCOP(item.precio)}
                        </td>

                        <td className="py-3 px-4 text-slate-700 text-xs">
                          {item.agente?.nombre_completo || 'Sin asignar'}
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              item.estado === 'Disponible'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : item.estado === 'Reservado'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {item.estado || 'Disponible'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => togglePublicadoWeb(item)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                              activoWeb
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-300'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                activoWeb ? 'bg-emerald-600' : 'bg-slate-400'
                              }`}
                            />
                            {activoWeb ? 'Activo' : 'Oculto'}
                          </button>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInmuebleDetalle(item)}
                              title="Ver ficha rápida"
                              className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => abrirModalEditar(item)}
                              title="Editar inmueble"
                              className="p-1.5 rounded-lg border border-slate-300 hover:bg-amber-50 text-amber-700 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => eliminarInmueble(item)}
                              title="Eliminar inmueble"
                              className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-700 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================== MODAL REGISTRO Y EDICIÓN (RF02 / RF11) ==================== */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-slate-900/60 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <div>
                <h3 className="font-bold text-sm">
                  {inmuebleEditando
                    ? `Editar Inmueble (${form.codigo})`
                    : 'Registro de Nuevo Inmueble (RF02 / RF11)'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Completa los datos técnicos, galería multimedia y documentos legales
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pestañas del Modal: Datos | Multimedia | Documentos */}
            <div className="bg-slate-50 px-6 border-b border-slate-200 flex gap-2">
              {[
                { id: 'datos', label: 'Datos' },
                { id: 'multimedia', label: `Multimedia (${form.fotos.length})` },
                {
                  id: 'documentos',
                  label: `Documentos (${form.documentos_legales.length})`,
                },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTabModal(t.id)}
                  className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer ${
                    tabModal === t.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <form
              onSubmit={handleGuardarInmueble}
              className="p-6 overflow-y-auto space-y-5 flex-1"
            >
              {tabModal === 'datos' && (
                <>
                  {/* 1. Información básica */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5">
                      1. Información básica
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Código
                        </label>
                        <input
                          type="text"
                          required
                          value={form.codigo}
                          onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Título comercial *
                        </label>
                        <input
                          type="text"
                          required
                          value={form.titulo}
                          onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                          placeholder="Ej: Apartamento Duplex Chapinero Alto"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Tipo de negocio *
                        </label>
                        <select
                          value={form.tipo_negocio}
                          onChange={(e) =>
                            setForm({ ...form, tipo_negocio: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-600"
                        >
                          <option value="Venta">Venta</option>
                          <option value="Arriendo">Arriendo</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Precio (COP) *
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
                          value={form.precio}
                          onChange={(e) => setForm({ ...form, precio: e.target.value })}
                          placeholder="Ej: 450000000"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Agente a cargo
                        </label>
                        <select
                          value={form.agente_id}
                          onChange={(e) =>
                            setForm({ ...form, agente_id: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-600"
                        >
                          {agentes.map((ag) => (
                            <option key={ag.id} value={ag.id}>
                              {ag.nombre_completo}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Estado
                        </label>
                        <select
                          value={form.estado}
                          onChange={(e) => setForm({ ...form, estado: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-600"
                        >
                          <option value="Disponible">Disponible</option>
                          <option value="Reservado">Reservado</option>
                          <option value="Arrendado">Arrendado</option>
                          <option value="Vendido">Vendido</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 2. Características del inmueble */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5">
                      2. Características del inmueble
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Ciudad / Zona
                        </label>
                        <input
                          type="text"
                          value={form.ciudad}
                          onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                          placeholder="Bogotá - Chapinero"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Dirección *
                        </label>
                        <input
                          type="text"
                          required
                          value={form.direccion}
                          onChange={(e) =>
                            setForm({ ...form, direccion: e.target.value })
                          }
                          placeholder="Calle 63 # 4 - 20"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Habitaciones
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={form.habitaciones}
                          onChange={(e) =>
                            setForm({ ...form, habitaciones: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Baños
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={form.banos}
                          onChange={(e) => setForm({ ...form, banos: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Parqueadero
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={form.parqueaderos}
                          onChange={(e) =>
                            setForm({ ...form, parqueaderos: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Área (m²)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={form.area_m2}
                          onChange={(e) => setForm({ ...form, area_m2: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <label className="inline-flex items-center gap-2.5 cursor-pointer bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                        <input
                          type="checkbox"
                          checked={form.publicado_web}
                          onChange={(e) =>
                            setForm({ ...form, publicado_web: e.target.checked })
                          }
                          className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                        />
                        <Globe className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-bold text-slate-800">
                          Publicar en la WEB (/p/{agencia?.slug})
                        </span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {tabModal === 'multimedia' && (
                <div className="space-y-4">
                  <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-slate-50 cursor-pointer transition">
                    {subiendoArchivo ? (
                      <Loader2 className="w-7 h-7 animate-spin text-blue-600 mb-2" />
                    ) : (
                      <ImageIcon className="w-7 h-7 text-blue-600 mb-2" />
                    )}
                    <p className="text-sm font-semibold text-slate-800">
                      Cargar fotografías del inmueble
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Formatos JPG, PNG o WEBP (la primera imagen será la portada)
                    </p>
                    <input
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleSubirFotos}
                      disabled={subiendoArchivo}
                      className="hidden"
                    />
                  </label>

                  {form.fotos.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {form.fotos.map((url, idx) => (
                        <div
                          key={idx}
                          className="relative group rounded-xl overflow-hidden border border-slate-200 h-28"
                        >
                          <img
                            src={url}
                            alt={`Foto ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                fotos: prev.fotos.filter((_, i) => i !== idx),
                              }))
                            }
                            className="absolute top-1.5 right-1.5 bg-slate-900/80 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tabModal === 'documentos' && (
                <div className="space-y-4">
                  <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-slate-50 cursor-pointer transition">
                    {subiendoArchivo ? (
                      <Loader2 className="w-7 h-7 animate-spin text-blue-600 mb-2" />
                    ) : (
                      <Upload className="w-7 h-7 text-blue-600 mb-2" />
                    )}
                    <p className="text-sm font-semibold text-slate-800">
                      Adjuntar soporte legal del inmueble
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Certificado de tradición, escritura, impuesto predial (PDF / DOC)
                    </p>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.png,.jpg"
                      onChange={handleSubirDocumentoLegal}
                      disabled={subiendoArchivo}
                      className="hidden"
                    />
                  </label>

                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
                    {form.documentos_legales.length === 0 ? (
                      <p className="p-6 text-center text-xs text-slate-500">
                        Sin documentos legales adjuntos.
                      </p>
                    ) : (
                      form.documentos_legales.map((doc, idx) => (
                        <div
                          key={idx}
                          className="p-3 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="font-semibold text-slate-800">{doc.nombre}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                documentos_legales: prev.documentos_legales.filter(
                                  (_, i) => i !== idx
                                ),
                              }))
                            }
                            className="text-red-600 hover:underline cursor-pointer"
                          >
                            Quitar
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer"
                >
                  {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                  Guardar Inmueble
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL VISTA RÁPIDA DEL INMUEBLE (OJO) ==================== */}
      {inmuebleDetalle && (
        <div className="fixed inset-0 bg-slate-900/60 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <span className="font-mono text-xs font-bold text-blue-400">
                {inmuebleDetalle.codigo} • {inmuebleDetalle.tipo_negocio}
              </span>
              <button
                type="button"
                onClick={() => setInmuebleDetalle(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {Array.isArray(inmuebleDetalle.fotos) && inmuebleDetalle.fotos[0] && (
                <img
                  src={inmuebleDetalle.fotos[0]}
                  alt={inmuebleDetalle.titulo}
                  className="w-full h-48 object-cover rounded-xl"
                />
              )}

              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {inmuebleDetalle.titulo}
                </h3>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {[inmuebleDetalle.ciudad, inmuebleDetalle.direccion]
                    .filter(Boolean)
                    .join(' • ')}
                </p>
              </div>

              <p className="text-xl font-extrabold text-blue-600">
                {formatoCOP(inmuebleDetalle.precio)}
              </p>

              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700">
                <div className="flex items-center gap-1.5">
                  <BedDouble className="w-4 h-4 text-slate-500" />
                  <span>{inmuebleDetalle.habitaciones ?? 0} Hab.</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Bath className="w-4 h-4 text-slate-500" />
                  <span>{inmuebleDetalle.banos ?? 0} Baños</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-slate-500" />
                  <span>{inmuebleDetalle.parqueaderos ?? 0} Parq.</span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setInmuebleDetalle(null)}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}