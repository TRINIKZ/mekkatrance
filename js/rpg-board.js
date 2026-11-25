// The board is painted in an isometric world where one tile is 64 × 32 pixels.
const HALF_W = 32;
const HALF_H = 16;
const MIN_EDGE = -0.5;
const DEFAULT_SCENE_SIZE = 12;
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
const project = (x, y, z = 0) => [(x - y) * HALF_W, (x + y) * HALF_H - z];
const corners = (x, y, w, d, z = 0) => [
  project(x, y, z), project(x + w, y, z),
  project(x + w, y + d, z), project(x, y + d, z)
];
const customScenes = new Map();
const sceneStyle = scene => customScenes.get(scene) || SCENES[scene] || SCENES.docks;
const sceneSize = scene => sceneStyle(scene).size || DEFAULT_SCENE_SIZE;
const sceneLimit = scene => sceneSize(scene) - 1;
function sceneMetrics(scene) {
  const size = sceneSize(scene);
  const large = size > 24;
  const logicalWidth = size * 64 + (large ? 220 : 40);
  const logicalHeight = size * 32 + (large ? 220 : 112);
  return { size, large, logicalWidth, logicalHeight, originX: logicalWidth / 2, originY: large ? 102 : 84, quality: large ? 1 : 1.5 };
}

function polygon(c, points, fill, stroke, width = 1) {
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}

function line(c, a, b, color, width = 1) {
  c.beginPath();
  c.moveTo(...a);
  c.lineTo(...b);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}

function rod(c, a, b, color, width = 1) {
  line(c, project(...a), project(...b), color, width);
}

function tile(c, x, y, w, d, color, z = 0) {
  polygon(c, corners(x, y, w, d, z), color);
}

function block(c, x, y, w, d, base, h, top, left, right, edge) {
  const lo = corners(x, y, w, d, base);
  const hi = corners(x, y, w, d, base + h);
  polygon(c, [lo[3], lo[2], hi[2], hi[3]], left);
  polygon(c, [lo[1], lo[2], hi[2], hi[1]], right);
  polygon(c, hi, top, edge, 0.65);
}

function ellipse(c, x, y, rx, ry, color) {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}

function glow(c, center, radius, color) {
  const [x, y] = center;
  const halo = c.createRadialGradient(x, y, 0, x, y, radius);
  halo.addColorStop(0, color);
  halo.addColorStop(1, 'transparent');
  c.fillStyle = halo;
  c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function noise(x, y, seed) {
  const n = Math.sin(x * 127.13 + y * 319.71 + seed * 70.27) * 43758.5453;
  return n - Math.floor(n);
}

const SCENES = {
  docks: {
    size: 12,
    tiles: ['#434849', '#474c4d', '#404446', '#4d5153', '#464a4b', '#44484b'],
    slab: ['#282b2d', '#202426', '#161a1c'], paint: '#828684', stripe: '#807867'
  },
  lab: {
    size: 12,
    tiles: ['#595f5f', '#5d6364', '#5e6464', '#575d5e', '#595f60', '#636868'],
    slab: ['#363b3c', '#293033', '#1f2426'], paint: '#98a19e', stripe: '#6d8584'
  },
  ruins: {
    size: 12,
    tiles: ['#504d4a', '#565350', '#4c4c49', '#595551', '#52514e', '#4a4a48'],
    slab: ['#3a3835', '#292827', '#202222'], paint: '#818179', stripe: '#7d7061'
  },
  city: {
    size: 50,
    tiles: ['#3c3837', '#43403e', '#3e3b38', '#474341', '#403d3b', '#393634'],
    slab: ['#292828', '#1b1b1c', '#121315'], paint: '#888783', stripe: '#928872', road: '#212224', lane: '#a2a094', sidewalk: '#4d4b49'
  }
};


const CITY_ROADS = [
  { x: 0, y: 7, w: 50, h: 4, kind: 'h' },
  { x: 0, y: 19, w: 50, h: 4, kind: 'h' },
  { x: 0, y: 31, w: 50, h: 4, kind: 'h' },
  { x: 0, y: 43, w: 50, h: 4, kind: 'h' },
  { x: 7, y: 0, w: 4, h: 50, kind: 'v' },
  { x: 19, y: 0, w: 4, h: 50, kind: 'v' },
  { x: 31, y: 0, w: 4, h: 50, kind: 'v' },
  { x: 43, y: 0, w: 4, h: 50, kind: 'v' },
  { x: 14, y: 10, w: 2, h: 9, kind: 'v' },
  { x: 26, y: 22, w: 2, h: 9, kind: 'v' },
  { x: 38, y: 34, w: 2, h: 9, kind: 'v' },
  { x: 10, y: 26, w: 9, h: 2, kind: 'h' },
  { x: 22, y: 14, w: 9, h: 2, kind: 'h' },
  { x: 34, y: 38, w: 9, h: 2, kind: 'h' }
];
const CITY_CROSSWALKS = [
  [8.5, 8.5], [20.5, 8.5], [32.5, 8.5], [44.5, 8.5],
  [8.5, 20.5], [20.5, 20.5], [32.5, 20.5], [44.5, 20.5],
  [8.5, 32.5], [20.5, 32.5], [32.5, 32.5], [44.5, 32.5],
  [8.5, 44.5], [20.5, 44.5], [32.5, 44.5], [44.5, 44.5]
];
const CITY_BLOCKS = [
  { x: 0, y: 0, w: 7, d: 7 }, { x: 11, y: 0, w: 8, d: 7 }, { x: 23, y: 0, w: 8, d: 7 }, { x: 35, y: 0, w: 8, d: 7 }, { x: 47, y: 0, w: 3, d: 7 },
  { x: 0, y: 11, w: 7, d: 8 }, { x: 11, y: 11, w: 3, d: 8 }, { x: 16, y: 11, w: 3, d: 8 }, { x: 23, y: 11, w: 8, d: 3 }, { x: 23, y: 16, w: 8, d: 3 }, { x: 35, y: 11, w: 8, d: 8 }, { x: 47, y: 11, w: 3, d: 8 },
  { x: 0, y: 23, w: 7, d: 8 }, { x: 11, y: 23, w: 8, d: 3 }, { x: 11, y: 28, w: 8, d: 3 }, { x: 23, y: 23, w: 3, d: 8 }, { x: 28, y: 23, w: 3, d: 8 }, { x: 35, y: 23, w: 8, d: 8 }, { x: 47, y: 23, w: 3, d: 8 },
  { x: 0, y: 35, w: 7, d: 8 }, { x: 11, y: 35, w: 8, d: 8 }, { x: 23, y: 35, w: 8, d: 8 }, { x: 35, y: 35, w: 3, d: 3 }, { x: 35, y: 40, w: 3, d: 3 }, { x: 40, y: 35, w: 3, d: 8 }, { x: 47, y: 35, w: 3, d: 8 },
  { x: 0, y: 47, w: 7, d: 3 }, { x: 11, y: 47, w: 8, d: 3 }, { x: 23, y: 47, w: 8, d: 3 }, { x: 35, y: 47, w: 8, d: 3 }, { x: 47, y: 47, w: 3, d: 3 }
];
function rectHas(rect, x, y) { return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h; }
function cityRoadAt(x, y) { return CITY_ROADS.some(rect => rectHas(rect, x, y)); }
function cityNearRoad(x, y) {
  if (cityRoadAt(x, y)) return false;
  return CITY_ROADS.some(rect => x >= rect.x - 1 && x < rect.x + rect.w + 1 && y >= rect.y - 1 && y < rect.y + rect.h + 1);
}
function cityCrosswalkAt(x, y) { return CITY_CROSSWALKS.some(([cx, cy]) => Math.abs(x - cx) <= 1.2 && Math.abs(y - cy) <= 1.2); }
function cityPalette(index) {
  return [
    ['#4f4a47','#403a38','#312c2a','#bc674e','#6ec6ff'],
    ['#565150','#443f3c','#34302e','#e1ab4b','#ff6d8f'],
    ['#4a4f52','#3c4042','#2d3134','#64c1b2','#ffa56e'],
    ['#5d5853','#48423f','#363130','#82bfe5','#ff7d73'],
    ['#494848','#3c3b3b','#2d2d2f','#c66b52','#8dc4a3']
  ][index % 5];
}

function groundText(c, text, x, y, size, color) {
  const [a, b] = project(x, y, 0.15);
  c.save();
  c.transform(0.89, 0.445, -0.89, 0.445, a, b);
  c.fillStyle = color;
  c.font = 'bold ' + size + 'px monospace';
  c.fillText(text, 0, 0);
  c.restore();
}

function grate(c, x, y, w, d) {
  tile(c, x - 0.025, y - 0.025, w + 0.05, d + 0.05, '#686b69');
  tile(c, x, y, w, d, '#222627');
  for (let n = 0.06; n < w - 0.025; n += 0.14) tile(c, x + n, y + 0.03, 0.045, d - 0.06, '#525656');
  tile(c, x, y + d / 2, w, 0.025, '#686a69');
}

function hazard(c, x, y, length, alongY, tint) {
  c.save();
  if (alongY) {
    const [a,b] = project(x,y);
    c.translate(a,b);
    c.scale(-1,1);
    x = 0; y = 0;
  }
  tile(c, x, y, length, 0.20, '#292c2c');
  for (let n = 0.06; n < length - 0.24; n += 0.36) {
    polygon(c, [[n,0],[n+0.14,0],[n+0.3,0.2],[n+0.16,0.2]].map(([a,b]) => project(x+a,y+b)), tint);
  }
  c.restore();
}

function puddle(c, x, y, w, d) {
  const shape = [[0,.25],[.18,0],[.37,.17],[.62,.04],[.78,.22],[.98,.25],[.9,.59],[.67,.68],[.5,1],[.27,.89],[.2,.65],[0,.62]];
  const points=shape.map(([a,b]) => project(x+a*w,y+b*d));
  const surface=c.createLinearGradient(points[0][0],points[0][1],points[6][0]+1,points[6][1]+1);
  surface.addColorStop(0,'#343e40');
  surface.addColorStop(.62,'#3a4244');
  surface.addColorStop(1,'#5e6565');
  polygon(c,points,surface,'#616a6a77',.7);
  for (let i = 0; i < 6; i++) {
    const a = x + (.24 + noise(i, x, 3) * .45)*w;
    const b = y + (.22 + noise(i, y, 7) * .4)*d;
    const p = project(a,b);
    line(c,p,[p[0]+2+noise(i,1,1)*10,p[1]],i%2 ? '#757f7e80' : '#5c63638f', .7);
  }
}

function foundation(c, scene, showGrid) {
  if (customScenes.has(scene)) return paintSpaceFloor(c,customScenes.get(scene),showGrid);
  const style = sceneStyle(scene);
  const size = sceneSize(scene);
  const maxEdge = size - 0.5;
  const [lip, left, right] = style.slab;
  const floor = corners(MIN_EDGE, MIN_EDGE, size, size);
  c.save();
  c.translate(0, 15);
  c.shadowBlur = scene === 'city' ? 36 : 22;
  c.shadowColor = '#000b';
  polygon(c, floor, '#0a0c0d');
  c.restore();
  block(c,-.5,-.5,size,size,-18,16,lip,left,right);
  const perimeterStep = scene === 'city' ? 2 : 1;
  for (let n = 0; n < size; n += perimeterStep) {
    for(const [x,y,dx,dy] of [[n-.50,maxEdge,1,0],[maxEdge,n-.50,0,1]]) {
      rod(c,[x,y,-1],[x,y,-17],'#101315',1);
      rod(c,[x+dx*.08,y+dy*.08,-4],[x+dx*.88,y+dy*.88,-4], '#63696766',1);
      rod(c,[x+dx*.08,y+dy*.08,-12],[x+dx*.88,y+dy*.88,-12], '#14181b',2);
      for (const t of [.13,.84]) {
        const [a,b] = project(x+dx*t,y+dy*t,-7);
        c.fillStyle = '#73787888'; c.fillRect(a,b,1.4,1.4);
      }
      if(n % 4 === 2) {
        rod(c,[x+dx*.34,y+dy*.34,-7],[x+dx*.63,y+dy*.63,-7], '#465454',3);
        rod(c,[x+dx*.38,y+dy*.38,-6.5],[x+dx*.58,y+dy*.58,-6.5], '#96aaa3',1.1);
      }
    }
  }
  const isCity = scene === 'city';
  const roadCols = isCity ? new Set([4,5,6,14,15,16,24,25,26,34,35,36,44,45,46]) : null;
  const roadRows = isCity ? new Set([8,9,10,20,21,22,32,33,34,42,43,44]) : null;
  const avenueCenterCols = isCity ? new Set([5,15,25,35,45]) : null;
  const avenueCenterRows = isCity ? new Set([9,21,33,43]) : null;
  for (let x=0; x<size; x++) for (let y=0; y<size; y++) {
    let baseColor;
    if (isCity && (roadCols.has(x) || roadRows.has(y))) {
      const palette = [style.road || '#212224', '#222527', '#25272a', '#1d1f22'];
      baseColor = palette[Math.floor(noise(x,y,41)*palette.length)];
    } else {
      const swatch = Math.floor(noise(x,y,1)*style.tiles.length);
      baseColor = style.tiles[swatch];
    }
    polygon(c,corners(x-.5,y-.5,1,1),baseColor,baseColor,.55);
    if (showGrid) {
      rod(c,[x-.5,y-.5,0],[x+.5,y-.5,0],'#1f232685',.85);
      rod(c,[x-.5,y-.5,0],[x-.5,y+.5,0],'#1e24268f',.85);
      rod(c,[x-.48,y-.47,0],[x+.48,y-.47,0],'#91949244',.65);
    }
    const specks = isCity ? 4 : 13;
    for(let i=0;i<specks;i++) {
      const a=x-.44+noise(x+i,y,2)*.87, b=y-.45+noise(x,y+i,3)*.9;
      const at = project(a,b);
      c.fillStyle = i%2 ? '#191e201b' : '#adaea820';
      c.fillRect(Math.floor(at[0]),Math.floor(at[1]),.6+noise(x,y,i+15)*2,.8);
    }
    if (!isCity && noise(x,y,9)>.86) {
      const p=project(x-.4,y+.12), q=project(x-.16,y+.03), r=project(x-.09,y+.17);
      line(c,p,q,'#23282a5c',.9); line(c,q,r,'#23282a5c',.9);
    }
  }
  for(const [x,y,w,d] of [[-.48,-.48,size-.04,.075],[-.48,-.48,.075,size-.04],[-.48,size-.62,size-.04,.085],[size-.62,-.48,.085,size-.04]]) tile(c,x,y,w,d,'#7c7f7c44');
  if (scene === 'docks') {
    tile(c,3.41,-.28,.065,11.61,'#2d3233');
    tile(c,3.49,-.28,.026,11.61,'#727572');
    for(let y=-.19;y<11.3;y+=.64) tile(c,3.41,y,.09,.075,'#585c5b');
    tile(c,3.6,-.3,.052,10.8,'#81837f7a');
    tile(c,8.44,-.3,.052,10.8,'#81837f7a');
    for(let y=1.5;y<10.8;y+=1.5) tile(c,6.02,y,.075,.67,'#908e8591');
    for(let x=.4;x<3.3;x+=.6) for(const y of [5.55,9.9]) tile(c,x,y,.35,.072,style.paint);
    hazard(c,.15,4.82,3.12,false,style.stripe);
    hazard(c,8.95,4.4,2.06,false,style.stripe);
    hazard(c,3.84,10.23,2.10,false,style.stripe);
    grate(c,5.9,1.98,2.3,.27);
    grate(c,8.8,7.35,.9,.34);
    grate(c,2.1,7.05,1.15,.30);
    puddle(c,3.1,6.3,1.6,1.2);
    puddle(c,7.9,2.5,1.7,.65);
    puddle(c,5.0,9.2,1.2,.51);
    groundText(c,'DOCA',6.65,8.55,12,'#acaba480');
    groundText(c,'07',6.58,9.22,27,'#acaba491');
    for(const y of [2.4,3.05,9.95]) {
      const arrow=[[0,0],[.31,.30],[.18,.30],[0,.13],[-.18,.30],[-.31,.30]];
      polygon(c,arrow.map(([a,b])=>project(5.25+a,y+b)),'#9e9d949a');
    }
  } else if(scene === 'lab') {
    for(const n of [2.5,8.5]) { tile(c,n,-.3,.09,11.5,'#919c98'); tile(c,-.3,n,11.5,.09,'#4f5e5f'); }
    for(let n=0;n<5;n++) { grate(c,.1+n*2.3,3.06,1.05,.32); grate(c,.1+n*2.3,8.82,1.05,.32); }
    for(const x of [3.1,7.6]) hazard(c,x,6.7,1.48,false,style.stripe);
    groundText(c,'LAB',4.8,8,22,'#aeb1aca8');
  } else if(scene === 'ruins') {
    for(let n=0;n<42;n++) {
      const x=noise(n,0,1)*10.8,y=noise(n,1,5)*11;
      const p=project(x,y),q=project(x+.10,y+.16),r=project(x+.05,y+.33);
      line(c,p,q,'#31312f'); line(c,q,r,'#31312f');
      if(n%3===0) rod(c,[x+.11,y+.19,0],[x+.32,y+.20,0],'#353532',1.2);
    }
    puddle(c,6.8,7,1.65,1.8); puddle(c,3,5.1,1.2,.8);
    groundText(c,'ZONA',6.9,4.9,15,'#94908590');
  } else {
    // Cidade 50x50 reprojetada em vista isométrica, com quadras, becos, ruas e áreas de pedestres.
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        if (cityRoadAt(x, y)) {
          const asphalt = ['#1c1e22', '#1f2226', '#22262a', '#25292d'];
          polygon(c, corners(x-.5, y-.5, 1, 1), asphalt[Math.floor(noise(x,y,41)*asphalt.length)]);
        } else if (cityNearRoad(x, y)) {
          const pavement = ['#4a4644', '#514c49', '#484441', '#56504d'];
          polygon(c, corners(x-.5, y-.5, 1, 1), pavement[Math.floor(noise(x,y,8)*pavement.length)]);
        }
      }
    }
    for (const [cx,cy] of CITY_CROSSWALKS) {
      for (let i = -1.15; i <= 1.15; i += .38) {
        tile(c, cx-1.3, cy+i, .58, .08, '#c9c2a4cc');
        tile(c, cx+i, cy-1.3, .08, .58, '#c9c2a4cc');
      }
    }
    for (const rect of CITY_ROADS) {
      if (rect.kind === 'h' && rect.h >= 3) for (let x = rect.x + .35; x < rect.x + rect.w - .35; x += 1.3) tile(c, x, rect.y + rect.h/2 - .05, .7, .1, '#b6ae88a8');
      if (rect.kind === 'v' && rect.w >= 3) for (let y = rect.y + .35; y < rect.y + rect.h - .35; y += 1.3) tile(c, rect.x + rect.w/2 - .05, y, .1, .7, '#b6ae88a8');
    }
    for (const [x,y,w,d] of [[2.1,4.9,1.5,.8],[12.2,15.6,1.2,.7],[28.3,4.4,1.3,.8],[36.8,17.2,1.4,.6],[4.6,27.4,1.0,.7],[24.8,27.8,1.4,.9],[39.4,41.5,1.3,.8]]) puddle(c,x,y,w,d);
    groundText(c,'CLEAR',13.5,6.4,20,'#d6d0c0a0');
    groundText(c,'STREET',25.4,18.5,20,'#d6d0c0a0');
    groundText(c,'GRAFF',37.7,30.6,18,'#72bfd499');
    groundText(c,'BLOCK',8.8,42.4,16,'#c87d6799');
  }
}

