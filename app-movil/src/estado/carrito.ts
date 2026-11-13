import { create } from 'zustand';
import { Cupon, LineaCarrito, MetodoPago, Modalidad, Producto } from '@/datos/tipos';

interface EstadoCarrito {
  lineas: LineaCarrito[];
  modalidad: Modalidad;
  metodoPago: MetodoPago;
  cupon: Cupon | null;
  costoDomicilio: number;
  mesaId: string | null;

  agregar: (
    producto: Producto,
    cantidad: number,
    opciones: LineaCarrito['opciones'],
    notas?: string,
  ) => void;
  cambiarCantidad: (clave: string, delta: number) => void;
  quitar: (clave: string) => void;
  vaciar: () => void;
  setModalidad: (m: Modalidad) => void;
  setMetodoPago: (m: MetodoPago) => void;
  setCupon: (c: Cupon | null) => void;
  setCostoDomicilio: (v: number) => void;
  setMesa: (id: string | null) => void;

  piezas: () => number;
  subtotal: () => number;
  descuento: () => number;
  envio: () => number;
  total: () => number;
}

/** Dos veces el mismo plato con las mismas opciones es una sola línea */
function claveDe(producto: Producto, opciones: LineaCarrito['opciones']) {
  const firma = opciones.map((o) => o.opcion).sort().join('|');
  return `${producto.id}::${firma}`;
}

export const usarCarrito = create<EstadoCarrito>((set, get) => ({
  lineas: [],
  modalidad: 'recoger',
  metodoPago: 'nequi',
  cupon: null,
  costoDomicilio: 6900,
  mesaId: null,

  agregar: (producto, cantidad, opciones, notas) => {
    const clave = claveDe(producto, opciones);
    const extra = opciones.reduce((t, o) => t + o.precio_extra, 0);
    set((s) => {
      const existente = s.lineas.find((l) => l.clave === clave);
      if (existente) {
        return {
          lineas: s.lineas.map((l) =>
            l.clave === clave ? { ...l, cantidad: l.cantidad + cantidad } : l,
          ),
        };
      }
      return {
        lineas: [
          ...s.lineas,
          {
            clave,
            producto_id: producto.id,
            categoria_id: producto.categoria_id,
            nombre: producto.nombre,
            imagen_url: producto.imagen_url,
            precio_unitario: producto.precio + extra,
            cantidad,
            opciones,
            notas,
          },
        ],
      };
    });
  },

  cambiarCantidad: (clave, delta) =>
    set((s) => ({
      lineas: s.lineas
        .map((l) => (l.clave === clave ? { ...l, cantidad: l.cantidad + delta } : l))
        .filter((l) => l.cantidad > 0),
    })),

  quitar: (clave) => set((s) => ({ lineas: s.lineas.filter((l) => l.clave !== clave) })),
  vaciar: () => set({ lineas: [], cupon: null, mesaId: null }),
  setModalidad: (modalidad) => set({ modalidad }),
  setMetodoPago: (metodoPago) => set({ metodoPago }),
  setCupon: (cupon) => set({ cupon }),
  setCostoDomicilio: (costoDomicilio) => set({ costoDomicilio }),
  setMesa: (mesaId) => set({ mesaId }),

  piezas: () => get().lineas.reduce((t, l) => t + l.cantidad, 0),
  subtotal: () => get().lineas.reduce((t, l) => t + l.precio_unitario * l.cantidad, 0),

  descuento: () => {
    const { cupon, lineas } = get();
    if (!cupon) return 0;
    const sub = get().subtotal();
    if (sub < cupon.monto_minimo) return 0;

    switch (cupon.tipo) {
      case 'porcentaje':
        return Math.round((sub * cupon.valor) / 100);
      case 'monto_fijo':
        return Math.min(sub, cupon.valor);
      case 'dos_por_uno': {
        // De cada par, el más barato sale gratis. Si el cupón es de una
        // categoría, solo cuentan sus platos: es la misma cuenta que hace
        // la base al guardar el pedido (supabase/endurecimiento.sql).
        const elegibles = lineas
          .filter((l) => !cupon.categoria_id || l.categoria_id === cupon.categoria_id)
          .flatMap((l) => Array<number>(l.cantidad).fill(l.precio_unitario));
        elegibles.sort((a, b) => a - b);
        let libre = 0;
        for (let i = 0; i + 1 < elegibles.length; i += 2) libre += elegibles[i];
        return libre;
      }
      default:
        return 0;
    }
  },

  envio: () => {
    const { modalidad, cupon, costoDomicilio } = get();
    if (modalidad !== 'domicilio') return 0;
    if (cupon?.tipo === 'envio_gratis' && get().subtotal() >= cupon.monto_minimo) return 0;
    return costoDomicilio;
  },

  total: () => Math.max(0, get().subtotal() - get().descuento() + get().envio()),
}));
