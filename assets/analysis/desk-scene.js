import {sceneProjection,COLORS} from './assembly-scene.js';

// A shared, bounded decode cache keyed by the content-addressed appearance URL.
// Re-entering a view reuses pixels; original evidence alpha is never altered.
const decodedAppearances=new Map();
export const appearanceCacheStats={decodes:0,hits:0};
// Display-only interior of every representative crop. Avoid photo borders and
// saved crop padding; this never changes masks, evidence, or physical cut intervals.
const CROP_U=.15,CROP_V=.04;
export function decodeAppearance(url){
  if(decodedAppearances.has(url)){appearanceCacheStats.hits++;return decodedAppearances.get(url);}
  const promise=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{try{
    const c=document.createElement('canvas');c.width=img.width;c.height=img.height;
    const cx=c.getContext('2d');cx.drawImage(img,0,0);appearanceCacheStats.decodes++;
    resolve(cx.getImageData(0,0,c.width,c.height));
  }catch(error){reject(error);}};img.onerror=()=>reject(Error('Appearance unavailable'));img.src=url;});
  decodedAppearances.set(url,promise);promise.catch(()=>decodedAppearances.delete(url));
  if(decodedAppearances.size>64)decodedAppearances.delete(decodedAppearances.keys().next().value);
  return promise;
}
export function appearanceScales(members,textures=new Map()){
  const result=new Map();
  for(const m of members){const size=m.appearance?.crop_metadata?.display_dimensions_px,tex=textures.get(m.material_id);
    const w=tex?.width||size?.[0],h=tex?.height||size?.[1];if(!w||!h)continue;
    // One uniform aspect-preserving scale for every assigned part of a material,
    // with a 2-pixel sampling gutter. Never stretch, tile, or run outside the crop.
    const scale=Math.max(m.appearance?.display_mm_per_pixel||2,2*m.box.half[0]/Math.max(1,w*(1-2*CROP_U)-4),2*Math.max(m.box.half[1],m.box.half[2])/Math.max(1,h*(1-2*CROP_V)-4));
    result.set(m.material_id,Math.max(result.get(m.material_id)||0,scale));
  }
  return result;
}
export function faceAppearance(member,faceIndex,enabled=true){
  if(!enabled)return {color:COLORS[member.group]||'#c0b7a6',kind:'ROLE_COLOR'};
  return {color:member.appearance?.color||'#aaa18f',kind:faceIndex>=4?'UNOBSERVED_END_TONE':member.appearance?.texture?'SOURCE_REPRESENTATIVE':'NEUTRAL_REPRESENTATIVE'};
}

export function appearanceFace(member){
  if(member.appearance_face_index!=null)return member.appearance_face_index;
  const axis=member.box.half[1]>=member.box.half[2]?2:1;
  const camera=[-Math.sin(.65)*Math.cos(.42),-Math.cos(.65)*Math.cos(.42),Math.sin(.42)];
  const positive=member.box.axes[axis].reduce((s,v,i)=>s+v*camera[i],0)>=0;
  return axis===2?(positive?1:0):(positive?3:2);
}

