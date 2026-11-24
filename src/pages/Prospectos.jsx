import { useEffect, useMemo, useState } from 'react';
import {
  Kanban,
  Plus,
  Search,
  Settings,
  Phone,
  Mail,
  Building2,
  MessageSquare,
  X,
  Send,
  Clock,
  Loader2,
  UserCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const ETAPAS_DEFAULT = [
  { id: 'nuevo', nombre: '1. Nuevo prospecto' },
  { id: 'visita', nombre: '2. Visita / Estudio' },
  { id: 'borrador', nombre: '3. Contrato borrador' },
  { id: 'cerrado', nombre: '4. Cerrado / Firmado' },
];

export default function Prospectos() {
  const { agencia, perfil, recargarPerfil } = useAuth();

  const [etapas, setEtapas] = useState(ETAPAS_DEFAULT);
  const [prospectos, setProspectos] = useState([]);
  const [bitacoras, setBitacoras] = useState([]);
  const [inmuebles, setInmuebles] = useState([]);
  const [agentes, setAgentes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  // Filtros superiores del wireframe
  const [alcanceVista, setAlcanceVista] = useState('TODOS'); // 'TODOS' | 'PROPIOS'
  const [filtroTipo, setFiltroTipo] = useState('TODOS'); // 'TODOS' | 'Venta' | 'Arriendo'
  const [busqueda, setBusqueda] = useState('');

  // Drag & drop
  const [arrastrandoId, setArrastrandoId] = useState(null);

  // Modal Crear Prospecto
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [guardandoProspecto, setGuardandoProspecto] = useState(false);
  const [formProspecto, setFormProspecto] = useState({
    nombre: '',
    telefono: '',
    correo: '',
    tipo_interes: 'Venta',
    inmueble_interes: '',
    etapa: 'nuevo',
    agente_id: '',
    comision_estimada: '',
    notas: '',
  });

  // Panel desplegable Detalle y Bitácora del prospecto
  const [prospectoSeleccionado, setProspectoSeleccionado] = useState(null);
  const [actividadForm, setActividadForm] = useState({
    tipo_actividad: 'Llamada',
    detalle: '',
  });
  const [guardandoBitacora, setGuardandoBitacora] = useState(false);

  // Modal Configurar Etapas del flujo
  const [modalEtapasAbierto, setModalEtapasAbierto] = useState(false);
  const [etapasEditables, setEtapasEditables] = useState(ETAPAS_DEFAULT);
  const [guardandoEtapas, setGuardandoEtapas] = useState(false);

  useEffect(() => {
    if (Array.isArray(agencia?.etapas_kanban) && agencia.etapas_kanban.length > 0) {
      setEtapas(agencia.etapas_kanban);
      setEtapasEditables(agencia.etapas_kanban);
    } else {
      setEtapas(ETAPAS_DEFAULT);
      setEtapasEditables(ETAPAS_DEFAULT);
    }
  }, [agencia?.etapas_kanban]);

  const cargarDatos = async () => {
    if (!agencia?.id) return;
    setCargando(true);
    try {
      const [resProsp, resBit, resInm, resAg] = await Promise.all([
        supabase
          .from('prospectos')
          .select('*, agente:perfiles(id, nombre_completo)')
          .eq('agencia_id', agencia.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('bitacora_prospectos')
          .select('*')
          .eq('agencia_id', agencia.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('inmuebles')
          .select('id, codigo, titulo')
          .eq('agencia_id', agencia.id),
        supabase
          .from('perfiles')
          .select('id, nombre_completo')
          .eq('agencia_id', agencia.id)
          .eq('activo', true),
      ]);

      if (resProsp.error) throw resProsp.error;
      setProspectos(resProsp.data || []);
      setBitacoras(resBit.error ? [] : resBit.data || []);
      setInmuebles(resInm.error ? [] : resInm.data || []);
      setAgentes(resAg.error ? [] : resAg.data || []);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: `Error al cargar prospectos: ${err.message}` });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [agencia?.id]);

  // Prospectos filtrados
  const prospectosFiltrados = useMemo(() => {
    return prospectos.filter((p) => {
      if (alcanceVista === 'PROPIOS' && perfil?.id && p.agente_id !== perfil.id) {
        return false;
      }
      if (
        filtroTipo !== 'TODOS' &&
        (p.tipo_interes || 'Venta').toLowerCase() !== filtroTipo.toLowerCase()
      ) {
        return false;
      }
      const q = busqueda.trim().toLowerCase();
      if (q) {
        const matchNombre = (p.nombre || '').toLowerCase().includes(q);
        const matchTel = (p.telefono || '').toLowerCase().includes(q);
        const matchInm = (p.inmueble_interes || '').toLowerCase().includes(q);
        if (!matchNombre && !matchTel && !matchInm) return false;
      }
      return true;
    });
  }, [prospectos, alcanceVista, perfil?.id, filtroTipo, busqueda]);

  // Abrir modal crear prospecto (opcionalmente preseleccionando columna)
  const abrirModalNuevo = (etapaInicial = etapas[0]?.id || 'nuevo') => {
    setFormProspecto({
      nombre: '',
      telefono: '',
      correo: '',
      tipo_interes: 'Venta',
      inmueble_interes: inmuebles[0]?.titulo || '',
      etapa: etapaInicial,
      agente_id: perfil?.id || agentes[0]?.id || '',
      comision_estimada: '',
      notas: '',
    });
    setModalCrearAbierto(true);
  };

  // Guardar nuevo prospecto y registrar evento inicial
  const handleCrearProspecto = async (e) => {
    e.preventDefault();
    if (!agencia?.id) return;
    setGuardandoProspecto(true);
    setMensaje({ tipo: '', texto: '' });

    try {
      const { data, error } = await supabase
        .from('prospectos')
        .insert({
          agencia_id: agencia.id,
          agente_id: formProspecto.agente_id || perfil?.id || null,
          nombre: formProspecto.nombre.trim(),
          telefono: formProspecto.telefono.trim(),
          correo: formProspecto.correo.trim(),
          tipo_interes: formProspecto.tipo_interes,
          inmueble_interes: formProspecto.inmueble_interes.trim(),
          etapa: formProspecto.etapa,
          comision_estimada: Number(formProspecto.comision_estimada) || 0,
          notas: formProspecto.notas.trim(),
        })
        .select('*, agente:perfiles(id, nombre_completo)')
        .single();

      if (error) throw error;

      await supabase.from('bitacora_prospectos').insert({
        prospecto_id: data.id,
        agencia_id: agencia.id,
        tipo_actividad: 'Sistema',
        detalle: `Prospecto registrado en el embudo (${formProspecto.tipo_interes})${
          formProspecto.inmueble_interes
            ? ` • Interés: ${formProspecto.inmueble_interes}`
            : ''
        }.`,
        autor_nombre: perfil?.nombre_completo || 'Sistema',
      });

      setModalCrearAbierto(false);
      await cargarDatos();
      setMensaje({
        tipo: 'exito',
        texto: `Prospecto "${data.nombre}" agregado al tablero.`,
      });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: `No se pudo crear el prospecto: ${err.message}` });
    } finally {
      setGuardandoProspecto(false);
    }
  };

  // Mover prospecto de etapa (Drag & Drop o selector)
  const moverProspectoEtapa = async (prospectoId, nuevaEtapaId) => {
    const item = prospectos.find((p) => p.id === prospectoId);
    if (!item || item.etapa === nuevaEtapaId) return;

    const nombreEtapa =
      etapas.find((et) => et.id === nuevaEtapaId)?.nombre || nuevaEtapaId;

    // Actualización optimista
    setProspectos((prev) =>
      prev.map((p) => (p.id === prospectoId ? { ...p, etapa: nuevaEtapaId } : p))
    );
    if (prospectoSeleccionado?.id === prospectoId) {
      setProspectoSeleccionado((prev) => (prev ? { ...prev, etapa: nuevaEtapaId } : prev));
    }

    try {
      const { error } = await supabase
        .from('prospectos')
        .update({ etapa: nuevaEtapaId })
        .eq('id', prospectoId);

      if (error) throw error;

      await supabase.from('bitacora_prospectos').insert({
        prospecto_id: prospectoId,
        agencia_id: agencia.id,
        tipo_actividad: 'Sistema',
        detalle: `Etapa actualizada a "${nombreEtapa}".`,
        autor_nombre: perfil?.nombre_completo || 'Agente',
      });

      await cargarDatos();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: `Error al mover tarjeta: ${err.message}` });
      await cargarDatos();
    }
  };

  // Guardar nueva entrada en la bitácora del prospecto
  const handleGuardarBitacora = async (e) => {
    e.preventDefault();
    if (!prospectoSeleccionado?.id || !actividadForm.detalle.trim() || !agencia?.id) return;

    setGuardandoBitacora(true);
    try {
      const { error } = await supabase.from('bitacora_prospectos').insert({
        prospecto_id: prospectoSeleccionado.id,
        agencia_id: agencia.id,
        tipo_actividad: actividadForm.tipo_actividad,
        detalle: actividadForm.detalle.trim(),
        autor_nombre: perfil?.nombre_completo || 'Agente Inmobiliario',
      });

      if (error) throw error;

      setActividadForm({ tipo_actividad: 'Llamada', detalle: '' });
      await cargarDatos();
      setMensaje({ tipo: 'exito', texto: 'Interacción registrada en la bitácora.' });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: `Error al guardar bitácora: ${err.message}` });
    } finally {
      setGuardandoBitacora(false);
    }
  };

  // Guardar etapas personalizadas del flujo
  const handleGuardarEtapas = async (e) => {
    e.preventDefault();
    if (!agencia?.id) return;
    const limpias = etapasEditables
      .filter((et) => et.nombre.trim())
      .map((et, idx) => ({
        id: et.id || `etapa_${idx + 1}`,
        nombre: et.nombre.trim(),
      }));

    if (limpias.length === 0) return;

    setGuardandoEtapas(true);
    try {
      const { error } = await supabase
        .from('agencias')
        .update({ etapas_kanban: limpias })
        .eq('id', agencia.id);

      if (error) throw error;

      setEtapas(limpias);
      await recargarPerfil();
      setModalEtapasAbierto(false);
      setMensaje({ tipo: 'exito', texto: 'Etapas del embudo Kanban actualizadas.' });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: `Error al guardar etapas: ${err.message}` });
    } finally {
      setGuardandoEtapas(false);
    }
  };

  const bitacoraProspectoActual = useMemo(() => {
    if (!prospectoSeleccionado?.id) return [];
    return bitacoras.filter((b) => b.prospecto_id === prospectoSeleccionado.id);
  }, [bitacoras, prospectoSeleccionado?.id]);

  const formatoCOP = (val) =>
    Number(val) > 0
      ? new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        }).format(Number(val))
      : null;

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Prospectos</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestiona oportunidades comerciales en el embudo Kanban, registra interacciones y haz seguimiento.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setEtapasEditables(etapas);
              setModalEtapasAbierto(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            Configuración (Etapas de flujo)
          </button>

          <button
            type="button"
            onClick={() => abrirModalNuevo(etapas[0]?.id || 'nuevo')}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2.5 rounded-lg text-xs sm:text-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + nuevo prospecto
          </button>
        </div>
      </div>

      {mensaje.texto && (
        <div
          className={`p-4 rounded-xl border text-sm font-medium flex items-center justify-between ${
            mensaje.tipo === 'exito'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <span>{mensaje.texto}</span>
          <button
            type="button"
            onClick={() => setMensaje({ tipo: '', texto: '' })}
            className="text-xs underline ml-4 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Barra de Filtros y Búsqueda del Wireframe */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
            Alcance
          </label>
          <select
            value={alcanceVista}
            onChange={(e) => setAlcanceVista(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="TODOS">Todos los agentes</option>
            <option value="PROPIOS">Mis prospectos</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
            Tipo de operación
          </label>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="TODOS">Venta / Arriendo / Todos</option>
            <option value="Venta">Venta</option>
            <option value="Arriendo">Arriendo</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
            Buscar prospecto
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre de cliente, teléfono o inmueble..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Tablero Kanban */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="bg-slate-900 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Kanban className="w-4 h-4 text-blue-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider">
              Tablero Kanban
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            Haz clic en una tarjeta para abrir su detalle y bitácora
          </span>
        </div>

        {cargando ? (
          <div className="p-14 flex justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-slate-700" />
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 bg-slate-50/60">
            {etapas.map((etapa) => {
              const tarjetasColumna = prospectosFiltrados.filter(
                (p) => (p.etapa || etapas[0]?.id) === etapa.id
              );

              return (
                <div
                  key={etapa.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (arrastrandoId) {
                      moverProspectoEtapa(arrastrandoId, etapa.id);
                      setArrastrandoId(null);
                    }
                  }}
                  className="bg-white rounded-xl border border-slate-200 flex flex-col justify-between min-h-[420px] shadow-2xs"
                >
                  <div>
                    {/* Cabecera de Columna con Contador */}
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-xl flex items-center justify-between gap-2">
                      <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                        {etapa.nombre}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800">
                        {tarjetasColumna.length}
                      </span>
                    </div>

                    {/* Tarjetas del Prospecto */}
                    <div className="p-3 space-y-3">
                      {tarjetasColumna.length === 0 ? (
                        <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                          Sin prospectos en esta etapa
                        </div>
                      ) : (
                        tarjetasColumna.map((card) => {
                          const comisionFmt = formatoCOP(card.comision_estimada);
                          const estaSeleccionada = prospectoSeleccionado?.id === card.id;

                          return (
                            <div
                              key={card.id}
                              draggable
                              onDragStart={() => setArrastrandoId(card.id)}
                              onClick={() => setProspectoSeleccionado(card)}
                              className={`p-3.5 rounded-xl border transition cursor-pointer space-y-2.5 ${
                                estaSeleccionada
                                  ? 'border-blue-600 bg-blue-50/30 ring-2 ring-blue-600/20'
                                  : 'border-slate-200 bg-white hover:border-blue-400 hover:shadow-xs'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-bold text-sm text-slate-900 leading-snug">
                                  {card.nombre}
                                </p>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                                  {card.tipo_interes || 'Venta'}
                                </span>
                              </div>

                              {card.telefono && (
                                <p className="text-xs text-slate-600 flex items-center gap-1.5">
                                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  {card.telefono}
                                </p>
                              )}

                              {card.inmueble_interes && (
                                <p className="text-xs text-slate-700 font-medium flex items-start gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                  <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                                  <span className="line-clamp-2">{card.inmueble_interes}</span>
                                </p>
                              )}

                              <div className="pt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500 border-t border-slate-100">
                                <span className="inline-flex items-center gap-1 truncate">
                                  <UserCheck className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">
                                    {card.agente?.nombre_completo || 'Agente'}
                                  </span>
                                </span>
                                {comisionFmt && (
                                  <span className="font-bold text-emerald-700 shrink-0">
                                    {comisionFmt}
                                  </span>
                                )}
                              </div>

                              {/* Selector rápido de etapa */}
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="pt-1"
                              >
                                <select
                                  value={card.etapa || etapas[0]?.id}
                                  onChange={(e) => moverProspectoEtapa(card.id, e.target.value)}
                                  className="w-full text-[11px] px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
                                >
                                  {etapas.map((et) => (
                                    <option key={et.id} value={et.id}>
                                      Mover a: {et.nombre}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Botón + Agregar al pie de cada columna */}
                  <div className="p-3 pt-0">
                    <button
                      type="button"
                      onClick={() => abrirModalNuevo(etapa.id)}
                      className="w-full py-2 px-3 rounded-lg border border-dashed border-slate-300 hover:border-blue-600 hover:bg-blue-50/40 text-xs font-semibold text-slate-700 hover:text-blue-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      + Agregar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ==================== PANEL DESPLEGABLE: DETALLE Y BITÁCORA DEL PROSPECTO ==================== */}
      {prospectoSeleccionado && (
        <div className="bg-white rounded-2xl border-2 border-slate-900 shadow-lg overflow-hidden">
          <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
            <div>
              <h3 className="font-bold text-sm sm:text-base">
                Panel desplegable: Detalle y Bitácora del prospecto
              </h3>
              <p className="text-xs text-slate-400">
                Seguimiento comercial y cronología de interacciones de {prospectoSeleccionado.nombre}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setProspectoSeleccionado(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
              Cerrar
            </button>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Columna Izquierda: Datos del cliente + Inmueble(s) de interés */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1.5">
                  Datos del cliente
                </h4>
                <p className="text-base font-bold text-slate-900">
                  {prospectoSeleccionado.nombre}
                </p>
                {prospectoSeleccionado.telefono && (
                  <p className="text-xs text-slate-700 flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {prospectoSeleccionado.telefono}
                  </p>
                )}
                {prospectoSeleccionado.correo && (
                  <p className="text-xs text-slate-700 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {prospectoSeleccionado.correo}
                  </p>
                )}
                <p className="text-xs text-slate-600">
                  <span className="font-semibold">Operación:</span>{' '}
                  {prospectoSeleccionado.tipo_interes || 'Venta'}
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1.5">
                  Inmueble(s) Interés
                </h4>
                <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                  {prospectoSeleccionado.inmueble_interes || 'Sin inmueble asignado aún'}
                </p>
                {prospectoSeleccionado.notas && (
                  <p className="text-xs text-slate-600 pt-1">
                    {prospectoSeleccionado.notas}
                  </p>
                )}
              </div>
            </div>

            {/* Columna Derecha: Bitácora de interacciones + Historial Cronológico */}
            <div className="lg:col-span-7 space-y-5">
              <form
                onSubmit={handleGuardarBitacora}
                className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                    Bitácora de interacciones y trazabilidad • Nueva nota / Actividad
                  </h4>

                  <select
                    value={actividadForm.tipo_actividad}
                    onChange={(e) =>
                      setActividadForm({
                        ...actividadForm,
                        tipo_actividad: e.target.value,
                      })
                    }
                    className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
                  >
                    <option value="Llamada">Llamada</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Correo">Correo</option>
                  </select>
                </div>

                <textarea
                  rows={2}
                  required
                  value={actividadForm.detalle}
                  onChange={(e) =>
                    setActividadForm({ ...actividadForm, detalle: e.target.value })
                  }
                  placeholder="Escribir detalles de la llamada, acuerdos o compromisos..."
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm bg-white outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                />

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={guardandoBitacora}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    {guardandoBitacora ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Guardar Bitácora
                  </button>
                </div>
              </form>

              {/* Historial Cronológico */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Historial Cronológico
                </h4>

                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl max-h-64 overflow-y-auto">
                  {bitacoraProspectoActual.length === 0 ? (
                    <p className="p-4 text-xs text-slate-500">
                      [{new Date(prospectoSeleccionado.created_at).toLocaleDateString('es-CO')} - Sistema]: Prospecto registrado en el embudo comercial.
                    </p>
                  ) : (
                    bitacoraProspectoActual.map((ev) => (
                      <div key={ev.id} className="p-3 text-xs space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-slate-800">
                            [{new Date(ev.created_at).toLocaleString('es-CO')} -{' '}
                            {ev.autor_nombre || 'Agente'}]
                          </span>
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[10px]">
                            {ev.tipo_actividad}
                          </span>
                        </div>
                        <p className="text-slate-700">{ev.detalle}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL NUEVO PROSPECTO ==================== */}
      {modalCrearAbierto && (
        <div className="fixed inset-0 bg-slate-900/60 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-bold text-sm">Registrar nuevo prospecto</h3>
              <button
                type="button"
                onClick={() => setModalCrearAbierto(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCrearProspecto} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre completo del cliente *
                </label>
                <input
                  type="text"
                  required
                  value={formProspecto.nombre}
                  onChange={(e) =>
                    setFormProspecto({ ...formProspecto, nombre: e.target.value })
                  }
                  placeholder="Ej: Laura Gómez"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Teléfono / WhatsApp *
                  </label>
                  <input
                    type="text"
                    required
                    value={formProspecto.telefono}
                    onChange={(e) =>
                      setFormProspecto({ ...formProspecto, telefono: e.target.value })
                    }
                    placeholder="+57 315 000 0000"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={formProspecto.correo}
                    onChange={(e) =>
                      setFormProspecto({ ...formProspecto, correo: e.target.value })
                    }
                    placeholder="cliente@correo.com"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tipo de operación
                  </label>
                  <select
                    value={formProspecto.tipo_interes}
                    onChange={(e) =>
                      setFormProspecto({ ...formProspecto, tipo_interes: e.target.value })
                    }
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="Venta">Venta</option>
                    <option value="Arriendo">Arriendo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Etapa inicial
                  </label>
                  <select
                    value={formProspecto.etapa}
                    onChange={(e) =>
                      setFormProspecto({ ...formProspecto, etapa: e.target.value })
                    }
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    {etapas.map((et) => (
                      <option key={et.id} value={et.id}>
                        {et.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Inmueble de interés
                </label>
                <input
                  list="lista-inmuebles-prospecto"
                  value={formProspecto.inmueble_interes}
                  onChange={(e) =>
                    setFormProspecto({
                      ...formProspecto,
                      inmueble_interes: e.target.value,
                    })
                  }
                  placeholder="Seleccione o escriba un inmueble"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                />
                <datalist id="lista-inmuebles-prospecto">
                  {inmuebles.map((i) => (
                    <option key={i.id} value={i.titulo} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Agente asignado
                  </label>
                  <select
                    value={formProspecto.agente_id}
                    onChange={(e) =>
                      setFormProspecto({ ...formProspecto, agente_id: e.target.value })
                    }
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
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
                    Comisión estimada (COP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formProspecto.comision_estimada}
                    onChange={(e) =>
                      setFormProspecto({
                        ...formProspecto,
                        comision_estimada: e.target.value,
                      })
                    }
                    placeholder="Ej: 4500000"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalCrearAbierto(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoProspecto}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                >
                  {guardandoProspecto && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Guardar prospecto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL CONFIGURAR ETAPAS DEL FLUJO ==================== */}
      {modalEtapasAbierto && (
        <div className="fixed inset-0 bg-slate-900/60 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-bold text-sm">Personalizar Etapas de Flujo Kanban</h3>
              <button
                type="button"
                onClick={() => setModalEtapasAbierto(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarEtapas} className="p-6 space-y-4">
              <div className="space-y-2.5">
                {etapasEditables.map((et, idx) => (
                  <div key={et.id || idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      value={et.nombre}
                      onChange={(e) => {
                        const copia = [...etapasEditables];
                        copia[idx] = { ...copia[idx], nombre: e.target.value };
                        setEtapasEditables(copia);
                      }}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    {etapasEditables.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setEtapasEditables(etapasEditables.filter((_, i) => i !== idx))
                        }
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  setEtapasEditables([
                    ...etapasEditables,
                    {
                      id: `etapa_${Date.now()}`,
                      nombre: `${etapasEditables.length + 1}. Nueva etapa`,
                    },
                  ])
                }
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar etapa
              </button>

              <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalEtapasAbierto(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoEtapas}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                >
                  {guardandoEtapas && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Guardar etapas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}