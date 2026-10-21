import { useCallback, useEffect, useState } from 'react';
import { useCart } from '../cart/CartContext.jsx';
import { formatGs } from '../lib/formatGs.js';
import CheckoutForm from './CheckoutForm.jsx';
import ConfirmacionOrden from './ConfirmacionOrden.jsx';

const TITULOS = {
  carrito: 'Tu carrito',
  checkout: 'Finalizar compra',
  confirmacion: 'Compra confirmada',
};

// Pasos: carrito → checkout (formulario) → confirmacion (orden devuelta por el servidor).
export default function CartDrawer({ abierto, onCerrar, onCompraRealizada }) {
  const { items, total, cambiarCantidad, quitar, vaciar } = useCart();
  const [paso, setPaso] = useState('carrito');
  const [orden, setOrden] = useState(null);
  // Datos del formulario en el drawer para no perderlos al ir y volver del carrito.
  const [datosCheckout, setDatosCheckout] = useState({ nombre: '', email: '' });
  // Mientras se envía la orden no se puede cerrar el drawer (evita reabrir y enviar dos veces).
  const [enviando, setEnviando] = useState(false);

  // Si el carrito queda vacío durante el checkout (p. ej. al quitar productos inexistentes), volvemos al carrito.
  if (paso === 'checkout' && items.length === 0) setPaso('carrito');
  const pasoActual = paso === 'checkout' && items.length === 0 ? 'carrito' : paso;

  const cerrar = useCallback(() => {
    if (enviando) return;
    if (paso === 'confirmacion') {
      setPaso('carrito');
      setOrden(null);
    }
    onCerrar();
  }, [enviando, paso, onCerrar]);

  useEffect(() => {
    if (!abierto) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') cerrar();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [abierto, cerrar]);

  function ordenCreada(nuevaOrden) {
    setOrden(nuevaOrden);
    setPaso('confirmacion');
    setDatosCheckout({ nombre: '', email: '' });
    vaciar();
    onCompraRealizada?.();
  }

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-20">
      <div className="absolute inset-0 bg-black/40" onClick={cerrar} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={TITULOS[pasoActual]}
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2 className="text-lg font-semibold">{TITULOS[pasoActual]}</h2>
          <button
            type="button"
            onClick={cerrar}
            disabled={enviando}
            className="rounded-lg px-2 py-1 text-stone-500 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Cerrar carrito"
          >
            ✕
          </button>
        </div>

        {pasoActual === 'confirmacion' && orden && (
          <ConfirmacionOrden orden={orden} onVolverTienda={cerrar} />
        )}

        {pasoActual === 'checkout' && (
          <CheckoutForm
            valores={datosCheckout}
            onCambiarValores={setDatosCheckout}
            onEnviandoChange={setEnviando}
            onVolver={() => setPaso('carrito')}
            onOrdenCreada={ordenCreada}
            onStockCambio={onCompraRealizada}
          />
        )}

        {pasoActual === 'carrito' && (
          <>
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
                onClick={() => setPaso('checkout')}
                disabled={items.length === 0}
                className="w-full rounded-lg bg-yerba-600 py-2.5 font-medium text-white hover:bg-yerba-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600"
                data-testid="btn-finalizar-compra"
              >
                Finalizar compra
              </button>
              {items.length > 0 && (
                <button type="button" onClick={vaciar} className="w-full text-sm text-stone-500 underline hover:text-red-700">
                  Vaciar carrito
                </button>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
