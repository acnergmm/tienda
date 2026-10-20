import { useCart } from '../cart/CartContext.jsx';

export default function Header({ onAbrirCarrito }) {
  const { cantidadTotal } = useCart();

  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden="true">🧉</span>
          <span className="text-lg font-semibold text-yerba-900">Tienda del Tereré</span>
        </div>
        <button
          type="button"
          onClick={onAbrirCarrito}
          className="relative rounded-lg px-3 py-2 text-sm font-medium text-yerba-900 hover:bg-yerba-50"
          aria-label={`Abrir carrito, ${cantidadTotal} productos`}
        >
          🛒 Carrito
          {cantidadTotal > 0 && (
            <span
              data-testid="contador-carrito"
              className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-yerba-600 px-1 text-xs font-semibold text-white"
            >
              {cantidadTotal}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
