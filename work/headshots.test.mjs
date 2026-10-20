import test from 'node:test';
import assert from 'node:assert/strict';
import { HeadshotDraft, validHeadshotPath, validatePhotoFile, signedHeadshotUrl } from '../headshots.js';
const owner = '00000000-1111-4222-8333-000000000001';
const other = '00000000-1111-4222-8333-000000000002';
const photo = owner + '/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg';
function fixture() {
 const calls = [];
 const db = { storage: { from(bucket) { assert.equal(bucket,'athlete-headshots'); return {
  async upload(path, blob, options) { calls.push({path,blob,options}); return {error:null}; },
  async createSignedUrl(path, ttl) { calls.push({path,ttl}); return {data:{signedUrl:'https://example.com/photo.jpg'}}; }
 }; } } };
 return {db,calls};
}
function draft() { const d = new HeadshotDraft(); d.version++; d.pending = Promise.resolve(new Blob(['jpeg'],{type:'image/jpeg'})); return d; }
test('headshot path accepts only owned UUID image format', () => {
 assert.ok(validHeadshotPath(photo)); for(const v of ['',null,'../private.jpg',owner+'/photo.svg','https://example.com/a.jpg']) assert.equal(validHeadshotPath(v),false);
});
test('input restricts MIME types and size', () => {
 for(const type of ['image/jpeg','image/png','image/webp']) assert.doesNotThrow(()=>validatePhotoFile({type,size:100}));
 for(const f of [{type:'image/svg+xml',size:100},{type:'image/heic',size:100},{type:'image/jpeg',size:0},{type:'image/jpeg',size:6*1024*1024}]) assert.throws(()=>validatePhotoFile(f));
});
test('unchanged initials do not upload or overwrite a saved path', async () => {
 const d=new HeadshotDraft(),{db,calls}=fixture(); d.savedPath=photo;
 assert.deepEqual(await d.prepare(db,owner),{version:0,changed:false,path:photo,previousPath:photo}); assert.equal(calls.length,0);
});
test('upload uses compressed immutable JPEG; failed profile save can retry same object', async () => {
 const d=draft(),{db,calls}=fixture(); const first=await d.prepare(db,owner), second=await d.prepare(db,owner);
 assert.equal(first.path,second.path); assert.equal(calls.length,1); assert.ok(first.path.startsWith(owner+'/'));
 assert.deepEqual(calls[0].options,{contentType:'image/jpeg',cacheControl:'60',upsert:false});
 d.accept(second); assert.equal(d.changed,false); assert.equal(d.savedPath,first.path);
});
test('storage errors preserve draft and retry path', async () => {
 const d=draft(),{db,calls}=fixture(); const good=db.storage.from.bind(db.storage); let attempts=0;
 db.storage.from=(bucket)=>({...good(bucket),async upload(path){calls.push({path}); attempts++; return {error:attempts===1?{message:'Network error'}:null};}});
 await assert.rejects(d.prepare(db,owner)); const retried=await d.prepare(db,owner);
 assert.equal(calls[0].path,retried.path); assert.equal(attempts,2);
});
test('timed-out successful upload duplicate is reusable, but access failure is not', async () => {
 const d=draft(),{db}=fixture(); db.storage.from=()=>({async upload(){return {error:{statusCode:409}};}});
 assert.ok((await d.prepare(db,owner)).path);
 const e=draft(); db.storage.from=()=>({async upload(){return {error:{statusCode:403}};}});
 await assert.rejects(e.prepare(db,owner));
});
test('new edits during save remain unsaved after previous upload succeeds', async () => {
 const d=draft(),{db}=fixture(); const first=await d.prepare(db,owner); d.remove(); d.accept(first);
 assert.equal(d.changed,true); assert.equal(d.savedPath,first.path);
 const removed=await d.prepare(db,owner); assert.equal(removed.path,null); assert.equal(removed.previousPath,first.path);
 d.accept(removed); assert.equal(d.changed,false); assert.equal(d.savedPath,null);
});
test('signout reset clears all private draft state', async () => {
 const d=draft(),{db}=fixture(); await d.prepare(db,owner); d.savedPath=photo; d.reset();
 assert.equal(d.savedPath,null); assert.equal(d.savedUrl,''); assert.equal(d.pending,undefined); assert.equal(d.uploaded,null);
});
test('upload cache cannot cross account boundaries', async () => {
 const d=draft(),{db,calls}=fixture(); await d.prepare(db,owner); const next=await d.prepare(db,other);
 assert.ok(next.path.startsWith(other+'/')); assert.equal(calls.length,2);
});
test('signed URLs validate paths, expire in 5 minutes and reject unsafe responses', async () => {
 const {db,calls}=fixture(); assert.equal(await signedHeadshotUrl(db,'../x'),''); assert.equal(calls.length,0);
 assert.equal(await signedHeadshotUrl(db,photo),'https://example.com/photo.jpg'); assert.equal(calls[0].ttl,300);
 db.storage.from=()=>({async createSignedUrl(){return {data:{signedUrl:'javascript:alert(1)'}};}});
 await assert.rejects(signedHeadshotUrl(db,photo));
});
