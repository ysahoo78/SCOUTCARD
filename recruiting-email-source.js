import {withTimeout} from './scoutcard-utils.js';

// Read only. Existing profile/draft RLS and the authenticated editor supply access.
// Never accept an athlete identifier from a URL or a free-form email-builder input.
export async function readRecruitingSnapshot({db, ownerId, profileId, parent, record, isCurrent = () => true}) {
  const valid = () => isCurrent() && record?.profile_id === profileId && record?.owner_id === ownerId
    && record?.parent_managed === parent;
  if (!ownerId || !profileId || !valid()) throw Error('Sign in and load your own saved athlete draft first.');
  if (parent && record.eligibility?.parent_ack !== true) throw Error('Confirm the guardian acknowledgment in Basics before using child information.');
  const session = await withTimeout(db.auth.getSession());
  if (session.error) throw session.error;
  if (session.data?.session?.user?.id !== ownerId || !valid()) throw Error('Your account or selected athlete changed. Reopen the email builder.');
  // Ownership is verified through the private draft table, not a public-profile
  // ownership column: those metadata columns are intentionally not API-readable.
  const draft = await withTimeout(db.from('athlete_profile_drafts').select('profile_id,owner_id,parent_managed,payload,eligibility,version')
    .eq('owner_id', ownerId).eq('profile_id', profileId).maybeSingle());
  if (draft.error) throw draft.error;
  if (!valid()) throw Error('Your account or selected athlete changed. Reopen the email builder.');
  if (draft.data?.profile_id !== profileId || draft.data?.owner_id !== ownerId || draft.data?.parent_managed !== parent) throw Error('This saved draft is not available to your account.');
  if (draft.data.version !== record.version) throw Error('The athlete draft changed on another device. Reload the saved profile, then reopen the email builder.');
  if (parent && draft.data.eligibility?.parent_ack !== true) throw Error('Confirm the guardian acknowledgment in Basics before using child information.');
  const result = await withTimeout(db.from('athlete_profiles').select('id,slug,is_public')
    .eq('id', profileId).maybeSingle());
  if (result.error) throw result.error;
  if (!valid()) throw Error('Your account or selected athlete changed. Reopen the email builder.');
  if (result.data && result.data.id !== profileId) throw Error('The selected profile could not be verified.');
  return {ownerId, profileId, parent, payload:structuredClone(draft.data.payload || {}), published:result.data || null};
}
