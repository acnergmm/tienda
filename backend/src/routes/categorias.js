import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT id, nombre, slug FROM categorias ORDER BY id');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
