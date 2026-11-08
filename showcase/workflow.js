import {mountCloud} from './material-cloud.js?v=20261108';
import {mount as mountAssembly} from '../assets/analysis/desk-scene.js';
const $=s=>document.querySelector(s), all=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'Not recorded').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(n,p=2)=>Number(n).toLocaleString('en-US',{maximumFractionDigits:p});
const get=async p=>{const r=await fetch(p);if(!r.ok)throw Error('Saved record could not be loaded ('+r.status+').');return r.json();};
let material,research,cloudDispose,assembly,bar,selected,partMembers,allBars,step=0;
function route(){
 const id=document.body.dataset.activeChapter;
 if(id==='materials'&&material)showStep(step);
 if(id==='algorithm'&&partMembers&&!assembly)mountBench();
}
addEventListener('research:chapter',route);route();
document.addEventListener('trace-viewer-ready',()=>{if(selected)selectPart(selected);});
function showStep(){
 if(!material||cloudDispose)return;
 cloudDispose=mountCloud($('#cloud'),material.cloud,{box:$('#cloud-box'),color:$('#cloud-color'),filter:$('#cloud-filter'),reset:$('#cloud-reset')});
 $('#cloud-color').dispatchEvent(new Event('change'));
 $('#cloud-box').dispatchEvent(new Event('change'));
}
$('#unit-toggle').addEventListener('click',e=>{
 const inch=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',inch);
 $('#source-dimensions').textContent=inch?'43.5 × 7.375 × 7.125 in':'1104.90 × 187.325 × 180.975 mm';
 e.currentTarget.textContent=inch?'Show millimetres':'Show source inches';
});
all('[data-cloud-view]').forEach(b=>b.addEventListener('click',()=>{
 $('#cloud-filter').value=b.dataset.cloudView;$('#cloud-filter').dispatchEvent(new Event('change'));
}));
const safeSource=s=>{try{const u=new URL(s);return u.protocol==='https:'?u.href:'#';}catch{return '#';}};
function chooseBar(id){bar=allBars.find(b=>b.stock_id===id)||allBars[0];$('#stock-select').value=bar.stock_id;selected=bar.pieces.find(p=>p.assignment_status!=='SURPLUS_CUT_PART')?.part_id;renderBar();selectPart(selected);}
function renderBar(){
 const L=bar.source_length_mm||bar.length_mm;
 $('#cutting-bar').innerHTML=bar.pieces.map(p=>`<button type="button" data-part="${esc(p.part_id)}" style="background:${p.assignment_status==='SURPLUS_CUT_PART'?'#d4ac6d':''};left:${100*p.source_interval_mm[0]/L}%;width:${100*(p.source_interval_mm[1]-p.source_interval_mm[0])/L}%" aria-label="${esc(p.part_id)}, ${num(p.source_interval_mm[0])} to ${num(p.source_interval_mm[1])} millimetres">${esc(p.part_id.split('::')[1])}${p.assignment_status==='SURPLUS_CUT_PART'?' / surplus':''}</button>`).join('')+(bar.kerf_intervals_mm||[]).map(k=>`<span class="kerf" style="left:${100*k[0]/L}%;width:${100*(k[1]-k[0])/L}%" title="Kerf ${num(k[0])}–${num(k[1])} mm"></span>`).join('')+(bar.residual_interval_mm?`<span class="residual" style="left:${100*bar.residual_interval_mm[0]/L}%;width:${100*(bar.residual_interval_mm[1]-bar.residual_interval_mm[0])/L}%" title="${num(bar.residual_mm)} mm retained residual">Residual</span>`:'');
 $('#part-buttons').innerHTML=bar.pieces.map(p=>`<button type="button" data-part="${esc(p.part_id)}">${esc(p.part_id)}</button>`).join('');
 all('[data-part]').forEach(b=>b.addEventListener('click',()=>selectPart(b.dataset.part)));
 $('#bar-account').textContent=`${num(L)} mm source = ${num(bar.used_length_mm)} mm cut parts + ${num(bar.kerf_loss_mm)} mm kerf + ${num(bar.end_loss_mm||0)} mm prior end loss + ${num(bar.residual_mm)} mm retained residual.`;
}
function selectPart(id){
 const p=bar.pieces.find(p=>p.part_id===id);if(!p)return;selected=id;
 all('[data-part]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.part===id?'true':'false'));
 assembly?.update({selected:id});
 const m=partMembers?.find(m=>m.member_id===id),photo=research?.source_photos?.[bar.material_id]||m?.appearance?.source_photo||m?.source_photo;
 $('#trace-detail').innerHTML=`<p class="micro">${p.assignment_status==='SURPLUS_CUT_PART'?'Surplus cut part · not installed':'Installed part'}</p><h3>${p.assignment_status==='SURPLUS_CUT_PART'?'Retained surplus':'Selected installed part'}</h3><dl><dt>Parent stock</dt><dd><code>${esc(bar.stock_id)}</code></dd><dt>Part ID</dt><dd><code>${esc(id)}</code></dd><dt>Original cutting interval</dt><dd>${num(p.source_interval_mm[0])}–${num(p.source_interval_mm[1])} mm</dd><dt>Finished length</dt><dd>${num(p.used_length_mm)} mm</dd><dt>Retained residual on this source</dt><dd>${num(bar.residual_mm)} mm</dd></dl><a href="${esc(safeSource(p.source))}" target="_blank" rel="noopener">Seller attribution ↗</a>`;
 document.dispatchEvent(new CustomEvent('trace-selection',{detail:{part:p,bar,members:partMembers,member:m}}));
 if(photo&&(/^\//.test(photo)||/^assets\//.test(photo))){const img=new Image();img.src=photo;img.alt='Saved seller photograph for selected part';$('#trace-detail').prepend(img);}
}
function mountBench(){
 assembly=mountAssembly($('#assembly'),partMembers,{onSelect:id=>{
  const b=allBars.find(b=>b.pieces.some(p=>p.part_id===id));if(!b)return;
  if(b!==bar){bar=b;$('#stock-select').value=b.stock_id;renderBar();}selectPart(id);
 }});if(selected)selectPart(selected);
}
$('#stock-select').addEventListener('change',e=>chooseBar(e.target.value));
all('[data-view]').forEach(b=>b.addEventListener('click',()=>{
 all('[data-view]').forEach(v=>v.setAttribute('aria-pressed',v===b?'true':'false'));
 assembly?.update({mode:b.dataset.view==='laid-flat'?'flat':'assembled',explode:b.dataset.view==='exploded'?650:0});
}));
$('#film-mute').addEventListener('click',()=>{
 const v=$('#allocation-film');v.muted=!v.muted;$('#film-mute').textContent=v.muted?'Music off · turn on':'Music on · mute';
});
$('#film-replay').addEventListener('click',()=>{const v=$('#allocation-film');v.currentTime=0;v.play().catch(()=>{});});
function compare(r){
 const a=r.c1.summary,b=r.c2.summary,c=r.c3.totals;
 const rows=[
 ['Installed parts',[a.parts,b.installed_parts,c.installed_parts]],
 ['Unique selected bars',[a.selected_bars,b.source_bars_used,c.unique_source_bars]],
 ['Crosscuts',[a.crosscuts,b.cut_operations,c.cut_operations]],
 ['Surplus cut parts',[a.surplus_parts,b.surplus_cut_parts,c.surplus_parts]],
 ['Retained residual (m)',[a.balance.residual_mm/1000,b.residual_length_mm/1000,c.residual_length_mm/1000]],
 ['Crosscut kerf (m)',[a.balance.kerf_mm/1000,b.kerf_loss_mm/1000,c.kerf_length_mm/1000]],
 ['Untouched stock slots',[a.inventory.untouched_bars,b.untouched_stock_count,c.untouched_inventory]]
 ];
 $('#comparison-body').innerHTML=rows.map(([label,values])=>`<tr><th>${label}</th>${values.map(v=>`<td>${num(v,3)}</td>`).join('')}</tr>`).join('');
}
Promise.all([get('assets/material.json'),get('assets/research.json'),get('../assets/analysis/members.json'),get('../assets/update/allocation.json')]).then(([m,r,g,a])=>{
 if(a.run_id!==g.provenance.allocation_run_id||a.geometry_revision!==g.provenance.geometry_revision)throw Error('The saved model and allocation bindings do not match.');
 material=m;research=r;partMembers=g.members.map(p=>{
  let normal=[0,0,0];
  if(p.role==='ROOF_COVERING')normal=[0,0,1];else if(p.role==='DECK')normal=[0,0,-1];
  else if(['WALL_CLADDING','WALL_BACKING','OPENING_TRIMMER'].includes(p.role)){
   const name=p.parent_member_id||'';
   for(const [side,vector] of Object.entries({NORTH:[0,1,0],SOUTH:[0,-1,0],EAST:[1,0,0],WEST:[-1,0,0]}))if(name.includes(side)){normal=vector;break;}
  }
  return {...p,normal};
 });allBars=a.cut_bars;
 $('#stock-select').innerHTML=allBars.map(b=>`<option value="${esc(b.stock_id)}">${esc(b.stock_id)} · ${b.pieces.length} cut parts</option>`).join('');
 $('#cloud-filter').innerHTML='<option value="all">All views</option>'+Object.entries(m.cloud.view_labels||{}).map(([k,v])=>`<option value="${esc(k)}">View ${esc(v)}</option>`).join('');
 $('#source-photo').src=m.views[0].photo;
 chooseBar('118095_001');compare(r);route();
 if(!$('#load-status').classList.contains('error'))$('#load-status').hidden=true;
 document.dispatchEvent(new CustomEvent('material-ready',{detail:m}));
}).catch(()=>{
 const status=$('#load-status');status.hidden=false;status.className='error';
 status.innerHTML='Some interactive evidence could not load. <a href="">Reload this page</a> or <a href="technical.html">read the saved evidence archive</a>. The overview and case navigation remain available.';
});

all('[data-scroll]').forEach(a=>a.addEventListener('click',e=>{
 e.preventDefault();const target=document.getElementById(a.dataset.scroll);
 target?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}));
