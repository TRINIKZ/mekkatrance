const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { randomBytes, randomInt, randomUUID, createHash, timingSafeEqual } = require('node:crypto');
const { pipeline } = require('node:stream/promises');

const root = __dirname;
const dataDir = path.resolve(process.env.RPG_DATA_DIR || path.join(root, '.rpg-data'));
const allowedOrigins = new Set((process.env.RPG_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean));
// Catálogo de cenários: usado pela validação de ações e pelo diagnóstico.
const sceneSizes = Object.freeze({ docks: 12, lab: 12, ruins: 12, city: 50 });
const scenes = new Set(Object.keys(sceneSizes));
const sceneCatalog = Object.entries(sceneSizes).map(([id, size]) => ({ id, width: size, height: size }));
const dice = new Set([4, 6, 8, 10, 12, 20, 100]);
const colors = ['#f4a24c', '#65c7c4', '#9d95ed', '#82bd73', '#e27f92', '#7fa8e2'];
const TABLE_ID = 'OVERKILL'; // Mesa única compartilhada, sem convites.
const rooms = new Map();
const tickets = new Map();
const admissions = new Map();

// ================= ADMIN / MESTRE — CREDENCIAIS (SOMENTE SERVIDOR) =================
// Use variáveis de ambiente em produção. Nenhuma credencial é enviada ao navegador.
const ADMIN_USER = process.env.RPG_ADMIN_USER || 'trinikz';
const ADMIN_PASSWORD_HASH = process.env.RPG_ADMIN_PASSWORD
  ? secretHash(process.env.RPG_ADMIN_PASSWORD)
  : '1bc62ed309f461f1ea642ac6b88fee37d542ef7d6b81f0770a333e06a7e7082b'; // SHA-256 da senha inicial solicitada
const adminSessions = new Set(); // autorizações por sessão de membro; reiniciar revoga todas
const adminAttempts = new Map();
const isAdmin = member => adminSessions.has(member.id);
function verifyAdmin(req, body) {
  const key = req.socket.remoteAddress;
  const now = Date.now();
  let attempt = adminAttempts.get(key);
  if (!attempt || attempt.until <= now) { attempt = { count: 0, until: now + 60000 }; adminAttempts.set(key, attempt); }
  if (++attempt.count > 5) throw new ApiError(429, 'Muitas tentativas. Aguarde um minuto.');
  const password = typeof body.password === 'string' ? body.password : '';
  const valid = timingSafeEqual(Buffer.from(secretHash(password), 'hex'), Buffer.from(ADMIN_PASSWORD_HASH, 'hex'));
  if (body.username !== ADMIN_USER || !valid) throw new ApiError(403, 'Usuário ou senha incorretos.');
}


class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req, maxBytes = 4096) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new ApiError(415, 'Envie os dados em JSON.');
  }
  if (Number(req.headers['content-length']) > maxBytes) throw new ApiError(413, 'Pedido muito grande.');
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > maxBytes) throw new ApiError(413, 'Pedido muito grande.');
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (body && typeof body === 'object' && !Array.isArray(body)) return body;
  } catch {
    // All malformed bodies share the same client-facing error.
  }
  throw new ApiError(400, 'Dados inválidos.');
}

function nameOf(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 40 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new ApiError(400, 'Informe um nome de até 40 caracteres.');
  }
  return value.trim();
}

function colorOf(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string' || !/^#[a-f\d]{6}$/i.test(value)) {
    throw new ApiError(400, 'Escolha uma cor válida.');
  }
  return value.toLowerCase();
}

// URLs de recursos públicos; nunca são baixadas pelo servidor.
function mediaUrl(value) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string' || value.length > 1500 || /[\s\\]/.test(value)) throw new ApiError(400, 'Informe um endereço de mídia válido.');
  if (/^\/(?!\/)[a-zA-Z0-9]/.test(value)) return value;
  try { const url = new URL(value); if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return url.href; } catch {}
  throw new ApiError(400, 'Use um link HTTP(S) ou caminho público iniciado por /.');
}

// Retratos enviados pelo jogador: apenas imagens raster, nunca HTML/SVG.
const portraitDir = path.join(dataDir, 'portraits');
function playerPortrait(value) {
  if (typeof value !== 'string' || !value) throw new ApiError(400, 'Escolha uma imagem ou informe seu link.');
  if (!value.startsWith('data:')) return mediaUrl(value);
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new ApiError(400, 'Imagem inválida. Use PNG, JPEG ou WebP.');
  const bytes = Buffer.from(match[2], 'base64');
  const kind = match[1];
  const valid = kind === 'png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : kind === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
  if (!valid || bytes.length > 1024*1024) throw new ApiError(400, 'Imagem inválida ou acima de 1 MB após otimização.');
  const file = randomUUID() + '.' + kind;
  fs.writeFileSync(path.join(portraitDir, file), bytes, { mode: 0o600 });
  return '/api/portraits/' + file;
}
function sharedTable() {
  if (rooms.has(TABLE_ID)) return loadRoom(TABLE_ID);
  if (fs.existsSync(path.join(dataDir, TABLE_ID + '.json'))) return loadRoom(TABLE_ID);
  const room = roomInstance({ code: TABLE_ID, scene: 'docks', revision: 0, members: [], tokens: [], history: [] });
  rooms.set(TABLE_ID, room);
  return room;
}
function addMaster(data) {
  const id = randomUUID(), secret = randomBytes(32).toString('base64url');
  data.members.push({ id, role: 'player', name: 'Mestre', color: '#ff6345', hash: secretHash(secret) });
  return { code: data.code, secret, memberId: id };
}

