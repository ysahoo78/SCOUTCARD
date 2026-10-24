// Browser-only synthetic transport. Not deployed or imported by production.
const originalClient=createClient;
createClient=function(){
 const client=originalClient(),legacyRpc=client.rpc,legacyFrom=client.from;
 const key='qa-onboarding-db';
 const read=()=>JSON.parse(localStorage.getItem(key)||'{"drafts":[],"profiles":[]}');
 const write=data=>localStorage.setItem(key,JSON.stringify(data));
 const stored=read();state.profile=stored.profiles.find(p=>!p.parent_managed)||state.profile;state.family=stored.profiles.filter(p=>p.parent_managed);
 client.from=table=>table!=='athlete_profile_drafts'?legacyFrom(table):new class{
  constructor(){this.filters=[];this.max=10;}select(){return this;}eq(k,v){this.filters.push([k,v]);return this;}order(){return this;}limit(n){this.max=n;return this;}
  then(resolve,reject){return Promise.resolve().then(()=>result(read().drafts.filter(d=>state.signedIn&&d.owner_id===user.id&&this.filters.every(([k,v])=>d[k]===v)).slice(0,this.max))).then(resolve,reject);}
 }();
 client.rpc=async(name,args)=>{
  if(!['save_scoutcard_draft','publish_scoutcard_draft','unpublish_scoutcard_profile','delete_scoutcard_draft'].includes(name))return legacyRpc(name,args);
  state.calls.push([name,structuredClone(args)]);
  if(!state.signedIn)return result(null,{message:'Sign in first'});
  if(state.slowSave)await new Promise(r=>setTimeout(r,250));
  const data=read();let draft=data.drafts.find(d=>d.profile_id===args.athlete_id),profile=data.profiles.find(p=>p.id===args.athlete_id)||state.profile?.id===args.athlete_id&&state.profile;
  if(name==='save_scoutcard_draft'){
   if(state.failSave)return result(null,{message:'Save rejected. Retry your connection.'});
   if(draft&&args.expected_version==null)return result(structuredClone(draft));
   if(!draft){draft={profile_id:args.athlete_id,owner_id:user.id,parent_managed:args.managed,payload:profile?structuredClone(profile):{},step:0,version:1,last_request_id:args.operation_id,eligibility:{...args.eligibility,parent_ack:!!profile?.parent_acknowledged_at},updated_at:new Date().toISOString()};data.drafts.push(draft);write(data);return result(draft);}
   if(draft.last_request_id===args.operation_id)return result(draft);
   if(draft.version!==args.expected_version)return result(null,{message:'This draft changed on another device.',code:'40001'});
   if(args.managed&&!args.eligibility.parent_ack)return result(null,{message:'Acknowledge parent permission in Basics.'});
   Object.assign(draft,{payload:args.draft_data,step:args.draft_step,eligibility:args.eligibility,version:draft.version+1,last_request_id:args.operation_id,updated_at:new Date().toISOString()});write(data);
   if(state.failAfterAck){state.failAfterAck=false;return result(null,{message:'Request timed out after saving'});}
   return result(structuredClone(draft));
  }
  if(name==='publish_scoutcard_draft'){
   if(state.failPublish)return result(null,{message:'Publication unavailable'});
   if(!draft||draft.version!==args.expected_version||!args.sharing_ack)return result(null,{message:'Review draft and sharing permission.'});
   if(!draft.payload.display_name||!draft.payload.sport)return result(null,{message:'Name and sport required'});
   profile={...profile,...draft.payload,id:draft.profile_id,parent_managed:draft.parent_managed,slug:profile?.slug||'athlete-'+draft.profile_id.replaceAll('-',''),is_public:true,updated_at:new Date().toISOString(),parent_acknowledged_at:draft.parent_managed?new Date().toISOString():null};
   data.profiles=data.profiles.filter(p=>p.id!==profile.id).concat(profile);draft.published_version=draft.version;write(data);
   if(profile.parent_managed)state.family=data.profiles.filter(p=>p.parent_managed);else{state.profile=profile;sessionStorage.setItem('qa-profile',JSON.stringify(profile));}
   return result({profile:structuredClone(profile),draft:structuredClone(draft)});
  }
  if(name==='unpublish_scoutcard_profile'){profile.is_public=false;write(data);return result({profile,draft});}
  if(name==='delete_scoutcard_draft'){data.drafts=data.drafts.filter(d=>d.profile_id!==args.athlete_id);write(data);return result(true);}
 };
 return client;
};
