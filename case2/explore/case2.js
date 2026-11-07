// SECOND GRAIN Case 2. Read-only presentation of source-defined geometry and saved runs.
// No inference, allocation, analysis, session mutation or model calls occur in this module.
import {mountCloud as mountSavedCloud} from './cloud-viewer.js';
import {pointInPolygon,normalizePart,extrudePart,projectScene} from './case2-geometry.js';
export {pointInPolygon,normalizePart,extrudePart,projectScene} from './case2-geometry.js';

import {createPlaybackModel,renderAllocationFrame} from './allocation-playback.js';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = (v, digits = 0) => Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v).toLocaleString('en-US', {maximumFractionDigits:digits}) : 'Unavailable';
const mm = v => `${num(v, 1)} mm`;
const length = v => v == null ? 'Unavailable' : `${num(Number(v) / 1000, 3)} m`;
const text = v => typeof v === 'string' ? v : v == null ? 'Unavailable' : JSON.stringify(v);
const safeURL = v => { if (!v || typeof v !== 'string') return null; try { const u = new URL(v, location.href); return ['http:','https:'].includes(u.protocol) ? u.href : null; } catch { return null; } };
const safeImage = v => typeof v==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v)?v:safeURL(v);
const link = (url, label, cls='') => { const u=safeURL(url); return u ? `<a class="${cls}" href="${esc(u)}" target="_blank" rel="noopener">${esc(label)} ↗</a>` : ''; };
const tag = (label, type='') => `<span class="tag ${type}">${esc(label)}</span>`;
const empty = label => `<div class="empty">${esc(label)}</div>`;
const kv = rows => `<dl class="kv">${rows.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v ?? 'Unavailable')}</dd></div>`).join('')}</dl>`;
const img = (url, alt, cls='') => safeImage(url) ? `<img class="${cls}" loading="lazy" src="${esc(safeImage(url))}" alt="${esc(alt)}">` : '';
const array = v => Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : [];
const first = (...v) => v.find(x => x !== undefined && x !== null);
const sum = (a, f) => a.reduce((n,x)=>n+(Number(f(x))||0),0);
const unique = a => [...new Set(a.filter(x=>x !== undefined && x !== null && x !== ''))];
const briefRows = (v) => Array.isArray(v) ? v : v && typeof v === 'object' ? Object.entries(v).map(([k,v])=>({title:k.replaceAll('_',' '),description:text(v)})) : [];
const list = rows => `<ul class="record-list">${array(rows).map(r=>`<li>${typeof r === 'string' ? esc(r) : `<b>${esc(r.title || r.label || r.code || r.id || '')}</b>${esc(r.description || r.detail || r.reason || r.value || text(r))}`}</li>`).join('')}</ul>`;

let rootBundle, data, parts=[], beforeParts=[], contextParts=[], assignments=[], stocks=[], materials=[], partMap, assignMap, stockMap, matMap, recordEpoch=0;
const state={tab:'assembly',scope:'full',view:'assembled',layout:'after',context:true,focus:true,selected:null,material:null,rib:'all',yaw:.72,pitch:.43,zoom:1,pan:[0,0],progress:1,faces:[],playing:false,appearance:true,allocationPlayback:false,allocationPlaying:false,allocationTime:0};
let canvas,ctx,width=1,height=1,dpr=1,drawFrame=0,animation=0,lastTick=0,cloudCleanup=null;
const textureCache = new Map();
const materialRecords = new Map();
const materialLoads = new Map();
const modelFaceCache = new Map();
let playbackModel=null,playbackLoad=null,playbackAnimation=0,playbackLastTick=null,playbackHits=[],playbackFrame=null;
let verificationRecord=null,verificationLoadState='NOT_LOADED',verificationError='',verificationRequest=0,verificationCanvas,verificationContext,verificationDrawFrame=0,verificationFacesCache=null;
const verification={loadCase:null,strip:null,element:null,node:null,metric:'displacement',deformed:true,scale:50,reactions:false,yaw:1.12,pitch:.53,zoom:1,pan:[0,0],faces:[],elementHits:[],nodeHits:[]};

function playbackTimeLabel(value){const seconds=Math.max(0,Math.floor(Number(value)||0));return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
function syncPlaybackControls(){
  const active=state.allocationPlayback,ready=!!playbackModel;
  $('#allocation-playback-entry').hidden=!rootBundle?.full_scope;
  $('#allocation-video-window').hidden=!data?.full_scope;
  $('#allocation-playback-controls').hidden=!active;
  $('#inspection-toolbar').hidden=active;
  $('#prototype-controls').hidden=active||!adaptationScope()&&!beforeParts.length;
  $('#assembly-reveal-controls').hidden=active;
  $('#scene-label').hidden=active;$('.scene-mark').hidden=active;
  $$('[data-model-mode]').forEach(el=>el.setAttribute('aria-pressed',(el.dataset.modelMode==='allocation')===active?'true':'false'));
  $('#play-allocation').disabled=!ready;$('#replay-allocation').disabled=!ready;$('#allocation-timeline').disabled=!ready;
  $('#play-allocation').textContent=state.allocationPlaying?'Pause':'Play';
  $('#allocation-timeline').max=playbackModel?.durationSeconds||58;
  $('#allocation-timeline').value=state.allocationTime;
  $('#allocation-time').textContent=`${playbackTimeLabel(state.allocationTime)} / ${playbackTimeLabel(playbackModel?.durationSeconds||58)}`;
}
function pauseAllocationPlayback(){state.allocationPlaying=false;playbackLastTick=null;cancelAnimationFrame(playbackAnimation);playbackAnimation=0;$('#play-allocation').textContent='Play';}
async function loadAllocationPlayback(){
  if(playbackModel)return playbackModel;
  if(!playbackLoad)playbackLoad=(async()=>{
    const response=await fetch('./data/allocation-playback-plan.json',{cache:'no-cache'});if(!response.ok)throw Error(`Playback plan returned HTTP ${response.status}`);
    const model=createPlaybackModel(rootBundle,await response.json());
    if(!(model.durationSeconds>0))throw Error('The saved playback duration is unavailable.');
    playbackModel=model;return model;
  })().catch(error=>{playbackLoad=null;throw error;});
  return playbackLoad;
}
async function setModelMode(mode){
  if(mode==='allocation'&&!rootBundle?.full_scope)return;
  pauseAllocationPlayback();stopPlayback();
  if(mode==='allocation'&&state.scope!=='full')setScope('full');
  if(mode==='allocation'){
    state.layout='after';state.rib='all';$('#rib-filter').value='all';
    $$('[data-layout]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.layout==='after'?'true':'false'));updateSelection();
  }
  state.allocationPlayback=mode==='allocation';playbackHits=[];syncPlaybackControls();
  const url=new URL(location.href);if(state.allocationPlayback)url.searchParams.set('playback','allocation');else url.searchParams.delete('playback');history.replaceState(null,'',url);
  if(state.allocationPlayback){
    setTab('assembly');$('#allocation-playback-status').textContent=playbackModel?'Ready · saved full-bench allocation':'Loading the saved allocation playback…';
    try{await loadAllocationPlayback();syncPlaybackControls();scheduleDraw();}catch(error){$('#allocation-playback-status').textContent=`Playback unavailable: ${error.message}`;}
  }else scheduleDraw();
}
function playAllocationPlayback(){
  if(!playbackModel||!state.allocationPlayback)return;
  if(state.allocationPlaying){pauseAllocationPlayback();return;}
  $('#allocation-video')?.pause?.();
  if(state.allocationTime>=playbackModel.durationSeconds)state.allocationTime=0;
  state.allocationPlaying=true;playbackLastTick=null;$('#play-allocation').textContent='Pause';
  const tick=now=>{
    if(!state.allocationPlaying)return;
    if(playbackLastTick!==null)state.allocationTime=Math.min(playbackModel.durationSeconds,state.allocationTime+(now-playbackLastTick)/1000);
    playbackLastTick=now;scheduleDraw();
    if(state.allocationTime>=playbackModel.durationSeconds){pauseAllocationPlayback();syncPlaybackControls();}
    else playbackAnimation=requestAnimationFrame(tick);
  };
  playbackAnimation=requestAnimationFrame(tick);
}
function replayAllocationPlayback(){pauseAllocationPlayback();state.allocationTime=0;syncPlaybackControls();scheduleDraw();playAllocationPlayback();}

function normalize(d) {
  data=d;
  modelFaceCache.clear();
  parts=[...array(d.geometry?.parts),...array(d.geometry?.rails)].map(normalizePart);
  // Rails may already be included among the geometry parts; never duplicate IDs.
  parts=[...new Map(parts.map(p=>[p.part_id,p])).values()];
  const prototypeIDs=new Set(array(d.prototype?.strip_ids).length?d.prototype.strip_ids:parts.map(p=>p.part_id));
  beforeParts=array(first(d.full_scope?.before_geometry?.parts,d.before_geometry?.parts,d.prototype?.before_geometry?.parts)).map(normalizePart);
  const boundaryParts=new Map(array(d.prototype?.boundary_context?.context_parts).map(normalizePart).map(p=>[p.part_id,p]));
  contextParts=d.prototype&&!d.full_scope?array(d.design_intent_geometry?.parts).map(normalizePart).filter(p=>!prototypeIDs.has(p.part_id)).map(p=>({...p,context_only:true})):[];
  contextParts=contextParts.map(p=>({...p,adapted_context:boundaryParts.get(p.part_id)||null}));
  assignments=array(d.allocation?.assignments || d.allocation?.installed_parts);
  stocks=array(d.allocation?.stocks || d.allocation?.cut_bars || d.allocation?.stock_ledger || d.stocks);
  materials=array(d.materials);
  partMap=new Map(parts.map(p=>[p.part_id,p]));
  assignMap=new Map(assignments.map(a=>[String(a.member_id || a.demand_id || a.part_id),a]));
  stockMap=new Map(stocks.map(s=>[String(s.stock_id || s.id),s]));
  matMap=new Map(materials.map(m=>[String(m.material_id || m.id),m]));
  state.selected=parts[0]?.part_id||null;
  state.material=String(materials[0]?.material_id || materials[0]?.id || '');
}

function detailStations(){return array(first(rootBundle?.full_scope?.detail_station_ids,rootBundle?.detail_station_ids,['S039','S040','S041']));}
function displayParts(){return state.scope==='detail'&&data.full_scope?parts.filter(p=>detailStations().includes(p.rib_id)):parts;}
function adaptationScope(){return data.full_scope||data.prototype;}
function scopeLabel(){return state.scope==='prototype'&&rootBundle?.full_scope?'Preserved prototype result':state.scope==='detail'&&data.full_scope?'S039–S041 detail · current full-bench run':data.full_scope?'Full bench · current run':'Prototype result';}

function setScope(scope){
  if(!rootBundle?.full_scope||!['full','detail','prototype'].includes(scope))return;
  const next=scope==='prototype'?rootBundle.preserved_prototype:rootBundle;if(!next?.geometry)return;
  const previous=state.selected,tab=state.tab==='verification'?'assembly':state.tab;
  pauseAllocationPlayback();$('#allocation-video')?.pause?.();state.allocationPlayback=false;playbackHits=[];
  stopPlayback();cloudCleanup?.();cloudCleanup=null;
  if(data!==next){recordEpoch++;materialRecords.clear();materialLoads.clear();textureCache.clear();normalize(next);}
  state.scope=scope;state.rib='all';state.layout='after';state.progress=1;state.focus=true;
  state.selected=displayParts().some(p=>p.part_id===previous)?previous:displayParts()[0]?.part_id||null;
  const material=materialFor(partMap.get(state.selected));if(material)state.material=String(material.material_id||material.id);
  $('#part-bank').innerHTML='';$('#part-search').value='';
  $$('[data-layout]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.layout==='after'?'true':'false'));
  $('#context-overview').setAttribute('aria-pressed','false');$('#context-overview').textContent='Full bench overview';
  fillHeader();fillDownloads();fillBrief();fillEvidence();fillAllocation();fillAnalysis();loadTextures();updateSelection();updateBank();setTab(tab);resetView();
  const url=new URL(location.href);url.searchParams.set('scope',scope);url.searchParams.delete('playback');history.replaceState(null,'',url);
}

function loadTextures(){
  for(const m of materials){
    const a=m.appearance||m.representative_appearance,url=safeImage(first(a?.texture,a?.url)),id=String(m.material_id||m.id);
    if(!url||textureCache.has(id))continue;
    const image=new Image(),entry={image,ready:false,mmPerPixel:Number(a.display_mm_per_pixel)||2};textureCache.set(id,entry);
    image.onload=()=>{entry.ready=true;scheduleDraw();};image.onerror=()=>{entry.ready=false;};image.src=url;
  }
}

function assignment(p){return p?assignMap.get(p.part_id)||null:null;}
function materialFor(p){const a=assignment(p);return matMap.get(String(first(a?.material_id,p?.material_id,stockMap.get(String(a?.stock_id))?.material_id,'')))||null;}
function photo(m){return first(m?.photo_url,m?.source_photo_url,m?.source_photo?.url,m?.photos?.[0]?.url,m?.photos?.[0]?.photo_url,m?.photos?.[0],m?.views?.[0]?.photo?.data);}
function mask(m){return first(m?.mask_url,m?.active_mask_url,m?.evidence?.mask_url,m?.photos?.[0]?.mask_url,m?.views?.[0]?.mask?.data);}
function cloud(m){return first(m?.cloud,m?.point_cloud,m?.evidence?.point_cloud,m?.point_cloud_url);}
function source(m){return first(m?.source_url,m?.seller_url,typeof m?.source==='string'?m.source:m?.source?.url,m?.url);}
function title(m){return first(m?.title,m?.seller_title,m?.source?.title,`Material ${m?.material_id || m?.id || 'unavailable'}`);}
function appearanceCaption(m){
  const a=m?.representative_appearance||m?.appearance||{};
  return unique([first(a.basis,a.label,'Source-derived surface crop.'),array(a.limitations)[0],a.evidence_contribution]).filter(v=>typeof v==='string'&&v.trim()).map(esc).join(' ');
}
function interval(a){return first(a?.source_interval_mm,a?.cut_interval_mm,a?.interval_mm,a?.cut_start_mm!=null?[a.cut_start_mm,a.cut_end_mm]:undefined);}
function geometryID(a){return a?.member_id||a?.demand_id||a?.part_id;}
function readableInterval(v){return Array.isArray(v)&&v.length===2?`${num(v[0],1)}–${num(v[1],1)} mm`:v?.start_mm!=null?`${num(v.start_mm,1)}–${num(v.end_mm,1)} mm`:'Unavailable';}
function runStatus(){return first(data.allocation?.status,data.status?.allocation,'NOT_RUN');}
function statusHTML(s){return tag(String(s),/^(OPTIMAL|COMPLETED|FEASIBLE)/.test(s)?'good':'warn');}
function metric(label,value){return `<div class="metric"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`;}

function fillDownloads(){
  const exports=state.scope==='prototype'&&rootBundle?.full_scope?(rootBundle.full_scope.preserved_prototype_exports||{}):(data.available_exports||{});
  const labels={geometry_json:'Geometry JSON',model_obj:'Assembled model OBJ',member_schedule:'Member schedule',joint_schedule:'Joint schedule'};
  $('#case-downloads').innerHTML='<a href="./data/case2.json" download>All saved case data JSON</a> '+Object.entries(exports).map(([k,v])=>safeURL(v)?`<a href="${esc(v)}" download>${esc(labels[k]||k)}</a>`:'').join(' ');
}

function fillHeader(){
  const meta=data.metadata||{},brief=data.brief||{},summary=data.allocation?.summary||{};
  document.title=`${meta.title || 'Overlap Bench'} — SECOND GRAIN`;
  $('#case-description').textContent=meta.description||brief.description||'A straight-member bench assembled from recorded reclaimed stock. Select a part to follow its source, cut interval and material evidence.';
  $('#case-state').textContent=state.scope==='prototype'&&rootBundle?.full_scope?'Preserved 27-strip prototype allocation · independent historical result.':rootBundle?.full_scope?"Full-bench allocation and preliminary structural analysis completed.":first(meta.design_status,data.status?.design,'Recorded design study').replaceAll('_',' ');
  const dim=first(data.geometry?.dimensions_mm,brief.dimensions_mm,meta.dimensions_mm);
  $('#case-dimensions').textContent=Array.isArray(dim)?`${dim.map(v=>num(v)).join(' × ')} mm`:dim?`${num(first(dim.length,dim.length_mm,dim.y))} × ${num(first(dim.depth,dim.width,dim.width_mm,dim.x))} × ${num(first(dim.height,dim.height_mm,dim.z))} mm`:'';
  if(data.geometry?.dimension_label)$('#case-dimensions').textContent+=' · '+data.geometry.dimension_label;
  $('#case-metrics').innerHTML=[metric('Repeat stations',unique(parts.map(p=>p.rib_id)).length),metric('Geometry parts',parts.length),metric('Assigned / required strips',`${assignments.length} / ${parts.length}`),metric('Source bars used',first(summary.source_bars_used,summary.stock_count,stocks.length)),metric('Allocation',runStatus())].join('');
  $('#model-status').textContent=data.geometry?.geometry_id||'';
  const displayed=displayParts(),ribs=unique(displayed.map(p=>p.rib_id));
  $('#rib-filter').innerHTML='<option value="all">All stations</option>'+ribs.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('')+'<option value="rails">Rails / other members</option>';
  $('#assembly-progress').max=displayed.length;
  $('#assembly-progress').value=displayed.length;
  $('#prototype-controls').hidden=!adaptationScope()&&!beforeParts.length;
  $('#layout-before').disabled=!beforeParts.length;
  $('#show-context').closest('label').hidden=!!data.full_scope;
  $('#context-overview').hidden=!!data.full_scope;
  updateVerificationFooter();
  $('#prototype-summary').hidden=!adaptationScope();
  if(adaptationScope())$('#prototype-summary').innerHTML=prototypeSummary();
  $('#scope-controls').hidden=!rootBundle?.full_scope;
  $$('[data-scope]').forEach(el=>{el.setAttribute('aria-pressed',el.dataset.scope===state.scope?'true':'false');el.disabled=el.dataset.scope==='prototype'&&!rootBundle?.preserved_prototype?.geometry;});
  $('#scope-status').textContent=`${scopeLabel()} · ${data.allocation?.run_id||'No saved allocation run'} · ${displayed.length} strips in the model. ${state.scope==='prototype'&&rootBundle?.full_scope?'Historical geometry, assignments and balances are preserved independently.':state.scope==='detail'&&data.full_scope?'Assignments belong to the current full-bench run; totals and cutting ledgers below cover that entire run.':data.full_scope?'Totals and cutting ledgers cover all required strips in this run.':''}`;
  $('#tab-assembly b').textContent=data.full_scope?'Bench Assembly':'Prototype Assembly';
  syncPlaybackControls();
}

function prototypeSummary(){
  const p=adaptationScope(),b=p.boundary_context||{},internal=array(data.geometry?.joints||data.geometry?.contacts||data.geometry?.connections);
  return `<strong>${data.full_scope?`${esc(scopeLabel())} · ${parts.length} required strips`:`${esc(array(p.station_ids).join(' / '))} · ${parts.length} prototype strips`}</strong><p>${data.full_scope?'Every full-bench strip is part of the current geometry. The detail control focuses the current S039–S041 strips; the preserved prototype control opens its separate historical result.':`${contextParts.length} additional strips provide subdued design context. Only prototype strips have picking, allocation and source tracing.`}</p>${kv([['Reference geometry',p.reference_geometry_id],['Selected section',array(p.selected_section_mm).length?p.selected_section_mm.map(v=>num(v,2)).join(' × ')+' mm':'Unavailable'],['Internal geometric contacts',first(data.full_scope?internal.length:undefined,p.reference_counts?.internal_contacts,p.reference_counts?.internal_contact_count,internal.length||undefined)],['Outside boundary relationships',array(b.relationships).length],['Dimension conversion',typeof p.conversion==='string'?p.conversion:first(p.conversion?.label,p.conversion?.description,'Working design assumption · 100 mm per source unit; not measured')]])}${prototypeAuditHTML(p)}<p class="caption">Geometric contact does not establish connection stiffness or strength. No support condition is inferred from contact alone.</p>`;
}

function prototypeAuditHTML(p){
  const a=p.adaptation||{},before=beforeParts[0]?.source_section_mm,after=p.selected_section_mm,section=v=>array(v).length?v.map(n=>num(n,2)).join(' × ')+' mm':'Unavailable';
  const span=b=>b?.min&&b?.max?`${num(b.max[1]-b.min[1],2)} mm`:'Unavailable';
  const retained=data.full_scope&&a.retained_contact_count!=null?`${num(a.retained_contact_count)} / ${num(a.original_contact_count)} full-bench · ${num(a.previous_prototype_boundaries_resolved)} / ${num(a.previous_prototype_boundary_count)} former prototype boundary`:a.reference_counts&&a.adapted_counts?`${num(a.adapted_counts.internal_contacts)} / ${num(a.reference_counts.internal_contacts)} internal · ${num(a.adapted_counts.boundary_contacts)} / ${num(a.reference_counts.boundary_contacts)} boundary`:'Unavailable';
  const options=array(p.section_options);
  return `<details class="prototype-audit"><summary>Geometry changes & recorded section options</summary><h3>Reference → adapted ${data.full_scope?'bench':'prototype'}</h3>${kv([['Thickness × width',`${section(before)} → ${section(after)}`],['Station pitch',`${before?num(before[0]*2,2)+' mm':'Unavailable'} → ${num(data.geometry?.rib_pitch_mm,2)} mm`],[data.full_scope?'Bench Y span':'Prototype Y span',`${span(a.before_bounds_mm)} → ${span(a.after_bounds_mm)}`],['Maximum corner movement in XZ',`${num(a.maximum_corresponding_corner_movement_xz_mm,2)} mm`],['Maximum centre shift in XZ',`${num(a.maximum_centre_translation_xz_mm,2)} mm`],['Contact relationships retained',retained],['Solid intersections',Array.isArray(a.solid_intersections)?String(a.solid_intersections.length):'Unavailable'],['Geometry audit',a.status],...(a.bounded_placement_repair?[['Recorded placement adjustments',array(a.bounded_placement_repair.movements).length],['Maximum additional translation',a.bounded_placement_repair.maximum_additional_translation_mm!=null?mm(a.bounded_placement_repair.maximum_additional_translation_mm):'Not recorded']]:[])])}<p class="caption">Strip axes and lengths are retained. Width and layer spacing follow the chosen recorded section. ${data.full_scope?'The audit covers the full bench.':'The audit covers the prototype and neighbouring boundary strips.'}</p><h3>Section availability comparison</h3>${options.length?`<div class="table-scroll"><table class="records-table"><thead><tr><th>Section</th><th>Recorded bars</th><th>Usable length</th><th>Availability screen</th><th>Decision</th></tr></thead><tbody>${options.map(o=>`<tr><td>${esc(section(o.section_mm))}</td><td>${num(o.recorded_slot_count)}</td><td>${length(o.recorded_usable_length_mm)}</td><td>${esc(text(o.capacity_screen).replaceAll('_',' '))}</td><td>${tag(text(o.status).replaceAll('_',' '),String(o.status).startsWith('SELECTED')?'good':o.status==='REJECTED'?'warn':'')}</td></tr>`).join('')}</tbody></table></div><p class="caption">Availability screening precedes allocation; only the selected section has the saved assignment shown in this case.</p>`:empty('No alternative section records are included.')}</details>`;
}

function briefDiagram(){
  return `<figure class="overlap-study"><img src="/second-grain-timber/assets/lossless/76c4dfd032b4fbc715c7954b276d6484337c565f8e08445b0750b7cee76ca50c.webp" alt="Approved concept sketch: straight strips stacked by direct broad-face overlap."/><figcaption>Approved construction sketch · straight strips · direct overlap</figcaption></figure>`;
}

function sourceMaterialsHTML(){
  return `<section class="window source-window"><div class="window-title"><strong>SAVED SOURCE MATERIALS</strong></div><div class="window-body"><p>Source-linked material records used by this saved case. Open a material to inspect the usable intervals, photograph, active mask and saved point cloud.</p><div class="source-cards">${materials.length?materials.map(m=>{const id=String(m.material_id||m.id);return `<button type="button" data-open-material="${esc(id)}">${img(photo(m),`Saved material ${id}`)}<span><b>${esc(id)}</b>${esc(title(m))}<small>${assignments.filter(a=>String(a.material_id)===id).length} assigned strips · ${stocks.filter(s=>String(s.material_id)===id).length} parent bars</small></span></button>`;}).join(''):empty('No material assignment is saved for this geometry revision.')}</div></div></section>`;
}

function intervalsText(values){
  const rows=array(values);return rows.length?rows.map(v=>readableInterval(v.interval_mm||v.source_interval_mm||v)).join(' · '):'Not recorded';
}
function usableIntervals(s){return first(s?.usable_intervals_mm,s?.usable_segments,s?.usable_intervals,[]);}
function residualIntervals(s){return first(s?.residual_intervals_mm,s?.residual_intervals,[]);}
function usableFor(a,s){
  const explicit=first(a?.usable_interval_mm,a?.source_usable_interval_mm,a?.usable_segment_interval_mm);if(explicit)return explicit;
  const cut=intervalArray(interval(a));if(!cut)return null;
  return array(usableIntervals(s)).map(v=>intervalArray(v.interval_mm||v.source_interval_mm||v)).find(v=>v&&v[0]<=cut[0]&&v[1]>=cut[1]);
}
function stripTraceHTML(p,a,s){
  const parentCuts=s?stockIntervals(s):[],parentInstalled=parentCuts.filter(c=>partMap.has(geometryID(c))).length;
  const before=beforeParts.find(x=>x.part_id===p.part_id),section=v=>array(v).length?v.map(n=>num(n,2)).join(' × ')+' mm':'Unavailable';
  return `<h3>Source interval & parent accounting</h3>${kv([['Parent produced / installed / surplus cuts',s?`${parentCuts.length} / ${parentInstalled} / ${parentCuts.length-parentInstalled}`:'Not recorded'],['Usable segment ID',first(a?.usable_segment_id,a?.segment_id)],['Usable parent interval',readableInterval(usableFor(a,s))],['Parent residual intervals',intervalsText(first(a?.parent_residual_intervals_mm,residualIntervals(s)))],['Parent residual length',s?.residual_mm!=null?mm(s.residual_mm):'Not recorded'],['Parent kerf loss',s?.kerf_loss_mm!=null?mm(s.kerf_loss_mm):'Not recorded'],['Parent excluded intervals',intervalsText(first(s?.excluded_intervals_mm,s?.excluded_intervals))]])}${s?`<button type="button" class="action-link" data-open-stock="${esc(s.stock_id||s.id)}">Open parent cutting ledger</button>`:''}${adaptationScope()?`<h3>Before / after adaptation</h3>${kv([['Current model view',state.layout==='before'?'Reference layout':'Adapted layout'],['Reference blank length',before?mm(before.blank_length_mm):'Unavailable'],['Adapted blank length',mm(p.blank_length_mm)],['Reference section',section(before?.source_section_mm)],['Adapted section',section(p.source_section_mm)]])}<p class="caption">The saved assignment belongs to the adapted strip. The reference layout is shown for comparison.</p>`:''}`;
}
function usableSegmentsHTML(mid){
  const bars=stocks.filter(s=>String(s.material_id)===String(mid));
  return `<section class="usable-segments"><h3>Saved usable segments</h3><p class="caption">All intervals use original parent-stock millimetres. Missing segment records are shown explicitly. The absence of recorded exclusions does not establish defect-free stock.</p>${bars.length?`<div class="table-scroll"><table class="records-table"><thead><tr><th>Parent stock</th><th>Usable intervals</th><th>Excluded intervals</th><th>Residual intervals</th></tr></thead><tbody>${bars.map(s=>`<tr><td>${esc(s.stock_id||s.id)}</td><td>${esc(intervalsText(usableIntervals(s)))}</td><td>${esc(intervalsText(first(s.excluded_intervals_mm,s.excluded_intervals)))}</td><td>${esc(intervalsText(residualIntervals(s)))}</td></tr>`).join('')}</tbody></table></div>`:empty('No source bars are assigned to this material in the saved run.')}</section>`;
}
function stripScheduleHTML(){
  return `<section class="window"><div class="window-title"><strong>${data.full_scope?'FULL BENCH':'PROTOTYPE'} STRIPS / SAVED ASSIGNMENTS</strong></div><div class="table-scroll"><table class="records-table"><thead><tr><th>Strip</th><th>Material / source stock</th><th>Usable segment</th><th>Cut interval</th><th>Required blank</th></tr></thead><tbody>${parts.map(p=>{const a=assignment(p),s=stockMap.get(String(a?.stock_id));return `<tr><td><button type="button" data-select-part="${esc(p.part_id)}">${esc(p.part_id)}</button></td><td>${esc(a?.material_id||'Unassigned')}<br>${esc(a?.stock_id||'Unassigned')}</td><td>${esc(readableInterval(usableFor(a,s)))}</td><td>${esc(readableInterval(interval(a)))}</td><td>${mm(p.blank_length_mm)}</td></tr>`;}).join('')}</tbody></table></div></section>`;
}
function cutRecordsHTML(){
  const surplus=array(data.allocation?.surplus_parts);
  return `<section class="window source-window"><div class="window-title"><strong>STRAIGHT BLANKS / CUTTING RECORD</strong></div><div class="window-body"><p>${assignments.length} saved installed assignments · ${surplus.length} saved surplus pieces · ${stocks.length?num(sum(stocks,s=>stockIntervals(s).length)):'No recorded'} produced cut pieces. Blank dimensions and source cut intervals define this step.</p><p class="caption">The assembly drawings are dimensional references. They do not specify joint mechanics or an approved construction sequence.</p>${surplus.length?`<h3>Surplus pieces retained</h3>${list(surplus.map(p=>({title:p.part_id||p.id,description:`${p.stock_id||'Parent unavailable'} · ${readableInterval(interval(p))} · ${mm(first(p.used_length_mm,p.length_mm))}`})))}`:''}</div></section>`;
}

function fillBrief(){
  const b=data.brief||{},meta=data.metadata||{};
  const construction=first(b.construction,data.geometry?.construction,data.construction,[]);
  const assumptions=first(b.assumptions,data.assumptions,[]);
  const limits=array(first(b.limitations,data.limitations,[])).map(v=>data.full_scope&&typeof v==='string'?v.replace('No Karamba solve was performed.','Saved R03 preliminary Karamba analysis is completed; connection capacity remains unverified.'):v);
  $('#panel-brief').innerHTML=`${sourceMaterialsHTML()}<div class="brief-grid"><section class="window"><div class="window-title"><strong>DESIGN INTENT / CASE 02</strong></div><div class="window-body"><p class="eyebrow">A CONTINUOUS PROFILE, BUILT FROM DISCRETE PIECES</p><h2>${esc(meta.title||'Overlap Bench')}</h2><p>${esc(b.description||meta.description||'Parallel open frames form the seat and back. Each member has a local grain axis and explicit end joints.')}</p>${briefDiagram()}<div class="workflow-strip">${[['01','Source Materials'],['02','Usable Segments'],['03','Strip Allocation'],['04','Straight Strip Cutting'],['05',data.full_scope?'Bench Assembly':'Prototype Assembly']].map(([n,s])=>`<div><span>${n}</span>${s}</div>`).join('')}</div><p class="caption">The sketch explains the approved overlap method. The interactive model follows the uploaded form; neither is a fabrication record.</p></div></section><section class="window"><div class="window-title"><strong>RECORDED CONSTRUCTION & DECISIONS</strong></div><div class="window-body">${kv([['Project ID',first(meta.project_id,data.project_id)],['Geometry ID',data.geometry?.geometry_id],['Design status',data.full_scope?"Full-bench allocation and preliminary structural analysis completed.":first(meta.design_status,data.status?.design)],['Inventory basis',first(meta.inventory_basis,b.inventory_basis)]])}<p>${link("https://www.placeofassembly.studio/our-work/polymorphic-bench","Construction reference: Polymorphic Bench")}</p><h3>Construction</h3>${array(construction).length?list(briefRows(construction)):empty(typeof construction==='string'?construction:'No construction notes included.')}<h3>Recorded assumptions</h3>${array(assumptions).length?list(briefRows(assumptions)):empty('No additional assumptions included.')}<h3>Scope / retained limitations</h3>${array(limits).length?list(briefRows(limits)):empty('No separate issue list included; structural analysis status is recorded in the footer.')}</div></section></div>`;
}

function partColor(part,kind){
  const sourceColour=materialFor(part)?.appearance?.color;
  if(state.appearance&&/^#[0-9a-f]{6}$/i.test(sourceColour||''))return sourceColour;
  const palette=['#c2ac86','#bba887','#cbb791','#b8a68a','#d0bb96','#baa37f'];
  const index=Number(part.member_index??Number(String(part.rib_id||part.part_id).match(/\d+/)?.[0]||0))%palette.length;
  return kind==='edge'?'#aa9878':palette[index];
}

function paintRepresentative(face,scene){
  if(!state.appearance||face.kind==='edge')return;
  const material=materialFor(face.part),texture=textureCache.get(String(material?.material_id||material?.id));
  if(!texture?.ready)return;
  const t=face.part.source_coordinate_transform;
  const long=state.view==='flat'?[1,0,0]:(t?.longitudinal_direction||[1,0,0]);
  const across=state.view==='flat'?[0,1,0]:(t?.width_direction||[0,0,1]);
  const centre=[0,1,2].map(i=>sum(face.vertices,v=>v[i])/face.vertices.length);
  const unit=texture.mmPerPixel,w=texture.image.width*unit,h=texture.image.height*unit;
  const corner=centre.map((v,i)=>v-long[i]*w/2+across[i]*h/2);
  const p=scene.project(corner),u=scene.project(corner.map((v,i)=>v+long[i]*unit)),v=scene.project(corner.map((v,i)=>v-across[i]*unit));
  ctx.save();ctx.clip();ctx.transform(u[0]-p[0],u[1]-p[1],v[0]-p[0],v[1]-p[1],p[0],p[1]);ctx.globalAlpha=.9;ctx.drawImage(texture.image,0,0);ctx.restore();
}

function modelFaces(){
  const cacheKey=[state.scope,state.view,state.layout,state.rib,state.context].join('|');
  if(modelFaceCache.has(cacheKey))return modelFaceCache.get(cacheKey);
  const active=state.layout==='before'&&beforeParts.length?beforeParts:parts;
  const detail=state.scope==='detail'&&data.full_scope?new Set(detailStations()):null;
  const visible=active.filter(p=>(!detail||detail.has(p.rib_id))&&(state.rib==='all'||state.rib==='rails'&&!p.rib_id||p.rib_id===state.rib));
  const ribs=unique(parts.map(p=>p.rib_id)), ribIndex=new Map(ribs.map((r,i)=>[r,i]));
  const out=[];
  let gridX=0,gridY=0,rowH=0;
  const maxWidth=Math.max(1200,Math.sqrt(sum(visible,p=>p.valid_geometry?(Math.max(...p.polygon_xz_mm.map(v=>v[0]))-Math.min(...p.polygon_xz_mm.map(v=>v[0]))+80)*(Math.max(...p.polygon_xz_mm.map(v=>v[1]))-Math.min(...p.polygon_xz_mm.map(v=>v[1]))+70):0))*1.55);
  for(const p of visible){
    let offset=[0,0,0];
    if(state.view==='flat'&&p.valid_geometry){
      const poly=p.polygon_blank_uv_mm||p.polygon_xz_mm,w=Math.max(...poly.map(v=>v[0]))-Math.min(...poly.map(v=>v[0])),h=Math.max(...poly.map(v=>v[1]))-Math.min(...poly.map(v=>v[1]));
      if(gridX+w>maxWidth&&gridX>0){gridX=0;gridY+=rowH+85;rowH=0;}
      offset=[gridX,gridY,0];gridX+=w+80;rowH=Math.max(rowH,h);
    }else if(state.view==='exploded'){
      const i=ribIndex.get(p.rib_id),course=Number(first(p.course_index,p.course,p.layer,String(p.course_id||'').match(/\d+/)?.[0],0));
      offset=[0,i!=null?(i-(ribs.length-1)/2)*95:0,i!=null?course*32:160];
    }
    out.push(...extrudePart(p,offset,state.view==='flat'));
  }
  if(state.context&&state.view==='assembled'&&state.rib==='all')for(const p of contextParts){const display=state.layout==='after'&&p.adapted_context?{...p.adapted_context,context_only:true}:p;out.push(...extrudePart(display));}
  modelFaceCache.set(cacheKey,out);return out;
}


function scheduleDraw(){if(!drawFrame)drawFrame=requestAnimationFrame(()=>{drawFrame=0;draw();});}
function draw(){
  if(!ctx||state.tab!=='assembly')return;
  const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
  dpr=Math.min(window.devicePixelRatio||1,2);width=r.width;height=r.height;
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  if(state.allocationPlayback){
    state.faces=[];
    if(playbackModel){
      try{
        playbackFrame=renderAllocationFrame(ctx,width,height,playbackModel,state.allocationTime,{textures:state.appearance?textureCache:new Map()});
        playbackHits=array(playbackFrame?.hitTargets).filter(hit=>partMap.has(hit.memberId)&&Array.isArray(hit.polygon));
        const focused=array(playbackFrame?.focusedMemberIds),stock=playbackFrame?.focusedStockId;
        $('#allocation-playback-status').textContent=`${text(playbackFrame?.stage).replaceAll('_',' ')}${stock?' · Parent stock '+stock:''} · ${num(playbackFrame?.installedCount)} / ${parts.length} installed strips${focused.length?' · '+focused.join(', '):''}`;
        syncPlaybackControls();
      }catch(error){pauseAllocationPlayback();$('#allocation-playback-status').textContent=`Playback unavailable: ${error.message}`;}
    }
    return;
  }
  const gradient=ctx.createLinearGradient(0,0,0,height);gradient.addColorStop(0,'#efebdf');gradient.addColorStop(1,'#d3d0bb');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
  // Faint ground grid is a display aid, not analytical supports.
  ctx.strokeStyle='#92967e25';ctx.lineWidth=.7;
  for(let i=0;i<width+height;i+=55){ctx.beginPath();ctx.moveTo(i-height,height);ctx.lineTo(i,0);ctx.stroke();}
  const faces=modelFaces(),scene=projectScene(faces,{w:width,h:height},{...state,fitPartIDs:data.prototype&&state.focus?parts.map(p=>p.part_id):null}),count=Math.round(state.progress*displayParts().length),shown=new Set(displayParts().slice(0,count).map(p=>p.part_id));
  const displayFaces=scene.faces.filter(f=>f.part.context_only||shown.has(f.part.part_id));
  state.faces=displayFaces.filter(f=>!f.part.context_only);
  const selectedStock=assignment(partMap.get(state.selected))?.stock_id;
  for(const f of displayFaces){
    const selected=f.part.part_id===state.selected,sameStock=selectedStock&&assignment(f.part)?.stock_id===selectedStock;
    ctx.beginPath();f.points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();
    if(f.part.context_only){ctx.fillStyle='rgba(171,173,155,.22)';ctx.fill();ctx.strokeStyle='rgba(111,119,100,.19)';ctx.lineWidth=.45;ctx.stroke();continue;}
    ctx.fillStyle=partColor(f.part,f.kind);ctx.fill();
    paintRepresentative(f,scene);
    const dark=Math.max(0,.17-.16*(f.normal[0]*.3-f.normal[1]*.4+f.normal[2]*.8));ctx.fillStyle=`rgba(40,33,20,${dark})`;ctx.fill();
    if(selected||sameStock){ctx.fillStyle=selected?'rgba(205,102,39,.35)':'rgba(165,114,52,.15)';ctx.fill();}
    ctx.strokeStyle=selected?'#994c33':sameStock?'#9a7546':'#675f4d';ctx.lineWidth=selected?1.7:Math.min(.75,Math.max(.35,scene.scale*.6));ctx.stroke();
  }
  if(!faces.length){ctx.fillStyle='#596149';ctx.font='14px Segoe UI';ctx.textAlign='center';ctx.fillText('No geometry is recorded for this selection.',width/2,height/2);}
  if(state.selected){const f=state.faces.findLast(f=>f.part.part_id===state.selected);if(f){const x=sum(f.points,p=>p[0])/f.points.length,y=sum(f.points,p=>p[1])/f.points.length;ctx.font='10px Consolas,monospace';const tw=ctx.measureText(state.selected).width+14;ctx.fillStyle='#313a2f';ctx.fillRect(x-tw/2,y-12,tw,19);ctx.fillStyle='#f7edd5';ctx.textAlign='left';ctx.fillText(state.selected,x-tw/2+7,y+1);}}
  $('#assembly-count').textContent=`${count} / ${displayParts().length}`;
  $('#scene-label').textContent=`${state.view==='flat'?'Laid-flat strips':state.view==='exploded'?'Exploded strips':'Assembled strips'} · ${state.faces.length?unique(state.faces.map(f=>f.part.part_id)).length:0} selectable · ${adaptationScope()?(state.layout==='before'?'Reference layout':'Adapted layout')+' · ':''}${state.appearance&&[...textureCache.values()].some(t=>t.ready)?'Representative Appearance':'diagram colours'}${displayFaces.length>state.faces.length?' · Full bench context':''}`;
}

function setSelected(id,scroll=false){
  if(!partMap.has(id))return;
  if(state.allocationPlayback)pauseAllocationPlayback();
  if(state.scope==='detail'&&!displayParts().some(p=>p.part_id===id))setScope('full');
  state.selected=id;
  const m=materialFor(partMap.get(id));if(m)state.material=String(m.material_id||m.id);
  updateSelection();updateBank();scheduleDraw();
  $$('.stock-row').forEach(el=>el.classList.toggle('selected',el.dataset.stock===String(assignment(partMap.get(id))?.stock_id)));
  if(scroll){setTab('assembly');$('#selection-panel').scrollIntoView({behavior:'smooth',block:'nearest'});}
}

function updateSelection(){
  const p=partMap.get(state.selected),a=assignment(p),m=materialFor(p),s=stockMap.get(String(a?.stock_id));
  if(!p)return;
  const poly=p.polygon_xz_mm||[],width=poly.length?Math.max(...poly.map(v=>v[0]))-Math.min(...poly.map(v=>v[0])):null,height=poly.length?Math.max(...poly.map(v=>v[1]))-Math.min(...poly.map(v=>v[1])):null;
  const cut=interval(a),sid=a?.stock_id,mid=first(a?.material_id,m?.material_id,p.material_id);
  const rep=first(m?.representative_appearance?.url,m?.appearance?.url,m?.appearance?.texture);
  $('#selection-panel').innerHTML=`<div class="window-title"><strong>FOLLOW A PIECE</strong></div><div class="window-body"><p class="eyebrow">${esc(p.rib_id||'TRANSVERSE MEMBER')} / ${esc(p.role.replaceAll('_',' '))}</p><h2>${esc(p.part_id)}</h2>${a?tag('Saved allocation','good'):tag('No saved assignment','warn')}${kv([['Installed piece ID',a?.part_id],['Material ID',mid],['Source stock ID',sid],['Original-stock cut interval',readableInterval(cut)],[adaptationScope()?'Required straight blank length':'Illustrative blank length',first(a?.used_length_mm,a?.length_mm)!=null?mm(first(a?.used_length_mm,a?.length_mm)):p.blank_length_mm!=null?mm(p.blank_length_mm):'Unavailable'],[adaptationScope()?'Adapted strip section':'Illustrative display section',p.source_section_mm?`${p.source_section_mm.map(v=>num(v,2)).join(' × ')} mm`:'Unavailable'],[adaptationScope()?'Finished strip length':'Illustrative strip length',mm(p.finished_profile_longitudinal_extent_mm)],['Geometry envelope',width!=null?`${num(width,1)} × ${num(height,1)} × ${num(p.thickness_mm,1)} mm`:'Unavailable'],['Source mesh component',p.source_component_index],['Dimension basis',adaptationScope()?'Working design assumption · 100 mm per source unit; not measured':'Display scale; source units unconfirmed']])}${stripTraceHTML(p,a,s)}<h3>Source Evidence</h3>${m?`${tag('Seller-reported','seller')}<p>${esc(title(m))}</p>${photo(m)?`<a class="source-photo" href="${esc(safeURL(photo(m)))}" target="_blank" rel="noopener">${img(photo(m),`Saved source photograph for material ${mid}`)}</a>`:empty('Source photograph unavailable in this export.')}${link(source(m),'Original seller listing','action-link')}<button id="inspect-material" type="button" class="action-link">Inspect mask & points</button>`:empty('No material record is linked to this part.')}<h3>Representative Appearance</h3>${rep?`${img(rep,`Source-derived representative appearance for ${mid}`)}<p class="caption">${appearanceCaption(m)}</p>`:'<p class="caption">The model uses diagram colours. Source photographs are shown separately; no scanned UV correspondence is claimed.</p>'}<p class="caption">Direct broad-face overlap. No added node or hardware geometry.</p>${p.fabrication_note?`<h3>Fabrication</h3><p class="caption">${esc(p.fabrication_note)}</p>`:''}</div>`;
  $('#inspect-material')?.addEventListener('click',()=>{setTab('evidence');fillEvidenceDetail();});
}

function updateBank(){
  const q=$('#part-search').value.trim().toLowerCase();
  const selected=$('.part-bank .selected');selected?.classList.remove('selected');
  if(!$('#part-bank').childElementCount){$('#part-bank').innerHTML=displayParts().map(p=>{const a=assignment(p);return `<button type="button" data-part="${esc(p.part_id)}"><b>${esc(p.part_id)}</b><span>${esc(p.rib_id||p.role)} · ${esc(a?.stock_id||'Unassigned')}</span></button>`;}).join('');}
  $$('#part-bank button').forEach(el=>{const p=partMap.get(el.dataset.part),a=assignment(p);el.hidden=q&&!`${p.part_id} ${p.rib_id} ${p.role} ${a?.stock_id} ${a?.material_id}`.toLowerCase().includes(q);el.classList.toggle('selected',p.part_id===state.selected);el.setAttribute('aria-pressed',p.part_id===state.selected?'true':'false');});
}

function fillEvidence(){
  $('#panel-evidence').innerHTML=`<div class="evidence-grid"><aside class="window"><div class="window-title"><strong>ASSIGNED MATERIAL SOURCES</strong></div><div class="material-list">${materials.length?materials.map(m=>`<button type="button" data-material="${esc(m.material_id||m.id)}">${img(photo(m),`Material ${m.material_id||m.id}`)}<span><strong>${esc(m.material_id||m.id)}</strong><small>${esc(title(m))}</small></span></button>`).join(''):empty('No material sources included.')}</div></aside><section id="material-detail" class="window"></section></div>`;
  fillEvidenceDetail();
}

async function loadMaterialRecord(m){
  const id=String(m.material_id||m.id),url=safeURL(m.record_url),epoch=recordEpoch;
  if(!url||materialRecords.has(id)||materialLoads.has(id))return;
  const task=(async()=>{
    const r=await fetch(url);if(!r.ok)throw Error(`HTTP ${r.status}`);
    const rec=/\.gz(?:\?|$)/.test(url)?await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json():await r.json();
    if(epoch!==recordEpoch)return;
    materialRecords.set(id,rec);
    if(state.material===id&&state.tab==='evidence')fillEvidenceDetail();
  })();materialLoads.set(id,task);
  task.catch(err=>{if(epoch===recordEpoch&&state.material===id&&$('#evidence-record-status'))$('#evidence-record-status').textContent=`Saved detail record could not be opened: ${err.message}. The source summary remains available.`;});
}

function sellerFields(seller,m){
  if(!seller)return kv([['Category',first(m.category,m.seller_category)],['Grade claim',first(m.seller_grade,m.grade)],['Species claim',first(m.species,m.seller_species)],['Dimensions',first(m.dimensions_text,m.dimensions?text(m.dimensions):undefined)]]);
  return `${seller.description?`<p class="source-notice">${esc(seller.description)}</p>`:''}${kv([['Categories',array(seller.categories).join(' · ')||'Unavailable'],['Named grade claims',array(seller.grade_claims).map(text).join(' · ')||'None recorded'],['Seller-described roles',array(seller.roles).map(r=>typeof r==='string'?r:r.role).join(' · ')||'None explicitly recorded'],['Quantity',first(seller.quantity?.piece_count,seller.quantity?.value,m.quantity)],['Quantity basis',first(seller.quantity?.physical_count_status,m.quantity_basis)],['Dimension basis',seller.dimension_note]])}`;
}

function estimatedFields(estimate,m){
  const candidates=array(m.preliminary?.potential_roles||m.preliminary?.dimensional_hypotheses);
  const pct=first(estimate?.estimated_surface_coverage,m.estimated_coverage_pct,m.evidence?.estimated_coverage_pct);
  const rolesHTML=candidates.length ? '<h4>Potential roles / dimensional hypotheses</h4>'+candidates.map(r=>`<p>${tag(r.role,'estimated')}<span class="caption">${esc(r.reason)}</span></p>`).join('') : '';
  return `${estimate?.reason?`<p class="estimated-notice">${esc(estimate.reason)}</p>`:''}${kv([['Assessment',first(estimate?.assessment,estimate?.condition)],['Estimated surface coverage',pct!=null?`${num(pct,1)}%`:'Unavailable'],['Supported proxy faces',first(estimate?.supported_faces,m.supported_faces)]])}${rolesHTML}`;
}

function fillEvidenceDetail(){
  cloudCleanup?.();cloudCleanup=null;
  const summary=matMap.get(state.material)||materials[0];if(!summary){$('#material-detail').innerHTML=empty('Material evidence is unavailable.');return;}
  const record=materialRecords.get(String(summary.material_id||summary.id));
  const m=record?{...record,...summary,cloud:record.cloud,atlas:record.atlas,views:record.views,preliminary:record.preliminary}:summary;
  state.material=String(m.material_id||m.id);
  $$('.material-list button').forEach(el=>el.classList.toggle('selected',el.dataset.material===state.material));
  const c=cloud(m),mid=m.material_id||m.id,estimate=first(m.estimated,m.preliminary?.estimated,m.estimated_assessment),seller=first(m.seller_reported,m.preliminary?.seller,m.preliminary?.seller_reported),e=m.evidence||{};
  const used=assignments.filter(a=>String(a.material_id)===String(mid));
  const cloudLink=typeof c==='string'?c:first(c?.url,c?.viewer_url,e.cloud_viewer_url);
  const pointData=Array.isArray(c)?c:first(c?.points,c?.points_xyz,c?.xyz);
  const atlas=first(m.atlas_url,e.atlas_url,m.photo_evidence_atlas_url,m.atlas?.data),crop=first(m.representative_appearance?.url,m.appearance?.url,m.appearance?.texture);
  $('#material-detail').innerHTML=`<div class="window-title"><strong>SOURCE → MASK → POINTS → INTERPRETATION</strong></div><div class="window-body"><div class="section-heading"><div><p class="eyebrow">MATERIAL ${esc(mid)}</p><h2>${esc(title(m))}</h2>${link(source(m),'Original seller listing','action-link')}</div>${tag(`${used.length} assigned parts`)}</div>${usableSegmentsHTML(mid)}<div class="evidence-tiles"><figure class="evidence-tile">${photo(m)?img(photo(m),`Saved seller photograph for ${mid}`):empty('Source photograph unavailable.')}<figcaption><b>Source Evidence / Seller photograph</b>Original source-linked photo; no new model inference.</figcaption></figure><figure class="evidence-tile">${mask(m)?img(mask(m),`Active saved material mask for ${mid}`):empty('Active mask unavailable in this export.')}<figcaption><b>Source Evidence / Active mask</b>${esc(first(e.mask_status,m.mask_status,'Saved segmentation; view selection remains recorded.'))}</figcaption></figure><figure class="evidence-tile">${pointData||cloudLink||record?.cloud?'<canvas id="material-cloud" tabindex="0" aria-label="Saved estimated point cloud. Drag to orbit."></canvas>':empty('Saved point cloud unavailable.')}<figcaption><b>VGGT_ESTIMATED / Point cloud</b><span id="cloud-caption">${esc(first(e.cloud_status,m.reconstruction_status,'Saved reconstruction evidence; not a measured whole-item model.'))}</span>${cloudLink?`<br>${link(cloudLink,'Open saved cloud data')}`:''}</figcaption></figure><figure class="evidence-tile">${atlas?img(atlas,`Saved observed surface atlas for ${mid}`):crop?img(crop,`Source-derived representative crop for ${mid}`):empty('Surface atlas / usable crop unavailable.')}<figcaption><b>${atlas?'Source Evidence / Observed surfaces':'Representative Appearance'}</b>${atlas?'Transparent or unobserved regions remain unobserved.':'A source-derived crop is illustrative appearance, not a registered whole-object texture.'}</figcaption></figure></div><div class="two-columns"><div><h3>${tag('Seller-reported','seller')}</h3>${sellerFields(seller,m)}</div><div><h3>${tag('Estimated','estimated')}</h3>${estimatedFields(estimate,m)}</div></div><p class="caption">Preliminary grading for design exploration; structural verification is handled separately.</p>${m.limitations?list(m.limitations):''}<p id="evidence-record-status" class="caption">${record?'Complete saved evidence record loaded.':m.record_url?'Loading the complete saved evidence record…':''}</p><h3>Linked installed parts</h3><div class="stock-labels">${used.map(a=>`<button type="button" class="action-link" data-select-part="${esc(geometryID(a))}">${esc(geometryID(a))}</button>`).join('')||empty('No assigned parts from this listing in the saved run.')}</div></div>`;
  if(record?.views?.length){
    const views=record.views;
    $('.evidence-tiles').insertAdjacentHTML('beforebegin',`<label class="caption">Saved photograph / active mask pair <select id="evidence-view">${views.map((v,i)=>`<option value="${i}">View ${esc(v.view_id)} · ${esc(v.effective_mask_status||'Mask status unavailable')}</option>`).join('')}</select></label>`);
    const updateView=()=>{const v=views[Number($('#evidence-view').value)];const tiles=$$('.evidence-tile');const p=v.photo?.data,m=v.mask?.data;if(p){const node=$('img',tiles[0]);if(node)node.src=safeImage(p);}if(m){const node=$('img',tiles[1]);if(node)node.src=safeImage(m);}$('.evidence-tile:first-child figcaption').innerHTML=`<b>Source Evidence / Seller photograph · ${esc(v.view_id)}</b>${esc(v.image_id)} · saved source pixels. <span class="caption">${esc(v.photo?.transform||'')}</span>`;$('.evidence-tile:nth-child(2) figcaption').innerHTML=`<b>Source Evidence / Active mask · ${esc(v.view_id)}</b>${esc(v.effective_mask_status||'Unavailable')} · active candidate ${esc(v.active_candidate_id??'unavailable')}. Original status: ${esc(v.original_mask_status||'unavailable')}.`;};
    $('#evidence-view').value=String(Math.max(0,views.findIndex(v=>String(v.view_id)===String(m.view_id))));
    $('#evidence-view').addEventListener('change',updateView);updateView();
  }
  if($('#material-cloud')&&record?.cloud?.proxy){
    const el=$('#material-cloud');
    el.insertAdjacentHTML('afterend',`<div class="cloud-controls"><label><input id="cloud-box" type="checkbox" checked> Observed proxy</label><label><input id="cloud-colour" type="checkbox"> Colour by view</label><select id="cloud-filter" aria-label="Point-cloud view"><option value="all">All saved views</option>${Object.entries(record.cloud.view_labels||{}).map(([k,v])=>`<option value="${esc(k)}">${esc(v)}</option>`).join('')}</select><button id="cloud-reset" type="button">Reset</button></div>`);
    cloudCleanup=mountSavedCloud(el,record.cloud,{box:$('#cloud-box'),color:$('#cloud-colour'),filter:$('#cloud-filter'),reset:$('#cloud-reset')});
    $('#cloud-caption').textContent=`${num(record.cloud.points.length)} saved display points · ${record.evidence_status || 'VGGT_ESTIMATED'} · uncalibrated scene units.`;
  }else if($('#material-cloud')) cloudCleanup=mountCloud($('#material-cloud'),pointData,cloudLink,c?.colors||c?.rgb);
  if(!record)loadMaterialRecord(summary);
}

function mountCloud(el,points,url,colors){
  let alive=true,yaw=-.5,pitch=.3,start=null,p=[];
  function drawCloud(){if(!alive)return;const r=el.getBoundingClientRect();if(!r.width)return;el.width=Math.round(r.width*1.5);el.height=Math.round(r.height*1.5);const c=el.getContext('2d');c.scale(1.5,1.5);c.fillStyle='#303b33';c.fillRect(0,0,r.width,r.height);if(!p.length){c.fillStyle='#efe4cd';c.font='12px Segoe UI';c.fillText('Point data unavailable in this format.',16,30);return;}const cs=Math.cos(yaw),sn=Math.sin(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch),v=p.map((q,i)=>{const a=q[0]*cs-q[1]*sn,b=q[0]*sn+q[1]*cs;return [a,b*sp-q[2]*cp,b*cp+q[2]*sp,i];});let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;for(const q of v){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);}const s=Math.min(r.width*.88/(x1-x0||1),r.height*.85/(y1-y0||1));v.sort((a,b)=>a[2]-b[2]);for(const q of v){let rgb=colors?.[q[3]];if(rgb?.length>=3){const mul=Math.max(...rgb.slice(0,3))<=1?255:1;rgb=rgb.map(v=>Math.round(v*mul));c.fillStyle=`rgb(${rgb.slice(0,3).join(',')})`;}else c.fillStyle='#cbb690';c.fillRect(r.width/2+(q[0]-(x0+x1)/2)*s,r.height/2+(q[1]-(y0+y1)/2)*s,1.5,1.5);}}
  function setPoints(raw){let rows=raw;if(Array.isArray(raw)&&typeof raw[0]==='number')rows=Array.from({length:Math.floor(raw.length/3)},(_,i)=>raw.slice(i*3,i*3+3));p=array(rows).map(v=>Array.isArray(v)?v.slice(0,3):v?.xyz).filter(v=>v?.length===3&&v.every(Number.isFinite));if(alive&&$('#cloud-caption'))$('#cloud-caption').textContent=`${num(p.length)} saved display points · VGGT_ESTIMATED · drag to orbit. Source sample only; no reconstruction rerun.`;drawCloud();}
  el.addEventListener('pointerdown',e=>{start=[e.clientX,e.clientY,yaw,pitch];el.setPointerCapture(e.pointerId);});el.addEventListener('pointermove',e=>{if(start){yaw=start[2]+(e.clientX-start[0])*.008;pitch=Math.max(-1.3,Math.min(1.3,start[3]+(e.clientY-start[1])*.008));drawCloud();}});el.addEventListener('pointerup',()=>start=null);el.addEventListener('pointercancel',()=>start=null);
  const ro=new ResizeObserver(drawCloud);ro.observe(el);
  if(points)setPoints(points);else if(url&&/\.(json|json\.gz)(\?|$)/i.test(url))fetch(safeURL(url)).then(async r=>{if(!r.ok)throw Error(`HTTP ${r.status}`);if(url.includes('.gz')){if(!globalThis.DecompressionStream)throw Error('Gzip display unsupported');return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json();}return r.json();}).then(j=>{if(!alive)return;const cl=j.point_cloud||j.cloud||j;colors=first(cl.colors,cl.rgb,j.colors,colors);setPoints(first(cl.points,cl.xyz,cl.points_xyz,Array.isArray(j)?j:[]));}).catch(()=>{if(alive){drawCloud();$('#cloud-caption').textContent='Saved cloud link is available; this export does not contain a directly readable point array.';}});else drawCloud();
  return ()=>{alive=false;ro.disconnect();};
}

function balanceValues(){const s=data.allocation?.summary||{};return [
  ['Installed blanks',first(s.installed_length_mm,s.used_length_mm,s.total_used_length_mm),'#80936c'],
  ['Surplus cut parts',first(s.surplus_length_mm,s.surplus_cut_length_mm),'#ad9d74'],
  ['Residual',first(s.residual_length_mm,s.residual_mm),'#cbc09b'],
  ['Kerf',first(s.kerf_length_mm,s.kerf_loss_mm,s.kerf_mm),'#b17449'],
  ['Defect exclusion',first(s.defect_trim_loss_mm,s.defect_loss_mm),'#9e5240']
];}

function volumeBalanceHTML(){
  const v=data.allocation?.summary?.volume;if(!v)return '';
  const entries=[['Finished members',v.finished_contour_mm3,'#738762'],[adaptationScope()?'Additional machining loss':'End-cut removal',v.contour_removal_mm3,'#c28a52'],['Surplus cut blanks',v.surplus_cut_blank_mm3,'#a79c73'],['Crosscut kerf',v.crosscut_kerf_mm3,'#9b6545'],['Residual',v.residual_mm3,'#c5ba95'],['Recorded prior end loss',v.prior_end_loss_mm3,'#985649']].filter(r=>r[1]!=null);
  const total=sum(entries,r=>r[1]),denominator=Number(v.selected_stock_mm3)||total;if(!(denominator>0))return '';
  const r=57,circ=2*Math.PI*r;let offset=0;
  const arcs=entries.map(([label,value,color])=>{const len=value/denominator*circ;const el=`<circle cx="85" cy="85" r="57" fill="none" stroke="${color}" stroke-width="24" stroke-dasharray="${len} ${circ}" stroke-dashoffset="${-offset}" transform="rotate(-90 85 85)"><title>${esc(label)}: ${num(value/1e9,4)} m³</title></circle>`;offset+=len;return el;}).join('');
  return `<section class="window volume-window"><div class="window-title"><strong>SELECTED STOCK / VOLUME BALANCE</strong></div><div class="window-body volume-layout"><svg viewBox="0 0 170 170" role="img" aria-label="Selected stock volume, finished members and fabrication losses"><circle cx="85" cy="85" r="57" fill="none" stroke="#d7cdb3" stroke-width="24"/>${arcs}<text x="85" y="81" text-anchor="middle" font-family="Consolas,monospace" font-size="17" fill="#42463a">${num(denominator/1e9,3)}</text><text x="85" y="102" text-anchor="middle" font-size="10" fill="#696957">m³ selected stock</text></svg><div><h3>${adaptationScope()?'Count the straight strips, kerf and remaining stock.':'Count the finished form and the removed wood.'}</h3><div class="volume-legend">${entries.map(([label,value,color])=>`<div><span style="--key:${color}">${esc(label)}</span><b>${num(value/1e9,4)} m³</b><small>${num(value/denominator*100,1)}%</small></div>`).join('')}</div><p class="caption">Every fraction uses selected stock volume as the denominator. Installed rectangular blanks are an intermediate quantity and are not counted again. Untouched inventory is separate.</p>${Math.abs(total-denominator)>Math.max(1,denominator*1e-6)?`<p class="notice">The exported volume flows differ from selected stock by ${num((denominator-total)/1e9,5)} m³. Check the saved ledger before interpreting utilisation.</p>`:''}</div></div></section>`;
}

function fillAllocation(){
  const a=data.allocation||{},s=a.summary||{},values=balanceValues(),available=values.filter(r=>r[1]!=null),total=sum(available,r=>r[1]);
  const roles=[...new Set(parts.map(p=>p.role))].map(role=>[role,parts.filter(p=>p.role===role&&assignMap.has(p.part_id)).length]);
  const max=Math.max(1,...roles.map(r=>r[1])),assumptions=first(a.assumptions,a.constraints,[]);
  $('#panel-allocation').innerHTML=`<section class="window"><div class="window-title"><strong>ORIGINAL MILP / CURRENT CASE RECORD</strong></div><div class="window-body"><div class="section-heading"><div><h2>Stock becomes a set of parts.</h2><p>Every displayed assignment comes from the saved Case 2 result. Unassigned geometry remains explicitly unassigned.</p></div>${statusHTML(runStatus())}</div>${kv([['Run ID',a.run_id],['Solver',first(a.solver,a.engine)],['Formulation',first(a.formulation,a.formulation_version)],['Inventory basis',first(a.inventory_basis,data.metadata?.inventory_basis)],['Installed / required strips',`${assignments.length} / ${parts.length}`],['Produced cut pieces',stocks.length?sum(stocks,s=>stockIntervals(s).length):'Not recorded'],['Surplus cut pieces',array(a.surplus_parts).length],['Untouched compatible bars',a.summary?.untouched_compatible_stock_count]])}${a.note?`<p class="notice">${esc(a.note)}</p>`:''}<details><summary>Active allocation assumptions</summary>${array(assumptions).length?list(briefRows(assumptions)):empty('No assumptions record included.')}</details></div></section><div class="charts-grid" style="margin-top:18px"><section class="window"><div class="window-title"><strong>SELECTED STOCK / LENGTH BALANCE</strong></div><div class="window-body">${total>0?`<div class="balance" role="img" aria-label="Recorded selected-stock length balance">${available.map(([k,v,c])=>`<span style="width:${v/total*100}%;background:${c}" title="${esc(k)}: ${length(v)}"></span>`).join('')}</div><div class="legend">${available.map(([k,v,c])=>`<span style="--key:${c}">${esc(k)} · ${length(v)}</span>`).join('')}</div>`:empty('A complete numeric length balance is not included.')}<p class="caption">${adaptationScope()?'Values are linear metres of selected stock. Straight rectangular strips use crosscuts only; no section or profile machining is required. Kerf, residuals and excluded source intervals are recorded separately. Untouched inventory is excluded.':'Values are linear metres of selected stock. End-cut removal and thickness removal are separate fabrication losses, not hidden in residual or kerf. Untouched inventory is excluded from this balance.'}</p>${kv([['Cut operations',first(s.cut_operations,s.cuts)],['Untouched stock bars',first(s.untouched_stock_count,s.untouched_bars)],[adaptationScope()?'Additional machining volume':'End-cut removal volume',s.contour_removed_volume_mm3!=null?`${num(s.contour_removed_volume_mm3/1e9,4)} m³`:'Unavailable']])}</div></section><section class="window"><div class="window-title"><strong>ASSIGNED PARTS / PART ROLE</strong></div><div class="window-body">${roles.map(([r,n])=>`<div class="bar-row"><span>${esc(r.replaceAll('_',' '))}</span><div><i style="width:${n/max*100}%"></i></div><b>${n}</b></div>`).join('')}<p class="caption">Counts refer to geometry parts with saved assignments, not independent source bars.</p></div></section></div>${stripScheduleHTML()}`;

  if(data.allocation?.summary?.volume)$('#panel-allocation>.charts-grid').insertAdjacentHTML('beforebegin',volumeBalanceHTML());
}

function stockIntervals(s){
  const sid=String(s.stock_id||s.id),cuts=array(s.cuts||s.pieces||s.parts||s.installed_parts);
  return cuts.length?cuts:assignments.filter(a=>String(a.stock_id)===sid);
}
function intervalArray(v){if(Array.isArray(v))return v;if(v?.start_mm!=null)return[v.start_mm,v.end_mm];if(v?.start!=null)return[v.start,v.end];return null;}
function stockSVG(s){
  const L=Number(first(s.length_mm,s.source_length_mm,s.original_length_mm,s.stock_length_mm,0));if(!(L>0))return empty('Original stock length unavailable.');
  const width=1000,scale=width/L;
  const cuts=stockIntervals(s).map(a=>({a,v:intervalArray(interval(a))})).filter(({v})=>v&&v.every(Number.isFinite));
  const excluded=array(s.excluded_intervals_mm||s.exclusions||s.excluded_intervals).map(v=>intervalArray(v.interval_mm||v)).filter(Boolean);
  const kerfs=array(s.kerf_intervals_mm||s.kerf_intervals).map(v=>intervalArray(v.interval_mm||v)).filter(Boolean);
  return `<svg class="stock-bar" viewBox="0 0 1000 43" preserveAspectRatio="none" aria-label="Stock ${esc(s.stock_id||s.id)} cutting diagram, ${num(L)} millimetres"><rect x="0" y="1" width="1000" height="25" fill="#cbc09b" stroke="#84795b"/>${excluded.map(v=>`<rect x="${v[0]*scale}" y="1" width="${Math.max(.8,(v[1]-v[0])*scale)}" height="25" fill="#9e5240"><title>Excluded: ${readableInterval(v)}</title></rect>`).join('')}${cuts.map(({a,v})=>{const id=geometryID(a),installed=partMap.has(id);return `<g ${installed?`data-select-part="${esc(id)}" data-part="${esc(id)}" tabindex="0" role="button" aria-label="Select ${esc(id)}; ${esc(readableInterval(v))}"`:""}><rect x="${v[0]*scale}" y="1" width="${Math.max(.8,(v[1]-v[0])*scale)}" height="25" fill="${installed?"#80936c":"#ad9d74"}" stroke="#596149"/><title>${esc(id)} · ${installed?"Installed blank":"Surplus cut"} · ${readableInterval(v)}</title></g>`;}).join('')}${kerfs.map(v=>`<rect x="${v[0]*scale}" y="1" width="${Math.max(1,(v[1]-v[0])*scale)}" height="25" fill="#b17449"><title>Kerf: ${readableInterval(v)}</title></rect>`).join('')}<text x="0" y="40" font-size="10" fill="#696957">0</text><text x="1000" y="40" text-anchor="end" font-size="10" fill="#696957">${num(L,1)} mm</text></svg>`;
}
function fillStockLedger(){
  const q=($('#stock-search')?.value||'').toLowerCase(),rows=stocks.filter(s=>`${s.stock_id||s.id} ${s.material_id}`.toLowerCase().includes(q));
  $('#stock-ledger').innerHTML=rows.length?rows.map(s=>{const sid=s.stock_id||s.id,cuts=stockIntervals(s);return `<article class="stock-row" data-stock="${esc(sid)}"><header><div><strong>${esc(sid)}</strong><small>Material ${esc(s.material_id||'Unavailable')} · ${cuts.length} recorded cuts / parts</small></div><span>${mm(first(s.length_mm,s.source_length_mm,s.original_length_mm,s.stock_length_mm))}</span></header>${stockSVG(s)}<div class="stock-labels">${cuts.map(a=>partMap.has(geometryID(a))?`<button type="button" data-select-part="${esc(geometryID(a))}">${esc(geometryID(a))} · ${readableInterval(interval(a))}</button>`:`<span>${esc(geometryID(a))} · Surplus · ${readableInterval(interval(a))}</span>`).join('')}</div>${kv([['Usable intervals',intervalsText(usableIntervals(s))],['Residual intervals',intervalsText(residualIntervals(s))],['Residual length',s.residual_mm!=null?mm(s.residual_mm):'Not recorded'],['Kerf loss',s.kerf_loss_mm!=null?mm(s.kerf_loss_mm):'Not recorded']])}${s.scenario_id?`<p class="caption">Active defect scenario: ${esc(s.scenario_id)}</p>`:''}</article>`;}).join(''):empty(stocks.length?'No stock rows match this filter.':'No saved stock ledger is available.');
}

function fillAnalysis(){
  $('#panel-analysis').innerHTML=`<div class="section-heading"><div><h2>Straight strips from saved source intervals.</h2><p>Recorded cuts retain their parent stock coordinates. Kerf, excluded regions, surplus cuts and residual stock stay visible in the ledger. The absence of source-matching exclusions does not establish defect-free stock.</p></div>${statusHTML(runStatus())}</div><section class="window"><div class="window-title"><strong>SOURCE BARS / CUT INTERVALS</strong></div><div class="window-body"><p>Original stock coordinates are retained. Select a cut to inspect its installed part.</p><div class="legend"><span style="--key:#80936c">Installed blank</span><span style="--key:#ad9d74">Surplus cut</span><span style="--key:#cbc09b">Residual / remaining</span><span style="--key:#b17449">Kerf</span><span style="--key:#9e5240">Excluded interval</span></div><div class="stock-controls"><label>Filter <input id="stock-search" type="search" placeholder="Stock or material ID"></label><span class="caption">${stocks.length} saved stock ledger rows</span></div><div id="stock-ledger" class="stock-ledger"></div></div></section>${cutRecordsHTML()}`;
  fillStockLedger();$('#stock-search')?.addEventListener('input',fillStockLedger);
}

function setTab(name){
  if(!['brief','evidence','allocation','assembly','analysis','verification'].includes(name))return;
  if(name==='verification'&&rootBundle?.full_scope&&state.scope!=='full')setScope('full');
  state.tab=name;
  $('#scope-controls').hidden=name==='verification'||!rootBundle?.full_scope;
  $$('[data-tab]').forEach(el=>{const on=el.dataset.tab===name;el.setAttribute('aria-selected',on?'true':'false');el.tabIndex=on?0:-1;});
  $$('[role=tabpanel]').forEach(el=>el.hidden=el.id!==`panel-${name}`);
  if(name==='assembly')scheduleDraw();else{stopPlayback();pauseAllocationPlayback();}
  if(name==='evidence')fillEvidenceDetail();
  if(name==='verification'){fillVerification();if(verificationLoadState==='NOT_LOADED')void loadVerification();scheduleVerificationDraw();}
  const u=new URL(location.href);u.hash=name;history.replaceState(null,'',u);
}
function resetView(){state.yaw=state.view==='flat'?-.15:.72;state.pitch=state.view==='flat'?1.1:.43;state.zoom=1;state.pan=[0,0];scheduleDraw();}
function stopPlayback(){state.playing=false;cancelAnimationFrame(animation);$('#play-assembly').textContent='Reveal assembly';}
function play(){if(state.playing){stopPlayback();return;}state.playing=true;if(state.progress>=1)state.progress=0;lastTick=0;$('#play-assembly').textContent='Pause reveal';const tick=t=>{if(!state.playing)return;if(lastTick)state.progress=Math.min(1,state.progress+(t-lastTick)/22000);lastTick=t;$('#assembly-progress').value=Math.round(state.progress*displayParts().length);scheduleDraw();if(state.progress>=1)stopPlayback();else animation=requestAnimationFrame(tick);};animation=requestAnimationFrame(tick);}

function verificationCases(){return array(verificationRecord?.load_cases);}
function verificationCase(){return verificationCases().find(c=>String(first(c.id,c.load_case_id))===verification.loadCase)||null;}
function verificationNodes(){return new Map(array(verificationRecord?.model?.nodes).map(n=>[String(first(n.id,n.node_id)),n]));}
function verificationElements(){return array(verificationRecord?.model?.elements);}
function verificationSupports(){return array(first(verificationRecord?.supports,verificationRecord?.model?.supports));}
function verificationMechanisms(){return verificationBinding()?array(verificationRecord?.mechanism_candidates):[];}
function finiteValue(value){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));}
function vector3(value){return Array.isArray(value)&&value.length>=3&&value.slice(0,3).every(finiteValue)?value.slice(0,3).map(Number):null;}
function vectorLabel(value,unit='N'){const v=vector3(value);return v?`${v.map(n=>num(n,3)).join(', ')} ${unit}`:'Unavailable';}
function analysisPoint(record,nodes=verificationNodes()){return vector3(first(record?.position_mm,record?.xyz_mm,nodes.get(String(record?.node_id))?.position_mm));}
function verificationBinding(){
  if(!verificationRecord)return false;
  return verificationRecord.geometry_id===rootBundle?.geometry?.geometry_id&&first(verificationRecord.allocation_run_id,verificationRecord.source_allocation_run_id)===rootBundle?.allocation?.run_id;
}
function validVerificationResults(loadCase=verificationCase()){
  const status=String(verificationRecord?.status||''),caseStatus=String(loadCase?.status||status);
  return verificationBinding()&&verificationLoadState==='LOADED'&&/^(COMPLETED|SUCCESS|SUCCEEDED|SOLVED|PASS|OK)(_|$)/.test(status)&&!/(FAIL|UNSTABLE|MECHANISM|ERROR|NOT_RUN|BLOCKED|INVALID)/.test(caseStatus)&&verificationRecord.results_valid!==false&&loadCase?.results_valid===true;
}
function verificationStatusText(){return verificationLoadState==='LOADED'?verificationRecord?.status||'STATUS_UNAVAILABLE':verificationLoadState;}
function nativeExecutionLabel(value){return value===true?'Executed':value===false?'Not executed':'Not recorded';}
function nativeMessageLabel(value){return value===''?'No message returned (empty string)':value??'Not recorded';}
function nativeModeLabel(record){return finiteValue(record?.rigid_body_mode_count)&&/\b\d+\s+rigid body modes?\b/i.test(String(record?.solver_message||''))?num(record.rigid_body_mode_count):'No mode message';}
function verificationWithheldReason(loadCase){return verificationRecord?.solver_executed===true&&verificationMechanisms().some(m=>m.geometrically_certified===true)?'Response withheld by independent kinematic review of the declared connection model.':loadCase?.withheld_reason||'No valid current response is supplied.';}
function verificationDiagnosticHTML(){
  if(!verificationBinding())return '';
  const native=verificationRecord.native||{},check=verificationRecord.kinematic_audit||{},history=verificationRecord.revision_history;
  return `<h3>Native execution / independent kinematic check</h3>${kv([['Native solver execution',nativeExecutionLabel(verificationRecord.solver_executed)],['Native reported rigid-body modes',nativeModeLabel(native)],['Native solver message',nativeMessageLabel(native.solver_message)],['Independent current rank / DOFs',check.current_rank!==undefined?`${check.current_rank} / ${check.rigid_body_dofs}`:'Not recorded'],['Remaining independent mechanisms',first(check.current_nullity,native.mechanism_certificate_count,verificationMechanisms().length)],['Four terminal rotations resolved',check.four_terminal_rotations_eliminated===true?'Yes — four local triangles applied':'Not recorded']])}${history?`<details><summary>R02 mechanism diagnosis history · ${history.baseline_mechanism_count} terminal rotations</summary>${kv([['Baseline',history.baseline_run_id],['Baseline status',history.baseline_status],['Changed connection groups',history.changed_groups.join(' · ')],['Timber changes / new supports / allocation reruns',`${history.timber_geometry_changes} / ${history.new_supports} / ${history.allocation_reruns}`]])}${link(history.history_url,'Retained R02 analysis record','action-link')}</details>`:''}<p class="caption">Rank is checked independently at relative tolerances 10⁻⁸, 10⁻¹⁰ and 10⁻¹². An empty native message alone is not proof of stability. Elastic response does not verify connection capacity.</p>`;
}
function updateVerificationFooter(){
  $('#analysis-state').textContent=verificationLoadState==='NOT_LOADED'||(verificationBinding()&&verificationRecord?.results_valid===true)?"Full-bench allocation and preliminary structural analysis completed. Accepted baseline: R03; R02 retained as mechanism-diagnosis history.":`Current full-bench analysis: ${verificationStatusText()}. ${verificationError||''}`;
}
async function loadVerification(){
  const request=++verificationRequest;
  verificationRecord=null;verificationLoadState='LOADING';verificationError='';verification.faces=[];verification.elementHits=[];verification.nodeHits=[];
  fillVerification();scheduleVerificationDraw();
  try{
    const response=await fetch('./data/case2-analysis.json',{cache:'no-cache'});if(!response.ok)throw Error(`HTTP ${response.status}`);
    const record=await response.json();if(request!==verificationRequest)return;
    verificationRecord=record;verificationLoadState='LOADED';
    if(!verificationBinding())verificationError='The saved analysis does not match the current full-bench geometry and allocation. Its loads, supports and numerical results are not displayed.';
    const cases=verificationCases();if(!cases.some(c=>String(first(c.id,c.load_case_id))===verification.loadCase))verification.loadCase=cases.length?String(cases[0].id||cases[0].load_case_id):null;
    const critical=verificationCase()?.results?.critical_strip_id;
    if(!verification.strip)verification.strip=critical||rootBundle?.geometry?.parts?.[0]?.part_id||null;
  }catch(error){if(request!==verificationRequest)return;verificationLoadState='LOAD_FAILED';verificationError=`The latest analysis record could not be loaded: ${error.message}. No historical result is substituted.`;}
  fillVerification();scheduleVerificationDraw();
}
function analysisTable(headers,rows){return rows.length?`<div class="table-scroll"><table class="records-table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(value=>`<td>${esc(value??'Unavailable')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:empty('No saved records are available.');}
function dofLabel(value){return Array.isArray(value)?value.map(text).join(' · '):value&&typeof value==='object'?Object.entries(value).map(([k,v])=>`${k}: ${v===true?'restrained':v===false?'released':text(v)}`).join(' · '):text(value);}
function verificationResultHTML(){
  const loadCase=verificationCase(),valid=validVerificationResults(loadCase),result=loadCase?.results||{},loads=verificationBinding()?array(loadCase?.loads):[],nodes=verificationNodes();
  const force=first(loadCase?.applied_force_N,loadCase?.total_force_N),balance=result.reaction_balance||{},reactions=array(result.reactions);
  return `<div class="window-title"><strong>LOAD CASE / SAVED RESPONSE</strong></div><div class="window-body"><h2>${esc(loadCase?.name||'No load case selected')}</h2>${kv([['Load-case status',loadCase?.status||'NOT_AVAILABLE'],['Total applied force (X, Y, Z)',verificationBinding()?vectorLabel(force):'Unavailable'],['Recorded load locations',verificationBinding()?loads.length:'Unavailable'],['Loaded strip count',verificationBinding()?unique(loads.map(l=>l.strip_id)).length:'Unavailable'],['Load basis',first(loadCase?.description,loadCase?.basis)]])}<p class="caption">Reported forces are totals or recorded per-location values as labeled. A 1 kN total patch load must not be interpreted as 1 kN on every strip.</p>${valid?`${kv([['Maximum displacement',finiteValue(result.max_displacement_mm)?mm(result.max_displacement_mm):'Unavailable'],['Displacement vector (X, Y, Z)',vectorLabel(result.maximum_displacement_vector_mm,'mm')],['Peak position (X, Y, Z)',vectorLabel(result.critical_position_mm,'mm')],['Critical strip',result.critical_strip_id],['Critical node',result.critical_node_id],['Reaction / load balance status',balance.status],['Force residual (X, Y, Z)',vectorLabel(first(balance.force_residual_N,balance.residual_force_N))],['Moment residual (X, Y, Z)',vectorLabel(balance.moment_residual_Nmm,'N·mm')],['Total reaction (X, Y, Z)',vectorLabel(result.total_reaction_force_N)],['Relative balance error',finiteValue(balance.relative_error)?num(balance.relative_error,6):'Unavailable'],['Uplift / support tension',first(result.uplift_status,result.support_tension_status,'Not recorded')]])}<details><summary>Saved reactions · ${reactions.length} records</summary>${analysisTable(['Support / node','Reaction X, Y, Z','Moment X, Y, Z','Support limit'],reactions.map(r=>[`${r.support_id} / ${r.node_id}`,vectorLabel(r.force_N),vectorLabel(r.moment_Nmm,'N·mm'),first(r.limit,r.uplift===true?'Uplift / tension flagged':undefined,'Not separately recorded')]))}</details><details><summary>Member-force extrema · actual saved local axes</summary>${analysisTable(['Component','Signed extremum','Strip','Subelement / station'],Object.entries(result.member_force_extrema||{}).map(([k,f])=>[k,`${num(f.value,3)} ${f.unit}`,f.strip_id,`${f.element_id} · ${num(f.station_fraction,2)}`]))}</details><p class="caption">All six vertical reactions are checked for tension. Horizontal bearing restraint remains an unverified friction assumption; this is a linear elastic result.</p>`:`<p class="notice">Response fields are withheld or unavailable for this current run and load case. ${esc(verificationWithheldReason(loadCase))} Displacements, member forces and reactions are not substituted from an older run.</p>`}<details><summary>Recorded load distribution · ${loads.length} locations</summary>${analysisTable(['Strip','Node','Position X, Y, Z','Force X, Y, Z'],loads.map(l=>[l.strip_id,l.node_id,vectorLabel(analysisPoint(l,nodes),'mm'),vectorLabel(l.force_N)]))}</details></div>`;
}
function representativeConnectionSVG(archetype){
  const representative=archetype.representative||{},ids=array(representative.strip_ids),parts=array(rootBundle?.geometry?.parts).filter(p=>ids.includes(p.part_id));
  const contact=array(representative.contact_polygon_xz_mm),points=parts.flatMap(p=>p.polygon_xz_mm||[]);if(!parts.length||!points.length)return empty('No representative connection geometry is saved.');
  const x0=Math.min(...points.map(p=>p[0])),x1=Math.max(...points.map(p=>p[0])),z0=Math.min(...points.map(p=>p[1])),z1=Math.max(...points.map(p=>p[1])),scale=Math.min(380/Math.max(1,x1-x0),190/Math.max(1,z1-z0));
  const point=p=>[25+(p[0]-x0)*scale,220-(p[1]-z0)*scale],poly=values=>values.map(point).map(p=>p.join(',')).join(' ');
  return `<svg class="connection-diagram" viewBox="0 0 430 270" role="img" aria-label="Representative saved overlap viewed in XZ; geometry and recorded fastener positions"><rect width="430" height="270" fill="#eee6ce"/>${parts.map((p,i)=>`<polygon points="${poly(p.polygon_xz_mm)}" fill="${i%2?'#c7ab80':'#8e9e82'}" fill-opacity=".65" stroke="#596149" stroke-width="1"/>`).join('')}${contact.length>=3?`<polygon points="${poly(contact)}" fill="#d19a40" fill-opacity=".65" stroke="#994c33" stroke-width="2"/>`:''}${array(representative.fasteners).filter(f=>vector3(f.position_mm)).map(f=>{const p=point([f.position_mm[0],f.position_mm[2]]);return `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#994c33"><title>${esc(f.type||'Recorded preliminary fastener')}</title></circle>`;}).join('')}<text x="20" y="250" fill="#596149" font-size="10">XZ projection · highlighted contact region · schematic model view</text></svg><p class="caption">${ids.map(esc).join(' ↔ ')}. The geometric overlap is distinct from the stated mechanical idealization.</p>`;
}
function verificationConnectionsHTML(){
  const connections=verificationRecord?.connections||{},archetypes=array(connections.archetypes),corrections=array(connections.terminal_corrections);
  const terminal=verificationBinding()&&corrections.length?`<h3>R03 applied / original pair → local triangle</h3>${img(connections.terminal_detail_url,'Four actual overlap faces showing retained T1/T2, former released axis and applied T3')}${corrections.map(d=>`<details><summary>${esc(d.terminal_strip_id)} · ${esc(d.contact_id)} · Applied</summary><button type="button" class="action-link" data-verification-part="${esc(d.terminal_strip_id)}">Inspect revised terminal strip</button>${kv([['Original T1 (mm)',vectorLabel(d.original_tie_points_xyz_mm[0],'mm')],['Original T2 (mm)',vectorLabel(d.original_tie_points_xyz_mm[1],'mm')],['Former rotation axis',vectorLabel(d.original_released_axis_xyz,'direction')],['Applied T3 (mm)',vectorLabel(d.third_tie_point_xyz_mm,'mm')],['Triangle height / area',`${num(d.triangle_height_mm,2)} mm / ${num(d.triangle_area_mm2,1)} mm²`],['T3 face-edge clearance',mm(d.third_point_minimum_geometric_edge_clearance_mm)]])}</details>`).join('')}`:'';
  return `<div class="window-title"><strong>REPRESENTATIVE CONNECTION / IDEALIZATION</strong></div><div class="window-body"><p>${esc(connections.summary||'A connection model has not been loaded.')}</p>${terminal}${verificationBinding()?archetypes.map((a,i)=>`<details ${i===0?'open':''}><summary>${esc(a.title||a.id||'Connection archetype')}</summary>${safeImage(a.diagram_url)?`${img(a.diagram_url,'Representative connection model diagram')}<p class="caption">Representative connection model diagram; not a browser recording.</p>`:representativeConnectionSVG(a)}${kv([['Archetype ID',a.id],['Grouped contacts',first(a.contact_count,a.count)],['Translations',dofLabel(first(a.translation,a.translations,a.translation_restraints))],['Rotations',dofLabel(first(a.rotation,a.rotations,a.rotation_restraints))],['Coordinate basis',a.coordinate_system],['Preliminary fastening concept',first(a.fastening_concept,a.description)],['Idealization / stiffness basis',first(a.assumption,a.stiffness_basis)]])}</details>`).join('')||empty('No connection archetypes are recorded.'):empty('No matching current connection record is available.')}<p class="caption">Geometric contacts are not independently verified fasteners. Restraints, releases and stiffness assumptions must come from the saved mechanical model.</p></div>`;
}
function verificationAssumptionsHTML(){
  const a=verificationBinding()?verificationRecord?.assumptions||{}:{},materials=array(a.materials),supports=verificationBinding()?verificationSupports():[],nodes=verificationNodes();
  return `<div class="window-title"><strong>MODEL ASSUMPTIONS / MATERIALS & SUPPORTS</strong></div><div class="window-body"><h3>Material properties</h3>${analysisTable(['Material','E (MPa)','G (MPa)','Density (kg/m³)','Basis / status'],materials.map(m=>[first(m.material_id,m.name),m.E_MPa,m.G_MPa,m.density_kg_m3,[m.basis,m.status].filter(Boolean).join(' · ')]))}<p class="caption">Source appearance supplies no stiffness, density or strength values.</p><h3>Supports</h3>${analysisTable(['Support / node','Position (mm)','Pad height / plane (mm)','Restraints','Assumption / anchorage'],supports.map(s=>[`${s.id||''} / ${s.node_id||''}`,vectorLabel(analysisPoint(s,nodes),'mm'),[num(s.pad_height_mm,3),num(s.foundation_plane_z_mm,3)].join(' / '),dofLabel(s.restraints),[s.assumption,s.anchorage].filter(v=>v!==undefined).map(text).join(' · ')]))}${array(a.supports).length?list(a.supports):''}${array(a.connections).length?`<h3>Connection assumptions</h3><p>See the compact R03 assumptions note below. The actual terminal point coordinates and offsets remain in the connection details.</p>`:''}<p class="caption">A resting-support model does not establish physical anchorage. Any reported uplift or tension remains an assumption limit.</p></div>`;
}
function fillVerification(){
  const cases=verificationCases(),valid=validVerificationResults(),record=verificationRecord;
  $('#verification-run').innerHTML=`<span class="caption">Saved validity status </span>${statusHTML(verificationStatusText())}<strong>${esc(record?.run_id||'No current run loaded')}</strong>${record?.fixture===true?tag('TEST FIXTURE — NOT AN ANALYSIS RESULT','warn'):''}<p>${esc(verificationError||record?.reason||record?.message||'Current full-bench preliminary analysis. No historical result substitution.')}</p>${record?kv([['Engine',record.engine],['Geometry ID',record.geometry_id],['Allocation run ID',first(record.allocation_run_id,record.source_allocation_run_id)],['Recorded time',first(record.completed_at,record.created_at)],['Scope',first(record.scope,'Current full bench')]]):''}${verificationDiagnosticHTML()}`;
  $('#verification-loadcase').innerHTML=cases.length?cases.map(c=>`<option value="${esc(first(c.id,c.load_case_id))}">${esc(c.name||first(c.id,c.load_case_id))} · ${esc(c.status||'Status unavailable')}</option>`).join(''):'<option value="">No saved load case</option>';
  $('#verification-loadcase').value=verification.loadCase||'';$('#verification-loadcase').disabled=!verificationBinding()||!cases.length;
  $('#verification-deformed').disabled=!valid;$('#verification-scale').disabled=!valid||!verification.deformed;$('#verification-reactions').disabled=!valid;$('#verification-metric').disabled=!valid;
  const allParts=array(rootBundle?.geometry?.parts);if(!verification.strip)verification.strip=allParts[0]?.part_id||null;
  $('#verification-strip').innerHTML=allParts.map(p=>`<option value="${esc(p.part_id)}">${esc(p.part_id)}</option>`).join('');$('#verification-strip').value=verification.strip||'';
  $('#verification-results').innerHTML=verificationResultHTML();$('#verification-connections').innerHTML=verificationConnectionsHTML();$('#verification-assumptions').innerHTML=verificationAssumptionsHTML();
  const issues=array(first(record?.issues,record?.remaining_issues,record?.blockers)),sensitivity=array(record?.sensitivity),mechanisms=verificationMechanisms();
  $('#verification-issues').innerHTML=`<div class="window-title"><strong>RETAINED LIMITS / R02 DIAGNOSIS HISTORY</strong></div><div class="window-body">${issues.length?list(issues):empty(record?'No separate issue records were supplied.':'No current analysis record is loaded.')}${sensitivity.length?`<h3>Current R03 / retained R02 comparison</h3>${analysisTable(['Model / idealization','Validity status / run','Native solver','Native modes','Independent mechanisms','Comparison / limit'],sensitivity.map(s=>[s.name||s.id,[s.status,s.run_id].filter(Boolean).join(' · '),[nativeExecutionLabel(s.solver_executed),nativeMessageLabel(s.solver_message)].join(' · '),nativeModeLabel(s),s.known_mechanism_count,[first(s.description,s.limit,s.summary),s.error_stage,s.error].filter(Boolean).join(' · ')]))}`:''}${array(record?.correction_proposal).length?`<h3>Physical correction proposal</h3>${list(array(record.correction_proposal).length?record.correction_proposal:[record.correction_proposal])}`:''}<p class="caption">A physical design change requires a separate revision and an allocation-consequence check. The successful allocation baseline remains unchanged.</p>${record?`<a class="action-link" href="./data/case2-analysis.json" download>Download current analysis JSON</a>${link(record.exports?.native_result,'Native worker record','action-link')}${link(record.exports?.kinematic_audit,'Executed-input kinematic audit','action-link')}`:''}</div>`;
  if(mechanisms.length)$('#verification-issues').querySelector('.window-body').insertAdjacentHTML('afterbegin',`<h3>Independent kinematic certificates / degrees of freedom</h3>${mechanisms.map(m=>`<details><summary>${esc(m.strip_id||m.member_id)} · ${esc(m.kind||'Relative rotation')}</summary><button type="button" class="action-link" data-verification-part="${esc(m.strip_id||m.member_id)}">Inspect critical strip</button>${kv([['Contact',m.contact_id],['Axis direction',vectorLabel(m.axis_xyz,'direction')],['Unrestrained relative rotations',m.unrestrained_relative_rotation_count],['Reason',m.reason],['Physical correction proposal',m.physical_correction_proposal],['Allocation consequences',m.allocation_consequences]])}</details>`).join('')}`);
  updateVerificationSelection();updateVerificationFooter();
}
function updateVerificationSelection(){
  const elements=verificationBinding()?verificationElements().filter(e=>String(e.strip_id||e.member_id)===verification.strip):[];
  if(!elements.some(e=>String(first(e.id,e.element_id))===verification.element))verification.element=elements.length?String(elements[0].id||elements[0].element_id):null;
  $('#verification-element').innerHTML=elements.length?elements.map(e=>`<option value="${esc(first(e.id,e.element_id))}">${esc(first(e.id,e.element_id))}</option>`).join(''):'<option value="">No analytical element mapping</option>';
  $('#verification-element').value=verification.element||'';$('#verification-element').disabled=!elements.length;
  const element=elements.find(e=>String(first(e.id,e.element_id))===verification.element),valid=validVerificationResults(),results=verificationCase()?.results||{},forces=valid?array(results.member_forces).filter(f=>String(f.element_id)===verification.element):[],nodes=verificationNodes(),nodeIds=array(element?.node_ids),displacements=valid?array(results.displacements).filter(d=>nodeIds.some(id=>String(id)===String(d.node_id))||String(d.node_id)===verification.node):[];
  const part=array(rootBundle?.geometry?.parts).find(p=>p.part_id===verification.strip),assignment=array(rootBundle?.allocation?.assignments).find(a=>String(a.member_id||a.part_id)===verification.strip);
  const reactions=valid?array(results.reactions).filter(r=>String(r.node_id)===verification.node):[],support=verificationSupports().find(s=>String(s.node_id)===verification.node);
  $('#verification-selection').innerHTML=`<h2>${esc(verification.strip||'Select a strip')}</h2>${kv([['Analytical element',verification.element],['Local member axis',part?.source_coordinate_transform?.longitudinal_direction?vectorLabel(part.source_coordinate_transform.longitudinal_direction,'direction'):'Unavailable'],['Element nodes',nodeIds.join(' → ')||'Unavailable'],['Material / parent stock',assignment?`${assignment.material_id} / ${assignment.stock_id}`:'Unavailable'],['Element kind',first(element?.kind,element?.type)],['Continuity / element basis',first(element?.continuity,element?.basis)]])}${valid?`${analysisTable(['Element station','N (N)','Vy / Vz (N)','T / My / Mz (N·mm)'],forces.map(f=>[first(f.station_mm,f.location,'Saved value'),f.N_N,`${num(f.Vy_N,3)} / ${num(f.Vz_N,3)}`,`${num(f.T_Nmm,3)} / ${num(f.My_Nmm,3)} / ${num(f.Mz_Nmm,3)}`]))}<h3>Nodal displacement</h3>${analysisTable(['Node','UX, UY, UZ (mm)'],displacements.map(d=>[d.node_id,vectorLabel(first(d.vector_mm,d.translation_mm),'mm')]))}`:'<p class="notice">Current numerical response is withheld or unavailable. See the native execution and kinematic checks above.</p>'}${verification.node?`<h3>Selected support / node</h3>${kv([['Node',verification.node],['Position',vectorLabel(first(nodes.get(verification.node)?.position_mm,support?.position_mm),'mm')],['Support assumption',support?.assumption],['Pad height / plane (mm)',support?[num(support.pad_height_mm,3),num(support.foundation_plane_z_mm,3)].join(' / '):'Not recorded'],['Restraints',support?dofLabel(support.restraints):'Not a recorded support']])}${reactions.length?analysisTable(['Reaction (N)','Moment (N·mm)'],reactions.map(r=>[vectorLabel(r.force_N),vectorLabel(r.moment_Nmm,'N·mm')])):''}`:''}${verification.strip?`<button class="action-link" type="button" data-verification-source="${esc(verification.strip)}">Inspect source in Assembly</button>`:''}<p class="caption">Forces are saved analytical values in the element's documented local axes; no strength utilization is inferred.</p>`;
}
function scheduleVerificationDraw(){if(!verificationDrawFrame)verificationDrawFrame=requestAnimationFrame(()=>{verificationDrawFrame=0;drawVerification();});}
function drawVerification(){
  if(!verificationContext||state.tab!=='verification')return;
  const c=verificationContext,rect=verificationCanvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const ratio=Math.min(window.devicePixelRatio||1,2),w=rect.width,h=rect.height;
  if(verificationCanvas.width!==Math.round(w*ratio)||verificationCanvas.height!==Math.round(h*ratio)){verificationCanvas.width=Math.round(w*ratio);verificationCanvas.height=Math.round(h*ratio);}
  c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,w,h);c.fillStyle='#efebdf';c.fillRect(0,0,w,h);
  if(!verificationFacesCache)verificationFacesCache=array(rootBundle?.geometry?.parts).map(normalizePart).flatMap(p=>extrudePart(p));
  const scene=projectScene(verificationFacesCache,{w,h},verification);verification.faces=scene.faces;verification.elementHits=[];verification.nodeHits=[];
  const mechanisms=verificationMechanisms(),critical=new Set(mechanisms.map(m=>m.strip_id||m.member_id)),patch=new Set(verificationBinding()?array(verificationCase()?.loads).filter(l=>/SEAT|PATCH|TEST/.test(String(l.kind))).map(l=>l.strip_id):[]);
  for(const face of scene.faces){c.beginPath();face.points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();c.fillStyle=critical.has(face.part.part_id)?'#b57058':face.part.part_id===verification.strip?'#bc996a':patch.has(face.part.part_id)?'#d8b55d':'#d5d0bd';c.fill();c.strokeStyle=face.part.part_id===verification.strip?'#994c33':'#a6a38e';c.lineWidth=face.part.part_id===verification.strip?1:.3;c.stroke();}
  const loadCase=verificationCase(),valid=validVerificationResults(loadCase),nodes=verificationNodes(),results=loadCase?.results||{};
  const displacement=new Map(valid?array(results.displacements).map(d=>[String(d.node_id),vector3(first(d.vector_mm,d.translation_mm))]):[]),forces=new Map(valid?array(results.member_forces).map(f=>[String(f.element_id),f]):[]);
  const magnitude=v=>v?Math.hypot(...v):null,maximum=[...displacement.values()].reduce((m,v)=>Math.max(m,magnitude(v)||0),0),axialMaximum=[...forces.values()].reduce((m,f)=>Math.max(m,finiteValue(f.N_N)?Math.abs(Number(f.N_N)):0),0);
  const projectNode=id=>{const position=vector3(nodes.get(String(id))?.position_mm);if(!position)return null;const d=displacement.get(String(id));return scene.project(position.map((v,i)=>v+(valid&&verification.deformed&&d?d[i]*verification.scale:0)));};
  if(verificationBinding())for(const element of verificationElements()){
    const ids=array(element.node_ids),elementId=String(first(element.id,element.element_id)),stripId=String(element.strip_id||element.member_id||''),chosen=elementId===verification.element,offset=String(element.kind||'').includes('OFFSET');
    for(let i=1;i<ids.length;i++){
      const a=projectNode(ids[i-1]),b=projectNode(ids[i]);if(!a||!b)continue;
      const displacementValue=Math.max(magnitude(displacement.get(String(ids[i-1])))||0,magnitude(displacement.get(String(ids[i])))||0),force=forces.get(elementId)?.N_N;
      const q=verification.metric==='axial'?(finiteValue(force)&&axialMaximum?Number(force)/axialMaximum:0):(maximum?displacementValue/maximum:0);
      c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.strokeStyle=chosen?'#994c33':!valid||offset||verification.metric==='geometry'?'#66745b':verification.metric==='axial'?(q<0?`hsl(205 45% ${66-Math.abs(q)*30}%)`:`hsl(22 65% ${70-q*30}%)`):`hsl(${205-q*180} 55% 43%)`;c.lineWidth=chosen?2.2:valid?1.1:.6;c.setLineDash(offset?[3,3]:[]);c.stroke();c.setLineDash([]);
      verification.elementHits.push({a,b,elementId,stripId});
    }
  }
  const arrow=(position,force,colour)=>{const vector=vector3(force),point=vector3(position);if(!point||!vector||!Math.hypot(...vector))return;const tip=scene.project(point),end=scene.project(point.map((v,i)=>v+vector[i]/Math.hypot(...vector)*100)),dx=end[0]-tip[0],dy=end[1]-tip[1],norm=Math.hypot(dx,dy);if(norm<.01)return;const ux=dx/norm,uy=dy/norm;c.strokeStyle=colour;c.fillStyle=colour;c.lineWidth=1.6;c.beginPath();c.moveTo(tip[0]-ux*32,tip[1]-uy*32);c.lineTo(tip[0],tip[1]);c.stroke();c.beginPath();c.moveTo(tip[0],tip[1]);c.lineTo(tip[0]-ux*8-uy*4,tip[1]-uy*8+ux*4);c.lineTo(tip[0]-ux*8+uy*4,tip[1]-uy*8-ux*4);c.closePath();c.fill();};
  if(verificationBinding()){
    const gravity=[0,0,0];let gravityCount=0;
    for(const load of array(loadCase?.loads)){if(String(load.kind).startsWith('SELF_WEIGHT')){const force=vector3(load.force_N);if(force){force.forEach((v,i)=>gravity[i]+=v);gravityCount++;}}else arrow(analysisPoint(load,nodes),load.force_N,'#995238');}
    if(gravityCount){c.strokeStyle='#995238';c.fillStyle='#995238';c.lineWidth=2;c.beginPath();c.moveTo(26,45);c.lineTo(26,67);c.stroke();c.beginPath();c.moveTo(26,70);c.lineTo(21,61);c.lineTo(31,61);c.closePath();c.fill();c.font='11px Arial';c.fillText(`Self-weight total: ${num(Math.hypot(...gravity),3)} N · gravity direction only`,40,58);}
    for(const support of verificationSupports()){const position=analysisPoint(support,nodes);if(!position)continue;const point=scene.project(position);c.beginPath();c.moveTo(point[0],point[1]);c.lineTo(point[0]-6,point[1]+10);c.lineTo(point[0]+6,point[1]+10);c.closePath();c.fillStyle='#436d80';c.fill();verification.nodeHits.push({point,nodeId:String(first(support.node_id,'')),supportId:support.id});}
    if(valid&&verification.reactions)for(const reaction of array(results.reactions))arrow(analysisPoint(reaction,nodes),reaction.force_N,'#356f64');
    for(const mechanism of mechanisms){
      const origin=vector3(mechanism.position_mm),axis=vector3(mechanism.axis_xyz);if(!origin)continue;
      const p=scene.project(origin);c.strokeStyle='#9b3c31';c.fillStyle='#9b3c31';c.lineWidth=2;
      if(axis){const a=scene.project(origin.map((v,i)=>v-axis[i]*90)),b=scene.project(origin.map((v,i)=>v+axis[i]*90));c.setLineDash([3,3]);c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();c.setLineDash([]);}
      c.beginPath();c.arc(p[0],p[1],13,-Math.PI*.65,Math.PI*.7);c.stroke();const a=Math.PI*.7,x=p[0]+13*Math.cos(a),y=p[1]+13*Math.sin(a);c.beginPath();c.moveTo(x,y);c.lineTo(x+7,y-2);c.lineTo(x+2,y-8);c.closePath();c.fill();
      c.font='10px Consolas, monospace';c.fillText(String(mechanism.strip_id||mechanism.member_id).replace('C2O_',''),p[0]+17,p[1]-10);
    }
  }
  $('#verification-scene-label').textContent=`Model render · ${array(rootBundle?.geometry?.parts).length} assembled strips · loads: rust · supports: blue${valid&&verification.reactions?' · reactions: green':''}${valid&&verification.metric==='displacement'?` · nodal |u| 0–${num(maximum,3)} mm`:valid&&verification.metric==='axial'?` · |N| colour range ±${num(axialMaximum,3)} N`:''}`;
  $('#verification-deformation-label').textContent=valid&&verification.deformed?`Deformed analytical node lines: ×${num(verification.scale,1)} exaggeration. Solid strips show their undeformed assembled positions.`:valid?'Undeformed assembled geometry. Deformation overlay is off.':'No valid current displacement field is displayed. Geometry, recorded loads and support assumptions only.';
}
function wireVerification(){
  verificationCanvas=$('#verification-model');verificationContext=verificationCanvas.getContext('2d');new ResizeObserver(scheduleVerificationDraw).observe(verificationCanvas);
  $('#verification-reload').addEventListener('click',()=>void loadVerification());
  $('#verification-loadcase').addEventListener('change',e=>{verification.loadCase=e.target.value;verification.node=null;fillVerification();scheduleVerificationDraw();});
  $('#verification-metric').addEventListener('change',e=>{verification.metric=e.target.value;scheduleVerificationDraw();});
  $('#verification-deformed').addEventListener('change',e=>{verification.deformed=e.target.checked;$('#verification-scale').disabled=!validVerificationResults()||!verification.deformed;scheduleVerificationDraw();});
  $('#verification-scale').addEventListener('input',e=>{verification.scale=Math.max(1,Math.min(5000,Number(e.target.value)||1));scheduleVerificationDraw();});
  $('#verification-reactions').addEventListener('change',e=>{verification.reactions=e.target.checked;scheduleVerificationDraw();});
  $('#verification-strip').addEventListener('change',e=>{verification.strip=e.target.value;verification.element=null;verification.node=null;updateVerificationSelection();scheduleVerificationDraw();});
  $('#verification-element').addEventListener('change',e=>{verification.element=e.target.value;verification.node=null;updateVerificationSelection();scheduleVerificationDraw();});
  $('#verification-reset').addEventListener('click',()=>{verification.yaw=1.12;verification.pitch=.53;verification.zoom=1;verification.pan=[0,0];scheduleVerificationDraw();});
  let drag=null;
  verificationCanvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,shift:e.shiftKey};verificationCanvas.setPointerCapture(e.pointerId);});
  verificationCanvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4)drag.moved=true;if(drag.shift||e.shiftKey){verification.pan[0]+=dx;verification.pan[1]+=dy;}else{verification.yaw+=dx*.007;verification.pitch=Math.max(-1.35,Math.min(1.35,verification.pitch+dy*.007));}drag.lastX=e.clientX;drag.lastY=e.clientY;scheduleVerificationDraw();});
  verificationCanvas.addEventListener('pointerup',e=>{
    if(drag&&!drag.moved){const r=verificationCanvas.getBoundingClientRect(),point=[e.clientX-r.left,e.clientY-r.top],support=verification.nodeHits.findLast(hit=>Math.hypot(hit.point[0]-point[0],hit.point[1]+5-point[1])<10);
      const distance=hit=>{const dx=hit.b[0]-hit.a[0],dy=hit.b[1]-hit.a[1],t=Math.max(0,Math.min(1,((point[0]-hit.a[0])*dx+(point[1]-hit.a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(point[0]-hit.a[0]-t*dx,point[1]-hit.a[1]-t*dy);};
      if(support)verification.node=support.nodeId;else{verification.node=null;const hits=verification.elementHits.map(hit=>({...hit,distance:distance(hit)})).filter(hit=>hit.distance<6).sort((a,b)=>a.distance-b.distance);if(hits.length){verification.element=hits[0].elementId;verification.strip=hits[0].stripId;}else{const face=verification.faces.findLast(f=>pointInPolygon(point,f.points));if(face){verification.strip=face.part.part_id;verification.element=null;}}}
      $('#verification-strip').value=verification.strip||'';updateVerificationSelection();scheduleVerificationDraw();
    }drag=null;
  });
  verificationCanvas.addEventListener('pointercancel',()=>drag=null);
  verificationCanvas.addEventListener('wheel',e=>{e.preventDefault();verification.zoom=Math.max(.25,Math.min(6,verification.zoom*Math.exp(-e.deltaY*.001)));scheduleVerificationDraw();},{passive:false});
  verificationCanvas.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')verification.yaw-=.1;else if(e.key==='ArrowRight')verification.yaw+=.1;else if(e.key==='ArrowUp')verification.pitch=Math.min(1.35,verification.pitch+.1);else if(e.key==='ArrowDown')verification.pitch=Math.max(-1.35,verification.pitch-.1);else return;e.preventDefault();scheduleVerificationDraw();});
}

function wire(){
  canvas=$('#case-model');ctx=canvas.getContext('2d');new ResizeObserver(scheduleDraw).observe(canvas);
  wireVerification();
  document.addEventListener('click',e=>{
    const mode=e.target.closest('[data-model-mode]');if(mode)void setModelMode(mode.dataset.modelMode);
    const scope=e.target.closest('[data-scope]');if(scope)setScope(scope.dataset.scope);
    const tab=e.target.closest('[data-tab]');if(tab)setTab(tab.dataset.tab);
    const layout=e.target.closest('[data-layout]');if(layout){if(state.allocationPlayback)void setModelMode('inspection');state.layout=layout.dataset.layout;$$('[data-layout]').forEach(el=>el.setAttribute('aria-pressed',el===layout?'true':'false'));updateSelection();resetView();}
    const sourceMaterial=e.target.closest('[data-open-material]');if(sourceMaterial){state.material=sourceMaterial.dataset.openMaterial;setTab('evidence');}
    const view=e.target.closest('[data-view]');if(view){if(state.allocationPlayback)void setModelMode('inspection');state.view=view.dataset.view;$$('[data-view]').forEach(el=>el.setAttribute('aria-pressed',el===view?'true':'false'));resetView();}
    const parent=e.target.closest('[data-open-stock]');if(parent){setTab('analysis');$('#stock-search').value=parent.dataset.openStock;fillStockLedger();}
    const select=e.target.closest('[data-select-part]');if(select)setSelected(select.dataset.selectPart,true);
    const verifiedSource=e.target.closest('[data-verification-source]');if(verifiedSource)setSelected(verifiedSource.dataset.verificationSource,true);
    const verifiedPart=e.target.closest('[data-verification-part]');if(verifiedPart){verification.strip=verifiedPart.dataset.verificationPart;verification.element=null;verification.node=null;$('#verification-strip').value=verification.strip;updateVerificationSelection();scheduleVerificationDraw();}
    const part=e.target.closest('#part-bank [data-part]');if(part)setSelected(part.dataset.part);
    const material=e.target.closest('.material-list [data-material]');if(material){state.material=material.dataset.material;fillEvidenceDetail();}
  });
  $('.workflow-tabs').addEventListener('keydown',e=>{const tabs=$$('[data-tab]'),index=tabs.indexOf(document.activeElement);if(index<0)return;let next=index;if(e.key==='ArrowRight')next=(index+1)%tabs.length;else if(e.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;e.preventDefault();setTab(tabs[next].dataset.tab);tabs[next].focus();});
  document.addEventListener('keydown',e=>{const part=e.target.closest('svg [data-select-part]');if(part&&(e.key==='Enter'||e.key===' ')){e.preventDefault();setSelected(part.dataset.selectPart,true);}});
  $('#reset-view').addEventListener('click',resetView);
  $('#show-context').addEventListener('change',e=>{state.context=e.target.checked;resetView();});
  $('#context-overview').addEventListener('click',e=>{state.focus=!state.focus;e.currentTarget.setAttribute('aria-pressed',state.focus?'false':'true');e.currentTarget.textContent=state.focus?'Full bench overview':'Focus prototype';resetView();});
  $('#show-appearance').addEventListener('change',e=>{state.appearance=e.target.checked;scheduleDraw();});
  $('#rib-filter').addEventListener('change',e=>{state.rib=e.target.value;resetView();if(state.rib!=='all'){state.yaw=0;state.pitch=0;scheduleDraw();}});
  $('#inspect-frame').addEventListener('click',()=>{state.rib=partMap.get(state.selected)?.rib_id||parts[0]?.rib_id;$('#rib-filter').value=state.rib;state.view='assembled';$$('[data-view]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.view==='assembled'?'true':'false'));resetView();state.yaw=0;state.pitch=0;scheduleDraw();});
  $('#part-search').addEventListener('input',updateBank);
  $('#play-allocation').addEventListener('click',playAllocationPlayback);
  $('#replay-allocation').addEventListener('click',replayAllocationPlayback);
  $('#allocation-timeline').addEventListener('input',e=>{pauseAllocationPlayback();state.allocationTime=Math.max(0,Math.min(playbackModel?.durationSeconds||0,Number(e.target.value)||0));syncPlaybackControls();scheduleDraw();});
  $('#allocation-video').addEventListener('play',pauseAllocationPlayback);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseAllocationPlayback();});
  $('#play-assembly').addEventListener('click',play);
  $('#assembly-progress').addEventListener('input',e=>{stopPlayback();state.progress=Number(e.target.value)/Math.max(1,displayParts().length);scheduleDraw();});
  let drag=null;
  canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,shift:e.shiftKey};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4)drag.moved=true;if(state.allocationPlayback)return;if(drag.shift||e.shiftKey){state.pan[0]+=dx;state.pan[1]+=dy;}else{state.yaw+=dx*.007;state.pitch=Math.max(-1.35,Math.min(1.35,state.pitch+dy*.007));}drag.lastX=e.clientX;drag.lastY=e.clientY;scheduleDraw();});
  canvas.addEventListener('pointerup',e=>{if(drag&&!drag.moved){const r=canvas.getBoundingClientRect(),p=[e.clientX-r.left,e.clientY-r.top];if(state.allocationPlayback){const hit=playbackHits.findLast(target=>pointInPolygon(p,target.polygon));if(hit)setSelected(hit.memberId);}else{const face=state.faces.findLast(f=>pointInPolygon(p,f.points));if(face)setSelected(face.part.part_id);}}drag=null;});
  canvas.addEventListener('pointercancel',()=>drag=null);
  canvas.addEventListener('wheel',e=>{if(state.allocationPlayback)return;e.preventDefault();state.zoom=Math.max(.25,Math.min(6,state.zoom*Math.exp(-e.deltaY*.001)));scheduleDraw();},{passive:false});
  canvas.addEventListener('keydown',e=>{if(state.allocationPlayback){if(e.key===' '){e.preventDefault();playAllocationPlayback();}else if(['ArrowLeft','ArrowRight','Home'].includes(e.key)){e.preventDefault();pauseAllocationPlayback();state.allocationTime=e.key==='Home'?0:Math.max(0,Math.min(playbackModel?.durationSeconds||0,state.allocationTime+(e.key==='ArrowRight'?1:-1)));syncPlaybackControls();scheduleDraw();}return;}if(e.key==='0'){resetView();e.preventDefault();return;}if(e.key==='ArrowLeft')state.yaw-=.1;else if(e.key==='ArrowRight')state.yaw+=.1;else if(e.key==='ArrowUp')state.pitch=Math.min(1.35,state.pitch+.1);else if(e.key==='ArrowDown')state.pitch=Math.max(-1.35,state.pitch-.1);else if(e.key==='+'||e.key==='=')state.zoom=Math.min(6,state.zoom*1.1);else if(e.key==='-')state.zoom=Math.max(.25,state.zoom/1.1);else return;e.preventDefault();scheduleDraw();});
}

async function start(){
  try{
    const r=await fetch('./data/case2.json',{cache:'no-cache'});if(!r.ok)throw Error(`Case data returned HTTP ${r.status}`);rootBundle=await r.json();normalize(rootBundle);state.scope=rootBundle.full_scope?'full':'prototype';
    fillHeader();fillDownloads();fillBrief();fillEvidence();fillAllocation();fillAnalysis();wire();loadTextures();updateSelection();updateBank();
    const requested=location.hash.slice(1);setTab(['brief','evidence','allocation','assembly','analysis','verification'].includes(requested)?requested:'assembly');
    const parameters=new URL(location.href).searchParams,requestedScope=parameters.get('scope'),requestedPlayback=parameters.get('playback');
    if(requested!=='verification'&&rootBundle.full_scope&&['detail','prototype'].includes(requestedScope))setScope(requestedScope);
    if(requested!=='verification'&&requestedPlayback==='allocation')await setModelMode('allocation');
    window.case2View={setScope,setModelMode,playAllocation:playAllocationPlayback,pauseAllocation:pauseAllocationPlayback,replayAllocation:replayAllocationPlayback,get state(){return {...state,faces:state.faces.length};},get counts(){return {parts:parts.length,displayed_parts:displayParts().length,assignments:assignments.length,stocks:stocks.length,materials:materials.length};},selectPart:setSelected,setView:view=>{const b=$(`[data-view="${view}"]`);b?.click();}};
  }catch(error){$('#load-error').hidden=false;$('#load-error').textContent=`The case could not be loaded: ${error.message}. Serve this folder through the application or a static web server; opening the HTML as a file does not support its data requests.`;$('#case-state').textContent='Case data unavailable';console.error(error);}
}
if(typeof document!=='undefined')start();
