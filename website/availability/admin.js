import { configured, hasSession, login, logout, requireAdmin, blockedDates, setBlocked } from './api.js';
import { Calendar, pretty } from './calendar.js';
const $=id=>document.getElementById(id);
let selected='',busy=false;
const calendar=new Calendar($('calendar'),{load:blockedDates,admin:true,choose:(date,blocked)=>{
  if(busy)return;selected=date;renderSelection(blocked);$('feedback').textContent='';
}});
function renderSelection(blocked){
  $('selection').hidden=!selected;
  if(!selected)return;
  $('chosen-date').textContent=pretty(selected);
  $('chosen-state').textContent=blocked?'Currently unavailable':'Currently available';
  $('block').disabled=blocked||busy;$('reopen').disabled=!blocked||busy;
}
async function refresh(){
  if(!await calendar.refresh())throw new Error('Could not refresh dates. Please try again.');
  if(selected){const dates=await blockedDates(selected,selected);renderSelection(dates.has(selected));}
}
async function showManager(){
  await requireAdmin();$('login').hidden=true;$('manager').hidden=false;
  $('feedback').textContent='';await refresh();
}
$('login').onsubmit=async event=>{
  event.preventDefault();const button=event.submitter;button.disabled=true;$('feedback').textContent='Signing in…';
  try{
    await login($('login').elements.staffId.value,$('login').elements.password.value);$('login').reset();await showManager();
  }
  catch(e){$('feedback').textContent=e.message;}
  finally{button.disabled=false;}
};
$('logout').onclick=async()=>{if(busy)return;try{await logout();}catch(e){$('feedback').textContent='Could not log out. Please retry.';return;}$('manager').hidden=true;$('login').hidden=false;selected='';$('selection').hidden=true;$('feedback').textContent='You are logged out.';};
$('refresh').onclick=async()=>{try{await refresh();$('feedback').textContent='Dates refreshed.';}catch(e){$('feedback').textContent=e.message;}};
async function save(blocked){
  if(!selected||busy)return;const date=selected;busy=true;
  $('block').disabled=true;$('reopen').disabled=true;$('logout').disabled=true;$('refresh').disabled=true;
  $('calendar').inert=true;$('feedback').textContent='Saving…';
  try{
    await setBlocked(date,blocked);await refresh();
    $('feedback').textContent=pretty(date)+(blocked?' is now blocked.':' is now available.');
  }catch(e){$('feedback').textContent=e.message+' No change has been confirmed.';}
  finally{
    busy=false;$('calendar').inert=false;$('logout').disabled=false;$('refresh').disabled=false;
    try{const dates=await blockedDates(date,date);renderSelection(dates.has(date));}catch{}
  }
}
$('block').onclick=()=>save(true);$('reopen').onclick=()=>save(false);
if(!configured){$('login').hidden=true;$('feedback').textContent='One-time setup is needed. Follow START-HERE.html in the downloaded package before using this page.';}
else if(hasSession())showManager().catch(e=>{$('login').hidden=false;$('manager').hidden=true;$('feedback').textContent=e.status===401?'':e.message;});
