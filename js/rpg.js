import { createBoard } from './rpg-board.js?v=4.9.1';
import { createSpaceEditor } from './rpg-space-editor.js?v=4.9.1';
import { createSoundMeter } from './rpg-sound.js';

const $ = id => document.getElementById(id);
const scenes = new Map([
  ['docks', 'Docas de Kairo'],
  ['lab', 'Laboratório Íon'],
  ['ruins', 'Ruínas de Érebo'],
  ['city', 'Cidade Grafitada']
]);
const builtinScenes = new Map(scenes);
let catalogKey = '';
function syncSpaceCatalog() {
  const custom = (state.sceneCatalog || []).filter(s=>s.id.startsWith('space-'));
  const key=JSON.stringify(custom);
  if(key===catalogKey)return;
  catalogKey=key; scenes.clear(); for(const [id,name] of builtinScenes) scenes.set(id,name);
  for(const item of custom) scenes.set(item.id,item.name);
  for(const [id,attr] of [['admin-scenes','adminScene'],['scene-list','scene']]) {
    const list=$(id);list.querySelectorAll('[data-custom-space]').forEach(b=>b.remove());
    for(const item of custom) {
      const btn=document.createElement('button');btn.type='button';btn.dataset[attr]=item.id;btn.dataset.customSpace='true';
      const chip=document.createElement('span');chip.className='scene-chip custom';const title=document.createElement('span');title.textContent=item.name;
      const size=document.createElement('small');size.className='space-list-size';size.textContent=item.width+'×'+item.height;
      btn.append(chip,title,size);list.append(btn);
    }
  }
}
const apiOrigin = document.querySelector('meta[name="rpg-api-origin"]')?.content.trim().replace(/\/+$/, '') || '';
const storagePrefix = 'overkill:' + apiOrigin + ':';
const displayTime = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const TABLE_ID = 'OVERKILL';
function emptyState() {
  return { code: TABLE_ID, scene: 'docks', revision: 0, members: [], tokens: [], history: [] };
}
let state = emptyState();
let stateReceivedAt = performance.now();
let session = null;
let selectedId = null;
let hpEditId = null;
let hpKey = null;
let brushWidth = 3;
const hiddenDrawingOwners = new Set();
let mode = 'move';
let grid = true;
let sides = 20;
let status = 'Desconectado';
let source;
let retryTimer;
let retryDelay = 1000;
let noticeTimer;
let placement = null;
let rosterKey;
let activityKey;
let queue = [];
let runningAction = null;
let pair = null;
let multiSelection = [];
let shiftHeld = false;
let menuTarget = null;
let investigation = null;
let directPair = null;
let activeSpeaker = null;
let directId = null;
let dismissedDialogue = null;
let directFadeTimer;
let priorFocus;
let sceneTransitionTimer;
let sceneTransitionFade;
let latestSceneTransition = '';
let portraitEditId = null;
let musicKey = '';
let musicSnapshot = null;
const board = createBoard($('board'), {
  onSelect: selectToken, onTile: useTile, onContext: openEntityMenu,
  onMark(kind,points,scene,width) { dispatch({type:kind==='draw'?'draw.add':'draw.erase',scene,points,width,tokenId:(isGM()?selected():ownToken())?.id}); },
  onZoom(percent) { $('zoom-level').textContent = Math.round(percent) + '%'; }
});

function stored(key, value) {
  try {
    const full = storagePrefix + key;
    // Sessão por aba: um jogador novo não herda o login de mestre de outra aba.
    const storage = key === 'shared-session' ? sessionStorage : localStorage;
    if (value === undefined) {
      if (key === 'shared-session' && !storage.getItem(full)) {
        const legacy = localStorage.getItem(full);
        if (legacy) { storage.setItem(full, legacy); localStorage.removeItem(full); }
      }
      return storage.getItem(full);
    }
    if (value === null) storage.removeItem(full);
    else storage.setItem(full, value);
  } catch { /* The current tab still works when the browser blocks storage. */ }
}

function savedSession() {
  try {
    const saved = JSON.parse(stored('shared-session'));
    if (saved?.code === TABLE_ID && typeof saved.secret === 'string' && typeof saved.memberId === 'string') return saved;
  } catch {}
  return null;
}
// Remove parâmetros de convite antigos sem interferir nos outros parâmetros.
const cleanUrl = new URL(location.href);
if (cleanUrl.searchParams.has('sala')) { cleanUrl.searchParams.delete('sala'); history.replaceState(null, '', cleanUrl); }

function notice(message) {
  clearTimeout(noticeTimer);
  $('notice').textContent = message;
  $('notice').hidden = false;
  noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 5000);
}

function setStatus(value) {
  status = value;
}

