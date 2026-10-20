import ProductCard from './ProductCard.jsx';

export default function ProductGrid({ productos, estado }) {
  if (estado === 'cargando' && productos.length === 0) {
    return <p className="py-16 text-center text-stone-500">Cargando productos…</p>;
  }
  if (estado === 'error') {
    return (
      <p className="py-16 text-center text-red-700" role="alert">
        No se pudo conectar con el servidor.
      </p>
    );
  }
  if (productos.length === 0) {
    return <p className="py-16 text-center text-stone-500">No hay productos.</p>;
  }

  return (
    <ul
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
        estado === 'cargando' ? 'opacity-60' : ''
      }`}
    >
      {productos.map((producto) => (
        <li key={producto.id}>
          <ProductCard producto={producto} />
        </li>
      ))}
    </ul>
  );
}
