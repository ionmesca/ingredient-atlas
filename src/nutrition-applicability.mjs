// Additive reviewed whole-chicken mass-basis policy; never alter nutrient/profile/image values.
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync,rmSync,lstatSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {canonical,hash} from './nutrition-sync.mjs';
import {acquireExportMaintenance} from './export-maintenance-lock.mjs';
import {loadCandlenutLabelOverrides} from './candlenut-label.mjs';
const pq=createRequire(import.meta.url)('parquetjs-lite');
const SLUG='whole-chicken',FIELD='nutrition_applicability_json';
const SOURCE='nutrition/applicability.json',RECEIPT='nutrition/applicability.receipt.private.json',PENDING='nutrition/applicability.pending.private.json',TEMP='nutrition/applicability.parquet.private.tmp';
const same=(a,b)=>canonical(a??null)===canonical(b??null),assert=(v,m)=>{if(!v)throw Error(m);},parse=p=>JSON.parse(readFileSync(p));
const only=(v,keys)=>v&&Object.keys(v).every(k=>keys.includes(k));
const one=rows=>{const rs=rows.filter(r=>r.slug===SLUG);assert(rs.length===1,'Exact unique whole-chicken row required');return rs[0];};
const withoutPolicy=r=>{const c=structuredClone(r);delete c.metadata.nutritionApplicability;return c;};
const withoutColumn=r=>{const {[FIELD]:_,...rest}=r;return rest;};
const policyOf=r=>{if(Object.hasOwn(r.metadata,'nutritionApplicability')){assert(r.metadata.nutritionApplicability!==null,'Explicit null policy refused');return r.metadata.nutritionApplicability;}return null;};
const columnOf=r=>r[FIELD]===undefined?null:JSON.parse(r[FIELD]);
const withoutPolicySchema=(s,labelOverrides=[],directory)=>{const {[FIELD]:_,...rest}=structuredClone(s);for(const o of labelOverrides){const v=o.variants.find(v=>v.directory===directory);if(!v)continue;for(const[f,present]of [['nutrition_label_evidence_json',v.evidenceColumnPresent],['nutrition_per100g_json',v.profileColumnPresent],['nutrition_source',v.sourceColumnPresent],['nutrition_confidence',v.confidenceColumnPresent]])if(!present&&Object.hasOwn(rest,f)){assert(rest[f].type==='UTF8'&&rest[f].optional===true,'Reviewed label extension schema changed');delete rest[f];}}return rest;};
async function parquet(path,bytes=readFileSync(path)){const r=await pq.ParquetReader.openBuffer(bytes);try{const c=r.getCursor(),rows=[];let row;while((row=await c.next()))rows.push(row);return {rows,schema:r.schema.schema};}finally{await r.close();}}
const atomic=(p,b)=>{mkdirSync(dirname(p),{recursive:true});writeFileSync(p+'.applicability-tmp',b,{flag:'wx'});renameSync(p+'.applicability-tmp',p);};
function validatePolicy(p){assert(only(p,['policy','profileMassBasis','defaultInputMassBasis','sourceFdcId','evidenceSha256','reason'])&&p.policy==='explicit-edible-mass-required'&&p.profileMassBasis==='edible-meat-only'&&p.defaultInputMassBasis==='gross-as-purchased'&&p.sourceFdcId===171052&&/^[a-f0-9]{64}$/.test(p.evidenceSha256)&&p.reason?.trim(),'Exact reviewed food-state policy required');}
export function validateApplicabilityIntent(intent){
 const {review,intentHash,...body}=intent;assert(only(body,['version','changeId','writerId','slug','policy','variants'])&&body.version===1&&body.changeId?.trim()&&body.writerId?.trim()&&body.slug===SLUG&&intentHash===hash(body),'Exact sealed applicability intent required');validatePolicy(body.policy);
 assert(only(review,['status','intentHash','reviewerId','notes','reviewedAt','model']),'Non-public applicability review fields');
 assert(review?.status==='accepted'&&review.intentHash===intentHash&&review.reviewerId?.trim()&&review.reviewerId!==body.writerId&&review.notes?.trim(),'Independent applicability review required');
 assert(body.variants?.length===2&&same(body.variants.map(v=>v.directory),['dataset','public-dataset']),'Both applicability export variants required');
 for(const v of body.variants){assert(only(v,['directory','id','fullNonPolicyHash','jsonlNonPolicyHash','parquetNonPolicyHash','parquetSchemaHash','policyColumnPresent'])&&v.id==='ia_'+SLUG&&typeof v.policyColumnPresent==='boolean','Non-public or invalid applicability binding');for(const k of ['fullNonPolicyHash','jsonlNonPolicyHash','parquetNonPolicyHash','parquetSchemaHash'])assert(/^sha256:[a-f0-9]{64}$/.test(v[k]),'Invalid applicability baseline hash');}
 return intent;
}
export function loadApplicabilityOverrides(root,sourceBytes){assert(!existsSync(join(root,PENDING)),'Interrupted applicability transaction requires reconciliation before rebuild');if(sourceBytes===null||(sourceBytes===undefined&&!existsSync(join(root,SOURCE))))return [];const d=sourceBytes===undefined?parse(join(root,SOURCE)):JSON.parse(sourceBytes);assert(d.schemaVersion===1&&Array.isArray(d.overrides)&&d.overrides.length<=1,'Conflicting applicability source');d.overrides.forEach(validateApplicabilityIntent);return d.overrides;}
export function overlayApplicability(record,overrides){for(const o of overrides){validateApplicabilityIntent(o);if(record.slug!==SLUG)continue;assert(record.id==='ia_'+SLUG&&record.metadata?.usdaFdcId===171052&&o.variants.some(v=>v.fullNonPolicyHash===hash(withoutPolicy(record))),'Applicability canonical baseline changed');assert(policyOf(record)===null||same(policyOf(record),o.policy),'Applicability canonical policy changed');record.metadata.nutritionApplicability=structuredClone(o.policy);}return record;}
export async function captureApplicabilityIntent(root,writerId,policy,changeId='atlas-whole-chicken-basis-001'){
 root=resolve(root);const release=acquireExportMaintenance(root,'applicability-capture');try{validatePolicy(policy);assert(!existsSync(join(root,PENDING)),'Interrupted applicability transaction');const variants=[];
 for(const dir of ['dataset','public-dataset']){const r=one(parse(join(root,dir,'manifest.json')).records);assert(r.id==='ia_'+SLUG&&r.metadata?.usdaFdcId===171052&&policyOf(r)===null,'Exact unmodified nutrient identity required');const jr=one(readFileSync(join(root,dir,'metadata.jsonl'),'utf8').trim().split('\n').map(JSON.parse)),pr=await parquet(join(root,dir,'metadata.parquet'));assert(!Object.hasOwn(jr,FIELD)&&columnOf(one(pr.rows))===null,'Exact absent policy baseline required');if(pr.schema[FIELD])assert(pr.schema[FIELD].type==='UTF8'&&pr.schema[FIELD].optional===true,'Existing policy column schema conflict');variants.push({directory:dir,id:r.id,fullNonPolicyHash:hash(withoutPolicy(r)),jsonlNonPolicyHash:hash(withoutColumn(jr)),parquetNonPolicyHash:hash(withoutColumn(one(pr.rows))),parquetSchemaHash:hash(withoutPolicySchema(pr.schema,loadCandlenutLabelOverrides(root),dir)),policyColumnPresent:Object.hasOwn(pr.schema,FIELD)});}
 const body={version:1,changeId,writerId,slug:SLUG,policy,variants};return {...body,intentHash:hash(body),review:{status:'pending',intentHash:hash(body)}};
 }finally{release();}}
