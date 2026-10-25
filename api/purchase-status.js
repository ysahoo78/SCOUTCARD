// Read-only, account-scoped hint. Never accepts an email/order ID from the browser.
const reply=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Authorization'}});
export async function handlePurchaseStatus(request,env=process.env,fetchImpl=fetch){
 if(request.method!=='GET')return reply(405,{message:'Use GET.'});
 const authorization=request.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(authorization))return reply(401,{message:'Sign in first.'});
 if(new URL(request.url).search)return reply(400,{message:'No query parameters accepted.'});
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)return reply(503,{message:'Purchase status unavailable.'});
 try{
  const origin=new URL(env.SUPABASE_URL);if(origin.protocol!=='https:')throw Error('Configuration');
  const signal=AbortSignal.timeout(8000),key=env.SUPABASE_SERVICE_ROLE_KEY;
  // Validate the access token with Auth, not client storage or decoded JWT claims.
  const auth=await fetchImpl(new URL('/auth/v1/user',origin),{headers:{apikey:key,Authorization:authorization},cache:'no-store',signal});
  if(!auth.ok)return reply(auth.status===401||auth.status===403?401:503,{message:'Purchase status unavailable.'});
  const user=await auth.json();
  if(!user.id||!user.email_confirmed_at||typeof user.email!=='string'||user.is_anonymous)return reply(401,{message:'A confirmed email account is required.'});
  const email=user.email.trim().toLowerCase();
  if(email.length>254||!/^[^\s@,()"\\]+@[^\s@,()"\\]+\.[^\s@,()"\\]+$/.test(email))return reply(503,{message:'Purchase status unavailable.'});
  const url=new URL('/rest/v1/card_orders',origin);
  url.searchParams.set('select','id');url.searchParams.set('email','eq.'+email);
  url.searchParams.set('status','in.(paid,shipped,fulfilled)');url.searchParams.set('paid_at','not.is.null');url.searchParams.set('limit','1');
  const orders=await fetchImpl(url,{headers:{apikey:key,Authorization:'Bearer '+key},cache:'no-store',signal});
  if(!orders.ok)throw Error('Order lookup');
  const rows=await orders.json();if(!Array.isArray(rows)||rows.length>1||rows.some(row=>!row||typeof row.id!=='string'))throw Error('Order response');
  return reply(200,{purchased:rows.length>0});
 }catch{
  // Never log tokens, email, addresses or order payloads.
  console.warn('SCOUTCARD purchase-status lookup unavailable');
  return reply(503,{message:'Purchase status unavailable.'});
 }
}
export default {fetch:request=>handlePurchaseStatus(request)};
