import { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  Scale,
  Printer,
  Plus,
  CheckCircle2,
  Clock,
  X,
  Loader2,
  TrendingUp,
  BadgeDollarSign,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function CalculadoraFinanzas() {
  const { agencia, perfil, tienePermiso } = useAuth();

  const [tabActiva, setTabActiva] = useState('calculadora'); // 'calculadora' | 'balance'

  // ==================== PESTAÑA 1: CALCULADORA INTERACTIVA ROI ====================
  const [modoOperacion, setModoOperacion] = useState('venta'); // 'venta' | 'arriendo'

  // Parámetros modo Venta
  const [ventaParams, setVentaParams] = useState({
    valorCompra: 380000000,
    mejorasYNotaria: 18000000,
    precioVentaEstimado: 455000000,
    costosCierreYComision: 16000000,
    mesesProyeccion: 12,
  });

  // Parámetros modo Arriendo
  const [arriendoParams, setArriendoParams] = useState({
    valorPropiedad: 350000000,
    canonMensual: 2800000,
    administracionMensual: 320000,
    gastosAnuales: 2900000,
    ocupacionPorcentaje: 95,
  });

  const resultadosRoi = useMemo(() => {
    if (modoOperacion === 'venta') {
      const inversionTotal =
        (Number(ventaParams.valorCompra) || 0) +
        (Number(ventaParams.mejorasYNotaria) || 0);
      const ingresoBruto = Number(ventaParams.precioVentaEstimado) || 0;
      const costosSalida = Number(ventaParams.costosCierreYComision) || 0;
      const utilidadNeta = ingresoBruto - inversionTotal - costosSalida;
      const roiPorcentaje =
        inversionTotal > 0 ? ((utilidadNeta / inversionTotal) * 100).toFixed(2) : '0.00';
      const meses = Math.max(Number(ventaParams.mesesProyeccion) || 12, 1);
      const roiAnualizado = (
        (Number(roiPorcentaje) / meses) *
        12
      ).toFixed(2);

      return {
        inversionTotal,
        ingresoAnual: ingresoBruto,
        utilidadNeta,
        roiPorcentaje,
        roiAnualizado,
      };
    }

    const valorProp = Number(arriendoParams.valorPropiedad) || 0;
    const factorOcupacion = Math.min(
      Math.max((Number(arriendoParams.ocupacionPorcentaje) || 0) / 100, 0),
      1
    );
    const ingresoAnual =
      (Number(arriendoParams.canonMensual) || 0) * 12 * factorOcupacion;
    const adminAnual = (Number(arriendoParams.administracionMensual) || 0) * 12;
    const otrosGastos = Number(arriendoParams.gastosAnuales) || 0;
    const gastosTotales = adminAnual + otrosGastos;
    const utilidadNeta = ingresoAnual - gastosTotales;
    const roiPorcentaje =
      valorProp > 0 ? ((utilidadNeta / valorProp) * 100).toFixed(2) : '0.00';

    return {
      inversionTotal: valorProp,
      ingresoAnual,
      utilidadNeta,
      roiPorcentaje,
      roiAnualizado: roiPorcentaje,
    };
  }, [modoOperacion, ventaParams, arriendoParams]);

  // ==================== PESTAÑA 2: CONTROL DE COMISIONES Y BALANCE ====================
  const [comisiones, setComisiones] = useState([]);
  const [agentes, setAgentes] = useState([]);
  const [inmuebles, setInmuebles] = useState([]);
  const [cargandoBalance, setCargandoBalance] = useState(true);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  const [filtroAgente, setFiltroAgente] = useState('TODOS');
  const [filtroPeriodo, setFiltroPeriodo] = useState('TODOS');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');

  // Modal registrar negocio / comisión
  const [modalNegocioAbierto, setModalNegocioAbierto] = useState(false);
  const [guardandoNegocio, setGuardandoNegocio] = useState(false);
  const [formNegocio, setFormNegocio] = useState({
    codigo_negocio: '',
    inmueble_nombre: '',
    agente_id: '',
    valor_cierre: '',
    porcentaje_agencia: 40,
    estado_liquidacion: 'Pendiente',
    periodo: '2026-11',
  });

  const cargarBalance = async () => {
    if (!agencia?.id) return;
    setCargandoBalance(true);
    try {
      const [resCom, resAg, resInm] = await Promise.all([
        supabase
          .from('comisiones')
          .select('*')
          .eq('agencia_id', agencia.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('perfiles')
          .select('id, nombre_completo')
          .eq('agencia_id', agencia.id)
          .eq('activo', true),
        supabase
          .from('inmuebles')
          .select('id, codigo, titulo')
          .eq('agencia_id', agencia.id),
      ]);

      setComisiones(resCom.error ? [] : resCom.data || []);
      setAgentes(resAg.error ? [] : resAg.data || []);
      setInmuebles(resInm.error ? [] : resInm.data || []);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: `Error al cargar balance: ${err.message}` });
    } finally {
      setCargandoBalance(false);
    }
  };

  useEffect(() => {
    cargarBalance();
  }, [agencia?.id]);

  const periodosDisponibles = useMemo(() => {
    const setPeriodos = new Set(comisiones.map((c) => c.periodo).filter(Boolean));
    setPeriodos.add('2026-11');
    return Array.from(setPeriodos);
  }, [comisiones]);

  const comisionesFiltradas = useMemo(() => {
    return comisiones.filter((item) => {
      if (filtroAgente !== 'TODOS' && item.agente_id !== filtroAgente) {
        return false;
      }
      if (filtroPeriodo !== 'TODOS' && item.periodo !== filtroPeriodo) {
        return false;
      }
      if (
        filtroEstado !== 'TODOS' &&
        (item.estado_liquidacion || '').toLowerCase() !== filtroEstado.toLowerCase()
      ) {
        return false;
      }
      return true;
    });
  }, [comisiones, filtroAgente, filtroPeriodo, filtroEstado]);

  const totalesBalance = useMemo(() => {
    const totalCierres = comisionesFiltradas.reduce(
      (acc, c) => acc + (Number(c.valor_cierre) || 0),
      0
    );
    const totalComisionAgencia = comisionesFiltradas.reduce(
      (acc, c) => acc + (Number(c.comision_agencia) || 0),
      0
    );
    const totalLiquidado = comisionesFiltradas
      .filter((c) => (c.estado_liquidacion || '').toLowerCase() === 'liquidado')
      .reduce((acc, c) => acc + (Number(c.comision_agencia) || 0), 0);

    return { totalCierres, totalComisionAgencia, totalLiquidado };
  }, [comisionesFiltradas]);

  const abrirModalNuevoNegocio = () => {
    const siguienteNum = comisiones.length + 12;
    setFormNegocio({
      codigo_negocio: `Neg-${siguienteNum}`,
      inmueble_nombre: inmuebles[0]?.titulo || '',
      agente_id: perfil?.id || agentes[0]?.id || '',
      valor_cierre: '',
      porcentaje_agencia: 40,
      estado_liquidacion: 'Pendiente',
      periodo: '2026-11',
    });
    setModalNegocioAbierto(true);
  };

  const handleGuardarNegocio = async (e) => {
    e.preventDefault();
    if (!agencia?.id) return;

    setGuardandoNegocio(true);
    setMensaje({ tipo: '', texto: '' });

    try {
      const valorCierreNum = Number(formNegocio.valor_cierre) || 0;
      const pctAgencia = Number(formNegocio.porcentaje_agencia) || 40;
      const comisionCalc = (valorCierreNum * pctAgencia) / 100;

      const agenteObj = agentes.find((a) => a.id === formNegocio.agente_id);
      const nombreAgente =
        agenteObj?.nombre_completo || perfil?.nombre_completo || 'Agente Inmobiliario';

      const { error } = await supabase.from('comisiones').insert({
        agencia_id: agencia.id,
        codigo_negocio: formNegocio.codigo_negocio.trim(),
        inmueble_nombre: formNegocio.inmueble_nombre.trim(),
        agente_id: formNegocio.agente_id || perfil?.id || null,
        agente_nombre: nombreAgente,
        valor_cierre: valorCierreNum,
        porcentaje_agencia: pctAgencia,
        comision_agencia: comisionCalc,
        estado_liquidacion: formNegocio.estado_liquidacion,
        periodo: formNegocio.periodo,
      });

      if (error) throw error;

      setModalNegocioAbierto(false);
      await cargarBalance();
      setMensaje({
        tipo: 'exito',
        texto: `Negocio ${formNegocio.codigo_negocio} registrado en el balance.`,
      });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: `Error al guardar negocio: ${err.message}` });
    } finally {
      setGuardandoNegocio(false);
    }
  };

  const alternarEstadoLiquidacion = async (item) => {
    const nuevoEstado =
      (item.estado_liquidacion || '').toLowerCase() === 'liquidado'
        ? 'Pendiente'
        : 'Liquidado';

    try {
      const { error } = await supabase
        .from('comisiones')
        .update({ estado_liquidacion: nuevoEstado })
        .eq('id', item.id);
      if (error) throw error;
      await cargarBalance();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  };

  const formatoCOP = (val) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(Number(val) || 0);

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calculadora de Finanzas</h1>
          <p className="text-sm text-slate-500 mt-1">
            Evalúa el retorno de inversión (ROI) en venta o arriendo y controla las comisiones y el balance de cierres[cite: 19, 20].
          </p>
        </div>

        {tabActiva === 'balance' && (
          <button
            type="button"
            onClick={abrirModalNuevoNegocio}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2.5 rounded-lg text-xs sm:text-sm transition cursor-pointer self-start"
          >
            <Plus className="w-4 h-4" />
            + Registrar negocio
          </button>
        )}
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

      {/* Pestañas del Módulo 5: Calculadora | Balance */}
      <div className="border-b border-slate-200 flex gap-2">
        <button
          type="button"
          onClick={() => setTabActiva('calculadora')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer ${
            tabActiva === 'calculadora'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calculator className="w-4 h-4" />
          Calculadora
        </button>

        <button
          type="button"
          onClick={() => setTabActiva('balance')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer ${
            tabActiva === 'balance'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Scale className="w-4 h-4" />
          Balance
        </button>
      </div>

      {tabActiva === 'calculadora' ? (
        /* ==================== PESTAÑA 1: CALCULADORA INTERACTIVA ROI ==================== */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
            <h2 className="text-sm font-bold uppercase tracking-wider">
              Calculadora interactiva ROI[cite: 20]
            </h2>
            <span className="text-xs text-slate-400">
              Modo: {modoOperacion === 'venta' ? 'Venta' : 'Arriendo'}[cite: 20]
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {/* Columna Izquierda: Selector Venta / Arriendo + Panel de Parámetros de Entrada */}
            <div className="p-6 space-y-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  Panel de parámetros de entrada[cite: 20]
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setModoOperacion('venta')}
                    className={`py-2.5 px-4 rounded-xl border text-sm font-bold transition cursor-pointer ${
                      modoOperacion === 'venta'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Venta[cite: 20]
                  </button>

                  <button
                    type="button"
                    onClick={() => setModoOperacion('arriendo')}
                    className={`py-2.5 px-4 rounded-xl border text-sm font-bold transition cursor-pointer ${
                      modoOperacion === 'arriendo'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Arriendo[cite: 20]
                  </button>
                </div>
              </div>

              {modoOperacion === 'venta' ? (
                <div className="space-y-3.5 text-sm">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Valor de adquisición / compra (COP)
                    </label>
                    <input
                      type="number"
                      value={ventaParams.valorCompra}
                      onChange={(e) =>
                        setVentaParams({ ...ventaParams, valorCompra: e.target.value })
                      }
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Adecuaciones y escrituración (COP)
                      </label>
                      <input
                        type="number"
                        value={ventaParams.mejorasYNotaria}
                        onChange={(e) =>
                          setVentaParams({
                            ...ventaParams,
                            mejorasYNotaria: e.target.value,
                          })
                        }
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Precio de venta estimado (COP)
                      </label>
                      <input
                        type="number"
                        value={ventaParams.precioVentaEstimado}
                        onChange={(e) =>
                          setVentaParams({
                            ...ventaParams,
                            precioVentaEstimado: e.target.value,
                          })
                        }
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Costos de cierre y comisión (COP)
                      </label>
                      <input
                        type="number"
                        value={ventaParams.costosCierreYComision}
                        onChange={(e) =>
                          setVentaParams({
                            ...ventaParams,
                            costosCierreYComision: e.target.value,
                          })
                        }
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Horizonte estimado (meses)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={ventaParams.mesesProyeccion}
                        onChange={(e) =>
                          setVentaParams({
                            ...ventaParams,
                            mesesProyeccion: e.target.value,
                          })
                        }
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 text-sm">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Valor comercial del inmueble (COP)
                    </label>
                    <input
                      type="number"
                      value={arriendoParams.valorPropiedad}
                      onChange={(e) =>
                        setArriendoParams({
                          ...arriendoParams,
                          valorPropiedad: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Canon mensual estimado (COP)
                      </label>
                      <input
                        type="number"
                        value={arriendoParams.canonMensual}
                        onChange={(e) =>
                          setArriendoParams({
                            ...arriendoParams,
                            canonMensual: e.target.value,
                          })
                        }
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Administración mensual (COP)
                      </label>
                      <input
                        type="number"
                        value={arriendoParams.administracionMensual}
                        onChange={(e) =>
                          setArriendoParams({
                            ...arriendoParams,
                            administracionMensual: e.target.value,
                          })
                        }
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Impuestos / mantenimiento anual (COP)
                      </label>
                      <input
                        type="number"
                        value={arriendoParams.gastosAnuales}
                        onChange={(e) =>
                          setArriendoParams({
                            ...arriendoParams,
                            gastosAnuales: e.target.value,
                          })
                        }
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Ocupación proyectada (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={arriendoParams.ocupacionPorcentaje}
                        onChange={(e) =>
                          setArriendoParams({
                            ...arriendoParams,
                            ocupacionPorcentaje: e.target.value,
                          })
                        }
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Columna Derecha: Resultados y Proyección Financiera + Retorno de Inversión */}
            <div className="p-6 flex flex-col justify-between space-y-6 bg-slate-50/40">
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Resultados y proyección financiera[cite: 20]
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <span className="text-xs text-slate-500 block">
                      Inversión / Base calculada
                    </span>
                    <span className="text-base font-bold text-slate-900 mt-1 block">
                      {formatoCOP(resultadosRoi.inversionTotal)}
                    </span>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <span className="text-xs text-slate-500 block">
                      {modoOperacion === 'venta'
                        ? 'Ingreso bruto por venta'
                        : 'Ingreso anual proyectado'}
                    </span>
                    <span className="text-base font-bold text-slate-900 mt-1 block">
                      {formatoCOP(resultadosRoi.ingresoAnual)}
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      Retorno de inversión[cite: 20]
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      ROI Anualizado: {resultadosRoi.roiAnualizado}%
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <span className="text-xs text-slate-500 block">Utilidad neta</span>
                      <span
                        className={`text-xl font-extrabold ${
                          resultadosRoi.utilidadNeta >= 0
                            ? 'text-slate-900'
                            : 'text-red-600'
                        }`}
                      >
                        {formatoCOP(resultadosRoi.utilidadNeta)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-500 block">ROI Estimado</span>
                      <span
                        className={`text-3xl font-black ${
                          Number(resultadosRoi.roiPorcentaje) >= 0
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }`}
                      >
                        {resultadosRoi.roiPorcentaje}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Exportar PDF[cite: 20]
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ==================== PESTAÑA 2: CONTROL DE COMISIONES Y BALANCE ==================== */
        <div className="space-y-5">
          {/* Resumen numérico superior */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <span className="text-xs font-semibold uppercase text-slate-500 block">
                Valor Cierre Filtrado
              </span>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {formatoCOP(totalesBalance.totalCierres)}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <span className="text-xs font-semibold uppercase text-slate-500 block">
                Comisión Agencia Total
              </span>
              <p className="text-xl font-bold text-blue-700 mt-1">
                {formatoCOP(totalesBalance.totalComisionAgencia)}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <span className="text-xs font-semibold uppercase text-slate-500 block">
                Comisiones Liquidadas
              </span>
              <p className="text-xl font-bold text-emerald-700 mt-1">
                {formatoCOP(totalesBalance.totalLiquidado)}
              </p>
            </div>
          </div>

          {/* Tarjeta Control de Comisiones y Balance de Ventas */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="bg-slate-900 px-6 py-3.5 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <BadgeDollarSign className="w-4 h-4 text-blue-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider">
                  Control de comisiones y balance de ventas[cite: 19]
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                {comisionesFiltradas.length} registro(s)
              </span>
            </div>

            {/* Barra de Filtros: Por agente | Por periodo | Por estado */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Por agente[cite: 19]
                </label>
                <select
                  value={filtroAgente}
                  onChange={(e) => setFiltroAgente(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="TODOS">Todos los agentes</option>
                  {agentes.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.nombre_completo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Por periodo[cite: 19]
                </label>
                <select
                  value={filtroPeriodo}
                  onChange={(e) => setFiltroPeriodo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="TODOS">Todos los periodos</option>
                  {periodosDisponibles.map((per) => (
                    <option key={per} value={per}>
                      {per}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Por estado[cite: 19]
                </label>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="TODOS">Todos los estados</option>
                  <option value="Liquidado">Liquidado</option>
                  <option value="Pendiente">Pendiente</option>
                </select>
              </div>
            </div>

            {cargandoBalance ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="w-7 h-7 animate-spin text-slate-700" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-white border-b border-slate-200 text-xs font-bold text-slate-700 uppercase">
                      <th className="py-3.5 px-4">Cod. Neg[cite: 19]</th>
                      <th className="py-3.5 px-4">Inmueble[cite: 19]</th>
                      <th className="py-3.5 px-4">Agente Captador[cite: 19]</th>
                      <th className="py-3.5 px-4">Valor cierre negocio[cite: 19]</th>
                      <th className="py-3.5 px-4">Comisión Agencia (40%)[cite: 19]</th>
                      <th className="py-3.5 px-4 text-right">Estado liquidado[cite: 19]</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {comisionesFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-xs text-slate-500">
                          No hay negocios registrados en el balance. Haz clic en &quot;+ Registrar negocio&quot; para agregar el primero.
                        </td>
                      </tr>
                    ) : (
                      comisionesFiltradas.map((item) => {
                        const esLiquidado =
                          (item.estado_liquidacion || '').toLowerCase() === 'liquidado';
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-xs">
                              {item.codigo_negocio}
                            </td>
                            <td className="py-3.5 px-4 font-medium text-slate-800">
                              {item.inmueble_nombre}
                            </td>
                            <td className="py-3.5 px-4 text-slate-700 text-xs">
                              {item.agente_nombre}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                              {formatoCOP(item.valor_cierre)}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-blue-700">
                              {formatoCOP(item.comision_agencia)}{' '}
                              <span className="text-[11px] font-normal text-slate-500">
                                ({item.porcentaje_agencia ?? 40}%)
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                disabled={!tienePermiso('comisiones_global')}
                                onClick={() => alternarEstadoLiquidacion(item)}
                                title={
                                  tienePermiso('comisiones_global')
                                    ? 'Cambiar estado de liquidación'
                                    : 'Solo perfiles con alcance global pueden liquidar'
                                }
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition ${
                                  esLiquidado
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                } ${
                                  tienePermiso('comisiones_global')
                                    ? 'cursor-pointer hover:opacity-85'
                                    : 'cursor-default'
                                }`}
                              >
                                {esLiquidado ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    Liquidado
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                    Pendiente
                                  </>
                                )}
                              </button>
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
        </div>
      )}

      {/* Modal Registrar Negocio / Comisión */}
      {modalNegocioAbierto && (
        <div className="fixed inset-0 bg-slate-900/60 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-bold text-sm">Registrar cierre de negocio y comisión</h3>
              <button
                type="button"
                onClick={() => setModalNegocioAbierto(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarNegocio} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cod. Negocio *
                  </label>
                  <input
                    type="text"
                    required
                    value={formNegocio.codigo_negocio}
                    onChange={(e) =>
                      setFormNegocio({ ...formNegocio, codigo_negocio: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Periodo
                  </label>
                  <input
                    type="text"
                    value={formNegocio.periodo}
                    onChange={(e) =>
                      setFormNegocio({ ...formNegocio, periodo: e.target.value })
                    }
                    placeholder="2026-11"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Inmueble *
                </label>
                <input
                  list="lista-inmuebles-comision"
                  required
                  value={formNegocio.inmueble_nombre}
                  onChange={(e) =>
                    setFormNegocio({ ...formNegocio, inmueble_nombre: e.target.value })
                  }
                  placeholder="Ej: Apartamento 302 - Cedritos"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                />
                <datalist id="lista-inmuebles-comision">
                  {inmuebles.map((i) => (
                    <option key={i.id} value={i.titulo} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Agente captador
                </label>
                <select
                  value={formNegocio.agente_id}
                  onChange={(e) =>
                    setFormNegocio({ ...formNegocio, agente_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {agentes.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.nombre_completo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Valor cierre negocio (COP) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formNegocio.valor_cierre}
                    onChange={(e) =>
                      setFormNegocio({ ...formNegocio, valor_cierre: e.target.value })
                    }
                    placeholder="Ej: 15000000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    % Comisión Agencia
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formNegocio.porcentaje_agencia}
                    onChange={(e) =>
                      setFormNegocio({
                        ...formNegocio,
                        porcentaje_agencia: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estado de liquidación
                </label>
                <select
                  value={formNegocio.estado_liquidacion}
                  onChange={(e) =>
                    setFormNegocio({
                      ...formNegocio,
                      estado_liquidacion: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="Liquidado">Liquidado</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNegocioAbierto(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoNegocio}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                >
                  {guardandoNegocio && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Guardar negocio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}