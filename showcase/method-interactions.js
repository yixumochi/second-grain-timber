import {draw,decodeAppearance} from '../assets/analysis/desk-scene.js';
const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
const fmt=(n,d=2)=>Number(n).toLocaleString('en-US',{maximumFractionDigits:d});
const explanations={
stock:['Start with what actually exists.','read saved stock IDs, sections, usable intervals and quantities'],
demand:['Keep every requested member identifiable.','read required length, section, role and installed position for each member'],
profile:['A cut has a cost and a limit.','apply the saved case’s kerf, short-piece settings and allowed joint rules'],
eligible:['Reject incompatible combinations before solving.','for each demand: retain sources meeting role, section and continuous-length rules'],
patterns:['One board can supply several parts.','enumerate permitted cutting patterns and member jointing patterns'],
solver:['Choose patterns using one finite inventory.','choose integer counts of patterns\nsubject to: required members are satisfied\n            source quantities are not exceeded\nminimize the original saved run’s objective'],
mapping:['Every installed part retains its origin.','for each selected pattern: link source interval → part ID → member position'],
balance:['Account for material that is not installed too.','reconcile source material with installed parts + surplus + kerf + residual\nkeep untouched inventory separate']
};
all('[data-logic]').forEach(b=>b.addEventListener('click',()=>{
 all('[data-logic]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
 const [title,code]=explanations[b.dataset.logic],pane=$('#logic-explanation');pane.replaceChildren();
 const h=document.createElement('h3');h.textContent=title;
 const pre=document.createElement('pre');pre.textContent=code;
 const small=document.createElement('p');small.className='caption';small.textContent='Readable pseudocode / explanation of the existing workflow, not a new solver.';
 pane.append(h,pre,small);
}));
$('[data-logic="solver"]')?.click();
fetch('assets/narrative/cases.json').then(r=>r.json()).then(cases=>{
 let c=cases[0];
 function result(){
  const r=c.results[Number($('#method-load').value)];
  $('#method-response-image').src=r.image;
  const v=$('#method-response-values');v.replaceChildren();
  for(const text of [`Maximum translation: ${fmt(r.maximum_mm,3)} mm`,`${r.critical}`,r.load_description,`Vector [X,Y,Z]: ${r.vector_mm.map(v=>fmt(v,3)).join(', ')} mm`,`Drawing ×${r.magnification}; values unscaled.`,c.assumptions]){
   const p=document.createElement('p');p.textContent=text;v.append(p);
  }
  $('#method-verification').href=`#case${c.id}`;
 }
 function setCase(id){
  c=cases.find(x=>x.id===id);const s=$('#method-load');s.replaceChildren();
  c.results.forEach((r,i)=>{const o=new Option(`${r.name} · ${fmt(r.maximum_mm,3)} mm`,i);s.add(o);});
  $('#response-case').value=String(id);
  result();
  document.dispatchEvent(new CustomEvent('response-case-selected',{detail:id}));
 }
 $('#method-load').addEventListener('change',result);
 all('[data-agent-case]').forEach(b=>b.addEventListener('click',()=>setCase(Number(b.dataset.agentCase))));
 $('#response-case').addEventListener('change',e=>setCase(Number(e.target.value)));
 setCase(1);
});
// Native playback keeps user gesture/audio permissions. Expose buffering and failure.
all('video').forEach(v=>{
 const status=document.createElement('p');status.className='media-state caption';status.setAttribute('role','status');v.after(status);
 v.addEventListener('waiting',()=>status.textContent='Buffering saved film…');
 v.addEventListener('playing',()=>status.textContent='');
 v.addEventListener('canplay',()=>status.textContent='');
 v.addEventListener('error',()=>status.textContent='Film could not load. Reload this page or use the MP4 download.');
});
const canvas=$('#trace-loop'),ctx=canvas?.getContext('2d');
let selected=null,texture=null,scene=null,base=null,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,start=performance.now(),stamp=0;
const textures=new Map();
$('#trace-loop-toggle')?.addEventListener('click',e=>{
 paused=!paused;e.currentTarget.textContent=paused?'Play loop':'Pause loop';e.currentTarget.setAttribute('aria-pressed',String(!paused));
});
function paintBar(){
 if(!selected)return;
 const {bar,member,members}=selected,url=(member||members.find(m=>m.stock_id===bar.stock_id))?.appearance?.texture;
 const strip=$('#cutting-bar');strip.style.backgroundImage=url?`url("${url}")`:'none';strip.style.backgroundSize='100% 100%';
 strip.querySelectorAll('button').forEach(b=>{
  b.style.background=b.textContent.includes('surplus')?'rgba(184,119,47,.42)':'rgba(55,112,75,.27)';
 });
 strip.querySelectorAll('.residual').forEach(b=>b.style.background='rgba(185,65,47,.25)');
}
document.addEventListener('trace-selection',async e=>{
 const token=++stamp;selected=e.detail;start=performance.now();texture=null;paintBar();
 const {member,bar,members}=selected;
 const sourceMember=member||members.find(m=>m.stock_id===bar.stock_id);
 $('#trace-loop-label').textContent=`${bar.stock_id} → ${selected.part.part_id}. Saved allocation correspondence; looping placement is illustrative. Grain is representative, not a measured surface map.`;
 base=document.createElement('canvas');base.width=520;base.height=285;
 scene=draw(base.getContext('2d'),members,520,285,{yaw:.65,pitch:.42,selected:member?.member_id});
 if(sourceMember?.appearance?.texture){
  const im=new Image();im.onload=()=>{if(token===stamp)texture=im;};im.src=sourceMember.appearance.texture;
  const data=await decodeAppearance(sourceMember.appearance.texture).catch(()=>null);
  if(token!==stamp)return;
  if(data){textures.set(sourceMember.material_id,data);scene=draw(base.getContext('2d'),members,520,285,{yaw:.65,pitch:.42,selected:member?.member_id,textures});}
 }
});
function frame(now){
 requestAnimationFrame(frame);if(!ctx||!selected||document.body.dataset.activeChapter!=='algorithm')return;
 if(paused)start+=now-(frame.last||now);frame.last=now;
 const t=((now-start)/1000)%8,{bar,part,member}=selected,L=bar.source_length_mm||bar.length_mm;
 ctx.fillStyle='#e3e7d7';ctx.fillRect(0,0,520,460);
 ctx.fillStyle='#30422f';ctx.font='12px monospace';
 ctx.fillText(['01 / SOURCE + SAVED CUT MARKS','02 / RETAIN THE CUT PART','03 / LOCATE THE TARGET','04 / PLACE INTO THE MODEL'][Math.min(3,Math.floor(t/2))],20,26);
 ctx.font='11px monospace';ctx.fillText(bar.stock_id,20,48);
 ctx.fillStyle='#b69a70';ctx.fillRect(20,65,480,28);if(texture)ctx.drawImage(texture,20,65,480,28);
 for(const p of bar.pieces){
  const a=20+480*p.source_interval_mm[0]/L,w=480*(p.source_interval_mm[1]-p.source_interval_mm[0])/L;
  ctx.fillStyle=p.assignment_status==='SURPLUS_CUT_PART'?'rgba(185,116,42,.4)':'rgba(50,114,72,.3)';ctx.fillRect(a,65,w,28);
  ctx.strokeStyle='#394b35';ctx.strokeRect(a,65,w,28);
 }
 if(bar.residual_interval_mm){ctx.fillStyle='rgba(184,58,40,.28)';ctx.fillRect(20+480*bar.residual_interval_mm[0]/L,65,480*bar.residual_mm/L,28);}
 ctx.fillStyle='#30422f';ctx.fillText(`${part.part_id} | ${fmt(part.source_interval_mm[0])}–${fmt(part.source_interval_mm[1])} mm`,20,116);
 ctx.font='10px monospace';ctx.fillText('GREEN installed · AMBER surplus · RED residual · lines cut boundaries',20,136);
 if(base)ctx.drawImage(base,0,165);
 const a=20+480*part.source_interval_mm[0]/L,w=480*(part.source_interval_mm[1]-part.source_interval_mm[0])/L;
 let target=member&&scene?.project(member.box.center),tx=target?.x??target?.[0],ty=target?.y??target?.[1];
 if(Number.isFinite(tx)&&Number.isFinite(ty)){
  ty+=165;ctx.strokeStyle='#b35a32';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(a+w/2,98);ctx.lineTo(tx,ty);ctx.stroke();ctx.setLineDash([]);
  ctx.beginPath();ctx.arc(tx,ty,9,0,Math.PI*2);ctx.stroke();
  const f=Math.max(0,Math.min(1,(t-5)/2)),x=a+(tx-a-w/2)*f,y=65+(ty-65)*f;
  if(t>2&&t<7){
   const end=scene.project(member.box.center.map((v,i)=>v+member.box.axes[0][i]*member.box.half[0]));
   const angle=Math.atan2(end[1]+165-ty,end[0]-tx),length=2*Math.hypot(end[0]-tx,end[1]+165-ty);
   const size=w+(length-w)*f;ctx.save();ctx.translate(x+w/2,y+9);ctx.rotate(angle*f);
   ctx.fillStyle='#b69a70';ctx.fillRect(-size/2,-9,size,18);if(texture)ctx.drawImage(texture,-size/2,-9,size,18);
   ctx.strokeStyle='#305e38';ctx.strokeRect(-size/2,-9,size,18);ctx.restore();
  }
 }else{ctx.fillStyle='#795830';ctx.fillText('Surplus stays in the source ledger / not installed',20,145);}
}
requestAnimationFrame(frame);