async function syncOwned({root,intent,mode='apply',write=false,expectedResultHash}){
 root=resolve(root);validateApplicabilityIntent(intent);assert(['apply','undo','readback'].includes(mode),'Unknown applicability mode');
 for(const p of ['nutrition','dataset','public-dataset',SOURCE,RECEIPT,PENDING,TEMP])assert(!existsSync(join(root,p))||!lstatSync(join(root,p)).isSymbolicLink(),'Applicability symlink target refused');
 assert(!existsSync(join(root,PENDING))&&!existsSync(join(root,'aliases/apply.pending.private.json'))&&!existsSync(join(root,'catalog-additions/apply.pending.private.json'))&&!existsSync(join(root,'nutrition/sync.lock')),'Pending maintenance requires reconciliation');
 const before=new Map(),writes=new Map();
 const snapshot=p=>{const path=join(root,p);assert(!lstatSync(path).isSymbolicLink(),'Applicability derived symlink refused');const b=readFileSync(path);before.set(path,b);return b;};
 const sourceBytes=existsSync(join(root,SOURCE))?snapshot(SOURCE):null,receiptBytes=existsSync(join(root,RECEIPT))?snapshot(RECEIPT):null;before.set(join(root,SOURCE),sourceBytes);before.set(join(root,RECEIPT),receiptBytes);
 const labelPath=join(root,"nutrition/candlenut-label.json"),labelBytes=existsSync(labelPath)?snapshot("nutrition/candlenut-label.json"):null;before.set(labelPath,labelBytes);
 const labelOverrides=loadCandlenutLabelOverrides(root,labelBytes),source=loadApplicabilityOverrides(root,sourceBytes),prior=receiptBytes?JSON.parse(receiptBytes):null;
 if(prior)assert(same(prior.intent,intent),'Changed applicability operation intent');assert(!source.length||same(source[0],intent),'Canonical applicability source changed');if(prior)assert(source.length===(prior.status==='applied'?1:0),'Applicability receipt/source disagreement');
 const resultHash=hash({intentHash:intent.intentHash,state:'after'});
 if(mode==='undo')assert(prior&&['applied','undone'].includes(prior.status)&&expectedResultHash===resultHash,'Undo requires exact applicability receipt/result');
 if(mode==='apply'&&prior)assert(prior.status==='applied','Reapplying an undone applicability intent refused');
 let expected=prior?.status==='applied'?'after':'before';if(!prior&&source.length){const r=one(parse(join(root,'dataset/manifest.json')).records);expected=policyOf(r)===null?'before':'after';}
 const desired=mode==='undo'?'before':'after';
 const stage=(p,b)=>{const path=join(root,p);assert(!lstatSync(path).isSymbolicLink(),'Applicability derived symlink refused');assert(before.has(path)&&readFileSync(path).equals(before.get(path)),'Concurrent applicability file edit during read; no mutation');writes.set(path,b);};
 for(const v of intent.variants){const dir=v.directory,mp=join(root,dir,'manifest.json'),m=JSON.parse(snapshot(dir+'/manifest.json')),r=one(m.records);assert(r.id===v.id&&r.metadata?.usdaFdcId===171052&&hash(withoutPolicy(r))===v.fullNonPolicyHash,'Applicability identity/unrelated fields changed');assert(same(policyOf(r),expected==='after'?intent.policy:null),'Applicability policy changed');
  const jp=join(root,dir,'metadata.jsonl'),lines=snapshot(dir+'/metadata.jsonl').toString('utf8').split('\n'),jr=one(lines.filter(Boolean).map(JSON.parse));assert(hash(withoutColumn(jr))===v.jsonlNonPolicyHash&&same(columnOf(jr),expected==='after'?intent.policy:null)&&(expected==='after'||!Object.hasOwn(jr,FIELD)),'Applicability JSONL metadata changed');
  const pp=join(root,dir,'metadata.parquet'),pr=await parquet(pp,snapshot(dir+'/metadata.parquet')),target=one(pr.rows);assert(hash(withoutColumn(target))===v.parquetNonPolicyHash&&same(columnOf(target),expected==='after'?intent.policy:null)&&hash(withoutPolicySchema(pr.schema,labelOverrides,dir))===v.parquetSchemaHash,'Applicability Parquet metadata/schema changed');
  assert(Object.hasOwn(pr.schema,FIELD)===(expected==='after'||v.policyColumnPresent),'Applicability Parquet policy-column presence changed');
  if(expected==='after'||v.policyColumnPresent)assert(pr.schema[FIELD]?.type==='UTF8'&&pr.schema[FIELD]?.optional===true,'Applicability Parquet column changed');
  if(mode==='readback'||expected===desired)continue;
  if(desired==='before'&&!v.policyColumnPresent)assert(pr.rows.filter(row=>row.slug!==SLUG).every(row=>row[FIELD]===undefined||row[FIELD]===null),'Undo would drop another ingredient policy; conflict');
  if(desired==='after')r.metadata.nutritionApplicability=structuredClone(intent.policy);else delete r.metadata.nutritionApplicability;
  stage(dir+'/manifest.json',Buffer.from(JSON.stringify(m,null,2)+'\n'));
  stage(dir+'/metadata.jsonl',Buffer.from(lines.map(l=>{if(!l)return l;const row=JSON.parse(l);if(row.slug!==SLUG)return l;if(desired==='after')row[FIELD]=canonical(intent.policy);else delete row[FIELD];return JSON.stringify(row);}).join('\n')));
  mkdirSync(join(root,'nutrition'),{recursive:true});assert(!existsSync(join(root,TEMP)),'Reserved applicability Parquet temp exists');
  const schema=structuredClone(pr.schema);if(desired==='after')schema[FIELD]={type:'UTF8',optional:true};else if(!v.policyColumnPresent)delete schema[FIELD];
  const writer=await pq.ParquetWriter.openFile(new pq.ParquetSchema(schema),join(root,TEMP));try{for(const row of pr.rows){if(row.slug===SLUG){if(desired==='after')row[FIELD]=canonical(intent.policy);else delete row[FIELD];}await writer.appendRow(row);}}finally{await writer.close();}
  stage(dir+'/metadata.parquet',readFileSync(join(root,TEMP)));rmSync(join(root,TEMP));
 }
 for(const [path,bytes]of before)assert(bytes?existsSync(path)&&readFileSync(path).equals(bytes):!existsSync(path),'Concurrent applicability file edit during read; no mutation');
 if(mode==='readback')return {status:prior?.status??(source.length?'canonical-applied':'unapplied'),state:expected,resultHash};
 if(expected===desired)return {status:'already-'+(desired==='after'?'applied':'undone'),resultHash};
 const changed=[...writes].filter(([p,b])=>!b.equals(before.get(p)));
 if(write){const sp=join(root,SOURCE);changed.push([sp,Buffer.from(JSON.stringify({schemaVersion:1,overrides:desired==='after'?[intent]:[]},null,2)+'\n')]);
  atomic(join(root,PENDING),JSON.stringify({intentHash:intent.intentHash,mode,files:changed.map(([p,b])=>({path:p.slice(root.length+1),beforeHash:before.get(p)?hash(before.get(p).toString('base64')):null,afterHash:hash(b.toString('base64'))}))},null,2)+'\n');
  for(const [p,b]of changed){const old=before.get(p);assert(old?existsSync(p)&&readFileSync(p).equals(old):!existsSync(p),'Concurrent applicability file edit; preserve pending receipt');atomic(p,b);}
  for(const [p,b]of changed)assert(readFileSync(p).equals(b),'Applicability write readback mismatch; preserve pending receipt');assert(receiptBytes?existsSync(join(root,RECEIPT))&&readFileSync(join(root,RECEIPT)).equals(receiptBytes):!existsSync(join(root,RECEIPT)),'Concurrent applicability receipt edit; preserve pending receipt');atomic(join(root,RECEIPT),JSON.stringify({intent,status:desired==='after'?'applied':'undone',resultHash},null,2)+'\n');rmSync(join(root,PENDING));
 }
 return {status:write?(desired==='after'?'applied':'undone'):(desired==='after'?'ready':'undo-ready'),resultHash,changedFiles:changed.map(([p])=>p.slice(root.length+1))};
}
export async function syncApplicability(options){const release=acquireExportMaintenance(options.root,'applicability');try{return await syncOwned(options);}finally{release();}}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];assert(args.includes('--intent'),'Provide reviewed --intent');console.log(JSON.stringify(await syncApplicability({root:args.includes('--root')?value('--root'):fileURLToPath(new URL('..',import.meta.url)),intent:parse(value('--intent')),mode:args.includes('--mode')?value('--mode'):'apply',write:args.includes('--write'),expectedResultHash:args.includes('--expected-result-hash')?value('--expected-result-hash'):undefined})));}