const CONTAINERS = {
  rust: ['#614e46','#4e3a34','#3b2e2b','#867264','#272120'],
  teal: ['#525c5d','#3d4848','#2b3335','#717978','#262d2e'],
  blue: ['#525658','#3e4448','#2c3234','#747979','#23292b'],
  sand: ['#716f67','#52514a','#3e3e39','#87837a','#353532']
};

function container(c,x,y,w,d,h,palette,code) {
  const [top,left,right,hi,dark]=palette;
  block(c,x,y,w,d,0,h,top,left,right,hi);
  for(let t=.10;t<w-.08;t+=.19) {
    rod(c,[x+t,y+.07,h+.2],[x+t,y+d-.07,h+.2],hi,1.05);
    rod(c,[x+t+.045,y+.07,h+.2],[x+t+.045,y+d-.07,h+.2],dark,.8);
    rod(c,[x+t,y+d,h-3.3],[x+t,y+d,3],dark,2.25);
    rod(c,[x+t+.034,y+d,h-3.65],[x+t+.034,y+d,3.4],hi,.95);
  }
  rod(c,[x,y+d,2],[x+w,y+d,2],dark,2.5);
  rod(c,[x,y+d,h-1.6],[x+w,y+d,h-1.6],hi,1.6);
  for (const t of [.08,d*.49,d*.91]) {
    rod(c,[x+w,y+t,2],[x+w,y+t,h-2],dark,3);
    rod(c,[x+w,y+t,3],[x+w,y+t,h-3],hi,.9);
    rod(c,[x+w,y+t-.052,h*.48],[x+w,y+t+.09,h*.48],'#929088',1);
  }
  for(const t of [.06,w-.08]) for(const z of [2,h-2.5]) {
    const p=project(x+t,y+d,z); c.fillStyle=dark; c.fillRect(p[0]-1,p[1]-1,2.6,2.6);
  }
  const p=project(x+.22,y+d,h*.45);
  c.save(); c.transform(1,.5,0,1,...p);
  c.fillStyle='#97958c'; c.font='bold 6px monospace'; c.fillText(code,0,0);
  c.fillRect(0,2,7,.8); c.fillRect(9,2,3,.8);
  c.restore();
}

