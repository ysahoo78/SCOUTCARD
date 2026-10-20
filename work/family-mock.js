// Local, synthetic browser fixtures only; never imported by production pages.
window.familyRpc=(name,args,state,result)=>{
 const persist=()=>sessionStorage.setItem('qa-family',JSON.stringify(state.family));
 const fail=message=>result(null,{message});
 if(name==='list_parent_athletes')return state.failFamily?fail('Family list unavailable'):result(structuredClone(state.family));
 if(name==='save_parent_athlete'){
  if(state.failSave)return fail('Save rejected');
  const previous=state.family.find(p=>p.id===args.profile_id),data=args.profile_data;
  if(!args.adult_ack)return fail('Adult parent required');
  if(data.is_public&&!args.sharing_ack)return fail('Approve public sharing');
  if(previous&&!data.expected_updated_at)return result(structuredClone(previous));
  const saved={...previous,...data,id:args.profile_id,parent_managed:true,slug:previous?.slug||'athlete-'+args.profile_id.replaceAll('-',''),updated_at:new Date(Date.now()+state.calls.length).toISOString(),parent_acknowledged_at:new Date().toISOString()};
  const index=state.family.findIndex(p=>p.id===saved.id);if(index<0)state.family.push(saved);else state.family[index]=saved;persist();return result(structuredClone(saved));
 }
 if(name==='unpublish_parent_athlete'){
  if(state.failUnpublish)return fail('Unpublish unavailable');
  const child=state.family.find(p=>p.id===args.athlete_id);if(!child)return fail('Profile not managed');child.is_public=false;child.parent_public_consent_at=null;child.updated_at=new Date().toISOString();persist();return result(structuredClone(child));
 }
 if(name==='activate_parent_card'){
  if(args.card_code!=='VALID-FAMILY-CARD')return result(false);
  const card=state.cards.find(c=>c.activation_code===args.card_code);
  if(card)return result(card.profile_id===args.athlete_id);
  state.cards.push({id:crypto.randomUUID(),profile_id:args.athlete_id,activation_code:args.card_code,public_token:crypto.randomUUID(),activated_at:new Date().toISOString()});return result(true);
 }
 if(name==='delete_parent_athlete'){
  state.family=state.family.filter(p=>p.id!==args.athlete_id);state.messages=state.messages.filter(p=>p.profile_id!==args.athlete_id);state.cards=state.cards.filter(p=>p.profile_id!==args.athlete_id);persist();return result(true);
 }
 return result(null);
};
if(new URLSearchParams(location.search).has('qa-family-public'))window.testState.profile=window.testState.family.find(p=>p.is_public)||null;
