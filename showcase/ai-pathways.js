// Inspect saved evidence. This module does not call an AI model or a solver.
const root = 'assets/ai-process/';
const byId = id => document.getElementById(id);
const controls = selector => [...document.querySelectorAll(selector)];
function select(button, selector) {
  controls(selector).forEach(other => other.setAttribute('aria-pressed', String(other === button)));
}
function watchImage(img) {
  img.addEventListener('error', () => {
    if (img.nextElementSibling?.classList.contains('ai-image-error')) return;
    const note = document.createElement('p');
    note.className = 'ai-image-error';
    note.textContent = 'This evidence image could not load. Reload the page or open the process record below.';
    img.after(note);
  }, {once:true});
  img.addEventListener('load', () => {
    if (img.nextElementSibling?.classList.contains('ai-image-error')) img.nextElementSibling.remove();
  });
}
controls('img[src*="ai-process/"]').forEach(watchImage);

const stages = {
  source: {
    files:['99397_photo_01.jpg','99397_photo_02.jpg'],
    alt:['Seller photograph of cedar slab 99397, view one','Seller photograph of cedar slab 99397, view two'],
    title:'Two photographs, incomplete coverage.',
    description:'The seller lists 127 × 787.4 × 2082.8 mm. These are seller-reported dimensions; they have not been applied as a metric scale to this point cloud.',
    limit:'The photographs do not establish the unseen faces, internal condition or a verified physical identity across views.'
  },
  mask: {
    files:['99397_active_mask_overlay_01.jpg','99397_active_mask_overlay_02.jpg'],
    alt:['Saved SAM2 mask over cedar slab photograph one','Saved SAM2 mask over cedar slab photograph two'],
    title:'SAM2 isolates the visible timber.',
    description:'The saved masks separate the target from its surroundings in each photograph. Both selected masks were derived from the SAM2 cache, with manual_mask recorded as false.',
    limit:'Segmentation selects visible pixels. It does not recover hidden faces or establish a material grade.'
  },
  views: {
    files:['99397_cloud_view_01.png','99397_cloud_view_02.png'],
    alt:['7414 retained point rows from view one','7872 retained point rows from view two'],
    title:'Each view contributes spatial support.',
    description:'7,414 points from the first view and 7,872 from the second are shown with one shared camera. They retain the original VGGT scene coordinates.',
    limit:'The display uses saved filtered point rows. These are partial observations, without an established metric scale.'
  },
  points: {
    files:['99397_cloud_merged_by_view.png'],
    alt:['Combined VGGT point support with blue view-one points and orange view-two points'],
    title:'One common scene. Two visible sources.',
    description:'The 15,286 saved points retain their original common-scene placement. Blue identifies view one; orange identifies view two. The contributions can be read together.',
    limit:'This preserves saved alignment; it does not perform a new registration, fill holes or certify that both views show the same physical slab.'
  },
  surface: {
    files:['99397_observed_patches_and_proxy.png'],
    alt:['Saved observed photo patches and geometric proxy with unobserved regions retained'],
    title:'Keep the unknown parts unknown.',
    description:'Observed photo patches sit alongside a geometric proxy. Transparent and unobserved regions remain visible, so a design decision can distinguish image evidence from inferred form.',
    limit:'Both patches associate with one candidate proxy face. This is not a watertight reconstruction or evidence of two distinct physical faces.'
  }
};
controls('[data-material-stage]').forEach(button => button.addEventListener('click', () => {
  const stage = stages[button.dataset.materialStage];
  if (!stage) return;
  select(button,'[data-material-stage]');
  if (matchMedia('(max-width:720px)').matches) {
    const list=button.parentElement;
    list.scrollTo({left:button.offsetLeft-list.offsetLeft,behavior:'instant'});
  }
  const images = byId('material-stage-images');
  images.classList.toggle('is-single', stage.files.length === 1);
  images.replaceChildren(...stage.files.map((file,i) => {
    const img = new Image(); img.alt=stage.alt[i]; watchImage(img); img.src=root+file; return img;
  }));
  byId('material-stage-title').textContent=stage.title;
  byId('material-stage-description').textContent=stage.description;
  byId('material-stage-limit').textContent=stage.limit;
}));

const cracks = {
  source:['115200-source-detail.jpg','Source detail photograph of beam 115200','Original source detail · Seller-listed rough-sawn beam chunk, 1104.90 mm long.'],
  candidate:['115200-automatic-detail.jpg','Saved automatic crack-like candidate on specimen 115200','C01 · Local-contrast computer vision identifies a crack-like candidate. It remains a visual candidate, not a certified defect grade.'],
  cloud:['115200-saved-cloud-render.png','Saved point support linked to the crack-like candidate on specimen 115200','The saved mapping links 18 existing points through the same source view. Crack depth and cross-view support remain unresolved.']
};
controls('[data-crack-view]').forEach(button => button.addEventListener('click', () => {
  const [file,alt,caption] = cracks[button.dataset.crackView];
  select(button,'[data-crack-view]');
  byId('crack-evidence-image').src=root+file;
  byId('crack-evidence-image').alt=alt;
  byId('crack-evidence-caption').textContent=caption;
}));
controls('[data-demand]').forEach(button => button.addEventListener('click', () => {
  select(button,'[data-demand]');
  const feasible = button.dataset.demand === '600';
  const line = byId('demand-result').querySelector('.ai-result-line');
  line.classList.toggle('is-feasible',feasible);
  line.querySelector('strong').textContent = feasible ? 'After trim: feasible' : 'After trim: infeasible';
  byId('demand-explanation').textContent = feasible
    ? 'The 600 mm probe still fits. Its saved allocation uses a further 3 mm kerf and leaves 225.24 mm of selected offcut.'
    : 'The 900 mm demand no longer fits the proposed 828.24 mm usable interval.';
}));

