import { useState } from 'react';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { color, radio } from '@/tema/tokens';

/**
 * Foto del plato, y qué se dibuja cuando no hay foto.
 *
 * El estado sin foto es el que se ve casi siempre: el menú se carga desde el
 * panel y hoy ningún producto tiene imagen. Así que no es un caso raro de
 * error, es la cara habitual de la app, y tiene que estar diseñado como tal.
 *
 * La versión anterior pintaba un degradado a plena saturación con un aro
 * hueco en el centro. Eso es, literalmente, el idioma visual de "la imagen no
 * cargó": un rectángulo de color y un círculo vacío es lo que enseña un
 * navegador cuando algo falla. Daba igual que fuera intencional — se leía
 * como roto.
 *
 * Dos cambios lo arreglan:
 *
 *   1. El fondo se retira. Un tono suave de la familia de la categoría en vez
 *      del color de marca a tope. El bloque deja de gritar y se comporta como
 *      superficie, que es lo que es.
 *   2. El hueco se llena con información. Un trazo que dice qué clase de
 *      plato es. Un dibujo reconocible se lee como decisión; un aro vacío, no.
 *
 * La interfaz del componente no cambia, así que ninguna pantalla que ya lo use
 * necesita tocarse.
 */

type Tejido = {
  /** Fondo de la superficie. Siempre claro: esto va detrás, no delante. */
  fondo: string;
  /** Un punto más de color para el degradado. Muy poca diferencia a propósito. */
  fondoBajo: string;
  /** El trazo del dibujo. Contrasta con el fondo sin llegar a competir. */
  trazo: string;
};

const TEJIDOS: Record<string, Tejido> = {
  hamburguesas: { fondo: '#FDF1DE', fondoBajo: '#F8E3C4', trazo: '#B8480A' },
  parrilla:     { fondo: '#FBE7D9', fondoBajo: '#F4D3BE', trazo: '#A64110' },
  bowls:        { fondo: '#E8F5EF', fondoBajo: '#D3EBE0', trazo: '#1C7A54' },
  bebidas:      { fondo: '#FFF6ED', fondoBajo: '#FBEAD2', trazo: '#A8791C' },
  postres:      { fondo: '#FBEEE1', fondoBajo: '#F5DECB', trazo: '#A65A3C' },
};

/**
 * Los dibujos.
 *
 * Cada uno está trazado dentro de una caja de 100×100 para poder escalarlos
 * con un solo factor. Son de línea y no de relleno: a tamaño de tarjeta un
 * icono macizo pesa demasiado y vuelve a tapar la tarjeta, que es justo lo
 * que estamos quitando.
 */
function Dibujo({ categoria, trazo, lado }: { categoria: string; trazo: string; lado: number }) {
  const grosor = 100 / lado * 2.4; // grosor constante en pantalla, escale como escale
  const comun = {
    stroke: trazo,
    strokeWidth: grosor,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  switch (categoria) {
    case 'parrilla':
      // Una parrilla vista de frente: las barras y el marco.
      return (
        <G {...comun}>
          <Path d="M22 34 H78" />
          <Path d="M22 50 H78" />
          <Path d="M22 66 H78" />
          <Path d="M34 26 V74" />
          <Path d="M50 26 V74" />
          <Path d="M66 26 V74" />
        </G>
      );

    case 'bowls':
      // Un bol: la boca en elipse y el cuerpo colgando de ella.
      return (
        <G {...comun}>
          <Ellipse cx="50" cy="40" rx="28" ry="9" />
          <Path d="M22 40 C22 62 34 72 50 72 C66 72 78 62 78 40" />
          <Path d="M38 52 C44 57 56 57 62 52" />
        </G>
      );

    case 'bebidas':
      // Un vaso que se estrecha, con la línea del líquido dentro.
      return (
        <G {...comun}>
          <Path d="M32 26 H68 L63 74 H37 Z" />
          <Path d="M34 44 H66" />
        </G>
      );

    case 'postres':
      // Una porción con su cobertura.
      return (
        <G {...comun}>
          <Path d="M26 70 L50 30 L74 70 Z" />
          <Path d="M34 56 C40 50 46 60 52 54 C58 48 64 58 66 56" />
        </G>
      );

    case 'hamburguesas':
    default:
      // Pan de arriba, relleno, pan de abajo.
      return (
        <G {...comun}>
          <Path d="M24 42 C24 28 36 22 50 22 C64 22 76 28 76 42" />
          <Path d="M24 52 C32 47 40 57 50 52 C60 47 68 57 76 52" />
          <Path d="M24 64 C24 72 32 76 50 76 C68 76 76 72 76 64" />
        </G>
      );
  }
}

interface Props {
  url?: string | null;
  categoria?: string;
  ancho?: number | `${number}%`;
  alto: number;
  redondez?: number;
  estilo?: ViewStyle;
}

export function FotoPlato({
  url,
  categoria = 'hamburguesas',
  ancho = '100%',
  alto,
  redondez = radio.r3,
  estilo,
}: Props) {
  const tejido = TEJIDOS[categoria] ?? TEJIDOS.hamburguesas;
  const [fallo, setFallo] = useState(false);
  const hayFoto = Boolean(url) && !fallo;

  // El dibujo crece con la tarjeta pero con techo: en una cabecera grande, un
  // icono proporcional acabaría siendo un cartel. Y con suelo, para que en una
  // fila de lista siga siendo reconocible en vez de una mancha.
  const lado = Math.max(28, Math.min(alto * 0.42, 76));

  return (
    <View
      style={[
        {
          width: ancho,
          height: alto,
          borderRadius: redondez,
          overflow: 'hidden',
          backgroundColor: tejido.fondo,
        },
        estilo,
      ]}
    >
      {hayFoto ? (
        <Image
          source={{ uri: url as string }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFallo(true)}
        />
      ) : (
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`f-${categoria}`} x1="0" y1="0" x2="0.6" y2="1">
              <Stop offset="0" stopColor={tejido.fondo} />
              <Stop offset="1" stopColor={tejido.fondoBajo} />
            </LinearGradient>
          </Defs>

          <Rect width="100%" height="100%" fill={`url(#f-${categoria})`} />

          {/*
            Dos círculos muy tenues, medio fuera de encuadre. No se leen como
            formas: rompen la planitud lo justo para que el fondo parezca una
            superficie y no un relleno de color plano.
          */}
          <Circle cx="12%" cy="112%" r={alto * 0.5} fill={tejido.trazo} opacity={0.05} />
          <Circle cx="96%" cy="-14%" r={alto * 0.42} fill={tejido.trazo} opacity={0.045} />
        </Svg>
      )}

      {/*
        El dibujo va en su propia capa y se centra con flexbox, no con
        coordenadas dentro del SVG. Anidar un <Svg> dentro de otro y moverlo
        con `transform` funciona en web pero es frágil en nativo; centrar con
        una vista se comporta igual en iOS, Android y web.
      */}
      {!hayFoto && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Svg width={lado} height={lado} viewBox="0 0 100 100">
            <Dibujo categoria={categoria} trazo={tejido.trazo} lado={lado} />
          </Svg>
        </View>
      )}
    </View>
  );
}
