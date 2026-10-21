#!/usr/bin/env node
// Mission Control: recibe los eventos de los hooks de Claude Code (POST /events),
// arma el estado de cada sesión y sus agentes, y lo transmite en vivo a la página
// por Server-Sent Events (GET /stream). Sin dependencias: solo módulos de Node.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PUERTO = Number(process.env.MISSION_CONTROL_PORT) || 5055;
const HOST = '127.0.0.1';
const MAX_BODY = 64 * 1024;
const MAX_EVENTOS = 200;
const MAX_HISTORIAL = 8;
const RETENCION_TERMINADOS_MS = 15 * 60 * 1000;
const SESION_ABANDONADA_MS = 2 * 60 * 60 * 1000;

const EVENTOS_VALIDOS = new Set([
  'SessionStart',
  'SessionEnd',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'Notification',
  'Stop',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
]);
const HERRAMIENTAS_DE_AGENTE = new Set(['Agent', 'Task']);

const sesiones = new Map(); // session_id -> sesión
const eventos = []; // últimos eventos, para el feed
const clientes = new Set(); // respuestas SSE abiertas

// ---------- Estado ----------

function obtenerSesion(ev, ahora) {
  let sesion = sesiones.get(ev.session_id);
  if (!sesion) {
    sesion = {
      id: ev.session_id,
      cwd: ev.cwd || '',
      inicio: ahora,
      ultimo: ahora,
      terminada: false,
      agentes: new Map(),
      tareasPendientes: [], // descripciones de Agent/Task aún sin SubagentStart
    };
    sesion.agentes.set('principal', nuevoAgente('principal', 'Agente principal', true, ahora));
    sesiones.set(ev.session_id, sesion);
  }
  if (ev.cwd) sesion.cwd = ev.cwd;
  sesion.ultimo = ahora;
  return sesion;
}

function nuevoAgente(id, nombre, esPrincipal, ahora) {
  return {
    id,
    nombre,
    esPrincipal,
    estado: 'inactivo', // trabajando | esperando | inactivo | terminado
    descripcion: null,
    herramienta: null,
    objetivo: null,
    ultimaHerramienta: null,
    ultimoObjetivo: null,
    mensaje: null,
    historial: [],
    usos: 0,
    inicio: ahora,
    ultimo: ahora,
    fin: null,
  };
}

function subagentesActivos(sesion) {
  return [...sesion.agentes.values()].filter((a) => !a.esPrincipal && a.estado !== 'terminado');
}

// A qué agente corresponde el evento. Los hooks que corren dentro de un subagente
// traen agent_id; si no viene y el principal está bloqueado esperando un único
// subagente, el evento es de ese subagente.
function resolverAgente(sesion, ev, ahora) {
  if (ev.agent_id) {
    let agente = sesion.agentes.get(ev.agent_id);
    if (!agente) {
      agente = nuevoAgente(ev.agent_id, ev.agent_type || 'subagente', false, ahora);
      sesion.agentes.set(ev.agent_id, agente);
    }
    return agente;
  }
  const principal = sesion.agentes.get('principal');
  const esperandoSubagente = HERRAMIENTAS_DE_AGENTE.has(principal.herramienta);
  const esDeHerramienta = ev.hook_event_name.includes('ToolUse');
  if (esperandoSubagente && esDeHerramienta && !HERRAMIENTAS_DE_AGENTE.has(ev.tool_name)) {
    const activos = subagentesActivos(sesion);
    if (activos.length === 1) return activos[0];
  }
  return principal;
}

function rutaRelativa(ruta, cwd) {
  if (typeof ruta !== 'string') return null;
  const normal = ruta.replace(/\\/g, '/');
  const base = (cwd || '').replace(/\\/g, '/').replace(/\/$/, '');
  if (base && normal.toLowerCase().startsWith(base.toLowerCase() + '/')) {
    return normal.slice(base.length + 1);
  }
  return normal;
}

// Lo que "toca" la herramienta: archivo, patrón, comando, URL...
function objetivoDe(toolName, input, cwd) {
  if (!input) return null;
  const archivo = input.file_path || input.notebook_path;
  if (archivo) return rutaRelativa(archivo, cwd);
  if (input.pattern) {
    const donde = input.path ? ` en ${rutaRelativa(input.path, cwd)}` : '';
    return `${input.pattern}${donde}`;
  }
  if (input.command) return input.command;
  if (input.url) return input.url;
  if (input.query) return input.query;
  if (input.description) return input.description;
  if (input.skill) return input.skill;
  if (input.path) return rutaRelativa(input.path, cwd);
  const primerTexto = Object.values(input).find((v) => typeof v === 'string');
  return primerTexto || null;
}

