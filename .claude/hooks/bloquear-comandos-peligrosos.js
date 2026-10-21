#!/usr/bin/env node
// Hook PreToolUse: bloquea comandos de shell destructivos antes de que se ejecuten.
// Recibe por stdin el JSON del hook; si el comando es peligroso sale con código 2
// y el mensaje de stderr le llega al agente como explicación del bloqueo.

const REGLAS_SQL = [
  {
    patron: /\bdrop\s+(temporary\s+)?table\b/i,
    nombre: 'DROP TABLE',
    motivo:
      'borra la tabla y todos sus datos de la base `tienda` de forma irreversible (no hay papelera ni backup automático).',
  },
  {
    patron: /\bdrop\s+(database|schema)\b/i,
    nombre: 'DROP DATABASE',
    motivo:
      'elimina la base `tienda` completa: todas las tablas (categorías, productos, órdenes) y sus datos, sin forma de recuperarlos.',
  },
];

// Flags cortos de GNU rm combinables (-rf, -fR, -rfv, ...).
const FLAGS_CORTOS_RM = /^-[fiIrRdv]+$/;
// Parámetros de PowerShell Remove-Item (admite abreviaturas: -r, -rec, -fo, ...).
const PS_RECURSE = /^-r(e(c(u(r(s(e)?)?)?)?)?)?$/i;
const PS_FORCE = /^-fo(r(c(e)?)?)?$/i;

function esBorradoRecursivoForzado(comando) {
  // Cada invocación de rm / Remove-Item hasta el próximo separador de comandos.
  const invocaciones = comando.matchAll(/(?:^|[\s;&|(){}`'"])(rm|remove-item)(?=\s)([^;&|\n)]*)/gi);
  for (const [, , args] of invocaciones) {
    let recursivo = false;
    let forzado = false;
    for (const token of args.trim().split(/\s+/)) {
      if (FLAGS_CORTOS_RM.test(token)) {
        if (/[rR]/.test(token)) recursivo = true;
        if (token.includes('f')) forzado = true;
      }
      if (token === '--recursive' || PS_RECURSE.test(token)) recursivo = true;
      if (token === '--force' || PS_FORCE.test(token)) forzado = true;
    }
    if (recursivo && forzado) return true;
  }
  return false;
}

function bloquear(nombre, motivo, comando) {
  process.stderr.write(
    `Comando bloqueado por el hook de proyecto (.claude/hooks/bloquear-comandos-peligrosos.js).\n` +
      `Contiene ${nombre}: ${motivo}\n` +
      `Comando: ${comando}\n\n` +
      `En este proyecto no se ejecutan operaciones destructivas desde el agente. ` +
      `No intentes reformular el comando para esquivar este control. ` +
      `Si de verdad hace falta, explicale al usuario qué querés hacer y por qué, ` +
      `y dejá que lo ejecute él manualmente.\n`
  );
  process.exit(2);
}

let entrada = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (entrada += chunk));
process.stdin.on('end', () => {
  let comando;
  try {
    comando = JSON.parse(entrada)?.tool_input?.command;
  } catch {
    process.exit(0);
  }
  if (typeof comando !== 'string' || comando === '') process.exit(0);

  for (const { patron, nombre, motivo } of REGLAS_SQL) {
    if (patron.test(comando)) bloquear(nombre, motivo, comando);
  }

  if (esBorradoRecursivoForzado(comando)) {
    bloquear(
      'rm -rf (borrado recursivo forzado)',
      'borra carpetas enteras sin pedir confirmación ni pasar por la papelera; un path mal armado puede llevarse el proyecto, node_modules de otro lado o archivos fuera del repo.',
      comando
    );
  }

  process.exit(0);
});
