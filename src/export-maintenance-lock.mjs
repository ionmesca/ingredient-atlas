// Shared exclusive lock for actual export/source maintenance writers.
import {openSync,writeFileSync,readFileSync,closeSync,rmSync,lstatSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
export function acquireExportMaintenance(root,operation){
 root=resolve(root);
 if(lstatSync(root).isSymbolicLink())throw Error('Symlink maintenance root refused');
 const path=join(root,'export-maintenance.lock'),owner=JSON.stringify({pid:process.pid,operation,token:randomUUID()}),fd=(()=>{try{return openSync(path,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw Error('Export maintenance locked; finish or reconcile the owning writer first');throw e;}})();
 try{if(existsSync(join(root,'nutrition/candlenut-label.pending.private.json')))throw Error('Interrupted candlenut label transaction requires reconciliation before maintenance');if(existsSync(join(root,'nutrition/applicability.pending.private.json')))throw Error('Interrupted applicability transaction requires reconciliation before maintenance');writeFileSync(fd,owner);}catch(e){closeSync(fd);rmSync(path);throw e;}
 return ()=>{closeSync(fd);if(readFileSync(path,'utf8')!==owner)throw Error('Export maintenance lock ownership changed; preserve for reconciliation');rmSync(path);};
}