export function placed(members,amount=0,mode='assembled'){
  if(!members.length)return [];
  const longest=Math.max(...members.map(m=>m.box.half[0]*2));
  const rowPitch=Math.max(...members.map(m=>Math.max(m.box.half[1],m.box.half[2])*2))+100;
  return members.map((m,index)=>{
    // Freeze the illustrative local face before applying display-only transforms.
    // It never follows the orbit camera or claims recovered source-to-member UVs.
    m={...m,appearance_face_index:appearanceFace(m)};
    if(mode==='flat')return {...m,box:{...m.box,center:[(index%4)*(longest+250)+m.box.half[0],Math.floor(index/4)*rowPitch,Math.min(m.box.half[1],m.box.half[2])],axes:m.box.half[2]>m.box.half[1]?[[1,0,0],[0,0,-1],[0,1,0]]:[[1,0,0],[0,1,0],[0,0,1]]}};
    const normal=m.normal?.some(Boolean)?m.normal:({SOUTH:[0,-1,0],NORTH:[0,1,0],WEST:[-1,0,0],EAST:[1,0,0]}[m.face]||[0,0,0]);
    const factor=m.group==='Backing'?.5:1;
    return {...m,box:{...m.box,center:m.box.center.map((v,i)=>v+normal[i]*amount*factor)}};
  });
}
export function draw(ctx,members,width,height,options={}){
  width=Math.round(width);height=Math.round(height);
  // Software depth buffer avoids painter-order artifacts on long crossing boards.
  // It is the same deterministic box renderer in the interactive scene and the cover.
  const scene=sceneProjection(members,{w:width,h:height},{yaw:.65,pitch:.42,...options});
  const scales=options.appearanceScales||appearanceScales(options.appearanceReference||members,options.textures);
  const pixels=ctx.createImageData(width,height),rgba=pixels.data,depth=new Float32Array(width*height).fill(-Infinity),hits=new Int32Array(width*height).fill(-1);
  for(let i=0;i<rgba.length;i+=4){rgba[i]=219;rgba[i+1]=224;rgba[i+2]=208;rgba[i+3]=255;}
  function triangle(a,b,c,color,index,texture,uvs){
    const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-9)return;
    const minX=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),maxX=Math.min(width-1,Math.ceil(Math.max(a[0],b[0],c[0])));
    const minY=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),maxY=Math.min(height-1,Math.ceil(Math.max(a[1],b[1],c[1])));
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
      const u=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/den;
      const v=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/den,w=1-u-v;
      if(u<0||v<0||w<0)continue;const z=u*a[2]+v*b[2]+w*c[2],at=y*width+x;
      if(z<depth[at])continue;depth[at]=z;hits[at]=index;const off=at*4;let rr=color[0],gg=color[1],bb=color[2];
      if(texture){const tx=Math.floor((u*uvs[0][0]+v*uvs[1][0]+w*uvs[2][0])*texture.width),ty=Math.floor((u*uvs[0][1]+v*uvs[1][1]+w*uvs[2][1])*texture.height);
        // Alpha composites over a source-consistent representative tone, never
        // green scene background. This does not fill or modify source evidence.
        if(tx>=0&&tx<texture.width&&ty>=0&&ty<texture.height){const ti=(ty*texture.width+tx)*4,alpha=texture.data[ti+3]/255,base=1-alpha;
          rr=rr*base+texture.data[ti]*alpha*.88;gg=gg*base+texture.data[ti+1]*alpha*.88;bb=bb*base+texture.data[ti+2]*alpha*.88;}}
      rgba[off]=rr;rgba[off+1]=gg;rgba[off+2]=bb;
    }
  }
  scene.faces.forEach((f,index)=>{
    const hex=faceAppearance(f.member,f.index,options.appearance!==false&&!!f.member.stock_id).color;
    let rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));const shade=1-Math.max(0,.20-.16*f.normal.reduce((s,v,i)=>s+v*[.3,-.5,.8][i],0));
    rgb=rgb.map(v=>v*shade);if(f.member.member_id===options.selected)rgb=rgb.map((v,i)=>v*.65+[223,125,55][i]*.35);
    const tex=options.appearance!==false&&f.index<4?options.textures?.get(f.member.material_id):null;
    const uv=appearanceUV(f.member,f.index,tex,scales.get(f.member.material_id));
    triangle(f.points[0],f.points[1],f.points[2],rgb,index,tex,[uv[0],uv[1],uv[2]]);triangle(f.points[0],f.points[2],f.points[3],rgb,index,tex,[uv[0],uv[2],uv[3]]);
  });
  // Draw only depth-visible edges; no internal triangle diagonals.
  scene.faces.forEach((f,index)=>{for(let i=0;i<4;i++){
    const a=f.points[i],b=f.points[(i+1)%4],steps=Math.ceil(Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1])));
    for(let j=0;j<=steps;j++){const t=j/Math.max(1,steps),x=Math.round(a[0]+t*(b[0]-a[0])),y=Math.round(a[1]+t*(b[1]-a[1]));
      if(x<0||x>=width||y<0||y>=height)continue;const at=y*width+x,z=a[2]+t*(b[2]-a[2]);
      if(z<depth[at]-2)continue;const o=at*4,color=f.member.member_id===options.selected?[193,93,39]:[117,106,84];
      rgba[o]=color[0];rgba[o+1]=color[1];rgba[o+2]=color[2];
    }
  }});
  ctx.putImageData(pixels,0,0);
  drawAnalysis(ctx,scene,options.analysis,options.selected);
  return {...scene,pick:(x,y)=>{if(x<0||y<0||x>=width||y>=height)return null;const i=hits[Math.floor(y)*width+Math.floor(x)];return i>=0?scene.faces[i]:null;}};
}
export function appearanceUV(member,faceIndex,texture,scale){
  if(!texture)return [[0,0],[1,0],[1,1],[0,1]];
  const mm=scale||appearanceScales([member],new Map([[member.material_id,texture]])).get(member.material_id),L=member.box.half[0]*2,W=member.box.half[faceIndex<2?1:2]*2;
  const u=L/(mm*texture.width),v=W/(mm*texture.height);
  // Vary only the crop window within existing pixels to avoid identical strips
  // on adjacent parts. This display-only choice is not stock/photo registration.
  let seed=0;for(const ch of member.member_id)seed=(Math.imul(seed,31)+ch.charCodeAt(0))>>>0;
  const gutter=CROP_V+2/texture.height,cy=v/2+gutter+Math.max(0,1-v-2*gutter)*(seed%997)/996;
  return [[.5-u/2,cy-v/2],[.5+u/2,cy-v/2],[.5+u/2,cy+v/2],[.5-u/2,cy+v/2]];
}
export function cover(members,revision){
  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=700;
  draw(canvas.getContext('2d'),members,1000,700);
  return {revision,url:canvas.toDataURL('image/png')};
}
export function mount(canvas,members,{onSelect=()=>{},onHover=()=>{},onProjection=()=>{},appearanceReference=members}={}){
  const state={yaw:.65,pitch:.42,zoom:1,pan:[0,0],explode:0,selected:null,mode:'assembled',textures:new Map(),appearanceScales:appearanceScales(appearanceReference)};let scene,disposed=false,drag=null,frame=null;
  function render(){if(disposed||frame!==null)return;frame=requestAnimationFrame(()=>{frame=null;
    if(disposed||!canvas.isConnected)return;
    const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
    // Depth buffer uses CSS pixels so hit testing and drawing share one coordinate frame.
    if(canvas.width!==Math.round(r.width))canvas.width=Math.round(r.width);if(canvas.height!==Math.round(r.height))canvas.height=Math.round(r.height);
    const ctx=canvas.getContext('2d');
    scene=draw(ctx,placed(members,state.explode,state.mode),r.width,r.height,state);
    onProjection(scene);
  });}
  canvas.onpointerdown=e=>{if(e.button!==0)return;canvas.focus({preventScroll:true});drag={start:[e.clientX,e.clientY],last:[e.clientX,e.clientY],moved:false,pan:e.shiftKey};canvas.setPointerCapture(e.pointerId);};
  canvas.onpointermove=e=>{if(!drag){if(scene){const r=canvas.getBoundingClientRect();onHover(scene.pick(e.clientX-r.left,e.clientY-r.top)?.member||null,{x:e.clientX,y:e.clientY});}return;}const dx=e.clientX-drag.last[0],dy=e.clientY-drag.last[1];drag.moved ||= Math.hypot(e.clientX-drag.start[0],e.clientY-drag.start[1])>4;
    if(drag.moved){if(drag.pan){state.pan[0]+=dx;state.pan[1]+=dy;}else{state.yaw+=dx*.008;state.pitch=Math.min(1.4,Math.max(-1.4,state.pitch+dy*.006));}render();}drag.last=[e.clientX,e.clientY];};
  canvas.onpointerup=e=>{if(drag&&!drag.moved&&scene){const r=canvas.getBoundingClientRect(),hit=scene.pick(e.clientX-r.left,e.clientY-r.top);if(hit)onSelect(hit.member.member_id);}drag=null;};
  canvas.onpointercancel=()=>drag=null;
  canvas.onpointerleave=()=>onHover(null);
  const wheel=e=>{e.preventDefault();state.zoom=Math.min(4,Math.max(.5,state.zoom*Math.exp(-e.deltaY*.001)));render();};canvas.addEventListener('wheel',wheel,{passive:false});
  canvas.onkeydown=e=>{if(e.key==='0'){Object.assign(state,{yaw:.65,pitch:.42,zoom:1,pan:[0,0]});}else if(e.key==='ArrowLeft')state.yaw-=.14;else if(e.key==='ArrowRight')state.yaw+=.14;else if(e.key==='ArrowUp')state.pitch=Math.min(1.4,state.pitch+.1);else if(e.key==='ArrowDown')state.pitch=Math.max(-1.4,state.pitch-.1);else return;e.preventDefault();render();};
  const observer=new ResizeObserver(render);observer.observe(canvas);render();
  const seen=new Set();for(const m of members){if(!m.appearance?.texture||seen.has(m.material_id))continue;seen.add(m.material_id);decodeAppearance(m.appearance.texture).then(pixels=>{if(disposed)return;state.textures.set(m.material_id,pixels);render();}).catch(()=>{/* Labelled source-tone fallback remains visible. */});}
  return {update:patch=>{Object.assign(state,patch);render();},dispose:()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();canvas.removeEventListener('wheel',wheel);canvas.onpointerdown=canvas.onpointermove=canvas.onpointerup=canvas.onpointercancel=canvas.onpointerleave=canvas.onkeydown=null;}};
}

