import { getStore } from '@netlify/blobs';
import { createService } from './service.mjs';
export function handle(action,request){
  return createService({
    dates:getStore({name:'infl8-calendar',consistency:'strong'}),
    sessions:getStore({name:'infl8-staff-sessions',consistency:'strong'}),
    credential:process.env.STAFF_PASSWORD_HASH,
    staffId:process.env.STAFF_ID||'infl8boss'
  })(action,request);
}
