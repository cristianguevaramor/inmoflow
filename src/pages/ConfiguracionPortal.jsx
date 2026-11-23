import { useEffect, useState } from 'react';
import {
  Globe,
  Upload,
  Copy,
  Check,
  ExternalLink,
  Save,
  Loader2,
  Palette,
  Building2,
  Eye,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function ConfiguracionPortal() {
  const { agencia, recargarPerfil } = useAuth();

  const [form, setForm] = useState({
    nombre: '',
    slug: '',
    telefono_contacto: '',
    correo_contacto: '',
    color_primario: '#0F172A',
    color_secundario: '#2563EB',
    texto_banner: '',
    logo_url: '',
  });

  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  useEffect(() => {
    if (agencia) {
      setForm({
        nombre: agencia.nombre || '',
        slug: agencia.slug || '',
        telefono_contacto: agencia.telefono_contacto || '',
        correo_contacto: agencia.correo_contacto || '',
        color_primario: agencia.color_primario || '#0F172A',
        color_secundario: agencia.color_secundario || '#2563EB',
        texto_banner:
          agencia.texto_banner ||
          'Encuentra tu propiedad ideal con asesoría inmobiliaria profesional',
        logo_url: agencia.logo_url || '',
      });
    }
  }, [agencia]);

  const normalizarSlug = (valor) =>
    valor
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const urlPublica = `${window.location.origin}/p/${form.slug || 'mi-agencia'}`;

  const handleSubirLogo = async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo || !agencia?.id) return;

    setSubiendoLogo(true);
    setMensaje({ tipo: '', texto: '' });

    try {
      const extension = archivo.name.split('.').pop();
      const rutaArchivo = `logos/${agencia.id}-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('inmuebles')
        .upload(rutaArchivo, archivo, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from('inmuebles')
        .getPublicUrl(rutaArchivo);

      setForm((prev) => ({ ...prev, logo_url: publicData.publicUrl }));
      setMensaje({
        tipo: 'exito',
        texto:
          'Logo del portal público cargado. Haz clic en "Guardar cambios" para publicarlo.',
      });
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: `No se pudo subir el logo: ${err.message}`,
      });
    } finally {
      setSubiendoLogo(false);
    }
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!agencia?.id) return;

    setGuardando(true);
    setMensaje({ tipo: '', texto: '' });

    try {
      const slugLimpio = normalizarSlug(form.slug);
      if (!slugLimpio) {
        throw new Error('El identificador único (slug) no puede estar vacío.');
      }

      const { error } = await supabase
        .from('agencias')
        .update({
          nombre: form.nombre.trim(),
          slug: slugLimpio,
          telefono_contacto: form.telefono_contacto.trim(),
          correo_contacto: form.correo_contacto.trim(),
          color_primario: form.color_primario,
          color_secundario: form.color_secundario,
          texto_banner: form.texto_banner.trim(),
          logo_url: form.logo_url,
        })
        .eq('id', agencia.id);

      if (error) throw error;

      await recargarPerfil();
      setForm((prev) => ({ ...prev, slug: slugLimpio }));
      setMensaje({
        tipo: 'exito',
        texto:
          'Cambios publicados en el Portal Web Público (/p/' +
          slugLimpio +
          ').',
      });
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: err.message.includes('duplicate')
          ? 'Ese identificador único (slug) ya está en uso por otra agencia.'
          : `Error al guardar configuración: ${err.message}`,
      });
    } finally {
      setGuardando(false);
    }
  };

  const copiarEnlace = async () => {
    await navigator.clipboard.writeText(urlPublica);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Configuración del Portal Web Público
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Personaliza la apariencia, identidad de marca y enlace público visible para tus clientes (no altera el panel administrativo).
        </p>
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

      {/* Bloque Principal: Configuración de Marca y Enlace Único */}
      <form
        onSubmit={handleGuardar}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-white">
            <Globe className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold tracking-wide text-sm uppercase">
              Configuración de Marca y Enlace Único
            </h2>
          </div>
          <span className="text-xs text-slate-400">Vitrina Pública /p/:slug</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Columna Izquierda: Configuración de Identidad */}
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-2 text-slate-800 font-semibold border-b border-slate-100 pb-3">
              <Building2 className="w-4 h-4 text-slate-500" />
              <h3>Configuración de Identidad</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre comercial de la agencia
              </label>
              <input
                type="text"
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Identificador único (Slug URL)
              </label>
              <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-600">
                <span className="bg-slate-100 px-3 py-2 text-xs text-slate-500 border-r border-slate-300">
                  /p/
                </span>
                <input
                  type="text"
                  required
                  value={form.slug}
                  onChange={(e) =>
                    setForm({ ...form, slug: normalizarSlug(e.target.value) })
                  }
                  placeholder="mi-inmobiliaria"
                  className="w-full px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Cargar logo del portal web (PNG / JPG)
              </label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                  {form.logo_url ? (
                    <img
                      src={form.logo_url}
                      alt="Logo portal público"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <Building2 className="w-7 h-7 text-slate-400" />
                  )}
                </div>

                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 cursor-pointer transition">
                  {subiendoLogo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Seleccionar archivo
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleSubirLogo}
                    disabled={subiendoLogo}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Teléfono visible en la web
                </label>
                <input
                  type="text"
                  value={form.telefono_contacto}
                  onChange={(e) =>
                    setForm({ ...form, telefono_contacto: e.target.value })
                  }
                  placeholder="+57 300 000 0000"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Correo visible en la web
                </label>
                <input
                  type="email"
                  value={form.correo_contacto}
                  onChange={(e) =>
                    setForm({ ...form, correo_contacto: e.target.value })
                  }
                  placeholder="contacto@agencia.com"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Columna Derecha: Personalización de Colores y Banner del Portal Público */}
          <div className="p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-slate-800 font-semibold border-b border-slate-100 pb-3">
                <Palette className="w-4 h-4 text-slate-500" />
                <h3>Personalización de Colores del Portal</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Color principal
                  </label>
                  <div className="flex items-center gap-2.5 border border-slate-300 rounded-lg p-1.5">
                    <input
                      type="color"
                      value={form.color_primario}
                      onChange={(e) =>
                        setForm({ ...form, color_primario: e.target.value })
                      }
                      className="w-9 h-9 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <span className="text-xs font-mono text-slate-600 uppercase">
                      {form.color_primario}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Color secundario
                  </label>
                  <div className="flex items-center gap-2.5 border border-slate-300 rounded-lg p-1.5">
                    <input
                      type="color"
                      value={form.color_secundario}
                      onChange={(e) =>
                        setForm({ ...form, color_secundario: e.target.value })
                      }
                      className="w-9 h-9 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <span className="text-xs font-mono text-slate-600 uppercase">
                      {form.color_secundario}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Texto de bienvenida Banner
                </label>
                <textarea
                  rows={3}
                  value={form.texto_banner}
                  onChange={(e) =>
                    setForm({ ...form, texto_banner: e.target.value })
                  }
                  placeholder="Ej: Descubre propiedades exclusivas en Bogotá con asesoría integral"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 outline-none resize-none"
                />
              </div>

              {/* Simulador visual exclusivo del Portal Público */}
              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-[11px] font-medium text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    Simulación del Portal Público (/p/{form.slug || 'slug'})
                  </span>
                  <span className="text-[10px] text-slate-400">Vista cliente</span>
                </div>
                <div
                  style={{ backgroundColor: form.color_primario }}
                  className="p-4 text-white transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {form.logo_url ? (
                        <img
                          src={form.logo_url}
                          alt="Preview"
                          className="w-7 h-7 rounded bg-white object-contain p-0.5"
                        />
                      ) : (
                        <Building2 className="w-5 h-5" />
                      )}
                      <span className="font-bold text-sm">
                        {form.nombre || 'Agencia Inmobiliaria'}
                      </span>
                    </div>
                    <span
                      style={{ backgroundColor: form.color_secundario }}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-md shadow-xs"
                    >
                      Solicitar información
                    </span>
                  </div>
                  <p className="text-xs text-white/90 line-clamp-2">
                    {form.texto_banner ||
                      'Texto de bienvenida del portal inmobiliario'}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={guardando}
                className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition cursor-pointer"
              >
                {guardando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Guardar cambios
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Bloque Inferior: Vista Previa del Enlace y Dominio */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900">
          Vista previa del enlace y dominio
        </h3>
        <p className="text-xs text-slate-500 mt-0.5 mb-4">
          Comparte esta URL con tus clientes o publícala en redes sociales para que exploren tu catálogo público.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-mono text-slate-700 truncate">
            {urlPublica}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={copiarEnlace}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm transition cursor-pointer"
            >
              {copiado ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Enlace copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar enlace</span>
                </>
              )}
            </button>

            <a
              href={`/p/${form.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Abrir portal</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}