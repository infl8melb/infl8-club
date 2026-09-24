import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');
const cookieName = '__Host-infl8staff';
const lifetime = 8 * 60 * 60;
export function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
function verifyPassword(password, encoded) {
  const [salt, digest] = encoded.split(':');
  if (!/^[a-f0-9]{32}$/.test(salt||'') || !/^[a-f0-9]{128}$/.test(digest||'')) return false;
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(digest, 'hex'));
}
function cookie(token='', maxAge=0) {
  return `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}
function sessionToken(request) {
  const value = request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  return /^[\w-]{43}$/.test(value||'') ? value : null;
}
export function validDate(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===value;
}
function melbourneToday(){
  const p=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get=t=>p.find(x=>x.type===t).value;return `${get('year')}-${get('month')}-${get('day')}`;
}
const reply=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export function createService({ dates, sessions, credential, staffId='infl8boss' }) {
  const credentialTag=hash(credential||'');
  async function session(request){
    const token=sessionToken(request);if(!token)return null;
    const key=hash(token),record=await sessions.get(key,{type:'json'});
    if(!record)return null;
    if(record.expires<Date.now()||record.credentialTag!==credentialTag){await sessions.delete(key);return null;}
    return {key,...record};
  }
  async function body(request){
    if(!request.headers.get('content-type')?.startsWith('application/json'))throw new Error('body');
    const text=await request.text();if(text.length>2048)throw new Error('body');try{return JSON.parse(text);}catch{throw new Error('body');}
  }
  async function updateDate(date,blocked){
    for(let i=0;i<6;i++){
      const old=await dates.getWithMetadata('blocked',{type:'json'});
      const next=new Set(old?.data||[]);
      blocked?next.add(date):next.delete(date);
      // Retain future dates only; apply compare-and-swap to avoid losing simultaneous edits.
      const result=await dates.setJSON('blocked',[...next].filter(d=>d>=melbourneToday()).sort(),old?{onlyIfMatch:old.etag}:{onlyIfNew:true});
      if(result.modified)return;
    }
    throw new Error('conflict');
  }
  return async function handle(action,request){
    if(!credential||!/^\w{32}:[a-f0-9]{128}$/.test(credential))return reply({error:'Staff calendar setup is not complete.'},503);
    const methods={login:'POST',logout:'POST',session:'GET',dates:'GET',save:'POST'};
    if(request.method!==methods[action])return reply({error:'Method not allowed.'},405,{Allow:methods[action]||'GET'});
    if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Request origin not allowed.'},403);
    try{
      if(action==='login'){
        const input=await body(request);
        if(typeof input.password!=='string'||input.password.length>256||typeof input.staffId!=='string'||input.staffId.length>100)return reply({error:'Staff ID or password not recognised.'},401);
        const passwordOK=verifyPassword(input.password,credential);
        if(input.staffId.trim().toLowerCase()!==staffId.toLowerCase()||!passwordOK)return reply({error:'Staff ID or password not recognised.'},401);
        const previous=await session(request);if(previous)await sessions.delete(previous.key);
        const token=randomBytes(32).toString('base64url');
        await sessions.setJSON(hash(token),{expires:Date.now()+lifetime*1000,credentialTag});
        return reply({ok:true},200,{'Set-Cookie':cookie(token,lifetime)});
      }
      if(action==='logout'){
        const token=sessionToken(request);if(token)await sessions.delete(hash(token));
        return reply({ok:true},200,{'Set-Cookie':cookie()});
      }
      if(action==='session')return await session(request)?reply({ok:true}):reply({error:'Please log in.'},401);
      if(action==='dates'){
        const url=new URL(request.url),start=url.searchParams.get('start'),end=url.searchParams.get('end');
        if(!validDate(start)||!validDate(end)||start>end||new Date(end)-new Date(start)>95*86400000)return reply({error:'Invalid date range.'},400);
        const all=await dates.get('blocked',{type:'json'})||[];
        return reply({dates:all.filter(d=>d>=start&&d<=end)});
      }
      if(action==='save'){
        if(!await session(request))return reply({error:'Please log in again.'},401);
        const input=await body(request);const today=melbourneToday();
        if(!validDate(input.date)||input.date<today||new Date(input.date)-new Date(today)>735*86400000||typeof input.blocked!=='boolean')return reply({error:'Choose a valid future date.'},400);
        await updateDate(input.date,input.blocked);
        return reply({ok:true});
      }
      return reply({error:'Not found.'},404);
    }catch(e){return reply({error:e.message==='body'?'Invalid request.':e.message==='conflict'?'Another change was saved. Refresh and try again.':'Could not save or load dates. Please try again.'},e.message==='body'?400:e.message==='conflict'?409:503);}
  };
}
