import {mount} from '../analysis/desk-scene.js';
import {sourcePanel} from '../analysis/public-analysis.js';
const esc=x=>String(x??'Unavailable').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(x,d=3)=>Number.isFinite(x)?x.toLocaleString('en-GB',{maximumFractionDigits:d}):'Unavailable';
const m=x=>num(x/1000),pct=x=>num(x*100,2)+'%';
const keys=[['installed_mm','Installed parts','#61764a'],['surplus_mm','Surplus cut parts','#d99032'],['residual_mm','Residual','#a7b88d'],['kerf_mm','Crosscut kerf','#a46051'],['defect_trim_mm','Defect trim','#734d68'],['end_loss_mm','Recorded end loss','#777365'],['retained_unselected_mm','Unselected retained segments','#c8c3ad']];
function dashboard(s){
 const total=s.source_mm;let angle=0;
 const arcs=keys.map(([k,label,color])=>{const ratio=s.balance[k]/total,previous=angle;angle+=ratio*360;return `${color} ${previous}deg ${angle}deg`;}).join(',');
 const roles=s.by_role.filter(r=>r.allocated_members>0),max=Math.max(...roles.map(r=>r.allocated_members));
 return `<div class="dashboard-grid"><div><h3>Selected stock length balance</h3><div class="donut-layout"><svg class="balance-donut" viewBox="0 0 220 220" role="img" aria-label="Selected stock length balance"><foreignObject width="220" height="220"><div xmlns="http://www.w3.org/1999/xhtml" style="width:220px;height:220px;border-radius:50%;background:conic-gradient(${arcs});display:grid;place-items:center"><div style="width:156px;height:156px;border-radius:50%;background:#f7f0df;display:flex;align-items:center;justify-content:center;text-align:center;font:18px Consolas,monospace">${m(total)} m<br/>selected</div></div></foreignObject></svg><div class="donut-legend">${keys.map(([k,label,color])=>`<div><i style="background:${color}"></i><span>${label}</span><b>${m(s.balance[k])} m</b></div>`).join('')}</div></div><p class="caption">Denominator: ${m(total)} m of selected source stock. Length accounting, not volume yield. Untouched inventory is separate.</p></div><div><h3>Allocated design members by role</h3>${roles.map(r=>`<div class="role-chart-row"><span>${esc(r.label)}</span><div class="track"><i style="width:${r.allocated_members/max*100}%"></i></div><b>${r.allocated_members}</b></div>`).join('')}<p class="caption">125 design members → 155 installed parts. Multi-part members increase the part count without increasing the demand count.</p></div></div><div class="inventory-note"><div><strong>${s.inventory.untouched_bars}</strong><span>Untouched inventory bars</span></div><div><strong>${m(s.inventory.untouched_length_mm)} m</strong><span>Untouched nominal length · outside selected-stock balance</span></div><div><strong>${s.inventory.single_part_used} / ${s.inventory.multi_part_used}</strong><span>One-part / multi-part selected bars</span></div></div>`;
}
function groupTable(s,group){
 const rows=group==='basis'?s.by_provenance:s.by_role;
 return `<h3>${group==='basis'?'Allocation by provenance basis':'Allocation by building role'}</h3><p class="caption">${esc(s.grouping_basis)}</p><div class="table-scroll"><table class="group-table"><thead><tr><th>Category</th><th>Members / parts</th><th>Source bars</th><th>Cuts</th><th>Installed / residual / loss</th><th>Residual</th><th>Waste ratio</th></tr></thead><tbody>${rows.map(r=>{const denom=r.attributed_source_mm||1;return `<tr><th>${esc(r.label)}</th><td>${r.allocated_members} / ${r.parts}</td><td>${r.source_bars}</td><td>${r.crosscuts}</td><td><div class="group-bars" aria-label="Installed ${m(r.installed_mm)} m, surplus ${m(r.surplus_mm)} m, residual ${m(r.residual_mm)} m, kerf ${m(r.kerf_mm)} m">${[['installed_mm','#61764a'],['surplus_mm','#d99032'],['residual_mm','#a7b88d'],['kerf_mm','#a46051'],['end_loss_mm','#777365']].map(([k,c])=>`<i style="width:${(r[k]||0)/denom*100}%;background:${c}"></i>`).join('')}</div><small>${m(r.installed_mm)} / ${m(r.residual_mm)} / ${m((r.kerf_mm||0)+(r.end_loss_mm||0))} m</small></td><td>${m(r.residual_mm)} m</td><td>${Number.isFinite(r.waste_ratio)?pct(r.waste_ratio):'—'}</td></tr>`;}).join('')}</tbody></table></div>`;
}
const interval=x=>`${num(x?.[0],2)}–${num(x?.[1],2)}`;
function strip(bar,selected){
 const length=bar.source_length_mm||bar.length_mm;
 const segments=bar.pieces.map(p=>({start:p.source_interval_mm[0],end:p.source_interval_mm[1],kind:p.assignment_status==='SURPLUS_CUT_PART'?'surplus':'installed',label:`${p.part_id} · ${interval(p.source_interval_mm)} mm`,id:p.part_id}));
 for(const i of bar.kerf_intervals_mm||[])segments.push({start:i[0],end:i[1],kind:'loss',label:'Kerf · '+interval(i)+' mm'});
 const residual=bar.residual_interval_mm;if(residual)segments.push({start:residual[0],end:residual[1],kind:'residual',label:'Residual · '+interval(residual)+' mm'});
 return `<div class="mini-bar" aria-label="Cutting intervals of ${esc(bar.stock_id)}">${segments.map(i=>`<span class="${i.kind}" style="left:${i.start/length*100}%;width:${(i.end-i.start)/length*100}%;${i.id===selected?'outline:2px solid #9d4c31;z-index:1':''}" title="${esc(i.label)}"></span>`).join('')}</div>`;
}
function displayNormal(part){
 // Display offsets only; analytical nodes and assembled boxes remain untouched.
 if(part.role==='ROOF_COVERING')return [0,0,1];
 if(part.role==='DECK')return [0,0,-1];
 if(['WALL_CLADDING','WALL_BACKING','OPENING_TRIMMER'].includes(part.role)){
  const id=part.parent_member_id;if(id.includes('NORTH'))return [0,1,0];if(id.includes('SOUTH'))return [0,-1,0];if(id.includes('EAST'))return [1,0,0];if(id.includes('WEST'))return [-1,0,0];
 }
 return [0,0,0];
}
async function start(){
 const root=document.querySelector('#allocation');if(!root)return;const q=s=>root.querySelector(s);
 try{
  const [a,model]=await Promise.all([fetch('/second-grain-timber/assets/update/allocation.json').then(r=>{if(!r.ok)throw Error('Allocation unavailable');return r.json();}),fetch('/second-grain-timber/assets/analysis/members.json').then(r=>{if(!r.ok)throw Error('Model unavailable');return r.json();})]);
  const s=a.summary;
  if(s.run_id!==model.provenance.allocation_run_id||a.geometry_revision!==model.provenance.geometry_revision||s.status!=='OPTIMAL'||model.members.length!==s.parts)throw Error('The saved model and allocation do not share the same binding.');
  if(Math.abs(Object.values(s.balance).reduce((v,x)=>v+x,0)-s.source_mm)>.01)throw Error('The saved selected-stock balance does not reconcile.');
  const members=model.members.map(p=>({...p,normal:displayNormal(p)})),parts=new Map(members.map(p=>[p.member_id,p])),bars=new Map(a.cut_bars.map(b=>[b.stock_id,b]));
  const basis=new Map();s.by_provenance.forEach(g=>g.part_ids.forEach(id=>basis.set(id,g.key)));
  let selected=null,selectedStock=null,view='assembled';
  q('#allocation-dashboard').innerHTML=dashboard(s);
  q('#allocation-part').innerHTML=members.map(p=>`<option value="${esc(p.member_id)}">${esc(p.parent_member_id)} / ${esc(p.member_id)}</option>`).join('');
  q('#allocation-role').innerHTML='<option value="all">All roles</option>'+s.by_role.filter(r=>r.allocated_members).map(r=>`<option value="${esc(r.key)}">${esc(r.label)}</option>`).join('');
  q('#allocation-basis').innerHTML='<option value="all">All bases</option>'+s.by_provenance.filter(g=>g.key!=='SURPLUS').map(g=>`<option value="${g.key}">${esc(g.label)} (${g.parts} parts)</option>`).join('');
  const viewer=mount(q('#allocation-model'),members,{onSelect:select,appearanceReference:members});
  function bank(){
   const role=q('#allocation-role').value,b=q('#allocation-basis').value;
   const eligible=new Set(members.filter(p=>(role==='all'||p.role===role)&&(b==='all'||basis.get(p.member_id)===b)).map(p=>p.stock_id));
   q('#allocation-bank').innerHTML=a.cut_bars.filter(bar=>eligible.has(bar.stock_id)).map(bar=>`<button type="button" class="bank-row" data-stock="${esc(bar.stock_id)}" aria-pressed="${bar.stock_id===selectedStock}"><strong>${esc(bar.stock_id)}</strong> · ${num(bar.source_length_mm,1)} mm · ${bar.pieces.length} cut part${bar.pieces.length===1?'':'s'}${strip(bar,selected)}</button>`).join('')||'<p>No selected source bars match this filter.</p>';
   q('#allocation-groups').innerHTML=groupTable(s,b!=='all'?'basis':'role')+'<details class="method-note"><summary>All provenance groups</summary>'+groupTable(s,'basis')+'</details>';
  }
  function cut(bar){
   if(!bar){q('#allocation-cut').innerHTML='Saved cutting ledger unavailable.';return;}
   const installedIds=new Set(members.map(p=>p.member_id));
   q('#allocation-cut').innerHTML=`<h3 class="selected-cut-title">${esc(bar.stock_id)}</h3><p>${num(bar.source_length_mm,2)} mm original source length</p>${strip(bar,selected)}<table class="cut-ledger"><thead><tr><th>Part / destination</th><th>Source interval (mm)</th><th>Length (mm)</th></tr></thead><tbody>${bar.pieces.map(p=>`<tr class="${p.part_id===selected?'selected':''}"><td>${installedIds.has(p.part_id)?`<button type="button" data-cut-part="${esc(p.part_id)}">${esc(p.member_id||p.part_id)}</button>`:`${esc(p.part_id)} · surplus`}<br><small>${esc(p.part_id)}</small></td><td>${interval(p.source_interval_mm)}</td><td>${num(p.used_length_mm,2)}</td></tr>`).join('')}<tr><td>Residual</td><td>${interval(bar.residual_interval_mm)}</td><td>${num(bar.residual_mm,2)}</td></tr><tr><td>Crosscut kerf</td><td>${(bar.kerf_intervals_mm||[]).map(interval).join('; ')}</td><td>${num(bar.kerf_loss_mm,2)}</td></tr></tbody></table><p class="caption">Original source coordinates. ${esc(bar.length_basis)}</p>`;
  }
  function select(id){const part=parts.get(id);if(!part)return;selected=id;selectedStock=part.stock_id;q('#allocation-part').value=id;viewer.update({selected:id});q('#allocation-source').innerHTML=sourcePanel(part);cut(bars.get(part.stock_id));bank();}
  root.addEventListener('click',ev=>{
   const btn=ev.target.closest('[data-allocation-view],[data-stock],[data-cut-part]');if(!btn)return;
   if(btn.dataset.allocationView){view=btn.dataset.allocationView;viewer.update({mode:view==='flat'?'flat':'assembled',explode:view==='exploded'?700:0,yaw:view==='flat'?0:.65,pitch:view==='flat'?1.45:.42,zoom:1,pan:[0,0]});root.querySelectorAll('[data-allocation-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));}
   if(btn.dataset.cutPart)select(btn.dataset.cutPart);
   if(btn.dataset.stock){const bar=bars.get(btn.dataset.stock),p=bar.pieces.find(p=>parts.has(p.part_id));if(p)select(p.part_id);else{selectedStock=bar.stock_id;cut(bar);bank();}}
  });
  q('#allocation-role').onchange=bank;q('#allocation-basis').onchange=bank;q('#allocation-part').onchange=ev=>select(ev.target.value);
  q('#allocation-reset').onclick=()=>viewer.update({yaw:view==='flat'?0:.65,pitch:view==='flat'?1.45:.42,zoom:1,pan:[0,0]});
  select(parts.has('117803_001::P02')?'117803_001::P02':members[0].member_id);
 }catch(error){q('#allocation-dashboard').innerHTML='<p class="update-error">The saved allocation could not be displayed: '+esc(error.message)+'</p>';}
}
start();
