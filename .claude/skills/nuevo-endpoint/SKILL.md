---
name: nuevo-endpoint
description: Pasos para crear un endpoint nuevo en el backend Express de la tienda — leer el esquema de la base, validar con Zod, SQL con parámetros, transacción si toca varias tablas, registrar la ruta y probar con curl un caso válido y uno inválido. Usar cuando se pida agregar, crear o implementar un endpoint, ruta o API (ej. "agregá POST /api/ordenes", "hacé un endpoint para actualizar stock").
argument-hint: "<MÉTODO /api/ruta> <qué hace>"
---

# Nuevo endpoint

Endpoint pedido: $ARGUMENTS

Seguí los pasos en orden. No saltees la prueba final: el endpoint no está terminado hasta que los dos curl den lo esperado.

## 1. Leer el esquema

- Leé [backend/db/schema.sql](../../../backend/db/schema.sql) para ver tablas, columnas, tipos, `NOT NULL`, `UNIQUE` y claves foráneas.
- Si hay dudas de que el archivo esté al día, confirmá contra la base real con el MCP `tienda-mysql` (solo lectura): `SHOW CREATE TABLE <tabla>`.
- Anotá antes de escribir código:
  - Qué tablas lee y cuáles escribe. **Si escribe en más de una → va con transacción (paso 4).**
  - Columnas de dinero (`precio`, `total`, `subtotal`…): son guaraníes enteros.
  - Restricciones que pueden fallar en runtime (`UNIQUE`, FK) y qué status corresponde.
- Si el endpoint necesita cambiar tablas, frená y avisá: el MCP no permite DDL, el cambio se hace a mano en la base y después se actualiza `schema.sql`.

## 2. Esquema Zod

En `backend/src/schemas/<recurso>.js` (crearlo si no existe; mirá [productos.js](../../../backend/src/schemas/productos.js) como modelo). Un esquema por parte del request que use el endpoint:

```js
import { z } from 'zod';

export const ordenIdParams = z.object({
  id: z.coerce.number().int().positive(),           // params y query llegan como string → coerce
});

export const crearOrdenBody = z.object({
  nombre: z.string().trim().min(1).max(120),        // max = largo del VARCHAR
  email: z.email().max(254),
  items: z
    .array(z.object({
      productoId: z.number().int().positive(),
      cantidad: z.number().int().positive().max(100),
    }))
    .min(1)
    .max(50),
});
```

- Precios/montos: `z.number().int().nonnegative()` (en query: `z.coerce.number().int().nonnegative()`).
- Los `max()` de strings igualan el `VARCHAR` de la columna.
- Nunca aceptar del cliente algo que el servidor debe calcular o leer de la base (precio unitario, total, `activo`…).
- Campos de orden o columna dinámicos: `z.enum([...])` con la lista blanca fija.

## 3. Ruta

En `backend/src/routes/<recurso>.js`. Respetá el estilo de [productos.js](../../../backend/src/routes/productos.js):

- Validar con el middleware: `validate({ params, query, body })`. Responde `400` solo; la ruta usa **únicamente `req.valid.*`**, nunca `req.body` / `req.params` / `req.query`.
- `try { ... } catch (err) { next(err); }` en cada handler. El handler genérico de `app.js` responde `500` sin filtrar detalles.
- SQL siempre con `?` y array de valores en `pool.execute`. Nada de `${}` con valores dentro del SQL.
- Mapear filas `snake_case` a JSON `camelCase` con una función `toX(row)`.
- `404` con `{ error: '... no encontrado' }` cuando no hay fila; `201` al crear.

```js
router.get('/:id', validate({ params: ordenIdParams }), async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT id, nombre, email, total FROM ordenes WHERE id = ?', [
      req.valid.params.id,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    res.json(toOrden(rows[0]));
  } catch (err) {
    next(err);
  }
});
```

Trampas conocidas de `mysql2`:

- `LIMIT ?` / `OFFSET ?` con `execute` puede fallar con números: pasalos con `String(n)` (después de validarlos con Zod) o usá `pool.query` con placeholders.
- `SUM()` / `COUNT()` devuelven `DECIMAL`/`BIGINT` y pueden llegar como **string**: convertir con `Number(...)` antes de responder.
- Errores de restricción: `err.code === 'ER_DUP_ENTRY'` → `409`; `'ER_NO_REFERENCED_ROW_2'` → `400`. Manejarlos en el `catch` antes de `next(err)`.

## 4. Transacción (si escribe en más de una tabla)

Usar una conexión dedicada del pool; nunca `pool.execute` dentro de la transacción.

