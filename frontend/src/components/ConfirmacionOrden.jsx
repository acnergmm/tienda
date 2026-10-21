import { useEffect, useRef } from 'react';
import { formatGs } from '../lib/formatGs.js';

// Muestra la orden tal como la devolvió el servidor (precios y total de la base, no del carrito).
export default function ConfirmacionOrden({ orden, onVolverTienda }) {
  const tituloRef = useRef(null);

  useEffect(() => {
    tituloRef.current?.focus();
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="confirmacion">
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
        <div className="text-center">
          <p className="text-4xl" aria-hidden="true">
            ✅
          </p>
          <h3 ref={tituloRef} tabIndex={-1} className="mt-2 text-xl font-semibold text-yerba-900 focus:outline-none">
            ¡Gracias por tu compra!
          </h3>
          <p className="mt-1 text-stone-600">
            Orden número{' '}
            <span className="font-semibold tabular-nums text-stone-900" data-testid="numero-orden">
              {orden.id}
            </span>
          </p>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg bg-stone-50 p-3 text-sm">
          <dt className="text-stone-500">Nombre</dt>
          <dd className="break-words" data-testid="confirmacion-nombre">
            {orden.nombre}
          </dd>
          <dt className="text-stone-500">Email</dt>
          <dd className="break-all" data-testid="confirmacion-email">
            {orden.email}
          </dd>
        </dl>

        <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200" data-testid="confirmacion-items">
          {orden.items.map((item) => (
            <li
              key={item.productoId}
              className="flex items-start justify-between gap-3 px-3 py-2 text-sm"
              data-testid={`confirmacion-item-${item.productoId}`}
            >
              <div>
                <p className="font-medium">{item.nombre}</p>
                <p className="text-stone-500 tabular-nums">
                  {item.cantidad} × {formatGs(item.precioUnitario)}
                </p>
              </div>
              <span className="font-medium tabular-nums">{formatGs(item.subtotal)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3 border-t border-stone-200 px-5 py-4">
        <div className="flex items-center justify-between text-lg font-semibold">
          <span>Total</span>
          <span className="tabular-nums" data-testid="total-confirmacion">
            {formatGs(orden.total)}
          </span>
        </div>
        <button
          type="button"
          onClick={onVolverTienda}
          className="w-full rounded-lg bg-yerba-600 py-2.5 font-medium text-white hover:bg-yerba-700"
          data-testid="btn-volver-tienda"
        >
          Volver a la tienda
        </button>
      </div>
    </div>
  );
}