function procesar(ev) {
  const ahora = Date.now();
  const sesion = obtenerSesion(ev, ahora);
  const nombre = ev.hook_event_name;
  let agente;

  if (nombre === 'SubagentStart') {
    const id = ev.agent_id || `sub-${ahora}`;
    agente = sesion.agentes.get(id) || nuevoAgente(id, ev.agent_type || 'subagente', false, ahora);
    agente.nombre = ev.agent_type || agente.nombre;
    const i = sesion.tareasPendientes.findIndex((t) => !t.tipo || t.tipo === ev.agent_type);
    if (i !== -1) agente.descripcion = sesion.tareasPendientes.splice(i, 1)[0].descripcion;
    agente.estado = 'trabajando';
    agente.mensaje = null;
    sesion.agentes.set(id, agente);
  } else {
    agente = resolverAgente(sesion, ev, ahora);
  }

  const objetivo = objetivoDe(ev.tool_name, ev.tool_input, sesion.cwd);

  switch (nombre) {
    case 'SessionStart':
      sesion.terminada = false;
      agente.mensaje = `sesión iniciada (${ev.source || 'startup'})`;
      break;
    case 'UserPromptSubmit':
      agente.estado = 'trabajando';
      agente.herramienta = null;
      agente.mensaje = ev.prompt ? `“${ev.prompt}”` : null;
      break;
    case 'PreToolUse':
      agente.estado = 'trabajando';
      agente.herramienta = ev.tool_name || '?';
      agente.objetivo = objetivo;
      agente.mensaje = null;
      agente.usos += 1;
      agente.historial.unshift({ herramienta: agente.herramienta, objetivo, ts: ahora, resultado: 'en curso' });
      agente.historial.length = Math.min(agente.historial.length, MAX_HISTORIAL);
      if (HERRAMIENTAS_DE_AGENTE.has(ev.tool_name)) {
        sesion.tareasPendientes.push({
          tipo: ev.tool_input?.subagent_type,
          descripcion: ev.tool_input?.description || null,
        });
      }
      break;
    case 'PostToolUse':
    case 'PostToolUseFailure': {
      const fallo = nombre === 'PostToolUseFailure';
      const entrada = agente.historial.find((h) => h.resultado === 'en curso' && h.herramienta === ev.tool_name);
      if (entrada) entrada.resultado = fallo ? 'error' : 'ok';
      agente.ultimaHerramienta = ev.tool_name || agente.herramienta;
      agente.ultimoObjetivo = objetivo || agente.objetivo;
      agente.herramienta = null;
      agente.objetivo = null;
      if (agente.estado !== 'terminado') agente.estado = 'trabajando';
      agente.mensaje = fallo && ev.error ? `falló: ${ev.error}` : null;
      break;
    }
    case 'Notification':
      agente.estado = 'esperando';
      agente.mensaje = ev.message || 'esperando al usuario';
      break;
    case 'PreCompact':
      agente.mensaje = 'compactando contexto…';
      break;
    case 'Stop':
      agente.estado = 'inactivo';
      agente.herramienta = null;
      agente.objetivo = null;
      agente.mensaje = 'turno terminado';
      break;
    case 'SubagentStop':
      agente.estado = 'terminado';
      agente.herramienta = null;
      agente.objetivo = null;
      agente.fin = ahora;
      agente.mensaje = null;
      break;
    case 'SessionEnd':
      sesion.terminada = true;
      for (const a of sesion.agentes.values()) {
        a.estado = 'terminado';
        a.herramienta = null;
        a.fin = a.fin || ahora;
      }
      agente.mensaje = `sesión cerrada (${ev.reason || 'fin'})`;
      break;
  }
  agente.ultimo = ahora;

  eventos.unshift({
    ts: ahora,
    sesion: sesion.id,
    agente: agente.nombre,
    esPrincipal: agente.esPrincipal,
    evento: nombre,
    herramienta: ev.tool_name || null,
    objetivo,
    detalle: nombre === 'Notification' ? ev.message : nombre === 'UserPromptSubmit' ? ev.prompt : null,
  });
  eventos.length = Math.min(eventos.length, MAX_EVENTOS);
}

