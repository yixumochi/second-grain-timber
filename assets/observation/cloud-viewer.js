// Display adapter for the existing material_preview/viewer.js projection.
// Input points, colours, row correspondence and observed boxes are never edited.
const palette=['#37b9b0','#edac58','#a68fe8','#ed889e','#89b77c','#69a9de'];
export function drawCloud(ctx,data,width,height,state={}){
  const {yaw=.28,pitch=.24,zoom=1,filter='all',showBox=true,byView=false}=state;
  ctx.fillStyle='#142c29';ctx.fillRect(0,0,width,height);
  const box=filter==='all'?data.proxy:data.proxy.per_view?.find(v=>String(v.input_index)===filter)?.box;
  if(!box?.available){ctx.fillStyle='#e6e9d8';ctx.font='14px sans-serif';ctx.fillText('No saved finite support box for this view.',20,40);return 0;}
  const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  const rotate=p=>{
    const [x,y,z]=box.axes_rows.map(a=>a.reduce((s,v,k)=>s+v*(p[k]-box.center_world[k]),0));
    const u=cy*x+sy*z,w=-sy*x+cy*z;return [u,cp*y-sp*w,sp*y+cp*w];
  };
  const corners=box.corners_world.map(rotate);
  const low=[0,1].map(k=>Math.min(...corners.map(p=>p[k]))),high=[0,1].map(k=>Math.max(...corners.map(p=>p[k])));
  const scale=Math.min((width-60)/Math.max(high[0]-low[0],1e-12),(height-80)/Math.max(high[1]-low[1],1e-12))*zoom;
  const project=p=>[(p[0]-(low[0]+high[0])/2)*scale+width/2,height/2-(p[1]-(low[1]+high[1])/2)*scale];
  const dots=data.points.map((p,i)=>({i,p:rotate(p)})).filter(({i})=>filter==='all'||String(data.views[i])===filter).sort((a,b)=>a.p[2]-b.p[2]);
  const size=width>650?2.1:1.6;
  for(const {i,p} of dots){const [x,y]=project(p);ctx.fillStyle=byView?palette[data.views[i]%palette.length]:'rgb('+data.rgb[i].join(',')+')';ctx.fillRect(x-size/2,y-size/2,size,size);}
  if(showBox){ctx.strokeStyle='#f9c46b';ctx.lineWidth=1.25;ctx.beginPath();for(const [i,j] of box.edges){ctx.moveTo(...project(corners[i]));ctx.lineTo(...project(corners[j]));}ctx.stroke();}
  ctx.fillStyle='#e6e9d8';ctx.font='11px sans-serif';ctx.fillText(showBox?'VGGT_ESTIMATED / observed proxy':'SAVED VGGT POINTS',18,24);
  ctx.fillText('Uncalibrated scene units · '+(filter==='all'?'All saved views':'View '+data.view_labels[filter]),18,height-17);
  return dots.length;
}
export function mountCloud(canvas,data,controls){
  const state={yaw:.28,pitch:.24,zoom:1,filter:'all',showBox:true,byView:false},events=new AbortController();
  const ctx=canvas.getContext('2d');let drag=null,frame=0;
  function draw(){frame=0;const dpr=Math.min(devicePixelRatio||1,2),w=Math.max(280,canvas.clientWidth),h=Math.max(320,canvas.clientHeight);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);drawCloud(ctx,data,w,h,state);}
  const request=()=>{if(!frame)frame=requestAnimationFrame(draw);};
  const on=(el,name,fn,opts={})=>el.addEventListener(name,fn,{...opts,signal:events.signal});
  const reset=()=>{state.yaw=.28;state.pitch=.24;state.zoom=1;request();};
  on(canvas,'pointerdown',e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);});
  on(canvas,'pointermove',e=>{if(!drag)return;state.yaw+=(e.clientX-drag[0])*.008;state.pitch=Math.max(-1.5,Math.min(1.5,state.pitch+(e.clientY-drag[1])*.008));drag=[e.clientX,e.clientY];request();});
  for(const n of ['pointerup','pointercancel','lostpointercapture'])on(canvas,n,()=>drag=null);
  on(canvas,'wheel',e=>{e.preventDefault();state.zoom=Math.max(.3,Math.min(5,state.zoom*Math.exp(-e.deltaY*.001)));request();},{passive:false});
  on(canvas,'keydown',e=>{const keys={ArrowLeft:()=>state.yaw-=.1,ArrowRight:()=>state.yaw+=.1,ArrowUp:()=>state.pitch=Math.min(1.5,state.pitch+.1),ArrowDown:()=>state.pitch=Math.max(-1.5,state.pitch-.1),'+':()=>state.zoom=Math.min(5,state.zoom*1.15),'-':()=>state.zoom=Math.max(.3,state.zoom/1.15),'0':reset};if(keys[e.key]){e.preventDefault();keys[e.key]();request();}});
  on(controls.box,'change',()=>{state.showBox=controls.box.checked;request();});
  on(controls.color,'change',()=>{state.byView=controls.color.checked;request();});
  on(controls.filter,'change',()=>{state.filter=controls.filter.value;reset();});on(controls.reset,'click',reset);
  const observer=new ResizeObserver(request);observer.observe(canvas);request();
  return ()=>{events.abort();observer.disconnect();cancelAnimationFrame(frame);};
}