function crate(c,x,y,w=.64,d=.64,h=14) {
  block(c,x,y,w,d,0,h,'#6b6960','#514e47','#3f3e39','#838178');
  for(const t of [.13,.82]) {
    tile(c,x+w*t,y,.07,d,'#363836',h+.15);
    rod(c,[x+w*t,y+d,0],[x+w*t,y+d,h],'#373937',2.0);
  }
  for(const z of [2,h-2]) rod(c,[x+.02,y+d,z],[x+w-.02,y+d,z],'#827e75',1);
  const [a,b]=project(x+w*.5,y+d,h*.56); c.fillStyle='#9e9c94'; c.fillRect(a-2,b-1,4,2);
}

function tank(c,x,y,r,h,light = false) {
  const [a,b]=project(x,y);
  const col = light ? ['#8b8d88','#6f7572','#535b5b','#313a3c'] : ['#686c6b','#545a59','#3a4143','#2a3033'];
  const shading=c.createLinearGradient(a-r,0,a+r,0);
  shading.addColorStop(0,col[2]); shading.addColorStop(.25,col[1]); shading.addColorStop(.5,col[1]); shading.addColorStop(1,col[3]);
  ellipse(c,a,b,r,r*.43,col[3]); c.fillStyle=shading; c.fillRect(a-r,b-h,r*2,h);
  for(const z of [3,h*.64,h-2]) {
    c.beginPath(); c.ellipse(a,b-z,r,r*.43,0,0,Math.PI); c.strokeStyle=col[3]; c.lineWidth=2; c.stroke();
    c.beginPath(); c.ellipse(a,b-z-1.3,r,r*.43,0,0,Math.PI); c.strokeStyle=col[0]; c.lineWidth=.8; c.stroke();
  }
  ellipse(c,a,b-h,r,r*.43,col[0]); ellipse(c,a,b-h-.8,r*.85,r*.33,col[1]);
  ellipse(c,a-1,b-h-1,r*.19,r*.11,col[3]);
  c.fillStyle=light?'#999484':'#827d6b'; c.fillRect(a-r*.52,b-h*.52,Math.max(2,r*.42),3);
  c.fillStyle='#434849'; c.fillRect(a-r*.45,b-h*.52+1,1.5,1);
}

function warehouse(c,x,y,w,d,h,lab = false) {
  const wall=lab?'#5b6163':'#3c4143',right=lab?'#434c4e':'#2d3336';
  block(c,x,y,w,d,0,h,'#5e6263',wall,right,'#7b7e7d');
  for(let t=.1;t<w;t+=.21) rod(c,[x+t,y+d,2],[x+t,y+d,h-1], '#242a2d4d',1);
  for(let t=.12;t<d;t+=.25) rod(c,[x+w,y+t,1],[x+w,y+t,h], '#1d232766',1);
  block(c,x-.04,y-.04,w+.08,d+.08,h-2.5,3.5,'#5a6062','#676c6d','#3e4548','#808383');
  tile(c,x+.12,y+.13,w-.24,d-.26,'#4b5153',h+1.2);
  for(let t=.26;t<w-.14;t+=.28) rod(c,[x+t,y+.14,h+1.4],[x+t,y+d-.14,h+1.4],'#676c6e',.75);
  block(c,x+.3,y+.3,w*.52,.55,h+1.5,4,'#666b6c','#484d4f','#404748','#7b7f7e');
  for(let t=.06;t<w*.5-.04;t+=.12) rod(c,[x+.3+t,y+.35,h+5.65],[x+.3+t,y+.78,h+5.65],'#32383a',1.7);
  // Two roof fans, their radial fins and the service conduit to the aerial.
  for(const t of [.52,1.12]) {
    const [a,b]=project(x+t,y+d-.43,h+1.4);
    ellipse(c,a,b,6.8,3.7,'#303538');ellipse(c,a,b-.9,6.2,3.0,'#7a7f7e');ellipse(c,a,b-1.1,5.1,2.3,'#3b4244');
    for(let n=0;n<4;n++) {
      const angle=n*Math.PI/4;
      line(c,[a-4.8*Math.cos(angle),b-1.2-2.2*Math.sin(angle)],[a+4.8*Math.cos(angle),b-1.2+2.2*Math.sin(angle)],'#616869',.7);
    }
  }
  rod(c,[x+1.74,y+.8,h+2.2],[x+w-.40,y+.8,h+2.2],'#7c7f7c',2);
  rod(c,[x+w-.40,y+.8,h+2.2],[x+w-.40,y+.51,h+2.2],'#69706f',2);
  // Shutter and glazing are drawn in the planes of the two visible walls.
  const front=(a,b,fill)=>polygon(c,[project(x+a,y+d,b),project(x+a+.95,y+d,b),project(x+a+.95,y+d,1),project(x+a,y+d,1)],fill);
  front(.26,h*.67,'#22282b');
  for(let z=3;z<h*.63;z+=3) rod(c,[x+.29,y+d,z],[x+1.18,y+d,z],'#505557',1);
  block(c,x+.17,y+d-.035,1.13,.2,h*.70,1.8,'#6a6f71','#838682','#484f50');
  const doorLight=project(x+.34,y+d+.05,h*.65);
  glow(c,doorLight,9,'#95776575');
  rod(c,[x+.26,y+d,h*.66],[x+.45,y+d,h*.66],lab?'#b0beb8':'#ac988b',2.0);
  const lights=lab?'#a4b8b3':'#8ea19d';
  for(let t=1.42;t<w-.30;t+=.39) {
    polygon(c,[project(x+t,y+d,h*.72),project(x+t+.30,y+d,h*.72),project(x+t+.30,y+d,h*.47),project(x+t,y+d,h*.47)],'#242a2c','#686d6d',1);
    rod(c,[x+t+.025,y+d,h*.68],[x+t+.265,y+d,h*.68],lights,2.4);
    glow(c,project(x+t+.15,y+d,h*.63),7,'#7e9f9738');
    rod(c,[x+t+.025,y+d,h*.57],[x+t+.265,y+d,h*.57],'#596565',1.4);
  }
  for(let t=.22;t<d-.37;t+=.53) {
    rod(c,[x+w,y+t,h*.62],[x+w,y+t+.35,h*.62],'#1d2426',7);
    rod(c,[x+w,y+t,h*.64],[x+w,y+t+.35,h*.64],lights,2.1);
  }
  for(const t of [.10,w-.14]) {
    rod(c,[x+t,y+d,2],[x+t,y+d,h-3],'#2b3235',3.8);
    rod(c,[x+t+.02,y+d,2],[x+t+.02,y+d,h-3],'#787c7c',1);
  }
  block(c,x+w-.56,y+.37,.28,.29,h+.8,5,'#6f7373','#515757','#3b4244');
  rod(c,[x+w-.42,y+.51,h+5],[x+w-.42,y+.51,h+16],'#575e5f',3.5);
  rod(c,[x+w-.42,y+.51,h+15],[x+w-.42,y+.51,h+25],'#8e908b',1.4);
  const tip=project(x+w-.42,y+.51,h+25); glow(c,tip,7,'#87595091'); ellipse(c,...tip,1.6,1.3,'#9d7e72');
}

function pole(c,x,y,h,dx=0,dy=.54) {
  block(c,x-.09,y-.09,.18,.18,0,2,'#848783','#4c4f4d','#363b3d');
  rod(c,[x,y,1],[x,y,h],'#232a2d',4);
  rod(c,[x-.014,y,2],[x-.014,y,h],'#757b7a',1.4);
  rod(c,[x,y,h-6],[x+dx*.65,y+dy*.65,h],'#52595b',1.6);
  rod(c,[x,y,h],[x+dx,y+dy,h],'#7e8483',2.2);
  const tip=project(x+dx,y+dy,h-.4);
  ellipse(c,...tip,4.1,1.7,'#858c89');
  glow(c,tip,12,'#82999370');
  ellipse(c,tip[0],tip[1]+1,3.0,1,'#b1beb7');
}

function fence(c,x,y,dx,dy,length) {
  for(const z of [5,10.5]) {
    rod(c,[x,y,z],[x+dx*length,y+dy*length,z],'#181e20',2.4);
    rod(c,[x,y,z+.6],[x+dx*length,y+dy*length,z+.6],'#727775',.85);
  }
  const count=Math.ceil(length/.7);
  for(let k=0;k<=count;k++) {
    const a=x+dx*length*k/count,b=y+dy*length*k/count;
    rod(c,[a,b,0],[a,b,11],'#32383a',2.6); rod(c,[a-.015,b,1],[a-.015,b,11.5],'#7f807d',1);
  }
}

function crane(c,x,y) {
  const ochre='#6b5e4e', light='#8f8472',dark='#434039';
  block(c,x-.40,y-.38,.80,.76,0,5,'#595a57','#3a3e3f','#313537');
  for(const [dx,dy] of [[-.21,-.21],[.21,-.21],[-.21,.21],[.21,.21]]) {
    rod(c,[x+dx,y+dy,5],[x+dx*.7,y+dy*.7,61],dark,4.4);
    rod(c,[x+dx,y+dy,5],[x+dx*.7,y+dy*.7,61],light,1.6);
  }
  for(let z=7;z<58;z+=10) {
    rod(c,[x-.18,y+.18,z],[x+.18,y+.18,z+9],ochre,2);
    rod(c,[x+.18,y-.18,z],[x+.18,y+.18,z+9],light,2);
    rod(c,[x-.18,y+.18,z+10],[x+.18,y+.18,z+10],dark,1.5);
  }
  block(c,x-.29,y-.4,.6,.65,57,8,light,ochre,dark);
  rod(c,[x+.3,y-.33,62],[x+.3,y-.04,62],'#2d3334',3.2);
  // Cantilever lattice with an empty hook over the loading apron.
  for(const t of [-.11,.11]) for(const z of [62,71]) rod(c,[x+t,y-.64,z],[x+t,y+2.10,z],t<0?dark:light,2.4);
  for(let t=-.6;t<2;t+=.32) {
    rod(c,[x+.11,y+t,62],[x+.11,y+t+.25,71],ochre,2);
    rod(c,[x-.11,y+t,71],[x+.11,y+t,71],light,1.7);
  }
  rod(c,[x,y+1.83,62],[x,y+1.83,23],'#24292a',1.4);
  const p=project(x,y+1.83,23);
  c.strokeStyle='#807a6e';c.lineWidth=1.9;c.beginPath();c.arc(p[0]+1,p[1]+1,2.4,0,Math.PI*1.35);c.stroke();
  const tip=project(x,y-.6,72); glow(c,tip,7,'#8b685a6e'); ellipse(c,...tip,1.4,1.3,'#a48b7a');
}

function brokenWall(c,x,y,w,d,h) {
  block(c,x,y,w,d,0,h,'#67645f','#54524e','#3f4040','#747069');
  for(let z=5;z<h;z+=5) {
    rod(c,[x,y+d,z],[x+w,y+d,z],'#363836',.9);
    for(let n=(z%2?0.16:.3);n<w-.05;n+=.4) rod(c,[x+n,y+d,z],[x+n,y+d,z-4.8],'#3f3f3d',.8);
  }
  const divisions=Math.ceil(w/.4);
  for(let n=0;n<divisions;n++) {
    const height=Math.floor(noise(n,x,y)*4)*3;
    if(height) block(c,x+n*w/divisions,y,w/divisions-.015,d,h,height,'#6f6c66','#5d5a56','#4a4b49');
  }
}

