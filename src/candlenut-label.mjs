// Exact reviewed candlenut label supplement; original publication and all image bytes remain intact.
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync,rmSync,lstatSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {canonical,hash} from './nutrition-sync.mjs';
import {acquireExportMaintenance} from './export-maintenance-lock.mjs';
const pq=createRequire(import.meta.url)('parquetjs-lite');
const SLUG='candlenut',FIELD='nutrition_label_evidence_json';
const SOURCE='nutrition/candlenut-label.json',RECEIPT='nutrition/candlenut-label.receipt.private.json',PENDING='nutrition/candlenut-label.pending.private.json',TEMP='nutrition/candlenut-label.parquet.private.tmp';
const same=(a,b)=>canonical(a??null)===canonical(b??null),assert=(v,m)=>{if(!v)throw Error(m);},parse=p=>JSON.parse(readFileSync(p));
const only=(v,keys)=>v&&Object.keys(v).every(k=>keys.includes(k));
const one=rows=>{const rs=rows.filter(r=>r.slug===SLUG);assert(rs.length===1,'Exact unique candlenut row required');return rs[0];};
const PROFILE='nutrition_per100g_json';
const owned=['nutritionPer100g','nutritionSource','nutritionLabelEvidence','nutritionNote','nutritionEvidence'];
const withoutLabelFields=r=>{const c=structuredClone(r);for(const k of owned)delete c.metadata[k];return c;};
const fieldsOf=r=>Object.fromEntries(owned.filter(k=>Object.hasOwn(r.metadata,k)).map(k=>[k,r.metadata[k]]));
const withoutColumn=r=>{const {[FIELD]:_,[PROFILE]:__,nutrition_source:___,nutrition_confidence:____,...rest}=r;return rest;};
const columns=['nutrition_source','nutrition_confidence',FIELD,PROFILE];
const columnOf=r=>Object.fromEntries(columns.filter(k=>Object.hasOwn(r,k)).map(k=>[k,r[k]]));
const withoutLabelSchema=s=>Object.fromEntries(Object.entries(s).filter(([k])=>!columns.includes(k)));
const presence=v=>[[FIELD,v.evidenceColumnPresent],[PROFILE,v.profileColumnPresent],['nutrition_source',v.sourceColumnPresent],['nutrition_confidence',v.confidenceColumnPresent]];
const afterFields=i=>({nutritionPer100g:VALUES,nutritionSource:'label',nutritionLabelEvidence:i.labelEvidence,nutritionNote:CURRENT_NOTE,nutritionEvidence:i.labelEvidence.evidence.map(e=>({url:e.url,snapshotSha256:e.snapshotHash,description:e.reason}))});
const afterColumns=i=>({nutrition_source:'label',nutrition_confidence:'source-backed',[PROFILE]:canonical(VALUES),[FIELD]:canonical(i.labelEvidence)});
const assignFields=(r,fields)=>{for(const k of owned)delete r.metadata[k];Object.assign(r.metadata,structuredClone(fields));};
const assignColumns=(r,fields)=>{for(const k of ['nutrition_source','nutrition_confidence',FIELD,PROFILE])delete r[k];Object.assign(r,fields);};
async function parquet(path,bytes=readFileSync(path)){const r=await pq.ParquetReader.openBuffer(bytes);try{const c=r.getCursor(),rows=[];let row;while((row=await c.next()))rows.push(row);return {rows,schema:r.schema.schema};}finally{await r.close();}}
const atomic=(p,b)=>{mkdirSync(dirname(p),{recursive:true});writeFileSync(p+'.candlenut-label-tmp',b,{flag:'wx'});renameSync(p+'.candlenut-label-tmp',p);};
export const CURRENT_NOTE='Nutrition uses Lucullus 47492 candlenut manufacturer label as a branded stand-in per 100 g product as labelled. Cooking state is not stated; carbohydrate uses the EU label definition, sugar zero is label-rounded and sodium is derived from declared salt. Per-kernel mass remains unresolved.';
export const VALUES={calories:671,proteinG:14.8,fatG:62.8,saturatedFatG:4.9,carbsG:11.7,sugarG:0,fiberG:2.07,sodiumMg:120};
export function validateLabelEvidence(e){
 assert(only(e,['changeId','writerId','food','origin','validation','fields','evidence','review','product','definitions'])&&e.food?.slug===SLUG&&e.food.unit==='per100g-edible'&&e.food.description?.trim()&&e.food.state?.trim()&&e.origin?.kind==='label'&&e.origin.description?.trim()&&e.validation?.status==='supported'&&e.validation.identityMatched===true&&e.validation.unitsMatched===true&&e.validation.notes?.trim(),'Exact public candlenut label evidence required');
 assert(e.writerId?.trim()&&e.review?.status==='accepted'&&e.review.changeId===e.changeId&&e.review.reviewerId?.trim()&&e.review.reviewerId!==e.writerId&&e.review.notes?.trim()&&/^\d{4}-\d{2}-\d{2}$/.test(e.review.reviewedAt),'Independent label review required');
 assert(same(e.product,{manufacturer:'Asian Food Group B.V.',brand:'Lucullus',itemNumber:'47492',EAN:'8710853051709',basis:'per100g-product-as-labelled',genericStandIn:true,thermalState:'not-stated'})&&same(e.definitions,{carbohydrate:'EU-declared-label',sugarZero:'declared-label-rounded',sodium:'declared-salt-divided-by-2.5',saltG:0.3,sodiumFactor:2.5,gramToMg:1000}),'Exact labelled product and derivation required');
 assert(same(Object.keys(e.fields).sort(),Object.keys(VALUES).sort()),'All eight label fields required');for(const[k,value]of Object.entries(VALUES))assert(e.fields[k].value===value&&same(e.fields[k].evidenceIds,k==='sodiumMg'?['lucullus-label','uk-salt-convention']:['lucullus-label']),'Exact label values/evidence required');
 assert(e.evidence?.length===2,'Exact original sources required');const l=e.evidence.find(x=>x.id==='lucullus-label'),u=e.evidence.find(x=>x.id==='uk-salt-convention');
 assert(l?.url==='https://psinfoodservice.com/en/product/588678-lucullus-kemirinoten-kg/'&&l.foodId==='Lucullus47492/EAN8710853051709'&&l.snapshotHash==='sha256:cd763a63ce57fdf0702f41efce155c00f638f1978c4496f5eeb375bcf60e8ad3'&&u?.url==='https://assets.publishing.service.gov.uk/media/5a8010d8e5274a2e87db7a62/Nutrition_Technical_Guidance.pdf'&&u.snapshotHash==='sha256:c033f8d596febfdb614391a05e7196f6d32d0fe6fc6e8e2f3f3190060295b667','Exact original label/conversion source required');
 for(const x of e.evidence)assert(only(x,['id','dataset','version','foodId','url','observedAt','reason','snapshotHash'])&&x.reason?.trim(),'Non-public evidence fields refused');
 assert(only(e.food,['slug','description','state','unit'])&&only(e.origin,['kind','description'])&&only(e.validation,['status','identityMatched','unitsMatched','notes'])&&only(e.review,['status','reviewerId','reviewedAt','changeId','notes'])&&Object.values(e.fields).every(f=>only(f,['value','evidenceIds'])),'Non-public evidence projection refused');
}
export function validateCandlenutLabelIntent(intent){
 const {review,intentHash,...body}=intent;assert(only(body,['version','changeId','writerId','slug','labelEvidence','variants'])&&body.version===1&&body.changeId===body.labelEvidence?.changeId&&body.writerId?.trim()&&body.slug===SLUG&&intentHash===hash(body),'Exact sealed candlenut label intent required');validateLabelEvidence(body.labelEvidence);
 assert(only(review,['status','intentHash','reviewerId','notes','reviewedAt','model'])&&review?.status==='accepted'&&review.intentHash===intentHash&&review.reviewerId?.trim()&&review.reviewerId!==body.writerId&&review.notes?.trim()&&/^\d{4}-\d{2}-\d{2}$/.test(review.reviewedAt),'Independent candlenut label operation review required');
 assert(body.variants?.length===2&&same(body.variants.map(v=>v.directory),['dataset','public-dataset']),'Both label export variants required');
 for(const v of body.variants){assert(only(v,['directory','id','fullNonProfileHash','fullBeforeHash','fullAfterHash','jsonlNonProfileHash','parquetNonProfileHash','parquetSchemaHash','evidenceColumnPresent','profileColumnPresent','sourceColumnPresent','confidenceColumnPresent','beforeFields','beforeColumns','beforeParquetColumns'])&&v.id==='ia_'+SLUG&&typeof v.evidenceColumnPresent==='boolean'&&typeof v.profileColumnPresent==='boolean'&&typeof v.sourceColumnPresent==='boolean'&&typeof v.confidenceColumnPresent==='boolean','Non-public or invalid label binding');
 assert(only(v.beforeFields,['nutritionSource','nutritionNote','nutritionEvidence'])&&v.beforeFields.nutritionSource==='missing'&&v.beforeFields.nutritionNote?.trim()&&same(v.beforeColumns,{nutrition_source:'missing',nutrition_confidence:'missing'}),'Strict explicit missing-profile baseline required');assert(same(v.beforeParquetColumns,{...(v.sourceColumnPresent?{nutrition_source:'missing'}:{}),...(v.confidenceColumnPresent?{nutrition_confidence:'missing'}:{})}),'Strict private/public Parquet missing baseline required');
 for(const k of ['fullNonProfileHash','fullBeforeHash','fullAfterHash','jsonlNonProfileHash','parquetNonProfileHash','parquetSchemaHash'])assert(/^sha256:[a-f0-9]{64}$/.test(v[k]),'Invalid label baseline hash');}
 return intent;
}
export function loadCandlenutLabelOverrides(root,sourceBytes){assert(!existsSync(join(root,PENDING)),'Interrupted candlenut-label transaction requires reconciliation before rebuild');if(sourceBytes===null||(sourceBytes===undefined&&!existsSync(join(root,SOURCE))))return [];const d=sourceBytes===undefined?parse(join(root,SOURCE)):JSON.parse(sourceBytes);assert(d.schemaVersion===1&&Array.isArray(d.overrides)&&d.overrides.length<=1,'Conflicting candlenut-label source');d.overrides.forEach(validateCandlenutLabelIntent);return d.overrides;}
export function overlayCandlenutLabel(record,overrides){for(const o of overrides){validateCandlenutLabelIntent(o);if(record.slug!==SLUG)continue;const v=o.variants.find(v=>v.fullNonProfileHash===hash(withoutLabelFields(record)));assert(record.id==='ia_'+SLUG&&record.metadata?.usdaFdcId===undefined&&v,'Label canonical baseline changed');assert((same(fieldsOf(record),v.beforeFields)&&hash(record)===v.fullBeforeHash)||(same(fieldsOf(record),afterFields(o))&&hash(record)===v.fullAfterHash),'Label canonical profile changed');assignFields(record,afterFields(o));assert(hash(record)===v.fullAfterHash,'Label canonical after hash changed');}return record;}
export async function captureCandlenutLabelIntent(root,writerId,labelEvidence){
 root=resolve(root);const release=acquireExportMaintenance(root,'candlenut-label-capture');try{validateLabelEvidence(labelEvidence);assert(!existsSync(join(root,PENDING)),'Interrupted candlenut label transaction');const variants=[];
 for(const dir of ['dataset','public-dataset']){const r=one(parse(join(root,dir,'manifest.json')).records);assert(r.id==='ia_'+SLUG&&r.metadata?.usdaFdcId===undefined&&only(fieldsOf(r),['nutritionSource','nutritionNote','nutritionEvidence'])&&r.metadata.nutritionSource==='missing'&&r.metadata.nutritionNote?.trim(),'Exact explicit missing candlenut baseline required');
 const jr=one(readFileSync(join(root,dir,'metadata.jsonl'),'utf8').trim().split('\n').map(JSON.parse)),pr=await parquet(join(root,dir,'metadata.parquet')),tr=one(pr.rows);assert(same(columnOf(jr),{nutrition_source:'missing',nutrition_confidence:'missing'})&&same(columnOf(tr),{...(pr.schema.nutrition_source?{nutrition_source:'missing'}:{}),...(pr.schema.nutrition_confidence?{nutrition_confidence:'missing'}:{})}),'Exact absent label derivatives required');
 for(const f of columns)if(pr.schema[f])assert(pr.schema[f].type==='UTF8'&&(![FIELD,PROFILE].includes(f)||pr.schema[f].optional===true),'Existing label column schema conflict');
 variants.push({directory:dir,id:r.id,fullNonProfileHash:hash(withoutLabelFields(r)),fullBeforeHash:hash(r),fullAfterHash:hash({...r,metadata:{...r.metadata,...afterFields({labelEvidence})}}),jsonlNonProfileHash:hash(withoutColumn(jr)),parquetNonProfileHash:hash(withoutColumn(tr)),parquetSchemaHash:hash(withoutLabelSchema(pr.schema)),evidenceColumnPresent:Object.hasOwn(pr.schema,FIELD),profileColumnPresent:Object.hasOwn(pr.schema,PROFILE),sourceColumnPresent:Object.hasOwn(pr.schema,'nutrition_source'),confidenceColumnPresent:Object.hasOwn(pr.schema,'nutrition_confidence'),beforeFields:fieldsOf(r),beforeColumns:columnOf(jr),beforeParquetColumns:columnOf(tr)});}
 const body={version:1,changeId:labelEvidence.changeId,writerId,slug:SLUG,labelEvidence,variants};return {...body,intentHash:hash(body),review:{status:'pending',intentHash:hash(body)}};
 }finally{release();}}
