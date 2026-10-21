import express from 'express';
import { pool } from './db.js';
import productosRouter from './routes/productos.js';
import categoriasRouter from './routes/categorias.js';
import ordenesRouter from './routes/ordenes.js';

export const app = express();

app.disable('x-powered-by');
app.use(express.json());

app.get('/api/health', async (req, res, next) => {
  try {
    await pool.execute('SELECT 1');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.use('/api/productos', productosRouter);
app.use('/api/categorias', categoriasRouter);
app.use('/api/orders', ordenesRouter);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Errores de express.json() causados por el cliente: 400 con la misma forma que validate().
const erroresBody = {
  'entity.parse.failed': { error: 'JSON inválido', mensaje: 'El body no es JSON válido' },
  'entity.too.large': { error: 'Datos inválidos', mensaje: 'El body supera el tamaño máximo permitido' },
  'charset.unsupported': { error: 'Datos inválidos', mensaje: 'Charset no soportado; usá UTF-8' },
  'encoding.unsupported': { error: 'Datos inválidos', mensaje: 'Content-Encoding no soportado' },
};

// Error genérico: el detalle queda en el log del servidor, nunca en la respuesta.
app.use((err, req, res, next) => {
  if (typeof err.type === 'string' && Object.hasOwn(erroresBody, err.type)) {
    const { error, mensaje } = erroresBody[err.type];
    return res.status(400).json({ error, detalles: [{ campo: 'body', mensaje }] });
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});
