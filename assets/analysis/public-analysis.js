import {memberForcePanel} from './desk-analysis-results.js';
import {compactControls,miniViews,reactionPanel} from './analysis-views.js';
import {escapeText as e,pane} from './desk-trace.js';
import {mount} from './desk-scene.js';

const number=v=>Number.isFinite(v)?v.toLocaleString('en-GB',{maximumFractionDigits:4}):'Unavailable';
const safeAsset=url=>typeof url==='string'&&/^\/assets\/analysis\/[A-Za-z0-9_./-]+$/.test(url)?url:null;
const safeSeller=url=>{try{const u=new URL(url);return u.protocol==='https:'&&(u.hostname==='ewsalvage.com'||u.hostname==='www.ewsalvage.com')?u.href:null;}catch{return null;}};
export function validateSnapshot(scene,model){
 if(scene?.provenance?.binding_valid!==true||model?.provenance?.binding_valid!==true)throw Error('The saved model binding could not be verified.');
 const provenance=scene.provenance,other=model.provenance;
 for(const key of ['project_id','analysis_run_id','geometry_revision','allocation_run_id','source_input_sha256','source_result_sha256','source_presentation_sha256'])if(!provenance[key]||provenance[key]!==other[key])throw Error('The model and numerical result refer to different saved records.');
 if(JSON.stringify(provenance.binding)!==JSON.stringify(other.binding)||provenance.analysis_run_id!==scene.result?.run_id||provenance.allocation_run_id!==scene.result?.allocation_run_id)throw Error('The saved result does not match this model binding.');
 if(scene.status!=='COMPLETED_CONCEPTUAL'||scene.result?.status!=='COMPLETED_CONCEPTUAL')throw Error('A current completed saved result is unavailable.');
 if(!Array.isArray(model.members)||model.members.length!==155||!Array.isArray(scene.input?.load_cases)||scene.input.load_cases.length!==15)throw Error('The saved model or load-case list is incomplete.');
 if(new Set(model.members.map(m=>m.member_id)).size!==model.members.length)throw Error('The saved part identifiers are inconsistent.');
 for(const lc of scene.input.load_cases){const c=scene.result.cases?.[lc];if(!c||!Array.isArray(c.displacements_m)||c.displacements_m.length!==scene.input.nodes.length||!c.member_forces||!Array.isArray(c.reactions))throw Error('Saved numerical data are incomplete for '+lc+'.');}
 return true;
}
export function resolvePart(members,id){return members.find(m=>m.member_id===id)||members.find(m=>m.parent_member_id===id)||null;}
export function sourcePanel(part){
 if(!part)return pane('PART / SAVED SOURCE','<p class="analysis-source-empty">Select a part in the model or a structural member in the force table to inspect its saved source.</p>');
 const appearance=part.appearance||{},texture=safeAsset(appearance.texture),source=safeSeller(part.source||part.source_url||part.seller_url||appearance.source_url||part.trace?.material?.source);
 return pane('PART / SAVED SOURCE',`<div class="analysis-source-grid">${texture?`<a href="${e(texture)}" target="_blank" rel="noopener"><img src="${e(texture)}" alt="Representative source crop for material ${e(part.material_id)}"></a>`:'<div class="tag">Source tone</div>'}<div><p class="analysis-selection"><b>${e(part.parent_member_id||part.member_id)}</b></p><p>Picked part: ${e(part.part_id||part.member_id)}</p><p>Source stock: ${e(part.stock_id||'Not recorded')}<br>Material: ${e(part.material_id||'Not recorded')}</p>${source?`<a href="${e(source)}" target="_blank" rel="noopener">Original seller listing ↗</a>`:''}</div></div><p class="caption">${e(appearance.basis||'Representative appearance from the saved source record.')} Crops are illustrative, not registered textures or material-property evidence.</p>`);
}
export function summaryPanel(scene){
 const r=scene.result,d=r.deformation_diagnostics||{},cases=scene.input.load_cases,forceCount=Object.keys(r.cases[cases[0]]?.member_forces||{}).length;
 return `<p class="analysis-load-case">${e(r.run_id)} · ${e(scene.status)} · saved result</p><div class="analysis-summary-grid"><div><strong>${number(d.maximum_translation_mm)} mm</strong><span>Maximum saved nodal translation</span></div><div><strong>${cases.length} cases</strong><span>Saved service and sensitivity results</span></div><div><strong>${forceCount} members</strong><span>Saved structural internal forces · 155 installed parts</span></div></div><p>${e(d.interpretation||'Maximum nodal translation is not whole-frame drift or a serviceability pass. No structural approval is implied.')}</p>${d.governing_case?`<button type="button" data-analysis-case="${e(d.governing_case)}" data-member="${e(d.governing_member_id)}">Inspect ${e(d.governing_case)} · ${e(d.governing_member_id)}</button>`:''}`;
}
export function notesPanel(scene){
 const r=scene.result,i=scene.input,j=r.physical_joint_review||i.physical_joint_review||{},issues=j.existing_interferences||[],parameters=i.basis?.parameters||[];
 const assumptions=Array.isArray(r.preliminary_assumptions)?r.preliminary_assumptions:Object.values(r.preliminary_assumptions||{});
 const warnings=[...(r.warnings||[]),...assumptions].map(x=>typeof x==='string'?x:JSON.stringify(x));
 return pane('SAVED ASSUMPTIONS / UNRESOLVED JOINTS',`<p>${issues.length} existing brace/backing intersection pairs still need physical joint detailing. Crossing solids do not establish a verified connection, diaphragm or bracing capacity.</p><details class="analysis-joints"><summary>Physical joint issues · ${issues.length} saved pairs</summary>${issues.map(x=>`<p>${(x.members||[]).map(id=>`<button type="button" data-select="${e(id)}">${e(id)}</button>`).join(' × ')}<br>Saved overlap indicator: ${number(x.new_penetration_mm??x.old_penetration_mm)} mm; not a notch depth.</p>`).join('')}<p>Lap/notch or layer-offset details, section reductions, fasteners and connection capacities remain unresolved.</p></details><details><summary>Declared analysis inputs</summary><p>${e(i.basis?.boundary||'Conceptual structural analysis under stated assumptions. No certified grade or structural approval.')}</p><div class="overflow"><table class="table"><thead><tr><th>Input</th><th>Saved value</th><th>Basis</th></tr></thead><tbody>${parameters.map(p=>`<tr><td>${e(p.label)}</td><td>${e(p.value)} ${e(p.unit)}</td><td>${e(p.origin)}<br>${e(p.source)}</td></tr>`).join('')}</tbody></table></div><p>${e(i.basis?.support_note||'')}</p><p>${e(i.basis?.connection_note||'')}</p><p>${e(i.basis?.combination_basis||'')}</p></details><details><summary>Saved limitations and messages · ${warnings.length}</summary>${warnings.map(w=>`<p class="notice">${e(w)}</p>`).join('')}</details><details><summary>Saved numerical checks · ${(r.checks||[]).length}</summary>${(r.checks||[]).map(c=>`<p>${e(c.case||'')} · ${e(c.name)}: ${c.passed?'Passed':'Failed'}</p>`).join('')}<p>Numerical checks do not verify physical connection capacity or certify the building.</p></details><div class="analysis-links"><a href="/second-grain-timber/assets/analysis/analysis.json" download>Download public saved analysis JSON</a><a href="/second-grain-timber/assets/analysis/members.json" download>Download saved display geometry JSON</a></div>`);
}
export function createPublicAnalysis(root,scene,model,mountScene=mount){
 validateSnapshot(scene,model);
 const q=selector=>root.querySelector(selector),members=model.members;
 let lc=scene.input.load_cases.includes('D')?'D':scene.input.load_cases[0],scale=10,showLoads=true,appearance=true,selected=null;
 const viewer=mountScene(q('#analysis-building'),members,{onSelect:select,appearanceReference:members});
 function update(){viewer.update({mode:'assembled',explode:0,selected,appearance,analysis:{...scene,case:lc,scale,showLoads}});q('#analysis-mini-views').innerHTML=miniViews(scene,lc,scale,resolvePart(members,selected));}
 function bindSelection(container){container.querySelectorAll('[data-select]').forEach(button=>button.onclick=()=>select(button.dataset.select));}
 function refreshSelection(){const picked=resolvePart(members,selected);q('#analysis-forces').innerHTML=memberForcePanel(scene,lc,picked);q('#analysis-source').innerHTML=sourcePanel(picked);q('#analysis-reactions').innerHTML=reactionPanel(scene,lc);bindSelection(q('#analysis-forces'));}
 function select(id){const picked=resolvePart(members,id);if(!picked)return;selected=picked.member_id;q('#analysis-detail-panel').open=true;refreshSelection();update();}
 function changeCase(next){if(!scene.input.load_cases.includes(next))return;lc=next;refreshControls();refreshSelection();update();}
 function refreshControls(){
  const box=q('#analysis-controls');box.innerHTML=compactControls(scene,lc);
  const caseInput=box.querySelector('#analysis-case'),slider=box.querySelector('#analysis-scale'),loads=box.querySelector('#show-analysis-loads');
  slider.value=String(scale);loads.checked=showLoads;box.querySelector('#analysis-scale-label').textContent=scale+'×';
  caseInput.onchange=()=>changeCase(caseInput.value);
  slider.oninput=()=>{scale=Number(slider.value);box.querySelector('#analysis-scale-label').textContent=scale+'×';update();};
  loads.onchange=()=>{showLoads=loads.checked;update();};
 }
 q('#analysis-summary').innerHTML=summaryPanel(scene);q('#analysis-notes').innerHTML=notesPanel(scene);bindSelection(q('#analysis-notes'));
 q('#analysis-summary').querySelectorAll('[data-analysis-case]').forEach(button=>button.onclick=()=>{changeCase(button.dataset.analysisCase);select(button.dataset.member);q('#analysis-building').scrollIntoView({block:'nearest'});});
 q('#analysis-reset').onclick=()=>viewer.update({yaw:.65,pitch:.42,zoom:1,pan:[0,0]});
 q('#analysis-appearance').onchange=()=>{appearance=q('#analysis-appearance').checked;update();};
 refreshControls();refreshSelection();update();q('#analysis-view').setAttribute('aria-busy','false');
 return {dispose:()=>viewer.dispose(),select,changeCase,state:()=>({lc,scale,showLoads,appearance,selected})};
}

export async function loadPublicAnalysis(root){
 try{
  const files=['analysis.json','members.json'];
  const [scene,model]=await Promise.all(files.map(async name=>{const response=await fetch(new URL(name,import.meta.url));if(!response.ok)throw Error('Saved file unavailable.');return response.json();}));
  return createPublicAnalysis(root,scene,model);
 }catch(error){
  root.querySelector('#analysis-summary').innerHTML='<p class="analysis-error">The saved analysis could not be displayed. '+e(error.message)+'</p>';
  root.querySelector('#analysis-view').classList.add('analysis-hidden');
  root.querySelector('#analysis-view').setAttribute('aria-busy','false');
  return null;
 }
}
if(typeof document!=='undefined'){const root=document.querySelector('#analysis');if(root)loadPublicAnalysis(root);}
