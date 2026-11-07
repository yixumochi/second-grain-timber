// Shared, deterministic Canvas allocation playback. No DOM, network or mutations.
import {normalizePart,extrudePart,projectScene} from './case2-geometry.js';
const W=1280,H=720,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
const sum=(rows,fn)=>rows.reduce((n,r)=>n+fn(r),0);
const span=rows=>sum(rows||[],r=>r[1]-r[0]);
const fmt=(n,d=1)=>Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const colours={bg:'#f3f1e9',paper:'#fcfbf6',ink:'#253d34',muted:'#69766b',rule:'#d9ded1',green:'#3f7860',gold:'#cf9637',red:'#af5848',blue:'#668493',surplus:'#886d91',ghost:'#e1e5d8'};
const mainRect={x:470,y:159,w:778,h:300},detailRect={x:469,y:505,w:355,h:124};
const phases=['source','cutmarks','separated','targets','placement'];
const stageNames={source:'Read the source bar',cutmarks:'Mark the saved cuts',separated:'Separate the cut outputs',targets:'Find the true member locations',placement:'Move strips to their allocations',final:'All 716 allocations shown'};

export function createPlaybackModel(bundle,plan){
  if(plan.runId!==bundle.allocation?.run_id||plan.geometryId!==bundle.geometry?.geometry_id)throw Error('Playback plan does not match the saved allocation / geometry.');
  const parts=bundle.geometry.parts.map(normalizePart),partMap=new Map(parts.map(p=>[p.part_id,p]));
  const assignmentMap=new Map(bundle.allocation.assignments.map(a=>[a.member_id||a.part_id,a]));
  const materialMap=new Map((bundle.materials||[]).map(m=>[String(m.material_id),m]));
  const bars=new Map(plan.bars.map(b=>[b.stockId,b]));
  const timeline=plan.timeline.slice().sort((a,b)=>a.startSec-b.startSec);
  if(bars.size!==120||timeline.length!==120||new Set(timeline.map(e=>e.stockId)).size!==120||parts.length!==716)throw Error('Playback must visit exactly 120 unique bars and all 716 real members.');
  const arrival=new Map(),entryByStock=new Map();
  for(const entry of timeline){
    const bar=bars.get(entry.stockId);if(!bar)throw Error('Unknown timeline stock '+entry.stockId);
    const installed=bar.pieces.filter(p=>p.kind==='installed');
    const placement=entry.phases.find(p=>p.name==='placement');
    if(!placement)throw Error('Missing placement phase.');
    installed.forEach((piece,index)=>{
      if(!partMap.has(piece.memberId)||arrival.has(piece.memberId))throw Error('Unknown or duplicated installed member '+piece.memberId);
      const a=assignmentMap.get(piece.memberId),iv=a.source_interval_mm;
      if(a.stock_id!==bar.stockId||Math.abs(iv[0]-piece.startMm)>1e-5||Math.abs(iv[1]-piece.endMm)>1e-5)throw Error('Playback cut interval differs from saved assignment.');
      arrival.set(piece.memberId,placement.startSec+(placement.endSec-placement.startSec)*(index+1)/installed.length);
    });
    entryByStock.set(bar.stockId,entry);
  }
  if(arrival.size!==716)throw Error('Playback does not cover all installed members.');
  const faces=parts.flatMap(p=>extrudePart(p));
  const scene=projectScene(faces,{w:mainRect.w,h:mainRect.h},{yaw:1.12,pitch:.53,zoom:1,pan:[0,0]});
  return {bundle,plan,durationSeconds:Number(plan.durationSec),fps:Number(plan.fps)||30,
    parts,partMap,assignmentMap,materialMap,bars,timeline,arrival,entryByStock,scene,detailScenes:new Map(),
    count:parts.length,sourceBarCount:bars.size};
}

