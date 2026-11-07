// Display geometry only. Source members, allocation records and photo pixels are immutable.
export const COLORS={Frame:'#ad9274',Roof:'#c8af87','Deck support':'#af9d83',Walls:'#b8a58c','Wall cladding':'#c6b59a','Roof covering':'#ac9f8b',Deck:'#d6c4a6'};
export const FACE_DEFS=[
 {indices:[0,1,3,2],axis:2,sign:-1},{indices:[4,5,7,6],axis:2,sign:1},
 {indices:[0,1,5,4],axis:1,sign:-1},{indices:[2,3,7,6],axis:1,sign:1},
 {indices:[0,2,6,4],axis:0,sign:-1},{indices:[1,3,7,5],axis:0,sign:1},
];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const corners=member=>Array.from({length:8},(_,j)=>member.box.center.map((v,k)=>v+member.box.axes.reduce((s,a,i)=>s+a[k]*member.box.half[i]*((j>>i&1)?1:-1),0)));
export function bounds(members){const points=members.flatMap(corners);return {min:[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...points.map(p=>p[i])))};}
export function envelope(members,{request=null,sessionHeight=null}={}){
 const b=bounds(members),floor=members.filter(m=>m.system==='FLOOR'||/FLOOR|DECK/.test(m.role)),roof=members.filter(m=>m.system==='ROOF'||/ROOF|RAFTER/.test(m.role));
 const z0=request?.floor_top_mm??(floor.length?bounds(floor).max[2]:b.min[2]);
 const z1=roof.length?bounds(roof).max[2]:z0+(Number.isFinite(sessionHeight)&&sessionHeight>0?sessionHeight*1000:2400);
 let door=null;
 if(request?.entrance){const e=request.entrance;door={face:e.face,start:((e.face==='WEST'||e.face==='EAST'?request.dimensions_mm.width:request.dimensions_mm.length)-e.width_mm)/2,width:e.width_mm,top:z0+e.clear_height_mm,basis:'Saved design entrance'};}
 else {const jambs=members.filter(m=>m.role==='JAMB_STUD'),lintel=members.find(m=>m.role==='LINTEL');if(jambs.length===2&&lintel){const ordered=jambs.toSorted((a,b)=>a.box.center[0]-b.box.center[0]);const left=bounds([ordered[0]]).max[0],right=bounds([ordered[1]]).min[0];if(right>left)door={face:'SOUTH',start:left,width:right-left,top:bounds([lintel]).min[2],basis:'Opening between saved jambs and lintel'};}}
 return {minX:request?0:b.min[0],maxX:request?request.dimensions_mm.length:b.max[0],minY:request?0:b.min[1],maxY:request?request.dimensions_mm.width:b.max[1],floorZ:z0,roofZ:z1,door,heightBasis:roof.length?'Saved roof geometry':'Proposed enclosure height; no roof frame is recorded'};
}
export function cladding(env,{width=140,thickness=20,gap=4}={}){
 if(![width,thickness,gap].every(Number.isFinite)||width<=gap||gap<0||thickness<=0)throw Error('Invalid cladding dimensions');
 const out=[],add=(layer,face,center,half,axes,normal)=>out.push({member_id:`PROPOSED_${layer.replace(/ /g,'_').toUpperCase()}_${face}_${String(out.length+1).padStart(3,'0')}`,role:'PROPOSED_ENCLOSURE',group:layer,proposed:true,face,normal,box:{center,half,axes},stock_id:null,material_id:null,design_basis:'Proposed board layout; not allocated or structurally verified'});
 for(const face of ['SOUTH','NORTH','WEST','EAST']){
   const alongX=['SOUTH','NORTH'].includes(face),lo=alongX?env.minX:env.minY,hi=alongX?env.maxX:env.maxY;
   const outer=({SOUTH:env.minY-thickness/2,NORTH:env.maxY+thickness/2,WEST:env.minX-thickness/2,EAST:env.maxX+thickness/2})[face];
   const normal=({SOUTH:[0,-1,0],NORTH:[0,1,0],WEST:[-1,0,0],EAST:[1,0,0]})[face];
   for(let a=lo;a<hi-1e-6;a+=width){const b=Math.min(a+width-gap,hi);if(b<=a)continue;const door=env.door?.face===face?env.door:null;
     const cuts=[a,b,...(door?[door.start,door.start+door.width].filter(v=>v>a&&v<b):[])].toSorted((x,y)=>x-y);
     for(let i=0;i<cuts.length-1;i++){const x=cuts[i],y=cuts[i+1],mid=(x+y)/2;const z0=door&&mid>door.start&&mid<door.start+door.width?Math.max(env.floorZ,door.top):env.floorZ;const height=env.roofZ-z0;if(height<=0)continue;
       add('Wall cladding',face,alongX?[mid,outer,z0+height/2]:[outer,mid,z0+height/2],[height/2,(y-x)/2,thickness/2],alongX?[[0,0,1],[1,0,0],[0,1,0]]:[[0,0,1],[0,1,0],[1,0,0]],normal);
     }
   }
 }
 for(const layer of ['Deck','Roof covering']){const eave=layer==='Roof covering'?70:0,z=layer==='Deck'?env.floorZ+thickness/2:env.roofZ+thickness/2;
   for(let y=env.minY-eave;y<env.maxY+eave-1e-6;y+=width){const end=Math.min(y+width-gap,env.maxY+eave);add(layer,layer==='Deck'?'BOTTOM':'TOP',[(env.minX+env.maxX)/2,(y+end)/2,z],[(env.maxX-env.minX)/2+eave,(end-y)/2,thickness/2],[[1,0,0],[0,1,0],[0,0,1]],layer==='Deck'?[0,0,-1]:[0,0,1]);}
 }
 return out;
}
export function displayMembers(members,{mode='cutaway',hidden=new Set(),separation=0,isolate=null,envelope:env}={}){
 return members.filter(m=>{
   if(isolate)return m.member_id===isolate;
   if(hidden.has(m.group))return false;
   if(!m.proposed)return true;
   if(mode==='frame')return false;
   if(mode==='cutaway'&&(['SOUTH','EAST'].includes(m.face)||(m.group==='Roof covering'&&m.box.center[1]<(env.minY+env.maxY)/2)))return false;
   return true;
 }).map(m=>m.proposed&&separation?{...m,box:{...m.box,center:m.box.center.map((v,i)=>v+m.normal[i]*separation)}}:m);
}
export function sceneProjection(members,rect,{yaw=-.65,pitch=.42,zoom=1,pan=[0,0],fit=members}={}){
 if(!members.length||!fit.length)return {faces:[],centers:new Map()};
 const cs=Math.cos(yaw),sn=Math.sin(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch);
 const rotate=p=>{const a=p[0]*cs-p[1]*sn,b=p[0]*sn+p[1]*cs;return [a,-b*sp-p[2]*cp,-b*cp+p[2]*sp];};
 const camera=[-sn*cp,-cs*cp,sp],all=fit.flatMap(corners).map(rotate);
 const x0=Math.min(...all.map(p=>p[0])),x1=Math.max(...all.map(p=>p[0])),y0=Math.min(...all.map(p=>p[1])),y1=Math.max(...all.map(p=>p[1]));
 const scale=Math.min(rect.w*.8/Math.max(1,x1-x0),rect.h*.8/Math.max(1,y1-y0))*zoom;
 const project=p=>{const q=rotate(p);return [rect.w/2+(q[0]-(x0+x1)/2)*scale+pan[0],rect.h/2+(q[1]-(y0+y1)/2)*scale+pan[1],q[2]];};
 const faces=[],centers=new Map();
 for(const member of members){const c=corners(member).map(project);centers.set(member.member_id,project(member.box.center));
   FACE_DEFS.forEach((definition,index)=>{const normal=member.box.axes[definition.axis].map(v=>v*definition.sign);if(dot(normal,camera)<=1e-7)return;
     const points=definition.indices.map(i=>c[i]);faces.push({member,index,points,normal,depth:points.reduce((s,p)=>s+p[2],0)/4});
   });
 }
 faces.sort((a,b)=>a.depth-b.depth||a.member.member_id.localeCompare(b.member.member_id));
 return {faces,centers,scale,project};
}
export function pointInPolygon(point,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const [xi,yi]=polygon[i],[xj,yj]=polygon[j];if(((yi>point[1])!==(yj>point[1]))&&point[0]<(xj-xi)*(point[1]-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
export function pickFace(faces,point){return faces.findLast(face=>pointInPolygon(point,face.points))||null;}
export function textureFace(member,kind='side'){
 const axis=kind==='end'?0:(member.box.half[1]>=member.box.half[2]?2:1);
 // Fixed face choice in the initial view. Rotating does not move evidence to an unseen side.
 const camera=[Math.sin(.65)*Math.cos(.42),-Math.cos(.65)*Math.cos(.42),Math.sin(.42)];
 const sign=dot(member.box.axes[axis],camera)>=0?1:-1;
 return FACE_DEFS.findIndex(f=>f.axis===axis&&f.sign===sign);
}
export function paintScene(ctx,scene,{selected=null,stock=null,labels=false,textures=new Map(),appearance=true}={}){
 for(const face of scene.faces){const m=face.member,p=face.points,highlight=m.member_id===selected||stock&&m.stock_id===stock;
   ctx.save();ctx.beginPath();p.forEach((v,i)=>i?ctx.lineTo(v[0],v[1]):ctx.moveTo(v[0],v[1]));ctx.closePath();
   ctx.fillStyle=COLORS[m.group]||'#c0b7a6';ctx.fill();
   const texture=textures.get(m.appearance_id||m.material_id);
   if(appearance&&texture?.image&&texture.defensible_uv===true&&texture.member_id===m.member_id&&face.index===texture.face_index){
     // One existing RGBA image on one illustrative face. No tiling, filling or pixel synthesis.
     ctx.save();ctx.clip();const w=texture.image.width,h=texture.image.height;
     ctx.transform((p[1][0]-p[0][0])/w,(p[1][1]-p[0][1])/w,(p[3][0]-p[0][0])/h,(p[3][1]-p[0][1])/h,p[0][0],p[0][1]);ctx.drawImage(texture.image,0,0);ctx.restore();
   }
   const shade=Math.max(0,.17-.14*dot(face.normal,[.3,-.5,.8]));ctx.fillStyle=`rgba(30,26,20,${shade})`;ctx.fill();
   if(highlight){ctx.fillStyle='rgba(231,123,39,.22)';ctx.fill();}
   ctx.strokeStyle=highlight?'#e27725':m.proposed?'#92836c':'#5e5649';ctx.lineWidth=highlight?2.2:.65;ctx.stroke();ctx.restore();
 }
 if(labels||selected){const rows=labels?Array.from(scene.centers.entries()):[[selected,scene.centers.get(selected)]];for(const [id,p] of rows){if(!p)continue;const face=scene.faces.findLast(f=>f.member.member_id===id);if(!face||face.member.proposed&&id!==selected)continue;
     const hit=pickFace(scene.faces,p);if(hit?.member.member_id!==id&&id!==selected)continue;
     const label=face.member.stock_id||id;ctx.save();ctx.font='11px Segoe UI, sans-serif';const w=ctx.measureText(label).width+12;ctx.fillStyle=id===selected?'#263d32':'rgba(250,249,243,.94)';ctx.fillRect(p[0]-w/2,p[1]-10,w,20);ctx.fillStyle=id===selected?'white':'#263d32';ctx.fillText(label,p[0]-w/2+6,p[1]+4);ctx.restore();
   }}
}
