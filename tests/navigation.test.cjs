const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../showcase/navigation.js'),'utf8');
function setup(initial=''){
  const listeners={},events=[],scrolls=[],focus=[];
  const chapters=['overview','materials','algorithm','cases','case1','case2','case3'].map(id=>({id,dataset:{chapter:id},hidden:id!=='overview',querySelector(){return {focus(){focus.push(id);}}},closest(){return this;}}));
  const main={focus(){focus.push('main')},closest(){return null}};
  const inspection={closest(selector){return selector==='[data-chapter]'?chapters[1]:chapters[1].hidden?chapters[1]:null},scrollIntoView(){scrolls.push('inspection')}};
  const links=['overview','materials','algorithm','cases'].map(id=>({hash:'#'+id,attrs:{},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]}}));
  const ids={...Object.fromEntries(chapters.map(c=>[c.id,c])),main,'material-inspection':inspection};
  const document={readyState:'complete',title:'',body:{dataset:{}},getElementById(id){return ids[id]||null},querySelectorAll(s){return s==='[data-chapter]'?chapters:s==='.chapter-nav a'?links:[]},querySelector(s){return chapters.find(c=>s.includes('"'+c.id+'"'))}};
  const location={hash:initial,replace(url){this.replaced=url}};
  const window={scrollTo(){scrolls.push('top')},dispatchEvent(e){events.push(e)}};
  vm.runInNewContext(source,{document,location,window,addEventListener(name,fn){listeners[name]=fn},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}},Set,Object});
  return {document,location,chapters,links,focus,scrolls,events,go(hash){location.hash=hash;listeners.hashchange()}};
}
test('clean URL opens the research overview, with one active chapter',()=>{
  const s=setup();assert.deepEqual(s.chapters.filter(c=>!c.hidden).map(c=>c.id),['overview']);assert.equal(s.document.body.dataset.activeChapter,'overview');
});
test('case deep link opens that case and highlights the case index',()=>{
  const s=setup('#case2');assert.equal(s.document.body.dataset.activeChapter,'case2');assert.equal(s.links[3].attrs['aria-current'],'page');assert.match(s.document.title,/Contour Bench/);
});
test('skip to main keeps the current method chapter',()=>{
  const s=setup('#algorithm');s.go('#main');assert.equal(s.document.body.dataset.activeChapter,'algorithm');assert.equal(s.focus.at(-1),'main');
});
test('chapter transitions focus their new heading, and back restores case index',()=>{
  const s=setup('#cases');s.go('#case3');assert.equal(s.focus.at(-1),'case3');s.go('#cases');assert.equal(s.focus.at(-1),'cases');assert.equal(s.chapters.filter(c=>!c.hidden).length,1);
});
test('a material figure deep link selects materials and scrolls to the figure',()=>{
  const s=setup('#case1');s.go('#material-inspection');assert.equal(s.document.body.dataset.activeChapter,'materials');assert.equal(s.scrolls.at(-1),'inspection');
});
test('historical chapter aliases and archived links remain usable',()=>{
  const s=setup('#comparison');assert.equal(s.document.body.dataset.activeChapter,'cases');s.go('#evidence');assert.equal(s.document.body.dataset.activeChapter,'materials');s.go('#nodes');assert.equal(s.location.replaced,'technical.html#nodes');
});
test('malformed and unknown fragments do not crash navigation',()=>{
  const s=setup('#%E0%A4%A');assert.equal(s.document.body.dataset.activeChapter,'overview');s.go('#unknown');assert.equal(s.document.body.dataset.activeChapter,'overview');
});
