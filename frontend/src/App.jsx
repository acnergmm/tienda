import { useEffect, useState } from 'react';
import { fetchCategorias, fetchProductos } from './lib/api.js';
import Header from './components/Header.jsx';
import CategoryFilter from './components/CategoryFilter.jsx';
import ProductGrid from './components/ProductGrid.jsx';
import CartDrawer from './components/CartDrawer.jsx';

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function App() {
  const [categorias, setCategorias] = useState([]);
  const [categoria, setCategoria] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [productos, setProductos] = useState([]);
  const [estado, setEstado] = useState('cargando');
  const [carritoAbierto, setCarritoAbierto] = useState(false);

  const q = useDebounced(busqueda.trim(), 300);

  useEffect(() => {
    const controller = new AbortController();
    fetchCategorias(controller.signal)
      .then(setCategorias)
      .catch((err) => {
        if (err.name !== 'AbortError') console.error(err);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setEstado('cargando');
    fetchProductos({ categoria, q }, controller.signal)
      .then((data) => {
        setProductos(data);
        setEstado('ok');
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error(err);
        setEstado('error');
      });
    return () => controller.abort();
  }, [categoria, q]);

  return (
    <div className="min-h-screen">
      <Header onAbrirCarrito={() => setCarritoAbierto(true)} />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CategoryFilter categorias={categorias} seleccionada={categoria} onSeleccionar={setCategoria} />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            maxLength={100}
            placeholder="Buscar productos…"
            aria-label="Buscar productos"
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-yerba-600 focus:outline-none focus:ring-2 focus:ring-yerba-100 md:w-64"
          />
        </div>

        <ProductGrid productos={productos} estado={estado} />
      </main>

      <CartDrawer abierto={carritoAbierto} onCerrar={() => setCarritoAbierto(false)} />
    </div>
  );
}
