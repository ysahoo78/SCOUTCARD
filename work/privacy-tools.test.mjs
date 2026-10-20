import test from 'node:test';
import assert from 'node:assert/strict';
import {profileExport} from '../privacy-tools.js';
test('exports saved profile fields and declared scope, without secrets or unrelated account fields',()=>{
 const result=profileExport({id:'child-id',display_name:'Alex',details:{bio:'<script>not HTML</script>'},child_age_band:'under13',parent_acknowledged_at:'2026-10-20',owner_id:'adult-private-id',email:'parent@example.test',activation_code:'PRIVATE',access_token:'TOKEN',refresh_token:'REFRESH',messages:[{}]},new Date('2026-10-20T12:00:00Z'));
 assert.equal(result.exported_at,'2026-10-20T12:00:00.000Z');assert.equal(result.profile.display_name,'Alex');assert.equal(result.profile.child_age_band,'under13');
 for(const field of ['owner_id','email','activation_code','access_token','refresh_token','messages'])assert.equal(Object.hasOwn(result.profile,field),false,field);
 assert.match(result.scope,/Selected saved profile only/);assert.match(result.scope,/not included/);
});
test('export is a deep snapshot, not mutable draft state',()=>{
 const profile={id:'child-id',details:{sport_metrics:{goals:'12'}}};const copy=profileExport(profile);
 profile.details.sport_metrics.goals='99';assert.equal(copy.profile.details.sport_metrics.goals,'12');
});
test('requires a selected saved profile',()=>{for(const value of [null,undefined,{},'test'])assert.throws(()=>profileExport(value),/Choose a saved profile/);});
