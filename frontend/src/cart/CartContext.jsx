import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { z } from 'zod';

const STORAGE_KEY = 'tienda-carrito';

const cartItemSchema = z.object({
  id: z.number().int().positive(),
  nombre: z.string(),
  precio: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
  cantidad: z.number().int().positive(),
});
const cartSchema = z.array(cartItemSchema);

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const result = cartSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

function saveCart(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Sin storage disponible: el carrito funciona igual, solo no persiste.
  }
}

function clampCantidad(cantidad, stock) {
  return Math.max(0, Math.min(cantidad, stock));
}

function cartReducer(items, action) {
  switch (action.type) {
    case 'agregar': {
      const { producto } = action;
      const existente = items.find((item) => item.id === producto.id);
      if (existente) {
        return items.map((item) =>
          item.id === producto.id
            ? { ...item, stock: producto.stock, cantidad: clampCantidad(item.cantidad + 1, producto.stock) }
            : item,
        );
      }
      if (producto.stock < 1) return items;
      const { id, nombre, precio, stock } = producto;
      return [...items, { id, nombre, precio, stock, cantidad: 1 }];
    }
    case 'cambiarCantidad':
      return items
        .map((item) =>
          item.id === action.id ? { ...item, cantidad: clampCantidad(action.cantidad, item.stock) } : item,
        )
        .filter((item) => item.cantidad > 0);
    case 'quitar':
      return items.filter((item) => item.id !== action.id);
    case 'vaciar':
      return [];
    default:
      throw new Error(`Acción desconocida: ${action.type}`);
  }
}

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, dispatch] = useReducer(cartReducer, undefined, loadCart);

  useEffect(() => {
    saveCart(items);
  }, [items]);

  const value = useMemo(() => {
    const cantidadTotal = items.reduce((suma, item) => suma + item.cantidad, 0);
    const total = items.reduce((suma, item) => suma + item.precio * item.cantidad, 0);
    return {
      items,
      cantidadTotal,
      total,
      agregar: (producto) => dispatch({ type: 'agregar', producto }),
      cambiarCantidad: (id, cantidad) => dispatch({ type: 'cambiarCantidad', id, cantidad }),
      quitar: (id) => dispatch({ type: 'quitar', id }),
      vaciar: () => dispatch({ type: 'vaciar' }),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart debe usarse dentro de CartProvider');
  return context;
}
