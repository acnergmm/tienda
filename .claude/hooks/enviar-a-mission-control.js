#!/usr/bin/env node
// Hook para todos los eventos: reenvía un resumen del evento a Mission Control
// (ops/mission-control, http://127.0.0.1:5055). Nunca bloquea al agente: si el
// tablero no está levantado o tarda, sale con código 0 sin decir nada.

const URL_TABLERO = process.env.MISSION_CONTROL_URL || 'http://127.0.0.1:5055/events';
const MAX_TEXTO = 300;

// Solo se mandan estos campos; tool_response y el contenido de los archivos quedan afuera.
const CAMPOS = [
  'session_id',
  'cwd',
  'hook_event_name',
  'tool_name',
  'tool_use_id',
  'agent_id',
  'agent_type',
  'source',
  'reason',
  'message',
  'notification_type',
  'prompt',
  'error',
  'trigger',
];

function recortar(valor) {
  return typeof valor === 'string' && valor.length > MAX_TEXTO ? valor.slice(0, MAX_TEXTO) + '…' : valor;
}

// De tool_input solo los valores simples (rutas, patrones, comandos), recortados.
function resumirEntrada(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return undefined;
  const resumen = {};
  for (const [clave, valor] of Object.entries(toolInput)) {
    if (['content', 'new_string', 'old_string', 'edits', 'new_source'].includes(clave)) continue;
    if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
      resumen[clave] = recortar(valor);
    }
  }
  return resumen;
}

let entrada = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (entrada += chunk));
process.stdin.on('end', async () => {
  try {
    const evento = JSON.parse(entrada);
    const payload = { ts: Date.now() };
    for (const campo of CAMPOS) {
      if (evento[campo] !== undefined) payload[campo] = recortar(evento[campo]);
    }
    payload.tool_input = resumirEntrada(evento.tool_input);

    await fetch(URL_TABLERO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(800),
    });
  } catch {
    // Tablero apagado, JSON inválido o timeout: se ignora a propósito.
  }
  process.exit(0);
});
