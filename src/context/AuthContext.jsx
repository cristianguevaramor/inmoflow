import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);

  const cargarPerfilCompleto = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select(`
          id,
          nombre_completo,
          telefono,
          activo,
          agencia:agencias (
            id,
            nombre,
            slug,
            logo_url,
            color_primario,
            telefono_contacto,
            correo_contacto
          ),
          rol:roles (
            id,
            nombre,
            permisos
          )
        `)
        .eq('id', userId)
        .single();

      if (error) throw error;
      setPerfil(data);
    } catch (err) {
      console.error('Error al cargar el perfil operativo:', err.message);
      setPerfil(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        cargarPerfilCompleto(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true);
        cargarPerfilCompleto(session.user.id);
      } else {
        setPerfil(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const iniciarSesion = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPerfil(null);
  };

  const tienePermiso = (clavePermiso) => {
    if (!perfil?.activo || !perfil?.rol?.permisos) return false;
    return Boolean(perfil.rol.permisos[clavePermiso]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        perfil,
        agencia: perfil?.agencia || null,
        rol: perfil?.rol || null,
        loading,
        iniciarSesion,
        cerrarSesion,
        tienePermiso,
        recargarPerfil: () => user && cargarPerfilCompleto(user.id),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);