// Presentation adapter: saved positions, RGB, candidate IDs and photo patches only.
const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
const palette=['#65d0bf','#e9b85b','#b7a1ef'];
function viewer(canvas,data,{defect=false,evidence,onPick}={}){
 const ctx=canvas.getContext('2d'),state={yaw:.2,pitch:.12,zoom:1,filter:defect?'0':'all',visible:defect?[0]:[0],box:true,byView:false,highlight:true,focus:false,selected:-1};
 let drag=null,frame=0,pickDots=[];
 function draw(){
  frame=0;if(!canvas.clientWidth)return;
  const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#142c29';ctx.fillRect(0,0,w,h);
  const box=defect?data.proxy.per_view.find(v=>v.input_index===0).box:data.proxy;
  const cy=Math.cos(state.yaw),sy=Math.sin(state.yaw),cp=Math.cos(state.pitch),sp=Math.sin(state.pitch);
  const rotate=p=>{
   const [x,y,z]=box.axes_rows.map(a=>a.reduce((s,v,k)=>s+v*(p[k]-box.center_world[k]),0));
   const u=cy*x+sy*z,v=-sy*x+cy*z;return [u,cp*y-sp*v,sp*y+cp*v];
  };
  const corners=box.corners_world.map(rotate);
  const focus=defect&&state.focus?evidence.candidate_points.map(rotate):corners;
  const low=[0,1].map(k=>Math.min(...focus.map(p=>p[k]))),hi=[0,1].map(k=>Math.max(...focus.map(p=>p[k])));
  const scale=Math.min((w-100)/Math.max(hi[0]-low[0],.03),(h-110)/Math.max(hi[1]-low[1],.03))*state.zoom*(state.focus ? .75 : 1);
  const project=p=>[(p[0]-(low[0]+hi[0])/2)*scale+w/2,h/2-(p[1]-(low[1]+hi[1])/2)*scale];
  const dots=data.points.map((p,i)=>({i,p:rotate(p)})).filter(({i})=>state.visible.includes(data.views[i])).sort((a,b)=>a.p[2]-b.p[2]);
  for(const {i,p} of dots){
   const [x,y]=project(p);ctx.globalAlpha=defect ? .52 : .93;
   ctx.fillStyle=state.byView?palette[data.views[i]]:`rgb(${data.rgb[i].join(',')})`;
   const size=defect&&state.focus?3:2;ctx.fillRect(x-size/2,y-size/2,size,size);
  }
  ctx.globalAlpha=1;
  if(state.box){
   ctx.strokeStyle='#c7dcb2';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();
   for(const [a,b]of box.edges){ctx.moveTo(...project(corners[a]));ctx.lineTo(...project(corners[b]));}ctx.stroke();ctx.setLineDash([]);
  }
  pickDots=[];
  if(defect&&state.highlight){
   evidence.candidate_points.forEach((p,i)=>{
    const [x,y]=project(rotate(p));pickDots.push({x,y,i});ctx.fillStyle=i===state.selected?'#fff':'#ff9c67';ctx.strokeStyle='#17251e';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(x,y,i===state.selected?7:4.5,0,Math.PI*2);ctx.fill();ctx.stroke();
   });
   const target=pickDots[Math.floor(pickDots.length/2)];
   if(target){const x=Math.max(20,Math.min(w-150,target.x+25)),y=Math.max(75,Math.min(h-70,target.y-50));
    ctx.strokeStyle='#ffb084';ctx.beginPath();ctx.moveTo(target.x,target.y);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle='#ffb084';ctx.font='12px monospace';ctx.fillText('C01 / 18 samples',x,y-8);}
  }
  ctx.fillStyle='#e1e9d4';ctx.font='11px monospace';
  ctx.fillText(defect?'C01 / image candidate localized in 3D':state.byView?'SAVED VGGT / VIEW-ID COLORS':'SAVED VGGT / ORIGINAL PHOTO COLORS',16,24);
  ctx.fillText(`${dots.length.toLocaleString()} displayed points · scene units uncalibrated`,16,h-18);
 }
 const request=()=>{if(!frame)frame=requestAnimationFrame(draw);};
 canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,travel:0};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.travel+=Math.abs(dx)+Math.abs(dy);state.yaw+=dx*.008;state.pitch=Math.max(-1.5,Math.min(1.5,state.pitch+dy*.008));drag.x=e.clientX;drag.y=e.clientY;request();});
 canvas.addEventListener('pointerup',e=>{
  if(defect&&drag?.travel<6){const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const near=pickDots.map(p=>({...p,d:Math.hypot(p.x-x,p.y-y)})).sort((a,b)=>a.d-b.d)[0];if(near?.d<25){state.selected=near.i;onPick?.(near.i);request();}}
  drag=null;
 });
 for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=null);
 canvas.addEventListener('wheel',e=>{e.preventDefault();state.zoom=Math.max(.3,Math.min(6,state.zoom*Math.exp(-e.deltaY*.001)));request();},{passive:false});
 canvas.addEventListener('keydown',e=>{
  const keys={ArrowLeft:()=>state.yaw-=.12,ArrowRight:()=>state.yaw+=.12,ArrowUp:()=>state.pitch+=.12,ArrowDown:()=>state.pitch-=.12,'+':()=>state.zoom*=1.1,'-':()=>state.zoom/=1.1,Enter:()=>{if(defect){state.selected=(state.selected+1)%18;onPick?.(state.selected);}}};
  if(keys[e.key]){e.preventDefault();keys[e.key]();request();}
 });
 const observer=new ResizeObserver(request);observer.observe(canvas);
 request();return {state,request,reset(){state.yaw=.2;state.pitch=.12;state.zoom=1;request();},dispose(){observer.disconnect();cancelAnimationFrame(frame);}};
}
export function mountCloud(canvas,data,controls){
 let disposed=false,main,detail,timer=null;
 // All three representations share the same view IDs.
 fetch('assets/inspection/evidence.json').then(r=>{if(!r.ok)throw Error('Saved inspection record unavailable');return r.json();}).then(evidence=>{
  if(disposed)return;
  main=viewer(canvas,data);
  const svg=$('#atlas-highlights'),[aw,ah]=evidence.atlas_original_size;
  svg.setAttribute('viewBox',`0 0 ${aw} ${ah}`);
  svg.innerHTML=evidence.atlas.tiles.map(t=>`<rect data-atlas-view="${Number(t.view_id)-1}" x="${t.rect_xywh[0]}" y="${t.rect_xywh[1]}" width="${t.rect_xywh[2]}" height="${t.rect_xywh[3]}" fill="none" stroke-width="5"/>`).join('');
  const photo=$('#candidate-photo-overlay');
  photo.innerHTML=evidence.candidate.polygons.map(p=>`<polygon points="${p.map(x=>x.join(',')).join(' ')}" fill="#ff9b6340" stroke="#ff9b63" stroke-width="14"/>`).join('')+'<circle id="selected-source-pixel" r="28" fill="#fff" stroke="#c75530" stroke-width="15" visibility="hidden"/>';
  const pick=i=>{
   const [x,y]=evidence.candidate_source_pixels[i],p=evidence.candidate_points[i],id=evidence.candidate.mapping.point_ids[i];
   const marker=$('#selected-source-pixel');marker.setAttribute('cx',x);marker.setAttribute('cy',y);marker.setAttribute('visibility','visible');
   $('#defect-point-status').textContent=`Sample ${i+1}/18 · original point ${id} · source pixel [${x.toFixed(1)}, ${y.toFixed(1)}] · XYZ [${p.map(v=>v.toFixed(4)).join(', ')}] scene units. Depth is not calibrated.`;
  };
  detail=viewer($('#defect-cloud'),data,{defect:true,evidence,onPick:pick});
  const stop=()=>{clearInterval(timer);timer=null;$('#views-replay').textContent='Replay views 01 → 02 → 03';};
  function views(ids,label){
   main.state.visible=ids;main.request();
   all('.evidence-view').forEach(b=>b.setAttribute('aria-pressed',ids.includes(Number(b.dataset.cloudView))?'true':'false'));
   all('[data-atlas-view]').forEach(rect=>{const on=ids.includes(Number(rect.dataset.atlasView));rect.setAttribute('stroke',on?'#e8b065':'transparent');});
   // Dim unselected rows without inventing any patch geometry or filling alpha.
   const rows=[...new Set(evidence.atlas.tiles.map(t=>t.view_id))];
   svg.querySelectorAll('.atlas-dim').forEach(e=>e.remove());
   for(const v of rows){if(ids.includes(Number(v)-1))continue;for(const t of evidence.atlas.tiles.filter(t=>t.view_id===v)){
    const r=document.createElementNS('http://www.w3.org/2000/svg','rect');r.setAttribute('class','atlas-dim');['x','y','width','height'].forEach((k,i)=>r.setAttribute(k,t.rect_xywh[i]));r.setAttribute('fill','#142c29dd');svg.append(r);
   }}
   $('#view-progress').textContent=label;
   const available=ids.filter(i=>rows.includes(String(i+1).padStart(2,'0')));
   const missing=ids.filter(i=>!available.includes(i));
   $('#atlas-status').textContent=(available.length?`Highlighted saved patches: view ${available.map(i=>String(i+1).padStart(2,'0')).join(' + ')}. `:'')+(missing.length?`View ${missing.map(i=>String(i+1).padStart(2,'0')).join(', ')} has no retained patch in this saved atlas; its points and photograph remain available. No texture has been invented.`:'Same source IDs as the points on the left.');
  }
  let stage='mask';
  function setStage(next,scroll=false){
   stage=next;$('#mask-explanation').hidden=stage!=='mask';$('#spatial-inspection').hidden=stage==='mask';
   $('#texture-stage').hidden=stage!=='texture';
   $('.geometry-texture').classList.toggle('cloud-only',stage!=='texture');
   all('[data-inspection-stage]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.inspectionStage===stage?'true':'false'));
   $('.multiview-section').dataset.stage=stage;
   if(scroll)$('#material-inspection').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
   main.request();
  }
  all('[data-inspection-stage]').forEach(b=>b.addEventListener('click',()=>{stop();setStage(b.dataset.inspectionStage);}));
  all('[data-material-step]').forEach(b=>b.addEventListener('click',()=>{
   stop();if(b.dataset.materialStep==='defect'){$('#material-decisions').scrollIntoView({behavior:'smooth',block:'start'});detail.request();}
   else setStage(b.dataset.materialStep,true);
  }));
  // A source button keeps photographs, points and texture patches linked.
  controls.filter.addEventListener('change',()=>{
   stop();const value=controls.filter.value;
   views(value==='all'?[0,1,2]:[Number(value)],value==='all'?'All three views / original photo colors':`View ${String(Number(value)+1).padStart(2,'0')} / original photo colors`);
  });
  all('[data-cloud-view]').forEach(b=>b.addEventListener('click',()=>{if(stage==='mask')setStage('cloud');}));
  controls.box.addEventListener('change',()=>{main.state.box=controls.box.checked;main.request();});
  controls.color.addEventListener('change',()=>{main.state.byView=controls.color.checked;main.request();$('#view-progress').textContent=controls.color.checked?'View-ID key: 01 teal · 02 gold · 03 lavender. These colors do not indicate damage.':'Original photographed RGB / saved points';});
  controls.reset.addEventListener('click',()=>main.reset());
  $('#views-all').addEventListener('click',()=>{stop();controls.filter.value='all';views([0,1,2],'All three views / saved observations');});
  $('#views-replay').addEventListener('click',()=>{
   if(timer){stop();return;}
   setStage('texture');let n=1;controls.color.checked=false;main.state.byView=false;controls.filter.value='all';
   views([0],'01 / view 01 points + its photo patches');$('#views-replay').textContent='Pause view buildup';
   if(matchMedia('(prefers-reduced-motion: reduce)').matches){views([0,1,2],'All views / reduced-motion display');stop();return;}
   timer=setInterval(()=>{n++;views(Array.from({length:n},(_,i)=>i),`${String(n).padStart(2,'0')} / ${n} source views added; positions unchanged`);if(n===3)stop();},2200);
  });
  $('#defect-focus').addEventListener('click',()=>{detail.state.focus=true;detail.reset();pick(0);});
  $('#defect-whole').addEventListener('click',()=>{detail.state.focus=false;detail.reset();});
  $('#defect-highlight').addEventListener('change',e=>{detail.state.highlight=e.target.checked;detail.request();});
  addEventListener('hashchange',stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  controls.filter.value='0';views([0],'View 01 / original photo colors');setStage('mask');
 }).catch(e=>{$('#view-progress').textContent=e.message;});
 return ()=>{disposed=true;clearInterval(timer);main?.dispose();detail?.dispose();};
}