function cityBuilding(c,x,y,w,d,h,top='#45474a',left='#393837',right='#2c2c2d',accent='#8b5f59', graffiti='#6b97a4') {
  block(c,x,y,w,d,0,h,top,left,right,'#5f6265');
  for(let n=.36;n<w-.22;n+=.7) {
    for(let z=6;z<h-7;z+=8) {
      const a=project(x+n,y+d+.01,z), b=project(x+n+.25,y+d+.01,z+4.5);
      polygon(c,[a, project(x+n+.25,y+d+.01,z), b, project(x+n,y+d+.01,z+4.5)], '#778688bb');
    }
  }
  for(let n=.32;n<d-.18;n+=.7) {
    for(let z=6;z<h-7;z+=8) {
      const a=project(x+w+.01,y+n,z), b=project(x+w+.01,y+n+.24,z+4.5);
      polygon(c,[a, project(x+w+.01,y+n+.24,z), b, project(x+w+.01,y+n,z+4.5)], '#778c93a0');
    }
  }
  const tag1 = project(x+w+.01, y+d*.34, 10);
  const tag2 = project(x+w+.01, y+d*.57, 17);
  line(c, tag1, [tag1[0]+18, tag1[1]-7], accent, 2.6);
  line(c, [tag1[0]+18, tag1[1]-7], [tag1[0]+31, tag1[1]+2], graffiti, 2.6);
  line(c, [tag1[0]+8, tag1[1]+11], [tag1[0]+22, tag1[1]+16], '#b2a47f', 2.2);
  line(c, tag2, [tag2[0]+16, tag2[1]-3], graffiti, 2.2);
  line(c, [tag2[0]+3, tag2[1]+9], [tag2[0]+22, tag2[1]+14], '#967368', 2.2);
}

function cityHouse(c,x,y,w,d,h,body='#62574f',left='#4f433d',right='#3e3531',accent='#d7834c',sign='#7fd1ff') {
  block(c,x,y,w,d,0,h,body,left,right,'#726861');
  tile(c,x+.1,y+.1,w-.2,d-.2,'#6d625b',h+.7);
  polygon(c,[project(x+w*.18,y+d+.01,0), project(x+w*.34,y+d+.01,0), project(x+w*.34,y+d+.01,h*.45), project(x+w*.18,y+d+.01,h*.45)], '#2a2522');
  for (let n = .18; n < w-.25; n += .48) {
    const z1 = h*.38, z2 = h*.66;
    polygon(c,[project(x+n,y+d+.01,z1), project(x+n+.18,y+d+.01,z1), project(x+n+.18,y+d+.01,z1+4), project(x+n,y+d+.01,z1+4)], '#83b8ccbb');
    if (h > 18) polygon(c,[project(x+n,y+d+.01,z2), project(x+n+.18,y+d+.01,z2), project(x+n+.18,y+d+.01,z2+4), project(x+n,y+d+.01,z2+4)], '#7eacc1aa');
  }
  tile(c,x+.12,y+d-.08,Math.max(.45,w-.24),.08,accent,h*.32);
  const tag = project(x+w+.01, y+d*.5, h*.25);
  line(c, tag, [tag[0]+12, tag[1]-5], sign, 2);
  line(c, [tag[0]+4, tag[1]+8], [tag[0]+17, tag[1]+12], accent, 1.8);
}

function addCityLot(add, x, y, w, d, palette, seed) {
  const [top,left,right,accent,graffiti] = palette;
  const inset = .35;
  const sx = x + inset, sy = y + inset, iw = Math.max(0.8, w - inset*2), id = Math.max(0.8, d - inset*2);
  if (w <= 3.4 || d <= 3.4) {
    const h = 16 + (seed % 3) * 4;
    add(sx, sy, iw, id, c => cityHouse(c, sx, sy, iw, id, h, top, left, right, accent, graffiti), 1.05);
    return;
  }
  const houseDepth = Math.min(1.7, id * .38);
  const count = Math.max(2, Math.floor(iw / 1.45));
  const gap = .14;
  let cursor = sx;
  const hw = Math.max(.95, (iw - gap * (count - 1)) / count);
  for (let i = 0; i < count; i++) {
    const h = 15 + ((seed + i) % 4) * 3;
    add(cursor, sy, hw, houseDepth, c => cityHouse(c, cursor, sy, hw, houseDepth, h, top, left, right, i % 2 ? accent : '#d1b15d', graffiti), 1.02);
    cursor += hw + gap;
  }
  if (id > 5.2) {
    const bx = sx + .35 + noise(seed, 4, 1) * (iw * .22);
    const by = sy + houseDepth + .4;
    const bw = Math.min(iw - .7, Math.max(1.7, iw * .42));
    const bd = Math.min(id - houseDepth - .75, Math.max(1.4, id * .33));
    const h = 22 + (seed % 5) * 4;
    add(bx, by, bw, bd, c => cityBuilding(c, bx, by, bw, bd, h, top, left, right, accent, graffiti), 1.15);
    if (id - houseDepth > 3.5 && w > 5) {
      const cx = sx + iw - 1.15, cy = sy + id - 1.05;
      add(cx, cy, .62, .62, c => crate(c, cx, cy, .62, .62, 12), .5);
    }
  } else if (iw > 3.8) {
    const bx = sx + iw*.42, by = sy + houseDepth + .28;
    const bw = Math.min(iw*.4, 1.8), bd = Math.min(id-houseDepth-.4, 1.2);
    if (bd > .6) add(bx, by, bw, bd, c => cityHouse(c, bx, by, bw, bd, 16 + seed % 3 * 3, top, left, right, accent, graffiti), 1.0);
  }
}

function parkedCar(c,x,y,w=.92,d=.44,color='#704b49', roof='#16181b') {
  const bodyTop = color;
  const bodyLeft = '#392728';
  const bodyRight = '#271a1b';
  block(c,x,y,w,d,0,6.5,bodyTop,bodyLeft,bodyRight,'#aba099');
  block(c,x+.14,y+.06,w-.28,d-.12,6.5,3.3,roof,'#212428','#181a1d','#809aa2');
  tile(c,x+.18,y+.06,w-.36,.05,'#8fa0a7',9.9);
  tile(c,x+.18,y+d-.11,w-.36,.05,'#8fa0a7',9.9);
  const lampA = project(x+.08,y+d,1.5), lampB = project(x+w-.1,y,1.5);
  c.fillStyle = '#b2a488'; c.fillRect(lampA[0]-1,lampA[1]-1,2,2);
  c.fillStyle = '#8b5e5b'; c.fillRect(lampB[0]-1,lampB[1]-1,2,2);
}

function objectsFor(scene) {
  if (customScenes.has(scene)) return spaceProps(customScenes.get(scene));
  const props=[];
  const add=(x,y,w,d,paint,shadow=1)=>props.push({x,y,w,d,paint,shadow,depth:x+y+(w+d)*.58});
  const box=(x,y,w,d,h,color,code)=>add(x,y,w,d,c=>container(c,x,y,w,d,h,CONTAINERS[color],code));
  const cargo=(x,y,w=.64,d=.64,h=14)=>add(x,y,w,d,c=>crate(c,x,y,w,d,h));
  const lamp=(x,y,h,dx,dy)=>add(x-.05,y-.05,.10,.10,c=>pole(c,x,y,h,dx,dy),0);
  const rail=(x,y,dx,dy,len)=>add(x,y,dx*len,dy*len,c=>fence(c,x,y,dx,dy,len),0);
  const drum=(x,y,r,h,light=false)=>add(x-.18,y-.18,.36,.36,c=>tank(c,x,y,r,h,light),.65);
  if(scene==='docks') {
    add(.02,-.10,3.04,1.64,c=>warehouse(c,.02,-.10,3.04,1.64,35));
    box(-.05,2.56,2.93,1.15,25,'rust','OS-41');
    box(-.26,6.98,2.18,1.05,19,'teal','CS-82');
    cargo(.04,8.48,.65,.66,13); cargo(.87,8.44,.56,.61,12);
    add(7.94,-.05,.8,.8,c=>crane(c,8.34,.35));
    box(9.87,2.37,1.38,1.09,21,'blue','K-13');
    drum(4.0,.24,8.5,17); drum(4.56,.28,8.5,17); drum(4.08,.78,8.5,16);
    cargo(10.63,8.01,.59,.60,13); cargo(10.10,8.68,.67,.61,15);
    drum(1.47,10.80,6.2,11);
    rail(-.31,4.15,0,1,2.1); rail(5.05,-.30,1,0,2.62);
    rail(9.0,-.25,1,0,1.95); rail(-.25,9.32,0,1,1.52);
    lamp(-.27,5.92,39,.55,0); lamp(7.23,-.26,45,0,.55); lamp(11.05,6.65,39,-.54,0);
  } else if (scene==='lab') {
    add(.10,-.10,3.45,2.03,c=>warehouse(c,.10,-.10,3.45,2.03,34,true));
    add(7.14,.12,3.10,1.30,c=>warehouse(c,7.14,.12,3.10,1.30,24,true));
    for(const [x,y] of [[.69,5.12],[.73,6.48],[.74,7.84]]) drum(x,y,14.5,33,true);
    for(const [x,y] of [[9.86,6.38],[10.68,6.42],[10.7,7.28]]) drum(x,y,10,23,true);
    box(1.37,9.44,1.75,.91,18,'blue','CRYO');
    cargo(9.88,9.42); cargo(10.69,9.39);
    rail(4.18,-.25,1,0,2.54); rail(-.28,8.70,0,1,2.2);
    lamp(5.55,.14,34,0,.48); lamp(.2,8.68,34,.45,0); lamp(10.88,4.66,34,-.5,0);
  } else if (scene==='ruins') {
    const wall=(x,y,w,d,h)=>add(x,y,w,d,c=>brokenWall(c,x,y,w,d,h));
    wall(.14,.27,2.44,.43,30); wall(.13,.69,.48,2.39,21);
    wall(7.96,.15,1.84,.5,19); wall(10.5,.46,.42,2.05,20);
    wall(.10,6.33,2.42,.44,12); wall(8.72,9.74,1.81,.43,14);
    box(.76,8.77,1.98,.96,18,'sand','R-62');
    for(let n=0;n<29;n++) {
      const cx=n%2?1.97:9.49,cy=n%2?2.52:8.87;
      const x=cx+(noise(n,3,1)-.5)*2.8,y=cy+(noise(n,3,9)-.5)*2;
      const w=.10+noise(n,1,5)*.27,d=.10+noise(n,2,5)*.22,h=2+noise(n,4,5)*5;
      add(x,y,w,d,c=>block(c,x,y,w,d,0,h,'#696660','#514f4c','#40413f'),.2);
    }
    drum(8.5,2.01,7.1,14); drum(9.02,2.32,7,11);
    lamp(6.8,-.14,37,0,.55); lamp(.17,7.73,29,.47,0);
    rail(3.24,-.23,1,0,2.3); cargo(6.95,10.17,.72,.52,11);
  } else {
    let seed = 0;
    CITY_BLOCKS.forEach((block, index) => addCityLot(add, block.x, block.y, block.w, block.d, cityPalette(index), seed++));
    const carPalette = ['#7e5452','#557b96','#c1a056','#7368a3','#5e9a8d','#af6a86','#8f8f8f'];
    let i = 0;
    for (const y of [7.45,19.45,31.45,43.45]) {
      for (const x of [1.2,5.8,12.1,17.0,24.1,29.0,36.2,41.0,47.0]) {
        const color = carPalette[(i++) % carPalette.length];
        add(x, y+.95, .92, .44, c => parkedCar(c, x, y+.95, .92, .44, color), .4);
      }
    }
    for (const x of [7.55,19.55,31.55,43.55]) {
      for (const y of [1.2,5.9,12.1,17.0,24.2,29.3,36.1,41.0,47.0]) {
        const color = carPalette[(i++) % carPalette.length];
        add(x+.85, y, .44, .92, c => parkedCar(c, x+.85, y, .92, .44, color), .4);
      }
    }
    for (const [x,y] of [[2.0,6.4],[14.2,6.4],[26.2,6.4],[38.2,6.4],[48.2,6.4],[2.0,18.4],[14.2,18.4],[26.2,18.4],[38.2,18.4],[48.2,18.4],[2.0,30.4],[14.2,30.4],[26.2,30.4],[38.2,30.4],[48.2,30.4],[2.0,42.4],[14.2,42.4],[26.2,42.4],[38.2,42.4],[48.2,42.4]]) lamp(x,y,29,.35,.2);
    rail(14.1, 12.0, 0,1,1.8); rail(27.2, 22.3, 0,1,2.2); rail(39.0, 34.4, 0,1,2.0); rail(4.0, 46.8, 1,0,2.4);
    for (const [x,y] of [[5.4,5.2],[17.5,17.1],[29.4,5.0],[41.4,17.4],[6.0,29.1],[29.0,29.2],[40.8,41.2]]) cargo(x,y,.6,.6,12);
    for (const [x,y] of [[12.8,14.3],[24.8,26.6],[36.8,38.4]]) drum(x,y,8.5,17,true);
  }
  return props.sort((a,b)=>a.depth-b.depth);
}