function stateAt(model,time){
  const t=clamp(Number(time)||0,0,model.durationSeconds),final=t>=model.plan.finalReveal.startSec;
  const entry=final?null:model.timeline.find(e=>t>=e.startSec&&t<e.endSec)||model.timeline[0];
  const bar=entry?model.bars.get(entry.stockId):null;
  const phase=entry?(entry.phases.find(p=>t>=p.startSec&&t<p.endSec)||entry.phases.at(-1)):null;
  const stage=final?'final':phase.name,p=phase?clamp((t-phase.startSec)/(phase.endSec-phase.startSec)):1;
  const placed=new Set([...model.arrival].filter(([,at])=>t>=at-1e-9).map(([id])=>id));
  const members=bar?.pieces.filter(p=>p.kind==='installed')||[];
  let activeIndex=0,motion=0;
  if(stage==='targets')activeIndex=Math.min(members.length-1,Math.floor(p*members.length));
  if(stage==='placement'){
    const q=p*members.length;activeIndex=Math.min(members.length-1,Math.floor(q));motion=q-activeIndex;
  }
  const active=members[Math.max(0,activeIndex)]||null;
  const completed=model.timeline.filter(e=>e.endSec<=t+1e-9);
  const ledger={completedSourceBars:completed.length,totalSourceBars:120,
    installedLengthMm:sum([...placed],id=>model.partMap.get(id).blank_length_mm),
    surplusPieces:sum(model.timeline.filter(e=>e.phases.find(p=>p.name==='separated').startSec<=t),e=>model.bars.get(e.stockId).pieces.filter(p=>p.kind==='surplus').length),
    finalTotals:model.plan.totals,
    current:bar?{sourceLengthMm:bar.sourceLengthMm,installedLengthMm:sum(members,p=>p.lengthMm),
      surplusLengthMm:sum(bar.pieces.filter(p=>p.kind==='surplus'),p=>p.lengthMm),
      kerfLengthMm:span(bar.kerfIntervalsMm),residualLengthMm:span(bar.residualIntervalsMm),
      excludedLengthMm:span(bar.excludedIntervalsMm),surplusCount:bar.pieces.filter(p=>p.kind==='surplus').length}:null};
  return {timeSeconds:t,stage,phaseProgress:p,entry,bar,placed,active,motion,final,ledger,
    focusedStockId:bar?.stockId||null,focusedMemberIds:members.map(p=>p.memberId),installedCount:placed.size,
    accelerated:!!entry&&!entry.focused};
}

export function getFrameState(model,timeSeconds){return stateAt(model,timeSeconds);}

function text(ctx,value,x,y,size=14,colour=colours.ink,bold=false){ctx.fillStyle=colour;ctx.font=`${bold?'600 ':''}${size}px Arial`;ctx.fillText(String(value),x,y);}
function rule(ctx,x,y,x2,y2,colour=colours.rule,width=1){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.strokeStyle=colour;ctx.lineWidth=width;ctx.stroke();}
function polygon(ctx,points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();}
function box(ctx,x,y,w,h){ctx.fillStyle=colours.paper;ctx.fillRect(x,y,w,h);ctx.strokeStyle=colours.rule;ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);}
function rectQuad(x,y,w,h){return [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];}
function translate(poly,x,y){return poly.map(p=>[p[0]+x,p[1]+y]);}
function textureFor(textures,id){const item=textures instanceof Map?textures.get(String(id)):textures?.[String(id)];return item?.ready===false?null:item;}
function colourFor(model,id){return model.materialMap.get(String(id))?.appearance?.color||'#b5a17e';}
function textureQuad(ctx,quad,texture,base,alpha=1){
  ctx.save();ctx.globalAlpha=alpha;polygon(ctx,quad);ctx.fillStyle=base;ctx.fill();
  if(texture?.image){ctx.clip();const p=quad[0],u=quad[1],v=quad[3],im=texture.image;ctx.transform((u[0]-p[0])/im.width,(u[1]-p[1])/im.width,(v[0]-p[0])/im.height,(v[1]-p[1])/im.height,p[0],p[1]);ctx.drawImage(im,0,0);}
  ctx.restore();polygon(ctx,quad);ctx.strokeStyle='#716b59';ctx.lineWidth=.8;ctx.stroke();
}
function representative(ctx,face,scene,tex){
  if(face.kind==='edge'||!tex?.image)return;
  const t=face.part.source_coordinate_transform,long=t.longitudinal_direction,across=t.width_direction;
  const c=[0,1,2].map(i=>sum(face.vertices,v=>v[i])/face.vertices.length),unit=tex.mmPerPixel||2,im=tex.image;
  const corner=c.map((v,i)=>v-long[i]*im.width*unit/2+across[i]*im.height*unit/2);
  const p=scene.project(corner),u=scene.project(corner.map((v,i)=>v+long[i]*unit)),v=scene.project(corner.map((v,i)=>v-across[i]*unit));
  ctx.save();polygon(ctx,face.points);ctx.clip();ctx.transform(u[0]-p[0],u[1]-p[1],v[0]-p[0],v[1]-p[1],p[0],p[1]);ctx.globalAlpha=.9;ctx.drawImage(im,0,0);ctx.restore();
}
function paintScene(ctx,model,state,scene,rect,textures,hits,{detail=false}={}){
  const focused=new Set(state.focusedMemberIds);ctx.save();ctx.translate(rect.x,rect.y);
  for(const f of scene.faces){
    const id=f.part.part_id,installed=state.placed.has(id),isFocus=focused.has(id),a=model.assignmentMap.get(id);
    polygon(ctx,f.points);
    ctx.fillStyle=installed?colourFor(model,a.material_id):isFocus&&phases.indexOf(state.stage)>=3?'#e5c78e':colours.ghost;
    ctx.fill();if(installed)representative(ctx,f,scene,textureFor(textures,a.material_id));
    ctx.strokeStyle=isFocus&&phases.indexOf(state.stage)>=3?colours.gold:installed?'#766c58':'#c9d0c1';
    ctx.lineWidth=isFocus&&phases.indexOf(state.stage)>=3?(detail?2.3:1.5):detail?.75:.32;ctx.stroke();
    if(installed||isFocus)hits.push({memberId:id,polygon:translate(f.points,rect.x,rect.y),surface:detail?'detail':'assembly'});
  }
  ctx.restore();
}