// Reconhece links de faixas do YouTube Music e do YouTube, sem extrair áudio.
function musicSource(value) {
  let u; try { u = new URL(value); } catch { return { provider: 'audio' }; }
  const host = u.hostname.toLowerCase();
  if (!['music.youtube.com', 'youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) return { provider: 'audio' };
  const id = host === 'youtu.be' ? u.pathname.split('/')[1] : u.searchParams.get('v') || (/^\/(?:embed|shorts|live)\/([^/]+)/.exec(u.pathname)?.[1]);
  if (!/^[A-Za-z0-9_-]{11}$/.test(id || '')) throw new ApiError(400, 'Cole o link de uma faixa ou vídeo individual do YouTube.');
  return { provider: 'youtube', videoId: id };
}

function customSpace(data, scene) { return (data?.spaces || []).find(s => s.id === scene); }
function hasScene(data, scene) { return scenes.has(scene) || Boolean(customSpace(data, scene)); }
function sceneLimit(scene, data) { return (Object.hasOwn(sceneSizes, scene) ? sceneSizes[scene] : customSpace(data, scene)?.size || 12) - 1; }
const spaceObjectSizes = { house: [2,2], building: [3,2], car: [2,1], tree: [1,1], crate: [1,1], lamp: [1,1], wall: [2,1] };
function validateSpace(body) {
  const name = nameOf(body.name), size = body.size;
  if (!Number.isInteger(size) || size < 12 || size > 50) throw new ApiError(400, 'Escolha de 12 a 50 tiles por lado.');
  if (typeof body.terrain !== 'string' || body.terrain.length !== size * size || !/^[acgdswm]+$/.test(body.terrain)) throw new ApiError(400, 'Terreno inválido.');
  if (!Array.isArray(body.objects) || body.objects.length > 300) throw new ApiError(400, 'Limite de 300 objetos por espaço.');
  const occupied = new Set();
  const objects = body.objects.map(o => {
    if (!o || !Object.hasOwn(spaceObjectSizes,o.kind) || !Number.isInteger(o.x) || !Number.isInteger(o.y) || ![0,1].includes(o.rot)) throw new ApiError(400, 'Objeto inválido.');
    const [a,b] = spaceObjectSizes[o.kind], w = o.rot ? b : a, d = o.rot ? a : b;
    if (o.x < 0 || o.y < 0 || o.x+w > size || o.y+d > size) throw new ApiError(400, 'Objeto fora do espaço.');
    for(let x=o.x;x<o.x+w;x++) for(let y=o.y;y<o.y+d;y++) { const k=x+','+y; if(occupied.has(k)) throw new ApiError(400,'Objetos sobrepostos.'); occupied.add(k); }
    return {kind:o.kind,x:o.x,y:o.y,rot:o.rot};
  });
  return {id:'space-'+randomUUID(),name,size,terrain:body.terrain,objects};
}
function coordinate(value, scene = 'docks', data) {
  const limit = sceneLimit(scene,data);
  if (!Number.isFinite(value) || value < 0 || value > limit) throw new ApiError(400, 'Escolha uma posição dentro do mapa.');
  return Math.round(value * 100) / 100;
}

function record(data, kind, text, actorId, details = {}) {
  const entry = { id: randomUUID(), at: Date.now(), kind, text, actorId, ...details };
  data.history.push(entry);
  if (data.history.length > 80) data.history.shift();
  return entry;
}

function secretHash(secret) {
  return createHash('sha256').update(secret).digest('hex');
}

// ================= ACESSO PERSISTENTE DE PERSONAGENS =================
function characterKey(name) { return name.normalize('NFKC').trim().toLocaleLowerCase('pt-BR'); }
function characterMembers(data, name) {
  const key = characterKey(name);
  return data.members.filter(m => data.tokens.some(t => t.kind === 'player' && t.ownerId === m.id && characterKey(t.name) === key));
}
function adminName(name) { return characterKey(name) === characterKey(ADMIN_USER); }
function issueSession(data, member) {
  const secret = randomBytes(32).toString('base64url');
  member.hash = secretHash(secret);
  adminSessions.delete(member.id);
  return { code: data.code, memberId: member.id, secret };
}
function revokeConnections(room, id) {
  for (const [stream, memberId] of room.clients) if (memberId === id) stream.end();
  for (const [key, ticket] of tickets) if (ticket.memberId === id) tickets.delete(key);
}
function addMember(data, role, body) {
  if (data.tokens.filter(t => t.kind === 'player').length >= 32) throw new ApiError(409, 'Esta mesa já tem 32 participantes.');
  const name = nameOf(body.name);
  if (adminName(name) || characterKey(name) === 'mestre') throw new ApiError(400, 'Nome reservado ao mestre.');
  if (characterMembers(data,name).length) throw new ApiError(409, 'Este personagem já existe. Entre pelo nome.');
  const color = colorOf(body.color, colors[data.members.length % colors.length]);
  const memberId = randomUUID();
  const secret = randomBytes(32).toString('base64url');
  const member = { id: memberId, role, name, color, hash: secretHash(secret) };
  data.members.push(member);
  const position = spawnPosition(data.tokens, data.scene, data);
  data.tokens.push({ id: randomUUID(), ownerId: memberId, kind: 'player', name, color, hp: 100, maxHp: 100, portrait: playerPortrait(body.portrait), ...position });
  record(data, 'system', name + ' entrou na mesa.', memberId);
  return { code: data.code, secret, memberId };
}

function spawnPosition(tokens, scene = 'docks', data) {
  const size = sceneLimit(scene,data) + 1;
  for (let i = 0; i < size * size; i++) {
    const x = (4 + i % size) % size;
    const y = (6 + Math.floor(i / size)) % size;
    if (tokens.every(token => Math.hypot(token.x - x, token.y - y) >= 0.8)) return { x, y };
  }
  return { x: 4, y: 6 };
}

function roomInstance(data) {
  return { data, revision: data.revision, clients: new Map(), queue: Promise.resolve(), pending: 0, used: Date.now() };
}

function loadRoom(code) {
  let room = rooms.get(code);
  if (!room) {
    try {
      const file = path.join(dataDir, code + '.json');
      const bytes = fs.readFileSync(file);
      // Aceita JSON UTF-8 com BOM e UTF-16 com BOM (editores do Windows).
      let source;
      if (bytes[0] === 0xff && bytes[1] === 0xfe) source = bytes.subarray(2).toString('utf16le');
      else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
        const content = Buffer.from(bytes.subarray(2));
        if (content.length % 2) throw new ApiError(503, 'Arquivo de dados UTF-16 incompleto. Preserve .rpg-data e confira o terminal.');
        source = content.swap16().toString('utf16le');
      } else source = bytes.toString('utf8').replace(/^\uFEFF/, '');
      let data;
      try { data = JSON.parse(source); }
      catch (err) {
        // Nunca recria uma mesa por cima de um arquivo que não foi lido.
        console.error('[RPG] JSON inválido em ' + file + ' (' + bytes.length + ' bytes). Arquivo preservado.');
        throw new ApiError(503, 'Não foi possível ler os dados salvos da mesa. Preserve a pasta .rpg-data e confira o terminal.');
      }
      if (!data || data.code !== code || !Array.isArray(data.members) || !Array.isArray(data.tokens) || !Array.isArray(data.history) || !Number.isFinite(data.revision)) {
        console.error('[RPG] Estrutura de mesa inválida em ' + file + '. Arquivo preservado.');
        throw new ApiError(503, 'Estrutura dos dados da mesa inválida. Preserve .rpg-data e confira o terminal.');
      }
      room = roomInstance(data);
    } catch (err) {
      if (err.code === 'ENOENT') throw new ApiError(404, 'Mesa indisponível.');
      throw err;
    }
    rooms.set(code, room);
  }
  room.used = Date.now();
  return room;
}

function publicState(room) {
  const { code, scene, members, tokens, history } = room.data;
  const online = new Set(room.clients.values());
  return {
    code, scene, revision: room.revision, serverTime: Date.now(), sceneCatalog: [...sceneCatalog, ...(room.data.spaces || []).map(s=>({id:s.id,name:s.name,width:s.size,height:s.size}))], space: customSpace(room.data,scene) || null, features: { drawing: true, hp: true, drawingHistory: true, brushWidth: true, persistentCharacters: true, spaceEditor: true, terrainTextures: true }, tokens: tokens.map(t => ({ ...t, hp: t.hp ?? 100, maxHp: t.maxHp ?? 100 })), history, drawings: room.data.drawings?.[scene] || [], music: room.data.music || null, musicSettings: room.data.musicSettings || { volume: room.data.music?.volume ?? .5, trackVolume: room.data.music?.trackVolume ?? 1 },
    dialogues: (room.data.dialogues || []).filter(d => d.ids.every(id => tokens.some(t => t.id === id))).slice(-1),
    members: members.map(m => ({ id: m.id, role: isAdmin(m) ? 'gm' : 'player', name: m.name, color: m.color, online: online.has(m.id) }))
  };
}

function emit(room) {
  if (!room.clients.size) return;
  const message = 'data: ' + JSON.stringify({ state: publicState(room) }) + '\n\n';
  for (const res of room.clients.keys()) {
    if (res.writableLength > 256 * 1024) res.destroy();
    else res.write(message);
  }
}

function nextRevision(room) {
  return Math.max(Date.now(), room.revision + 1);
}

// Process a room's changes in arrival order. Publish only a successfully saved snapshot.
function changeRoom(room, change) {
  room.pending++;
  const job = room.queue.then(async () => {
    const next = structuredClone(room.data);
    const result = change(next);
    next.revision = nextRevision(room);
    const file = path.join(dataDir, next.code + '.json');
    const temp = file + '.tmp';
    await fs.promises.writeFile(temp, JSON.stringify(next), { mode: 0o600 });
    await fs.promises.rename(temp, file);
    room.data = next;
    // Presence can also change while the write is in progress.
    room.revision = Math.max(next.revision, room.revision + 1);
    room.used = Date.now();
    emit(room);
    return { ...result, state: publicState(room) };
  });
  room.queue = job.catch(() => {}).finally(() => { room.pending--; });
  return job;
}

function authenticate(room, req) {
  const bearer = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization || '');
  const hash = bearer && secretHash(bearer[1]);
  const member = hash && room.data.members.find(item => item.hash === hash);
  if (!member) throw new ApiError(401, 'Sessão inválida. Entre na mesa novamente.');
  return member;
}