const OPERATIVE = [
  '      dddd      ',
  '    d33444d     ',
  '   d3345544d    ',
  '   d3444443d    ',
  '   d2233333d    ',
  '    d2vvvvd     ',
  '    d22223d     ',
  '     d233d      ',
  '   ddccaaccdd   ',
  '  d33ccaac433d  ',
  ' d33344aa44333d ',
  ' d2c3344433c22d ',
  ' d2a2d3333dca2d ',
  ' d223d2332d332d ',
  '  d33d2222d33d  ',
  '  d22d3636d22d  ',
  '   ddd2222ddd   ',
  '     d3333d     ',
  '    d233332d    ',
  '    d232232d    ',
  '    d23dd32d    ',
  '    d33dd33d    ',
  '   d223dd322d   ',
  '   d222dd222d   ',
  '   dddd  dddd   '
];

function tokenColor(value) {
  return typeof value==='string' && /^#[a-f\d]{3,8}$/i.test(value) && [4,7].includes(value.length) ? value : '#7bccc0';
}

function mix(color,t,strength) {
  const raw = color.length===4 ? color.slice(1).split('').map(x=>x+x).join('') : color.slice(1);
  const rgb= [0,2,4].map(i=>Math.round(parseInt(raw.slice(i,i+2),16)*(1-strength)+t*strength));
  return 'rgb('+rgb.join(',')+')';
}

function makeSprite(color, variant) {
  const out=document.createElement('canvas'); out.width=18;out.height=27;
  const c=out.getContext('2d');
  const colors={d:'#202b35',2:'#354651',3:'#536573',4:'#818d91',5:'#b2bab3',6:'#b8a986',a:color,c:mix(color,38,.42),v:mix(color,239,.53)};
  OPERATIVE.forEach((row,y)=>{
    [...row].forEach((pixel,x)=>{
      if(colors[pixel]) {
        c.fillStyle=colors[pixel];c.fillRect(x+1,y+1,1,1);
      }
    });
  });
  if(variant===1) {
    // A hood and mantle instead of the plated helmet and shoulder pads.
    c.fillStyle=colors.c;c.fillRect(5,2,7,3);c.fillRect(4,4,3,5);
    c.fillStyle=color;c.fillRect(6,2,5,1);c.fillRect(4,8,3,7);
    c.fillStyle=colors.c;c.fillRect(3,12,3,5);c.fillRect(2,17,3,3);c.fillRect(5,9,7,2);
  } else if(variant===2) {
    c.fillStyle=colors['2'];c.fillRect(13,4,1,7);c.fillRect(14,2,1,3);
    c.fillStyle=colors.v;c.fillRect(14,2,1,1);c.fillRect(6,6,2,2);c.fillRect(10,6,2,2);
    c.fillStyle=colors.c;c.fillRect(2,10,3,2);c.fillRect(11,10,5,3);
    c.fillStyle=color;c.fillRect(13,10,2,1);c.fillRect(8,13,3,1);
  }
  return out;
}

function surface() {
  const result=document.createElement('canvas');
  return result;
}

function makeGround(scene,grid,props) {
  const meta = sceneMetrics(scene);
  if(customScenes.has(scene))meta.quality=meta.large?1.5:2;
  const out=surface();
  out.width=Math.ceil(meta.logicalWidth * meta.quality);
  out.height=Math.ceil(meta.logicalHeight * meta.quality);
  const c=out.getContext('2d');
  c.scale(meta.quality,meta.quality);
  c.translate(meta.originX,meta.originY);
  foundation(c,scene,grid);
  for(const p of props) {
    if(!p.shadow)continue;
    const shadow=corners(p.x,p.y,p.w,p.d);
    const spread=(scene==='city'?8:12)*p.shadow;
    const shifted=shadow.map(([x,y])=>[x+spread,y+spread*.30]);
    polygon(c,[shadow[0],shifted[0],shifted[1],shifted[2],shadow[2],shadow[3]],'#12232e46');
    c.save();c.translate(2,1);polygon(c,shadow,'#13273170');c.restore();
  }
  return { canvas: out, x: -meta.originX, y: -meta.originY, width: meta.logicalWidth, height: meta.logicalHeight };
}

function backdrop(c,w,h) {
  c.fillStyle='#0a0b0c';c.fillRect(0,0,w,h);
  const glow=c.createRadialGradient(w*.49,h*.43,10,w*.5,h*.52,Math.max(w*.7,h*.8));
  glow.addColorStop(0,'#171a1c');glow.addColorStop(.64,'#101214');glow.addColorStop(1,'#090a0b');
  c.fillStyle=glow;c.fillRect(0,0,w,h);
  c.fillStyle='#c8cacc13';
  for(let y=8;y<h;y+=16) for(let x=8;x<w;x+=16) c.fillRect(x,y,1,1);
  c.strokeStyle='#d2d3d41d';c.lineWidth=1;c.beginPath();
  for(let y=40;y<h;y+=96) for(let x=40;x<w;x+=96) {
    c.moveTo(x-2.6,y+.5);c.lineTo(x+3.6,y+.5);c.moveTo(x+.5,y-2.6);c.lineTo(x+.5,y+3.6);
  }
  c.stroke();
}

// Silhueta real do sprite, em vez de um retângulo em torno da peça.
const outlineCache = new WeakMap();
function outlineSprite(sprite, color) {
  let cache = outlineCache.get(sprite);
  if (!cache) { cache = new Map(); outlineCache.set(sprite,cache); }
  if (!cache.has(color)) {
    const out = surface(); out.width = 28; out.height = 40;
    const ctx = out.getContext('2d'); ctx.imageSmoothingEnabled = false;
    for (const [dx,dy] of [[-2,0],[2,0],[0,-2],[0,2],[-1,-1],[1,-1],[-1,1],[1,1]]) ctx.drawImage(sprite,2+dx,2+dy,24,36);
    ctx.globalCompositeOperation='source-in'; ctx.fillStyle=color; ctx.fillRect(0,0,28,40);
    cache.set(color,out);
  }
  return cache.get(color);
}
function paintToken(c,entity,sprite,chosen,color,outline) {
  const [x,y]=project(entity.x,entity.y);
  ellipse(c,x+2,y+1,12.5,5.4,'#10202c86');
  ellipse(c,x,y,13.3,5.45,'#26333c');
  ellipse(c,x,y-.45,12.4,4.85,color);
  ellipse(c,x,y-.6,10.0,3.42,'#304149');
  if(chosen) {
    c.save();c.strokeStyle=color;c.lineWidth=1.2;
    for(let n=0;n<4;n++) {
      c.beginPath();c.ellipse(x,y,16.7,7.4,0,n*Math.PI*.5+.13,n*Math.PI*.5+1.12);c.stroke();
    }
    c.restore();
  }
  c.imageSmoothingEnabled=false;
  if(outline) c.drawImage(outlineSprite(sprite,outline),Math.round(x-12)-2,Math.round(y-34.5)-2);
  c.drawImage(sprite,Math.round(x-12),Math.round(y-34.5),24,36);
  c.imageSmoothingEnabled=true;
}

function drawLabels(c, list, scale, ox, oy, width, height) {
  const occupied=[];
  const size=clamp(10.2*scale,9.5,12);
  c.font='600 '+size+'px ui-monospace, Consolas, monospace';
  c.textBaseline='middle';
  for(const token of list) {
    const text=String(token.name||'').slice(0,22);
    if(!text)continue;
    const [a,b]=project(token.x,token.y);
    const w=Math.ceil(c.measureText(text).width+15),h=Math.ceil(size+6);
    const x=Math.round(ox+a*scale-w/2);
    let y=Math.round(oy+(b-34)*scale-h-2);
    for(let i=0;i<5;i++) {
      if(!occupied.some(rect=>x<rect.x+rect.w+2&&x+w+2>rect.x&&y<rect.y+rect.h+2&&y+h+2>rect.y))break;
      y-=h+2;
    }
    if(y+h<0||y>height||x+w<0||x>width)continue;
    occupied.push({x,y,w,h,id:token.id});c.fillStyle='#132128f2';c.fillRect(x,y,w,h);
    c.strokeStyle=token.chosen ? '#ffab83' : '#9dafa34d';c.lineWidth=1;c.strokeRect(x+.5,y+.5,w-1,h-1);
    c.fillStyle=tokenColor(token.color);c.fillRect(x+4,y+h/2-1.5,3,3);
    c.fillStyle='#f0f3ea';c.fillText(text,x+10,y+h/2+.6);
  }
  return occupied;
}

/**
 * Handlers receive board-space coordinates in the inclusive range 0–11.
 * Token selection and movement permissions belong to the room controller.
 */
