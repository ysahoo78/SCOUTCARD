import {checkPaidAccount, AccessError} from './_lib/paid-access.js';
// Account-scoped hint. The email-builder API independently rechecks payment.
const reply = (status,data) => Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Authorization'}});
export async function handlePurchaseStatus(request,env=process.env,fetchImpl=fetch){
  if(request.method!=='GET')return reply(405,{message:'Use GET.'});
  if(new URL(request.url).search)return reply(400,{message:'No query parameters accepted.'});
  try {
    const {purchased}=await checkPaidAccount(request,env,fetchImpl);
    return reply(200,{purchased});
  } catch(error) {
    if(error instanceof AccessError)return reply(error.status,{message:error.message});
    console.warn('SCOUTCARD purchase-status lookup unavailable');
    return reply(503,{message:'Purchase status unavailable.'});
  }
}
export default {fetch:request=>handlePurchaseStatus(request)};
