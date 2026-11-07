const $=s=>document.querySelector(s), all=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(x,d=2)=>Number(x).toLocaleString('en-US',{maximumFractionDigits:d});
const get=async url=>{const r=await fetch(url);if(!r.ok)throw Error(`Record unavailable: ${url}`);return r.json();};
function barMarkup(length,segments){
 return `<div class="saved-bar">${segments.map(s=>`<span class="${s.kind}" style="width:${100*s.length/length}%" title="${esc(s.label)}: ${fmt(s.length)} mm"></span>`).join('')}</div><div class="bar-caption">${segments.map(s=>`${esc(s.label)} ${fmt(s.length)} mm`).join(' · ')}</div>`;
}
function unavailable(target,record,label){
 const host=$(target);if(!host)return;
 const message=document.createElement('p');message.className='figure-error';message.setAttribute('role','status');
 message.append(document.createTextNode(label+' could not load. '));
 const link=document.createElement('a');link.href=record;link.textContent='Open the saved record';
 const reload=document.createElement('a');reload.href='';reload.textContent='Reload this page';
 message.append(link,reload);host.prepend(message);
}
Promise.all([get('../assets/update/allocation.json'),get('../assets/analysis/members.json')]).then(([allocation,geometry])=>{
 // These are view-only summaries of existing saved intervals.
 const multi=allocation.cut_bars.filter(b=>b.pieces.length>1&&b.residual_mm>20);
 const surplus=multi.find(b=>b.pieces.some(p=>p.assignment_status==='SURPLUS_CUT_PART'));
 const selected=[...new Map([...multi.slice(0,2),...(surplus?[surplus]:[])].map(b=>[b.stock_id,b])).values()];
 $('#static-cuts').innerHTML=selected.map(b=>{
  const intervals=b.pieces.map(p=>({kind:p.assignment_status==='SURPLUS_CUT_PART'?'surplus':'installed',start:p.source_interval_mm[0],length:p.source_interval_mm[1]-p.source_interval_mm[0],label:p.part_id}));
  (b.kerf_intervals_mm||[]).forEach(k=>intervals.push({kind:'kerf',start:k[0],length:k[1]-k[0],label:'Kerf'}));
  if(b.residual_interval_mm)intervals.push({kind:'residual',start:b.residual_interval_mm[0],length:b.residual_mm,label:'Residual'});
  intervals.sort((x,y)=>x.start-y.start);
  return `<div class="static-cut"><div class="static-cut-head"><b>${esc(b.stock_id)}</b><span>${fmt(b.source_length_mm)} mm original source</span></div>${barMarkup(b.source_length_mm,intervals)}<div class="static-cut-parts">${b.pieces.map(p=>`<span>${esc(p.part_id)}<br>${fmt(p.source_interval_mm[0])}–${fmt(p.source_interval_mm[1])} mm → ${p.assignment_status==='SURPLUS_CUT_PART'?'SURPLUS / NOT INSTALLED':esc(p.member_id)}</span>`).join('')}</div></div>`;
 }).join('');
 all('.static-cut').forEach((card,i)=>{
  const b=selected[i],m=geometry.members.find(m=>m.stock_id===b.stock_id),url=m?.appearance?.texture;
  if(!url)return;
  const bar=card.querySelector('.saved-bar');bar.style.backgroundImage=`url("${url}")`;bar.style.backgroundSize='100% 100%';
  bar.querySelectorAll('span').forEach(s=>{if(s.className==='installed')s.style.background='rgba(42,105,57,.28)';if(s.className==='residual')s.style.background='rgba(173,59,40,.25)';if(s.className==='surplus')s.style.background='rgba(183,119,44,.38)';});
 });
}).catch(()=>unavailable('#static-cuts','../assets/update/allocation.json','The cutting ledger'));
get('assets/narrative/defect-experiments.json').then(experiments=>{
 function defect(demand){
  const e=experiments.find(e=>e.configuration.demands[0].length_mm===demand),r=e.after_cutting;
  const segments=demand===600?[
   {kind:'installed',length:r.used_mm,label:'600 mm probe part'},
   {kind:'kerf',length:r.allocation_kerf_mm,label:'Allocation kerf'},
   {kind:'residual',length:r.selected_offcut_mm,label:'Retained offcut'},
   {kind:'kerf',length:r.preparation_kerf_mm,label:'Preparation kerf'},
   {kind:'excluded',length:r.excluded_mm,label:'Excluded region'}
  ]:[{kind:'retained',length:r.retained_unselected_mm,label:'Retained continuous segment'},
      {kind:'kerf',length:r.preparation_kerf_mm,label:'Preparation kerf'},
      {kind:'excluded',length:r.excluded_mm,label:'Excluded region'}];
  $('#defect-ledger').innerHTML=`<div class="eyebrow">1,104.9 mm SOURCE / SAVED SCENARIO</div>${barMarkup(r.source_length_mm,segments)}`;
  $('#defect-outcome').className='defect-value';
  $('#defect-outcome').innerHTML=demand===600?'<strong>600 mm fits.</strong><small>Saved result: OPTIMAL for this isolated demand. 225.24 mm retained offcut after the 3 mm allocation kerf.</small>':'<strong>900 mm no longer fits.</strong><small>Saved result: OPTIMAL before the exclusion → INFEASIBLE after it. The remaining continuous segment is 828.24 mm.</small>';
  all('[data-demand]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.demand)===demand?'true':'false'));
 }
 all('[data-demand]').forEach(b=>b.addEventListener('click',()=>defect(Number(b.dataset.demand))));defect(900);
}).catch(()=>unavailable('#defect-ledger','assets/narrative/defect-experiments.json','The saved trim scenario'));
get('assets/narrative/cases.json').then(cases=>{
 for(const c of cases){
  const select=$(`[data-result-select="${c.id}"]`);
  select.innerHTML=c.results.map((r,i)=>`<option value="${i}">${esc(r.name)} · ${fmt(r.maximum_mm,3)} mm</option>`).join('');
  const show=i=>{
   const r=c.results[i],image=$(`[data-result-image="${c.id}"]`);
   image.src=r.image;image.alt=`${c.title}, ${r.name}. Maximum ${fmt(r.maximum_mm,3)} mm at ${r.critical}. Displacement drawing ×${r.magnification}.`;
   $(`[data-result-summary="${c.id}"]`).innerHTML=`<h3>MAX DISPLACEMENT</h3><div class="max-value">${fmt(r.maximum_mm,3)}<small>mm</small></div><p>${esc(r.critical)}</p><details><summary>Load definition &amp; saved details</summary><dl><dt>DISPLACEMENT VECTOR [X, Y, Z] / mm</dt><dd>[${r.vector_mm.map(v=>fmt(v,3)).join(', ')}]</dd><dt>CRITICAL POSITION [X, Y, Z] / mm</dt><dd>[${r.position_mm.map(v=>fmt(v,1)).join(', ')}]</dd><dt>TOTAL APPLIED FORCE [X, Y, Z] / kN</dt><dd>[${r.force_kN.map(v=>fmt(v,3)).join(', ')}]</dd><dt>LOAD DEFINITION</dt><dd>${esc(r.load_description)}</dd><dt>DRAWING MAGNIFICATION</dt><dd>×${r.magnification}; numerical results are unscaled.</dd></dl>${r.anchor_tension_required?'<p class="case-warning">This load case requires tensile anchor reactions. Anchorage capacity has not been verified.</p>':''}</details>`;
  };
  select.addEventListener('change',()=>show(Number(select.value)));show(0);
 }
 all('[data-agent-case]').forEach(b=>b.addEventListener('click',()=>{
  const c=cases.find(c=>c.id===Number(b.dataset.agentCase)),v=$('#agent-film');
  v.pause();v.src=c.agent_film;v.poster=`assets/narrative/case${c.id}-agent-v2-poster.jpg`;v.load();
  $('#agent-basis').textContent=c.dialogue_basis;
  all('[data-agent-case]').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));
 }));
}).catch(()=>{
 for(const id of [1,2,3])unavailable(`[data-result-summary="${id}"]`,'assets/narrative/cases.json','The case result');
 unavailable('#agent-basis','assets/narrative/cases.json','The case dialogue');
});
// Prevent overlapping soundtracks, without autoplay or changing playback permission.
all('video').forEach(v=>v.addEventListener('play',()=>all('video').forEach(other=>{if(other!==v)other.pause();})));
