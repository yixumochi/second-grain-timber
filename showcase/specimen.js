// Display-only projection of the saved VGGT points. No generated geometry,
// dimensional calibration, new inference or edits to the evidence record.
const canvas=document.querySelector('#hero-cloud'),ctx=canvas.getContext('2d');
const image=document.querySelector('#hero-evidence');
const motion=document.querySelector('#hero-motion');
const labels=document.querySelector('#hero-object-label'),note=document.querySelector('#hero-object-note');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let data,points=[],frame=0,last=0,drag,visible=true,mode='cloud';
const state={yaw:-.36,pitch:.35,zoom:1,playing:!reduced.matches};
function syncMotion(){
 motion.setAttribute('aria-pressed',String(state.playing));
 motion.textContent=state.playing?'Pause ↙':'Rotate ↗';
 motion.setAttribute('aria-label',state.playing?'Pause point-cloud rotation':'Start point-cloud rotation');
}
syncMotion();
function render(t=0){
 frame=0;
 if(!data||!visible||document.hidden||mode!=='cloud'||document.body.dataset.activeChapter!=='materials')return;
 if(state.playing&&!drag&&last)state.yaw+=Math.min(80,t-last)*.000055;
 last=t;
 const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
 if(w<1||h<1)return;
 const W=Math.round(w*dpr),H=Math.round(h*dpr);
 if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;}
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const cy=Math.cos(state.yaw),sy=Math.sin(state.yaw),cp=Math.cos(state.pitch),sp=Math.sin(state.pitch);
 const rotate=p=>{const x=p[0]*cy+p[2]*sy,z=-p[0]*sy+p[2]*cy;return [x,p[1]*cp-z*sp,p[1]*sp+z*cp];};
 const sorted=points.map((p,i)=>({p:rotate(p),i})).sort((a,b)=>a.p[2]-b.p[2]);
 const uv=p=>[p[0]*.94-p[1]*.22,p[0]*.22+p[1]*.94];
 const bounds=sorted.map(({p})=>uv(p));
 const lo=[0,1].map(k=>Math.min(...bounds.map(p=>p[k]))),hi=[0,1].map(k=>Math.max(...bounds.map(p=>p[k])));
 const unit=Math.min(w*.84/Math.max(hi[0]-lo[0],1e-9),h*.62/Math.max(hi[1]-lo[1],1e-9))*state.zoom;
 const project=p=>{const q=uv(p);return [w*.53+(q[0]-(lo[0]+hi[0])/2)*unit,h*.45-(q[1]-(lo[1]+hi[1])/2)*unit];};
 for(const {p,i} of sorted){const [x,y]=project(p);const c=data.rgb[i],s=Math.max(1.25,Math.min(2.8,w/320));
  ctx.fillStyle=`rgba(${c[0]},${c[1]},${c[2]},.92)`;ctx.fillRect(x,y,s,s);}
 // The wireframe is the saved observed proxy, never a fabrication bounding box.
 const corners=data.corners.map(rotate);
 ctx.strokeStyle='#b1bb8b38';ctx.lineWidth=.8;ctx.setLineDash([4,6]);ctx.beginPath();
 for(const [a,b] of data.edges){ctx.moveTo(...project(corners[a]));ctx.lineTo(...project(corners[b]));}ctx.stroke();ctx.setLineDash([]);
 if(state.playing)frame=requestAnimationFrame(render);
}
function request(){if(!frame){last=0;frame=requestAnimationFrame(render);}}
document.addEventListener('material-ready',e=>{
 const raw=e.detail.cloud,box=raw.proxy;
 if(!box?.available)return;
 const local=p=>box.axes_rows.map(a=>a.reduce((sum,v,k)=>sum+v*(p[k]-box.center_world[k]),0));
 points=raw.points.map(local);
 const corners=box.corners_world.map(local);
 const extent=Math.max(...[0,1,2].map(k=>Math.max(...corners.map(p=>p[k]))-Math.min(...corners.map(p=>p[k]))));
 data={rgb:raw.rgb,corners,edges:box.edges,extent};
 request();
});
motion.addEventListener('click',()=>{state.playing=!state.playing;syncMotion();request();});
document.querySelectorAll('[data-representation]').forEach(b=>b.addEventListener('click',()=>{
 mode=b.dataset.representation;
 document.querySelectorAll('[data-representation]').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));
 canvas.hidden=mode!=='cloud';image.hidden=mode==='cloud';motion.hidden=mode!=='cloud';
 image.classList.toggle('masked',mode==='mask');
 labels.textContent=mode==='cloud'?'115200 / SAVED VGGT POINTS':mode==='mask'?'115200 / SAVED SAM 2 SILHOUETTE':'115200 / EARTHWISE SOURCE PHOTOGRAPH';
 note.innerHTML=mode==='cloud'?'9,000 displayed points · uncalibrated scene units<br>Partial evidence, not a measured whole-item scan.':mode==='mask'?'Original photograph isolated with its saved mask.<br>Silhouette evidence does not establish timber strength.':'Archived seller evidence · one of three saved views.<br>Nominal dimensions are reported by the seller.';
 if(mode==='cloud')request();else{cancelAnimationFrame(frame);frame=0;}
}));
canvas.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag)return;state.yaw+=(e.clientX-drag[0])*.007;state.pitch=Math.max(-1.3,Math.min(1.3,state.pitch+(e.clientY-drag[1])*.007));drag=[e.clientX,e.clientY];request();});
for(const n of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(n,()=>drag=null);
canvas.addEventListener('keydown',e=>{
 const keys={ArrowLeft:()=>state.yaw-=.12,ArrowRight:()=>state.yaw+=.12,ArrowUp:()=>state.pitch=Math.min(1.3,state.pitch+.1),ArrowDown:()=>state.pitch=Math.max(-1.3,state.pitch-.1),'+':()=>state.zoom=Math.min(2,state.zoom*1.1),'-':()=>state.zoom=Math.max(.4,state.zoom/1.1)};
 if(keys[e.key]){e.preventDefault();keys[e.key]();state.playing=false;syncMotion();request();}
});
const resize=new ResizeObserver(request);resize.observe(canvas);
const visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)request();else{cancelAnimationFrame(frame);frame=0;}});
visibility.observe(canvas);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)request();});
addEventListener('hashchange',request);
reduced.addEventListener('change',()=>{if(reduced.matches){state.playing=false;syncMotion();request();}});
