import { useEffect, useMemo, useState } from 'react';
import {
  FolderPlus,
  FolderSearch,
  Archive,
  FileText,
  Upload,
  CheckCircle2,
  History,
  RotateCcw,
  Eye,
  Edit3,
  Trash2,
  Search,
  X,
  Loader2,
  ChevronRight,
  Calendar,
  User,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const TIPOS_DOCUMENTO = [
  'Cédula de arrendatario',
  'Estudios de arrendamiento',
  'Contrato firmado',
  'Inventario del inmueble',
  'Póliza o garantía',
  'Escritura / Certificado de tradición',
];

export default function GestionDocumental() {
  const { agencia, perfil } = useAuth();

  // Subvistas principales: 'crear' | 'consultar' | 'archivados' | 'detalle'
  const [vista, setVista] = useState('consultar');
  const [expedientes, setExpedientes] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  // Catálogos auxiliares para selectores del paso 1
  const [clientesCatalogo, setClientesCatalogo] = useState([]);
  const [inmueblesCatalogo, setInmueblesCatalogo] = useState([]);
  const [contratosCatalogo, setContratosCatalogo] = useState([]);

  // Wizard de creación de expediente (Pasos 1, 2 y 3)
  const [pasoWizard, setPasoWizard] = useState(1);
  const [guardandoWizard, setGuardandoWizard] = useState(false);
  const [expedienteCreadoNum, setExpedienteCreadoNum] = useState('');
  const [expedienteWizardId, setExpedienteWizardId] = useState(null);

  const [formExpediente, setFormExpediente] = useState({
    tipo: 'Contrato de arrendamiento',
    referencia: '',
    cliente_nombre: '',
    inmueble_ref: '',
    contrato_ref: '',
    estado: 'En creación',
    observaciones: '',
  });

  // Carga de documento en Wizard (Paso 2) o en Detalle
  const [archivoDoc, setArchivoDoc] = useState(null);
  const [tipoDocSeleccionado, setTipoDocSeleccionado] = useState(TIPOS_DOCUMENTO[0]);
  const [descripcionDoc, setDescripcionDoc] = useState('');
  const [subiendoDoc, setSubiendoDoc] = useState(false);

  // Filtros de consulta y archivados
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [busquedaArchivados, setBusquedaArchivados] = useState('');
  const [menuAccionId, setMenuAccionId] = useState(null);

  // Expediente seleccionado para vista detalle y pestañas internas
  const [expedienteActual, setExpedienteActual] = useState(null);
  const [tabDetalle, setTabDetalle] = useState('general'); // 'general' | 'documentos' | 'historial'
  const [busquedaDocDetalle, setBusquedaDocDetalle] = useState('');
  const [modalSubirDocAbierto, setModalSubirDocAbierto] = useState(false);

  // Modal de Historial del expediente (estilo Modulo4.6)
  const [modalHistorialExp, setModalHistorialExp] = useState(null);

  const cargarTodo = async () => {
    if (!agencia?.id) return;
    setCargando(true);
    try {
      const [resExp, resDocs, resHist, resProsp, resInm, resCont] = await Promise.all([
        supabase
          .from('expedientes')
          .select('*')
          .eq('agencia_id', agencia.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('documentos_expediente')
          .select('*')
          .eq('agencia_id', agencia.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('historial_expedientes')
          .select('*')
          .eq('agencia_id', agencia.id)
          .order('created_at', { ascending: false }),
        supabase.from('prospectos').select('id, nombre').eq('agencia_id', agencia.id),
        supabase.from('inmuebles').select('id, titulo, direccion').eq('agencia_id', agencia.id),
        supabase.from('contratos').select('id, codigo').eq('agencia_id', agencia.id),
      ]);

      setExpedientes(resExp.error ? [] : resExp.data || []);
      setDocumentos(resDocs.error ? [] : resDocs.data || []);
      setHistorial(resHist.error ? [] : resHist.data || []);
      setClientesCatalogo(resProsp.error ? [] : resProsp.data || []);
      setInmueblesCatalogo(resInm.error ? [] : resInm.data || []);
      setContratosCatalogo(resCont.error ? [] : resCont.data || []);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: `Error al cargar gestión documental: ${err.message}` });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarTodo();
  }, [agencia?.id]);

  // Registrar evento en historial del expediente
  const registrarEventoHistorial = async (expedienteId, titulo, detalle, categoria = 'actualizacion') => {
    if (!agencia?.id || !expedienteId) return;
    await supabase.from('historial_expedientes').insert({
      expediente_id: expedienteId,
      agencia_id: agencia.id,
      titulo,
      detalle,
      categoria,
      usuario_nombre: perfil?.nombre_completo || 'Usuario del sistema',
    });
  };

  // KPIs superiores
  const kpis = useMemo(() => {
    const activos = expedientes.filter((e) => !e.archivado);
    const archivados = expedientes.filter((e) => e.archivado);
    const contratosActivos = activos.filter((e) =>
      (e.tipo || '').toLowerCase().includes('contrato')
    ).length;
    const porCompletar = activos.filter(
      (e) => (e.estado || '').toLowerCase() !== 'completado'
    ).length;

    return {
      totalExpedientes: activos.length,
      contratosActivos,
      porCompletar,
      totalArchivados: archivados.length,
    };
  }, [expedientes]);

  // Generar siguiente número consecutivo de 6 dígitos (ej. 000001)
  const generarSiguienteNumero = () => {
    const siguiente = expedientes.length + 1;
    return String(siguiente).padStart(6, '0');
  };

  // Iniciar asistente de creación
  const iniciarCreacion = () => {
    setPasoWizard(1);
    setExpedienteWizardId(null);
    setExpedienteCreadoNum('');
    setFormExpediente({
      tipo: 'Contrato de arrendamiento',
      referencia: '',
      cliente_nombre: '',
      inmueble_ref: '',
      contrato_ref: '',
      estado: 'En creación',
      observaciones: '',
    });
    setArchivoDoc(null);
    setDescripcionDoc('');
    setVista('crear');
  };

  // Paso 1 -> Guardar expediente base y pasar a Paso 2 (Documentos)
  const handleGuardarPaso1 = async (e) => {
    e.preventDefault();
    if (!agencia?.id) return;
    setGuardandoWizard(true);
    setMensaje({ tipo: '', texto: '' });

    try {
      const numeroGenerado = generarSiguienteNumero();
      const { data, error } = await supabase
        .from('expedientes')
        .insert({
          agencia_id: agencia.id,
          numero_expediente: numeroGenerado,
          tipo: formExpediente.tipo,
          referencia: formExpediente.referencia.trim(),
          cliente_nombre: formExpediente.cliente_nombre.trim(),
          inmueble_ref: formExpediente.inmueble_ref.trim(),
          contrato_ref: formExpediente.contrato_ref.trim(),
          responsable_id: perfil?.id || null,
          responsable_nombre: perfil?.nombre_completo || 'Responsable',
          estado: formExpediente.estado,
          observaciones: formExpediente.observaciones.trim(),
          archivado: false,
        })
        .select()
        .single();

      if (error) throw error;

      setExpedienteWizardId(data.id);
      setExpedienteCreadoNum(data.numero_expediente);
      await registrarEventoHistorial(
        data.id,
        'Expediente creado',
        `Se creó el expediente N° ${data.numero_expediente} (${data.tipo}) en el sistema.`,
        'creacion'
      );

      setPasoWizard(2);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: `No se pudo crear el expediente: ${err.message}` });
    } finally {
      setGuardandoWizard(false);
    }
  };

  // Subir documento a Storage y registrar en documentos_expediente
  const subirDocumentoAExpediente = async (expId) => {
    if (!archivoDoc || !expId || !agencia?.id) return;

    const tamanoMaxBytes = 10 * 1024 * 1024;
    if (archivoDoc.size > tamanoMaxBytes) {
      throw new Error('El archivo supera el límite permitido de 10 MB.');
    }

    const extension = archivoDoc.name.split('.').pop();
    const rutaStorage = `expedientes/${agencia.id}/${expId}-${Date.now()}.${extension}`;

    const { error: upError } = await supabase.storage
      .from('inmuebles')
      .upload(rutaStorage, archivoDoc, { upsert: true });

    let urlPublica = '';
    if (!upError) {
      const { data: pub } = supabase.storage.from('inmuebles').getPublicUrl(rutaStorage);
      urlPublica = pub?.publicUrl || '';
    }

    const { error: dbError } = await supabase.from('documentos_expediente').insert({
      expediente_id: expId,
      agencia_id: agencia.id,
      tipo_documento: tipoDocSeleccionado,
      nombre_archivo: archivoDoc.name,
      archivo_url: urlPublica,
      descripcion: descripcionDoc.trim(),
      estado: 'Recibido',
    });

    if (dbError) throw dbError;

    await registrarEventoHistorial(
      expId,
      `Documento cargado: ${archivoDoc.name}`,
      `Se añadió "${tipoDocSeleccionado}" al expediente.`,
      'documento'
    );
  };

  // Paso 2 -> Guardar documento y avanzar al Paso 3 (Finalizar)
  const handleGuardarPaso2 = async (e) => {
    e.preventDefault();
    if (!expedienteWizardId) return;

    setSubiendoDoc(true);
    setMensaje({ tipo: '', texto: '' });

    try {
      if (archivoDoc) {
        await subirDocumentoAExpediente(expedienteWizardId);
      }
      await cargarTodo();
      setPasoWizard(3);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setSubiendoDoc(false);
    }
  };

  // Finalizar asistente y volver a consultar
  const finalizarAsistente = async () => {
    await cargarTodo();
    setMensaje({
      tipo: 'exito',
      texto: `Expediente N° ${expedienteCreadoNum} registrado correctamente.`,
    });
    setVista('consultar');
  };

  // Abrir vista de detalle de un expediente
  const abrirDetalleExpediente = (exp, pestanaInicial = 'general') => {
    setExpedienteActual(exp);
    setTabDetalle(pestanaInicial);
    setBusquedaDocDetalle('');
    setVista('detalle');
  };

  // Cambiar estado de un expediente
  const cambiarEstadoExpediente = async (exp, nuevoEstado) => {
    try {
      const { error } = await supabase
        .from('expedientes')
        .update({ estado: nuevoEstado })
        .eq('id', exp.id);
      if (error) throw error;

      await registrarEventoHistorial(
        exp.id,
        'Información actualizada',
        `Se modificó el estado del expediente a "${nuevoEstado}".`,
        'actualizacion'
      );

      setExpedienteActual((prev) => (prev ? { ...prev, estado: nuevoEstado } : prev));
      await cargarTodo();
      setMensaje({ tipo: 'exito', texto: `Estado actualizado a "${nuevoEstado}".` });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  };

  // Archivar o restaurar expediente
  const toggleArchivarExpediente = async (exp, archivar) => {
    try {
      const { error } = await supabase
        .from('expedientes')
        .update({
          archivado: archivar,
          fecha_archivo: archivar ? new Date().toISOString() : null,
        })
        .eq('id', exp.id);

      if (error) throw error;

      await registrarEventoHistorial(
        exp.id,
        archivar ? 'Expediente archivado' : 'Expediente restaurado',
        archivar
          ? 'Se envió el expediente al archivo histórico.'
          : 'Se restauró el expediente a la lista activa.',
        'archivo'
      );

      setMenuAccionId(null);
      await cargarTodo();
      setMensaje({
        tipo: 'exito',
        texto: archivar
          ? `Expediente N° ${exp.numero_expediente} archivado.`
          : `Expediente N° ${exp.numero_expediente} restaurado.`,
      });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  };

  // Eliminar expediente
  const eliminarExpediente = async (exp) => {
    try {
      const { error } = await supabase.from('expedientes').delete().eq('id', exp.id);
      if (error) throw error;
      setMenuAccionId(null);
      if (expedienteActual?.id === exp.id) {
        setExpedienteActual(null);
        setVista('consultar');
      }
      await cargarTodo();
      setMensaje({
        tipo: 'exito',
        texto: `Expediente N° ${exp.numero_expediente} eliminado.`,
      });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  };

  // Subir documento desde el modal dentro de Detalle
  const handleSubirDocDesdeDetalle = async (e) => {
    e.preventDefault();
    if (!expedienteActual?.id || !archivoDoc) return;
    setSubiendoDoc(true);
    try {
      await subirDocumentoAExpediente(expedienteActual.id);
      setArchivoDoc(null);
      setDescripcionDoc('');
      setModalSubirDocAbierto(false);
      await cargarTodo();
      setMensaje({ tipo: 'exito', texto: 'Documento adjuntado al expediente.' });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setSubiendoDoc(false);
    }
  };

  // Listas filtradas
  const expedientesActivosFiltrados = useMemo(() => {
    return expedientes
      .filter((e) => !e.archivado)
      .filter((e) => {
        const q = busqueda.toLowerCase();
        const coincideTexto =
          e.numero_expediente?.toLowerCase().includes(q) ||
          e.cliente_nombre?.toLowerCase().includes(q) ||
          e.inmueble_ref?.toLowerCase().includes(q) ||
          e.referencia?.toLowerCase().includes(q);
        const coincideTipo = filtroTipo === 'TODOS' || e.tipo === filtroTipo;
        const coincideEstado = filtroEstado === 'TODOS' || e.estado === filtroEstado;
        return coincideTexto && coincideTipo && coincideEstado;
      });
  }, [expedientes, busqueda, filtroTipo, filtroEstado]);

  const expedientesArchivadosFiltrados = useMemo(() => {
    return expedientes
      .filter((e) => e.archivado)
      .filter((e) => {
        const q = busquedaArchivados.toLowerCase();
        return (
          e.numero_expediente?.toLowerCase().includes(q) ||
          e.cliente_nombre?.toLowerCase().includes(q) ||
          e.inmueble_ref?.toLowerCase().includes(q)
        );
      });
  }, [expedientes, busquedaArchivados]);

  const docsExpedienteActual = useMemo(() => {
    if (!expedienteActual?.id) return [];
    return documentos
      .filter((d) => d.expediente_id === expedienteActual.id)
      .filter((d) => {
        const q = busquedaDocDetalle.toLowerCase();
        return (
          !q ||
          d.tipo_documento?.toLowerCase().includes(q) ||
          d.nombre_archivo?.toLowerCase().includes(q)
        );
      });
  }, [documentos, expedienteActual?.id, busquedaDocDetalle]);

  const historialExpedienteActual = useMemo(() => {
    if (!expedienteActual?.id) return [];
    return historial.filter((h) => h.expediente_id === expedienteActual.id);
  }, [historial, expedienteActual?.id]);

  const badgeEstado = (estado) => {
    const est = (estado || '').toLowerCase();
    if (est.includes('complet')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (est.includes('revisi')) return 'bg-amber-50 text-amber-800 border-amber-200';
    if (est.includes('pendien')) return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Superior */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Control de Gestión Documental</h1>
        <p className="text-sm text-slate-500 mt-1">
          Administra expedientes digitales, carga de documentos soportados, archivo histórico y trazabilidad.
        </p>
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

      {/* Fila Superior de KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <p className="text-2xl font-bold text-slate-900">{kpis.totalExpedientes} expedientes</p>
          <p className="text-xs text-slate-500 mt-1">Expedientes activos en gestión</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <p className="text-2xl font-bold text-slate-900">
            {kpis.contratosActivos} contratos activos
          </p>
          <p className="text-xs text-slate-500 mt-1">Expedientes de tipo contractual</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <p className="text-2xl font-bold text-slate-900">{kpis.porCompletar} por completar</p>
          <p className="text-xs text-slate-500 mt-1">Pendientes de cierre o validación</p>
        </div>
      </div>

      {/* Navegación Lateral Interna + Área Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Menú de acciones del módulo (Creación / Consultar / Archivados) */}
        <div className="lg:col-span-3 space-y-2.5">
          <button
            type="button"
            onClick={iniciarCreacion}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition cursor-pointer ${
              vista === 'crear'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="inline-flex items-center gap-2.5">
              <FolderPlus className="w-4 h-4 text-blue-500" />
              Creación de expedientes
            </span>
            <ChevronRight className="w-4 h-4 opacity-60" />
          </button>

          <button
            type="button"
            onClick={() => setVista('consultar')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition cursor-pointer ${
              vista === 'consultar' || vista === 'detalle'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="inline-flex items-center gap-2.5">
              <FolderSearch className="w-4 h-4 text-blue-500" />
              Consultar expedientes
            </span>
            <ChevronRight className="w-4 h-4 opacity-60" />
          </button>

          <button
            type="button"
            onClick={() => setVista('archivados')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition cursor-pointer ${
              vista === 'archivados'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="inline-flex items-center gap-2.5">
              <Archive className="w-4 h-4 text-blue-500" />
              Expedientes archivados
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
              {kpis.totalArchivados}
            </span>
          </button>
        </div>

        {/* Contenido Principal */}
        <div className="lg:col-span-9">
          {cargando ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-14 flex justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-slate-700" />
            </div>
          ) : vista === 'crear' ? (
            /* ==================== ASISTENTE CREAR EXPEDIENTE (PASOS 1, 2 Y 3) ==================== */
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 text-center">
                  Crear un nuevo expediente
                </h2>

                {/* Indicador de 3 pasos */}
                <div className="flex items-center justify-center gap-4 sm:gap-8 mt-4">
                  {[
                    { num: 1, label: 'Información básica' },
                    { num: 2, label: 'Documentos' },
                    { num: 3, label: 'Finalizar' },
                  ].map((step) => {
                    const activo = pasoWizard === step.num;
                    const completado = pasoWizard > step.num;
                    return (
                      <div key={step.num} className="flex flex-col items-center gap-1">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                            activo
                              ? 'bg-blue-600 text-white border-blue-600'
                              : completado
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-slate-50 text-slate-400 border-slate-300'
                          }`}
                        >
                          {step.num}
                        </div>
                        <span
                          className={`text-xs font-medium ${
                            activo ? 'text-slate-900 font-semibold' : 'text-slate-500'
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PASO 1: INFORMACIÓN BÁSICA */}
              {pasoWizard === 1 && (
                <form onSubmit={handleGuardarPaso1} className="space-y-4 border-t border-slate-100 pt-5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">
                    Datos del expediente
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tipo de expediente *
                      </label>
                      <select
                        required
                        value={formExpediente.tipo}
                        onChange={(e) =>
                          setFormExpediente({ ...formExpediente, tipo: e.target.value })
                        }
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="Contrato de arrendamiento">Contrato de arrendamiento</option>
                        <option value="Compraventa">Compraventa</option>
                        <option value="Inmueble">Inmueble</option>
                        <option value="Cliente">Cliente</option>
                        <option value="Empleado">Empleado</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nombre o referencia *
                      </label>
                      <input
                        type="text"
                        required
                        value={formExpediente.referencia}
                        onChange={(e) =>
                          setFormExpediente({ ...formExpediente, referencia: e.target.value })
                        }
                        placeholder="Ej: Apartamento 302 - Laura Torres"
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Cliente *
                      </label>
                      <input
                        list="lista-clientes-exp"
                        required
                        value={formExpediente.cliente_nombre}
                        onChange={(e) =>
                          setFormExpediente({
                            ...formExpediente,
                            cliente_nombre: e.target.value,
                          })
                        }
                        placeholder="Seleccione o escriba un cliente"
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <datalist id="lista-clientes-exp">
                        {clientesCatalogo.map((c) => (
                          <option key={c.id} value={c.nombre} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Inmueble relacionado *
                      </label>
                      <input
                        list="lista-inmuebles-exp"
                        required
                        value={formExpediente.inmueble_ref}
                        onChange={(e) =>
                          setFormExpediente({ ...formExpediente, inmueble_ref: e.target.value })
                        }
                        placeholder="Ej: Apartamento 302 - Torre 2"
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <datalist id="lista-inmuebles-exp">
                        {inmueblesCatalogo.map((i) => (
                          <option key={i.id} value={i.titulo || i.direccion} />
                        ))}
                      </datalist>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Contrato relacionado
                      </label>
                      <input
                        list="lista-contratos-exp"
                        value={formExpediente.contrato_ref}
                        onChange={(e) =>
                          setFormExpediente({ ...formExpediente, contrato_ref: e.target.value })
                        }
                        placeholder="Ej: CT-2026-012"
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <datalist id="lista-contratos-exp">
                        {contratosCatalogo.map((ct) => (
                          <option key={ct.id} value={ct.codigo} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  {/* Barra de metadatos: Fecha, Responsable, Estado */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-500 block">Fecha de creación</span>
                      <span className="font-semibold text-slate-800">
                        {new Date().toLocaleDateString('es-CO')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Responsable</span>
                      <span className="font-semibold text-slate-800">
                        {perfil?.nombre_completo || 'Usuario actual'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">Estado</span>
                      <select
                        value={formExpediente.estado}
                        onChange={(e) =>
                          setFormExpediente({ ...formExpediente, estado: e.target.value })
                        }
                        className="w-full px-2.5 py-1 border border-slate-300 rounded-md bg-white font-medium text-slate-800"
                      >
                        <option value="En creación">En creación</option>
                        <option value="En revisión">En revisión</option>
                        <option value="Pendiente">Pendiente</option>
                        <option value="Completado">Completado</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Observaciones
                    </label>
                    <textarea
                      rows={3}
                      value={formExpediente.observaciones}
                      onChange={(e) =>
                        setFormExpediente({ ...formExpediente, observaciones: e.target.value })
                      }
                      placeholder="Notas adicionales del expediente..."
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                    />
                  </div>

                  <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setVista('consultar')}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={guardandoWizard}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer"
                    >
                      {guardandoWizard && <Loader2 className="w-4 h-4 animate-spin" />}
                      Siguiente
                    </button>
                  </div>
                </form>
              )}

              {/* PASO 2: CARGA DE DOCUMENTOS */}
              {pasoWizard === 2 && (
                <form onSubmit={handleGuardarPaso2} className="space-y-4 border-t border-slate-100 pt-5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">
                    Carga de documentos
                  </h3>

                  <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-slate-50/60 cursor-pointer transition">
                    <Upload className="w-8 h-8 text-blue-600 mb-2" />
                    <p className="text-sm font-semibold text-slate-800">
                      {archivoDoc
                        ? `Archivo seleccionado: ${archivoDoc.name}`
                        : 'Arrastra un archivo o selecciona'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Formatos permitidos: PDF, PNG, JPG, DOC, DOCX • Máximo 10 MB
                    </p>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      onChange={(e) => setArchivoDoc(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tipo de documento *
                    </label>
                    <select
                      value={tipoDocSeleccionado}
                      onChange={(e) => setTipoDocSeleccionado(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {TIPOS_DOCUMENTO.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Descripción (opcional)
                    </label>
                    <textarea
                      rows={3}
                      value={descripcionDoc}
                      onChange={(e) => setDescripcionDoc(e.target.value)}
                      placeholder="Ingrese una descripción..."
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                    />
                  </div>

                  <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setPasoWizard(3)}
                      className="text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Omitir carga por ahora
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setVista('consultar')}
                        className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={subiendoDoc}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer"
                      >
                        {subiendoDoc && <Loader2 className="w-4 h-4 animate-spin" />}
                        Guardar
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* PASO 3: CONFIRMACIÓN Y FINALIZAR */}
              {pasoWizard === 3 && (
                <div className="py-8 flex flex-col items-center text-center space-y-4 border-t border-slate-100">
                  <CheckCircle2 className="w-16 h-16 text-emerald-600" />
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 max-w-md">
                    <p className="text-sm font-semibold text-slate-800">
                      El expediente fue creado correctamente con el número
                    </p>
                    <p className="text-2xl font-extrabold text-blue-600 tracking-wider mt-1">
                      {expedienteCreadoNum}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={finalizarAsistente}
                    className="px-6 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold cursor-pointer"
                  >
                    FINALIZAR
                  </button>
                </div>
              )}
            </div>
          ) : vista === 'detalle' && expedienteActual ? (
            /* ==================== VISTA DETALLE DE EXPEDIENTE ==================== */
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <button
                    type="button"
                    onClick={() => setVista('consultar')}
                    className="text-xs font-medium text-blue-600 hover:underline mb-1 block cursor-pointer"
                  >
                    ← Volver a la lista de expedientes
                  </button>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900">
                      Expediente N° {expedienteActual.numero_expediente}
                    </h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeEstado(
                        expedienteActual.estado
                      )}`}
                    >
                      {expedienteActual.estado}
                    </span>
                  </div>
                </div>

                <select
                  value={expedienteActual.estado}
                  onChange={(e) => cambiarEstadoExpediente(expedienteActual, e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium bg-white"
                >
                  <option value="En creación">En creación</option>
                  <option value="En revisión">En revisión</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Completado">Completado</option>
                </select>
              </div>

              {/* Pestañas: Información general | Documentos (N) | Historial */}
              <div className="flex gap-2 border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setTabDetalle('general')}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 cursor-pointer ${
                    tabDetalle === 'general'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Información general
                </button>
                <button
                  type="button"
                  onClick={() => setTabDetalle('documentos')}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 cursor-pointer ${
                    tabDetalle === 'documentos'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Documentos ({docsExpedienteActual.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTabDetalle('historial')}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 cursor-pointer ${
                    tabDetalle === 'historial'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Historial
                </button>
              </div>

              {/* Tarjeta Datos de expedientes */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1.5">
                  <p>
                    <span className="text-slate-500">Tipo:</span>{' '}
                    <strong className="text-slate-900">{expedienteActual.tipo}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Cliente:</span>{' '}
                    <strong className="text-slate-900">{expedienteActual.cliente_nombre}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Inmueble:</span>{' '}
                    <strong className="text-slate-900">
                      {expedienteActual.inmueble_ref || '—'}
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Contrato:</span>{' '}
                    <strong className="text-slate-900">
                      {expedienteActual.contrato_ref || '—'}
                    </strong>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <p>
                    <span className="text-slate-500">Fecha de creación:</span>{' '}
                    <strong className="text-slate-900">
                      {new Date(expedienteActual.created_at).toLocaleDateString('es-CO')}
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Responsable:</span>{' '}
                    <strong className="text-slate-900">
                      {expedienteActual.responsable_nombre || 'Responsable'}
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Observaciones:</span>{' '}
                    <span className="text-slate-700">
                      {expedienteActual.observaciones || 'Sin observaciones'}
                    </span>
                  </p>
                </div>
              </div>

              {tabDetalle === 'historial' ? (
                <div className="space-y-3">
                  {historialExpedienteActual.length === 0 ? (
                    <p className="text-sm text-slate-500">No hay eventos registrados aún.</p>
                  ) : (
                    historialExpedienteActual.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-4 text-sm"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{ev.titulo}</p>
                          <p className="text-xs text-slate-500">{ev.detalle}</p>
                        </div>
                        <div className="text-right text-xs text-slate-500 shrink-0">
                          <span className="block font-medium text-slate-700">
                            {new Date(ev.created_at).toLocaleString('es-CO')}
                          </span>
                          <span>{ev.usuario_nombre}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* Sección Documentos asociados */
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="text-base font-bold text-slate-900">Documentos asociados</h3>
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={busquedaDocDetalle}
                          onChange={(e) => setBusquedaDocDetalle(e.target.value)}
                          placeholder="Buscar..."
                          className="pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setModalSubirDocAbierto(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        + Cargar documentos
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                          <th className="py-3 px-4">Documentos</th>
                          <th className="py-3 px-4">Estado</th>
                          <th className="py-3 px-4">Fecha</th>
                          <th className="py-3 px-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {docsExpedienteActual.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-500 text-xs">
                              No hay documentos cargados en este expediente.
                            </td>
                          </tr>
                        ) : (
                          docsExpedienteActual.map((doc) => (
                            <tr key={doc.id} className="hover:bg-slate-50/70">
                              <td className="py-3 px-4">
                                <p className="font-semibold text-slate-900">
                                  {doc.tipo_documento}
                                </p>
                                <p className="text-xs text-slate-500">{doc.nombre_archivo}</p>
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${badgeEstado(
                                    doc.estado
                                  )}`}
                                >
                                  {doc.estado}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-600">
                                {new Date(doc.created_at).toLocaleDateString('es-CO')}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {doc.archivo_url ? (
                                  <a
                                    href={doc.archivo_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-medium text-slate-700"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    Ver
                                  </a>
                                ) : (
                                  <span className="text-xs text-slate-400">Registrado</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : vista === 'archivados' ? (
            /* ==================== EXPEDIENTES ARCHIVADOS ==================== */
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Expedientes archivados</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Consulta y recuperación de expedientes históricos
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={busquedaArchivados}
                    onChange={(e) => setBusquedaArchivados(e.target.value)}
                    placeholder="Buscar por cliente, inmueble o número..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="w-24 h-24 rounded-full border-2 border-slate-300 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">
                    Total
                  </span>
                  <span className="text-2xl font-bold text-slate-900">
                    {kpis.totalArchivados}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                      <th className="py-3 px-4">N° Expediente</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Fecha de Archivo</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {expedientesArchivadosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                          No hay expedientes archivados.
                        </td>
                      </tr>
                    ) : (
                      expedientesArchivadosFiltrados.map((exp) => (
                        <tr key={exp.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {exp.numero_expediente}
                          </td>
                          <td className="py-3 px-4 text-slate-700">{exp.cliente_nombre}</td>
                          <td className="py-3 px-4 text-slate-600">{exp.tipo}</td>
                          <td className="py-3 px-4 text-xs text-slate-600">
                            {exp.fecha_archivo
                              ? new Date(exp.fecha_archivo).toLocaleDateString('es-CO')
                              : new Date(exp.created_at).toLocaleDateString('es-CO')}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => abrirDetalleExpediente(exp, 'general')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-medium text-slate-700 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Consulta
                              </button>
                              <button
                                type="button"
                                onClick={() => setModalHistorialExp(exp)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-medium text-slate-700 cursor-pointer"
                              >
                                <History className="w-3.5 h-3.5" />
                                Historial
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleArchivarExpediente(exp, false)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-xs font-semibold text-emerald-700 cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Restaurar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ==================== LISTA DE EXPEDIENTES (CONSULTAR) ==================== */
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
              <h2 className="text-lg font-bold text-slate-900">Lista de expedientes</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium bg-white outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="TODOS">Todos los tipos</option>
                  <option value="Contrato de arrendamiento">Contrato de arrendamiento</option>
                  <option value="Compraventa">Compraventa</option>
                  <option value="Inmueble">Inmueble</option>
                  <option value="Cliente">Cliente</option>
                  <option value="Empleado">Empleado</option>
                </select>

                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium bg-white outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="TODOS">Todos los estados</option>
                  <option value="En creación">En creación</option>
                  <option value="En revisión">En revisión</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Completado">Completado</option>
                </select>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                      <th className="py-3 px-4">N° expediente</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Inmueble</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {expedientesActivosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-500 text-xs">
                          No hay expedientes registrados. Haz clic en &quot;Creación de expedientes&quot; para registrar el primero.
                        </td>
                      </tr>
                    ) : (
                      expedientesActivosFiltrados.map((exp) => (
                        <tr key={exp.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <button
                              type="button"
                              onClick={() => abrirDetalleExpediente(exp, 'general')}
                              className="hover:text-blue-600 underline-offset-2 hover:underline cursor-pointer"
                            >
                              {exp.numero_expediente}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-slate-700 text-xs">{exp.tipo}</td>
                          <td className="py-3 px-4 text-slate-800 font-medium">
                            {exp.cliente_nombre}
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-xs">
                            {exp.inmueble_ref || '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${badgeEstado(
                                exp.estado
                              )}`}
                            >
                              {exp.estado}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600">
                            {new Date(exp.created_at).toLocaleDateString('es-CO')}
                          </td>
                          <td className="py-3 px-4 text-right relative">
                            <button
                              type="button"
                              onClick={() =>
                                setMenuAccionId(menuAccionId === exp.id ? null : exp.id)
                              }
                              className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
                            >
                              ⋮
                            </button>

                            {menuAccionId === exp.id && (
                              <div className="absolute right-4 mt-1 w-48 bg-white rounded-xl border border-slate-200 shadow-lg z-20 py-1 text-left text-xs">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuAccionId(null);
                                    abrirDetalleExpediente(exp, 'general');
                                  }}
                                  className="w-full px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                                  Ver / Editar expediente
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuAccionId(null);
                                    setModalHistorialExp(exp);
                                  }}
                                  className="w-full px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer"
                                >
                                  <History className="w-3.5 h-3.5 text-indigo-600" />
                                  Historial de expediente
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleArchivarExpediente(exp, true)}
                                  className="w-full px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-amber-700 cursor-pointer"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                  Archivar expediente
                                </button>
                                <button
                                  type="button"
                                  onClick={() => eliminarExpediente(exp)}
                                  className="w-full px-3.5 py-2 hover:bg-red-50 flex items-center gap-2 text-red-700 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Eliminar expediente
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: + Cargar documentos desde Detalle */}
      {modalSubirDocAbierto && expedienteActual && (
        <div className="fixed inset-0 bg-slate-900/60 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-semibold text-sm">
                Cargar documento • Expediente N° {expedienteActual.numero_expediente}
              </h3>
              <button
                type="button"
                onClick={() => setModalSubirDocAbierto(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubirDocDesdeDetalle} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tipo de documento *
                </label>
                <select
                  value={tipoDocSeleccionado}
                  onChange={(e) => setTipoDocSeleccionado(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {TIPOS_DOCUMENTO.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Archivo (PDF, PNG, JPG, DOC, DOCX) *
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={(e) => setArchivoDoc(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  rows={2}
                  value={descripcionDoc}
                  onChange={(e) => setDescripcionDoc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalSubirDocAbierto(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={subiendoDoc}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                >
                  {subiendoDoc && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Historial del expediente */}
      {modalHistorialExp && (
        <div className="fixed inset-0 bg-slate-900/60 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-sm">Historial del expediente</h3>
                  <p className="text-[11px] text-slate-400">
                    Registro de actividades y cambios realizados
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalHistorialExp(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="bg-slate-900 text-white rounded-xl p-4">
                <p className="font-bold text-sm tracking-wide">
                  EXPEDIENTE N° {modalHistorialExp.numero_expediente}
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  Cliente: {modalHistorialExp.cliente_nombre} | Inmueble:{' '}
                  {modalHistorialExp.inmueble_ref || 'No asignado'}
                </p>
              </div>

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
                {historial
                  .filter((h) => h.expediente_id === modalHistorialExp.id)
                  .map((ev) => (
                    <div
                      key={ev.id}
                      className="p-4 flex items-start justify-between gap-4 text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{ev.titulo}</p>
                        <p className="text-slate-600 mt-0.5">{ev.detalle}</p>
                      </div>
                      <div className="text-right text-slate-500 shrink-0 space-y-1">
                        <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(ev.created_at).toLocaleString('es-CO')}
                        </span>
                        <span className="flex items-center justify-end gap-1">
                          <User className="w-3.5 h-3.5" />
                          {ev.usuario_nombre || 'Responsable'}
                        </span>
                      </div>
                    </div>
                  ))}

                {historial.filter((h) => h.expediente_id === modalHistorialExp.id).length ===
                  0 && (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Expediente creado el{' '}
                    {new Date(modalHistorialExp.created_at).toLocaleDateString('es-CO')} por{' '}
                    {modalHistorialExp.responsable_nombre || 'usuario autorizado'}.
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setModalHistorialExp(null)}
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