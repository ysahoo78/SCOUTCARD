// Export only the selected saved profile, never a browser session or secret.
const fields=['id','slug','display_name','sport','graduation_year','position','accolade','highlight_url','details','is_public','headshot_path','parent_managed','child_age_band','parent_acknowledged_at','parent_public_consent_at','parent_policy_version','created_at','updated_at'];
export function profileExport(profile,now=new Date()) {
 if(!profile||typeof profile!=='object'||!profile.id)throw Error('Choose a saved profile first.');
 const saved=Object.fromEntries(fields.filter(key=>Object.hasOwn(profile,key)).map(key=>[key,profile[key]]));
 return {format:'scoutcard-profile-v1',exported_at:now.toISOString(),scope:'Selected saved profile only. Unsaved edits, photo file bytes, inbox messages, card activation codes, adult account and order/payment records are not included. Contact scout.card26@gmail.com for a broader data request.',profile:JSON.parse(JSON.stringify(saved))};
}
export function downloadProfile(profile) {
 const payload=profileExport(profile),blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;
 link.download='scoutcard-profile-'+String(profile.id).replace(/[^a-z0-9-]/gi,'')+'.json';link.hidden=true;
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