function sourcePanel(ctx,model,state,textures,hits){
  box(ctx,18,105,427,550);
  if(state.final){
    text(ctx,'120 UNIQUE SOURCE BARS',36,133,16,colours.ink,true);
    text(ctx,'All recorded allocations are now placed.',36,160,15,colours.muted);
    for(let i=0;i<120;i++){const x=37+(i%12)*31,y=186+Math.floor(i/12)*17;ctx.fillStyle=colours.green;ctx.fillRect(x,y,23,10);}
    const tot=model.plan.totals,rows=[['Installed strips',`716 / ${fmt(tot.installedLengthMm/1000,3)} m`],['Surplus pieces retained',`4 / ${fmt(tot.surplusLengthMm/1000,3)} m`],['Residual stock retained',`${fmt(tot.residualLengthMm/1000,3)} m`],['Saw kerf loss',`${fmt(tot.kerfLengthMm/1000,3)} m`],['Source total',`${fmt(tot.sourceLengthMm/1000,3)} m`]];
    rows.forEach(([key,value],i)=>{const y=401+i*39;text(ctx,key,36,y,14,colours.muted);text(ctx,value,246,y,15,colours.ink,true);});
    text(ctx,'Surplus and residual never enter the bench.',36,623,14,colours.surplus,true);return [];
  }
  const b=state.bar,phase=state.stage,stage=phases.indexOf(phase),mat=model.materialMap.get(b.materialId),texture=textureFor(textures,b.materialId);
  text(ctx,`SOURCE ${b.stockId}`,36,133,19,colours.ink,true);
  text(ctx,`Listing ${b.materialId} · ${fmt(b.sourceLengthMm)} mm · 38.1 × 88.9`,36,159,13,colours.muted);
  text(ctx,`Parent ${state.entry.sequenceIndex+1} / 120${state.accelerated?' · accelerated':''}`,36,184,13,colours.green,true);
  const bx=37,by=212,bw=390,bh=29,sx=mm=>bx+mm/b.sourceLengthMm*bw;
  textureQuad(ctx,rectQuad(bx,by,bw,bh),texture,colourFor(model,b.materialId),stage>=2?.2:1);
  for(const iv of b.residualIntervalsMm){ctx.fillStyle=colours.blue;ctx.fillRect(sx(iv[0]),by,Math.max(1,(iv[1]-iv[0])/b.sourceLengthMm*bw),bh);}
  for(const iv of b.excludedIntervalsMm){ctx.fillStyle=colours.red;ctx.fillRect(sx(iv[0]),by,Math.max(1,(iv[1]-iv[0])/b.sourceLengthMm*bw),bh);}
  const marked=stage===0?0:stage===1?Math.floor(state.phaseProgress*(b.kerfIntervalsMm.length+1)):b.kerfIntervalsMm.length;
  b.kerfIntervalsMm.forEach((iv,i)=>{if(i<marked){rule(ctx,sx(iv[0]),by-12,sx(iv[0]),by+bh+7,colours.red,1.8);ctx.fillStyle=colours.red;ctx.fillRect(sx(iv[0]),by,Math.max(1,(iv[1]-iv[0])/b.sourceLengthMm*bw),bh);}});
  text(ctx,'0',bx,258,11,colours.muted);text(ctx,`${fmt(b.sourceLengthMm)} mm`,333,258,11,colours.muted);
  text(ctx,'CUT OUTPUT → REAL MEMBER ID',36,286,12,colours.muted,true);
  text(ctx,'SOURCE INTERVAL (mm)',280,286,11,colours.muted,true);
  const tray=[];
  b.pieces.forEach((piece,i)=>{
    const y=305+i*42,w=piece.lengthMm/430*113,quad=rectQuad(39,y,Math.max(30,w),19);
    const arrived=piece.memberId&&state.placed.has(piece.memberId),surplus=piece.kind==='surplus';
    tray.push({piece,quad});
    if(stage>=2){
      if(phase==='separated'){
        const p=ease(clamp(state.phaseProgress*1.6-i*.09)),start=rectQuad(sx(piece.startMm),by,(piece.endMm-piece.startMm)/b.sourceLengthMm*bw,bh);
        const travel=start.map((v,j)=>[v[0]+(quad[j][0]-v[0])*p,v[1]+(quad[j][1]-v[1])*p]);
        textureQuad(ctx,travel,texture,colourFor(model,b.materialId));
      }else if(!arrived&&!(phase==='placement'&&state.active?.memberId===piece.memberId&&state.motion>0))textureQuad(ctx,quad,texture,colourFor(model,b.materialId));
      else{polygon(ctx,quad);ctx.strokeStyle=colours.rule;ctx.stroke();if(arrived)text(ctx,'PLACED',45,y+14,10,colours.green,true);}
    }else{polygon(ctx,quad);ctx.strokeStyle=colours.rule;ctx.stroke();}
    if(surplus){text(ctx,'SURPLUS · KEEP',163,y+12,12,colours.surplus,true);text(ctx,piece.partId,163,y+27,11,colours.surplus);}
    else{text(ctx,piece.memberId,163,y+12,13,colours.ink,true);text(ctx,piece.partId,163,y+27,11,arrived?colours.green:colours.muted);hits.push({memberId:piece.memberId,polygon:rectQuad(34,y-5,392,37),surface:'source-output'});}
    text(ctx,`${fmt(piece.startMm,1)}–${fmt(piece.endMm,1)}`,286,y+12,12,colours.muted);
    text(ctx,`${fmt(piece.lengthMm)} mm${arrived?' · placed':''}`,286,y+27,11,arrived?colours.green:colours.muted);
    if(state.active?.memberId===piece.memberId&&(phase==='targets'||phase==='placement')){ctx.strokeStyle=colours.gold;ctx.lineWidth=1.6;ctx.strokeRect(33,y-5,394,38);}
  });
  text(ctx,`Kerf ${fmt(state.ledger.current.kerfLengthMm)} mm · Residual ${fmt(state.ledger.current.residualLengthMm)} mm`,36,586,13,colours.blue,true);
  const residual=b.residualIntervalsMm.map(iv=>`${fmt(iv[0])}–${fmt(iv[1])}`).join(', ');
  text(ctx,`Residual interval: ${residual||'none'}`,36,608,12,colours.muted);
  text(ctx,state.ledger.current.surplusCount?`${state.ledger.current.surplusCount} surplus pieces stay outside the bench.`:'One parent bar supplies several different bench locations.',36,633,12,state.ledger.current.surplusCount?colours.surplus:colours.muted,true);
  return tray;
}

