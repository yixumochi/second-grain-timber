// Actual saved solid geometry; shared by interactive picking and CPU MP4 export.
import {projectScene,pointInPolygon} from './geometry-helpers.js';
export {pointInPolygon};
const sum=(a,f)=>a.reduce((s,x)=>s+f(x),0),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),sub=(a,b)=>a.map((x,i)=>x-b[i]);
const colors={POST:'#9b7c59',PRIMARY:'#aa8353',SECONDARY:'#bbaa83',BRACE:'#8b7656'};
export function createModel(data){const partMap=new Map(data.geometry.parts.map(p=>[p.member_id,p]));const barMap=new Map(data.allocation.cut_bars.map(b=>[b.stock_id,b]));const materialMap=new Map(data.materials.map(m=>[m.material_id,m]));const sorted=[...barMap.values()].sort((a,b)=>b.pieces.length-a.pieces.length||b.residual_mm-a.residual_mm);const first=sorted[0],second=sorted.find(b=>b.stock_id!==first.stock_id&&b.pieces.some(x=>x.role==='POST'))||sorted[1];const bars=[first,second,...sorted.filter(b=>b!==first&&b!==second)];return{data,partMap,barMap,materialMap,bars,duration:48};}
export function facesOf(p,index=0,mode='assembled',delta=[0,0,0]){
  let vertices=p.vertices_mm;
  if(mode==='flat')vertices=vertices.map(v=>{const q=sub(v,p.start_mm);return[dot(q,p.axis)+(index%8)*3500,dot(q,p.local_y)+Math.floor(index/8)*220,dot(q,p.local_z)+180];});
  else if(mode==='exploded'){const centre=p.start_mm.map((x,i)=>(x+p.end_mm[i])/2),role=p.role==='POST'?0:p.role==='PRIMARY'?400:p.role==='BRACE'?700:1000;vertices=vertices.map(v=>[v[0]+(centre[0]-2400)*.12,v[1]+(centre[1]-1200)*.16,v[2]+role]);}
  vertices=vertices.map(v=>v.map((x,i)=>x+delta[i]));
  return p.faces.map((ids,i)=>{const vv=ids.map(k=>vertices[k]),a=sub(vv[1],vv[0]),b=sub(vv[2],vv[0]);let n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],l=Math.hypot(...n);n=n.map(x=>x/l);return{vertices:vv,normal:n,part:p,kind:i<2?'end':'side'};});
}
const heat=t=>{const v=Math.min(1,Math.max(0,t));return`rgb(${Math.round(60+180*v)},${Math.round(120-45*v)},${Math.round(145-105*v)})`;};
function polygon(ctx,pts){ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();}
export function renderScene(ctx,w,h,model,opts={}){
  const camera=opts.camera||{yaw:.62,pitch:.31,zoom:1,pan:[0,0]},parts=[...model.partMap.values()],fit=[];let faces=[];
  for(let i=0;i<parts.length;i++){
    let p=parts[i],delta=[0,0,0];
    if(opts.deformation){
      const mm=model.data.analysis.members.find(m=>m.member_id===p.member_id),nodes=model.data.analysis.nodes;
      const samples=mm.node_ids.map(n=>({t:dot(sub(nodes[n].xyz_m.map(x=>x*1000),p.start_mm),p.axis),d:opts.deformation[n]})).sort((a,b)=>a.t-b.t);
      const move=v=>{const t=dot(sub(v,p.start_mm),p.axis);let i=0;while(i<samples.length-2&&samples[i+1].t<t)i++;const a=samples[i],b=samples[Math.min(i+1,samples.length-1)],f=Math.max(0,Math.min(1,(t-a.t)/Math.max(1e-9,b.t-a.t)));return v.map((x,k)=>x+(a.d[k]*(1-f)+b.d[k]*f)*1000*(opts.factor||0));};
      p={...p,vertices_mm:p.vertices_mm.map(move)};
    }
    fit.push(...facesOf(p,i,opts.mode||'assembled'));
    if(opts.filter&&opts.filter!=='all'&&p.role!==opts.filter)continue;
    if(opts.flight?.has(p.member_id))delta=delta.map((x,k)=>x+([0,-3000,1800][k])*(1-opts.flight.get(p.member_id)));
    faces.push(...facesOf(p,i,opts.mode||'assembled',delta));
  }
  // Fit against unchanged complete geometry, including when allocation has not placed parts.
  const projected=projectScene([...fit.map(f=>({...f,fitOnly:true})),...faces],{w,h},camera);
  const hit=[];const max=opts.analysisMax||1;
  for(const f of projected.faces){
    if(f.fitOnly)continue;
    const id=f.part.member_id,p=f.part,assigned=p.assignment,m=model.materialMap.get(assigned.material_id),active=id===opts.selected||opts.focus?.has(id),placed=!opts.placed||opts.placed.has(id),ghost=!placed&&(!active||!opts.flight?.has(id));
    if(ghost){ctx.fillStyle='rgba(82,90,69,0.055)';ctx.strokeStyle='rgba(82,90,69,0.14)';}
    else{ctx.fillStyle=opts.memberValues?heat(opts.memberValues.get(id)/max):(m?.appearance?.color||colors[p.role]);ctx.strokeStyle=active?'#bf643b':'rgba(52,49,33,.6)';}
    polygon(ctx,f.points);ctx.fill();
    const tex=opts.textures?.get(assigned.material_id);
    if(tex&&!opts.memberValues&&!ghost&&f.kind==='side'&&f.points.length===4){
      // Source-linked crop follows the longest projected edge. Representative, not registered UVs.
      const points=f.points,edges=points.map((a,i)=>Math.hypot(points[(i+1)%4][0]-a[0],points[(i+1)%4][1]-a[1]));const k=edges.indexOf(Math.max(...edges)),a=points[k],b=points[(k+1)%4],d=points[(k+3)%4];
      const mmPerPixel=m.appearance?.display_mm_per_pixel||2,cropW=Math.min(tex.width,p.installed_axis_length_mm/mmPerPixel),cropH=Math.min(tex.height,Math.max(...p.section_mm)/mmPerPixel),cropX=(assigned.source_interval_mm[0]/mmPerPixel)%Math.max(1,tex.width-cropW);
      ctx.save();polygon(ctx,points);ctx.clip();ctx.globalAlpha=.3;ctx.transform((b[0]-a[0])/cropW,(b[1]-a[1])/cropW,(d[0]-a[0])/cropH,(d[1]-a[1])/cropH,a[0],a[1]);ctx.drawImage(tex,cropX,0,cropW,cropH,0,0,cropW,cropH);ctx.restore();
    }
    const shade=Math.max(0,dot(f.normal,[.3,-.4,.85]));if(!ghost){ctx.fillStyle=`rgba(255,248,221,${.10+shade*.18})`;polygon(ctx,f.points);ctx.fill();}
    ctx.lineWidth=active?1.7:.55;polygon(ctx,f.points);ctx.stroke();if(placed||active)hit.push({memberId:id,points:f.points.map(p=>p.slice(0,2))});
  }
  return{hitTargets:hit,project:projected.project};
}
export function drawCutting(ctx,w,h,bar,model,options={}){
  ctx.fillStyle='#ede9dc';ctx.fillRect(0,0,w,h);const x0=18,x1=w-18,y=55,span=x1-x0,scale=span/bar.source_length_mm;ctx.fillStyle='#333a2d';ctx.font='14px monospace';ctx.fillText(bar.stock_id+' / '+bar.source_length_mm.toFixed(1)+' mm',x0,25);
  ctx.fillStyle='#c1ba9c';ctx.fillRect(x0,y,span,27);
  const f=options.stageFraction??1,reveal=Math.max(0,Math.min(1,(f-.3)/.35)),count=Math.ceil(bar.kerf_intervals_mm.length*reveal);
  if(f>=.3)for(const [i,p] of bar.pieces.entries()){const [a,b]=p.source_interval_mm;if(i>=count)continue;ctx.fillStyle=p.member_id?'#a38759':'#aa8a9f';ctx.fillRect(x0+a*scale,y,(b-a)*scale,27);ctx.strokeStyle='#393c2f';ctx.strokeRect(x0+a*scale,y,(b-a)*scale,27);if(span>450){ctx.save();ctx.beginPath();ctx.rect(x0+a*scale,y,(b-a)*scale,27);ctx.clip();ctx.fillStyle='#242b21';ctx.font='11px monospace';ctx.fillText(p.part_id.split('::')[1],x0+a*scale+3,y+18);ctx.restore();}}
  for(const [a,b] of bar.kerf_intervals_mm.slice(0,count)){ctx.fillStyle='#bd6041';ctx.fillRect(x0+(a+bar.usable_start_mm)*scale,y,Math.max(1,(b-a)*scale),27);}
  const remaining=bar.parent_residual_intervals_mm||[];if(f>=.65){ctx.fillStyle='#5d7564';for(const [a,b] of remaining)ctx.fillRect(x0+a*scale,y,(b-a)*scale,27);}
  ctx.fillStyle='#3a4032';ctx.font='12px monospace';ctx.fillText(`${bar.pieces.filter(p=>p.member_id).length} installed · ${bar.pieces.filter(p=>!p.member_id).length} surplus · kerf ${bar.kerf_loss_mm.toFixed(1)} mm`,x0,110);ctx.fillText(`Retained residual ${bar.residual_mm.toFixed(1)} mm`,x0,132);
}
export function playbackState(model,t){
  t=Math.max(0,Math.min(model.duration,t));const durations=[10,10,...model.bars.slice(2).map(()=>26/(model.bars.length-2))];let start=0,idx=0;
  while(idx<durations.length-1&&t>=start+durations[idx]){start+=durations[idx++];}
  const fraction=t>=46?1:Math.min(1,(t-start)/durations[idx]),bar=model.bars[idx],placed=new Set();for(const b of model.bars.slice(0,idx))for(const p of b.pieces)if(p.member_id)placed.add(p.member_id);
  const focused=bar.pieces.filter(p=>p.member_id).map(p=>p.member_id);const flight=new Map();if(fraction>.65)for(const id of focused){flight.set(id,Math.min(1,(fraction-.65)/.3));if(fraction>=.95)placed.add(id);}
  if(t>=46)for(const p of model.partMap.values())placed.add(p.member_id);
  return{bar,placed,focus:new Set(focused),flight,fraction,stage:t>=46?'COMPLETE PAVILION':fraction<.3?'SOURCE STOCK':fraction<.65?'SAVED CUTTING MARKS / CUT PARTS':'TARGET POSITIONS / PLACEMENT'};
}
export function renderAllocationFrame(ctx,w,h,model,t,options={}){
  const state=playbackState(model,t);ctx.fillStyle='#f4eddb';ctx.fillRect(0,0,w,h);ctx.fillStyle='#283226';ctx.font=`bold ${Math.round(w/52)}px Arial`;ctx.fillText('CASE 3 / FROM STOCK TO OPEN PAVILION',w*.035,h*.065);ctx.font=`${Math.round(w/88)}px monospace`;ctx.fillText(state.stage,w*.035,h*.105);
  ctx.save();ctx.translate(w*.34,h*.13);const render=renderScene(ctx,w*.63,h*.68,model,{...options,placed:state.placed,focus:state.focus,flight:state.flight});ctx.restore();
  ctx.save();ctx.translate(w*.02,h*.32);drawCutting(ctx,w*.30,h*.27,state.bar,model,{stageFraction:state.fraction});ctx.restore();ctx.fillStyle='#394432';ctx.font=`${Math.round(w/95)}px monospace`;
  ctx.fillText('Parent stock → saved crosscuts → actual cut parts',w*.035,h*.22);let y=h*.66;
  for(const p of state.bar.pieces.filter(p=>p.member_id).slice(0,5)){ctx.fillText(p.part_id,w*.035,y);ctx.fillText(p.member_id,w*.035,y+18);y+=40;}
  ctx.font=`bold ${Math.round(w/66)}px Arial`;ctx.fillText(`${state.placed.size} / 98 installed members`,w*.57,h*.865);ctx.font=`${Math.round(w/95)}px monospace`;ctx.fillText('Allocation visualization — not a validated physical assembly sequence',w*.035,h*.95);
  return{...state,hitTargets:render.hitTargets.map(x=>({...x,points:x.points.map(p=>[p[0]+w*.34,p[1]+h*.13])}))};
}
