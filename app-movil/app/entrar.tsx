import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Isotipo } from '@/componentes/Anillo';
import { Boton } from '@/componentes/Boton';
import { Icono } from '@/componentes/Icono';
import { LogoGoogle } from '@/componentes/LogoGoogle';
import { DEMO, usarSesion } from '@/estado/sesion';
import { color, e, radio } from '@/tema/tokens';
import { familia, texto, titulo } from '@/tema/tipografia';

/**
 * Entrar con un código al correo. Sin contraseñas: una menos que recordar
 * y una menos que recuperar cuando se olvide.
 */
export default function Entrar() {
  const insets = useSafeAreaInsets();
  const { entrarConCorreo, verificarCodigo, entrarConGoogle, entrarComoDemo } = usarSesion();

  const [paso, setPaso] = useState<'correo' | 'codigo'>('correo');
  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [cargandoGoogle, setCargandoGoogle] = useState(false);
  const [cargandoDemo, setCargandoDemo] = useState(false);

  const correoValido = /^\S+@\S+\.\S+$/.test(correo.trim());

  async function comoDemo() {
    setCargandoDemo(true);
    setError(null);
    const r = await entrarComoDemo();
    setCargandoDemo(false);
    if (!r.ok) return setError(r.mensaje);
    router.replace('/');
  }

  async function conGoogle() {
    setCargandoGoogle(true);
    setError(null);
    const r = await entrarConGoogle();
    setCargandoGoogle(false);
    if (!r.ok) return setError(r.mensaje);
    router.replace('/');
  }

  async function pedirCodigo() {
    setCargando(true);
    setError(null);
    const r = await entrarConCorreo(correo);
    setCargando(false);
    if (!r.ok) return setError(r.mensaje);
    setPaso('codigo');
  }

  async function confirmar() {
    setCargando(true);
    setError(null);
    const r = await verificarCodigo(correo, codigo);
    setCargando(false);
    if (!r.ok) return setError(r.mensaje);
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: color.marfil, paddingTop: insets.top }}
    >
      <View style={{ flex: 1, paddingHorizontal: e.e5, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: e.e6 }}>
          <Text style={titulo('h2', { fontSize: 30 })}>La Mesa</Text>
          <Isotipo tamano={24} />
        </View>

        {paso === 'correo' ? (
          <>
            <Text style={titulo('h1')}>Tu mesa,{'\n'}tus momentos</Text>
            <Text style={[texto.b1, { color: color.tinta60, marginTop: e.e3, marginBottom: e.e5 }]}>
              Elige cómo entrar. Si solo vienes a mirar, usa la cuenta de demostración.
            </Text>

            {/* Atajo de la demo: un desconocido tiene que poder pedir sin
                registrarse. Va arriba y como acción principal a propósito. */}
            <View style={s.demo}>
              <Text style={[texto.caption, { color: color.naranjaTexto, letterSpacing: 1.4 }]}>
                DEMO DE PORTAFOLIO
              </Text>
              <Text style={[texto.b2, { color: color.tinta60, marginTop: e.e2 }]}>
                Entra sin registrarte y prueba el pedido completo.
              </Text>
              <Text style={[texto.b2, { color: color.carbon, fontFamily: familia.semibold, marginTop: e.e2 }]}>
                {DEMO.correo} · {DEMO.clave}
              </Text>
              <Boton
                bloque
                cargando={cargandoDemo}
                deshabilitado={cargando || cargandoGoogle}
                estilo={{ marginTop: e.e3 }}
                onPress={comoDemo}
              >
                Entrar como demo
              </Boton>
            </View>

            <Boton
              bloque
              variante="secundario"
              cargando={cargandoGoogle}
              deshabilitado={cargando || cargandoDemo}
              izquierda={<LogoGoogle tamano={18} />}
              estilo={{ marginBottom: e.e4 }}
              onPress={conGoogle}
            >
              Continuar con Google
            </Boton>

            <View style={s.separador}>
              <View style={s.linea} />
              <Text style={[texto.caption, { color: color.tinta40 }]}>o con tu correo</Text>
              <View style={s.linea} />
            </View>

            <View style={[s.campo, error && s.campoError]}>
              <TextInput
                value={correo}
                onChangeText={(t) => {
                  setCorreo(t);
                  setError(null);
                }}
                placeholder="tucorreo@ejemplo.com"
                placeholderTextColor={color.tinta40}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                style={s.entrada}
              />
            </View>

            {error ? <Text style={s.error}>{error}</Text> : null}

            <Boton
              bloque
              cargando={cargando}
              deshabilitado={!correoValido}
              estilo={{ marginTop: e.e4 }}
              onPress={pedirCodigo}
            >
              Enviarme el código
            </Boton>
          </>
        ) : (
          <>
            <Pressable onPress={() => setPaso('correo')} style={{ marginBottom: e.e4, alignSelf: 'flex-start' }} hitSlop={10}>
              <Icono nombre="atras" tamano={20} tono={color.carbon} />
            </Pressable>

            <Text style={titulo('h1', { fontSize: 34 })}>Revisa tu correo</Text>
            <Text style={[texto.b1, { color: color.tinta60, marginTop: e.e3, marginBottom: e.e6 }]}>
              Te enviamos un código de seis dígitos a {correo.trim()}.
            </Text>

            <View style={[s.campo, error && s.campoError]}>
              <TextInput
                value={codigo}
                onChangeText={(t) => {
                  setCodigo(t.replace(/\D/g, '').slice(0, 6));
                  setError(null);
                }}
                placeholder="000000"
                placeholderTextColor={color.tinta40}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                style={[s.entrada, { fontFamily: familia.bold, fontSize: 22, letterSpacing: 8, textAlign: 'center' }]}
              />
            </View>

            {error ? <Text style={s.error}>{error}</Text> : null}

            <Boton
              bloque
              cargando={cargando}
              deshabilitado={codigo.length < 6}
              estilo={{ marginTop: e.e4 }}
              onPress={confirmar}
            >
              Entrar
            </Boton>

            <Pressable onPress={pedirCodigo} style={{ alignSelf: 'center', marginTop: e.e4 }}>
              <Text style={[texto.b2, { color: color.naranjaTexto, fontFamily: familia.semibold }]}>
                Enviar el código otra vez
              </Text>
            </Pressable>
          </>
        )}
      </View>

      <Text style={[texto.caption, { textAlign: 'center', paddingBottom: insets.bottom + e.e5, letterSpacing: 1.6 }]}>
        Donde todo se comparte
      </Text>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  demo: {
    backgroundColor: color.crema,
    borderRadius: radio.r4,
    borderWidth: 1,
    borderColor: color.naranjaSuave,
    padding: e.e4,
    marginBottom: e.e5,
  },
  separador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: e.e3,
    marginBottom: e.e4,
  },
  linea: { flex: 1, height: 1, backgroundColor: color.linea },
  campo: {
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: e.e4,
    borderRadius: radio.r3,
    borderWidth: 1.5,
    borderColor: color.linea,
    backgroundColor: color.blanco,
  },
  campoError: { borderColor: color.rojo },
  entrada: { fontFamily: familia.regular, fontSize: 15, color: color.carbon },
  error: { fontFamily: familia.medium, fontSize: 12, color: color.rojoTexto, marginTop: e.e2 },
});
