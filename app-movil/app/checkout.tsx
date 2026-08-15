import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Boton } from '@/componentes/Boton';
import { Icono } from '@/componentes/Icono';
import { METODOS_PAGO } from '@/datos/metodosPago';
import { cobrar } from '@/datos/pagos';
import { crearPedido } from '@/datos/pedidos';
import { registrarNotificaciones } from '@/datos/notificaciones';
import { usarCarrito } from '@/estado/carrito';
import { usarDirecciones } from '@/estado/direcciones';
import { usarSesion } from '@/estado/sesion';
import { color, e, radio, sombra } from '@/tema/tokens';
import { familia, texto, titulo } from '@/tema/tipografia';
import { alertar } from '@/utils/alerta';
import { pesos } from '@/utils/formato';

export default function Checkout() {
  const insets = useSafeAreaInsets();
  const [pagando, setPagando] = useState(false);

  const { modalidad, setModalidad, metodoPago, setMetodoPago, lineas, cupon, vaciar } = usarCarrito();
  const direcciones = usarDirecciones((s) => s.direcciones);
  const cargarDirecciones = usarDirecciones((s) => s.cargar);
  const principal = usarDirecciones((s) => s.principal());
  const autenticado = usarSesion((s) => s.autenticado);

  useEffect(() => {
    if (!direcciones.length) cargarDirecciones();
  }, [direcciones.length, cargarDirecciones]);

  /**
   * Pagar exige sesión: crearPedido() la necesita para el insert (RLS) y,
   * sin ella, devuelve null sin avisar nada visible. Antes de este fix,
   * alguien sin sesión (por ejemplo, un desconocido en incógnito) llegaba
   * hasta el botón de pago y no pasaba nada al tocarlo. Se manda a entrar
   * antes de que eso pueda ocurrir.
   */
  useEffect(() => {
    if (!autenticado) router.replace('/entrar');
  }, [autenticado]);

  const subtotal = usarCarrito((s) => s.subtotal());
  const descuento = usarCarrito((s) => s.descuento());
  const envio = usarCarrito((s) => s.envio());
  const total = usarCarrito((s) => s.total());
  const piezas = usarCarrito((s) => s.piezas());

  async function pagar() {
    setPagando(true);
    try {
      const pedido = await crearPedido({
        modalidad,
        metodo_pago: metodoPago,
        lineas,
        subtotal,
        descuento,
        costo_domicilio: envio,
        total,
        cupon_id: cupon?.id ?? null,
        direccion_texto: modalidad === 'domicilio' ? (principal?.direccion ?? null) : null,
      });

      if (!pedido) {
        alertar(
          'No pudimos crear el pedido',
          'Revisa tu conexión e intenta de nuevo. No se te cobró nada.',
        );
        return;
      }

      // El servidor firma el cobro y abre la pasarela. Efectivo no pasa por ahí.
      const resultado = await cobrar(pedido);

      if (resultado.estado === 'error') {
        alertar('No se pudo completar el pago', resultado.mensaje);
        return;
      }
      if (resultado.estado === 'cancelado') {
        alertar(
          'Pago sin terminar',
          'Cerraste la pasarela antes de pagar. Tu pedido quedó guardado; puedes intentarlo otra vez.',
        );
        return;
      }
      if (resultado.estado === 'pendiente') {
        alertar(
          'Estamos confirmando tu pago',
          'El banco se está demorando en responder. Te avisamos apenas quede listo.',
        );
      }

      // El permiso de notificaciones se pide aquí, cuando ya hay algo que avisar.
      registrarNotificaciones().catch(() => {});

      vaciar();
      router.replace(`/pedido/${pedido.numero}`);
    } finally {
      setPagando(false);
    }
  }

  if (!autenticado) return null;

  return (
    <View style={{ flex: 1, backgroundColor: color.marfil, paddingTop: insets.top }}>
      <View style={s.superior}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Volver" hitSlop={10}>
          <Icono nombre="atras" tamano={20} tono={color.carbon} />
        </Pressable>
        <Text style={titulo('h2', { fontSize: 22, marginLeft: e.e3 })}>Pago</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: e.e4, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <Text style={[texto.h3, { marginBottom: e.e3 }]}>Cómo lo recibes</Text>
        <View style={s.modalidad}>
          {(['recoger', 'domicilio'] as const).map((m) => {
            const on = modalidad === m;
            return (
              <Pressable key={m} onPress={() => setModalidad(m)} style={[s.modalidadBoton, on && s.modalidadOn]}>
                <Icono
                  nombre={m === 'recoger' ? 'bolsa' : 'moto'}
                  tamano={17}
                  grosor={1.9}
                  tono={on ? color.carbon : color.tinta40}
                />
                <Text style={[s.modalidadTexto, { color: on ? color.carbon : color.tinta60 }]}>
                  {m === 'recoger' ? 'Recoger' : 'Domicilio'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={s.fila}
          onPress={() => modalidad === 'domicilio' && router.push('/direcciones')}
        >
          <View style={[s.sello, { backgroundColor: color.crema }]}>
            <Icono nombre={modalidad === 'recoger' ? 'ubicacion' : 'moto'} tamano={18} grosor={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={texto.h4}>
              {modalidad === 'recoger'
                ? 'La Mesa El Poblado'
                : (principal?.direccion ?? 'Agrega una dirección')}
            </Text>
            <Text style={[texto.b2, { color: color.tinta60 }]}>
              {modalidad === 'recoger'
                ? 'Cra. 35 #8A-45 · a 1,2 km de ti'
                : (principal?.detalle ?? 'Toca para elegir dónde')}
            </Text>
          </View>
          {modalidad === 'domicilio' ? (
            <Icono nombre="flecha" tamano={16} tono={color.tinta40} />
          ) : null}
        </Pressable>

        <View style={[s.fila, { marginTop: e.e2 }]}>
          <View style={[s.sello, { backgroundColor: color.crema }]}>
            <Icono nombre="reloj" tamano={18} grosor={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={texto.h4}>Lo antes posible</Text>
            <Text style={[texto.b2, { color: color.tinta60 }]}>
              {modalidad === 'recoger' ? 'Listo en unos 20 minutos' : 'Llega en unos 35 minutos'}
            </Text>
          </View>
        </View>

        <Text style={[texto.h3, { marginTop: e.e6, marginBottom: e.e3 }]}>Cómo pagas</Text>
        {METODOS_PAGO.map((m) => {
          const on = metodoPago === m.id;
          return (
            <Pressable key={m.id} onPress={() => setMetodoPago(m.id)} style={[s.fila, s.filaPago, on && s.filaOn]}>
              <View style={[s.marca, on && { borderColor: color.naranja, backgroundColor: color.naranja }]}>
                {on ? <View style={s.punto} /> : null}
              </View>
              <View style={[s.sello, { backgroundColor: m.fondo ?? color.crema }]}>
                {m.icono ? (
                  <Icono nombre={m.icono} tamano={18} grosor={2} />
                ) : (
                  <Text style={{ fontFamily: familia.bold, fontSize: 10, color: m.tinta ?? color.carbon }}>
                    {m.sigla}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={texto.h4}>{m.nombre}</Text>
                <Text style={[texto.b2, { color: color.tinta60 }]}>{m.detalle}</Text>
              </View>
            </Pressable>
          );
        })}

        <View style={s.cuenta}>
          <View style={s.renglon}>
            <Text style={[texto.b1, { color: color.tinta60 }]}>
              Subtotal · {piezas} {piezas === 1 ? 'producto' : 'productos'}
            </Text>
            <Text style={texto.b1}>{pesos(subtotal)}</Text>
          </View>
          {descuento > 0 && (
            <View style={s.renglon}>
              <Text style={[texto.b1, { color: color.tinta60 }]}>Cupón {cupon?.codigo ?? ''}</Text>
              <Text style={[texto.b1, { color: color.tealTexto, fontFamily: familia.semibold }]}>
                − {pesos(descuento)}
              </Text>
            </View>
          )}
          {modalidad === 'domicilio' && (
            <View style={s.renglon}>
              <Text style={[texto.b1, { color: color.tinta60 }]}>Domicilio</Text>
              <Text style={texto.b1}>{envio ? pesos(envio) : 'Gratis'}</Text>
            </View>
          )}
          <View style={s.renglonTotal}>
            <Text style={{ fontFamily: familia.bold, fontSize: 17 }}>Total</Text>
            <Text style={{ fontFamily: familia.bold, fontSize: 17 }}>{pesos(total)}</Text>
          </View>
        </View>

        <Text style={[texto.b2, { color: color.tinta60, textAlign: 'center', marginTop: e.e3 }]}>
          Al confirmar aceptas los términos de La Mesa.{'\n'}
          Los puntos se abonan cuando recibes tu pedido.
        </Text>
      </ScrollView>

      <View style={[s.accion, { paddingBottom: insets.bottom + e.e3 }]}>
        <Boton bloque cargando={pagando} onPress={pagar}>
          {`Pagar ${pesos(total)}`}
        </Boton>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  superior: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: e.e4,
    paddingVertical: e.e3,
    borderBottomWidth: 1,
    borderBottomColor: color.linea,
  },
  modalidad: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radio.r3,
    backgroundColor: color.crema,
    marginBottom: e.e3,
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
  modalidadOn: { backgroundColor: color.marfil, ...sombra.suave },
  modalidadTexto: { fontFamily: familia.semibold, fontSize: 13 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: e.e3,
    padding: e.e4,
    borderRadius: radio.r3,
    borderWidth: 1.5,
    borderColor: color.linea,
    backgroundColor: color.blanco,
  },
  filaPago: { marginBottom: e.e2 },
  filaOn: { borderColor: color.naranja, backgroundColor: 'rgba(242,107,31,0.05)' },
  marca: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: color.linea,
    alignItems: 'center',
    justifyContent: 'center',
  },
  punto: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: color.blanco },
  sello: { width: 36, height: 36, borderRadius: radio.r2, alignItems: 'center', justifyContent: 'center' },
  cuenta: {
    marginTop: e.e5,
    padding: e.e4,
    borderRadius: radio.r4,
    backgroundColor: color.blanco,
    ...sombra.suave,
  },
  renglon: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  renglonTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: color.linea,
    marginTop: e.e2,
    paddingTop: e.e3,
  },
  accion: {
    paddingHorizontal: e.e4,
    paddingTop: e.e4,
    backgroundColor: color.marfil,
    borderTopWidth: 1,
    borderTopColor: color.linea,
  },
});
