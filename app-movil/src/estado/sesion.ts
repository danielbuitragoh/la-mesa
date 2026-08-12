import { create } from 'zustand';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { HAY_BACKEND, supabase } from '@/datos/supabase';
import { Perfil } from '@/datos/tipos';
import { usarFavoritos } from './favoritos';

const PERFIL_DEMO: Perfil = {
  id: 'demo',
  nombre: 'Daniel',
  telefono: null,
  avatar_url: null,
  puntos: 1180,
  puntos_historicos: 1180,
};

/**
 * Credenciales del usuario de demostración.
 *
 * Esto es una demo de portafolio: cualquiera que abra la URL tiene que
 * poder pedir sin registrarse ni esperar un correo. Las credenciales van
 * a la vista en la pantalla de entrar a propósito — la cuenta no tiene
 * nada que proteger y RLS impide que vea pedidos de nadie más.
 *
 * En un producto real esto no existiría.
 */
export const DEMO = {
  correo: process.env.EXPO_PUBLIC_DEMO_EMAIL ?? 'demo@lamesa.co',
  clave: process.env.EXPO_PUBLIC_DEMO_PASSWORD ?? 'lamesa2026',
};

interface EstadoSesion {
  cargando: boolean;
  autenticado: boolean;
  perfil: Perfil | null;

  iniciar: () => Promise<void>;
  entrarComoDemo: () => Promise<{ ok: boolean; mensaje: string }>;
  entrarConCorreo: (correo: string) => Promise<{ ok: boolean; mensaje: string }>;
  verificarCodigo: (correo: string, codigo: string) => Promise<{ ok: boolean; mensaje: string }>;
  entrarConGoogle: () => Promise<{ ok: boolean; mensaje: string }>;
  salir: () => Promise<void>;
  refrescarPerfil: () => Promise<void>;
}

export const usarSesion = create<EstadoSesion>((set, get) => ({
  cargando: true,
  autenticado: false,
  perfil: null,

  iniciar: async () => {
    if (!HAY_BACKEND) {
      set({ cargando: false, autenticado: true, perfil: PERFIL_DEMO });
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      set({ autenticado: true });
      await get().refrescarPerfil();
    }
    supabase.auth.onAuthStateChange((_evento, sesion) => {
      set({ autenticado: Boolean(sesion) });
      if (sesion) void get().refrescarPerfil();
      else set({ perfil: null });
    });
    set({ cargando: false });
  },

  /**
   * Entrada directa con la cuenta de demostración. Un solo toque, sin
   * correo de por medio: es lo que hace que un desconocido pueda probar
   * el pedido completo desde el móvil en menos de dos minutos.
   */
  entrarComoDemo: async () => {
    if (!HAY_BACKEND) {
      set({ autenticado: true, perfil: PERFIL_DEMO });
      return { ok: true, mensaje: '' };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: DEMO.correo,
      password: DEMO.clave,
    });
    if (error) {
      console.warn('[La Mesa] no se pudo entrar con la cuenta demo', error);
      return { ok: false, mensaje: 'La cuenta de demostración no está disponible ahora mismo.' };
    }
    await get().refrescarPerfil();
    return { ok: true, mensaje: '' };
  },

  /** Código de seis dígitos al correo: sin contraseñas que recordar */
  entrarConCorreo: async (correo) => {
    if (!HAY_BACKEND) {
      set({ autenticado: true, perfil: PERFIL_DEMO });
      return { ok: true, mensaje: 'Modo demostración: entraste sin código.' };
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: correo.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    return error
      ? { ok: false, mensaje: 'No pudimos enviar el código. Revisa el correo e intenta otra vez.' }
      : { ok: true, mensaje: 'Te enviamos un código de seis dígitos.' };
  },

  verificarCodigo: async (correo, codigo) => {
    if (!HAY_BACKEND) return { ok: true, mensaje: '' };
    const { error } = await supabase.auth.verifyOtp({
      email: correo.trim().toLowerCase(),
      token: codigo.trim(),
      type: 'email',
    });
    if (error) return { ok: false, mensaje: 'Ese código no coincide. Revísalo e intenta de nuevo.' };
    await get().refrescarPerfil();
    return { ok: true, mensaje: '' };
  },

  /**
   * Google real vía Supabase Auth (PKCE): abre el navegador del sistema,
   * la persona confirma su cuenta de Google, y vuelve a la app por el
   * esquema `lamesa://` con un código de un solo uso que se canjea aquí.
   * Requiere que el proyecto de Supabase tenga el proveedor Google activado
   * con sus propias credenciales de Google Cloud (ver README).
   */
  entrarConGoogle: async () => {
    if (!HAY_BACKEND) {
      set({ autenticado: true, perfil: PERFIL_DEMO });
      return { ok: true, mensaje: 'Modo demostración: entraste sin cuenta real.' };
    }

    const redirectTo = Linking.createURL('auth/callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) {
      return { ok: false, mensaje: 'No pudimos abrir el inicio de sesión de Google.' };
    }

    const resultado = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (resultado.type !== 'success' || !resultado.url) {
      return { ok: false, mensaje: 'Se canceló el inicio de sesión con Google.' };
    }

    const { queryParams } = Linking.parse(resultado.url);
    const codigo = typeof queryParams?.code === 'string' ? queryParams.code : null;
    if (!codigo) {
      return { ok: false, mensaje: 'Google no devolvió un código válido. Intenta de nuevo.' };
    }

    const { error: errorSesion } = await supabase.auth.exchangeCodeForSession(codigo);
    if (errorSesion) {
      return { ok: false, mensaje: 'El enlace de Google no se pudo validar. Intenta de nuevo.' };
    }
    await get().refrescarPerfil();
    return { ok: true, mensaje: '' };
  },

  salir: async () => {
    if (HAY_BACKEND) await supabase.auth.signOut();
    set({ autenticado: false, perfil: null });
    // Que el próximo que entre en este teléfono no vea los favoritos de otro.
    usarFavoritos.setState({ ids: [] });
  },

  refrescarPerfil: async () => {
    if (!HAY_BACKEND) return;
    const { data: usuario } = await supabase.auth.getUser();
    if (!usuario.user) return;
    const { data } = await supabase
      .from('perfiles')
      .select('id,nombre,telefono,avatar_url,puntos,puntos_historicos')
      .eq('id', usuario.user.id)
      .single();
    if (data) set({ perfil: data as Perfil, autenticado: true });
  },
}));