export function createBoard(canvas, {onTile = ()=>{}, onSelect = ()=>{}, onContext = ()=>{}, onMark = ()=>{}, onZoom = ()=>{}} = {}) {
  const c=canvas.getContext('2d');
  const state={scene:'docks',tokens:[],selectedId:null,mode:'move',grid:true,multiSelection:[],shiftHeld:false,canGroup:false,canMoveSelected:false};
  const spriteCache=new Map();
  const tracks=new Map();
  const pointers=new Map();
  // Resultados de dados: relógio monotônico local, deduplicados pelo ID do evento.
  const floatingRolls = new Map();
  const seenRolls = new Set();
  const rollLifetime = 5700;
  let labels = [];
  let width=0,height=0,scale=1,ox=0,oy=0,ratio=1,zoom=1,panX=0,panY=0;
  let props=objectsFor(state.scene),ground,background,observer,request=0,gesture=null,hover=null,hoverToken=null,disposed=false;
  let meta = sceneMetrics(state.scene);
  let placementCursor = null;
  let marking = null, eraserCursor = null;
  let nextDragAt=0;
  const zoomLevels=[.65,.8,1,1.25,1.55,1.9,2.4,3,3.6];
  const cityZoomLevels=[.65,.8,1,1.25,1.55,1.9,2.4,3,3.6,4.5,5.6,7,9,11,14];
  const allowedZoom = () => sceneSize(state.scene)>24 ? cityZoomLevels : zoomLevels;
  const listeners=[];

  const unsubscribeTerrain=onTerrainReady(()=>{if(customScenes.has(state.scene)){ground=null;schedule();}});
  canvas.tabIndex=0;
  if(!canvas.hasAttribute('aria-label')) canvas.setAttribute('aria-label','Tabuleiro isométrico. Selecione uma peça e clique no chão ou use as setas e WASD para mover. Use mais e menos para aproximar ou afastar.');
  canvas.setAttribute('role','application');
  canvas.setAttribute('aria-keyshortcuts','ArrowUp ArrowDown ArrowLeft ArrowRight W A S D Enter Space + - Home');
  const positionStatus = document.createElement('span');
  positionStatus.setAttribute('role', 'status');
  positionStatus.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';
  canvas.after(positionStatus);

  function announceCursor() {
    const coordinate = n => n.toLocaleString('pt-BR', {maximumFractionDigits: 2});
    positionStatus.textContent = 'Posição do NPC. X ' + coordinate(placementCursor.x) + ', Y ' + coordinate(placementCursor.y) + '.';
  }

  function updateTouchAction() {
    canvas.style.touchAction = document.activeElement === canvas || ['pan','draw','erase'].includes(state.mode) ? 'none' : 'pan-y';
  }

  function listen(type,fn,options) {
    canvas.addEventListener(type,fn,options);listeners.push([type,fn,options]);
  }

  function measure() {
    const bounds=canvas.getBoundingClientRect();
    width=bounds.width;height=bounds.height;
    ratio=clamp(window.devicePixelRatio||1,1,2);
    const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
    if(canvas.width!==w||canvas.height!==h) {canvas.width=w;canvas.height=h;background=null;}
    meta = sceneMetrics(state.scene);
    scale=Math.max(.012,Math.min((width-18)/(meta.logicalWidth+120),(height-16)/(meta.logicalHeight+60)))*zoom;
    panX=clamp(panX,-Math.max(width*.46*zoom, meta.logicalWidth*.32*scale),Math.max(width*.46*zoom, meta.logicalWidth*.32*scale));
    panY=clamp(panY,-Math.max(height*.48*zoom, meta.logicalHeight*.22*scale),Math.max(height*.48*zoom, meta.logicalHeight*.28*scale));
    ox=width*.5+panX;
    oy=height*.5-(meta.large ? meta.logicalHeight/2-meta.originY : meta.logicalHeight*.32)*scale+panY;
  }

  function schedule() {
    if(!request&&!disposed) request=window.requestAnimationFrame(draw);
  }

  function position(id,time) {
    const t=tracks.get(id);
    if(!t) return null;
    const f=t.duration?clamp((time-t.start)/t.duration,0,1):1, eased=1-(1-f)*(1-f);
    return {x:t.ax+(t.bx-t.ax)*eased,y:t.ay+(t.by-t.ay)*eased,moving:f<1};
  }

  function draw(now) {
    request=0;
    measure();
    if(width<2||height<2)return;
    if(!ground)ground=makeGround(state.scene,state.grid,props);
    if(!background) {
      background=surface();background.width=Math.ceil(width);background.height=Math.ceil(height);
      backdrop(background.getContext('2d'),width,height);
    }
    c.setTransform(ratio,0,0,ratio,0,0);
    c.drawImage(background,0,0,width,height);
    c.save();c.translate(ox,oy);c.scale(scale,scale);
    c.drawImage(ground.canvas,ground.x,ground.y,ground.width,ground.height);
    if (state.mode === 'move' && hover) {
      polygon(c,corners(Math.round(hover.x)-.5,Math.round(hover.y)-.5,1,1,.25),'#b4e6da24','#b3e5d9',1);
    }
    const units=state.tokens.map(t=>({...t,...position(t.id,now),chosen:t.id===state.selectedId}));
    const ordered=units.map(t=>({unit:t,depth:t.x+t.y+.08})).concat(props).sort((a,b)=>a.depth-b.depth);
    for(const element of ordered) {
      if(!element.unit) {element.paint(c);continue;}
      const unit=element.unit,color=tokenColor(unit.color);
      const variant=Array.from(String(unit.id)).reduce((v,ch)=>(v+ch.charCodeAt(0))%3,0);
      const key=color+'-'+variant;
      if(!spriteCache.has(key)) {
        if(spriteCache.size>128)spriteCache.clear();
        spriteCache.set(key,makeSprite(color,variant));
      }
      const outline = state.multiSelection.includes(unit.id) || (state.shiftHeld && hoverToken===unit.id) ? '#ff4c50' : hoverToken===unit.id ? '#55bfff' : null;
      paintToken(c,unit,spriteCache.get(key),unit.id===state.selectedId,color,outline);
    }
    if (state.mode === 'place' && placementCursor) {
      const {x,y} = placementCursor;
      polygon(c,corners(x-.36,y-.36,.72,.72,.3),'#d7913a42','#ffcf90',1.6);
      const [a,b] = project(x,y,.3);
      line(c,[a-4,b],[a+4,b],'#fff1d7',1.6);
      line(c,[a,b-3],[a,b+3],'#fff1d7',1.6);
    }
    // Marcações em coordenadas do mundo projetado, sob os rótulos e resultados.
    function ink(stroke) {
      const pts=stroke.points;if(!pts?.length)return;
      c.save(); c.strokeStyle=tokenColor(stroke.color); c.fillStyle=c.strokeStyle;
      const width=Number.isFinite(stroke.width)?clamp(stroke.width,1,24):3;
      c.lineWidth=width; c.lineCap='round'; c.lineJoin='round';
      c.beginPath(); c.moveTo(...pts[0]);
      for(const p of pts.slice(1)) c.lineTo(...p);
      if(pts.length===1) {c.arc(pts[0][0],pts[0][1],width/2,0,Math.PI*2);c.fill();} else c.stroke();
      c.restore();
    }
    for(const stroke of state.drawings || []) ink(stroke);
    if(marking?.kind==='draw') ink(marking);
    if(eraserCursor && state.mode==='erase') {
      c.save();c.beginPath();c.arc(...eraserCursor,9,0,Math.PI*2);c.strokeStyle='#ffffff';c.lineWidth=1.2/scale;c.stroke();c.restore();
    }
    c.restore();
    // Tags stay readable through perspective and remain visible behind tall props.
    labels = drawLabels(c,units.slice().sort((a,b)=>Number(b.chosen)-Number(a.chosen)||b.x+b.y-a.x-a.y),scale,ox,oy,width,height);
    // Desenhado no espaço da tela, depois das peças e nomes: acompanha zoom, pan e movimento.
    const rollStacks = new Map();
    for (const [id, roll] of floatingRolls) {
      const age = now - roll.start;
      const unit = units.find(t => t.id === roll.tokenId);
      if (!unit || age >= rollLifetime) { floatingRolls.delete(id); continue; }
      const stack = rollStacks.get(unit.id) || 0;
      rollStacks.set(unit.id, stack + 1);
      const [a,b] = project(unit.x,unit.y);
      const label = labels.find(l => l.id === unit.id);
      const rise = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 32 * Math.min(1, Math.max(0, age / 5000));
      const x = ox+a*scale, y = (label ? label.y : oy+(b-36)*scale)-17-rise-stack*29;
      c.save();
      c.globalAlpha = clamp((rollLifetime-age)/700, 0, 1);
      c.font = '800 24px system-ui, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const rollColor = tokenColor(unit.color);
      c.lineWidth = 4; c.lineJoin = 'round'; c.strokeStyle = '#10171c';
      c.strokeText(String(roll.result),x,y); c.fillStyle = rollColor; c.fillText(String(roll.result),x,y);
      c.restore();
    }
    if(units.some(t=>t.moving)||floatingRolls.size)schedule();
  }

  function showRoll(roll, age = 0) {
    if (!roll?.id || !roll.tokenId || !Number.isFinite(roll.result) || seenRolls.has(roll.id)) return;
    seenRolls.add(roll.id);
    // Limita a memória sem reexibir os eventos recentes do histórico.
    if (seenRolls.size > 256) seenRolls.delete(seenRolls.values().next().value);
    floatingRolls.set(roll.id, { tokenId: roll.tokenId, result: roll.result, start: performance.now() - Math.max(0, age) });
    schedule();
  }

  function setState(update={}) {
    const oldScene=state.scene,oldGrid=state.grid,oldMode=state.mode,now=performance.now();
    Object.assign(state,update);
    if (update.space?.id === state.scene && !customScenes.has(state.scene)) customScenes.set(state.scene, update.space);
    if (Array.isArray(update.rolls)) {
      for (const roll of update.rolls) {
        const age = (update.serverTime || Date.now()) - roll.at;
        if (!roll.id || !Number.isFinite(roll.result) || !Number.isFinite(age) || age >= rollLifetime || age < -1000) continue;
        showRoll(roll, age);
      }
      if (!state.tokens.length) floatingRolls.clear();
    }
    if(!Object.hasOwn(SCENES,state.scene)&&!customScenes.has(state.scene))state.scene='docks';
    if(!Array.isArray(state.tokens))state.tokens=[];
    if (state.mode === 'place' && oldMode !== 'place') {
      const origin = state.tokens.find(t => t.id === state.selectedId);
      placementCursor = origin ? {x: origin.x, y: origin.y} : {x: 5.5, y: 5.5};
      announceCursor();
    } else if (state.mode !== 'place' && placementCursor) {
      placementCursor = null;
      positionStatus.textContent = '';
    }
    updateTouchAction();
    if(oldScene!==state.scene || oldMode!==state.mode) { marking=null; eraserCursor=null; hover=null; hoverToken=null; }
    if(oldScene!==state.scene) {
      meta=sceneMetrics(state.scene);
      props=objectsFor(state.scene);
      ground=null;hover=null;
      if (oldScene!==state.scene) { panX=0; panY=0; zoom=1; onZoom(100); }
      tracks.clear();
    }
    if(oldGrid!==state.grid)ground=null;
    const ids=new Set();
    for(const t of state.tokens) {
      if(!Number.isFinite(t.x)||!Number.isFinite(t.y)) continue;
      ids.add(t.id);
      const previous=tracks.get(t.id);
      if(previous&&previous.bx===t.x&&previous.by===t.y)continue;
      const start=position(t.id,now)||t;
      const distance=Math.hypot(t.x-start.x,t.y-start.y);
      tracks.set(t.id,{ax:start.x,ay:start.y,bx:t.x,by:t.y,start:now,duration:previous?Math.min(420,100+distance*35):0});
    }
    for(const id of tracks.keys()) if(!ids.has(id))tracks.delete(id);
    canvas.style.cursor=state.mode==='pan'?'grab':['place','draw','erase'].includes(state.mode)?'crosshair':'default';
    schedule();
  }

  function adjustZoom(value,center) {
    const old=zoom;
    const levels=allowedZoom();
    zoom=clamp(value,levels[0],levels[levels.length-1]);
    if(center&&old>0) {
      panX+=(center.x-ox)*(1-zoom/old);
      panY+=(center.y-height*.5-panY)*(1-zoom/old);
    }
    measure();
    onZoom(Math.round(zoom*100));schedule();
  }

  function zoomBy(delta,center) {
    const levels=allowedZoom();
    const goal=delta>0?levels.find(z=>z>zoom+.001):[...levels].reverse().find(z=>z<zoom-.001);
    if(goal!==undefined) adjustZoom(goal,center);
  }
  function resetView() {panX=0;panY=0;adjustZoom(1);}
  function point(e) {const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
  function world(p,limit=false) {
    const dx=(p.x-ox)/scale/HALF_W,dy=(p.y-oy)/scale/HALF_H;
    const x=(dx+dy)/2,y=(dy-dx)/2;
    const maxEdge = sceneSize(state.scene) - 0.5;
    const max = sceneLimit(state.scene);
    if(!limit&&(x<MIN_EDGE||x>maxEdge||y<MIN_EDGE||y>maxEdge))return null;
    return {x:Math.round(clamp(x,0,max)*100)/100,y:Math.round(clamp(y,0,max)*100)/100};
  }
  function hit(p) {
    const label = labels.find(r => p.x >= r.x && p.x <= r.x+r.w && p.y >= r.y && p.y <= r.y+r.h);
    if (label) return state.tokens.find(token => token.id === label.id);
    const a=(p.x-ox)/scale,b=(p.y-oy)/scale,now=performance.now();
    const targets=state.tokens.map(t=>({...t,...position(t.id,now)})).sort((t,u)=>(u.x+u.y)-(t.x+t.y));
    return targets.find(t=>{
      const [x,y]=project(t.x,t.y);
      return Math.abs(x-a)<Math.max(13,6/scale)&&b>y-36&&b<y+6;
    });
  }
  function inkPoint(p) {
    // O ponto fica preso ao mapa, não à tela: inverte a câmera.
    const limitX = (state.scene === 'city' || customScenes.has(state.scene)) ? 1800 : 430;
    const limitY = (state.scene === 'city' || customScenes.has(state.scene)) ? 1850 : 440;
    const minY = (state.scene === 'city' || customScenes.has(state.scene)) ? -180 : -110;
    return [Math.round(clamp((p.x-ox)/scale,-limitX,limitX)*10)/10,Math.round(clamp((p.y-oy)/scale,minY,limitY)*10)/10];
  }
  function addInk(p) {
    if(!marking)return;
    const next=inkPoint(p),prev=marking.points.at(-1);
    if(!prev||Math.hypot(next[0]-prev[0],next[1]-prev[1])>=1.5) {
      if(marking.points.length<1200)marking.points.push(next);
    }
  }
  function emitTile(p,limit) {const at=world(p,limit);if(at)onTile(at.x,at.y);}
  function openMapMenu(p, e) {
    onContext({scene: state.scene, id: hit(p)?.id, cell: world(p)}, e.clientX, e.clientY);
  }
  let secondaryPointer = false;
  function distance(a,b) {return Math.hypot(a.x-b.x,a.y-b.y);}
  function midpoint(a,b) {return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};}

  listen('focus',updateTouchAction);
  listen('blur',()=>{canvas.style.touchAction = ['pan','draw','erase'].includes(state.mode) ? 'none' : 'pan-y';});
  updateTouchAction();
  listen('pointerdown',e=>{
    if(e.button!==0&&e.button!==1&&e.button!==2)return;
    secondaryPointer = e.button === 2 && e.pointerType !== 'touch';
    const p=point(e);pointers.set(e.pointerId,p);
    canvas.setPointerCapture(e.pointerId);
    if (e.pointerType !== 'touch') canvas.focus({preventScroll:true});
    if (pointers.size===1 && e.button===0 && !e.altKey && state.canDraw && ['draw','erase'].includes(state.mode)) {
      gesture={kind:'mark',start:p,last:p};
      marking={kind:state.mode,scene:state.scene,color:state.drawColor,width:state.brushWidth || 3,points:[inkPoint(p)]};
      if(state.mode==='erase')eraserCursor=inkPoint(p);
      e.preventDefault();schedule();return;
    }
    if(pointers.size===2) {
      marking=null;eraserCursor=null;
      const [a,b]=[...pointers.values()];
      gesture={kind:'pinch',distance:Math.max(1,distance(a,b)),zoom,mid:midpoint(a,b)};
    } else if(pointers.size===1) {
      const target=hit(p);
      // Captura a intenção no pointerdown: soltar Shift antes do mouse ou
      // pequenos movimentos não devem virar um clique de movimento/pan.
      if(e.button===0 && state.canGroup && (e.shiftKey || state.shiftHeld || state.mode==='interact') && target) {
        gesture={kind:'group',start:p,last:p,target};
        onSelect(target.id,true);
        e.preventDefault();return;
      }
      if(e.button===2) { gesture={kind:'context',start:p,last:p}; e.preventDefault(); return; }
      const pan=state.mode==='pan'||e.button===1||e.altKey;
      gesture={kind:pan?'pan':'tap',start:p,last:p,target,dragToken:false};
      if(pan)canvas.style.cursor='grabbing';
    }
    if(e.button!==0)e.preventDefault();
  });
  listen('pointermove',e=>{
    const p=point(e);
    if(pointers.has(e.pointerId)) pointers.set(e.pointerId,p);
    if(gesture?.kind==='mark' && pointers.has(e.pointerId)) {
      addInk(p); if(state.mode==='erase')eraserCursor=inkPoint(p); schedule(); return;
    }
    if(!gesture && ['draw','erase'].includes(state.mode)) {
      hover=null;hoverToken=null;eraserCursor=state.mode==='erase'?inkPoint(p):null;canvas.style.cursor='crosshair';schedule();return;
    }
    if(gesture?.kind==='pinch' &&pointers.size===2) {
      const [a,b]=[...pointers.values()],mid=midpoint(a,b);
      panX+=mid.x-gesture.mid.x;panY+=mid.y-gesture.mid.y;
      gesture.mid=mid;adjustZoom(gesture.zoom*distance(a,b)/gesture.distance,mid);return;
    }
    if(gesture&&pointers.has(e.pointerId)) {
      if(gesture.kind==='context' && distance(gesture.start,p)>5) {
        gesture.kind='pan'; gesture.last=gesture.start; canvas.style.cursor='grabbing';
      }
      if(gesture.kind==='tap'&&distance(gesture.start,p)>5) {
        if(!e.shiftKey&&!state.shiftHeld&&state.canMoveSelected&&state.mode==='move'&&gesture.target&&gesture.target.id===state.selectedId) {
          gesture.kind='unit';nextDragAt=0;
        } else {
          gesture.kind='pan';canvas.style.cursor='grabbing';
        }
      }
      if(gesture.kind==='pan') {panX+=p.x-gesture.last.x;panY+=p.y-gesture.last.y;measure();schedule();}
      if(gesture.kind==='unit'&&performance.now()>=nextDragAt) {
        emitTile(p,true);nextDragAt=performance.now()+140;
      }
      gesture.last=p;
    }
    if(!gesture&&e.pointerType==='mouse') {
      const target=hit(p);hoverToken=target?.id||null;hover=target?null:world(p);
      if (state.mode === 'place') placementCursor = world(p) || placementCursor;
      canvas.style.cursor=state.mode==='pan'?'grab':['place','draw','erase'].includes(state.mode)?'crosshair':target?'pointer':hover?'crosshair':'default';
      schedule();
    }
  });
  function finish(e,cancelled) {
    if(!pointers.has(e.pointerId))return;
    const p=point(e);
    if(gesture?.kind==='mark') {
      if(!cancelled && marking && marking.scene===state.scene) { addInk(p); onMark(marking.kind,marking.points,marking.scene,marking.width); }
      marking=null;eraserCursor=null;
    } else if(!cancelled&&gesture?.kind==='context' &&distance(gesture.start,p)<=5) openMapMenu(p,e);
    else if(!cancelled&&gesture?.kind==='tap') {
      if (e.pointerType === 'touch') canvas.focus({preventScroll:true});
      const token=state.mode==='place'?null:hit(p);
      if(token)onSelect(token.id,e.shiftKey || state.shiftHeld);else if(!e.shiftKey&&!state.shiftHeld)emitTile(p,false);
    } else if(!cancelled&&gesture?.kind==='unit')emitTile(p,true);
    pointers.delete(e.pointerId);
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    if(pointers.size===1) {
      const remaining=[...pointers.values()][0];
      gesture={kind:'pan',start:remaining,last:remaining};
    } else gesture=null;
    hover=null;canvas.style.cursor=state.mode==='pan'?'grab':['place','draw','erase'].includes(state.mode)?'crosshair':'default';schedule();
  }
  listen('pointerup',e=>finish(e,false));
  listen('pointercancel',e=>finish(e,true));
  listen('pointerleave',()=>{hover=null;hoverToken=null;eraserCursor=null;schedule();});
  listen('contextmenu',e=>{
    e.preventDefault();
    // O clique direito abre ao soltar, depois de distinguir um arraste.
    if (secondaryPointer && e.button === 2) return;
    if (gesture) gesture.kind = 'context-open';
    openMapMenu(point(e),e);
  });
  listen('wheel',e=>{
    if (!e.deltaY || e.ctrlKey || e.metaKey || document.activeElement !== canvas) return;
    e.preventDefault();
    zoomBy(-Math.sign(e.deltaY),point(e));
  },{passive:false});
  const directions={arrowup:[-.5,-.5],w:[-.5,-.5],arrowdown:[.5,.5],s:[.5,.5],arrowleft:[-.5,.5],a:[-.5,.5],arrowright:[.5,-.5],d:[.5,-.5]};
  listen('keydown',e=>{
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    const key=e.key.toLowerCase();
    if (state.mode === 'place' && placementCursor && (key === 'enter' || key === ' ')) {
      e.preventDefault();
      if (!e.repeat) onTile(placementCursor.x,placementCursor.y);
      return;
    }
    if(['=','+','-','home'].includes(key)) {
      e.preventDefault();if(key==='home')resetView();else zoomBy(key==='-'?-1:1);return;
    }
    const move=directions[key];
    if(!move)return;
    e.preventDefault();
    if(state.mode==='pan') {
      const [dx,dy]=project(...move);panX-=dx;panY-=dy;measure();schedule();
    } else if (state.mode === 'place' && placementCursor) {
      placementCursor = {
        x: clamp(placementCursor.x + move[0], 0, sceneLimit(state.scene)),
        y: clamp(placementCursor.y + move[1], 0, sceneLimit(state.scene))
      };
      announceCursor();
      schedule();
    } else if(state.mode==='move') {
      const selected=state.tokens.find(t=>t.id===state.selectedId);
      if(selected&&state.canMoveSelected&&!e.shiftKey&&!state.shiftHeld)onTile(clamp(selected.x+move[0],0,sceneLimit(state.scene)),clamp(selected.y+move[1],0,sceneLimit(state.scene)));
    }
  });
  if(typeof ResizeObserver!=='undefined') {observer=new ResizeObserver(schedule);observer.observe(canvas);}
  window.addEventListener('resize',schedule);
  measure();schedule();
  return {
    setState,showRoll,zoomBy,resetView,
    destroy() {
      disposed=true;unsubscribeTerrain();window.cancelAnimationFrame(request);observer?.disconnect();
      positionStatus.remove();
      window.removeEventListener('resize',schedule);
      for(const [type,fn,opts] of listeners)canvas.removeEventListener(type,fn,opts);
    }
  };
}

