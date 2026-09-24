export const configured=true;
// Sessions are server-side, using secure HttpOnly cookies. No credentials in frontend files.
export const hasSession=()=>true;
async function request(action,data){
  const response=await fetch('/.netlify/functions/staff-'+action,{
    method:data===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',
    signal:AbortSignal.timeout(15000),
    headers:data===undefined?{}:{'Content-Type':'application/json'},
    ...(data===undefined?{}:{body:JSON.stringify(data)})
  });
  let value;try{value=await response.json();}catch{}
  if(!response.ok){const e=new Error(response.status===429?'Too many attempts. Please wait a minute and try again.':value?.error||'Could not connect. Please try again.');e.status=response.status;throw e;}
  if(!value)throw new Error('The calendar service is not available.');return value;
}
export const login=(staffId,password)=>request('login',{staffId,password});
export const logout=()=>request('logout',{});
export const requireAdmin=()=>request('session');
export async function blockedDates(start,end){
  const data=await request('dates?start='+encodeURIComponent(start)+'&end='+encodeURIComponent(end));
  return new Set(data.dates);
}
export async function setBlocked(date,blocked){
  await request('save',{date,blocked});
  const result=await blockedDates(date,date);
  if(result.has(date)!==blocked)throw new Error('Another update changed this date. Refresh and try again.');
}
