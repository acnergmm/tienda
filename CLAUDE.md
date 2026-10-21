# Tienda online

## Stack

- **Frontend**: React + Tailwind CSS, en `/frontend`
- **Backend**: Node.js + Express, en `/backend`
- **Base de datos**: MySQL corriendo en Docker
  - Contenedor: `tienda-mysql`
  - Base: `tienda`
  - Usuario: `root` / Clave: `root` (solo para desarrollo local)

Las credenciales de la base se leen desde variables de entorno (`backend/.env`), nunca hardcodeadas en el código. El `.env` no se commitea; se versiona un `.env.example`.

## Reglas

### Precios en guaraníes enteros

- Todos los precios y montos son **guaraníes (PYG) como números enteros**. El guaraní no usa decimales.
- En MySQL: columnas de dinero como `INT UNSIGNED` o `BIGINT UNSIGNED`. Nunca `FLOAT`, `DOUBLE` ni `DECIMAL` con decimales.
- En JS: los montos son `number` enteros. Nada de `toFixed`, divisiones por 100 ni "centavos".
- Al calcular (descuentos, impuestos, totales), redondear explícitamente con `Math.round` y guardar el resultado entero.
- Mostrar en el frontend con `Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 })` → `Gs. 150.000`.

### SQL siempre con parámetros

- Toda consulta usa placeholders (`?`) con `mysql2` (`execute` / `query` con array de valores).
- **Prohibido** concatenar o interpolar valores en strings SQL (`` `... WHERE id = ${id}` ``), aunque el valor "parezca seguro".
- Si hace falta un nombre de columna u orden dinámico, validarlo contra una lista blanca fija; nunca pasarlo tal cual desde el request.

```js
// Bien
const [rows] = await pool.execute('SELECT * FROM productos WHERE id = ?', [id]);

// Mal
const [rows] = await pool.query(`SELECT * FROM productos WHERE id = ${id}`);
```

### Validar con Zod

- Toda entrada al backend (`req.body`, `req.params`, `req.query`) se valida con un esquema Zod antes de usarla.
- Los esquemas viven junto a la ruta o en `backend/src/schemas/`.
- Usar `safeParse` y responder `400` con los errores si falla; trabajar solo con `result.data`, no con el `req` crudo.
- Los precios se validan como enteros no negativos: `z.number().int().nonnegative()` (o `z.coerce.number().int()...` para query params).
- En el frontend, validar formularios con los mismos esquemas Zod cuando aplique.

## Comandos útiles

```bash
# Levantar MySQL
docker start tienda-mysql

# Entrar a la consola de MySQL
docker exec -it tienda-mysql mysql -uroot -proot tienda

# Backend (API en http://localhost:3001)
cd backend && npm run dev

# Frontend (http://localhost:5173, con proxy de /api al backend)
cd frontend && npm run dev

# Crear tablas y datos de ejemplo en una base VACÍA (se niega si ya hay tablas)
cd backend && npm run db:init

# Mission Control: tablero en vivo de los agentes (http://127.0.0.1:5055)
cd ops/mission-control && npm start
```

## Mission Control

`ops/mission-control` es un servidor Node sin dependencias que recibe los eventos de los hooks (`POST /events`) y los muestra en vivo (SSE en `/stream`): un mapa por sesión con el agente principal y sus subagentes como tarjetas, con la herramienta en uso y el archivo que tocan. En `.claude/settings.json`, todos los eventos llaman a `.claude/hooks/enviar-a-mission-control.js`, que manda un resumen recortado (sin el contenido de los archivos ni las respuestas de las herramientas) y nunca bloquea: si el tablero está apagado, sale con 0 sin hacer nada. Escucha solo en `127.0.0.1` y guarda el estado en memoria.

## Servidor MCP de MySQL

`.mcp.json` registra el servidor `tienda-mysql` (`@benborla29/mcp-server-mysql`), que se lanza con `backend/scripts/mcp-mysql.js`. Toma las credenciales de `backend/.env` y es **solo lectura** (INSERT/UPDATE/DELETE/DDL deshabilitados). Requiere que `tienda-mysql` esté corriendo.

`backend/db/schema.sql` refleja el esquema real de la base `tienda` (categorías, productos, órdenes). Si cambiás tablas en la base, actualizá ese archivo.
