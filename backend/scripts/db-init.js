// Inicializa una base vacía con el esquema y los datos de ejemplo.
// Se niega a correr si la base ya tiene tablas: nunca borra datos.
// multipleStatements se habilita solo acá: ejecuta archivos fijos del repo, nunca entrada de usuarios.
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';

const dbDir = new URL('../db/', import.meta.url);

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true,
});

try {
  const [tablas] = await connection.execute(
    'SELECT table_name FROM information_schema.tables WHERE table_schema = ?',
    [process.env.DB_NAME],
  );
  if (tablas.length > 0) {
    console.error(`La base "${process.env.DB_NAME}" ya tiene ${tablas.length} tablas. No se modificó nada.`);
    process.exitCode = 1;
  } else {
    for (const file of ['schema.sql', 'seed.sql']) {
      const sql = await readFile(new URL(file, dbDir), 'utf8');
      await connection.query(sql);
      console.log(`✔ ${file}`);
    }
    const [[{ total }]] = await connection.query('SELECT COUNT(*) AS total FROM productos');
    console.log(`Base lista: ${total} productos.`);
  }
} finally {
  await connection.end();
}
