// Lanza el servidor MCP de MySQL para Claude Code (ver .mcp.json en la raíz).
// Toma las credenciales de backend/.env (cargado con --env-file) para no versionarlas.
// Solo lectura: INSERT, UPDATE, DELETE y DDL quedan deshabilitados.
// No escribir nada en stdout: es el canal del protocolo MCP.
import { spawn } from 'node:child_process';

// Comando fijo, sin entrada externa; shell hace falta para resolver npx.cmd en Windows.
const child = spawn('npx -y @benborla29/mcp-server-mysql@2.0.9', {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    MYSQL_HOST: process.env.DB_HOST,
    MYSQL_PORT: process.env.DB_PORT,
    MYSQL_USER: process.env.DB_USER,
    MYSQL_PASS: process.env.DB_PASSWORD,
    MYSQL_DB: process.env.DB_NAME,
    ALLOW_INSERT_OPERATION: 'false',
    ALLOW_UPDATE_OPERATION: 'false',
    ALLOW_DELETE_OPERATION: 'false',
    ALLOW_DDL_OPERATION: 'false',
  },
});

child.on('exit', (code) => process.exit(code ?? 1));