function podar() {
  const ahora = Date.now();
  for (const [id, sesion] of sesiones) {
    const vieja = ahora - sesion.ultimo;
    if ((sesion.terminada && vieja > RETENCION_TERMINADOS_MS) || vieja > SESION_ABANDONADA_MS) {
      sesiones.delete(id);
      continue;
    }
    for (const [agenteId, agente] of sesion.agentes) {
      if (!agente.esPrincipal && agente.estado === 'terminado' && ahora - agente.fin > RETENCION_TERMINADOS_MS) {
        sesion.agentes.delete(agenteId);
      }
    }
  }
}

function snapshot() {
  const lista = [...sesiones.values()]
    .sort((a, b) => a.terminada - b.terminada || b.ultimo - a.ultimo)
    .map((s) => ({
      id: s.id,
      cwd: s.cwd,
      proyecto: path.basename(s.cwd || '') || 'sin carpeta',
      inicio: s.inicio,
      ultimo: s.ultimo,
      terminada: s.terminada,
      agentes: [...s.agentes.values()],
    }));
  return { ahora: Date.now(), sesiones: lista, eventos: eventos.slice(0, 80) };
}

function transmitir() {
  const datos = `data: ${JSON.stringify(snapshot())}\n\n`;
  for (const res of clientes) res.write(datos);
}

// ---------- Validación ----------

function validarEvento(cuerpo) {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return 'el cuerpo debe ser un objeto JSON';
  if (typeof cuerpo.session_id !== 'string' || cuerpo.session_id === '') return 'falta session_id';
  if (!EVENTOS_VALIDOS.has(cuerpo.hook_event_name)) return `hook_event_name inválido: ${cuerpo.hook_event_name}`;
  for (const campo of ['cwd', 'tool_name', 'agent_id', 'agent_type', 'message', 'prompt', 'error', 'source', 'reason']) {
    if (cuerpo[campo] !== undefined && typeof cuerpo[campo] !== 'string') return `${campo} debe ser texto`;
  }
  if (cuerpo.tool_input !== undefined && (typeof cuerpo.tool_input !== 'object' || Array.isArray(cuerpo.tool_input))) {
    return 'tool_input debe ser un objeto';
  }
  return null;
}

// ---------- HTTP ----------

const PAGINA = path.join(__dirname, 'public', 'index.html');

function responder(res, estado, cuerpo, tipo = 'application/json; charset=utf-8') {
  res.writeHead(estado, { 'Content-Type': tipo, 'Cache-Control': 'no-store' });
  res.end(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo));
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let datos = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      datos += chunk;
      if (datos.length > MAX_BODY) {
        reject(new Error('cuerpo demasiado grande'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(datos));
    req.on('error', reject);
  });
}

const servidor = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'POST' && pathname === '/events') {
    let cuerpo;
    try {
      cuerpo = JSON.parse(await leerCuerpo(req));
    } catch (err) {
      return responder(res, 400, { error: err.message });
    }
    const error = validarEvento(cuerpo);
    if (error) return responder(res, 400, { error });
    procesar(cuerpo);
    transmitir();
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'GET' && pathname === '/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    res.write(`retry: 2000\ndata: ${JSON.stringify(snapshot())}\n\n`);
    clientes.add(res);
    req.on('close', () => clientes.delete(res));
    return;
  }

  if (req.method === 'GET' && pathname === '/api/estado') return responder(res, 200, snapshot());

  if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    return fs.readFile(PAGINA, 'utf8', (err, html) =>
      err ? responder(res, 500, { error: 'no se pudo leer index.html' }) : responder(res, 200, html, 'text/html; charset=utf-8')
    );
  }

  responder(res, 404, { error: 'no encontrado' });
});

// Latido para que proxies y navegadores no corten el SSE, y poda de lo viejo.
setInterval(() => {
  for (const res of clientes) res.write(': ping\n\n');
}, 15000);
setInterval(() => {
  podar();
  transmitir();
}, 60000);

servidor.listen(PUERTO, HOST, () => {
  console.log(`Mission Control escuchando en http://${HOST}:${PUERTO}`);
});
