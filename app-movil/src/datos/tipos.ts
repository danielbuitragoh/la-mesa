/** Espejo del esquema de Supabase (supabase/schema.sql) */

export type Modalidad = 'recoger' | 'domicilio' | 'en_mesa';

export type EstadoPedido =
  | 'pendiente_pago'
  | 'recibido'
  | 'en_preparacion'
  | 'listo'
  | 'en_camino'
  | 'entregado'
  | 'cancelado';

export type MetodoPago = 'nequi' | 'pse' | 'bancolombia' | 'tarjeta' | 'efectivo' | 'puntos';

export type BadgeProducto = 'nuevo' | 'popular' | 'exclusivo_app' | 'agotado' | 'descuento';

export type TipoDescuento = 'porcentaje' | 'monto_fijo' | 'dos_por_uno' | 'envio_gratis';

export interface Sede {
  id: string;
  nombre: string;
  ciudad: string;
  moneda: string;
  direccion: string;
  costo_domicilio: number;
  pedido_minimo: number;
  activa: boolean;
}

export interface Categoria {
  id: string;
  nombre: string;
  icono: string;
  orden: number;
}

export interface Opcion {
  id: string;
  nombre: string;
  precio_extra: number;
  disponible: boolean;
}

export interface GrupoOpcion {
  id: string;
  nombre: string;
  min_sel: number;
  max_sel: number;
  opciones: Opcion[];
}

export interface Producto {
  id: string;
  categoria_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  precio_antes: number | null;
  imagen_url: string | null;
  badges: BadgeProducto[];
  disponible: boolean;
  solo_app: boolean;
  grupos_opcion?: GrupoOpcion[];
}

export interface Cupon {
  id: string;
  codigo: string | null;
  titulo: string;
  descripcion: string | null;
  tipo: TipoDescuento;
  valor: number;
  monto_minimo: number;
  categoria_id: string | null;
  vence_en: string | null;
  activo: boolean;
}

export interface Recompensa {
  id: string;
  titulo: string;
  descripcion: string | null;
  puntos_costo: number;
  nivel_minimo: string;
  activa: boolean;
}

export interface Perfil {
  id: string;
  nombre: string;
  telefono: string | null;
  avatar_url: string | null;
  puntos: number;
  puntos_historicos: number;
}

export interface Direccion {
  id: string;
  etiqueta: string;
  direccion: string;
  detalle: string | null;
  principal: boolean;
}

/** Una línea del carrito, ya con sus opciones resueltas */
export interface LineaCarrito {
  clave: string; // producto + opciones: dos veces lo mismo se suman
  producto_id: string;
  categoria_id: string; // el 2x1 de una categoría solo cuenta sus platos
  nombre: string;
  imagen_url: string | null;
  precio_unitario: number; // incluye extras
  cantidad: number;
  opciones: { grupo: string; opcion: string; precio_extra: number }[];
  notas?: string;
}

export interface ItemPedido {
  id: string;
  nombre: string;
  cantidad: number;
  precio_unit: number;
  opciones: { grupo: string; opcion: string; precio_extra: number }[];
  usuario_id: string | null;
}

export interface Pedido {
  id: string;
  numero: number;
  estado: EstadoPedido;
  modalidad: Modalidad;
  metodo_pago: MetodoPago | null;
  estado_pago: 'pendiente' | 'aprobado' | 'rechazado' | 'reembolsado';
  subtotal: number;
  descuento: number;
  costo_domicilio: number;
  total: number;
  moneda: string;
  puntos_ganados: number;
  direccion_texto: string | null;
  notas: string | null;
  mensajero_nombre: string | null;
  mensajero_empresa: string | null;
  creado_en: string;
  pedido_items?: ItemPedido[];
}

export interface Participante {
  usuario_id: string;
  es_anfitrion: boolean;
  listo: boolean;
  perfiles?: { nombre: string; avatar_url: string | null };
}

export interface Mesa {
  id: string;
  codigo: string;
  nombre: string;
  anfitrion_id: string;
  estado: 'abierta' | 'cerrada' | 'convertida' | 'cancelada';
  dividir_cuenta: boolean;
  mesa_participantes?: Participante[];
}