let processRecord;
let recordPromise;
async function loadRecord() {
  if (!recordPromise) recordPromise=fetch(root+'process.json').then(r=>{
    if(!r.ok)throw new Error('Process record unavailable');return r.json();
  }).then(data=>{processRecord=data;return data;}).catch(error=>{recordPromise=null;throw error;});
  return recordPromise;
}
const intentCopy = [
  ['Openness is a hard constraint.','An internal support line is excluded from the design choices. The Agent cannot trade away this requirement to make stock fit.'],
  ['Openness becomes a preference.','One internal support line becomes an allowed alternative. The requirement against splicing is retained. The controlled envelope stays unchanged.'],
  ['Fabrication gains an explicit priority.','The same support alternatives remain available. Fewer cuts becomes a recorded preference for comparing proposals; it does not erase the hard constraints.']
];
async function choosePrompt(button) {
  const buttons = controls('[data-prompt]');
  buttons.forEach(b=>b.disabled=true);
  try {
    const data=await loadRecord();
    const index=Number(button.dataset.prompt), prompt=data.agentPrompts[index];
    select(button,'[data-prompt]');
    byId('agent-raw-prompt').textContent=prompt.prompt;
    byId('agent-record-id').textContent=prompt.recordId+' · '+prompt.mode;
    byId('agent-constraint-title').textContent=intentCopy[index][0];
    byId('agent-constraint-effect').textContent=intentCopy[index][1];
    byId('constraint-support').textContent=prompt.hardConstraints.internal_support_forbidden?'Forbidden':'One line allowed if useful';
    byId('constraint-strategies').textContent=prompt.allowedChanges.support_strategy.map(value=>value==='PERIMETER_ONLY'?'Perimeter supports':'One internal support line').join(' / ');
    byId('constraint-fabrication').textContent=prompt.preferences.fabrication==='FEWER_CUTS'?'Fewer cuts and less fabrication':'Unspecified';
  } catch {
    byId('agent-record-id').textContent='The process record could not load. Select a request to retry, or download the record below.';
  } finally { buttons.forEach(b=>b.disabled=false); }
}
controls('[data-prompt]').forEach(button=>button.addEventListener('click',()=>choosePrompt(button)));

let geometry, geometryPromise, benchView='axon';
function project(x,y,z) {
  return benchView==='side' ? [y,-z] : [y*.87+x*.44, x*.29-y*.10-z];
}
function renderBench() {
  if(!geometry)return;
  // Both drawings use one coordinate transform and one bounding box.
  const bounds=[Infinity,Infinity,-Infinity,-Infinity];
  for(const model of [geometry.before,geometry.after]) for(const part of model.parts) {
    for(const [x,z] of part.polygon) for(const y of [part.y,part.y+part.thickness]) {
      const [px,py]=project(x,y,z);
      bounds[0]=Math.min(bounds[0],px);bounds[1]=Math.min(bounds[1],py);
      bounds[2]=Math.max(bounds[2],px);bounds[3]=Math.max(bounds[3],py);
    }
  }
  for(const name of ['before','after']) {
    const canvas=byId('bench-'+name), ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Canvas unavailable');
    const w=canvas.width,h=canvas.height,pad=28;
    const scale=Math.min((w-2*pad)/(bounds[2]-bounds[0]),(h-2*pad)/(bounds[3]-bounds[1]));
    const originY=(h-(bounds[3]-bounds[1])*scale)/2;
    const toScreen=(x,y,z)=>{const p=project(x,y,z);return [pad+(p[0]-bounds[0])*scale,originY+(p[1]-bounds[1])*scale];};
    ctx.clearRect(0,0,w,h);
    const parts=[...geometry[name].parts].sort((a,b)=>a.y-b.y);
    const draw=(vertices,fill)=>{
      ctx.beginPath();vertices.forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));ctx.closePath();
      ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle='#3e5948';ctx.lineWidth=.65;ctx.stroke();
    };
    for(const part of parts) {
      const front=part.polygon.map(([x,z])=>toScreen(x,part.y,z));
      const back=part.polygon.map(([x,z])=>toScreen(x,part.y+part.thickness,z));
      draw(front,'#c4cfb4');
      for(let i=0;i<front.length;i++) {
        const j=(i+1)%front.length;
        draw([front[i],front[j],back[j],back[i]],i%2?'#9cac92':'#d4ddc7');
      }
      draw(back,'#d6decb');
    }
  }
}
async function loadGeometry() {
  if(geometryPromise)return geometryPromise;
  geometryPromise=fetch(root+'bench-geometry.json').then(r=>{
    if(!r.ok)throw new Error('Geometry unavailable');return r.json();
  }).then(data=>{
    geometry=data;renderBench();
    byId('bench-geometry-status').textContent='716 matching part IDs · 1,264 retained contact pairs · working-scale geometry, source physical units unconfirmed.';
  }).catch(()=>{
    geometryPromise=null;
    byId('bench-geometry-status').textContent='The geometry diagrams could not load. Choose a view to retry, or download the paired geometry below. The numerical comparison remains available.';
  });
  return geometryPromise;
}
controls('[data-bench-view]').forEach(button=>button.addEventListener('click',()=>{
  benchView=button.dataset.benchView;select(button,'[data-bench-view]');
  if(geometry)renderBench();else loadGeometry();
}));
function activate(){
  if(document.body.dataset.activeChapter==='algorithm') {
    loadGeometry();
    if(!processRecord)choosePrompt(document.querySelector('[data-prompt][aria-pressed="true"]'));
  }
}
addEventListener('research:chapter',activate);
activate();
