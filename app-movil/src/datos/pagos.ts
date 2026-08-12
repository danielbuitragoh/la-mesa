import * as WebBrowser from 'expo-web-browser';
import { HAY_BACKEND, supabase } from './supabase';
import { Pedido } from './tipos';

/**
 * Cobro de un pedido.
 *
 * Esta es una demo de portafolio: el pago SIEMPRE es simulado. La
 * integración con Wompi de más abajo queda escrita y documentada, pero
 * no se activa a menos que exista una llave pública real — que a
 * propósito no está puesta, porque los pagos reales están fuera de
 * alcance (ver README, sección "Trabajo futuro"). Sin esta comprobación,
 * cualquier pago que no fuera en efectivo intentaría llamar a la función
 * de servidor real y fallaría, porque no hay credenciales de Wompi.
 *
 * La app no arma la URL de la pasarela ni conoce el monto que se firma:
 * pide la firma al servidor mandando solo el id del pedido. El total se
 * recalcula allá desde la base de datos. Si esto se hiciera en el teléfono,
 * el secreto de integridad viajaría dentro del APK y cualquiera podría
 * firmar cobros a nombre de La Mesa.
 */

const HAY_PASARELA_REAL = Boolean(process.env.EXPO_PUBLIC_WOMPI_LLAVE_PUBLICA);

export type ResultadoPago =
  | { estado: 'aprobado' }
  | { estado: 'pendiente' }
  | { estado: 'cancelado' }
  | { estado: 'error'; mensaje: string };

export async function cobrar(pedido: Pedido): Promise<ResultadoPago> {
  // El efectivo no pasa por la pasarela: lo cobra el restaurante al entregar
  if (pedido.metodo_pago === 'efectivo') return { estado: 'aprobado' };

  // Sin backend, o sin llave de Wompi (el caso de esta demo): se simula.
  if (!HAY_BACKEND || !HAY_PASARELA_REAL) return { estado: 'aprobado' };

  const { data, error } = await supabase.functions.invoke('crear-transaccion', {
    body: { pedido_id: pedido.id },
  });

  if (error || !data?.url) {
    return {
      estado: 'error',
      mensaje: 'No pudimos abrir la pasarela de pago. Intenta de nuevo en un momento.',
    };
  }

  const redireccion = process.env.EXPO_PUBLIC_WOMPI_REDIRECCION ?? 'lamesa://pago';
  const resultado = await WebBrowser.openAuthSessionAsync(data.url as string, redireccion);

  if (resultado.type !== 'success') return { estado: 'cancelado' };

  // Volver de la pasarela no significa que el pago esté aprobado: eso lo
  // confirma Wompi contra el servidor. Aquí solo esperamos a que el
  // webhook mueva el pedido, con un tope para no dejar la pantalla colgada.
  return esperarConfirmacion(pedido.id);
}

async function esperarConfirmacion(pedidoId: string, intentos = 8): Promise<ResultadoPago> {
  for (let i = 0; i < intentos; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const { data } = await supabase
      .from('pedidos')
      .select('estado, estado_pago')
      .eq('id', pedidoId)
      .single();

    if (data?.estado_pago === 'aprobado') return { estado: 'aprobado' };
    if (data?.estado_pago === 'rechazado') {
      return { estado: 'error', mensaje: 'El pago fue rechazado. No se te cobró nada.' };
    }
  }
  // Wompi a veces se demora. El pedido queda en pendiente_pago y el
  // seguimiento se actualiza solo cuando llegue la confirmación.
  return { estado: 'pendiente' };
}
