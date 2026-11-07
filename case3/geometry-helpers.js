// Pure geometry helpers shared by the interactive viewer and offline allocation renderer.
// No DOM, network, startup side effects or data mutation.
const sum = (a, f) => a.reduce((n,x)=>n+(Number(f(x))||0),0);
const first = (...v) => v.find(x => x !== undefined && x !== null);

export function pointInPolygon(point, polygon) {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [x,y]=polygon[i], [px,py]=polygon[j];
    if(((y>point[1])!==(py>point[1]))&&point[0]<(px-x)*(point[1]-y)/(py-y)+x)inside=!inside;
  }
  return inside;
}

export function normalizePart(raw,index=0) {
  let polygon = raw.polygon_xz_mm || raw.polygon_mm || raw.polygon || raw.profile_xz_mm;
  if(!Array.isArray(polygon) || polygon.length < 3) {
    const b=raw.box || raw.bounding_box;
    if(b?.min && b?.max) polygon=[[b.min[0],b.min[2]],[b.max[0],b.min[2]],[b.max[0],b.max[2]],[b.min[0],b.max[2]]];
  }
  const p={...raw,part_id:String(raw.part_id || raw.id || raw.member_id || `UNNAMED_${index}`),rib_id:raw.rib_id || raw.rib || null,role:raw.role || 'Unspecified',polygon_xz_mm:polygon, y_mm:Number(first(raw.y_mm,raw.y_start_mm,raw.box?.min?.[1],0)),thickness_mm:Number(first(raw.thickness_mm,raw.depth_mm,raw.box?.max?.[1] != null ? raw.box.max[1]-raw.box.min[1] : undefined,0))};
  p.valid_geometry=Array.isArray(polygon)&&polygon.length>=3&&polygon.every(v=>Array.isArray(v)&&v.length>=2&&v.slice(0,2).every(Number.isFinite))&&p.thickness_mm>0&&Number.isFinite(p.y_mm);
  return p;
}

export function extrudePart(part, offset=[0,0,0], flat=false) {
  if(!part.valid_geometry) return [];
  const poly=flat?(part.polygon_blank_uv_mm||part.polygon_xz_mm):part.polygon_xz_mm, y=part.y_mm, t=part.thickness_mm;
  const minX=Math.min(...poly.map(p=>p[0])), minZ=Math.min(...poly.map(p=>p[1]));
  const point=(p,back)=>flat?[p[0]-minX+offset[0],p[1]-minZ+offset[1],(back?t:0)+offset[2]]:[p[0]+offset[0],y+(back?t:0)+offset[1],p[1]+offset[2]];
  const front=poly.map(p=>point(p,false)),back=poly.map(p=>point(p,true));
  const area=poly.reduce((s,p,i)=>{const q=poly[(i+1)%poly.length];return s+p[0]*q[1]-q[0]*p[1];},0),sign=area>=0?1:-1;
  const faces=[{vertices:front,normal:flat?[0,0,-1]:[0,-1,0],kind:'front',part},{vertices:back,normal:flat?[0,0,1]:[0,1,0],kind:'back',part}];
  for(let i=0;i<poly.length;i++){
    const j=(i+1)%poly.length,dx=poly[j][0]-poly[i][0],dz=poly[j][1]-poly[i][1],norm=Math.hypot(dx,dz)||1;
    faces.push({vertices:[front[i],front[j],back[j],back[i]],normal:flat?[dz/norm*sign,-dx/norm*sign,0]:[dz/norm*sign,0,-dx/norm*sign],kind:'edge',part});
  }
  return faces;
}

export function projectScene(faces, rect, camera={yaw:.72,pitch:.43,zoom:1,pan:[0,0]}) {
  if(!faces.length)return {faces:[],scale:1};
  const cs=Math.cos(camera.yaw),sn=Math.sin(camera.yaw),sp=Math.sin(camera.pitch),cp=Math.cos(camera.pitch);
  const rotate=p=>{const a=p[0]*cs-p[1]*sn,b=p[0]*sn+p[1]*cs;return [a,-b*sp-p[2]*cp,-b*cp+p[2]*sp];};
  const fitIDs=camera.fitPartIDs?new Set(camera.fitPartIDs):null,fitFaces=fitIDs?faces.filter(f=>fitIDs.has(f.part.part_id)):faces;
  const view=[-sn*cp,-cs*cp,sp],all=(fitFaces.length?fitFaces:faces).flatMap(f=>f.vertices).map(rotate);
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  for(const p of all){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);}
  const scale=Math.min(rect.w*.87/Math.max(1,x1-x0),rect.h*.79/Math.max(1,y1-y0))*camera.zoom;
  const project=p=>{const q=rotate(p);return [rect.w/2+(q[0]-(x0+x1)/2)*scale+camera.pan[0],rect.h*.52+(q[1]-(y0+y1)/2)*scale+camera.pan[1],q[2]];};
  const visible=faces.filter(f=>f.normal.reduce((s,v,i)=>s+v*view[i],0)>1e-8).map(f=>{const points=f.vertices.map(project);return {...f,points,depth:sum(points,p=>p[2])/points.length};});
  visible.sort((a,b)=>a.depth-b.depth||a.part.part_id.localeCompare(b.part.part_id));
  return {faces:visible,scale,project};
}