// ================= HP E ANOTAÇÕES DO MAPA =================
// Coordenadas no plano projetado, independentes da câmera e da resolução.
const DRAW_LIMIT = 12000;
const DRAW_RADIUS = 9;
function drawingPoints(value, scene, data) {
  const large = scene === 'city' || Boolean(customSpace(data,scene));
  const maxX = large ? 1800 : 430, minY = large ? -180 : -110, maxY = large ? 1850 : 440;
  if (!Array.isArray(value) || !value.length || value.length > 1200) throw new ApiError(400, 'Traço inválido ou muito longo.');
  const out = [];
  for (const p of value) {
    if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite) || Math.abs(p[0]) > maxX || p[1] < minY || p[1] > maxY) throw new ApiError(400, 'Ponto fora do mapa.');
    const next = p.map(v => Math.round(v*10)/10), last = out.at(-1);
    // Amostra os segmentos para permitir apagar apenas a parte tocada.
    const steps = last ? Math.max(1, Math.ceil(Math.hypot(next[0]-last[0],next[1]-last[1])/3)) : 1;
    if (out.length+steps > 4000) throw new ApiError(400, 'Traço muito longo. Solte o botão e continue.');
    for (let i=1;i<=steps;i++) out.push(last ? last.map((v,k)=>Math.round((v+(next[k]-v)*i/steps)*10)/10) : next);
  }
  return out;
}
function eraseDrawing(strokes, points, member) {
  // Índice espacial da borracha: evita comparar cada ponto com o mapa inteiro.
  const cells = new Map(), size = DRAW_RADIUS;
  for (const p of points) {
    const key = Math.floor(p[0]/size)+','+Math.floor(p[1]/size);
    if (!cells.has(key)) cells.set(key,[]);
    cells.get(key).push(p);
  }
  const touches = p => {
    const x=Math.floor(p[0]/size), y=Math.floor(p[1]/size);
    for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) {
      for(const q of cells.get((x+dx)+','+(y+dy)) || []) if(Math.hypot(p[0]-q[0],p[1]-q[1])<=DRAW_RADIUS) return true;
    }
    return false;
  };
  return strokes.flatMap(stroke => {
    if (!isAdmin(member) && stroke.ownerId !== member.id) return [stroke];
    if (!stroke.points.some(touches)) return [stroke];
    const parts=[]; let run=[];
    for(const p of stroke.points) {
      if (touches(p)) { if(run.length) parts.push(run); run=[]; }
      else run.push(p);
    }
    if(run.length) parts.push(run);
    return parts.map(points=>({...stroke,groupId:stroke.groupId || stroke.id,id:randomUUID(),points}));
  });
}
function runAction(data, member, body) {
  if (!data.members.some(m => m.id === member.id && m.hash === member.hash)) throw new ApiError(401, 'Sessão inválida.');
  const { type } = body;
  if (typeof type !== 'string') throw new ApiError(400, 'Ação inválida.');
  if (type === 'hp.set') {
    if (!isAdmin(member)) throw new ApiError(403, 'Somente o mestre pode alterar HP.');
    const t = data.tokens.find(t => t.id === body.tokenId && t.kind === 'player');
    if (!t) throw new ApiError(404, 'Personagem não encontrado.');
    if (!Number.isInteger(body.maxHp) || body.maxHp < 1 || body.maxHp > 999999 || !Number.isInteger(body.hp) || body.hp < 0 || body.hp > body.maxHp) throw new ApiError(400, 'HP deve estar entre zero e o máximo (1–999999).');
    t.hp = body.hp; t.maxHp = body.maxHp;
    return;
  }
  if (['draw.add','draw.erase','draw.undo','draw.redo'].includes(type)) {
    const own = data.tokens.find(t => t.kind === 'player' && t.ownerId === member.id);
    const gm = isAdmin(member);
    if (!gm && !own) throw new ApiError(403, 'Entre com um personagem para desenhar.');
    if (body.scene !== data.scene || !hasScene(data,body.scene)) throw new ApiError(409, 'O cenário mudou. Faça a marcação novamente.');
    const maps = data.drawings ||= {};
    const strokes = maps[data.scene] ||= [];
    const histories = data.drawingRedo ||= {};
    const sceneHistory = histories[data.scene] ||= {};
    const redo = sceneHistory[member.id] ||= [];
    // Desfazer/refazer só afeta traços do próprio autor, no cenário atual.
    if (type === 'draw.undo') {
      const last = strokes.findLast(s => s.ownerId === member.id);
      if (!last) return;
      const group = last.groupId || last.id;
      const removed = strokes.filter(s => s.ownerId === member.id && (s.groupId || s.id) === group);
      maps[data.scene] = strokes.filter(s => !removed.includes(s));
      redo.push(removed);
      // Limite por autor para não acumular um histórico ilimitado.
      while (redo.length > 50) redo.shift();
      return;
    }
    if (type === 'draw.redo') {
      const restored = redo.at(-1);
      if (!restored) return;
      if (strokes.length + restored.length > 400 || [...strokes,...restored].reduce((n,s)=>n+s.points.length,0)>DRAW_LIMIT) throw new ApiError(409, 'Limite de marcações atingido. Apague alguns traços antes de refazer.');
      strokes.push(...restored); redo.pop(); return;
    }
    const points = drawingPoints(body.points, data.scene,data);
    if (type === 'draw.erase') {
      maps[data.scene] = eraseDrawing(strokes, points, member);
      return;
    }
    if (strokes.length >= 400 || strokes.reduce((n,s)=>n+s.points.length,0)+points.length > DRAW_LIMIT) throw new ApiError(409, 'Limite de marcações do mapa atingido. Apague alguns traços.');
    const token = gm ? data.tokens.find(t=>t.id===body.tokenId) || own : own;
    const color = token ? colorOf(token.color, '#ff6345') : '#ff6345';
    const width = body.width ?? 3;
    if (!Number.isInteger(width) || width < 1 || width > 24) throw new ApiError(400, 'Espessura inválida (1–24).');
    const id = randomUUID();
    strokes.push({id, groupId:id, ownerId:member.id, color, points, width});
    sceneHistory[member.id] = [];
    return;
  }
  // ================= DIÁLOGO DIRETO — ESTADO VISUAL, SEM TEXTO =================
  if (type.startsWith('direct.')) {
    const dialogues = data.dialogues ||= [];
    if (type === 'direct.open') {
      const ids = Array.isArray(body.ids) ? body.ids : [body.speakerId, body.targetId];
      if (ids.length < 2 || ids.length > 5 || new Set(ids).size !== ids.length) throw new ApiError(400, 'Selecione de 2 a 5 personagens diferentes.');
      const tokens = ids.map(id => data.tokens.find(t => t.id === id));
      if (tokens.some(t => !t)) throw new ApiError(400, 'Personagem inválido.');
      if (!isAdmin(member)) throw new ApiError(403, 'Somente o mestre pode iniciar diálogos de grupo.');
      const participants = [...new Set([member.id, ...tokens.map(t => t.ownerId)].filter(Boolean))];
      // Uma única conversa global: todos recebem o mesmo palco, inclusive espectadores.
      data.dialogues = [{ id: randomUUID(), ids, participants, active: ids[0] }];
      return;
    }
    const dialogue = dialogues.find(d => d.id === body.dialogueId);
    if (!dialogue) return; // comando atrasado de diálogo já encerrado
    if (type === 'direct.focus') {
      if (!dialogue.ids.includes(body.speakerId)) throw new ApiError(400, 'Personagem inválido.');
      if (!isAdmin(member) && !data.tokens.some(t => t.id === body.speakerId && t.kind === 'player' && t.ownerId === member.id)) throw new ApiError(403, 'Você só pode destacar seu personagem.');
      dialogue.active = body.speakerId;
    } else if (type === 'direct.close') {
      if (!isAdmin(member)) throw new ApiError(403, 'Somente o mestre pode encerrar o diálogo para todos.');
      data.dialogues = dialogues.filter(d => d !== dialogue);
    }
    else throw new ApiError(400, 'Ação inválida.');
    return;
  }
  // ================= COMBATE — DECLARAÇÃO DE ATAQUE =================
  if (type === 'attack.declare') {
    const attacker = data.tokens.find(t => t.id === body.attackerId);
    const target = data.tokens.find(t => t.id === body.targetId);
    if (!attacker || !target || attacker === target) throw new ApiError(400, 'Escolha um atacante e um alvo diferentes.');
    if (!isAdmin(member) && (attacker.kind !== 'player' || attacker.ownerId !== member.id)) throw new ApiError(403, 'Você só pode atacar com seu personagem.');
    record(data, 'system', attacker.name + ' declarou um ataque contra ' + target.name + '.', member.id);
    return;
  }
  if (type === 'roll') {
    if (!dice.has(body.sides)) throw new ApiError(400, 'Dado inválido.');
    // O jogador nunca pode atribuir uma rolagem a uma peça alheia.
    const own = data.tokens.find(t => t.kind === 'player' && t.ownerId === member.id);
    const token = isAdmin(member) ? (body.tokenId == null ? own : data.tokens.find(t => t.id === body.tokenId)) : own;
    if (!token) throw new ApiError(400, 'Selecione um personagem antes de rolar o dado.');
    if (body.tokenId != null && token.id !== body.tokenId) throw new ApiError(isAdmin(member) ? 400 : 403, 'Personagem inválido para esta rolagem.');
    const result = randomInt(1, body.sides + 1);
    const roll = record(data, 'roll', token.name + ' rolou D' + body.sides + ' e tirou ' + result + '.', member.id, { sides: body.sides, result, tokenId: token.id });
    return { roll };
  }
  if (type === 'move') {
    const token = data.tokens.find(item => item.id === body.tokenId);
    if (!token) throw new ApiError(404, 'Personagem não encontrado.');
    if (!isAdmin(member) && (token.kind !== 'player' || token.ownerId !== member.id)) throw new ApiError(403, 'Você só pode mover seu personagem.');
    token.x = coordinate(body.x, data.scene, data);
    token.y = coordinate(body.y, data.scene, data);
    return;
  }
  if (type === 'portrait.set') {
    const token = data.tokens.find(t => t.id === body.tokenId);
    if (!token) throw new ApiError(404, 'Personagem não encontrado.');
    if (!isAdmin(member) && (token.kind !== 'player' || token.ownerId !== member.id)) throw new ApiError(403, 'Você só pode editar seu personagem.');
    token.portrait = mediaUrl(body.portrait);
    return;
  }
  // =============== ADMIN / MESTRE: AUTORIZAÇÃO NO SERVIDOR ===============
  // Somente o login validado pelo servidor autoriza.
  if (!isAdmin(member)) throw new ApiError(403, 'Esta ferramenta é exclusiva do mestre.');
  switch (type) {
    case 'space.create': {
      const spaces = data.spaces ||= [];
      if (spaces.length >= 20) throw new ApiError(409,'Limite experimental de 20 espaços.');
      const space = validateSpace(body);
      if (spaces.some(s=>characterKey(s.name)===characterKey(space.name))) throw new ApiError(409,'Já existe um espaço com esse nome.');
      spaces.push(space);
      return {spaceId:space.id};
    }
    case 'npc.add': {
      if (data.tokens.filter(token => token.kind === 'npc').length >= 48) throw new ApiError(409, 'A mesa já tem 48 NPCs.');
      const name = nameOf(body.name);
      const color = colorOf(body.color, '#ef776a');
      const position = spawnPosition(data.tokens, data.scene, data);
      const x = body.x === undefined ? position.x : coordinate(body.x, data.scene, data);
      const y = body.y === undefined ? position.y : coordinate(body.y, data.scene, data);
      data.tokens.push({ id: randomUUID(), ownerId: null, kind: 'npc', name, color, portrait: mediaUrl(body.portrait), x, y });
      record(data, 'system', member.name + ' adicionou ' + name + ' à cena.', member.id);
      break;
    }
    case 'npc.remove': {
      const index = data.tokens.findIndex(token => token.id === body.tokenId && token.kind === 'npc');
      if (index < 0) throw new ApiError(404, 'NPC não encontrado.');
      const [token] = data.tokens.splice(index, 1);
      record(data, 'system', member.name + ' removeu ' + token.name + ' da cena.', member.id);
      break;
    }
    case 'music.play': {
      const url = mediaUrl(body.url);
      if (!url) throw new ApiError(400, 'Informe a URL da música.');
      const volume = body.volume;
      if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new ApiError(400, 'Volume inválido.');
      const trackVolume = body.trackVolume ?? data.musicSettings?.trackVolume ?? 1;
      if (!Number.isFinite(trackVolume) || trackVolume < 0 || trackVolume > 1) throw new ApiError(400, 'Volume da música inválido.');
      data.musicSettings = { volume, trackVolume };
      data.music = { url, volume, trackVolume, startedAt: Date.now(), ...musicSource(url) };
      record(data, 'system', member.name + ' iniciou uma música.', member.id);
      break;
    }
    case 'music.stop':
      data.music = null;
      record(data, 'system', member.name + ' interrompeu a música.', member.id);
      break;
    case 'music.volume': {
      if (!Number.isFinite(body.volume) || body.volume < 0 || body.volume > 1) throw new ApiError(400, 'Volume inválido.');
      const settings = data.musicSettings ||= { volume: data.music?.volume ?? .5, trackVolume: data.music?.trackVolume ?? 1 };
      const field = body.channel === 'track' ? 'trackVolume' : 'volume';
      settings[field] = body.volume;
      if (data.music) data.music[field] = body.volume;
      break;
    }
    case 'scene': {
      if (!hasScene(data,body.scene)) throw new ApiError(400, 'Cena inválida. Cenários disponíveis: ' + [...scenes].join(', ') + '.');
      if (data.scene === body.scene) break;
      // Guardar a posição em cada cenário; ao regressar, recuperar a posição anterior.
      const positions = data.scenePositions ||= {};
      positions[data.scene] = Object.fromEntries(data.tokens.map(t => [t.id, {x:t.x, y:t.y}]));
      const saved = positions[body.scene] || {};
      const limit = sceneLimit(body.scene,data);
      for (const token of data.tokens) {
        const pos = saved[token.id] || token;
        token.x = Math.max(0, Math.min(limit, Number.isFinite(pos.x) ? pos.x : 4));
        token.y = Math.max(0, Math.min(limit, Number.isFinite(pos.y) ? pos.y : 6));
      }
      data.scene = body.scene;
      record(data, 'system', member.name + ' mudou a cena da mesa.', member.id);
      break;
    }
    default:
      throw new ApiError(400, 'Ação inválida.');
  }
}