```js
router.post('/', validate({ body: crearOrdenBody }), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { nombre, email, items } = req.valid.body;

    // Bloquear las filas que se van a leer y descontar (stock) para evitar carreras.
    const ids = items.map((i) => i.productoId);
    const [productos] = await conn.query(
      'SELECT id, nombre, precio, stock FROM productos WHERE activo = 1 AND id IN (?) FOR UPDATE',
      [ids],
    );
    // ... validar que existan todos y que alcance el stock, y armar `lineas`
    //     ({ productoId, nombre, precioUnitario, cantidad, subtotal }) con el precio de la base; si falla:
    //     await conn.rollback(); return res.status(409).json({ error: '...' });

    // Montos: enteros, calculados en el servidor, Math.round si hay porcentajes.
    const total = lineas.reduce((acc, l) => acc + l.subtotal, 0);

    const [orden] = await conn.execute('INSERT INTO ordenes (nombre, email, total) VALUES (?, ?, ?)', [
      nombre, email, total,
    ]);
    for (const l of lineas) {
      await conn.execute(
        'INSERT INTO orden_items (orden_id, producto_id, nombre, precio_unitario, cantidad, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
        [orden.insertId, l.productoId, l.nombre, l.precioUnitario, l.cantidad, l.subtotal],
      );
      await conn.execute('UPDATE productos SET stock = stock - ? WHERE id = ?', [l.cantidad, l.productoId]);
    }

    await conn.commit();
    res.status(201).json({ id: orden.insertId, total });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});
```

- `IN (?)` con array solo funciona con `conn.query` (expande el array, sigue parametrizado); con `execute` no.
- Toda salida temprana (`return res.status(...)`) dentro de la transacción hace `rollback` antes.
- `release()` siempre en `finally`.

## 5. Registrar la ruta

- Router nuevo: importarlo en [backend/src/app.js](../../../backend/src/app.js) y montarlo con `app.use('/api/<recurso>', router)` **antes** del `app.use('/api', ...)` que responde 404.
- Endpoint en un router existente: alcanza con agregarlo al archivo; verificá que no lo tape una ruta anterior (ej. `/:id` declarada antes que `/destacados`).

## 6. Probar con curl

Usar la herramienta **Bash** (Git Bash). En PowerShell 5.1 `curl` es un alias de `Invoke-WebRequest`; si no queda otra, usar `curl.exe`.

1. Verificar que la API esté arriba: `curl -s http://localhost:3001/api/health`. Si no responde, `docker start tienda-mysql` y levantar `npm run dev` en `backend/` en segundo plano (`node --watch` recarga solo al guardar).
2. **Caso válido** — esperar `200`/`201` y el JSON correcto:

   ```bash
   curl -s -w '\nHTTP %{http_code}\n' -X POST http://localhost:3001/api/ordenes \
     -H 'Content-Type: application/json' \
     -d '{"nombre":"Ana","email":"ana@example.com","items":[{"productoId":1,"cantidad":2}]}'
   ```

3. **Caso inválido** — esperar `400` con `detalles` apuntando al campo:

   ```bash
   curl -s -w '\nHTTP %{http_code}\n' -X POST http://localhost:3001/api/ordenes \
     -H 'Content-Type: application/json' \
     -d '{"nombre":"","email":"no-es-email","items":[{"productoId":1,"cantidad":1.5}]}'
   ```

   Para GET con params/query, el inválido es del estilo `/api/ordenes/abc` o `?precioMax=-1`.
4. Si el endpoint escribe, confirmar el efecto en la base con el MCP `tienda-mysql` (`SELECT` de las filas tocadas) y, con transacción, que un caso que falla a mitad de camino (ej. stock insuficiente) no deja filas a medias.
5. Mirar la consola del servidor: no debe haber errores inesperados.

Reportá los dos comandos curl con su status y respuesta reales. Si alguno no dio lo esperado, decilo y corregí antes de dar el endpoint por terminado.

## Checklist final

- [ ] Toda entrada pasa por Zod; la ruta usa solo `req.valid`.
- [ ] Cero valores interpolados en SQL; columnas/orden dinámicos con lista blanca.
- [ ] Montos enteros en PYG, calculados en el servidor, `Math.round` donde corresponda.
- [ ] Transacción con conexión dedicada, `rollback` en errores y salidas tempranas, `release` en `finally`.
- [ ] Ruta montada en `app.js` antes del 404.
- [ ] curl válido y curl inválido ejecutados, con resultado esperado.
- [ ] `schema.sql` actualizado si cambió alguna tabla.
