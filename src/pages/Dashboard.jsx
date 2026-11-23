import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Kanban,
  FileWarning,
  BadgeDollarSign,
  TrendingUp,
  AlertTriangle,
  Users,
  CalendarClock,
  CheckSquare,
  Square,
  Calculator,
  Filter,
  Loader2,
  PhoneCall,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const PROYECCION_ANUAL_DEFAULT = [
  { mes: 'Ene', ingresos: 14.2, gastos: 8.5 },
  { mes: 'Feb', ingresos: 15.8, gastos: 8.9 },
  { mes: 'Mar', ingresos: 17.1, gastos: 9.4 },
  { mes: 'Abr', ingresos: 16.4, gastos: 9.1 },
  { mes: 'May', ingresos: 18.9, gastos: 9.8 },
  { mes: 'Jun', ingresos: 20.2, gastos: 10.2 },
];

const TAREAS_INICIALES_AGENTE = [
  { id: 1, hora: '10:30 am', titulo: 'Llamar a Sofía (Enviar ficha técnica)', hecha: false },
  { id: 2, hora: '11:00 am', titulo: 'Subir estudio de póliza para Miguel Torres', hecha: true },
  { id: 3, hora: '3:00 pm', titulo: 'Muestra de inmueble Casa Cedritos', hecha: false },
];