async function syncOwned({root,intent,mode='apply',write=false,expectedResultHash}){
 root=resolve(root);validateCandlenutLabelIntent(intent);assert(['apply','undo','readback'].includes(mode),'Unknown candlenut-label mode');
 for(const p of ['nutrition','dataset','public-dataset',SOURCE,RECEIPT,PENDING,TEMP])assert(!existsSync(join(root,p))||!lstatSync(join(root,p)).isSymbolicLink(),'CandlenutLabel symlink target refused');
 assert(!existsSync(join(root,PENDING))&&!existsSync(join(root,'aliases/apply.pending.private.json'))&&!existsSync(join(root,'catalog-additions/apply.pending.private.json'))&&!existsSync(join(root,'nutrition/sync.lock')),'Pending maintenance requires reconciliation');
 const before=new Map(),writes=new Map();
 const snapshot=p=>{const path=join(root,p);assert(!lstatSync(path).isSymbolicLink(),'CandlenutLabel derived symlink refused');const b=readFileSync(path);before.set(path,b);return b;};
 const sourceBytes=existsSync(join(root,SOURCE))?snapshot(SOURCE):null,receiptBytes=existsSync(join(root,RECEIPT))?snapshot(RECEIPT):null;before.set(join(root,SOURCE),sourceBytes);before.set(join(root,RECEIPT),receiptBytes);
 const source=loadCandlenutLabelOverrides(root,sourceBytes),prior=receiptBytes?JSON.parse(receiptBytes):null;
 if(prior)assert(same(prior.intent,intent),'Changed candlenut-label operation intent');assert(!source.length||same(source[0],intent),'Canonical candlenut-label source changed');if(prior)assert(source.length===(prior.status==='applied'?1:0),'CandlenutLabel receipt/source disagreement');
 const resultHash=hash({intentHash:intent.intentHash,state:'after'});
 if(mode==='undo')assert(prior&&['applied','undone'].includes(prior.status)&&expectedResultHash===resultHash,'Undo requires exact candlenut-label receipt/result');
 if(mode==='apply'&&prior)assert(prior.status==='applied','Reapplying an undone candlenut-label intent refused');
 let expected=prior?.status==='applied'?'after':'before';if(!prior&&source.length){const r=one(parse(join(root,'dataset/manifest.json')).records);expected=same(fieldsOf(r),intent.variants[0].beforeFields)?'before':'after';}
 const desired=mode==='undo'?'before':'after';
 const stage=(p,b)=>{const path=join(root,p);assert(!lstatSync(path).isSymbolicLink(),'CandlenutLabel derived symlink refused');assert(before.has(path)&&readFileSync(path).equals(before.get(path)),'Concurrent candlenut-label file edit during read; no mutation');writes.set(path,b);};
 for(const v of intent.variants){const dir=v.directory,mp=join(root,dir,'manifest.json'),m=JSON.parse(snapshot(dir+'/manifest.json')),r=one(m.records);assert(r.id===v.id&&r.metadata?.usdaFdcId===undefined&&hash(withoutLabelFields(r))===v.fullNonProfileHash,'CandlenutLabel identity/unrelated fields changed');assert(same(fieldsOf(r),expected==='after'?afterFields(intent):v.beforeFields)&&hash(r)===(expected==='after'?v.fullAfterHash:v.fullBeforeHash),'Candlenut label profile changed');
  const jp=join(root,dir,'metadata.jsonl'),lines=snapshot(dir+'/metadata.jsonl').toString('utf8').split('\n'),jr=one(lines.filter(Boolean).map(JSON.parse));assert(hash(withoutColumn(jr))===v.jsonlNonProfileHash&&same(columnOf(jr),expected==='after'?afterColumns(intent):v.beforeColumns),'CandlenutLabel JSONL metadata changed');
  const pp=join(root,dir,'metadata.parquet'),pr=await parquet(pp,snapshot(dir+'/metadata.parquet')),target=one(pr.rows);assert(hash(withoutColumn(target))===v.parquetNonProfileHash&&same(columnOf(target),expected==='after'?afterColumns(intent):v.beforeParquetColumns)&&hash(withoutLabelSchema(pr.schema))===v.parquetSchemaHash,'CandlenutLabel Parquet metadata/schema changed');
  for(const[f,present]of presence(v)){assert(Object.hasOwn(pr.schema,f)===(expected==='after'||present),'Candlenut label Parquet column presence changed');if(expected==='after'||present)assert(pr.schema[f]?.type==='UTF8'&&(![FIELD,PROFILE].includes(f)||pr.schema[f]?.optional===true),'Candlenut label Parquet column changed');if(desired==='before'&&!present)assert(pr.rows.filter(row=>row.slug!==SLUG).every(row=>row[f]===undefined||row[f]===null),'Undo would drop another ingredient label/profile; conflict');}
  if(mode==='readback'||expected===desired)continue;
  assignFields(r,desired==='after'?afterFields(intent):v.beforeFields);assert(hash(r)===(desired==='after'?v.fullAfterHash:v.fullBeforeHash),'Candlenut label proposed after/before hash mismatch');
  stage(dir+'/manifest.json',Buffer.from(JSON.stringify(m,null,2)+'\n'));
  stage(dir+'/metadata.jsonl',Buffer.from(lines.map(l=>{if(!l)return l;const row=JSON.parse(l);if(row.slug!==SLUG)return l;assignColumns(row,desired==='after'?afterColumns(intent):v.beforeColumns);return JSON.stringify(row);}).join('\n')));
  mkdirSync(join(root,'nutrition'),{recursive:true});assert(!existsSync(join(root,TEMP)),'Reserved candlenut-label Parquet temp exists');
  const schema=structuredClone(pr.schema);for(const[f,present]of presence(v)){if(desired==='after'&&!present)schema[f]={type:'UTF8',optional:true};else if(!present)delete schema[f];}
  const writer=await pq.ParquetWriter.openFile(new pq.ParquetSchema(schema),join(root,TEMP));try{for(const row of pr.rows){if(row.slug===SLUG){assignColumns(row,desired==='after'?afterColumns(intent):v.beforeParquetColumns);}await writer.appendRow(row);}}finally{await writer.close();}
  stage(dir+'/metadata.parquet',readFileSync(join(root,TEMP)));rmSync(join(root,TEMP));
 }
 for(const [path,bytes]of before)assert(bytes?existsSync(path)&&readFileSync(path).equals(bytes):!existsSync(path),'Concurrent candlenut-label file edit during read; no mutation');
 if(mode==='readback')return {status:prior?.status??(source.length?'canonical-applied':'unapplied'),state:expected,resultHash};
 if(expected===desired)return {status:'already-'+(desired==='after'?'applied':'undone'),resultHash};
 const changed=[...writes].filter(([p,b])=>!b.equals(before.get(p)));
 if(write){const sp=join(root,SOURCE);changed.push([sp,Buffer.from(JSON.stringify({schemaVersion:1,overrides:desired==='after'?[intent]:[]},null,2)+'\n')]);
  atomic(join(root,PENDING),JSON.stringify({intentHash:intent.intentHash,mode,files:changed.map(([p,b])=>({path:p.slice(root.length+1),beforeHash:before.get(p)?hash(before.get(p).toString('base64')):null,afterHash:hash(b.toString('base64'))}))},null,2)+'\n');
  for(const [p,b]of changed){const old=before.get(p);assert(old?existsSync(p)&&readFileSync(p).equals(old):!existsSync(p),'Concurrent candlenut-label file edit; preserve pending receipt');atomic(p,b);}
  for(const [p,b]of changed)assert(readFileSync(p).equals(b),'CandlenutLabel write readback mismatch; preserve pending receipt');assert(receiptBytes?existsSync(join(root,RECEIPT))&&readFileSync(join(root,RECEIPT)).equals(receiptBytes):!existsSync(join(root,RECEIPT)),'Concurrent candlenut-label receipt edit; preserve pending receipt');atomic(join(root,RECEIPT),JSON.stringify({intent,status:desired==='after'?'applied':'undone',resultHash},null,2)+'\n');rmSync(join(root,PENDING));
 }
 return {status:write?(desired==='after'?'applied':'undone'):(desired==='after'?'ready':'undo-ready'),resultHash,changedFiles:changed.map(([p])=>p.slice(root.length+1))};
}
export async function syncCandlenutLabel(options){const release=acquireExportMaintenance(options.root,'candlenut-label');try{return await syncOwned(options);}finally{release();}}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];assert(args.includes('--intent'),'Provide reviewed --intent');console.log(JSON.stringify(await syncCandlenutLabel({root:args.includes('--root')?value('--root'):fileURLToPath(new URL('..',import.meta.url)),intent:parse(value('--intent')),mode:args.includes('--mode')?value('--mode'):'apply',write:args.includes('--write'),expectedResultHash:args.includes('--expected-result-hash')?value('--expected-result-hash'):undefined})));}
