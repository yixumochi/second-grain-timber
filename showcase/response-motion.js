const $=s=>document.querySelector(s);
const cache=new Map(),states=[],reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const get=id=>{
 if(!cache.has(id))cache.set(id,fetch(`assets/narrative/case${id}-response-motion.json`).then(r=>{if(!r.ok)throw Error('Saved response unavailable');return r.json();}).catch(error=>{cache.delete(id);throw error;}));
 return cache.get(id);
};
const observer=new IntersectionObserver(es=>es.forEach(e=>{
 e.target.dataset.visible=e.isIntersecting?'yes':'no';
 const state=states.find(s=>s.canvas===e.target);if(e.isIntersecting&&state)ensureResult(state);
}));
const projection=p=>[p[0]*.82-p[1]*.57,p[0]*.24+p[1]*.34-p[2]*.91];
function create(canvas,key){
 const s={canvas,ctx:canvas.getContext('2d'),key,time:reduce?3:0,paused:reduce,token:0,dirty:true};states.push(s);observer.observe(canvas);
 const play=$(`[data-response-play="${key}"]`);
 const label=()=>{play.textContent=s.paused?'Play deformation':'Pause deformation';play.setAttribute('aria-pressed',String(!s.paused));};
 play.onclick=()=>{s.paused=!s.paused;s.dirty=true;label();};
 $(`[data-response-reset="${key}"]`).onclick=()=>{s.time=0;s.paused=false;s.dirty=true;label();};
 label();return s;
}
const method=create($('#method-response-canvas'),'method');
const details=[1,2,3].map(n=>create($(`[data-response-canvas="${n}"]`),String(n)));
function selectResult(s,id,index=0){s.requested={id,index};ensureResult(s);}
function ensureResult(s){
 if(!s.requested||s.canvas.dataset.visible!=='yes')return;
 const {id,index}=s.requested,signature=`${id}:${index}`;
 if(s.signature===signature)return;
 s.signature=signature;load(s,id,index);
}
async function load(s,id,index=0){
 s.signature=`${id}:${index}`;
 const token=++s.token;
 try{
  const data=await get(id);if(token!==s.token)return;
  const r=data.results[index];s.data=data;s.result=r;s.time=reduce?3:0;
  const p=data.points_mm.map(projection),d=r.vectors_mm.map(projection);
  let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
  p.forEach((v,i)=>{for(const f of [0,r.magnification]){const x=v[0]+d[i][0]*f,y=v[1]+d[i][1]*f;xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);ymin=Math.min(ymin,y);ymax=Math.max(ymax,y);}});
  const scale=Math.min(850/(xmax-xmin||1),390/(ymax-ymin||1));
  s.p=p.map(v=>[(v[0]-(xmin+xmax)/2)*scale+500,(v[1]-(ymin+ymax)/2)*scale+260]);
  s.d=d.map(v=>v.map(x=>x*scale*r.magnification));
  s.critical=new Set(r.critical.split(',').map(v=>v.trim()));
  const scaleNote=`Deformation ×${r.magnification} · value unscaled. Grey: original · orange: critical member. Saved nodal response, not a dynamic simulation.`;
  if(s===method){
   $('#method-response-max').replaceChildren();
   const strong=document.createElement('strong');strong.textContent=`${r.maximum_mm.toFixed(3)} mm`;
   const label=document.createElement('span');label.textContent=`MAX DISPLACEMENT · ${r.critical}`;
   $('#method-response-max').append(strong,label);$('#method-response-scale').textContent=scaleNote;
  }else $(`[data-response-scale="${s.key}"]`).textContent=scaleNote;
  s.canvas.hidden=false;
  const fallback=s===method?$('#method-response-image'):$(`[data-result-image="${s.key}"]`);
  if(fallback)fallback.hidden=true;
  s.error?.remove();s.error=null;
  $(`[data-response-play="${s.key}"]`).disabled=false;
  $(`[data-response-reset="${s.key}"]`).disabled=false;
  s.canvas.dataset.loadCase=r.id;s.canvas.dataset.run=data.run_id;s.dirty=true;paint(s);
 }catch(e){
  if(token!==s.token)return;
  s.canvas.hidden=true;
  const fallback=s===method?$('#method-response-image'):$(`[data-result-image="${s.key}"]`);
  if(fallback)fallback.hidden=false;
  $(`[data-response-play="${s.key}"]`).disabled=true;
  $(`[data-response-reset="${s.key}"]`).disabled=true;
  if(!s.error){
   s.error=document.createElement('div');s.error.className='figure-error';s.error.setAttribute('role','status');
   s.canvas.after(s.error);
  }
  const text=document.createElement('p');text.textContent='Animated response is unavailable. The archived static drawing and saved result remain available.';
  const retry=document.createElement('button');retry.type='button';retry.textContent='Retry animation';
  retry.onclick=()=>{retry.disabled=true;load(s,s.requested.id,s.requested.index);};
  const record=document.createElement('a');record.href=`assets/narrative/case${id}-response-motion.json`;record.textContent='Open saved response data';
  s.error.replaceChildren(text,retry,record);
 }
}
function paint(s){
 if(!s.p)return;const {ctx:c,canvas,p,d,data,result:r}=s;
 const f=(1-Math.cos((s.time%6)/6*Math.PI*2))/2;
 canvas.dataset.deformationFraction=f.toFixed(3);
 c.fillStyle='#19251f';c.fillRect(0,0,1000,540);
 c.font='13px monospace';c.fillStyle='#aabb9e';c.fillText(`SAVED KARAMBA / CASE ${data.case} / ${r.id.replaceAll('_',' ')}`,28,32);
 c.lineWidth=.75;c.strokeStyle='#435348';c.beginPath();
 for(const [a,b] of data.timber_edges){c.moveTo(p[a][0],p[a][1]);c.lineTo(p[b][0],p[b][1]);}c.stroke();
 const line=(a,b)=>{c.moveTo(p[a][0]+d[a][0]*f,p[a][1]+d[a][1]*f);c.lineTo(p[b][0]+d[b][0]*f,p[b][1]+d[b][1]*f);};
 c.lineWidth=data.case===2?1.2:2.2;c.strokeStyle='#d5dfb7';c.lineCap='round';c.beginPath();
 for(const [a,b] of data.timber_edges)line(a,b);c.stroke();
 c.lineWidth=4;c.strokeStyle='#edaa6e';c.beginPath();
 for(const [a,b,id] of data.timber_edges)if(s.critical.has(id))line(a,b);c.stroke();
 const i=r.critical_node,x=p[i][0]+d[i][0]*f,y=p[i][1]+d[i][1]*f;
 c.fillStyle='#f4b478';c.strokeStyle='#fff0d5';c.lineWidth=1.5;c.beginPath();c.arc(x,y,7,0,Math.PI*2);c.fill();c.stroke();
 c.font='bold 19px Arial';c.fillStyle='#f4b478';
 const tx=x>730?x-190:x+22,ty=y<75?y+35:y-20;
 c.fillText(`MAX ${r.maximum_mm.toFixed(3)} mm`,tx,ty);
 c.font='12px monospace';c.fillStyle='#bac7a7';c.fillText(`0 → saved deformation → 0    |    display ×${r.magnification}`,28,510);
}
let last=0,lastFrame=0;
function animate(now){
 requestAnimationFrame(animate);const dt=Math.min(.1,(now-(last||now))/1000);last=now;
 for(const s of states)if(!s.paused&&!document.hidden&&s.canvas.dataset.visible==='yes')s.time+=dt;
 if(now-lastFrame<32)return;lastFrame=now;
 for(const s of states)if(s.canvas.dataset.visible==='yes'&&!document.hidden&&(!s.paused||s.dirty)){paint(s);s.dirty=false;}
}
requestAnimationFrame(animate);
document.addEventListener('response-case-selected',e=>selectResult(method,Number(e.detail),0));
$('#method-load').addEventListener('change',e=>selectResult(method,Number($('#response-case').value),Number(e.target.value)));
details.forEach((s,i)=>{
 $(`[data-result-select="${i+1}"]`).addEventListener('change',e=>selectResult(s,i+1,Number(e.target.value)));
 selectResult(s,i+1,Number($(`[data-result-select="${i+1}"]`).value)||0);
});
selectResult(method,Number($('#response-case').value)||1,Number($('#method-load').value)||0);
