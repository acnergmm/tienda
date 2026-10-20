import { useState } from 'react';
import { useCart } from '../cart/CartContext.jsx';
import { formatGs } from '../lib/formatGs.js';

// Si el producto no tiene imagen (o no carga): bloque de color e ícono por categoría.
const ESTILO_CATEGORIA = {
  terere: { icono: '🧊', fondo: 'bg-sky-100' },
  mates: { icono: '🧉', fondo: 'bg-amber-100' },
  yerba: { icono: '🌿', fondo: 'bg-yerba-100' },
  accesorios: { icono: '🎒', fondo: 'bg-orange-100' },
};
const ESTILO_DEFAULT = { icono: '🛍️', fondo: 'bg-stone-100' };

// Con stock por debajo de este número (y mayor a 0) se muestra "últimas unidades".
const UMBRAL_ULTIMAS_UNIDADES = 5;

export default function ProductCard({ producto }) {
  const { items, agregar } = useCart();
  const [imagenFallo, setImagenFallo] = useState(false);
  const estilo = ESTILO_CATEGORIA[producto.categoria.slug] ?? ESTILO_DEFAULT;
  const enCarrito = items.find((item) => item.id === producto.id)?.cantidad ?? 0;
  const sinStock = producto.stock === 0;
  const tope = !sinStock && enCarrito >= producto.stock;
  const ultimasUnidades = !sinStock && producto.stock < UMBRAL_ULTIMAS_UNIDADES;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="relative">
        {producto.imagenUrl && !imagenFallo ? (
          <img
            src={producto.imagenUrl}
            alt={producto.nombre}
            loading="lazy"
            onError={() => setImagenFallo(true)}
            className={`h-44 w-full object-cover ${estilo.fondo}`}
          />
        ) : (
          <div className={`flex h-44 items-center justify-center text-5xl ${estilo.fondo}`} aria-hidden="true">
            {estilo.icono}
          </div>
        )}
        {ultimasUnidades && (
          <span className="absolute left-2 top-2 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white shadow">
            {producto.stock === 1 ? '¡Última unidad!' : `¡Últimas ${producto.stock} unidades!`}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-yerba-700">{producto.categoria.nombre}</p>
        <h2 className="font-semibold leading-snug">{producto.nombre}</h2>
        <p className="line-clamp-2 text-sm text-stone-600">{producto.descripcion}</p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-lg font-semibold tabular-nums">{formatGs(producto.precio)}</span>
          <button
            type="button"
            onClick={() => agregar(producto)}
            disabled={sinStock || tope}
            className="rounded-lg bg-yerba-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-yerba-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600"
          >
            {sinStock ? 'Sin stock' : tope ? 'Máximo' : 'Agregar'}
          </button>
        </div>
        {enCarrito > 0 && <p className="text-xs text-stone-500">{enCarrito} en el carrito</p>}
      </div>
    </article>
  );
}
