import { useEffect } from 'react';
import { useCart } from '../cart/CartContext.jsx';
import { formatGs } from '../lib/formatGs.js';

export default function CartDrawer({ abierto, onCerrar }) {
  const { items, total, cambiarCantidad, quitar, vaciar } = useCart();

  useEffect(() => {
    if (!abierto) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-20">
      <div className="absolute inset-0 bg-black/40" onClick={onCerrar} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Carrito"
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2 className="text-lg font-semibold">Tu carrito</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg px-2 py-1 text-stone-500 hover:bg-stone-100"
            aria-label="Cerrar carrito"
          >
            ✕
          </button>
        </div>

        {items.length === 0 ? (
          <p className="flex-1 px-5 py-10 text-center text-stone-500">El carrito está vacío.</p>
        ) : (
          <ul className="flex-1 divide-y divide-stone-100 overflow-y-auto px-5">
            {items.map((item) => (
              <li key={item.id} className="flex gap-3 py-4">
                <div className="flex-1">
                  <p className="font-medium leading-snug">{item.nombre}</p>
                  <p className="text-sm text-stone-500 tabular-nums">{formatGs(item.precio)} c/u</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(item.id, item.cantidad - 1)}
                      className="h-7 w-7 rounded border border-stone-300 hover:bg-stone-100"
                      aria-label={`Quitar una unidad de ${item.nombre}`}
                    >
                      −
                    </button>
                    <span className="w-6 text-center tabular-nums" data-testid={`cantidad-${item.id}`}>
                      {item.cantidad}
                    </span>
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(item.id, item.cantidad + 1)}
                      disabled={item.cantidad >= item.stock}
                      className="h-7 w-7 rounded border border-stone-300 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Agregar una unidad de ${item.nombre}`}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => quitar(item.id)}
                      className="ml-2 text-sm text-stone-500 underline hover:text-red-700"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
                <p className="font-semibold tabular-nums">{formatGs(item.precio * item.cantidad)}</p>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3 border-t border-stone-200 px-5 py-4">
          <div className="flex items-center justify-between text-lg font-semibold">
            <span>Total</span>
            <span className="tabular-nums" data-testid="total-carrito">{formatGs(total)}</span>
          </div>
          <button
            type="button"
            disabled
            title="Próximamente"
            className="w-full cursor-not-allowed rounded-lg bg-stone-300 py-2.5 font-medium text-stone-600"
          >
            Finalizar compra (próximamente)
          </button>
          {items.length > 0 && (
            <button type="button" onClick={vaciar} className="w-full text-sm text-stone-500 underline hover:text-red-700">
              Vaciar carrito
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
