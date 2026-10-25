import {withTimeout} from './scoutcard-utils.js';
// One bounded read per authenticated page visit, no tracking or persistent cache.
// False/unknown does NOT prove that a customer has never paid (cash/different email).
export async function readPurchaseStatus(db,user,fetchImpl=fetch){
 try{
  const {data,error}=await withTimeout(db.auth.getSession());
  if(error||data?.session?.user?.id!==user.id||!data.session.access_token)return null;
  const response=await fetchImpl('/api/purchase-status',{headers:{Authorization:'Bearer '+data.session.access_token},cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000)});
  if(!response.ok)return null;
  const result=await response.json();return typeof result.purchased==='boolean'?result.purchased:null;
 }catch{return null;}
}