export function drawAnalysis(ctx,projection,a,selected){
 if(!a?.input||!projection.project)return;const input=a.input,result=a.result?.status==='COMPLETED_CONCEPTUAL'?a.result?.cases?.[a.case]:null;
 // Picking inspects a part; it must not hide the complete assembled result.
 // Result focus is separate and opt-in, so load-only coverings cannot blank it.
 const selectedMember=projection.faces.find(f=>f.member.member_id===selected)?.member;selected=a.focusSelected?(selectedMember?.parent_member_id||selected):null;ctx.save();
 ctx.strokeStyle='#765786';ctx.lineWidth=1.2;
 for(const c of input.connectors||[]){if(selected&&c.component_id!==selected&&c.host_id!==selected)continue;const p=projection.project(input.nodes[c.nodes[0]].xyz_m.map(x=>x*1000));ctx.beginPath();ctx.arc(p[0],p[1],3,0,Math.PI*2);ctx.stroke();}
 if(a.showLoads){const byMember=new Map();for(const l of input.loads.filter(l=>l.case===a.case)){const v=byMember.get(l.member_id)||[0,0,0];l.force_kN.forEach((f,k)=>v[k]+=f);byMember.set(l.member_id,v);}
  ctx.strokeStyle='#3366ff';ctx.fillStyle='#3366ff';ctx.lineWidth=1.3;
  for(const m of input.members){if(selected&&m.member_id!==selected)continue;const force=byMember.get(m.member_id);if(!force||Math.hypot(...force)===0||!m.node_indices.length)continue;const xyz=input.nodes[m.node_indices[Math.floor(m.node_indices.length/2)]].xyz_m.map(v=>v*1000),p=projection.project(xyz),norm=Math.hypot(...force),q=projection.project(xyz.map((v,k)=>v+force[k]/norm*240)),dx=q[0]-p[0],dy=q[1]-p[1],angle=Math.atan2(dy,dx);ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.lineTo(q[0]-7*Math.cos(angle-.4),q[1]-7*Math.sin(angle-.4));ctx.moveTo(q[0],q[1]);ctx.lineTo(q[0]-7*Math.cos(angle+.4),q[1]-7*Math.sin(angle+.4));ctx.stroke();}
 }
 if(result){ctx.strokeStyle='#b73b2a';ctx.lineWidth=2;for(const el of input.elements){if(selected&&el.parent_member_id!==selected)continue;ctx.beginPath();el.nodes.forEach((ni,j)=>{const p=projection.project(input.nodes[ni].xyz_m.map((v,k)=>(v+(result.displacements_m[ni]?.[k]||0)*a.scale)*1000));j?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]);});ctx.stroke();}}
 ctx.restore();
}
