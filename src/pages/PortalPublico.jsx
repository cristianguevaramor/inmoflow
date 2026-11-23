import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Building2, Phone, Mail, MapPin, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function PortalPublico() {
  const { slug } = useParams();
  const [agenciaPublica, setAgenciaPublica] = useState(null);
  const [inmuebles, setInmuebles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [noEncontrada, setNoEncontrada] = useState(false);

  useEffect(() => {
    const cargarPortal = async () => {
      setCargando(true);
      setNoEncontrada(false);

      try {
        const { data: agenciaData, error: agenciaError } = await supabase
          .from('agencias')
          .select(
            'id, nombre, slug, logo_url, color_primario, color_secundario, texto_banner, telefono_contacto, correo_contacto'
          )
          .eq('slug', slug)
          .maybeSingle();

        if (agenciaError) throw agenciaError;

        if (!agenciaData) {
          setNoEncontrada(true);
          return;
        }

        setAgenciaPublica(agenciaData);

        const { data: propsData, error: propsError } = await supabase
          .from('inmuebles')
          .select('*')
          .eq('agencia_id', agenciaData.id)
          .order('created_at', { ascending: false });

        if (!propsError) {
          setInmuebles(propsData || []);
        }
      } catch (err) {
        console.error('Error cargando portal público:', err.message);
        setNoEncontrada(true);
      } finally {
        setCargando(false);
      }
    };

    if (slug) {
      cargarPortal();
    }
  }, [slug]);

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-700" />
      </div>
    );
  }

  if (noEncontrada || !agenciaPublica) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Building2 className="w-12 h-12 text-slate-400 mb-3" />
        <h1 className="text-xl font-bold text-slate-900">Portal inmobiliario no encontrado</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-md">
          No existe una agencia registrada con el identificador <span className="font-mono">/p/{slug}</span>.
        </p>
        <Link
          to="/login"
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
        >
          Ir al acceso administrativo
        </Link>
      </div>
    );
  }

  const primario = agenciaPublica.color_primario || '#0F172A';
  const secundario = agenciaPublica.color_secundario || '#2563EB';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Encabezado y Banner del Portal Público */}
      <header style={{ backgroundColor: primario }} className="text-white">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {agenciaPublica.logo_url ? (
              <img
                src={agenciaPublica.logo_url}
                alt={agenciaPublica.nombre}
                className="w-11 h-11 rounded-xl bg-white object-contain p-1"
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold tracking-tight">{agenciaPublica.nombre}</h1>
              <p className="text-xs text-white/75">Portal Inmobiliario Oficial</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-white/90">
            {agenciaPublica.telefono_contacto && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                {agenciaPublica.telefono_contacto}
              </span>
            )}
            {agenciaPublica.correo_contacto && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                {agenciaPublica.correo_contacto}
              </span>
            )}
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-12 border-t border-white/10">
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
              {agenciaPublica.texto_banner ||
                'Encuentra tu próxima propiedad con asesoría profesional'}
            </h2>
            <p className="text-sm sm:text-base text-white/80 mt-3">
              Explora nuestro portafolio disponible y agenda una visita con un asesor de {agenciaPublica.nombre}.
            </p>
          </div>
        </div>
      </header>

      {/* Catálogo Público de Inmuebles */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900">Propiedades disponibles</h3>
          <span className="text-xs font-medium text-slate-500">
            {inmuebles.length} {inmuebles.length === 1 ? 'inmueble' : 'inmuebles'}
          </span>
        </div>

        {inmuebles.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">
              Aún no hay inmuebles publicados en este portal.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Cuando se registren inmuebles en la agencia, aparecerán aquí automáticamente.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {inmuebles.map((item) => (
              <article
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="h-44 bg-slate-200 flex items-center justify-center text-slate-400">
                    <Building2 className="w-10 h-10" />
                  </div>
                  <div className="p-5">
                    <h4 className="font-bold text-slate-900 text-base">
                      {item.titulo || item.nombre || 'Inmueble disponible'}
                    </h4>
                    {(item.ciudad || item.direccion) && (
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        {[item.ciudad, item.direccion].filter(Boolean).join(' • ')}
                      </p>
                    )}
                    {item.precio && (
                      <p style={{ color: primario }} className="text-lg font-bold mt-3">
                        ${Number(item.precio).toLocaleString('es-CO')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="px-5 pb-5">
                  <button
                    type="button"
                    style={{ backgroundColor: secundario }}
                    className="w-full py-2.5 px-4 rounded-lg text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:opacity-95 transition cursor-pointer"
                  >
                    <span>Solicitar información</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Pie de Página Público */}
      <footer className="bg-white border-t border-slate-200 py-6 px-6 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} {agenciaPublica.nombre}. Todos los derechos reservados.</span>
          <span>Impulsado por InmoFlow</span>
        </div>
      </footer>
    </div>
  );
}