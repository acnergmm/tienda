import { Router } from 'express';
import { pool } from '../db.js';
import { validate } from '../middleware/validate.js';
import { listarProductosQuery, productoIdParams } from '../schemas/productos.js';

const router = Router();

const SELECT_PRODUCTOS = `
  SELECT p.id, p.nombre, p.descripcion, p.precio, p.stock, p.imagen_url,
         c.id AS categoria_id, c.nombre AS categoria_nombre, c.slug AS categoria_slug
  FROM productos p
  JOIN categorias c ON c.id = p.categoria_id
  WHERE p.activo = 1`;

function toProducto(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    precio: row.precio,
    stock: row.stock,
    imagenUrl: row.imagen_url,
    categoria: { id: row.categoria_id, nombre: row.categoria_nombre, slug: row.categoria_slug },
  };
}

// Escapa los comodines de LIKE para que el texto se busque literal.
function escapeLike(text) {
  return text.replace(/[\\%_]/g, '\\$&');
}

router.get('/', validate({ query: listarProductosQuery }), async (req, res, next) => {
  try {
    const { categoria, q } = req.valid.query;
    let sql = SELECT_PRODUCTOS;
    const values = [];

    if (categoria) {
      sql += ' AND c.slug = ?';
      values.push(categoria);
    }
    if (q) {
      sql += ' AND p.nombre LIKE ?';
      values.push(`%${escapeLike(q)}%`);
    }
    sql += ' ORDER BY c.id, p.nombre';

    const [rows] = await pool.execute(sql, values);
    res.json(rows.map(toProducto));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', validate({ params: productoIdParams }), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`${SELECT_PRODUCTOS} AND p.id = ?`, [req.valid.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(toProducto(rows[0]));
  } catch (err) {
    next(err);
  }
});

export default router;
