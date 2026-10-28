import {checkPaidAccount, AccessError} from './_lib/paid-access.js';
import {generateRecruitingEmail} from './_lib/recruiting-template.js';
import {readBoundedBody} from '../request-safety.js';

const reply = (status,data) => Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Authorization'}});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
function validate(input) {
  const limits={coach:80,program:120,recipient:254,why:650,context:500,purpose:20};
  if (!plain(input) || Object.keys(input).some(key=>!['profileId','version','options'].includes(key)) || !uuid.test(input.profileId || '') || !Number.isSafeInteger(input.version) || input.version < 1 || !plain(input.options)) throw new AccessError('Reload the saved athlete draft and try again.',400);
  const o=input.options;
  if (Object.keys(o).some(key=>!Object.hasOwn(limits,key)&&!['include','childConfirmed'].includes(key)) || Object.entries(limits).some(([key,max])=>o[key]!==undefined&&(typeof o[key]!=='string'||o[key].length>max)) || !Array.isArray(o.include) || o.include.length>25 || o.include.some(key=>typeof key!=='string'||key.length>60) || (o.childConfirmed!==undefined&&typeof o.childConfirmed!=='boolean')) throw new AccessError('Please check the email fields and selections.',400);
}
export async function handleRecruitingEmail(request,env=process.env,send=fetch) {
  if (request.method !== 'POST') return reply(405,{message:'Use POST.'});
  if (new URL(request.url).search) return reply(400,{message:'No query parameters accepted.'});
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return reply(415,{message:'Use JSON.'});
  try {
    const account=await checkPaidAccount(request,env,send);
    if (!account.purchased) return reply(403,{code:'payment_required',message:'The Recruiting Email Builder is included with a confirmed SCOUTCARD purchase. Already paid? Don’t pay again. Contact hello@scoutcard.tech to match a cash/Zelle payment or a purchase under another email.'});
    let input;
    try { input=JSON.parse(new TextDecoder().decode(await readBoundedBody(request,{maxBytes:8192,timeoutMs:5000}))); }
    catch(error) { if(error.status)throw error; throw new AccessError('Please check the email request.',400); }
    validate(input);
    const {user,origin,key,authorization,signal}=account;
    // Keep the user's bearer token for these reads: existing owner-only RLS still applies.
    const read=async(table,params)=>{
      const url=new URL('/rest/v1/'+table,origin);
      for(const [name,value] of Object.entries({...params,limit:'1'}))url.searchParams.set(name,value);
      const response=await send(url,{headers:{apikey:key,Authorization:authorization},cache:'no-store',signal});
      if(!response.ok)throw Error('Profile lookup');
      const rows=await response.json();
      if(!Array.isArray(rows)||rows.length>1)throw Error('Profile response');
      return rows[0] || null;
    };
    const draft=await read('athlete_profile_drafts',{select:'profile_id,owner_id,parent_managed,payload,eligibility,version',owner_id:'eq.'+user.id,profile_id:'eq.'+input.profileId});
    if(!draft || draft.owner_id!==user.id || draft.profile_id!==input.profileId || typeof draft.parent_managed!=='boolean' || (!draft.parent_managed&&draft.profile_id!==user.id) || (draft.parent_managed&&draft.profile_id===user.id))throw new AccessError('This saved athlete draft is not available to your account.',403);
    if(draft.version!==input.version)throw new AccessError('This draft changed on another device. Reload the saved draft before generating.',409);
    const eligibility=draft.eligibility || {};
    if(draft.parent_managed ? eligibility.band!=='adult'||eligibility.parent_ack!==true : !['adult','teen'].includes(eligibility.band)||(eligibility.band==='teen'&&eligibility.permission!==true))throw new AccessError('Check the age and parent/guardian permissions in Basics first.',403);
    const published=await read('athlete_profiles',{select:'id,slug,is_public',id:'eq.'+input.profileId});
    if(published && published.id!==input.profileId)throw Error('Profile identity');
    let generated;
    try {generated=generateRecruitingEmail({ownerId:user.id,profileId:input.profileId,parent:draft.parent_managed,payload:draft.payload || {},published},input.options);}
    catch(error){throw new AccessError(error.message,400);}
    return reply(200,generated);
  } catch(error) {
    if(error instanceof AccessError || [408,413].includes(error.status))return reply(error.status,{message:error.message});
    // Never log recipient details, form contents, tokens or customer records.
    console.warn('SCOUTCARD recruiting-email request unavailable');
    return reply(503,{message:'Could not verify payment or load the saved profile. Your email edits have not been replaced. Please retry.'});
  }
}
export default {fetch:request=>handleRecruitingEmail(request)};