function targetPanel(ctx,model,state,textures,hits){
  box(ctx,458,105,804,357);text(ctx,'TRUE ASSEMBLED TARGETS',475,132,14,colours.ink,true);
  text(ctx,'Pale = pending · wood = placed · gold = this source bar',738,132,12,colours.muted);
  paintScene(ctx,model,state,model.scene,mainRect,textures,hits);
  if(!state.final&&phases.indexOf(state.stage)>=3){
    for(const id of state.focusedMemberIds){
      const p=model.partMap.get(id),c=[0,1,2].map(k=>k===1?p.y_mm+p.thickness_mm/2:sum(p.polygon_xz_mm,v=>v[k===0?0:1])/4),q=model.scene.project(c);
      ctx.beginPath();ctx.arc(q[0]+mainRect.x,q[1]+mainRect.y,4.3,0,Math.PI*2);ctx.fillStyle=colours.gold;ctx.fill();
    }
  }
  box(ctx,458,474,377,181);box(ctx,847,474,415,181);
  const active=state.active?.memberId||model.parts.find(p=>p.rib_id==='S040')?.part_id,p=model.partMap.get(active);
  text(ctx,`TARGET DETAIL · ${p.rib_id}`,475,497,13,colours.ink,true);
  if(!model.detailScenes.has(p.rib_id)){
    const rows=model.parts.filter(q=>q.rib_id===p.rib_id);
    model.detailScenes.set(p.rib_id,projectScene(rows.flatMap(q=>extrudePart(q)),{w:detailRect.w,h:detailRect.h},{yaw:.2,pitch:.16,zoom:1,pan:[0,0]}));
  }
  paintScene(ctx,model,state,model.detailScenes.get(p.rib_id),detailRect,textures,hits,{detail:true});
  text(ctx,active,475,645,12,colours.gold,true);
  text(ctx,'SAVED ALLOCATION LEDGER',864,500,13,colours.ink,true);
  text(ctx,`${state.installedCount} / 716`,864,536,30,colours.green,true);text(ctx,'installed members',1080,532,14,colours.muted);
  text(ctx,`${state.ledger.completedSourceBars} / 120 unique parent bars complete`,864,564,14,colours.muted);
  text(ctx,`${state.ledger.surplusPieces} surplus pieces retained · never installed`,864,589,14,colours.surplus);
  text(ctx,`Placed length ${fmt(state.ledger.installedLengthMm/1000,3)} m`,864,614,14,colours.muted);
  text(ctx,state.accelerated?'117 remaining bars shown once, at accelerated speed.':state.final?'Every saved installed member has one source interval.':'Different cut pieces can belong to distant stations.',864,640,12,colours.muted);
}

