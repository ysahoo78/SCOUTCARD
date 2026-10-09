import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {safeUrl,profileSlug,initials,publicUrl,canonicalOrigin,checkoutUrl,withTimeout} from '../scoutcard-utils.js';
const root=resolve(import.meta.dirname,'..');
for(const value of ['javascript:alert(1)','data:text/html,test','https://user:password@example.com','ftp://example.com','httpx://example.com','']) assert.equal(safeUrl(value),'',value);
assert.equal(safeUrl('hudl.com/example'),'https://hudl.com/example');
assert.equal(safeUrl('https://youtu.be/film'),'https://youtu.be/film');
assert.equal(initials('   '),'SC');assert.equal(initials('  Jo   Smith  '),'JS');
const a=profileSlug('Same Name','00000000-1111-4222-8333-000000000001');
const b=profileSlug('Same Name','00000000-1111-4222-8333-000000000002');
assert.notEqual(a,b);assert.match(a,/^[a-z0-9-]{3,60}$/);
assert.match(profileSlug('山田太郎','00000000-1111-4222-8333-000000000001'),/^athlete-/);
assert.equal(canonicalOrigin,'https://www.scoutcard.tech');
assert.equal(publicUrl('test-athlete'),'https://www.scoutcard.tech/profile.html?athlete=test-athlete');
const url=new URL(checkoutUrl('https://buy.stripe.com/test','123','athlete+team@example.com'));
assert.equal(url.searchParams.get('prefilled_email'),'athlete+team@example.com');assert.equal(url.searchParams.get('client_reference_id'),'123');
await assert.rejects(withTimeout(new Promise(()=>{}),5),/timed out/);assert.equal(await withTimeout(Promise.resolve('done')),'done');
for(const file of await readdir(root)) if(file.endsWith('.js')) {const check=spawnSync(process.execPath,['--check',resolve(root,file)]);assert.equal(check.status,0,check.stderr.toString());}
for(const name of ['index.html','activate.html','profile.html','card.html']) {
 const html=await readFile(resolve(root,name),'utf8');const ids=Array.from(html.matchAll(/\bid="([^"]+)"/g),m=>m[1]);assert.equal(new Set(ids).size,ids.length,'Duplicate ids in '+name);
 for(const match of html.matchAll(/(?:src|href)="([^"#?]+\.(?:js|css))"/g)) if(!match[1].startsWith('http')) await access(resolve(root,match[1]));
}
console.log('Validation, URL safety, timeout handling, syntax, and linked asset checks passed.');
