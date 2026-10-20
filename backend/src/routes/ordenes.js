import { Router } from 'express';
import { pool } from '../db.js';
import { validate } from '../middleware/validate.js';
import { crearOrdenBody } from '../schemas/ordenes.js';

const router = Router();

router.post('/', validate({ body: crearOrdenBody }), async (req, res, next) => {
  let conn;
  try {
    const { nombre, email, items } = req.valid.body;

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // FOR UPDATE bloquea las filas hasta el commit: nadie más descuenta stock en el medio.
    const ids = items.map((i) => i.productoId).sort((a, b) => a - b);
    const [rows] = await conn.query(
      'SELECT id, nombre, precio, stock FROM productos WHERE activo = 1 AND id IN (?) ORDER BY id FOR UPDATE',
      [ids],
    );
    const productos = new Map(rows.map((row) => [row.id, row]));

    const faltantes = ids.filter((id) => !productos.has(id));
    if (faltantes.length > 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Productos no encontrados', productoIds: faltantes });
    }

    const sinStock = items
      .filter((i) => productos.get(i.productoId).stock < i.cantidad)
      .map((i) => ({
        productoId: i.productoId,
        pedido: i.cantidad,
        disponible: productos.get(i.productoId).stock,
      }));
    if (sinStock.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Stock insuficiente', detalles: sinStock });
    }

    // Precio siempre de la base, en guaraníes enteros.
    const lineas = items.map((i) => {
      const producto = productos.get(i.productoId);
      return {
        productoId: producto.id,
        nombre: producto.nombre,
        precioUnitario: producto.precio,
        cantidad: i.cantidad,
        subtotal: producto.precio * i.cantidad,
      };
    });
    const total = lineas.reduce((acc, l) => acc + l.subtotal, 0);

    const [orden] = await conn.execute('INSERT INTO ordenes (nombre, email, total) VALUES (?, ?, ?)', [
      nombre,
      email,
      total,
    ]);
    for (const l of lineas) {
      await conn.execute(
        'INSERT INTO orden_items (orden_id, producto_id, nombre, precio_unitario, cantidad, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
        [orden.insertId, l.productoId, l.nombre, l.precioUnitario, l.cantidad, l.subtotal],
      );
      await conn.execute('UPDATE productos SET stock = stock - ? WHERE id = ?', [l.cantidad, l.productoId]);
    }

    await conn.commit();
    res.status(201).json({ id: orden.insertId, nombre, email, total, items: lineas });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    next(err);
  } finally {
    conn?.release();
  }
});

export default router;