function motion(ctx,model,state,tray,textures){
  if(state.stage!=='placement'||!state.active||state.motion<=0)return;
  const item=tray.find(t=>t.piece.memberId===state.active.memberId);if(!item)return;
  const p=model.partMap.get(state.active.memberId),front=p.polygon_xz_mm.map(v=>model.scene.project([v[0],p.y_mm,v[1]]));
  const end=translate(front,mainRect.x,mainRect.y),a=ease(state.motion),arc=-65*Math.sin(Math.PI*a);
  const flying=item.quad.map((v,i)=>[v[0]+(end[i][0]-v[0])*a,v[1]+(end[i][1]-v[1])*a+arc]);
  const from=item.quad.map(v=>v),centre=q=>[sum(q,v=>v[0])/4,sum(q,v=>v[1])/4],s=centre(from),t=centre(end);
  ctx.save();ctx.setLineDash([4,4]);rule(ctx,s[0],s[1],t[0],t[1],'#cda661',1.2);ctx.restore();
  textureQuad(ctx,flying,textureFor(textures,state.bar.materialId),colourFor(model,state.bar.materialId));
  const c=centre(flying);text(ctx,state.active.memberId,c[0]-48,c[1]-15,12,colours.green,true);
}

export function renderAllocationFrame(ctx,width,height,model,timeSeconds,{textures}={}){
  const state=stateAt(model,timeSeconds),scale=Math.min(width/W,height/H),ox=(width-W*scale)/2,oy=(height-H*scale)/2,hits=[];
  ctx.save();ctx.fillStyle=colours.bg;ctx.fillRect(0,0,width,height);ctx.translate(ox,oy);ctx.scale(scale,scale);
  text(ctx,'SECOND GRAIN / CASE 02 / SAVED CUTTING → ALLOCATION',20,27,12,colours.muted,true);
  text(ctx,'From one stock bar to many bench members',20,61,27,colours.ink,true);
  text(ctx,`${fmt(state.timeSeconds,1)} / ${fmt(model.durationSeconds,0)} s`,1135,27,14,colours.muted,true);
  text(ctx,state.accelerated?'ACCELERATED SOURCE LEDGER':stageNames[state.stage],804,60,18,colours.green,true);
  rule(ctx,20,82,1260,82);
  const tray=sourcePanel(ctx,model,state,textures,hits);
  targetPanel(ctx,model,state,textures,hits);motion(ctx,model,state,tray,textures);
  ctx.fillStyle='#d9dfd1';ctx.fillRect(20,667,1240,4);ctx.fillStyle=colours.green;ctx.fillRect(20,667,1240*state.timeSeconds/model.durationSeconds,4);
  text(ctx,'Allocation visualization — not a validated physical assembly sequence.',20,691,13,colours.ink,true);
  text(ctx,'CPU model allocation animation — not browser recording. Source appearance is representative; kerf strokes may be enlarged for visibility.',20,712,11,colours.muted);
  ctx.restore();
  return {stage:state.stage,focusedStockId:state.focusedStockId,installedCount:state.installedCount,
    focusedMemberIds:state.focusedMemberIds,activeMemberId:state.active?.memberId||null,
    hitTargets:hits.map(h=>({...h,polygon:h.polygon.map(p=>[ox+p[0]*scale,oy+p[1]*scale])})),
    ledger:state.ledger,timeSeconds:state.timeSeconds,durationSeconds:model.durationSeconds,
    accelerated:state.accelerated,complete:state.final,sourceBarSequenceIndex:state.entry?.sequenceIndex??120};
}
