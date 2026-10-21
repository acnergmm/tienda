import { useRef, useState } from 'react';
import { useCart } from '../cart/CartContext.jsx';
import { ApiError, crearOrden } from '../lib/api.js';
import { formatGs } from '../lib/formatGs.js';
import { crearOrdenSchema, emailSchema, nombreSchema } from '../lib/schemas.js';

const CAMPOS = ['nombre', 'email'];

// Separa los issues de Zod (cliente) o los detalles de un 400 (servidor) en errores por campo y generales.
function repartirErrores(lista) {
  const campos = {};
  const generales = [];
  for (const { campo, mensaje } of lista) {
    if (CAMPOS.includes(campo)) {
      campos[campo] ??= mensaje;
    } else {
      generales.push(mensaje);
    }
  }
  return { campos, generales };
}

const ESQUEMAS_CAMPO = { nombre: nombreSchema, email: emailSchema };

// Para errores de campo del servidor (mensajes de Zod en inglés) preferimos el mensaje en español
// del esquema del frontend; el del servidor queda solo como respaldo.
function mensajeCampo(campo, valor, mensajeServidor) {
  const result = ESQUEMAS_CAMPO[campo]?.safeParse(valor);
  if (result && !result.success) return result.error.issues[0].message;
  return mensajeServidor || 'Revisá este dato.';
}

function errorDesdeRespuesta(err, items, valores) {
  const nombreDe = (productoId) => items.find((item) => item.id === productoId)?.nombre ?? `Producto #${productoId}`;

  if (!(err instanceof ApiError)) return { tipo: 'red' };

  const { status, body } = err;
  if (status === 400 && Array.isArray(body?.detalles)) {
    return {
      tipo: 'datos',
      ...repartirErrores(
        body.detalles.map((d) => {
          // "body.email" → "email"; "body" (JSON inválido) o "body.items.0.cantidad" quedan como error general.
          const campo = String(d.campo ?? '').replace(/^body\./, '');
          const mensaje = CAMPOS.includes(campo) ? mensajeCampo(campo, valores[campo], d.mensaje) : d.mensaje;
          return { campo, mensaje };
        }),
      ),
    };
  }
  if (status === 404 && Array.isArray(body?.productoIds)) {
    return {
      tipo: 'noEncontrados',
      productos: body.productoIds.map((id) => ({ productoId: id, nombre: nombreDe(id) })),
    };
  }
  if (status === 409 && Array.isArray(body?.detalles)) {
    return {
      tipo: 'stock',
      productos: body.detalles.map((d) => ({ ...d, nombre: nombreDe(d.productoId) })),
    };
  }
  return { tipo: 'servidor' };
}

function clasesInput(conError) {
  return `w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
    conError
      ? 'border-red-500 focus:border-red-600 focus:ring-red-100'
      : 'border-stone-300 focus:border-yerba-600 focus:ring-yerba-100'
  }`;
}