function playSceneTransition(scene) {
  const overlay = $('scene-transition');
  if (!overlay) return;
  const name = scenes.get(scene) || 'Cena';
  latestSceneTransition = scene + ':' + name;
  $('scene-transition-scene').textContent = name;
  overlay.hidden = false;
  overlay.setAttribute('aria-hidden', 'false');
  clearTimeout(sceneTransitionTimer);
  clearTimeout(sceneTransitionFade);
  void overlay.offsetWidth;
  overlay.classList.add('is-visible');
  sceneTransitionTimer = setTimeout(() => {
    overlay.classList.remove('is-visible');
    sceneTransitionFade = setTimeout(() => {
      if (latestSceneTransition !== scene + ':' + name) return;
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 360);
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 900 : 1550);
}

async function request(path, { room, method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (room) headers.Authorization = 'Bearer ' + room.secret;
  if (body) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(apiOrigin + path, {
      method, headers, body: body && JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(15000)
    });
  } catch {
    throw new Error('Sem conexão com o servidor da mesa. Tente novamente.');
  }
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload) {
    const backend = apiOrigin || location.origin;
    const message = res.status === 404 && path.startsWith('/api/table/')
      ? `API da mesa não encontrada em ${backend}. Atualize o server.cjs, reinicie o Node e confira /api/table/health nesse endereço. Se o site for estático, configure rpg-api-origin.`
      : payload?.error || 'O servidor multiplayer está indisponível neste endereço.';
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return payload;
}

const roomPath = (room, route) => '/api/table/' + route;
const isGM = () => Boolean(session) && state.members.some(m => m.id === session.memberId && m.role === 'gm');
const canMove = t => Boolean(t && session && (isGM() || (t.kind === 'player' && t.ownerId === session.memberId)));
const selected = () => state.tokens.find(t => t.id === selectedId);
const ownToken = () => session && state.tokens.find(t => t.kind === 'player' && t.ownerId === session.memberId);
const rollTarget = () => isGM() ? selected() : ownToken();
const canDraw = () => Boolean(session && (isGM() || ownToken()));
const drawColor = () => (isGM() ? selected() || ownToken() : ownToken())?.color || '#ff6345';
function renderHP() {
  const panel=$('party-hp'), players=state.tokens.filter(t=>t.kind==='player');
  panel.hidden=!players.length;
  const key=JSON.stringify([isGM(),players.map(t=>[t.id,t.name,t.color,t.hp,t.maxHp,t.ownerId,hiddenDrawingOwners.has(t.ownerId)])]);
  if(key===hpKey)return;
  hpKey=key;
  panel.replaceChildren(...players.map(t=>{
    const row=document.createElement('div'); row.className='hp-entry'; row.style.setProperty('--hp-color',t.color);
    const hpButton=document.createElement(isGM()?'button':'div'); hpButton.className='hp-row';
    const max=t.maxHp??100, hp=t.hp??100;
    const name=span('hp-name',t.name); name.title=t.name;
    const line=span('hp-line');
    const track=span('hp-track'); track.setAttribute('role','progressbar'); track.setAttribute('aria-label','HP de '+t.name); track.setAttribute('aria-valuemin','0'); track.setAttribute('aria-valuemax',String(max)); track.setAttribute('aria-valuenow',String(hp));
    const fill=span('hp-fill'); fill.style.width=Math.max(0,Math.min(100,hp/max*100))+'%'; track.append(fill);
    line.append(track,span('hp-number',hp+'/'+max)); hpButton.append(name,line);
    if(isGM()) { hpButton.type='button'; hpButton.title='Editar HP de '+t.name; hpButton.addEventListener('click',()=>{
      hpEditId=t.id; $('hp-title').textContent='HP · '+t.name; $('hp-current').value=hp; $('hp-maximum').value=max; $('hp-error').textContent=''; $('hp-dialog').showModal();
    }); }
    const eye=document.createElement('button'); eye.type='button'; eye.className='hp-eye icon-button';
    const hidden=hiddenDrawingOwners.has(t.ownerId);
    eye.setAttribute('aria-pressed',String(hidden));
    eye.setAttribute('aria-label',(hidden?'Mostrar':'Ocultar')+' desenhos de '+t.name); eye.title=eye.getAttribute('aria-label');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('class','icon'); svg.setAttribute('aria-hidden','true');
    const use=document.createElementNS('http://www.w3.org/2000/svg','use'); use.setAttribute('href',hidden?'#i-eye-off':'#i-eye'); svg.append(use);eye.append(svg);
    eye.addEventListener('click',()=>{ if(hiddenDrawingOwners.has(t.ownerId)) hiddenDrawingOwners.delete(t.ownerId); else hiddenDrawingOwners.add(t.ownerId); renderHP(); drawBoard(); document.querySelector('.hp-eye[data-token-id="'+CSS.escape(t.id)+'"]')?.focus({preventScroll:true}); });
    eye.dataset.tokenId=t.id; row.append(hpButton,eye);
    return row;
  }));
}
$('hp-form').addEventListener('submit',e=>{
  e.preventDefault(); if(!isGM())return;
  const hp=Number($('hp-current').value),maxHp=Number($('hp-maximum').value);
  if(hp>maxHp) { $('hp-error').textContent='O HP atual não pode exceder o máximo.';return; }
  dispatch({type:'hp.set',tokenId:hpEditId,hp,maxHp}); $('hp-dialog').close();
});

function setMode(value) {
  mode = value;
  if (value !== 'place') placement = null;
  if (['draw','erase'].includes(value)) { clearSelection(); shiftHeld=false; closeEntityMenu(); }
  renderControls();
  drawBoard();
}

// ================= SELEÇÃO MÚLTIPLA / MENU DE ENTIDADE =================
function clearSelection() { multiSelection = []; }
function showInteraction() {
  if (!isGM()) return;
  const ids = [...new Set(multiSelection)].filter(id => state.tokens.some(t => t.id === id));
  if (ids.length < 2) return;
  pair = { ids };
  $('interaction-title').textContent = ids.map(id => state.tokens.find(t => t.id === id).name).join(' · ');
  $('talk-option').disabled = !isGM();
  $('inspect-detail').hidden = true;
  if (!$('interaction-dialog').open) $('interaction-dialog').showModal();
}
function selectToken(id, shift = false) {
  const target = state.tokens.find(t => t.id === id);
  if (!target) return;
  closeEntityMenu();
  if (isGM() && (shift || shiftHeld || mode === 'interact')) {
    if (multiSelection.includes(id)) multiSelection = multiSelection.filter(v => v !== id);
    else if (multiSelection.length < 5) multiSelection.push(id);
    else notice('O diálogo comporta até cinco personagens.');
    renderControls(); renderRoster(); drawBoard();
    if (!shift && mode === 'interact' && multiSelection.length >= 2) $('board-hint').textContent = multiSelection.length + '/5 selecionados · Clique em Interagir para abrir as opções.';
    return;
  }
  if (shift || shiftHeld) return;
  if (!canMove(target)) return; // Hover/menu de alvo permanecem disponíveis, mas não há seleção de controle alheio.
  clearSelection(); selectedId = id;
  renderControls(); renderRoster(); drawBoard();
}
function closeEntityMenu() { menuTarget = null; $('entity-menu').hidden = true; }
function cellLabel(cell) { return 'Quadrado (' + Math.round(cell.x) + ', ' + Math.round(cell.y) + ')'; }
function openEntityMenu(location, x, y) {
  if (!session || directPair) return;
  const target = state.tokens.find(t => t.id === location.id);
  menuTarget = location;
  const menu = $('entity-menu');
  $('entity-menu-name').textContent = target?.name || (location.cell ? cellLabel(location.cell) : scenes.get(location.scene));
  const attacker = isGM() ? selected() : ownToken();
  $('entity-attack').disabled = !target || !attacker || attacker.id === target.id;
  menu.hidden = false;
  menu.style.left = Math.max(8, Math.min(x + 12, innerWidth - menu.offsetWidth - 8)) + 'px';
  menu.style.top = Math.max(8, Math.min(y - 12, innerHeight - menu.offsetHeight - 8)) + 'px';
  ($('entity-attack').disabled ? $('investigate') : $('entity-attack')).focus({preventScroll:true});
}
$('entity-attack').addEventListener('click', () => {
  const attacker = isGM() ? selected() : ownToken();
  if (attacker && menuTarget?.id && attacker.id !== menuTarget.id) dispatch({type:'attack.declare', attackerId:attacker.id,targetId:menuTarget.id});
  closeEntityMenu();
});
function validLocation(location) {
  return location.scene === state.scene && (!location.id || state.tokens.some(t => t.id === location.id));
}
function renderInvestigation() {
  if (!investigation) return;
  if (!validLocation(investigation)) { $('investigation-dialog').close(); return; }
  const target = state.tokens.find(t => t.id === investigation.id);
  const cell = target || investigation.cell;
  const place = scenes.get(state.scene);
  $('investigation-place').textContent = cell ? place + ' · ' + cellLabel(cell) : place;
  let detail;
  if (target) {
    detail = target.name + ' · ' + (target.kind === 'npc' ? 'NPC' : 'Personagem de jogador');
    if (Number.isFinite(target.hp) && Number.isFinite(target.maxHp)) detail += ' · HP ' + target.hp + '/' + target.maxHp;
  } else if (cell) {
    const occupants = state.tokens.filter(t => Math.round(t.x) === Math.round(cell.x) && Math.round(t.y) === Math.round(cell.y));
    detail = occupants.length ? 'Neste quadrado: ' + occupants.map(t => t.name).join(', ') + '.' : 'Nenhum personagem neste quadrado.';
  } else {
    detail = 'Personagens no cenário: ' + state.tokens.length + '.';
  }
  $('investigation-detail').textContent = detail;
}
$('investigate').addEventListener('click', () => {
  if (!menuTarget || !validLocation(menuTarget)) return closeEntityMenu();
  investigation = menuTarget;
  closeEntityMenu();
  $('board').focus({preventScroll:true});
  renderInvestigation();
  $('investigation-dialog').showModal();
});
$('investigation-dialog').addEventListener('close', () => { investigation = null; });
document.addEventListener('pointerdown', e => { if (!$('entity-menu').contains(e.target)) closeEntityMenu(); });
window.addEventListener('resize', closeEntityMenu);
function drawBoard() {
  // Keep pending gestures visible while authoritative snapshots arrive from peers.
  const moves = new Map();
  for (const item of [runningAction, ...queue]) {
    if (item?.room === session && item?.action.type === 'move') moves.set(item.action.tokenId, item.action);
  }
  const tokens = moves.size ? state.tokens.map(t => {
    const move = moves.get(t.id);
    return move ? { ...t, x: move.x, y: move.y } : t;
  }) : state.tokens;
  board.setState({ scene: state.scene, space: state.space, tokens, selectedId, mode, grid, multiSelection, shiftHeld, canGroup: isGM(), canMoveSelected: canMove(selected()), drawings: (state.drawings || []).filter(s=>!hiddenDrawingOwners.has(s.ownerId)), brushWidth, drawColor: drawColor(), canDraw: canDraw(), rolls: state.history.filter(e => e.kind === 'roll' && e.tokenId), serverTime: state.serverTime ? state.serverTime + performance.now() - stateReceivedAt : Date.now() });
}

function renderControls() {
  const gm = isGM();
  syncSpaceCatalog();
  $('create-space').hidden = !gm;
  if (!gm && $('space-editor').open) $('space-editor').close();
  const token = selected();
  $('interact-tool').hidden = !gm;
  $('interact-tool').disabled = !gm || state.tokens.length < 2;
  $('interact-tool').setAttribute('aria-pressed', String(mode === 'interact'));
  if (pair && pair.ids.some(id => !state.tokens.some(t => t.id === id))) {
    $('interaction-dialog').close();
    pair = null;
  }
  $('scene-tools').hidden = !gm;
  for(const id of ['draw-tool','erase-tool']) $(id).disabled=!canDraw();
  $('draw-tool').style.setProperty('--marker-color',drawColor());
  $('brush-controls').hidden = mode !== 'draw' || !canDraw();
  $('brush-controls').style.setProperty('--marker-color',drawColor());
  if(!gm && $('hp-dialog').open) $('hp-dialog').close();
  $('admin-tool').hidden = false;
  if (!gm) { $('admin-window').hidden = true; $('admin-tool').setAttribute('aria-expanded', 'false'); }
  $('admin-access').textContent = 'Acesso de mestre autenticado';
  $('admin-tool').title = gm ? 'Abrir administração' : 'Autenticar como mestre';
  $('admin-remove-npc').disabled = !gm || token?.kind !== 'npc';
  $('edit-portrait').hidden = !canMove(token);
  document.querySelectorAll('[data-admin-scene]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.adminScene === state.scene)));
  if (directPair && directPair.some(id => !state.tokens.some(t => t.id === id))) closeDirect();
  $('add-npc').hidden = !gm;
  $('remove-npc').hidden = !gm || token?.kind !== 'npc';
  const admitted = Boolean(ownToken() || gm);
  $('welcome-screen').hidden = admitted;
  $('tabletop').hidden = !admitted;
  $('leave-room').hidden = !admitted;
  $('roll-die').disabled = !session;
  $('roll-die').title = rollTarget() ? 'Rolar para ' + rollTarget().name : 'Selecione um personagem para rolar o dado';
  for (const [id, pressed] of [['move-tool', mode === 'move'], ['pan-tool', mode === 'pan'], ['grid-tool', grid], ['draw-tool',mode==='draw'], ['erase-tool',mode==='erase']]) {
    $(id).setAttribute('aria-pressed', String(pressed));
  }
  $('scene-name').textContent = scenes.get(state.scene) || 'Cena';
  $('scene-index').textContent = String([...scenes.keys()].indexOf(state.scene) + 1).padStart(2, '0');
  let hint = 'Selecione uma peça para mover.';
  if (mode === 'draw') hint = 'Lápis livre · Arraste para desenhar. Botão do meio para mover o mapa.';
  else if (mode === 'erase') hint = gm ? 'Borracha · Arraste para apagar qualquer marcação.' : 'Borracha · Arraste para apagar suas marcações.';
  else if (mode === 'pan') hint = 'Arraste para explorar o mapa.';
  else if (mode === 'place') hint = 'Posicione ' + placement.name + ' com um clique ou use as setas e confirme com Enter.';
  else if (multiSelection.length || shiftHeld) hint = multiSelection.length + '/5 selecionados · ' + (mode === 'interact' && !shiftHeld ? 'Clique em Interagir para abrir as opções.' : 'Shift + clique para alternar; solte Shift para interagir.');
  else if (mode === 'interact') hint = 'Escolha outro personagem para interagir.';
  else if (canMove(token)) hint = token.name + (gm ? ' selecionado · Clique para mover ou Shift + clique para interagir.' : ' · Clique no chão para mover seu personagem.');
  else if (gm) hint = 'Selecione uma peça ou segure Shift para selecionar um grupo.';
  else if (ownToken()) hint = 'Selecione ' + ownToken().name + ' para mover.';
  $('board-hint').textContent = hint;
}

function span(className, text) {
  const element = document.createElement('span');
  element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function renderRoster() {
  const members = new Map(state.members.map(m => [m.id, m]));
  const list = $('roster-list');
  const key = JSON.stringify(state.tokens.map(t => [t.id, t.name, t.color, t.kind, t.portrait, members.get(t.ownerId)?.role, members.get(t.ownerId)?.online, t.ownerId === session?.memberId]));
  if (key !== rosterKey) {
    rosterKey = key;
    const focusedId = list.contains(document.activeElement) && document.activeElement.dataset.tokenId;
    const items = state.tokens.map((t, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'roster-item';
      button.dataset.tokenId = t.id;
      button.style.setProperty('--token-color', t.color);
      const member = members.get(t.ownerId);
      const role = t.kind === 'npc' ? 'NPC' : member?.role === 'gm' ? 'Mestre' : 'Personagem';
      const detail = member ? [role, member.id === session?.memberId ? 'Você' : '', member.online ? 'Online' : 'Ausente'].filter(Boolean).join(' · ') : role;
      const portrait = span('portrait portrait-' + (t.kind === 'npc' ? 2 : index % 4));
      portrait.setAttribute('aria-hidden', 'true');
      if (t.portrait) { const img = makePortrait(t); portrait.append(img); }
      const name = document.createElement('strong');
      name.textContent = t.name;
      const info = document.createElement('small');
      info.textContent = detail;
      const person = span('person-text');
      person.append(name, info);
      button.append(portrait, person, span('token-mark'));
      button.addEventListener('click', e => selectToken(t.id, e.shiftKey));
      return button;
    });
    list.replaceChildren(...items);
    if (focusedId) items.find(item => item.dataset.tokenId === focusedId)?.focus({ preventScroll: true });
  }
  Array.from(list.children).forEach(el => el.setAttribute('aria-pressed', String(el.dataset.tokenId === selectedId || multiSelection.includes(el.dataset.tokenId))));
  $('roster-count').textContent = String(state.tokens.length).padStart(2, '0');
}

function renderActivity() {
  const key = state.code + ':' + (state.history.at(-1)?.id || '');
  if (activityKey === key) return;
  activityKey = key;
  const rows = [...state.history].reverse().map(entry => {
    const row = document.createElement('div');
    row.className = 'activity-row';
    const time = document.createElement('time');
    const when = new Date(entry.at);
    time.dateTime = when.toISOString();
    time.textContent = displayTime.format(when);
    const symbol = span('log-icon', entry.kind === 'roll' ? '⚄' : '›');
    symbol.setAttribute('aria-hidden', 'true');
    row.append(symbol, span('log-text', entry.text), time);
    return row;
  });
  $('activity-list').replaceChildren(...rows);
  $('activity-count').textContent = String(rows.length).padStart(2, '0');
  const roll = [...state.history].reverse().find(e => e.kind === 'roll');
  $('die-result').textContent = roll ? roll.result : '—';
  $('last-roll').textContent = roll ? roll.text : 'Aguardando a primeira rolagem.';
}

function render() {
  renderControls();
  renderRoster();
  renderHP();
  renderActivity();
  drawBoard();
  renderDirect();
  syncMusic();
}

function applyState(next, room, fresh = false) {
  if (session !== room || next.code !== room.code || (!fresh && next.revision < state.revision)) return;
  const previousScene = state.scene;
  state = next;
  syncSpaceCatalog();
  stateReceivedAt = performance.now();
  if (!isGM() && !ownToken()) { stored('shared-session',null); resetTable(); return; }
  if (!fresh && previousScene && previousScene !== next.scene) playSceneTransition(next.scene);
  multiSelection = multiSelection.filter(id => state.tokens.some(t => t.id === id));
  if (menuTarget && !validLocation(menuTarget)) closeEntityMenu();
  renderInvestigation();
  syncDirect();
  if (!canDraw() && ['draw','erase'].includes(mode)) mode='move';
  if (!isGM()) {
    shiftHeld = false; clearSelection();
    if (mode === 'interact' || mode === 'place') { mode = 'move'; placement = null; }
    if ($('interaction-dialog').open) $('interaction-dialog').close();
    selectedId = ownToken()?.id || null;
  } else if (!selected()) selectedId = ownToken()?.id || state.tokens[0]?.id || null;
  render();
}

function stopStream() {
  clearTimeout(retryTimer);
  source?.close();
  source = null;
}

function resetTable() {
  if ($('space-editor').open) $('space-editor').close();
  if ($('investigation-dialog').open) $('investigation-dialog').close();
  hiddenDrawingOwners.clear();
  stopStream();
  closeDirect();
  session = null;
  dismissedDialogue = null; shiftHeld = false;
  queue = [];
  runningAction = null;
  placement = null;
  mode = 'move';
  state = emptyState();
  $('scene-transition')?.classList.remove('is-visible');
  if ($('scene-transition')) { $('scene-transition').hidden = true; $('scene-transition').setAttribute('aria-hidden','true'); }
  selectedId = null; clearSelection(); closeEntityMenu();
  setStatus('Desconectado');
  render();
  board.resetView();
}

function expired(room) {
  if (session !== room) return;
  stored('shared-session', null);
  resetTable();
  notice('Sua sessão expirou. Entre com um personagem ou autentique-se como mestre.');
}

function reconnect(room) {
  if (session !== room) return;
  stopStream();
  setStatus('Reconectando');
  retryTimer = setTimeout(() => connect(room), retryDelay);
  retryDelay = Math.min(retryDelay * 2, 12000);
}

async function connect(room) {
  try {
    const { ticket } = await request(roomPath(room, 'stream-ticket'), { room, method: 'POST' });
    if (session !== room) return;
    const stream = new EventSource(apiOrigin + roomPath(room, 'events') + '?ticket=' + encodeURIComponent(ticket));
    source = stream;
    let first = true;
    stream.onmessage = event => {
      if (source !== stream || session !== room) return;
      try {
        const { state: next } = JSON.parse(event.data);
        applyState(next, room, first);
        first = false;
        retryDelay = 1000;
        setStatus('Ao vivo');
      } catch { reconnect(room); }
    };
    stream.onerror = () => { if (source === stream) reconnect(room); };
  } catch (error) {
    if (error.status === 401 || error.status === 404) expired(room);
    else reconnect(room);
  }
}

async function enter(room, initialState) {
  if(session?.memberId!==room.memberId) hiddenDrawingOwners.clear();
  stopStream();
  closeDirect();
  session = room;
  dismissedDialogue = null; shiftHeld = false; clearSelection();
  queue = [];
  runningAction = null;
  selectedId = null;
  placement = null;
  mode = 'move';
  retryDelay = 1000;
  state = { code: room.code, scene: 'docks', revision: 0, members: [], tokens: [], history: [] };
  stored('shared-session', JSON.stringify(room));
  setStatus('Conectando');
  if (initialState) applyState(initialState, room, true);
  else render();
  board.resetView();
  if (!initialState) {
    try {
      const { state: snapshot } = await request(roomPath(room, 'state'), { room });
      applyState(snapshot, room, true);
    } catch (error) {
      if (error.status === 401 || error.status === 404) return expired(room);
    }
  }
  if (session === room) connect(room);
}

async function sendNext() {
  if (runningAction || !queue.length) return;
  const item = queue.shift();
  runningAction = item;
  try {
    if (item.action.type === 'scene' && item.action.scene === 'city') {
      const health = await request('/api/table/health');
      if (session !== item.room) return;
      const supportsCity = health.scenes?.some(s => s.id === 'city' && s.width === 50 && s.height === 50) || health.features?.city50x50 === true;
      if (!supportsCity) throw new Error('O servidor em ' + (apiOrigin || location.origin) + ' está na versão ' + (health.build || health.apiVersion || '?') + ' e não possui Cidade Grafitada. Pare o servidor, substitua server.cjs e execute npm.cmd start.');
    }
    if (item.action.type.startsWith('draw.')) {
      // O desenho é público para participantes autenticados. Confere o backend
      // antes do envio, pois versões antigas confundem o comando com ação de mestre.
      if (state.features?.drawingHistory !== true || state.features?.brushWidth !== true) {
        const health = await request('/api/table/health');
        if (session !== item.room) return;
        if (health.features?.drawingHistory !== true || health.features?.brushWidth !== true) {
          throw new Error('Servidor V' + (health.build || health.apiVersion || '?') + ' não suporta as novas ferramentas de desenho. Encerre o Node, substitua server.cjs pela V4.6 e execute npm.cmd start.');
        }
      }
    }
    if (item.action.type === 'direct.open') {
      const health = await request('/api/table/health');
      if (health.service !== 'overkill-rpg' || !(Number(health.apiVersion) >= 4)) {
        throw new Error('Servidor antigo (API V' + (health.apiVersion ?? '?') + '). Encerre o Node, atualize server.cjs e execute npm.cmd start. O diálogo em grupo exige API V4 ou superior.');
      }
      if (session !== item.room) return;
    }
    const { state: next, roll } = await request(roomPath(item.room, 'actions'), { room: item.room, method: 'POST', body: item.action });
    if (item.action.type === 'roll' && session === item.room) {
      if (roll?.tokenId !== item.action.tokenId) {
        applyState(next, item.room);
        throw new Error('O servidor não confirmou o personagem da rolagem. Confira se a API está na versão 4.4.');
      }
      board.showRoll(roll);
    }
    applyState(next, item.room);
  } catch (error) {
    if (session !== item.room) return;
    if (error.status === 401) expired(item.room);
    else notice(error.message);
  } finally {
    if (item === runningAction) {
      runningAction = null;
      drawBoard();
      sendNext();
    }
  }
}

function dispatch(action) {
  if (!session) return notice('Entre com um personagem ou como mestre.');
  if (status !== 'Ao vivo') return notice('Aguarde a conexão com a mesa.');
  if (['move','portrait.set'].includes(action.type) && !canMove(state.tokens.find(t => t.id === action.tokenId))) return notice('Você só pode controlar seu personagem.');
  if (action.type.startsWith('draw.') && !canDraw()) return notice('Entre com um personagem para usar o lápis ou a borracha.');
  if (!isGM() && (['scene','direct.open','direct.close','hp.set'].includes(action.type) || action.type.startsWith('npc.') || action.type.startsWith('music.'))) return notice('Esta ferramenta é exclusiva do mestre.');
  const tail = queue.at(-1);
  if (action.type === 'move' && tail?.action.type === 'move' && tail.action.tokenId === action.tokenId) tail.action = action;
  else if (queue.length < 20) queue.push({ action, room: session });
  else return notice('Aguarde enquanto os comandos são enviados.');
  sendNext();
  if (action.type === 'move') drawBoard();
}

function useTile(x, y) {
  if (shiftHeld || mode === 'interact') return;
  if (mode === 'place' && placement && isGM()) {
    dispatch({ type: 'npc.add', ...placement, x, y });
    setMode('move');
  } else if (mode === 'move' && canMove(selected())) {
    dispatch({ type: 'move', tokenId: selectedId, x, y });
  } else if (mode === 'move' && ownToken()) {
    notice('Selecione seu personagem para mover.');
  }
}

let admissionStep = 'name';
let admissionChoices = [];
function setAdmissionStep(step) {
  admissionStep = step;
  const create = step === 'create', choose = step === 'choose';
  $('room-title').textContent = create ? 'Novo personagem' : choose ? 'Escolher personagem' : 'Entrar';
  $('room-intro').textContent = create ? 'Preencha a ficha inicial do personagem.' : choose ? 'Há mais de uma ficha com esse nome. Escolha a sua.' : 'Informe o nome do seu personagem.';
  $('player-name').readOnly = create || choose;
  $('character-sheet').hidden = !create;
  $('character-choices').hidden = !choose;
  $('character-choice').disabled = !choose;
  $('character-choice').required = choose;
  $('room-back').hidden = !(create || choose);
  $('room-submit').textContent = create ? 'Criar personagem' : choose ? 'Entrar' : 'Continuar';
  $('room-error').textContent = '';
  if (!choose) { admissionChoices = []; $('character-choice').replaceChildren(); $('character-choice-preview').replaceChildren(); }
}
function renderAdmissionChoice() {
  const choice = admissionChoices.find(c => c.id === $('character-choice').value);
  const preview = $('character-choice-preview');
  preview.replaceChildren();
  if (!choice) return;
  const portrait = span('portrait portrait-0');
  if (choice.portrait) portrait.append(makePortrait(choice));
  const detail = document.createElement('div');
  const title = document.createElement('strong'); title.textContent = choice.name; title.style.color = choice.color;
  const info = document.createElement('small'); info.textContent = `HP ${choice.hp}/${choice.maxHp} · Posição ${choice.x}, ${choice.y}`;
  detail.append(title, info); preview.append(portrait, detail);
}
function showAdmissionChoices(choices) {
  setAdmissionStep('choose');
  admissionChoices = choices;
  const select = $('character-choice');
  select.replaceChildren(new Option('Selecione a ficha…', ''));
  choices.forEach((choice, index) => select.add(new Option(`${index+1}. ${choice.name} · HP ${choice.hp}/${choice.maxHp} · #${choice.id.slice(-6)}`, choice.id)));
  select.value = ''; renderAdmissionChoice(); select.focus();
}
$('character-choice').addEventListener('change', renderAdmissionChoice);
function showAdmission() {
  $('room-form').reset(); setAdmissionStep('name');
  if (!$('room-dialog').open) $('room-dialog').showModal();
  $('player-name').focus();
}
$('room-back').addEventListener('click',()=>{setAdmissionStep('name'); $('player-name').focus();});
// Redimensiona a imagem local antes de enviá-la; preserva transparência em WebP.
async function uploadedPortrait(file) {
  if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) throw new Error('Use PNG, JPEG ou WebP de até 15 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let url = canvas.toDataURL('image/webp', .86);
    if (url.length > 1350000) url = canvas.toDataURL('image/webp', .60);
    if (url.length > 1350000) throw new Error('A imagem ficou grande demais. Escolha uma menor.');
    return url;
  } finally { bitmap.close(); }
}
$('room-form').addEventListener('submit', async event => {
  event.preventDefault();
  const submit = $('room-submit');
  if (submit.disabled) return;
  const name = $('player-name').value.trim();
  if (!name) return;
  submit.disabled = true; $('room-error').textContent = '';
  try {
    let result;
    if (admissionStep === 'create') {
      const file = $('player-image-file').files[0], link = $('player-portrait').value.trim();
      if (!file && !link) throw new Error('Escolha uma imagem ou informe seu link.');
      const portrait = file ? await uploadedPortrait(file) : link;
      result = await request('/api/table/join', { method:'POST', body:{ name, portrait } });
    } else {
      const characterId = admissionStep === 'choose' ? $('character-choice').value : undefined;
      if (admissionStep === 'choose' && !characterId) throw new Error('Selecione sua ficha.');
      result = await request('/api/table/enter', { method:'POST', body:{ name, characterId } });
      if (result.next === 'choose') { showAdmissionChoices(result.choices); return; }
      if (result.next === 'create') { setAdmissionStep('create'); $('player-image-file').focus(); return; }
      if (result.next === 'admin') { $('room-dialog').close(); openAdmin(result.username); return; }
      if (['legacy','password'].includes(result.next)) throw new Error('Atualize e reinicie o servidor para a versão 4.7.2.');
    }
    if (!result.secret || !result.memberId) throw new Error('Atualize o servidor para a versão 4.7.2.');
    $('room-dialog').close();
    await enter({code:result.code,secret:result.secret,memberId:result.memberId},result.state);
  } catch (error) { $('room-error').textContent = error.message; }
  finally { submit.disabled = false; }
});
$('join-room').addEventListener('click', showAdmission);
$('leave-room').addEventListener('click', async () => {
  const room = session;
  if (room) {
    try { await request(roomPath(room, 'leave'), { room, method: 'POST', body: {} }); }
    catch (error) { if (error.status !== 401) return notice(error.message); }
  }
  stored('shared-session', null);
  resetTable();
});
$('move-tool').addEventListener('click', () => {
  if (!isGM() && ownToken()) selectedId = ownToken().id;
  setMode('move');
  renderRoster();
});
$('pan-tool').addEventListener('click', () => setMode('pan'));
for (const [id,tool] of [['draw-tool','draw'],['erase-tool','erase']]) $(id).addEventListener('click',()=>{if(canDraw())setMode(mode===tool?'move':tool);});
$('brush-width').addEventListener('input', e=>{ brushWidth=Number(e.target.value); $('brush-size-label').textContent=brushWidth+' px'; $('brush-preview').style.setProperty('--brush-size',brushWidth+'px'); drawBoard(); });
$('grid-tool').addEventListener('click', () => { grid = !grid; renderControls(); drawBoard(); });
$('zoom-in').addEventListener('click', () => board.zoomBy(1));
$('zoom-out').addEventListener('click', () => board.zoomBy(-1));
$('reset-view').addEventListener('click', () => board.resetView());

const spaceEditor = createSpaceEditor(async draft => {
  if (!isGM() || !session) throw new Error('Acesso exclusivo do mestre.');
  const room=session;
  if (state.features?.terrainTextures !== true) throw new Error('Atualize o servidor para V4.9.1 e reinicie com npm.cmd start.');
  const result=await request(roomPath(room,'actions'), {room,method:'POST',body:{type:'space.create',...draft}});
  if(session!==room)throw new Error('Sessão alterada.');
  if (!result.spaceId) throw new Error('O servidor não confirmou a criação do espaço.');
  applyState(result.state,room);
  notice('Espaço salvo. Selecione-o em Cenário da mesa.');
});
$('create-space').addEventListener('click',()=>{if(isGM()) {closeEntityMenu();shiftHeld=false;spaceEditor.open();}});
$('scene-tools').addEventListener('click', () => {
  if (!isGM()) return;
  $('scene-dialog').querySelectorAll('[data-scene]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.scene === state.scene)));
  $('scene-dialog').showModal();
});
$('scene-dialog').addEventListener('click', event => {
  const button = event.target.closest('[data-scene]');
  if (!button || !isGM() || !scenes.has(button.dataset.scene)) return;
  if (state.scene !== button.dataset.scene) dispatch({ type: 'scene', scene: button.dataset.scene });
  $('scene-dialog').close();
});
$('add-npc').addEventListener('click', () => {
  if (!isGM()) return;
  $('npc-name').value = '';
  $('npc-portrait').value = '';
  $('npc-error').textContent = '';
  $('npc-dialog').showModal();
  $('npc-name').focus();
});
$('npc-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = $('npc-name').value.trim();
  if (!name) { $('npc-error').textContent = 'Informe o nome do NPC.'; return; }
  if (!isGM()) return;
  placement = { name, color: $('npc-color').value, portrait: $('npc-portrait').value.trim() };
  $('npc-dialog').close();
  setMode('place');
  $('board').focus({ preventScroll: true });
  const bounds = $('board').getBoundingClientRect();
  if (bounds.bottom < 80 || bounds.top > window.innerHeight - 80) {
    $('board').scrollIntoView({ block: 'center' });
  }
});
$('remove-npc').addEventListener('click', () => {
  if (isGM() && selected()?.kind === 'npc') dispatch({ type: 'npc.remove', tokenId: selectedId });
});
$('dice-types').addEventListener('click', event => {
  const button = event.target.closest('[data-sides]');
  if (button) chooseDie(Number(button.dataset.sides));
});
function chooseDie(value) {
  sides = value;
  $('dice-types').querySelectorAll('[data-sides]').forEach(el => el.setAttribute('aria-pressed', String(Number(el.dataset.sides) === sides)));
}
$('roll-die').addEventListener('click', () => {
  const token = rollTarget();
  if (!token) return notice('Selecione um personagem no tabuleiro antes de rolar o dado.');
  dispatch({ type: 'roll', sides, tokenId: token.id });
});
$('interact-tool').addEventListener('click', () => { if (!isGM()) return; if (multiSelection.length >= 2) showInteraction(); else setMode(mode === 'interact' ? 'move' : 'interact'); });
// ================= DIÁLOGO DIRETO =================
function makePortrait(token) {
  const img = document.createElement('img');
  img.className = 'custom-portrait';
  img.alt = '';
  img.referrerPolicy = 'no-referrer';
  img.addEventListener('error', () => img.remove(), { once: true });
  img.src = token.portrait.startsWith('/api/portraits/') ? apiOrigin + token.portrait : token.portrait;
  return img;
}
function setDirectInert(on) {
  for (const child of $('direct-stage').parentElement.children) {
    if (child !== $('direct-stage') && child !== $('youtube-music') && child !== $('audio-unlock')) child.inert = on;
  }
}
function closeDirect() {
  directPair = null; activeSpeaker = null; directId = null;
  const stage = $('direct-stage');
  if (stage.hidden) return;
  stage.classList.remove('is-visible');
  stage.inert = true;
  clearTimeout(directFadeTimer);
  directFadeTimer = setTimeout(() => {
    if (directPair) return;
    stage.hidden = true; setDirectInert(false);
    if (priorFocus?.isConnected) priorFocus.focus({ preventScroll: true });
    priorFocus = null;
    updateYoutubeVisibility();
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 270);
}
function openDirect(ids, speakerId, id = null) {
  const stage = $('direct-stage');
  const opening = !directPair;
  clearTimeout(directFadeTimer);
  directPair = ids; activeSpeaker = speakerId; directId = id;
  if (opening) {
    priorFocus = document.activeElement;
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    stage.hidden = false; stage.inert = false;
    setDirectInert(true);
    // Force initial opacity to paint before the fade-in transition.
    void stage.offsetWidth;
    stage.classList.add('is-visible');
    $('direct-close').focus({ preventScroll: true });
    updateYoutubeVisibility();
  }
  renderDirect();
}
function syncDirect() {
  if (!session) return;
  // A conversa é um evento da mesa inteira; espectadores também recebem o palco.
  const d = (state.dialogues || []).at(-1);
  if (!d) dismissedDialogue = null;
  if (d && d.id !== dismissedDialogue) openDirect(d.ids, d.active, d.id);
  else if (directPair) closeDirect();
}
function requestDirectClose() {
  if (session && directId && isGM()) dispatch({ type: 'direct.close', dialogueId: directId });
  else { dismissedDialogue = directId; closeDirect(); }
}
function renderDirect() {
  if (!directPair) return;
  const tokens = directPair.map(id => state.tokens.find(t => t.id === id));
  if (tokens.some(t => !t)) return closeDirect();
  const container = $('direct-characters');
  container.dataset.count = String(tokens.length);
  const key = JSON.stringify(tokens.map(t => [t.id, t.name, t.color, t.portrait, state.tokens.indexOf(t)]));
  if (container.dataset.key !== key) {
    container.dataset.key = key;
    container.replaceChildren(...tokens.map(t => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'direct-character'; button.dataset.tokenId = t.id;
      button.style.setProperty('--character-color', t.color);
      const image = span('direct-portrait portrait-' + (t.kind === 'npc' ? 2 : state.tokens.indexOf(t) % 4));
      if (t.portrait) {
        const img = makePortrait(t);
        const sizePortrait = () => { if (img.naturalHeight) image.style.setProperty('--portrait-ratio', String(img.naturalWidth / img.naturalHeight)); };
        img.addEventListener('load', sizePortrait, { once: true });
        image.append(img);
        if (img.complete) sizePortrait();
      }
      button.setAttribute('aria-label', t.name);
      button.append(image);
      button.addEventListener('click', () => {
        if (!canMove(t) || activeSpeaker === t.id) return;
        if (session && directId) dispatch({ type: 'direct.focus', dialogueId: directId, speakerId: t.id });
        else { activeSpeaker = t.id; renderDirect(); }
      });
      return button;
    }));
  }
  for (const button of container.children) {
    button.setAttribute('aria-pressed', String(button.dataset.tokenId === activeSpeaker));
    button.setAttribute('aria-disabled', String(!canMove(state.tokens.find(t => t.id === button.dataset.tokenId))));
  }
}
$('talk-option').addEventListener('click', () => {
  if (!pair || !isGM()) return;
  const ids = [...new Set(pair.ids)].filter(id => state.tokens.some(t => t.id === id));
  if (ids.length < 2 || ids.length > 5) return notice('Selecione de 2 a 5 personagens diferentes.');
  $('interaction-dialog').close();
  if (session) dispatch({ type: 'direct.open', ids });
  else notice('Entre com um personagem ou como mestre.');
});
$('inspect-option').addEventListener('click', () => {
  if (!pair) return;
  $('inspect-detail').hidden = false;
  $('inspect-detail').textContent = pair.ids.map(id => state.tokens.find(t => t.id === id)).filter(Boolean).map(t => t.name + ' · (' + t.x + ', ' + t.y + ')').join(' / ');
});
$('interaction-dialog').addEventListener('close', () => { pair = null; clearSelection(); if (mode === 'interact') setMode('move'); else {renderControls(); renderRoster(); drawBoard();} });
$('direct-close').addEventListener('click', requestDirectClose);
$('edit-portrait').addEventListener('click', () => {
  if (!canMove(selected())) return;
  portraitEditId = selectedId; $('portrait-url').value = selected().portrait || '';
  $('portrait-dialog').showModal();
});
$('portrait-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!canMove(state.tokens.find(t => t.id === portraitEditId))) return;
  dispatch({ type: 'portrait.set', tokenId: portraitEditId, portrait: $('portrait-url').value.trim() });
  $('portrait-dialog').close();
});

// ================= ADMIN / MESTRE =================
// isGM() controls visibility only. server.cjs independently enforces permissions.
function openAdmin(username = null) {
  if (isGM()) { toggleWindow('admin-window'); return; }
  $('admin-login-form').reset(); $('admin-login-error').textContent = '';
  $('admin-user-row').hidden = Boolean(username);
  $('admin-user').value = username || '';
  $('admin-login-dialog').showModal();
  $(username ? 'admin-password' : 'admin-user').focus();
}
$('admin-login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const room = session, form = event.currentTarget, button = form.querySelector('button[type="submit"]');
  if (button.disabled) return;
  button.disabled = true; $('admin-login-error').textContent = '';
  try {
    const result = await request(roomPath(room, 'admin-login'), { room, method: 'POST', body: { username: $('admin-user').value, password: $('admin-password').value } });
    if (session !== room) return;
    $('admin-login-dialog').close();
    if (room) applyState(result.state, room);
    else await enter({ code: result.code, secret: result.secret, memberId: result.memberId }, result.state);
    if (isGM() && $('admin-window').hidden) toggleWindow('admin-window');
  } catch (error) { $('admin-login-error').textContent = error.message; }
  finally { $('admin-password').value = ''; button.disabled = false; }
});
$('admin-logout').addEventListener('click', async () => {
  const room = session; if (!room || !isGM()) return;
  try {
    const result = await request(roomPath(room, 'admin-logout'), { room, method: 'POST', body: {} });
    applyState(result.state, room);
    if (!ownToken()) {
      await request(roomPath(room, 'leave'), { room, method: 'POST', body: {} });
      stored('shared-session', null); resetTable();
    }
    notice('Administração bloqueada.');
  } catch (error) { notice(error.message); }
});
$('admin-window').addEventListener('click', event => {
  const scene = event.target.closest('[data-admin-scene]')?.dataset.adminScene;
  if (isGM() && scenes.has(scene) && state.scene !== scene) dispatch({ type: 'scene', scene });
});
$('admin-add-npc').addEventListener('click', () => { if (isGM()) $('add-npc').click(); });
$('admin-remove-npc').addEventListener('click', () => { if (isGM()) $('remove-npc').click(); });
$('music-form').addEventListener('submit', event => {
  event.preventDefault(); if (!isGM()) return;
  const url = $('music-url').value.trim();
  if (!url) return;
  dispatch({ type: 'music.play', url, volume: Number($('music-volume').value) / 100, trackVolume: Number($('track-volume').value) / 100 });
});
$('music-stop').addEventListener('click', () => { if (isGM()) dispatch({ type: 'music.stop' }); });
// ================= ÁUDIO — VOLUME GERAL, TRILHA E VOLUME INDIVIDUAL =================
for (const [id,channel] of [['music-volume','master'],['track-volume','track']]) {
  $(id).addEventListener('input', () => { $(id+'-label').textContent = $(id).value + '%'; applyVolume(true); });
  $(id).addEventListener('change', () => { if (isGM()) dispatch({type:'music.volume', channel, volume:Number($(id).value)/100}); });
}
const localAudio = $('table-music');
// Remote files keep their native playback path, even when the host disallows Web Audio.
const remoteAudio = new Audio();
remoteAudio.loop = true;
remoteAudio.preload = 'none';
let audio = localAudio;
const soundMeter = createSoundMeter(localAudio, $('sound-trace'), $('wave-control'), $('wave-status'));
let localVolume = Math.min(2,Math.max(0,Number(stored('player-volume') ?? 1) || 0));
$('player-volume').value = Math.round(localVolume * 100);
$('player-volume').addEventListener('input', () => {
  localVolume = Number($('player-volume').value)/100;
  stored('player-volume',String(localVolume)); applyVolume(false);
  if (localVolume > 0 && ytReady && ytPlayer?.isMuted?.()) ytPlayer.unMute();
});
let ytPlayer = null, ytReady = false, ytApiPromise, ytGeneration = 0;
let ytSuspended = false, ytResume = false;
function effectiveVolume(preview = false) {
  const settings = state.musicSettings || musicSnapshot || {volume:.5,trackVolume:1};
  const master = preview ? Number($('music-volume').value)/100 : settings.volume ?? .5;
  const track = preview ? Number($('track-volume').value)/100 : settings.trackVolume ?? 1;
  return Math.max(0,Math.min(1,master*track*localVolume));
}
function applyVolume(preview = false) {
  const value = effectiveVolume(preview);
  audio.volume = value;
  if (ytReady && ytPlayer?.setVolume) ytPlayer.setVolume(Math.round(value*100));
  $('player-volume-label').textContent = Math.round(localVolume*100)+'%';
  $('effective-volume').textContent = 'Saída '+Math.round(value*100)+'%';
}
function youtubeId(snapshot) {
  if (!snapshot) return null;
  if (snapshot.provider === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(snapshot.videoId)) return snapshot.videoId;
  // Compatibility with music state created before this update.
  try {
    const u = new URL(snapshot.url);
    if (!['music.youtube.com','youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(u.hostname)) return null;
    const id = u.hostname === 'youtu.be' ? u.pathname.split('/')[1] : u.searchParams.get('v');
    return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null;
  } catch { return null; }
}
function loadYoutubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytApiPromise) ytApiPromise = new Promise((resolve, reject) => {
    const tag = document.createElement('script'); tag.src = 'https://www.youtube.com/iframe_api';
    const timer = setTimeout(() => { tag.remove(); reject(new Error('API indisponível')); }, 12000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); resolve(window.YT); };
    tag.onerror = () => { clearTimeout(timer); tag.remove(); reject(new Error('API indisponível')); };
    document.head.append(tag);
  }).catch(error => { ytApiPromise = null; throw error; });
  return ytApiPromise;
}
function destroyYoutube() {
  ytGeneration++; ytReady = false; ytSuspended = false; ytResume = false;
  try { ytPlayer?.destroy(); } catch {}
  ytPlayer = null;
  const panel = $('youtube-music'); panel.hidden = true;
  if (!$('youtube-player')) { const div = document.createElement('div'); div.id = 'youtube-player'; panel.querySelector('.music-video').append(div); }
  $('youtube-message').textContent = '';
}
function alignYoutube() {
  if (!ytReady || !musicSnapshot) return;
  const duration = ytPlayer.getDuration();
  if (duration > 0) ytPlayer.seekTo(Math.max(0,(Date.now() - musicSnapshot.startedAt)/1000) % duration, true);
}
function playYoutube() {
  if (!ytReady || ytSuspended) return;
  applyVolume();
  alignYoutube(); ytPlayer.playVideo();
}
function updateYoutubeVisibility() {
  if (!youtubeId(musicSnapshot)) return;
  // O vídeo permanece visível no diálogo. Pausa apenas quando a aba é ocultada.
  const blocked = document.hidden;
  const changed = ytSuspended !== blocked;
  ytSuspended = blocked;
  $('youtube-music').hidden = false;
  if (ytReady && changed) {
    if (blocked) { ytResume = ytPlayer.getPlayerState() === 1 || ytPlayer.getPlayerState() === 3; ytPlayer.pauseVideo(); }
    else if (ytResume) { ytResume = false; playYoutube(); }
  }
}
async function startYoutube(id) {
  const generation = ytGeneration;
  $('youtube-message').textContent = 'Carregando player do YouTube…';
  updateYoutubeVisibility();
  try {
    const YT = await loadYoutubeAPI();
    if (generation !== ytGeneration) return;
    ytPlayer = new YT.Player('youtube-player', {
      width: '100%', height: '200', videoId: id,
      playerVars: { autoplay: 0, loop: 1, playlist: id, playsinline: 1, origin: location.origin },
      events: {
        onReady: () => { if (generation !== ytGeneration) return; ytReady = true; applyVolume(); $('youtube-message').textContent = ''; updateYoutubeVisibility(); },
        onStateChange: e => {
          if (generation !== ytGeneration) return;
          if (e.data === YT.PlayerState.PLAYING) {
            if (ytSuspended) { ytResume = true; ytPlayer.pauseVideo(); return; }
            applyVolume(); $('youtube-message').textContent = '';
          }
        },
        onAutoplayBlocked: () => { if (generation === ytGeneration) { $('youtube-message').textContent = ''; } },
        onError: () => { if (generation === ytGeneration) { $('youtube-message').textContent = 'O YouTube não permite reproduzir esta faixa aqui. Escolha outra faixa ou um arquivo de áudio.'; } }
      }
    });
  } catch { if (generation === ytGeneration) { $('youtube-message').textContent = 'Não foi possível carregar o YouTube. Recarregue a página ou escolha outra faixa.'; } }
}
document.addEventListener('visibilitychange', updateYoutubeVisibility);
function alignAudio() {
  if (musicSnapshot && !youtubeId(musicSnapshot) && Number.isFinite(audio.duration) && audio.duration > 0) {
    const elapsed = Math.max(0, (Date.now() - musicSnapshot.startedAt) / 1000);
    audio.currentTime = elapsed % audio.duration;
  }
}
async function playAudio() {
  const key = musicKey;
  if (!musicSnapshot || youtubeId(musicSnapshot)) return;
  alignAudio();
  try { await audio.play(); if (key === musicKey) $('audio-unlock').hidden = true; }
  catch { if (key === musicKey && musicSnapshot) $('audio-unlock').hidden = false; }
}
for (const element of [localAudio, remoteAudio]) {
  element.addEventListener('loadedmetadata', () => { if (element === audio) alignAudio(); });
  element.addEventListener('error', () => {
    if (element !== audio || !musicSnapshot || youtubeId(musicSnapshot)) return;
    $('music-status').textContent = 'Não foi possível carregar o áudio. Confira o link.';
    $('audio-unlock').textContent = 'Tentar áudio novamente';
    $('audio-unlock').hidden = false;
  });
}
$('audio-unlock').addEventListener('click', () => { if (audio.error) audio.load(); playAudio(); });
function syncMusic() {
  musicSnapshot = state.music || null;
  const key = musicSnapshot ? musicSnapshot.url + '|' + musicSnapshot.startedAt : '';
  const id = youtubeId(musicSnapshot);
  if (key !== musicKey) {
    musicKey = key; audio.pause(); audio.removeAttribute('src'); audio.load(); destroyYoutube(); $('audio-unlock').hidden = true;
    const url = musicSnapshot && !id ? (musicSnapshot.url.startsWith('/') ? apiOrigin + musicSnapshot.url : musicSnapshot.url) : '';
    const local = url && new URL(url, location.href).origin === location.origin;
    audio = local ? localAudio : remoteAudio;
    soundMeter.setTrack(!musicSnapshot ? null : local ? 'file' : 'tab');
    if (musicSnapshot) {
      $('music-url').value = musicSnapshot.url;
      if (id) { $('music-status').textContent = 'YouTube · player individual da mesa.'; startYoutube(id); }
      else {
        $('audio-unlock').textContent = 'Ativar áudio da mesa';
        audio.src = url;
        $('music-status').textContent = 'Música selecionada · reproduzindo em loop.';
        playAudio();
      }
    } else $('music-status').textContent = 'Nenhuma música em reprodução.';
  }
  const settings = state.musicSettings || musicSnapshot || {volume:.5, trackVolume:1};
  for (const [id,value] of [['music-volume',settings.volume ?? .5],['track-volume',settings.trackVolume ?? 1]]) {
    if (document.activeElement !== $(id)) $(id).value = Math.round(value*100);
    $(id+'-label').textContent = $(id).value+'%';
  }
  $('youtube-music').hidden = !musicSnapshot;
  $('youtube-music').classList.toggle('audio-only',Boolean(musicSnapshot && !id));
  applyVolume();
  $('music-stop').disabled = !musicSnapshot;
}

