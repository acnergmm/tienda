export default function CategoryFilter({ categorias, seleccionada, onSeleccionar }) {
  const opciones = [{ slug: '', nombre: 'Todos' }, ...categorias];

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
      {opciones.map((categoria) => {
        const activa = categoria.slug === seleccionada;
        return (
          <button
            key={categoria.slug || 'todos'}
            type="button"
            onClick={() => onSeleccionar(categoria.slug)}
            aria-pressed={activa}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activa
                ? 'bg-yerba-700 text-white'
                : 'border border-stone-300 bg-white text-stone-700 hover:border-yerba-600 hover:text-yerba-700'
            }`}
          >
            {categoria.nombre}
          </button>
        );
      })}
    </div>
  );
}
