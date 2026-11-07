import {draw} from '../assets/analysis/desk-scene.js';
const $=s=>document.querySelector(s), reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
const opt=$('#optimization-loop'),oc=opt.getContext('2d'),split=$('#source-split-loop'),sc=split.getContext('2d');
let optTime=0,splitTime=0,optPause=reduced,splitPause=reduced,example=null,current=null,tex=null,mini=null,projection=null,token=0,stage=-1,last;
const captions=[
 'A real source + two named member demands. Saved Case 1 example; no new solve.',
 'Compare recorded section, role and continuous length before selecting patterns.',
 'One source → two parts + two 3 mm kerfs + retained residual.',
 'Read the selected pattern back as a source-to-part ledger. Quantities remain finite.'
];
const observer=new IntersectionObserver(entries=>entries.forEach(e=>e.target.dataset.onScreen=e.isIntersecting?'yes':'no'));
observer.observe(opt);observer.observe(split);
function updateButtons(){
 $('#optimization-toggle').textContent=optPause?'Play':'Pause';
 $('#source-split-toggle').textContent=splitPause?'Play':'Pause';
 $('#optimization-toggle').setAttribute('aria-pressed',String(!optPause));
 $('#source-split-toggle').setAttribute('aria-pressed',String(!splitPause));
}
$('#optimization-toggle').onclick=()=>{optPause=!optPause;updateButtons();};
$('#source-split-toggle').onclick=()=>{splitPause=!splitPause;updateButtons();};
$('#optimization-replay').onclick=()=>{optTime=0;optPause=false;updateButtons();};
$('#source-split-replay').onclick=()=>{splitTime=0;splitPause=false;updateButtons();};
document.querySelectorAll('[data-motion-step]').forEach(b=>b.onclick=()=>{optTime=Number(b.dataset.motionStep)*3.5;optPause=true;updateButtons();});
updateButtons();
fetch('../assets/update/allocation.json').then(r=>r.json()).then(a=>{
 example=a.cut_bars.find(b=>b.stock_id==='118095_001');
 if(!example)throw Error('Saved source example missing');
}).catch(()=>$('#optimization-caption').textContent='Saved example unavailable. The detailed records remain unchanged.');
function text(c,s,x,y,size=14,color='#304633'){c.fillStyle=color;c.font=`${size}px ${size<15?'monospace':'Arial'}`;c.fillText(s,x,y);}
function arrow(c,x,y,x2,y2,progress=1){
 c.strokeStyle='#80906a';c.lineWidth=1.5;c.setLineDash([5,5]);c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();c.setLineDash([]);
 c.fillStyle='#ad643d';c.beginPath();c.arc(x+(x2-x)*progress,y+(y2-y)*progress,4,0,Math.PI*2);c.fill();
}
function beam(c,x,y,w,color='#bca586',h=18){
 c.fillStyle=color;c.strokeStyle='#647356';c.lineWidth=1;
 c.beginPath();c.moveTo(x,y);c.lineTo(x+16,y-9);c.lineTo(x+w+16,y-9);c.lineTo(x+w,y);c.closePath();c.fill();c.stroke();
 c.fillRect(x,y,w,h);c.strokeRect(x,y,w,h);
 c.beginPath();c.moveTo(x+w,y);c.lineTo(x+w+16,y-9);c.lineTo(x+w+16,y+h-9);c.lineTo(x+w,y+h);c.closePath();c.fill();c.stroke();
}
function clean(c,w,h){c.fillStyle='#e3e7d7';c.fillRect(0,0,w,h);}
function optimization(){
 clean(oc,1000,280);if(!example)return;
 const s=Math.floor(optTime/3.5)%4,p=(optTime%3.5)/3.5,b=example,L=b.source_length_mm;
 if(s!==stage){stage=s;$('#optimization-caption').textContent=captions[s];document.querySelectorAll('[data-motion-step]').forEach(x=>x.setAttribute('aria-pressed',String(Number(x.dataset.motionStep)===s)));}
 text(oc,'SAVED SOURCE / '+b.stock_id,30,32);text(oc,`${fmt(L)} mm`,30,54,12);
 const by=s<2?130:104,bw=s<2?300:500;
 beam(oc,30,by,bw);
 if(s<2){
  for(let i=0;i<3;i++){oc.strokeStyle='#887b63';oc.beginPath();oc.moveTo(38,by+4+i*4);oc.lineTo(320,by+3+i*4);oc.stroke();}
  arrow(oc,375,132,595,132,p);
  text(oc,s===0?'MEMBER DEMANDS':'SECTION + ROLE + LENGTH',610,32);
  b.pieces.forEach((part,i)=>{
   beam(oc,610,87+i*68,240*(part.source_interval_mm[1]-part.source_interval_mm[0])/L,'#cdd8bb');
   text(oc,`${part.part_id.split('::')[1]} · ${fmt(part.used_length_mm)} mm`,610,120+i*68,12);
  });
  text(oc,s===0?'Recorded dimensions, IDs and quantities':'Compatible in the saved allocation',35,238,18);
  if(s===1){text(oc,'✓',550,137,28,'#58784a');text(oc,'ONE SHARED INVENTORY',610,238,12);}
 }else{
  b.pieces.forEach((part,i)=>{
   const a=part.source_interval_mm[0]/L*500,w=(part.source_interval_mm[1]-part.source_interval_mm[0])/L*500;
   oc.strokeStyle='#b26940';oc.setLineDash([3,3]);oc.beginPath();oc.moveTo(30+a+w,79);oc.lineTo(30+a+w,136);oc.stroke();oc.setLineDash([]);
   const f=Math.min(1,p*2),px=s===2?30+a:40+i*275,py=177;
   arrow(oc,30+a+w/2,134,px+w/2,py-8,p);
   beam(oc,px,134+(py-134)*f,w,'#b6c59f');
   text(oc,part.part_id,px,219,12);
   text(oc,`${fmt(part.source_interval_mm[0])}–${fmt(part.source_interval_mm[1])} mm`,px,238,11);
  });
  text(oc,s===2?'CUT MARKS → PARTS':'SELECTED PATTERN',710,44,18);
  text(oc,`${b.pieces.length} cut parts`,710,94,16);
  text(oc,`${fmt(b.kerf_loss_mm)} mm kerf`,710,126,16);
  text(oc,`${fmt(b.residual_mm)} mm residual`,710,158,16);
  text(oc,s===3?'IDs stay attached':'Recorded section retained',710,221,12);
 }
}
document.addEventListener('trace-selection',e=>{
 current=e.detail;splitTime=0;tex=null;const t=++token;
 const {bar,members}=current,m=current.member||members.find(m=>m.stock_id===bar.stock_id);
 mini=document.createElement('canvas');mini.width=350;mini.height=220;
 projection=draw(mini.getContext('2d'),members,350,220,{yaw:.65,pitch:.42,selected:current.member?.member_id});
 if(m?.appearance?.texture){const im=new Image();im.onload=()=>{if(t===token)tex=im;};im.src=m.appearance.texture;}
 const installed=bar.pieces.filter(p=>p.assignment_status!=='SURPLUS_CUT_PART').length;
 $('#source-split-caption').textContent=`${bar.stock_id} → ${installed} installed part${installed===1?'':'s'} · ${bar.pieces.length-installed} surplus · ${fmt(bar.residual_mm)} mm residual. Saved mapping; illustrative motion.`;
});
function correspondence(){
 clean(sc,1000,260);if(!current)return;
 const {bar,members}=current,L=bar.source_length_mm||bar.length_mm,t=splitTime%10;
 text(sc,t<2?'01 / ONE REAL SOURCE':t<5?'02 / SEPARATE ITS CUT PARTS':'03 / EACH PART HAS A POSITION',25,28,13);
 text(sc,bar.stock_id,25,52,13);
 sc.fillStyle='#bca586';sc.fillRect(25,78,430,23);if(tex)sc.drawImage(tex,25,78,430,23);
 if(mini)sc.drawImage(mini,630,30);
 const count=bar.pieces.length;
 bar.pieces.forEach((part,i)=>{
  const x=25+430*part.source_interval_mm[0]/L,w=430*(part.source_interval_mm[1]-part.source_interval_mm[0])/L;
  const surplus=part.assignment_status==='SURPLUS_CUT_PART';
  sc.fillStyle=surplus?'rgba(188,123,41,.4)':'rgba(65,114,66,.28)';sc.fillRect(x,78,w,23);
  sc.strokeStyle='#4c6743';sc.strokeRect(x,78,w,23);
  const py=137+i*Math.min(30,93/Math.max(1,count-1)),px=25+i*12;
  const separate=Math.min(1,Math.max(0,(t-1.5)/1.5));
  const m=members.find(m=>m.member_id===part.part_id),target=m&&projection.project(m.box.center);
  const f=surplus||!target?0:Math.min(1,Math.max(0,(t-4-i*.3)/2));
  const sx=x+(px-x)*separate,sy=78+(py-78)*separate;
  const tx=target?630+target[0]:sx,ty=target?30+target[1]:sy;
  if(target&&t>4){
   arrow(sc,px+w/2,py+7,tx,ty,f);
   sc.strokeStyle='#a86538';sc.beginPath();sc.arc(tx,ty,6,0,Math.PI*2);sc.stroke();
  }
  if(t>1.5){
   const cw=w+(18-w)*f,cx=sx+(tx-sx)*f,cy=sy+(ty-sy)*f;
   sc.fillStyle=surplus?'#bb974e':'#acb88b';sc.fillRect(cx,cy,cw,15);if(tex)sc.drawImage(tex,cx,cy,cw,15);
   sc.strokeStyle=surplus?'#a16d30':'#456d3c';sc.strokeRect(cx,cy,cw,15);
   if(f<.1)text(sc,part.part_id+(surplus?' / SURPLUS':''),px+w+20,py+12,11);
  }
 });
 if(bar.residual_interval_mm){sc.fillStyle='rgba(181,67,42,.45)';sc.fillRect(25+430*bar.residual_interval_mm[0]/L,78,430*bar.residual_mm/L,23);}
 text(sc,'Green: installed   Amber: surplus   Red: residual',25,249,11);
}
function animate(now){
 requestAnimationFrame(animate);const dt=Math.min(.1,(now-(last??now))/1000);last=now;
 if(document.hidden||document.body.dataset.activeChapter!=='algorithm')return;
 if(opt.dataset.onScreen==='yes'){if(!optPause)optTime=(optTime+dt)%14;optimization();}
 if(split.dataset.onScreen==='yes'){if(!splitPause)splitTime=(splitTime+dt)%10;correspondence();}
}
requestAnimationFrame(animate);