export default function Dashboard() {
  const { perfil, agencia, rol, tienePermiso } = useAuth();

  const esRolAdmin =
    tienePermiso('dashboard_global') ||
    rol?.nombre?.toLowerCase().includes('admin') ||
    rol?.nombre?.toLowerCase().includes('gerente');

  const [vistaActiva, setVistaActiva] = useState(esRolAdmin ? 'admin' : 'agente');
  const [filtroEstadoInmueble, setFiltroEstadoInmueble] = useState('TODOS');
  const [cargando, setCargando] = useState(true);

  // Datos reales de la agencia
  const [inmuebles, setInmuebles] = useState([]);
  const [prospectos, setProspectos] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [agentes, setAgentes] = useState([]);

  // Checklist diario del agente
  const [tareasDia, setTareasDia] = useState(TAREAS_INICIALES_AGENTE);

  // Calculadora ROI rápida
  const [roiForm, setRoiForm] = useState({
    valorPropiedad: 350000000,
    rentaMensual: 2800000,
    gastosAnuales: 4200000,
  });

  useEffect(() => {
    setVistaActiva(esRolAdmin ? 'admin' : 'agente');
  }, [esRolAdmin]);

  useEffect(() => {
    const cargarDashboard = async () => {
      if (!agencia?.id) return;
      setCargando(true);

      try {
        const [resInm, resProsp, resCont, resPerfiles] = await Promise.all([
          supabase.from('inmuebles').select('*').eq('agencia_id', agencia.id),
          supabase.from('prospectos').select('*').eq('agencia_id', agencia.id),
          supabase.from('contratos').select('*').eq('agencia_id', agencia.id),
          supabase
            .from('perfiles')
            .select('id, nombre_completo, activo, rol:roles(nombre)')
            .eq('agencia_id', agencia.id),
        ]);

        setInmuebles(resInm.error ? [] : resInm.data || []);
        setProspectos(resProsp.error ? [] : resProsp.data || []);
        setContratos(resCont.error ? [] : resCont.data || []);
        setAgentes(resPerfiles.error ? [] : resPerfiles.data || []);
      } catch (err) {
        console.error('Error cargando métricas del dashboard:', err.message);
      } finally {
        setCargando(false);
      }
    };

    cargarDashboard();
  }, [agencia?.id]);

  // Cálculos ROI
  const calculoRoi = useMemo(() => {
    const valor = Number(roiForm.valorPropiedad) || 0;
    const ingresoAnual = (Number(roiForm.rentaMensual) || 0) * 12;
    const gastos = Number(roiForm.gastosAnuales) || 0;
    const utilidadNeta = ingresoAnual - gastos;
    const roiPorcentaje = valor > 0 ? ((utilidadNeta / valor) * 100).toFixed(2) : '0.00';
    return { ingresoAnual, utilidadNeta, roiPorcentaje };
  }, [roiForm]);

  // Métricas Vista Administrador
  const metricasAdmin = useMemo(() => {
    const listaInm =
      filtroEstadoInmueble === 'TODOS'
        ? inmuebles
        : inmuebles.filter(
            (i) => (i.estado || '').toLowerCase() === filtroEstadoInmueble.toLowerCase()
          );

    const totalActivos = listaInm.length;
    const publicadosWeb = listaInm.filter((i) => i.publicado_web !== false).length;
    const privados = Math.max(totalActivos - publicadosWeb, 0);

    const totalProspectos = prospectos.length;
    const atencionUrgente = prospectos.filter(
      (p) => p.urgente === true || ['negociacion', 'visita', 'estudio'].includes((p.etapa || '').toLowerCase())
    ).length;

    const ahora = new Date();
    const en30Dias = new Date();
    en30Dias.setDate(ahora.getDate() + 30);

    const contratosPorVencer = contratos.filter((c) => {
      if (!c.fecha_fin) return false;
      const fin = new Date(c.fecha_fin);
      return fin >= ahora && fin <= en30Dias;
    }).length;

    const facturacionEstimada =
      prospectos.reduce((acc, p) => acc + (Number(p.comision_estimada) || 0), 0) ||
      listaInm.reduce((acc, i) => acc + (Number(i.precio) || 0) * 0.03, 0);

    const rendimientoAgentes = agentes
      .filter((a) => a.activo !== false)
      .map((ag) => {
        const leadsAg = prospectos.filter((p) => p.agente_id === ag.id).length;
        const inmAg = inmuebles.filter((i) => i.agente_id === ag.id).length;
        const comisionAg = prospectos
          .filter((p) => p.agente_id === ag.id)
          .reduce((sum, p) => sum + (Number(p.comision_estimada) || 0), 0);

        return {
          id: ag.id,
          nombre: ag.nombre_completo,
          rol: ag.rol?.nombre || 'Agente Inmobiliario',
          leads: leadsAg,
          inmuebles: inmAg,
          comision: comisionAg,
        };
      });

    return {
      totalActivos,
      publicadosWeb,
      privados,
      totalProspectos,
      atencionUrgente,
      contratosPorVencer,
      facturacionEstimada,
      rendimientoAgentes,
    };
  }, [inmuebles, prospectos, contratos, agentes, filtroEstadoInmueble]);

  // Métricas Vista Agente Inmobiliario
  const metricasAgente = useMemo(() => {
    const misInmuebles = inmuebles.filter((i) => i.agente_id === perfil?.id);
    const baseInm = misInmuebles.length > 0 ? misInmuebles : inmuebles;

    const publicadas = baseInm.filter((i) => i.publicado_web !== false).length;
    const enPreparacion = baseInm.filter(
      (i) => (i.estado || '').toLowerCase().includes('prepar') || i.publicado_web === false
    ).length;

    const misProspectos = prospectos.filter((p) => p.agente_id === perfil?.id);
    const baseProsp = misProspectos.length > 0 ? misProspectos : prospectos;

    const pendientesLlamarHoy = baseProsp.filter((p) => p.llamada_pendiente_hoy !== false).length;
    const comisionProyectada = baseProsp.reduce(
      (sum, p) => sum + (Number(p.comision_estimada) || 0),
      0
    );

    const columnasLeads = [
      {
        titulo: 'Nuevo prospecto',
        cantidad: baseProsp.filter((p) => (p.etapa || 'nuevo').toLowerCase().includes('nuevo')).length,
        color: 'bg-blue-600',
      },
      {
        titulo: 'Visita / estudio',
        cantidad: baseProsp.filter(
          (p) =>
            (p.etapa || '').toLowerCase().includes('visita') ||
            (p.etapa || '').toLowerCase().includes('estudio')
        ).length,
        color: 'bg-amber-500',
      },
      {
        titulo: 'En borrador / negociación',
        cantidad: baseProsp.filter(
          (p) =>
            (p.etapa || '').toLowerCase().includes('borrador') ||
            (p.etapa || '').toLowerCase().includes('negoci')
        ).length,
        color: 'bg-slate-700',
      },
    ];

    return {
      totalAsignados: baseInm.length,
      publicadas,
      enPreparacion,
      activosSeguimiento: baseProsp.length,
      pendientesLlamarHoy,
      comisionProyectada,
      columnasLeads,
      inmueblesRecientes: baseInm.slice(0, 5),
    };
  }, [inmuebles, prospectos, perfil?.id]);

  const toggleTarea = (id) => {
    setTareasDia((prev) =>
      prev.map((t) => (t.id === id ? { ...t, hecha: !t.hecha } : t))
    );
  };

  const formatoCOP = (valor) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(Number(valor) || 0);

  if (cargando) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-14 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-slate-700" />
        <p className="text-sm text-slate-500">Consolidando indicadores del tablero...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado Superior del Módulo 1 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {vistaActiva === 'admin'
              ? 'Dashboard Administrativo / Gerencia'
              : 'Dashboard Operativo del Agente'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {vistaActiva === 'admin'
              ? 'Supervisión global de inventario, embudo comercial, contratos y rendimiento del equipo.'
              : 'Seguimiento diario de tus inmuebles asignados, prospectos activos, agenda y comisiones.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {vistaActiva === 'admin' && (
            <div className="inline-flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-700">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={filtroEstadoInmueble}
                onChange={(e) => setFiltroEstadoInmueble(e.target.value)}
                className="bg-transparent outline-none cursor-pointer"
              >
                <option value="TODOS">Todos los inmuebles</option>
                <option value="DISPONIBLE">Disponibles</option>
                <option value="ARRENDADO">Arrendados</option>
                <option value="VENDIDO">Vendidos</option>
              </select>
            </div>
          )}

          {/* Selector de vista Admin / Agente */}
          <div className="inline-flex rounded-lg bg-slate-200/80 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setVistaActiva('admin')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                vistaActiva === 'admin'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vista Administrador
            </button>
            <button
              type="button"
              onClick={() => setVistaActiva('agente')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
                vistaActiva === 'agente'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vista Agente
            </button>
          </div>
        </div>
      </div>

      {vistaActiva === 'admin' ? (
        /* ==================== DASHBOARD ADMINISTRADOR / GERENTE ==================== */
        <div className="space-y-6">
          {/* Fila 1: KPIs Ejecutivos y Operativos */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Fila 1 • KPIs Ejecutivos y Operativos
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase">Inventario Total</span>
                  <Building2 className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {metricasAdmin.totalActivos} inmuebles
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  <span className="font-semibold text-emerald-700">
                    {metricasAdmin.publicadosWeb} publicados en web
                  </span>{' '}
                  / {metricasAdmin.privados} privados
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase">Embudo Comercial</span>
                  <Kanban className="w-4 h-4 text-indigo-600" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {metricasAdmin.totalProspectos} procesos
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  <span className="font-semibold text-amber-700">
                    {metricasAdmin.atencionUrgente} requieren atención urgente
                  </span>
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase">Alerta de Contratos</span>
                  <FileWarning className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {metricasAdmin.contratosPorVencer} por vencer
                </p>
                <p className="text-xs text-slate-500 mt-2">En los próximos 30 días</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase">Facturación Global</span>
                  <BadgeDollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {formatoCOP(metricasAdmin.facturacionEstimada)}
                </p>
                <p className="text-xs text-emerald-700 font-medium mt-2">
                  Comisiones estimadas mes actual
                </p>
              </div>
            </div>
          </section>

          {/* Fila 2: Inteligencia de Negocios y Analítica BI */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Fila 2 • Inteligencia de Negocios y Analítica BI
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Gráfico de barras: Ingresos vs Gastos Operativos */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      Ingreso vs. Gastos Operativos (Proyección Anual)
                    </h3>
                    <p className="text-xs text-slate-500">Valores expresados en millones COP</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <span className="inline-flex items-center gap-1.5 text-slate-700">
                      <span className="w-3 h-3 rounded-xs bg-blue-600 inline-block" />
                      Ingresos
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-slate-700">
                      <span className="w-3 h-3 rounded-xs bg-slate-300 inline-block" />
                      Gastos
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-6 gap-3 items-end h-48 pt-4 border-b border-slate-200 pb-2">
                  {PROYECCION_ANUAL_DEFAULT.map((item) => {
                    const maxVal = 24;
                    const hIngreso = Math.min((item.ingresos / maxVal) * 100, 100);
                    const hGasto = Math.min((item.gastos / maxVal) * 100, 100);
                    return (
                      <div key={item.mes} className="flex flex-col items-center h-full justify-end">
                        <div className="w-full flex items-end justify-center gap-1.5 h-36">
                          <div
                            style={{ height: `${hIngreso}%` }}
                            title={`Ingresos ${item.mes}: $${item.ingresos}M`}
                            className="w-4 sm:w-5 bg-blue-600 rounded-t-md transition-all"
                          />
                          <div
                            style={{ height: `${hGasto}%` }}
                            title={`Gastos ${item.mes}: $${item.gastos}M`}
                            className="w-4 sm:w-5 bg-slate-300 rounded-t-md transition-all"
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-600 mt-2">
                          {item.mes}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Widget Calculadora Rápida de ROI */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-base mb-3">
                    <Calculator className="w-4 h-4 text-blue-600" />
                    <h3>Calculadora Rápida de ROI</h3>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">
                        Valor del inmueble (COP)
                      </label>
                      <input
                        type="number"
                        value={roiForm.valorPropiedad}
                        onChange={(e) =>
                          setRoiForm({ ...roiForm, valorPropiedad: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">
                          Renta mensual
                        </label>
                        <input
                          type="number"
                          value={roiForm.rentaMensual}
                          onChange={(e) =>
                            setRoiForm({ ...roiForm, rentaMensual: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">
                          Gastos anuales
                        </label>
                        <input
                          type="number"
                          value={roiForm.gastosAnuales}
                          onChange={(e) =>
                            setRoiForm({ ...roiForm, gastosAnuales: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 block">Retorno neto anual</span>
                    <span className="text-sm font-bold text-slate-800">
                      {formatoCOP(calculoRoi.utilidadNeta)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">ROI Estimado</span>
                    <span className="text-xl font-extrabold text-emerald-600">
                      {calculoRoi.roiPorcentaje}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Fila 3: Supervisión Operativa y Rendimiento de Equipo */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Fila 3 • Supervisión Operativa y Rendimiento de Equipo
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Rendimiento por agente comercial */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4 text-blue-600" />
                  <h3 className="font-bold text-slate-900 text-base">
                    Rendimiento por Agente Comercial
                  </h3>
                </div>

                {metricasAdmin.rendimientoAgentes.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Aún no hay agentes registrados en la agencia.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {metricasAdmin.rendimientoAgentes.map((ag) => (
                      <div
                        key={ag.id}
                        className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{ag.nombre}</p>
                          <p className="text-xs text-slate-500">
                            {ag.leads} leads • {ag.inmuebles} inmuebles
                          </p>
                        </div>
                        <span className="font-bold text-slate-800">
                          {formatoCOP(ag.comision)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Alertas Críticas del Sistema */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <h3 className="font-bold text-slate-900 text-base">
                    Alertas Críticas del Sistema (Priorizadas)
                  </h3>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-red-900">
                        Vencimiento próximo de contrato
                      </p>
                      <p className="text-xs text-red-700 mt-0.5">
                        {metricasAdmin.contratosPorVencer} contrato(s) requieren gestión de renovación en los próximos 30 días.
                      </p>
                    </div>
                    <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-red-100 text-red-800 shrink-0">
                      Urgente
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-amber-900">
                        Prospectos sin seguimiento reciente
                      </p>
                      <p className="text-xs text-amber-800 mt-0.5">
                        {metricasAdmin.atencionUrgente} proceso(s) activos marcados para atención prioritaria.
                      </p>
                    </div>
                    <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">
                      Seguimiento
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        /* ==================== DASHBOARD AGENTE INMOBILIARIO ==================== */
        <div className="space-y-6">
          {/* Fila 1: KPIs Personales y de Rendimiento */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Fila 1 • KPIs Personales y de Rendimiento
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase">Mis Inmuebles</span>
                  <Building2 className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {metricasAgente.totalAsignados} asignados
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  {metricasAgente.publicadas} publicados • {metricasAgente.enPreparacion} en preparación
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase">Mis Prospectos Activos</span>
                  <PhoneCall className="w-4 h-4 text-indigo-600" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {metricasAgente.activosSeguimiento} en seguimiento
                </p>
                <p className="text-xs text-amber-700 font-medium mt-2">
                  {metricasAgente.pendientesLlamarHoy} pendientes por llamar hoy
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase">Mis Visitas Agendadas</span>
                  <CalendarClock className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {tareasDia.length} citas esta semana
                </p>
                <p className="text-xs text-slate-500 mt-2">Próxima cita: Hoy 10:30 am</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase">Comisiones Proyectadas</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {formatoCOP(metricasAgente.comisionProyectada)}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Estimación de clientes en seguimiento/borrador
                </p>
              </div>
            </div>
          </section>

          {/* Fila 2: Gestión Directa Comercial (Kanban Compacto + Agenda) */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Fila 2 • Gestión Directa Comercial (Kanban Compacto + Agenda)
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Minibarras de mis leads */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                <h3 className="font-bold text-slate-900 text-base mb-4">
                  Minibarras de Mis Leads
                </h3>
                <div className="space-y-4">
                  {metricasAgente.columnasLeads.map((col) => (
                    <div key={col.titulo} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span>{col.titulo}</span>
                        <span>{col.cantidad}</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          style={{
                            width: `${Math.min(Math.max(col.cantidad * 18, 12), 100)}%`,
                          }}
                          className={`h-full ${col.color} rounded-full transition-all`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Checklist tareas diarias */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                <h3 className="font-bold text-slate-900 text-base mb-4">
                  Checklist Tareas Diarias
                </h3>
                <div className="space-y-3">
                  {tareasDia.map((tarea) => (
                    <button
                      key={tarea.id}
                      type="button"
                      onClick={() => toggleTarea(tarea.id)}
                      className="w-full text-left flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 border border-slate-100 transition cursor-pointer"
                    >
                      {tarea.hecha ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      )}
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 block">{tarea.hora}</span>
                        <span
                          className={
                            tarea.hecha
                              ? 'line-through text-slate-400'
                              : 'text-slate-600'
                          }
                        >
                          {tarea.titulo}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Fila 3: Inmuebles Asignados Recientes + Calculadora ROI */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Fila 3 • Seguimiento Operativo y Calculadora ROI
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs overflow-x-auto">
                <h3 className="font-bold text-slate-900 text-base mb-4">
                  Mis Inmuebles Asignados Recientes
                </h3>
                {metricasAgente.inmueblesRecientes.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No hay inmuebles registrados aún.
                  </p>
                ) : (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                        <th className="py-2.5 pr-4">Inmueble</th>
                        <th className="py-2.5 px-4">Ubicación</th>
                        <th className="py-2.5 px-4">Estado</th>
                        <th className="py-2.5 pl-4 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {metricasAgente.inmueblesRecientes.map((inm) => (
                        <tr key={inm.id}>
                          <td className="py-3 pr-4 font-semibold text-slate-900">
                            {inm.titulo || inm.nombre || 'Propiedad'}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {inm.ciudad || 'Bogotá'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                              {inm.estado || 'Disponible'}
                            </span>
                          </td>
                          <td className="py-3 pl-4 text-right font-semibold text-slate-800">
                            {formatoCOP(inm.precio)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-base mb-3">
                    <Calculator className="w-4 h-4 text-blue-600" />
                    <h3>Calculadora ROI</h3>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">
                        Valor propiedad (COP)
                      </label>
                      <input
                        type="number"
                        value={roiForm.valorPropiedad}
                        onChange={(e) =>
                          setRoiForm({ ...roiForm, valorPropiedad: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">
                        Canon / Renta mensual estimada
                      </label>
                      <input
                        type="number"
                        value={roiForm.rentaMensual}
                        onChange={(e) =>
                          setRoiForm({ ...roiForm, rentaMensual: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">ROI Anual Proyectado</span>
                  <span className="text-xl font-extrabold text-emerald-600">
                    {calculoRoi.roiPorcentaje}%
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}