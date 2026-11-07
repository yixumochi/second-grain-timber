const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.join(__dirname,'../showcase/assets/ai-process');
const record=JSON.parse(fs.readFileSync(path.join(root,'process.json'),'utf8'));
const geometry=JSON.parse(fs.readFileSync(path.join(root,'bench-geometry.json'),'utf8'));

test('published evidence images match the archived source digests',()=>{
  for(const item of record.images){
    const data=fs.readFileSync(path.join(root,item.file));
    assert.equal(data.length,item.bytes,item.file);
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'),item.sha256,item.file);
  }
  assert.equal(record.material99397.mergedPointCount,Object.values(record.material99397.pointCounts).reduce((a,b)=>a+b,0));
});

test('paired geometry preserves identities and recorded longitudinal extents',()=>{
  const ids=g=>g.parts.map(p=>p.id).sort();
  assert.deepEqual(ids(geometry.before),ids(geometry.after));
  assert.equal(new Set(ids(geometry.before)).size,716);
  for(const name of ['before','after']){
    const g=geometry[name];
    const low=Math.min(...g.parts.map(p=>p.y));
    const high=Math.max(...g.parts.map(p=>p.y+p.thickness));
    assert.ok(Math.abs(high-low-g.lengthMm)<1e-6,name);
    for(const p of g.parts){assert.ok(p.thickness>0);assert.ok(p.polygon.length>=3);assert.ok(p.polygon.flat().every(Number.isFinite));}
  }
  assert.equal(record.bench.allocationStageModelCalls,0);
});

test('defect experiments retain their two different outcomes and complete material balance',()=>{
  const probes=record.defect115200.scenarios;
  assert.equal(probes.find(p=>p.demandMm===900).after,'INFEASIBLE');
  const small=probes.find(p=>p.demandMm===600);
  assert.equal(small.after,'OPTIMAL');
  for(const p of probes){
    assert.equal(p.currentProjectModified,false);
    assert.ok(Math.abs(p.partition.parts.reduce((s,v)=>s+v.length_mm,0)-record.defect115200.sellerLengthMm)<1e-6);
  }
  const c=small.afterCutting;
  assert.ok(Math.abs(c.used_mm+c.excluded_mm+c.preparation_kerf_mm+c.allocation_kerf_mm+c.selected_offcut_mm-c.source_length_mm)<1e-6);
});

test('request comparison preserves hard constraints and authentic interpretation provenance',()=>{
  const prompts=record.agentPrompts;
  assert.equal(prompts.length,3);
  prompts.forEach(p=>{assert.equal(p.mode,'REAL_API');assert.equal(p.hardConstraints.no_splicing,true);assert.equal(p.validation.llm_calculates_structure,false);});
  assert.equal(prompts[0].hardConstraints.internal_support_forbidden,true);
  assert.equal(prompts[1].hardConstraints.internal_support_forbidden,false);
  assert.deepEqual(prompts[1].hardConstraints,prompts[2].hardConstraints);
  assert.equal(prompts[2].preferences.fabrication,'FEWER_CUTS');
});

test('structural comparison retains both improved wind and increased gravity responses',()=>{
  const cases=record.shelter.caseComparison;
  const wind=cases.find(c=>c.case==='WY_POS'),gravity=cases.find(c=>c.case==='D');
  assert.ok(wind.current_mm<wind.previous_mm);
  assert.ok(gravity.current_mm>gravity.previous_mm);
  assert.equal(record.shelter.notStructurallyVerified,true);
});

test('public extracts do not contain workstation paths or API credentials',()=>{
  for(const file of ['process.json','bench-geometry.json']){
    const text=fs.readFileSync(path.join(root,file),'utf8');
    assert.doesNotMatch(text,/[A-Z]:\\\\|Bearer\s+[A-Za-z0-9]|sk-[A-Za-z0-9]{20,}|"api_key"\s*:/);
  }
});
