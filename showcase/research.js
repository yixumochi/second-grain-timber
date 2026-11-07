// Keep the reading entry light. Load saved-data viewers when their chapter opens.
const started = new Map();
function start(path) {
  if (!started.has(path)) {
    if(path==='./workflow.js'){
      const status=document.getElementById('load-status');
      if(!status.classList.contains('error')){status.hidden=false;status.textContent='Loading saved evidence…';}
    }
    started.set(path, import(path+'?v=20261107').catch(() => {
      started.delete(path);
      const status=document.getElementById('load-status');
      status.hidden=false;status.className='error';
      status.innerHTML='An interactive viewer could not load. <a href="">Reload this page</a> or <a href="technical.html">open the evidence archive</a>.';
    }));
  }
}
function activate() {
  const chapter=document.body.dataset.activeChapter;
  if (!chapter || chapter==='overview') return;
  start('./workflow.js');
  if (chapter!=='cases') start('./narrative.js');
  if (chapter==='algorithm') { start('./method-interactions.js');start('./compact-motion.js'); }
  if (chapter==='algorithm'||/^case\d$/.test(chapter)) start('./response-motion.js');
}
addEventListener('research:chapter',activate);
activate();
