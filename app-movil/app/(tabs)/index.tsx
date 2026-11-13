import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Anillo, Isotipo } from '@/componentes/Anillo';
import { Badge } from '@/componentes/Badge';
import { FotoPlato } from '@/componentes/FotoPlato';
import { Icono, IconoCategoria, IconoCategoriaVivo } from '@/componentes/Icono';
import { traerCategorias, traerProductos, traerSede, estaAbierta } from '@/datos/menu';
import { Categoria, Producto, Sede } from '@/datos/tipos';
import { usarCarrito } from '@/estado/carrito';
import { usarSesion } from '@/estado/sesion';
import { color, e, radio, siguienteNivel, sombra } from '@/tema/tokens';
import { familia, texto, titulo } from '@/tema/tipografia';
import { pesos, saludo } from '@/utils/formato';

export default function Inicio() {
  const insets = useSafeAreaInsets();
  const perfil = usarSesion((s) => s.perfil);
  const { modalidad, setModalidad } = usarCarrito();

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [sede, setSede] = useState<Sede | null>(null);
  const [abierta, setAbierta] = useState(true);

  useEffect(() => {
    traerCategorias().then(setCategorias);
    traerProductos().then(setProductos);
    traerSede().then(setSede);
    estaAbierta().then(setAbierta);
  }, []);

  const destacados = productos.filter(
    (p) => p.disponible && (p.badges.includes('popular') || p.badges.includes('exclusivo_app')),
  );
  const avance = siguienteNivel(perfil?.puntos_historicos ?? 0);
  // La promo de hoy es 2x1 en hamburguesas, así que la foto es de esa categoría.
  const promoFoto = productos.find(
    (p) => categoriaSlug(categorias, p.categoria_id) === 'hamburguesas',
  )?.imagen_url;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.marfil }}
      contentContainerStyle={{ paddingTop: insets.top + e.e3, paddingBottom: e.e9 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Cabecera */}
      <View style={s.cabecera}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={titulo('h2', { fontSize: 24 })}>La Mesa</Text>
          <Isotipo tamano={19} />
        </View>
        <Pressable
          onPress={() => router.push('/perfil')}
          accessibilityLabel="Notificaciones"
          style={s.iconoBoton}
        >
          <Icono nombre="notificaciones" tamano={21} tono={color.carbon} />
        </Pressable>
      </View>

      {/* Saludo */}
      <View style={{ paddingHorizontal: e.e4, marginBottom: e.e2 }}>
        <Text style={texto.caption}>
          {saludo()}, {perfil?.nombre ?? 'bienvenido'}
        </Text>
        <Text style={titulo('h1', { marginTop: 6 })}>Tu mesa,{'\n'}tus momentos</Text>
      </View>

      {/* La mesa vista desde arriba: cada categoría es un plato servido */}
      <MesaDeCategorias categorias={categorias} />

      {/* Modalidad */}
      <View style={s.modalidad}>
        {(['recoger', 'domicilio'] as const).map((m) => {
          const activa = modalidad === m;
          return (
            <Pressable
              key={m}
              onPress={() => setModalidad(m)}
              style={[s.modalidadBoton, activa && s.modalidadActiva]}
            >
              <Icono
                nombre={m === 'recoger' ? 'bolsa' : 'moto'}
                tamano={17}
                tono={activa ? color.carbon : color.tinta40}
                grosor={1.9}
              />
              <Text
                style={[
                  s.modalidadTexto,
                  { color: activa ? color.carbon : color.tinta60 },
                ]}
              >
                {m === 'recoger' ? 'Recoger' : 'Domicilio'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={s.lugar}>
        <Icono nombre="ubicacion" tamano={16} grosor={1.9} />
        <Text style={[texto.b2, { color: color.tinta60, flex: 1 }]}>
          {modalidad === 'recoger'
            ? `${sede?.nombre ?? 'La Mesa El Poblado'} · listo en 20 min`
            : 'Calle 10 #43-12, Apto 902 · llega en 35 min'}
        </Text>
      </View>

      {!abierta && (
        <View style={s.cerrado}>
          <Icono nombre="reloj" tamano={18} tono={color.carbon} grosor={1.9} />
          <Text style={[texto.b2, { flex: 1 }]}>
            La Mesa está cerrada ahora. Puedes dejar tu pedido programado para mañana desde las 11:00 a. m.
          </Text>
        </View>
      )}

      <View style={s.separador} />

      {/* Promoción */}
      <Pressable style={s.promo} onPress={() => router.push('/promos')}>
        {promoFoto ? (
          <Image source={{ uri: promoFoto }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}
        {/* Un tinte del naranja de marca, no negro: la foto se ve como parte
            de La Mesa y no como una capa genérica encima de cualquier cosa.
            También es lo que mantiene el texto blanco legible encima. */}
        <View style={[StyleSheet.absoluteFill, s.promoTinte]} />
        <View style={s.promoAnillo} />
        <Badge tipo="exclusivo_app" />
        <Text style={titulo('h2', { fontSize: 30, color: color.blanco, marginTop: e.e3 })}>
          2x1 en Hamburguesas
        </Text>
        <Text style={[texto.b2, { color: 'rgba(255,255,255,0.86)', marginTop: e.e2, maxWidth: '78%' }]}>
          Comparte con quien más quieres. Todos los martes, solo desde la app.
        </Text>
        <View style={s.promoVale}>
          <Icono nombre="reloj" tamano={14} tono={color.blanco} grosor={1.9} />
          <Text style={[texto.b2, { color: color.blanco, fontFamily: familia.semibold }]}>
            Válido hoy hasta las 11:59 p. m.
          </Text>
        </View>
      </Pressable>

      {/* Mesa compartida: la promesa de la marca convertida en función */}
      <Pressable style={s.tarjetaMesa} onPress={() => router.push('/mesa/nueva')}>
        <View style={s.mesaAnilloFondo} />
        <Anillo progreso={1} tamano={62} grosor={3} tono={color.amarillo} pista="rgba(249,198,92,0.2)">
          <View style={{ alignItems: 'center' }}>
            <Text style={titulo('h2', { fontSize: 19, color: color.marfil })}>4</Text>
            <Text style={{ fontFamily: familia.medium, fontSize: 8, letterSpacing: 0.8, color: 'rgba(255,246,237,0.55)' }}>
              SILLAS
            </Text>
          </View>
        </Anillo>
        <View style={{ flex: 1 }}>
          <Text style={titulo('h2', { fontSize: 23, color: color.marfil })}>Abre una mesa</Text>
          <Text style={[texto.b2, { color: 'rgba(255,246,237,0.62)', marginTop: 5 }]}>
            Comparte un código y cada quien pide lo suyo desde su celular. Una sola cuenta, o cada uno la suya.
          </Text>
        </View>
      </Pressable>

      {/* Lo más pedido */}
      <View style={s.encabezadoSeccion}>
        <Text style={titulo('h2', { fontSize: 24 })}>Lo que más piden</Text>
        <Pressable onPress={() => router.push('/menu')}>
          <Text style={[texto.b2, { color: color.naranjaTexto, fontFamily: familia.semibold }]}>
            Ver el menú
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: e.e4, gap: e.e3 }}
      >
        {destacados.map((p) => (
          <Pressable key={p.id} style={{ width: 158 }} onPress={() => router.push(`/producto/${p.id}`)}>
            <FotoPlato url={p.imagen_url} categoria={categoriaSlug(categorias, p.categoria_id)} alto={112} />
            <Text style={[texto.h4, { marginTop: e.e2, fontFamily: familia.semibold, fontSize: 13.5 }]} numberOfLines={2}>
              {p.nombre}
            </Text>
            <Text style={{ fontFamily: familia.semibold, fontSize: 13, color: color.naranjaTexto, marginTop: 2 }}>
              {pesos(p.precio)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Puntos */}
      <Pressable style={s.puntos} onPress={() => router.push('/perfil')}>
        <Anillo progreso={avance?.progreso ?? 1} tamano={66} grosor={5}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: familia.bold, fontSize: 16, color: color.carbon }}>
              {perfil?.puntos ?? 0}
            </Text>
            <Text style={{ fontFamily: familia.medium, fontSize: 8.5, letterSpacing: 0.5, color: color.tinta60 }}>
              PUNTOS
            </Text>
          </View>
        </Anillo>
        <View style={{ flex: 1 }}>
          <Text style={texto.h4}>Nivel {nivelBonito(perfil?.puntos_historicos ?? 0)}</Text>
          <Text style={[texto.b2, { color: color.tinta60, marginTop: 3 }]}>
            {avance
              ? `Te faltan ${avance.faltan} puntos para el siguiente nivel.`
              : 'Estás en el nivel más alto. Gracias por volver.'}
          </Text>
        </View>
        <Icono nombre="flecha" tamano={20} tono={color.tinta40} />
      </Pressable>
    </ScrollView>
  );
}

/**
 * Los platos alrededor de la mesa: navegación y metáfora en el mismo gesto.
 *
 * Se puede girar con el dedo, como se gira una mesa de verdad para acercarse
 * un plato, y al soltar encaja en el más cercano. Y al tocar uno, la mesa gira
 * sola hasta traerlo al frente antes de abrir su categoría — el giro es la
 * confirmación visual de qué se eligió, no un adorno aparte del gesto.
 */
const CENTRO = 165; // la rueda mide 330 × 330
/** Ancho de la etiqueta de cada plato: «Hamburguesas» tiene que caber en una línea */
const ANCHO_PLATO = 96;

function MesaDeCategorias({ categorias }: { categorias: Categoria[] }) {
  const R = 137;
  const giro = useSharedValue(0);
  const anguloPrevio = useSharedValue(0);
  const movimientoReducido = useReducedMotion();

  const n = Math.max(categorias.length, 1);
  const paso = 360 / n;

  const estiloRueda = useAnimatedStyle(() => ({
    transform: [{ rotate: `${giro.value}deg` }],
  }));

  function irAlMenu(categoriaId: string) {
    router.push({ pathname: '/menu', params: { categoria: categoriaId } });
  }

  /**
   * Girar con el dedo. El ángulo se toma respecto al centro de la mesa y se
   * acumula cuadro a cuadro, así el giro sigue al dedo aunque se den varias
   * vueltas seguidas. Al soltar, encaja en el plato más cercano.
   */
  const arrastre = Gesture.Pan()
    // Solo el gesto horizontal gira la mesa. Así un toque llega limpio al
    // plato —que es lo que la mayoría va a hacer— y un deslizamiento
    // vertical sigue desplazando la pantalla en vez de quedarse atrapado.
    .activeOffsetX([-10, 10])
    .failOffsetY([-14, 14])
    .onBegin((ev) => {
      anguloPrevio.value = Math.atan2(ev.y - CENTRO, ev.x - CENTRO);
    })
    .onUpdate((ev) => {
      const actual = Math.atan2(ev.y - CENTRO, ev.x - CENTRO);
      let delta = ((actual - anguloPrevio.value) * 180) / Math.PI;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      giro.value += delta;
      anguloPrevio.value = actual;
    })
    .onEnd((ev) => {
      // Un poco de inercia con la velocidad tangencial del dedo, para que
      // la mesa siga girando un instante como giraría una de verdad.
      const dx = ev.x - CENTRO;
      const dy = ev.y - CENTRO;
      const radio2 = dx * dx + dy * dy;
      const omega =
        radio2 > 400 ? (((dx * ev.velocityY - dy * ev.velocityX) / radio2) * 180) / Math.PI : 0;
      const destino = Math.round((giro.value + omega * 0.12) / paso) * paso;
      giro.value = withTiming(destino, {
        duration: movimientoReducido ? 0 : 420,
        easing: Easing.out(Easing.cubic),
      });
    });

  function girarHacia(indice: number, categoriaId: string) {
    if (movimientoReducido) return irAlMenu(categoriaId);

    const anguloBase = (indice / n) * 360 - 90;
    // Dónde está ese plato ahora mismo, tras giros anteriores.
    const actual = (anguloBase + giro.value) % 360;
    // El giro más corto (por cualquier lado) para dejarlo arriba, al frente.
    let delta = (-90 - actual) % 360;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    // Ya está al frente: nada que girar, no hay que hacer esperar a quien
    // lo tocó a una animación que no vería.
    if (Math.abs(delta) < 0.5) return irAlMenu(categoriaId);

    giro.value = withTiming(
      giro.value + delta,
      { duration: 550, easing: Easing.out(Easing.cubic) },
      (terminado) => {
        if (terminado) runOnJS(irAlMenu)(categoriaId);
      },
    );
  }

  return (
    <GestureDetector gesture={arrastre}>
      <View style={s.mesaMenu}>
        <View style={s.mesaTabla}>
          <Text style={texto.caption}>Sírvete</Text>
          <Text style={titulo('h2', { fontSize: 26, textAlign: 'center', marginTop: 5 })}>
            ¿Por dónde{'\n'}empezamos?
          </Text>
          <Text style={[texto.b2, { color: color.tinta60, marginTop: 8, textAlign: 'center' }]}>
            Gira la mesa o toca un plato
          </Text>
        </View>

        <Animated.View style={[StyleSheet.absoluteFill, estiloRueda]}>
          {categorias.map((c, i) => {
            const angulo = (i / n) * 2 * Math.PI - Math.PI / 2;
            return (
              <PlatoCategoria
                key={c.id}
                categoria={c}
                giro={giro}
                estilo={{
                  left: CENTRO + Math.cos(angulo) * R - ANCHO_PLATO / 2,
                  top: CENTRO + Math.sin(angulo) * R - 30,
                }}
                onPress={() => girarHacia(i, c.id)}
              />
            );
          })}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/**
 * Un plato de la rueda. Gira con la mesa (la posición la mueve el padre),
 * pero contragira sobre sí mismo para que el ícono y el nombre se lean
 * siempre en vertical, nunca de lado ni de cabeza.
 */
function PlatoCategoria({
  categoria,
  giro,
  estilo,
  onPress,
}: {
  categoria: Categoria;
  giro: SharedValue<number>;
  estilo: { left: number; top: number };
  onPress: () => void;
}) {
  const estiloContragiro = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-giro.value}deg` }],
  }));

  // Al tocar, el icono se arma mientras la mesa gira a traerlo al frente:
  // las dos cosas confirman lo mismo, así que ocurren a la vez.
  const [toque, setToque] = useState(0);

  return (
    <Pressable
      onPress={() => {
        setToque((t) => t + 1);
        onPress();
      }}
      style={[s.plato, estilo]}
    >
      <Animated.View style={[s.platoDisco, estiloContragiro]}>
        <IconoCategoriaVivo nombre={categoria.icono as IconoCategoria} toque={toque} />
      </Animated.View>
      <Animated.Text style={[s.platoNombre, estiloContragiro]} numberOfLines={1}>
        {categoria.nombre}
      </Animated.Text>
    </Pressable>
  );
}

function categoriaSlug(categorias: Categoria[], id: string) {
  return categorias.find((c) => c.id === id)?.icono ?? 'hamburguesas';
}

function nivelBonito(puntos: number) {
  if (puntos >= 1500) return 'Oro';
  if (puntos >= 500) return 'Plata';
  return 'Bronce';
}

const s = StyleSheet.create({
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: e.e4,
    paddingBottom: e.e3,
  },
  iconoBoton: {
    marginLeft: 'auto',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },

  mesaMenu: { width: 330, height: 330, alignSelf: 'center', marginTop: e.e2, marginBottom: e.e5 },
  mesaTabla: {
    position: 'absolute',
    left: 62,
    top: 62,
    right: 62,
    bottom: 62,
    borderRadius: 999,
    backgroundColor: '#F0DCC7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: e.e5,
    ...sombra.fuerte,
  },
  plato: { position: 'absolute', width: ANCHO_PLATO, alignItems: 'center' },
  platoDisco: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: color.blanco,
    alignItems: 'center',
    justifyContent: 'center',
    ...sombra.media,
  },
  platoNombre: {
    fontFamily: familia.semibold,
    fontSize: 10.5,
    color: color.carbon,
    textAlign: 'center',
    marginTop: 5,
  },

  modalidad: {
    flexDirection: 'row',
    gap: 4,
    marginHorizontal: e.e4,
    padding: 4,
    borderRadius: radio.r3,
    backgroundColor: color.crema,
  },
  modalidadBoton: {
    flex: 1,
    height: 40,
    borderRadius: radio.r2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalidadActiva: { backgroundColor: color.marfil, ...sombra.suave },
  modalidadTexto: { fontFamily: familia.semibold, fontSize: 13 },

  lugar: { flexDirection: 'row', alignItems: 'center', gap: e.e2, marginHorizontal: e.e4, marginTop: e.e3 },
  cerrado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: e.e3,
    marginHorizontal: e.e4,
    marginTop: e.e3,
    padding: e.e3,
    borderRadius: radio.r3,
    backgroundColor: '#FDF6E4',
  },
  separador: { height: 1, backgroundColor: color.linea, marginHorizontal: e.e4, marginVertical: e.e5 },

  promo: {
    marginHorizontal: e.e4,
    padding: e.e5,
    borderRadius: radio.r4,
    backgroundColor: color.naranja,
    overflow: 'hidden',
    ...sombra.media,
  },
  promoTinte: {
    // Naranja de marca (#F26B1F) semitransparente: la foto se ve como parte
    // de La Mesa, no como una capa genérica, y el texto blanco sigue legible.
    backgroundColor: 'rgba(242,107,31,0.78)',
  },
  promoAnillo: {
    position: 'absolute',
    right: -58,
    top: -46,
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 26,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  promoVale: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: e.e4,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radio.redondo,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },

  tarjetaMesa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: e.e4,
    marginHorizontal: e.e4,
    marginTop: e.e5,
    padding: e.e5,
    borderRadius: radio.r4,
    backgroundColor: color.carbon,
    overflow: 'hidden',
    ...sombra.media,
  },
  mesaAnilloFondo: {
    position: 'absolute',
    right: -70,
    bottom: -70,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 20,
    borderColor: 'rgba(249,198,92,0.14)',
  },

  encabezadoSeccion: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: e.e4,
    marginTop: e.e6,
    marginBottom: e.e3,
  },

  puntos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: e.e4,
    marginHorizontal: e.e4,
    marginTop: e.e5,
    padding: e.e4,
    borderRadius: radio.r4,
    backgroundColor: color.crema,
  },
});
