import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Avatar } from '@/componentes/Avatar';
import { Boton } from '@/componentes/Boton';
import { FotoPlato } from '@/componentes/FotoPlato';
import { traerMisPedidos } from '@/datos/pedidos';
import { Pedido } from '@/datos/tipos';
import { color, e, radio, sombra } from '@/tema/tokens';
import { texto, titulo } from '@/tema/tipografia';
import { fechaLarga } from '@/utils/formato';

/** Momentos de ejemplo mientras el cliente no tenga historial propio */
const SEMILLA = [
  {
    id: 's1',
    titulo: 'La mesa del viernes',
    fecha: 'Viernes 24 de julio',
    categoria: 'parrilla',
    gente: ['Daniel', 'Sara', 'Tomás', 'Vale'],
    nota: 'Punta de anca, dos limonadas y el brownie de siempre.',
  },
  {
    id: 's2',
    titulo: 'Almuerzo con Sara',
    fecha: 'Martes 14 de julio',
    categoria: 'bowls',
    gente: ['Daniel', 'Sara'],
    nota: 'Dos bowls y café. Cuarenta minutos que valieron.',
  },
  {
    id: 's3',
    titulo: 'Tu primer pedido',
    fecha: 'Sábado 4 de julio',
    categoria: 'hamburguesas',
    gente: ['Daniel'],
    nota: 'La Clásica de la Casa. Así empezó todo.',
  },
];

/**
 * De qué categoría es un momento, a partir de lo que se pidió.
 *
 * Antes todas las tarjetas de pedidos reales decían 'hamburguesas', así que
 * salían todas del mismo color aunque el pedido fuera otra cosa. El color de
 * la tarjeta es lo primero que se ve: si no dice la verdad, mejor que no
 * pretenda decir nada.
 *
 * Se mira el nombre de los platos porque es lo que trae el pedido. El día que
 * `pedido_items` incluya la categoría de verdad, esto se cambia por ese dato
 * y se borra el mapa.
 */
const PALABRAS: Record<string, string[]> = {
  parrilla: ['anca', 'churrasco', 'costilla', 'lomo', 'carne', 'parrilla', 'pollo'],
  bowls: ['bowl', 'ensalada', 'poke', 'verde'],
  bebidas: ['limonada', 'jugo', 'café', 'cafe', 'gaseosa', 'agua', 'malteada', 'cerveza'],
  postres: ['brownie', 'postre', 'helado', 'torta', 'cheesecake'],
  hamburguesas: ['hamburguesa', 'burger', 'clásica', 'clasica'],
};

function categoriaDe(nombres: string[]): string {
  const texto = nombres.join(' ').toLowerCase();
  // El orden importa: se devuelve la primera que aparezca en el pedido, y
  // 'hamburguesas' queda de último para que no gane por ser el respaldo.
  for (const categoria of ['parrilla', 'bowls', 'postres', 'bebidas', 'hamburguesas']) {
    if (PALABRAS[categoria].some((palabra) => texto.includes(palabra))) return categoria;
  }
  return 'hamburguesas';
}

export default function Momentos() {
  const insets = useSafeAreaInsets();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  useEffect(() => {
    traerMisPedidos().then(setPedidos);
  }, []);

  const entregados = pedidos.filter((p) => p.estado === 'entregado');

  const tarjetas = entregados.length
    ? entregados.map((p) => {
        const nombres = (p.pedido_items ?? []).map((i) => i.nombre);
        return {
          id: p.id,
          titulo: p.modalidad === 'domicilio' ? 'En casa' : 'En La Mesa',
          fecha: fechaLarga(p.creado_en),
          categoria: categoriaDe(nombres),
          gente: ['Daniel'],
          nota: (p.pedido_items ?? []).map((i) => `${i.cantidad} · ${i.nombre}`).join(' · '),
        };
      })
    : SEMILLA;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.marfil }}
      contentContainerStyle={{ paddingTop: insets.top + e.e3, paddingBottom: e.e9 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: e.e4, marginBottom: e.e5 }}>
        <Text style={titulo('h2', { fontSize: 22 })}>Momentos</Text>
        <Text style={titulo('h1', { fontSize: 34, marginTop: e.e4 })}>
          Las mesas que{'\n'}has compartido
        </Text>
        <Text style={[texto.b1, { color: color.tinta60, marginTop: e.e2 }]}>
          Cada pedido deja una mesa. Estas son las tuyas.
        </Text>
      </View>

      {tarjetas.map((m) => (
        <View key={m.id} style={s.momento}>
          <View>
            <FotoPlato categoria={m.categoria} alto={150} redondez={0} />
            <View style={s.quienes}>
              {m.gente.map((g, i) => (
                <View key={g + i} style={{ marginRight: -10 }}>
                  <Avatar nombre={g} tamano={34} />
                </View>
              ))}
            </View>
          </View>

          <View style={{ padding: e.e4 }}>
            <Text style={titulo('h2', { fontSize: 21 })}>{m.titulo}</Text>
            <Text style={[texto.caption, { marginTop: 4, marginBottom: e.e2 }]}>{m.fecha}</Text>
            <Text style={[texto.b1, { color: color.tinta60 }]}>{m.nota}</Text>
            <Boton
              variante="secundario"
              estilo={{ height: 38, marginTop: e.e3, alignSelf: 'flex-start' }}
              onPress={() => router.push('/menu')}
            >
              Volver a pedir lo mismo
            </Boton>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  momento: {
    marginHorizontal: e.e4,
    marginBottom: e.e4,
    borderRadius: radio.r4,
    overflow: 'hidden',
    backgroundColor: color.blanco,
    ...sombra.suave,
  },
  quienes: { position: 'absolute', left: e.e4, bottom: e.e4, flexDirection: 'row' },
});
