import { ReactNode } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { color, e, radio } from '@/tema/tokens';
import { familia, titulo } from '@/tema/tipografia';

/**
 * La app es de teléfono. Abierta en un portátil se estiraba a todo el
 * ancho y dejaba de parecer lo que es: en pantallas anchas se enseña
 * dentro de un marco del tamaño de un teléfono, con una nota al lado que
 * dice qué se está viendo. En el teléfono —nativo o web— no cambia nada.
 */

const ANCHO_TELEFONO = 412;
const ALTO_MAXIMO = 880;
const DESDE = 760;

const REPOSITORIO = 'https://github.com/danielbuitragoh/la-mesa';

export function MarcoEscritorio({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();

  if (Platform.OS !== 'web' || width < DESDE) return <>{children}</>;

  const alto = Math.min(height - 48, ALTO_MAXIMO);
  const cabeNota = width >= 1040;

  return (
    <View style={s.fondo}>
      {cabeNota && (
        <View style={s.nota}>
          <Text style={[titulo('h1'), s.marca]}>La Mesa</Text>
          <Text style={s.lema}>Donde todo se comparte</Text>
          <Text style={s.parrafo}>
            Esta es la app del cliente, tal como corre en el teléfono. Gira la mesa, arma un pedido
            y sigue su estado: habla con la misma base de datos que el panel de cocina.
          </Text>
          <View style={s.enlaces}>
            <Enlace texto="Abrir el panel de cocina" a="../panel/panel-admin.html?demo" />
            <Enlace texto="Ver el código" a={REPOSITORIO} />
          </View>
          <Text style={s.pie}>Proyecto de portafolio · marca ficticia · el pago es simulado</Text>
        </View>
      )}

      <View style={[s.telefono, { height: alto }]}>{children}</View>
    </View>
  );
}

function Enlace({ texto, a }: { texto: string; a: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => Linking.openURL(a)}
      style={(estado) => [s.enlace, (estado as { hovered?: boolean }).hovered && s.enlaceEncima]}
    >
      <Text style={s.enlaceTexto}>{texto}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fondo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 72,
    backgroundColor: color.carbon,
    paddingHorizontal: e.e6,
  },
  nota: { width: 360 },
  marca: { color: color.marfil, fontSize: 52, lineHeight: 58 },
  lema: {
    fontFamily: familia.medium,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: color.amarillo,
    marginTop: e.e2,
  },
  parrafo: {
    fontFamily: familia.regular,
    fontSize: 15,
    lineHeight: 24,
    color: 'rgba(255,246,237,0.78)',
    marginTop: e.e5,
  },
  enlaces: { flexDirection: 'row', flexWrap: 'wrap', gap: e.e3, marginTop: e.e6 },
  enlace: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radio.r3,
    borderWidth: 1,
    borderColor: 'rgba(255,246,237,0.28)',
  },
  enlaceEncima: { backgroundColor: 'rgba(255,246,237,0.08)', borderColor: 'rgba(255,246,237,0.5)' },
  enlaceTexto: { fontFamily: familia.semibold, fontSize: 13, color: color.marfil },
  pie: {
    fontFamily: familia.regular,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,246,237,0.5)',
    marginTop: e.e6,
  },
  telefono: {
    width: ANCHO_TELEFONO,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: color.marfil,
    borderWidth: 8,
    borderColor: '#0C0C0C',
    boxShadow: '0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,246,237,0.12)',
  },
});
