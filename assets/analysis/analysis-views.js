import {escapeText as e,pane} from './desk-trace.js';
const n=v=>Number.isFinite(v)?Number(v).toLocaleString('en-GB',{maximumFractionDigits:3}):'Unavailable';

export function compactControls(scene,lc){
 return `<div class="analysis-toolbar"><label class="field"><span>Load case</span><select id="analysis-case">${scene.input.load_cases.map(k=>`<option value="${e(k)}" ${k===lc?'selected':''}>${e(k)}</option>`).join('')}</select></label><label class="field"><span>Deformation <span id="analysis-scale-label">10×</span></span><input id="analysis-scale" type="range" min="0" max="100" value="10"></label><label class="check"><input id="show-analysis-loads" type="checkbox" checked> Applied loads</label></div>`;
}

export function reactionPanel(scene,lc){
 const c=scene.result.cases[lc];
 return pane('SUPPORT REACTIONS / '+e(lc),`<p class="caption">Global axes · forces in kN</p><div class="overflow"><table class="table"><thead><tr><th>Node</th><th>Fx</th><th>Fy</th><th>Fz</th></tr></thead><tbody>${c.reactions.map(r=>`<tr><td>${e(r.node)}</td>${r.force_kN.map(v=>`<td>${n(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><details><summary>Support moments · kN·m</summary>${c.reactions.map(r=>`<p>Node ${e(r.node)}: ${r.moment_kNm.map(n).join(' / ')}</p>`).join('')}</details>`);
}

// Render only saved node coordinates, element connectivity, station forces and
// displacements. Display projection/colour changes do not solve or alter the model.
export function diagramData(scene,lc,scale=10){
 const c=scene.result.cases[lc],nodes=scene.input.nodes.map(node=>node.xyz_m);
 const records=new Map(Object.values(c.member_forces).flat().map(s=>[s.analysis_element_id,s]));
 const elements=scene.input.elements.map(el=>{
  const values=(records.get(el.id)?.force_kN||[]).map(f=>f[0]).filter(Number.isFinite);
  const axial=values.length?values.reduce((a,b)=>Math.abs(b)>Math.abs(a)?b:a):null;
  return {...el,axial};
 });
 const axialValues=elements.flatMap(el=>el.axial===null?[]:[el.axial]);
 const samples=Object.values(c.member_forces).flatMap(segs=>segs.flatMap(s=>s.force_kN.map(f=>f[0]))).filter(Number.isFinite);
 const magnitudes=c.displacements_m.map(d=>1000*Math.hypot(...d));
 const deformed=nodes.map((p,i)=>p.map((v,k)=>v+c.displacements_m[i][k]*scale));
 return {nodes,deformed,elements,magnitudes,axialMin:Math.min(...samples),axialMax:Math.max(...samples),axialAbs:Math.max(0,...axialValues.map(Math.abs)),maxTranslation:Math.max(...magnitudes)};
}

function projector(points){
 const yaw=.65,pitch=.42,cs=Math.cos(yaw),sn=Math.sin(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch);
 const rotate=p=>[p[0]*cs-p[1]*sn,-(p[0]*sn+p[1]*cs)*sp-p[2]*cp];
 const rotated=points.map(rotate),xs=rotated.map(p=>p[0]),ys=rotated.map(p=>p[1]);
 const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
 const scale=Math.min(310/Math.max(xmax-xmin,1e-6),205/Math.max(ymax-ymin,1e-6));
 return p=>{const q=rotate(p);return [180+(q[0]-(xmin+xmax)/2)*scale,119+(q[1]-(ymin+ymax)/2)*scale];};
}
const line=(a,b,colour,width=1.5,extra='')=>`<line x1="${a[0].toFixed(2)}" y1="${a[1].toFixed(2)}" x2="${b[0].toFixed(2)}" y2="${b[1].toFixed(2)}" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" ${extra}/>`;
const svg=(title,lines)=>`<svg viewBox="0 0 360 238" role="img" aria-label="${e(title)}" xmlns="http://www.w3.org/2000/svg"><title>${e(title)}</title>${lines}</svg>`;
const card=(title,value,graphic,legend,note)=>`<section class="window analysis-mini-card"><div class="window-title"><strong>${title}</strong></div><div class="mini-reading">${value}</div>${graphic}<div class="mini-caption">${legend}<p>${note}</p></div></section>`;

export function miniViews(scene,lc,scale=10,selected=null){
 const d=diagramData(scene,lc,scale),project=projector([...d.nodes,...d.deformed]);
 const forceProject=projector(d.nodes),selectedId=selected?.parent_member_id||selected?.member_id;
 const axial=d.elements.map(el=>{
  const highlight=el.parent_member_id===selectedId,weight=el.axial===null?0:Math.abs(el.axial)/Math.max(d.axialAbs,1e-12);
  const color=highlight?'#e38d2c':el.axial===null?'#a2a493':Math.abs(el.axial)<1e-9?'#889080':el.axial<0?'#42668e':'#ae5141';
  return line(forceProject(d.nodes[el.nodes[0]]),forceProject(d.nodes[el.nodes[1]]),color,highlight?3:1+2*weight);
 }).join('');
 const ghost=d.elements.map(el=>line(project(d.nodes[el.nodes[0]]),project(d.nodes[el.nodes[1]]),'#bbbba8',.8)).join('');
 const deformed=d.elements.map(el=>{
  const mag=Math.max(...el.nodes.map(i=>d.magnitudes[i])),t=mag/Math.max(d.maxTranslation,1e-12),colour=`hsl(${218-208*t} 48% 44%)`;
  return line(project(d.deformed[el.nodes[0]]),project(d.deformed[el.nodes[1]]),el.parent_member_id===selectedId?'#e38d2c':colour,el.parent_member_id===selectedId?3:1.7);
 }).join('');
 return card('AXIAL FORCE / N',`<b>${n(d.axialMin)} to ${n(d.axialMax)}</b><span>kN · ${e(lc)}</span>`,svg('Saved signed axial force / '+lc,axial),'<div class="mini-key"><span><i style="background:#42668e"></i>Negative</span><span><i style="background:#ae5141"></i>Positive</span></div>','Line colour: signed N at the peak absolute station per element. Range: all saved stations.')+card('DISPLACEMENT / |u|',`<b>${n(d.maxTranslation)} mm</b><span>Maximum · ${e(lc)}</span>`,svg('Saved displacement / '+lc,ghost+deformed),`<div class="mini-scale"><span>0</span><i></i><span>${n(d.maxTranslation)} mm</span></div>`,`Shape ×${n(scale)} · grey: undeformed. Actual nodal translation, not a capacity check.`);
}