const windowButtons = document.querySelectorAll('.window-dock button');
function toggleWindow(id) {
  for (const button of windowButtons) {
    const panel = $(button.getAttribute('aria-controls'));
    const show = panel.id === id && panel.hidden && (panel.id !== 'admin-window' || isGM());
    panel.hidden = !show;
    button.setAttribute('aria-expanded', String(show));
  }
}
for (const button of windowButtons) {
  const panel = $(button.getAttribute('aria-controls'));
  button.addEventListener('click', () => panel.id === 'admin-window' ? openAdmin() : toggleWindow(panel.id));
  panel.querySelector('.window-close').addEventListener('click', () => { toggleWindow(null); button.focus(); });
  const handle = panel.querySelector('.panel-head');
  let drag = null;
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button')) return;
    const rect = panel.getBoundingClientRect();
    drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', event => {
    if (!drag || !handle.hasPointerCapture(event.pointerId)) return;
    panel.style.left = Math.max(0, Math.min(innerWidth - panel.offsetWidth, event.clientX - drag.x)) + 'px';
    panel.style.top = Math.max(0, Math.min(innerHeight - panel.offsetHeight, event.clientY - drag.y)) + 'px';
    panel.style.bottom = panel.style.right = 'auto';
  });
  handle.addEventListener('lostpointercapture', () => { drag = null; });
  window.addEventListener('resize', () => panel.removeAttribute('style'));
}
if (matchMedia('(min-width: 1150px) and (min-height: 600px)').matches) toggleWindow('characters-window');
document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => el.closest('dialog')?.close()));
window.addEventListener('keydown', e => {
  if ($('space-editor').open) return;
  const key=e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && !e.altKey && ['z','y'].includes(key) && canDraw() && !directPair && !document.querySelector('dialog[open]') && !e.target?.closest?.('input,textarea,select,[contenteditable]')) {
    e.preventDefault();
    if (!e.repeat) dispatch({type:key==='y'||e.shiftKey?'draw.redo':'draw.undo',scene:state.scene});
    return;
  }
  if (e.key === 'Shift' && !['draw','erase'].includes(mode) && isGM() && !shiftHeld && !document.querySelector('dialog[open]') && !directPair && !['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)) { shiftHeld = true; renderControls(); drawBoard(); }
  if (e.key === 'Escape') {
    if (menuTarget) { closeEntityMenu(); return; }
    if (directPair && !document.querySelector('dialog[open]')) requestDirectClose();
    else { clearSelection(); if (['place','interact','draw','erase'].includes(mode)) setMode('move'); else {renderControls();renderRoster();drawBoard();} }
  }
}, true);
window.addEventListener('keyup', e => {
  if ($('space-editor').open) return;
  if (e.key !== 'Shift' || e.shiftKey) return;
  shiftHeld = false; renderControls(); drawBoard();
  if (isGM() && multiSelection.length >= 2 && !directPair && !document.querySelector('dialog[open]')) showInteraction();
}, true);
window.addEventListener('blur', () => { shiftHeld = false; renderControls(); drawBoard(); closeEntityMenu(); });


chooseDie(sides);
render();
setStatus('Desconectado');
const previous = savedSession();
if (previous) enter(previous);