function openEvents(req, res, room, ticket) {
  let member;
  if (ticket) {
    const entry = tickets.get(ticket);
    if (!entry || entry.code !== room.data.code || entry.until <= Date.now()) throw new ApiError(401, 'Conexão expirada. Reconecte à mesa.');
    tickets.delete(ticket);
    member = room.data.members.find(item => item.id === entry.memberId);
    if (!member) throw new ApiError(401, 'Sessão inválida.');
  } else {
    member = authenticate(room, req);
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive', 'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  room.clients.set(res, member.id);
  room.revision = nextRevision(room);
  emit(room);
  res.on('close', () => {
    room.clients.delete(res);
    room.used = Date.now();
    room.revision = nextRevision(room);
    emit(room);
  });
}

function checkOrigin(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;
  let host;
  try { host = new URL(origin).host; } catch {}
  if (host !== req.headers.host && !allowedOrigins.has(origin)) throw new ApiError(403, 'Origem não autorizada.');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
}

function checkAdmission(req) {
  const address = req.socket.remoteAddress;
  const now = Date.now();
  let entry = admissions.get(address);
  if (!entry || entry.until <= now) {
    entry = { count: 0, until: now + 60000 };
    admissions.set(address, entry);
  }
  if (++entry.count > 80) throw new ApiError(429, 'Muitas tentativas. Aguarde um minuto.');
}

async function api(req, res, url) {
  checkOrigin(req, res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' });
    return res.end();
  }
  if (url.pathname === '/api/table/health' && req.method === 'GET') {
    return json(res, 200, { service: 'overkill-rpg', apiVersion: 4, build: '4.9.1', status: 'ok', scenes: sceneCatalog, features: { drawing: true, hp: true, drawingHistory: true, brushWidth: true, persistentCharacters: true, city50x50: true, spaceEditor: true, terrainTextures: true } });
  }
  const portrait = /^\/api\/portraits\/([a-f0-9-]{36}\.(png|jpeg|webp))$/.exec(url.pathname);
  if (portrait && req.method === 'GET') {
    let bytes;
    try { bytes = await fs.promises.readFile(path.join(portraitDir, portrait[1])); }
    catch { throw new ApiError(404, 'Imagem não encontrada.'); }
    res.writeHead(200, { 'Content-Type': 'image/' + portrait[2], 'Cache-Control': 'public, max-age=86400' });
    return res.end(bytes);
  }
  const route = /^\/api\/table\/(join|enter|leave|state|events|stream-ticket|actions|admin-login|admin-logout)$/.exec(url.pathname);
  if (!route) throw new ApiError(404, 'Rota não encontrada.');
  const endpoint = route[1];
  const method = (endpoint === 'state' || endpoint === 'events') ? 'GET' : 'POST';
  if (req.method !== method) throw new ApiError(405, 'Método inválido.');
  const room = sharedTable();
  if (endpoint === 'join') {
    checkAdmission(req);
    const body = await readBody(req, 1500000);
    const result = await changeRoom(room, data => addMember(data, 'player', body));
    return json(res, 201, result);
  }
  if (endpoint === 'enter') {
    checkAdmission(req);
    const body = await readBody(req);
    const name = nameOf(body.name);
    // O usuário administrativo nunca é admitido como personagem pelo nome.
    if (adminName(name) || characterKey(name) === 'mestre') {
      return json(res, 200, { next: 'admin', username: ADMIN_USER });
    }
    const candidates = characterMembers(room.data, name);
    if (!candidates.length) return json(res, 200, { next: 'create' });
    // Nomes antigos duplicados: a pessoa escolhe a ficha, sem excluir dados.
    if (body.characterId == null && candidates.length > 1) {
      const choices = candidates.map(member => {
        const token = room.data.tokens.find(t => t.kind === 'player' && t.ownerId === member.id && characterKey(t.name) === characterKey(name));
        return { id: member.id, name: token.name, portrait: token.portrait || '', color: token.color, hp: token.hp ?? 100, maxHp: token.maxHp ?? 100, x: token.x, y: token.y };
      });
      return json(res, 200, { next: 'choose', choices });
    }
    const explicit = body.characterId != null;
    const match = explicit ? candidates.find(m => m.id === body.characterId) : candidates[0];
    if (!match) throw new ApiError(409, 'Ficha não encontrada para esse nome. Volte e tente novamente.');
    const result = await changeRoom(room, data => {
      const matches = characterMembers(data, name);
      const current = matches.find(m => m.id === match.id);
      if (!current || (!explicit && matches.length !== 1)) throw new ApiError(409, 'O cadastro mudou. Tente novamente.');
      return issueSession(data, current);
    });
    revokeConnections(room, match.id);
    return json(res, 200, result);
  }
  // O mestre pode entrar diretamente, sem criar personagem ou mesa.
  if (endpoint === 'admin-login') {
    const body = await readBody(req);
    verifyAdmin(req, body);
    const member = req.headers.authorization ? authenticate(room, req) : null;
    let authorizedId;
    try {
      const result = await changeRoom(room, data => {
        if (member && !data.members.some(m => m.id === member.id && m.hash === member.hash)) throw new ApiError(401, 'Sessão inválida.');
        const credentials = member ? {} : addMaster(data);
        authorizedId = member?.id || credentials.memberId;
        adminSessions.add(authorizedId);
        return credentials;
      });
      return json(res, 200, result);
    } catch (error) { if (authorizedId) adminSessions.delete(authorizedId); throw error; }
  }
  if (endpoint === 'events') return openEvents(req, res, room, url.searchParams.get('ticket'));
  const member = authenticate(room, req);
  if (endpoint === 'state') return json(res, 200, { state: publicState(room) });
  if (endpoint === 'stream-ticket') {
    const ticket = randomBytes(24).toString('base64url');
    tickets.set(ticket, { code: room.data.code, memberId: member.id, until: Date.now() + 60000 });
    return json(res, 200, { ticket });
  }
  const body = await readBody(req, endpoint === 'actions' ? 65536 : 4096);
  if (endpoint === 'leave') {
    const result = await changeRoom(room, data => {
      const current = data.members.find(m=>m.id===member.id && m.hash===member.hash);
      if (!current) throw new ApiError(401,'Sessão inválida.');
      const token = data.tokens.find(t=>t.kind==='player' && t.ownerId===member.id);
      adminSessions.delete(member.id);
      if (token) {
        // Sair revoga a sessão, não remove a ficha nem as anotações.
        current.hash = secretHash(randomBytes(32));
      } else {
        data.members = data.members.filter(m => m.id !== member.id);
      }
      record(data, 'system', member.name + ' saiu da sessão.', member.id);
      return {};
    });
    revokeConnections(room,member.id);
    return json(res,200,result);
  }
  if (endpoint === 'admin-logout') {
    // Serializa com os comandos da sala, inclusive a revogação.
    const result = await changeRoom(room, () => {
      adminSessions.delete(member.id);
    });
    return json(res, 200, result);
  }
  return json(res, 200, await changeRoom(room, data => runAction(data, member, body)));
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf'
};
const publicDirs = new Set(['html', 'img', 'css', 'js', 'models', 'rpg', 'audio']);

async function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') throw new ApiError(405, 'Método inválido.');
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { throw new ApiError(400, 'Endereço inválido.'); }
  if (pathname === '/rpg' || pathname === '/rpg/') {
    res.writeHead(308, { Location: '/html/overkill.html' + url.search });
    return res.end();
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const parts = pathname.slice(1).split('/');
  if (parts.some(part => !part || part.startsWith('.') || /[\\:\u0000-\u001f]/.test(part)) ||
      !(pathname === '/index.html' || publicDirs.has(parts[0]))) throw new ApiError(404, 'Arquivo não encontrado.');
  const type = mimeTypes[path.extname(pathname).toLowerCase()];
  if (!type) throw new ApiError(404, 'Arquivo não encontrado.');
  const filename = path.join(root, ...parts);
  let resolved, stat;
  try {
    resolved = await fs.promises.realpath(filename);
    stat = await fs.promises.stat(resolved);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') throw new ApiError(404, 'Arquivo não encontrado.');
    throw err;
  }
  const relative = path.relative(root, resolved);
  if (relative !== parts.join(path.sep) || resolved.startsWith(dataDir + path.sep) || !stat.isFile()) {
    throw new ApiError(404, 'Arquivo não encontrado.');
  }
  const headers = { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' };
  if (['.html', '.js', '.css'].includes(path.extname(pathname).toLowerCase())) headers['Cache-Control'] = 'no-cache';
  let range;
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (match && (match[1] || match[2])) {
      const start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2]));
      const end = match[1] && match[2] ? Math.min(stat.size - 1, Number(match[2])) : stat.size - 1;
      if (start <= end && start < stat.size) range = { start, end };
    }
    if (!range) {
      res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size });
      return res.end();
    }
    headers['Content-Range'] = 'bytes ' + range.start + '-' + range.end + '/' + stat.size;
    headers['Content-Length'] = range.end - range.start + 1;
  }
  res.writeHead(range ? 206 : 200, headers);
  if (req.method === 'HEAD' || !stat.size) return res.end();
  await pipeline(fs.createReadStream(resolved, range), res);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of tickets) if (entry.until <= now) tickets.delete(key);
  for (const [key, entry] of adminAttempts) if (entry.until <= now) adminAttempts.delete(key);
  for (const [key, entry] of admissions) if (entry.until <= now) admissions.delete(key);
  for (const [key, room] of rooms) {
    if (!room.pending && !room.clients.size && now - room.used > 10 * 60000) rooms.delete(key);
    for (const res of room.clients.keys()) res.write(': heartbeat\n\n');
  }
}, 15000).unref();

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else await serveStatic(req, res, url);
  } catch (err) {
    if (res.destroyed) return;
    if (res.headersSent) return res.destroy();
    if (!(err instanceof ApiError)) {
      // Não registra corpo do pedido, credenciais ou tokens de acesso.
      const frames = String(err.stack || '').split('\n').slice(1).join('\n');
      console.error('Falha ao servir pedido:', req.method, String(req.url || '').split('?')[0], err.code || err.name, '\n' + frames);
    }
    json(res, err.status || 500, { error: err.status ? err.message : 'Falha no servidor. Tente novamente.' });
  }
});

fs.mkdirSync(portraitDir, { recursive: true, mode: 0o700 });
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '0.0.0.0', () => {
  console.log('OVERKILL SYNDROME | API V4.9.1 (mesa unica) em http://localhost:' + server.address().port);
  console.log('Cenarios: ' + sceneCatalog.map(s => s.id + ' (' + s.width + 'x' + s.height + ')').join(', '));
  console.log('Diagnostico: http://localhost:' + server.address().port + '/api/table/health');
});
