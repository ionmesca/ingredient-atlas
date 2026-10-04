// Two bounded, independently reviewed alias corrections. No image, nutrition, ID or recipe changes.
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync,openSync,closeSync,rmSync,lstatSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {canonical,hash} from './nutrition-sync.mjs';
import {acquireExportMaintenance} from './export-maintenance-lock.mjs';
const parquet=createRequire(import.meta.url)('parquetjs-lite');
const same=(a,b)=>canonical(a)===canonical(b);
const OPERATIONS = Object.freeze({
 'kecap manis': Object.freeze({alias:'kecap manis',key:'kecap-manis',from:'soy-sauce',to:'indonesian-sweet-soy-sauce',changeId:'atlas-kecap-manis-001',receiptPath:'aliases/receipt.private.json',reason:'Exact kecap manis is Indonesian sweet soy sauce, distinct from salty soy sauce. Generic ketjap is outside this correction.'}),
 'red lentils': Object.freeze({alias:'red lentils',key:'red-lentils',from:'lentils',to:'red-lentils',changeId:'atlas-red-lentils-001',receiptPath:'aliases/receipts/red-lentils.private.json',reason:'Exact red lentils names the independently published red-lentil identity, not generic brown lentils. Move only this alias; preserve all nutrients, density, artwork, IDs and recipe references.'}),
});
const sourcePath='aliases/overrides.json', pendingPath='aliases/apply.pending.private.json';
function operation(alias){assert(Object.hasOwn(OPERATIONS,alias),'Unsupported bounded alias operation');return OPERATIONS[alias];}
function intentOperation(intent){const o=operation(intent.alias);assert(intent.fromSlug===o.from&&intent.toSlug===o.to,'Exact alias food identities required');return o;}
const withoutAliases=r=>{const {aliases,...rest}=r;return rest;};
const afterAliases=(a,alias)=>a.filter(x=>x!==alias);
const assert=(v,m)=>{if(!v)throw Error(m);};
const only=(v,keys)=>Object.keys(v).every(k=>keys.includes(k));
const parse=p=>JSON.parse(readFileSync(p));
const one=(rows,slug)=>{const rs=rows.filter(r=>r.slug===slug);assert(rs.length===1,'Exact unique alias ingredient required');return rs[0];};
const fieldState=(aliases,before,alias)=>same(aliases,before)?'before':same(aliases,afterAliases(before,alias))?'after':null;
async function parquetRows(path){const reader=await parquet.ParquetReader.openFile(path);try{const cursor=reader.getCursor(),rows=[];let row;while((row=await cursor.next()))rows.push(row);return {rows,schema:reader.schema.schema};}finally{await reader.close();}}
function bindRecord(r){return {id:r.id,slug:r.slug,aliases:r.aliases,nonAliasHash:hash(withoutAliases(r))};}
function bindRow(r,field='aliases'){const {[field]:a,...rest}=r;return {aliasesPresent:a!==undefined,...(a!==undefined?{aliases:field==='aliases_json'?JSON.parse(a):a}:{}),nonAliasHash:hash(rest)};}
export async function captureAliasIntent(root,writerId,changeId,alias='kecap manis'){
 const o=operation(alias),{alias:ALIAS,key:KEY,from:FROM,to:TO}=o;changeId??=o.changeId;
 root=resolve(root);const variants=[],compact=[];
 for(const dir of ['dataset','public-dataset']){
  const doc=parse(join(root,dir,'manifest.json')), from=one(doc.records,FROM),to=one(doc.records,TO);
  assert(from.id==='ia_'+FROM&&to.id==='ia_'+TO&&from.aliases.filter(x=>x===ALIAS).length===1&&to.aliases.includes(ALIAS),'Exact before alias ownership required');
  const rows=readFileSync(join(root,dir,'metadata.jsonl'),'utf8').trim().split('\n').map(JSON.parse),pr=await parquetRows(join(root,dir,'metadata.parquet'));
  variants.push({directory:dir,from:bindRecord(from),to:bindRecord(to),jsonl:bindRow(one(rows,FROM)),parquet:bindRow(one(pr.rows,FROM),'aliases_json')});
 }
 for(const path of ['dataset/manifest.compact.json','public-dataset/manifest.compact.json','data/manifest.compact.json']){const d=parse(join(root,path));assert(d.aliases?.[KEY]?.slug===FROM,'Exact compact before-owner required');compact.push({path,from:bindRow(d.recordsBySlug[FROM]),to:bindRow(d.recordsBySlug[TO])});}
 const body={version:1,changeId,writerId,alias:ALIAS,fromSlug:FROM,toSlug:TO,reason:o.reason,variants,compact};
 return {...body,intentHash:hash(body),review:{status:'pending',intentHash:hash(body)}};
}
export function validateAliasIntent(intent){
 const {alias:ALIAS,from:FROM,to:TO}=intentOperation(intent);
 const {review,intentHash,...body}=intent;
 assert(same(Object.keys(body).sort(),['version','changeId','writerId','alias','fromSlug','toSlug','reason','variants','compact'].sort())&&body.reason?.trim(),'Public-safe exact alias source fields required');
 assert(intentHash===hash(body)&&body.version===1&&body.alias===ALIAS&&body.fromSlug===FROM&&body.toSlug===TO&&body.changeId?.trim()&&body.writerId?.trim(),'Exact sealed alias intent required');
 assert(review?.status==='accepted'&&review.intentHash===intentHash&&review.reviewerId?.trim()&&review.reviewerId!==body.writerId&&review.notes?.trim(),'Independent alias review required');
 assert(body.variants?.length===2&&same(body.variants.map(v=>v.directory),['dataset','public-dataset']),'Both alias variants required');
 assert(body.compact?.length===3&&same(body.compact.map(c=>c.path),['dataset/manifest.compact.json','public-dataset/manifest.compact.json','data/manifest.compact.json']),'Exact compact bindings required');
 for(const c of body.compact)for(const b of [c.from,c.to])assert(typeof b.aliasesPresent==='boolean'&&/^sha256:[a-f0-9]{64}$/.test(b.nonAliasHash)&&(!b.aliasesPresent||Array.isArray(b.aliases)),'Invalid compact alias baseline');
 for(const c of body.compact)assert(only(c,['path','from','to'])&&[c.from,c.to].every(b=>only(b,['aliasesPresent','aliases','nonAliasHash'])),'Non-public compact source field');
 for(const v of body.variants)assert(only(v,['directory','from','to','jsonl','parquet'])&&[v.from,v.to].every(b=>only(b,['id','slug','aliases','nonAliasHash']))&&[v.jsonl,v.parquet].every(b=>only(b,['aliasesPresent','aliases','nonAliasHash'])),'Non-public alias source field');
 for(const v of body.variants){assert(v.from.id==='ia_'+FROM&&v.from.slug===FROM&&v.to.id==='ia_'+TO&&v.to.slug===TO,'Stable alias IDs required');for(const b of [v.from,v.jsonl,v.parquet])assert(Array.isArray(b.aliases)&&b.aliases.filter(x=>x===ALIAS).length===1&&/^sha256:[a-f0-9]{64}$/.test(b.nonAliasHash),'Exact alias baseline required');assert(v.to.aliases.includes(ALIAS)&&/^sha256:[a-f0-9]{64}$/.test(v.to.nonAliasHash),'Exact target alias baseline required');}
 return intent;
}
export function loadAliasOverrides(root){
 assert(!existsSync(join(root,pendingPath)),'Interrupted alias transaction requires reconciliation before rebuild');
 const p=join(root,sourcePath);if(!existsSync(p))return [];
 const d=parse(p);assert(d.schemaVersion===1&&Array.isArray(d.overrides)&&d.overrides.length<=Object.keys(OPERATIONS).length,'Conflicting alias overrides');d.overrides.forEach(validateAliasIntent);assert(new Set(d.overrides.map(o=>o.alias)).size===d.overrides.length&&new Set(d.overrides.map(o=>o.changeId)).size===d.overrides.length,'Conflicting duplicate alias overrides');return d.overrides;
}
// Pure canonical overlay for rebuilding: remove only the accepted wrong string.
// Other fields remain whatever the independently built record contains.
export function overlayAliases(record,overrides){
 for(const o of overrides){validateAliasIntent(o);const {alias:ALIAS,from:FROM}=intentOperation(o);if(record.slug!==FROM)continue;
  assert(record.id==='ia_'+FROM,'Alias overlay stable identity conflict');
  assert(o.variants.some(v=>fieldState(record.aliases,v.from.aliases,ALIAS)),'Alias overlay baseline conflict');
  record.aliases=afterAliases(record.aliases,ALIAS);
 }
 return record;
}
function checkFull(record,binding,state,alias){assert(record.id===binding.id&&record.slug===binding.slug&&hash(withoutAliases(record))===binding.nonAliasHash,'Alias record identity/unrelated fields changed');assert(state==='before'?same(record.aliases,binding.aliases):same(record.aliases,afterAliases(binding.aliases,alias)),'Alias arrays changed');}
function checkRow(row,binding,field,state,alias){const {[field]:a,...rest}=row;assert(hash(rest)===binding.nonAliasHash,'Alias derivative unrelated fields changed');if(binding.aliasesPresent===false){assert(a===undefined,'Alias derivative field added');return;}const aliases=field==='aliases_json'?JSON.parse(a):a;assert(state==='before'?same(aliases,binding.aliases):same(aliases,afterAliases(binding.aliases,alias)),'Alias derivative arrays changed');}
function patchCompact(doc,mode,intent){
 const {alias:ALIAS,key:KEY,from:FROM,to:TO}=intentOperation(intent);
 const from=doc.recordsBySlug[FROM],to=doc.recordsBySlug[TO];assert(from?.slug===FROM&&to?.slug===TO,'Missing compact alias ingredient');
 const expected=mode==='apply'?FROM:TO;assert(doc.aliases[KEY]?.slug===expected,'Compact alias ownership conflict');
 const fix=r=>{if(r.slug===FROM&&r.aliases){if(mode==='apply')r.aliases=afterAliases(r.aliases,ALIAS);else{const index=doc._beforeAliases?.indexOf(ALIAS);assert(index>=0,'Compact undo baseline missing');r.aliases=[...doc._beforeAliases];}}};
 fix(from);for(const r of Object.values(doc.aliases))fix(r);doc.aliases[KEY]=structuredClone(mode==='apply'?to:from);delete doc._beforeAliases;return doc;
}
const atomic=(p,b)=>{mkdirSync(dirname(p),{recursive:true});writeFileSync(p+'.alias-tmp',b,{flag:'wx'});renameSync(p+'.alias-tmp',p);};
async function syncAliasesOwned({root,intent,mode='apply',write=false,expectedResultHash}){
 root=resolve(root);validateAliasIntent(intent);const {alias:ALIAS,key:KEY,from:FROM,to:TO,receiptPath}=intentOperation(intent);assert(['apply','undo','readback'].includes(mode),'Unknown alias mode');
 const owned=['aliases','aliases/receipts','data',sourcePath,receiptPath,pendingPath,'aliases/parquet.private.tmp','catalog-additions/apply.pending.private.json','nutrition/sync.lock','catalog-additions/apply.lock'];
 for(const p of owned)assert(!existsSync(join(root,p))||!lstatSync(join(root,p)).isSymbolicLink(),'Alias symlink target refused');
 assert(!existsSync(join(root,pendingPath))&&!existsSync(join(root,'catalog-additions/apply.pending.private.json'))&&!existsSync(join(root,'nutrition/sync.lock'))&&!existsSync(join(root,'catalog-additions/apply.lock')),'Pending/concurrent maintenance must be reconciled first');
 mkdirSync(join(root,'aliases'),{recursive:true});const lock=join(root,'aliases/apply.lock'),fd=openSync(lock,'wx',0o600);
 try{
  const sp=join(root,sourcePath),sourceBefore=existsSync(sp)?readFileSync(sp):null;
  const existing=loadAliasOverrides(root),current=existing.find(o=>o.alias===ALIAS),prior=existsSync(join(root,receiptPath))?parse(join(root,receiptPath)):null;
  assert(!existing.some(o=>o.alias!==ALIAS&&o.changeId===intent.changeId),'Alias change ID already belongs to another operation');
  if(prior)assert(same(prior.intent,intent),'Changed alias intent');
  assert(!current||same(current,intent),'Canonical alias source changed');
  if(prior)assert(Boolean(current)===(prior.status==='applied'),'Receipt/canonical alias source disagree');
  const resultHash=hash({intentHash:intent.intentHash,state:'after'});
  if(mode==='undo')assert(prior&&['applied','undone'].includes(prior.status)&&expectedResultHash===resultHash&&Boolean(current)===(prior.status==='applied'),'Undo requires receipt and exact result');
  if(mode==='apply'&&prior)assert(prior.status==='applied'&&Boolean(current),'Reapplying an undone/missing-source intent is refused');
  let expected=prior?.status==='applied'?'after':'before';
  if(!prior&&current){const d=parse(join(root,'dataset/manifest.json'));expected=fieldState(one(d.records,FROM).aliases,intent.variants[0].from.aliases,ALIAS);assert(expected,'Canonical-only alias baseline conflict');}
  const before=new Map(),writes=new Map();const stage=(path,bytes)=>{const p=join(root,path);assert(!lstatSync(p).isSymbolicLink(),'Alias derived symlink refused');before.set(p,readFileSync(p));writes.set(p,bytes);};
  for(const v of intent.variants){
   const dir=v.directory,p=join(root,dir,'manifest.json');assert(!lstatSync(join(root,dir)).isSymbolicLink(),'Alias dataset symlink refused');const d=parse(p),from=one(d.records,FROM),to=one(d.records,TO);
   checkFull(from,v.from,expected,ALIAS);checkFull(to,v.to,'before',ALIAS);
   if(mode!=='readback'){from.aliases=mode==='apply'?afterAliases(v.from.aliases,ALIAS):v.from.aliases;stage(dir+'/manifest.json',Buffer.from(JSON.stringify(d,null,2)+'\n'));}
   const jp=join(root,dir,'metadata.jsonl'),lines=readFileSync(jp,'utf8').split('\n'),jr=one(lines.filter(Boolean).map(JSON.parse),FROM);checkRow(jr,v.jsonl,'aliases',expected,ALIAS);
   if(mode!=='readback')stage(dir+'/metadata.jsonl',Buffer.from(lines.map(l=>{if(!l)return l;const r=JSON.parse(l);if(r.slug===FROM){r.aliases=mode==='apply'?afterAliases(v.jsonl.aliases,ALIAS):v.jsonl.aliases;return JSON.stringify(r);}return l;}).join('\n')));
   const pp=join(root,dir,'metadata.parquet'),pr=await parquetRows(pp);checkRow(one(pr.rows,FROM),v.parquet,'aliases_json',expected,ALIAS);
   if(mode!=='readback'&&expected!==(mode==='apply'?'after':'before')){
    const temp=join(root,'aliases/parquet.private.tmp');assert(!existsSync(temp),'Reserved Parquet temporary file exists; reconcile first');const writer=await parquet.ParquetWriter.openFile(new parquet.ParquetSchema(pr.schema),temp);
    try{for(const r of pr.rows){if(r.slug===FROM)r.aliases_json=JSON.stringify(mode==='apply'?afterAliases(v.parquet.aliases,ALIAS):v.parquet.aliases);await writer.appendRow(r);}}finally{await writer.close();}
    stage(dir+'/metadata.parquet',readFileSync(temp));rmSync(temp);
   }
  }
  // Compact alias entries embed records; update only the old record alias array,
  // and transfer this one resolver key. All other owner keys remain unchanged.
  for(const b of intent.compact){const path=b.path;
   const d=parse(join(root,path));
   assert(d.aliases?.[KEY]?.slug===(expected==='before'?FROM:TO),'Compact alias owner changed');
   const f=d.recordsBySlug[FROM];assert(f&&d.recordsBySlug[TO],'Compact identity missing');
   checkRow(f,b.from,'aliases',expected,ALIAS);checkRow(d.recordsBySlug[TO],b.to,'aliases','before',ALIAS);
   assert(same(d.aliases[KEY],d.recordsBySlug[expected==='before'?FROM:TO]),'Compact alias embedded record changed');
   for(const r of Object.values(d.aliases))if(r.slug===FROM)assert(same(r,f),'Compact old-owner embedded record changed');
   if(mode!=='readback'&&expected!==(mode==='apply'?'after':'before')){d._beforeAliases=b.from.aliases;stage(path,Buffer.from(JSON.stringify(patchCompact(d,mode,intent),null,2)+'\n'));}
  }
  assert(sourceBefore?existsSync(sp)&&readFileSync(sp).equals(sourceBefore):!existsSync(sp),'Concurrent canonical alias source change');
  if(mode==='readback')return {status:prior?.status??(current?'canonical-applied':'unapplied'),state:expected,resultHash};
  const already=expected===(mode==='apply'?'after':'before');if(already)return {status:'already-'+(mode==='apply'?'applied':'undone'),resultHash};
  const changed=[...writes].filter(([p,b])=>!b.equals(before.get(p)));
  if(write){
   before.set(sp,sourceBefore);changed.push([sp,Buffer.from(JSON.stringify({schemaVersion:1,overrides:mode==='apply'?(current?existing:[...existing,intent]):existing.filter(o=>o.alias!==ALIAS)},null,2)+'\n')]);
   atomic(join(root,pendingPath),JSON.stringify({intentHash:intent.intentHash,mode,files:changed.map(([p,b])=>({path:p.slice(root.length+1),beforeHash:before.get(p)?hash(before.get(p).toString('base64')):null,afterHash:hash(b.toString('base64'))}))},null,2)+'\n');
   for(const [p,b]of changed){const old=before.get(p);assert(old?existsSync(p)&&readFileSync(p).equals(old):!existsSync(p),'Concurrent alias file change; preserve pending receipt');atomic(p,b);}
   for(const [p,b]of changed)assert(readFileSync(p).equals(b),'Alias written-file readback differs; preserve pending receipt');
   atomic(join(root,receiptPath),JSON.stringify({intent,status:mode==='apply'?'applied':'undone',resultHash},null,2)+'\n');rmSync(join(root,pendingPath));
  }
  return {status:write?(mode==='apply'?'applied':'undone'):(mode==='apply'?'ready':'undo-ready'),resultHash,changedFiles:changed.map(([p])=>p.slice(root.length+1)),alias:ALIAS,from:FROM,to:TO};
 }finally{closeSync(fd);rmSync(lock);}
}
export async function syncAliases(options){const release=acquireExportMaintenance(options.root,'alias');try{return await syncAliasesOwned(options);}finally{release();}}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];
 assert(args.includes('--intent'),'Provide exact reviewed --intent file');
 const result=await syncAliases({root:args.includes('--root')?value('--root'):fileURLToPath(new URL('..',import.meta.url)),intent:parse(value('--intent')),mode:args.includes('--mode')?value('--mode'):'apply',write:args.includes('--write'),expectedResultHash:args.includes('--expected-result-hash')?value('--expected-result-hash'):undefined});
 console.log(JSON.stringify(result));
}