// Biblioteca do editor e do tabuleiro: as mesmas coordenadas e a mesma arte.
// Texturas compartilhadas pelo editor e pela mesa. Cada imagem é decodificada uma vez.
const terrainURL = name => new URL('../img/terrain/'+name+'.webp?v=4.9.1', import.meta.url).href;
export const SPACE_TERRAIN = {
  c:{name:'Concreto',color:'#777069',texture:terrainURL('concrete')},
  a:{name:'Asfalto',color:'#50504e',texture:terrainURL('asphalt')},
  g:{name:'Grama',color:'#4a522d',texture:terrainURL('grass')},
  d:{name:'Terra',color:'#634b36',texture:terrainURL('dirt')},
  s:{name:'Calçada',color:'#777068',texture:terrainURL('sidewalk')},
  m:{name:'Madeira',color:'#765035',texture:terrainURL('wood')},
  w:{name:'Água',color:'#436e80'}
};
const terrainImages = new Map(), terrainListeners = new Set();
let terrainRevision=0;
export function onTerrainReady(listener){terrainListeners.add(listener);return ()=>terrainListeners.delete(listener);}
function loadTerrain(code){
  const entry=SPACE_TERRAIN[code];
  if(!entry?.texture||typeof Image==='undefined')return null;
  if(!terrainImages.has(code)){
    const image=new Image();const item={image,ready:false};terrainImages.set(code,item);
    image.onload=()=>{item.ready=true;terrainRevision++;for(const fn of terrainListeners)fn();};
    image.onerror=()=>{console.warn('Não foi possível carregar a textura: '+entry.name);};
    image.src=entry.texture;
  }
  const item=terrainImages.get(code);return item.ready?item.image:null;
}
export function preloadTerrain(){for(const code of Object.keys(SPACE_TERRAIN))loadTerrain(code);}
export const SPACE_OBJECTS = {
  house:{name:'Casa',w:2,d:2}, building:{name:'Prédio',w:3,d:2}, car:{name:'Carro',w:2,d:1},
  tree:{name:'Árvore',w:1,d:1}, crate:{name:'Caixa',w:1,d:1}, lamp:{name:'Poste',w:1,d:1}, wall:{name:'Muro',w:2,d:1}
};
export function spaceFootprint(o) {const k=SPACE_OBJECTS[o.kind]; return o.rot?[k.d,k.w]:[k.w,k.d];}
function paintSpaceFloor(c,space,grid) {
  const n=space.size;
  block(c,-.5,-.5,n,n,-18,18,'#676965','#393d3c','#252929');
  // Padrões em coordenadas do chão: uma imagem quadrada ocupa exatamente um tile.
  // Juntamos sequências de tiles de mesmo material numa só pintura, sem bordas internas.
  const runs=new Map();
  for(let y=0;y<n;y++)for(let x=0;x<n;){
    const raw=space.terrain[y*n+x];const code=Object.hasOwn(SPACE_TERRAIN,raw)?raw:'c';let end=x+1;
    while(end<n&&space.terrain[y*n+end]===raw)end++;
    if(!runs.has(code))runs.set(code,[]);runs.get(code).push([x,y,end-x]);x=end;
  }
  c.save();c.transform(32/256,16/256,-32/256,16/256,0,-16);
  for(const [code,segments] of runs){
    const image=loadTerrain(code);const pattern=image?c.createPattern(image,'repeat'):null;
    c.fillStyle=pattern||SPACE_TERRAIN[code].color;
    c.beginPath();for(const [x,y,w] of segments)c.rect(x*256,y*256,w*256,256);c.fill();
  }
  c.restore();
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    if(space.terrain[y*n+x]==='w'){const [a,b]=project(x,y);line(c,[a-7,b],[a+5,b],'#a2c8cb70',1);}
    if(grid)polygon(c,corners(x-.5,y-.5,1,1),null,'#171a1b55',.7);
  }
}
function paintSpaceObject(c,o) {
  const [w,d]=spaceFootprint(o),x=o.x-.5+.10,y=o.y-.5+.10,ww=w-.20,dd=d-.20;
  switch(o.kind) {
    case 'house': {
      const h=25,roof='#a06d50'; cityHouse(c,x,y,ww,dd,h,'#9c9585','#797369','#5f5a52','#bc9c62','#89c6c8');
      const r=8; // telhado de duas águas, com cumeeira no eixo do objeto
      const a=project(x,y,h),b=project(x+ww,y,h),e=project(x,y+dd,h),f=project(x+ww,y+dd,h);
      if(!o.rot){const u=project(x,y+dd/2,h+r),v=project(x+ww,y+dd/2,h+r);polygon(c,[a,b,v,u],roof,'#694a3e');polygon(c,[u,v,f,e],'#80523f','#68463b');polygon(c,[b,f,v],'#654a3d','#68463b');}
      else {const u=project(x+ww/2,y,h+r),v=project(x+ww/2,y+dd,h+r);polygon(c,[a,u,v,e],roof,'#694a3e');polygon(c,[u,b,f,v],'#80523f','#68463b');polygon(c,[e,v,f],'#654a3d','#68463b');}
      break;
    }
    case 'building': cityBuilding(c,x,y,ww,dd,49,'#85878a','#62666a','#484b4d','#bc795e','#70b7cc'); block(c,x+.18,y+.18,.42,.45,49,6,'#9b9d98','#6f706c','#575b5a');break;
    case 'car': {
      const xx=x+.15,yy=y+.15, a=ww-.3,b=dd-.3;
      block(c,xx,yy,a,b,1,7,'#ad6058','#713c3c','#553132','#d0927b');
      const inX=o.rot?.09:a*.26,inY=o.rot?b*.26:.09;
      block(c,xx+inX,yy+inY,a-inX*2,b-inY*2,8,5,'#34444b','#536b75','#27343c','#829ca3');
      for(const f of [.22,.77]) {const [u,v]=o.rot?project(xx+a,yy+b*f,1):project(xx+a*f,yy+b,1);ellipse(c,u,v,3.4,2.6,'#202326');}
      break;
    }
    case 'tree': { const [a,b]=project(o.x,o.y);line(c,[a,b],[a,b-18],'#715647',4); for(const [dx,dy,r] of [[0,-22,11],[-6,-18,8],[7,-20,9],[1,-30,8]])ellipse(c,a+dx,b+dy,r,r*.78,'#4b6a49');ellipse(c,a-3,b-29,6,4,'#81976a');break; }
    case 'crate': crate(c,x+.1,y+.1,.60,.60,13);break;
    case 'lamp': pole(c,o.x,o.y,32,o.rot?0:.42,o.rot?.42:0);break;
    case 'wall': {const a=o.rot?.22:ww,b=o.rot?dd:.22; block(c,x,y,a,b,0,23,'#aaa69b','#77756f','#54534f');for(let z=5;z<23;z+=5)rod(c,[x,y+b,z],[x+a,y+b,z],'#4b4946',.8);break;}
  }
}
function spaceProps(space) {return space.objects.map(o=>{const [w,d]=spaceFootprint(o);return {x:o.x-.5,y:o.y-.5,w,d,depth:o.x+o.y+(w+d)*.58-1,shadow:.6,paint:c=>paintSpaceObject(c,o)};}).sort((a,b)=>a.depth-b.depth);}
const editorFloorCache = new WeakMap();
export function renderSpaceEditor(canvas,space,view,hover,grid=true) {
  const bounds=canvas.getBoundingClientRect(),w=bounds.width,h=bounds.height,ratio=Math.min(2,window.devicePixelRatio||1);
  if(w<1||h<1)return null;
  if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}
  const c=canvas.getContext('2d'); c.setTransform(ratio,0,0,ratio,0,0);c.fillStyle='#0b0d0e';c.fillRect(0,0,w,h);
  const scale=Math.max(.03,Math.min((w-30)/(space.size*64+30),(h-35)/(space.size*32+100)))*view.zoom;
  const ox=w/2+view.x,oy=h/2-(space.size-1)*16*scale+view.y;
  c.save();c.translate(ox,oy);c.scale(scale,scale);
  // Cache the static terrain; zoom and mouse movement do not rebuild it.
  let floor=editorFloorCache.get(canvas);
  if(!floor||floor.terrain!==space.terrain||floor.size!==space.size||floor.grid!==grid||floor.revision!==terrainRevision){
    const q=space.size>24?1.5:2, lw=space.size*64+8, lh=space.size*32+40;
    const out=surface();out.width=Math.ceil(lw*q);out.height=Math.ceil(lh*q);
    const ctx=out.getContext('2d');ctx.scale(q,q);ctx.translate(lw/2,18);
    paintSpaceFloor(ctx,space,grid);
    floor={terrain:space.terrain,size:space.size,grid,revision:terrainRevision,canvas:out,lw,lh};editorFloorCache.set(canvas,floor);
  }
  c.drawImage(floor.canvas,-floor.lw/2,-18,floor.lw,floor.lh);
  for(const prop of spaceProps(space))prop.paint(c);
  if(hover){const {x,y,w:hw,d:hd,valid}=hover; polygon(c,corners(x-.5,y-.5,hw,hd,.2),valid?'#e6efe638':'#ff355850',valid?'#e9efde':'#ff6580',Math.max(.7,1.5/scale));}
  c.restore();return {ox,oy,scale};
}
