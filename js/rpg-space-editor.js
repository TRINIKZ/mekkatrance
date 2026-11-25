import { SPACE_TERRAIN, SPACE_OBJECTS, spaceFootprint, renderSpaceEditor, onTerrainReady, preloadTerrain } from './rpg-board.js?v=4.9.1';

export function createSpaceEditor(save) {
  const $=id=>document.getElementById(id), dialog=$('space-editor'), canvas=$('space-canvas');
  let draft, tool, rotation, brush, grid, view, hover, geometry, undo, redo, dirty, busy=false, gesture=null, frame=0;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const blank=n=>({size:n,terrain:'c'.repeat(n*n),objects:[]});
  const snapshot=()=>({size:draft.size,terrain:draft.terrain,objects:draft.objects.map(o=>({...o}))});
  function checkpoint(){undo.push(snapshot());if(undo.length>60)undo.shift();redo=[];dirty=true;}
  function schedule(){if(frame||!dialog.open)return;frame=requestAnimationFrame(()=>{frame=0;geometry=renderSpaceEditor(canvas,draft,view,hover,grid);});}
  onTerrainReady(schedule);
  function dimensions(){ $('space-size').value=draft.size;$('space-dimensions').textContent=`${draft.size} × ${draft.size} tiles`; }
  function refresh(){
    $('space-count').textContent=`${draft.size*draft.size} tiles · ${draft.objects.length}/300 objetos`;
    $('space-zoom').textContent=Math.round(view.zoom*100)+'%';
    $('space-coords').textContent=hover?`X ${hover.x} · Y ${hover.y}`:'';
    $('space-undo').disabled=!undo.length||busy;$('space-redo').disabled=!redo.length||busy;
    $('space-rotate').disabled=tool.type!=='object'||busy;
    $('space-rotate').textContent=`Girar 90° · R (${rotation*90}°)`;
    $('space-fill').disabled=tool.type!=='terrain'||busy;
    $('space-grid').setAttribute('aria-pressed',String(grid));
    for(const el of dialog.querySelectorAll('[data-space-tool]')) el.setAttribute('aria-pressed',String(el.dataset.spaceTool===`${tool.type}:${tool.value||''}`));
    $('space-erase').setAttribute('aria-pressed',String(tool.type==='erase'));$('space-pan').setAttribute('aria-pressed',String(tool.type==='pan'));
    canvas.style.cursor=tool.type==='pan'?'grab':'crosshair';
    const label=tool.type==='object'?SPACE_OBJECTS[tool.value].name:tool.type==='terrain'?SPACE_TERRAIN[tool.value].name:tool.type==='erase'?'Borracha':'Mover câmera';
    $('space-help').textContent=tool.type==='pan'?'Arraste para navegar. Role para aproximar ou afastar.':tool.type==='erase'?'Borracha: apaga objetos ou restaura o concreto.':`${label} · ${tool.type==='object'?'Clique para posicionar.':'Clique e arraste para pintar.'} Botão direito move a câmera.`;
    schedule();
  }
  function select(type,value){if(busy)return;tool={type,value};hover=null;refresh();}
  function makePalette(id,items,type){
    for(const [key,entry] of Object.entries(items)){
      const button=document.createElement('button');button.type='button';button.dataset.spaceTool=`${type}:${key}`;button.setAttribute('aria-pressed','false');
      if(type==='terrain'){const swatch=document.createElement('span');swatch.className='space-swatch';swatch.style.setProperty('--swatch',entry.color);if(entry.texture)swatch.style.backgroundImage=`url("${entry.texture}")`;button.append(swatch);}
      const text=document.createElement('span');text.textContent=entry.name;button.append(text);
      if(type==='object')button.title=`${entry.name} · ${entry.w}×${entry.d} tiles`;
      button.addEventListener('click',()=>select(type,key));$(id).append(button);
    }
  }
  makePalette('space-terrain',SPACE_TERRAIN,'terrain');makePalette('space-objects',SPACE_OBJECTS,'object');
  function occupied(x,y,w,d){return draft.objects.some(o=>{const [a,b]=spaceFootprint(o);return x<o.x+a&&x+w>o.x&&y<o.y+b&&y+d>o.y;});}
  function getHover(x,y){
    let w=1,d=1;
    if(tool.type==='object')[w,d]=spaceFootprint({kind:tool.value,rot:rotation});
    if(tool.type==='terrain'){const half=(brush-1)/2; x-=half;y-=half;w=brush;d=brush;}
    const valid=tool.type!=='object'||(x>=0&&y>=0&&x+w<=draft.size&&y+d<=draft.size&&!occupied(x,y,w,d)&&draft.objects.length<300);
    if(tool.type==='terrain'){const right=clamp(x+w,0,draft.size),bottom=clamp(y+d,0,draft.size);x=clamp(x,0,draft.size-1);y=clamp(y,0,draft.size-1);w=right-x;d=bottom-y;}
    return {x,y,w,d,valid};
  }
  function at(e){if(!geometry)return null;const r=canvas.getBoundingClientRect(),a=(e.clientX-r.left-geometry.ox)/geometry.scale/32,b=(e.clientY-r.top-geometry.oy)/geometry.scale/16;const x=Math.round((a+b)/2),y=Math.round((b-a)/2);return x>=0&&y>=0&&x<draft.size&&y<draft.size?{x,y}:null;}
  function mutate(x,y){
    if(busy||tool.type==='pan')return false;
    const h=getHover(x,y);if(!h.valid)return false;
    if(tool.type==='object') {draft.objects.push({kind:tool.value,x,y,rot:rotation});return true;}
    if(tool.type==='erase'){
      const n=draft.objects.length;draft.objects=draft.objects.filter(o=>{const [w,d]=spaceFootprint(o);return !(x>=o.x&&x<o.x+w&&y>=o.y&&y<o.y+d);});
      if(n!==draft.objects.length)return true;
      const i=y*draft.size+x;if(draft.terrain[i]==='c')return false;draft.terrain=draft.terrain.slice(0,i)+'c'+draft.terrain.slice(i+1);return true;
    }
    const arr=draft.terrain.split('');let changed=false;
    for(let yy=h.y;yy<h.y+h.d;yy++)for(let xx=h.x;xx<h.x+h.w;xx++){const i=yy*draft.size+xx;if(arr[i]!==tool.value){arr[i]=tool.value;changed=true;}}
    if(changed)draft.terrain=arr.join('');return changed;
  }
  function stroke(x,y){if(!gesture.changed){const previous=snapshot();if(!mutate(x,y))return;undo.push(previous);if(undo.length>60)undo.shift();redo=[];dirty=true;gesture.changed=true;}else mutate(x,y);}
  function applyOnce(x,y){const prev=snapshot();if(mutate(x,y)){undo.push(prev);if(undo.length>60)undo.shift();redo=[];dirty=true;}else if(tool.type==='object')$('space-error').textContent='Não cabe aqui, há outro objeto ou o limite foi atingido.';hover=getHover(x,y);refresh();}
  function restore(from,to){if(busy||!from.length)return;to.push(snapshot());draft=from.pop();hover=null;dirty=true;dimensions();refresh();}
  function fit(){view={zoom:1,x:0,y:0};refresh();}
  function zoom(f,px,py){const old=view.zoom;view.zoom=clamp(old*f,.7,14);if(geometry&&Number.isFinite(px)){view.x+=(px-geometry.ox)*(1-view.zoom/old);const rect=canvas.getBoundingClientRect();view.y+=(py-rect.height/2-view.y)*(1-view.zoom/old);}refresh();}
  $('space-resize').addEventListener('click',()=>{
    if(busy)return;const n=Number($('space-size').value);if(!Number.isInteger(n)||n<12||n>50){$('space-error').textContent='Informe um número inteiro de 12 a 50.';return;}if(n===draft.size)return;
    const old=draft.size;const objects=draft.objects.filter(o=>{const [w,d]=spaceFootprint(o);return o.x+w<=n&&o.y+d<=n;});
    if(n<old&&!confirm('Reduzir o mapa remove o terreno e os objetos fora das novas dimensões. Continuar?'))return;
    checkpoint();let terrain='';for(let y=0;y<n;y++)for(let x=0;x<n;x++)terrain+=(x<old&&y<old)?draft.terrain[y*old+x]:'c';draft={size:n,terrain,objects};hover=null;dimensions();fit();$('space-error').textContent='';
  });
  $('space-name').addEventListener('input',()=>{dirty=true;$('space-error').textContent='';});
  $('space-brush').addEventListener('change',e=>{brush=Number(e.target.value);hover=null;refresh();});
  $('space-fill').addEventListener('click',()=>{if(tool.type!=='terrain'||busy)return;const next=tool.value.repeat(draft.size*draft.size);if(next===draft.terrain)return;checkpoint();draft.terrain=next;refresh();});
  $('space-erase').addEventListener('click',()=>select('erase'));
  $('space-pan').addEventListener('click',()=>select('pan'));
  function rotate(){if(tool.type==='object'&&!busy){rotation=1-rotation;hover=null;refresh();}}
  $('space-rotate').addEventListener('click',rotate);
  $('space-undo').addEventListener('click',()=>restore(undo,redo));$('space-redo').addEventListener('click',()=>restore(redo,undo));
  $('space-fit').addEventListener('click',fit);$('space-minus').addEventListener('click',()=>zoom(1/1.25));$('space-plus').addEventListener('click',()=>zoom(1.25));
  $('space-grid').addEventListener('click',()=>{grid=!grid;refresh();});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoom(e.deltaY<0?1.15:1/1.15,e.clientX-r.left,e.clientY-r.top);},{passive:false});
  canvas.addEventListener('pointerdown',e=>{
    if(busy||gesture||![0,1,2].includes(e.button))return;e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);const pos=at(e);
    gesture={id:e.pointerId,pan:tool.type==='pan'||e.button!==0||e.altKey,x:e.clientX,y:e.clientY,last:pos,changed:false};
    if(gesture.pan){hover=null;canvas.style.cursor='grabbing';}else if(pos){$('space-error').textContent='';stroke(pos.x,pos.y);hover=getHover(pos.x,pos.y);if(!gesture.changed&&tool.type==='object')$('space-error').textContent='Escolha um espaço livre.';}
    refresh();
  });
  canvas.addEventListener('pointermove',e=>{
    if(busy)return;const pos=at(e);
    if(gesture?.id===e.pointerId){
      if(gesture.pan){view.x+=e.clientX-gesture.x;view.y+=e.clientY-gesture.y;gesture.x=e.clientX;gesture.y=e.clientY;hover=null;schedule();return;}
      if(pos&&tool.type!=='object'){
        const prev=gesture.last||pos,n=Math.max(1,Math.abs(pos.x-prev.x),Math.abs(pos.y-prev.y));
        for(let i=1;i<=n;i++)stroke(Math.round(prev.x+(pos.x-prev.x)*i/n),Math.round(prev.y+(pos.y-prev.y)*i/n));gesture.last=pos;
      }
    }
    hover=pos&&tool.type!=='pan'?getHover(pos.x,pos.y):null;refresh();
  });
  function finish(e){if(gesture?.id!==e.pointerId)return;gesture=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);refresh();}
  canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);canvas.addEventListener('lostpointercapture',finish);canvas.addEventListener('pointerleave',()=>{if(!gesture){hover=null;refresh();}});
  let keyboard={x:0,y:0};
  dialog.addEventListener('keydown',e=>{
    if(e.target.closest('input,select,textarea'))return;const k=e.key.toLowerCase();
    if((e.ctrlKey||e.metaKey)&&['z','y'].includes(k)){e.preventDefault();if(k==='y'||e.shiftKey)restore(redo,undo);else restore(undo,redo);return;}
    if(k==='r'){e.preventDefault();rotate();return;}
    if(e.target!==canvas)return;const directions={arrowup:[0,-1],arrowdown:[0,1],arrowleft:[-1,0],arrowright:[1,0]};
    if(directions[k]){e.preventDefault();keyboard={x:clamp(keyboard.x+directions[k][0],0,draft.size-1),y:clamp(keyboard.y+directions[k][1],0,draft.size-1)};hover=getHover(keyboard.x,keyboard.y);refresh();}else if(k==='enter'||k===' '){e.preventDefault();applyOnce(keyboard.x,keyboard.y);}
  });
  function close(){if(busy)return;if(dirty&&!confirm('Descartar as alterações não salvas deste espaço?'))return;dialog.close();}
  $('space-back').addEventListener('click',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  $('space-save').addEventListener('click',async()=>{
    if(busy)return;const name=$('space-name').value.trim();if(!name){$('space-error').textContent='Dê um nome ao espaço.';$('space-name').focus();return;}
    busy=true;$('space-save').disabled=true;$('space-back').disabled=true;$('space-save').textContent='Salvando…';$('space-error').textContent='';refresh();
    try{await save({name,...snapshot()});dirty=false;dialog.close();}catch(e){$('space-error').textContent=e.message;}finally{busy=false;$('space-save').disabled=false;$('space-back').disabled=false;$('space-save').textContent='Salvar espaço';refresh();}
  });
  const observer=new ResizeObserver(schedule);observer.observe(canvas);
  return {open(){if(busy||dialog.open)return;preloadTerrain();draft=blank(24);tool={type:'terrain',value:'c'};rotation=0;brush=1;grid=true;view={zoom:1,x:0,y:0};hover=null;undo=[];redo=[];dirty=false;gesture=null;keyboard={x:0,y:0};$('space-name').value='';$('space-brush').value='1';$('space-error').textContent='';dimensions();dialog.showModal();refresh();$('space-name').focus();}};
}
