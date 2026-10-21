// Error de la API que conserva el status HTTP y el cuerpo JSON (si lo hay) para que la UI muestre el motivo.
export class ApiError extends Error {
  constructor(status, body, url) {
    super(body?.error ?? `Error ${status} al llamar a ${url}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function parseBody(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new ApiError(res.status, await parseBody(res), url);
  }
  return res.json();
}

async function postJson(url, data, signal) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal,
  });
  const body = await parseBody(res);
  if (!res.ok) {
    throw new ApiError(res.status, body, url);
  }
  return body;
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

// POST /api/orders → 201 { id, nombre, email, total, items }. Lanza ApiError en 4xx/5xx.
export function crearOrden({ nombre, email, items }, signal) {
  return postJson('/api/orders', { nombre, email, items }, signal);
}