export default function CheckoutForm({
  valores,
  onCambiarValores,
  onEnviandoChange,
  onVolver,
  onOrdenCreada,
  onStockCambio,
}) {
  const { items, total, quitar } = useCart();
  const [errores, setErrores] = useState({});
  const [errorEnvio, setErrorEnvio] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);

  function cambiar(campo) {
    return (e) => {
      const valor = e.target.value;
      onCambiarValores((prev) => ({ ...prev, [campo]: valor }));
      setErrores((prev) => (prev[campo] ? { ...prev, [campo]: undefined } : prev));
    };
  }

  async function enviar() {
    if (enviandoRef.current) return;

    const payload = {
      nombre: valores.nombre,
      email: valores.email,
      items: items.map((item) => ({ productoId: item.id, cantidad: item.cantidad })),
    };
    const result = crearOrdenSchema.safeParse(payload);
    if (!result.success) {
      const { campos, generales } = repartirErrores(
        result.error.issues.map((issue) => ({ campo: issue.path.join('.'), mensaje: issue.message })),
      );
      setErrores(campos);
      setErrorEnvio(generales.length > 0 ? { tipo: 'datos', generales } : null);
      return;
    }

    enviandoRef.current = true;
    setEnviando(true);
    onEnviandoChange?.(true);
    setErrores({});
    setErrorEnvio(null);
    try {
      const orden = await crearOrden(result.data);
      onOrdenCreada(orden);
    } catch (err) {
      console.error(err);
      const error = errorDesdeRespuesta(err, items, valores);
      if (error.tipo === 'datos') setErrores(error.campos);
      // El stock o el catálogo cambiaron: refrescamos el listado para que se vea lo real.
      if (error.tipo === 'stock' || error.tipo === 'noEncontrados') onStockCambio?.();
      setErrorEnvio(error);
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
      onEnviandoChange?.(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    enviar();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col" data-testid="checkout-form">
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <section aria-labelledby="checkout-resumen-titulo">
          <h3 id="checkout-resumen-titulo" className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Resumen
          </h3>
          <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200" data-testid="checkout-resumen">
            {items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <span>
                  {item.nombre} <span className="text-stone-500 tabular-nums">× {item.cantidad}</span>
                </span>
                <span className="font-medium tabular-nums">{formatGs(item.precio * item.cantidad)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="checkout-datos-titulo" className="space-y-4">
          <h3 id="checkout-datos-titulo" className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Tus datos
          </h3>
          <div>
            <label htmlFor="checkout-nombre" className="mb-1 block text-sm font-medium">
              Nombre
            </label>
            <input
              id="checkout-nombre"
              name="nombre"
              type="text"
              autoComplete="name"
              maxLength={120}
              value={valores.nombre}
              onChange={cambiar('nombre')}
              disabled={enviando}
              aria-invalid={errores.nombre ? 'true' : 'false'}
              aria-describedby={errores.nombre ? 'checkout-nombre-error' : undefined}
              className={clasesInput(Boolean(errores.nombre))}
              data-testid="input-nombre"
            />
            {errores.nombre && (
              <p id="checkout-nombre-error" className="mt-1 text-sm text-red-700" data-testid="error-nombre">
                {errores.nombre}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="checkout-email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              id="checkout-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              value={valores.email}
              onChange={cambiar('email')}
              disabled={enviando}
              aria-invalid={errores.email ? 'true' : 'false'}
              aria-describedby={errores.email ? 'checkout-email-error' : undefined}
              className={clasesInput(Boolean(errores.email))}
              data-testid="input-email"
            />
            {errores.email && (
              <p id="checkout-email-error" className="mt-1 text-sm text-red-700" data-testid="error-email">
                {errores.email}
              </p>
            )}
          </div>
        </section>

        {errorEnvio && (
          <ErrorEnvio
            error={errorEnvio}
            enviando={enviando}
            onReintentar={enviar}
            onVolver={onVolver}
            onQuitar={(ids) => {
              ids.forEach((id) => quitar(id));
              setErrorEnvio(null);
            }}
          />
        )}
      </div>

      <div className="space-y-3 border-t border-stone-200 px-5 py-4">
        <div className="flex items-center justify-between text-lg font-semibold">
          <span>Total</span>
          <span className="tabular-nums" data-testid="checkout-total">
            {formatGs(total)}
          </span>
        </div>
        <button
          type="submit"
          disabled={enviando || items.length === 0}
          aria-busy={enviando}
          className="w-full rounded-lg bg-yerba-600 py-2.5 font-medium text-white hover:bg-yerba-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600"
          data-testid="btn-comprar"
        >
          {enviando ? 'Procesando…' : 'Comprar'}
        </button>
        <button
          type="button"
          onClick={onVolver}
          disabled={enviando}
          className="w-full text-sm text-stone-500 underline hover:text-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="btn-volver-carrito"
        >
          Volver al carrito
        </button>
      </div>
    </form>
  );
}

function ErrorEnvio({ error, enviando, onReintentar, onVolver, onQuitar }) {
  const caja = 'rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800';

  if (error.tipo === 'stock') {
    return (
      <div role="alert" className={caja} data-testid="error-stock">
        <p className="font-semibold">No hay stock suficiente para algunos productos:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {error.productos.map((p) => (
            <li key={p.productoId} data-testid={`error-stock-${p.productoId}`}>
              {p.nombre}: pediste {p.pedido}, {p.disponible === 0 ? 'no quedan unidades' : `hay ${p.disponible} disponibles`}.
            </li>
          ))}
        </ul>
        <p className="mt-2">Ajustá las cantidades en el carrito y volvé a intentar.</p>
        <button type="button" onClick={onVolver} className="mt-2 font-medium underline">
          Ir al carrito
        </button>
      </div>
    );
  }

  if (error.tipo === 'noEncontrados') {
    return (
      <div role="alert" className={caja} data-testid="error-no-encontrados">
        <p className="font-semibold">Estos productos ya no están disponibles:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {error.productos.map((p) => (
            <li key={p.productoId} data-testid={`error-no-encontrado-${p.productoId}`}>
              {p.nombre}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => onQuitar(error.productos.map((p) => p.productoId))}
          className="mt-2 font-medium underline"
          data-testid="btn-quitar-no-encontrados"
        >
          Quitarlos del carrito
        </button>
      </div>
    );
  }

  if (error.tipo === 'datos') {
    if (!error.generales || error.generales.length === 0) return null;
    return (
      <div role="alert" className={caja} data-testid="error-datos">
        <p className="font-semibold">Revisá los datos del pedido:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {error.generales.map((mensaje, i) => (
            <li key={i}>{mensaje}</li>
          ))}
        </ul>
      </div>
    );
  }

  // Error de red o 500.
  return (
    <div role="alert" className={caja} data-testid="error-generico">
      <p>
        {error.tipo === 'red'
          ? 'No se pudo conectar con el servidor. Revisá tu conexión.'
          : 'Ocurrió un error al procesar la compra.'}{' '}
        Tu carrito sigue intacto.
      </p>
      <button
        type="button"
        onClick={onReintentar}
        disabled={enviando}
        className="mt-2 font-medium underline disabled:opacity-50"
        data-testid="btn-reintentar"
      >
        Reintentar
      </button>
    </div>
  );
}
