async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Error ${res.status} al llamar a ${url}`);
  }
  return res.json();
}

export function fetchCategorias(signal) {
  return getJson('/api/categorias', signal);
}

export function fetchProductos({ categoria, q } = {}, signal) {
  const params = new URLSearchParams();
  if (categoria) params.set('categoria', categoria);
  if (q) params.set('q', q);
  const query = params.toString();
  return getJson(`/api/productos${query ? `?${query}` : ''}`, signal);
}
