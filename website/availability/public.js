import { configured, blockedDates } from './api.js';
import { Calendar, today, horizon, pretty } from './calendar.js';
const form=document.querySelector('.booking-form');
const input=form?.querySelector('input[name="date"]');
if(form&&input&&configured){
  const parent=input.closest('label')||input.parentElement;
  const wrapper=document.createElement('div');wrapper.className='av-picker';
  const open=document.createElement('button');open.type='button';open.className='av-date-open';
  open.textContent='Choose event date';open.setAttribute('aria-expanded','false');open.setAttribute('aria-controls','av-customer-calendar');
  const panel=document.createElement('div');panel.id='av-customer-calendar';panel.hidden=true;
  const calendarRoot=document.createElement('div');
  const clear=document.createElement('button');clear.type='button';clear.className='av-clear';clear.textContent='Clear date';
  const message=document.createElement('p');message.className='av-validation';message.setAttribute('role','status');
  const wasRequired=input.required;input.required=false;input.type='hidden';
  input.insertAdjacentElement('afterend',wrapper);wrapper.append(open,panel,message);panel.append(calendarRoot,clear);
  // Replace the label wrapper before adding interactive calendar controls.
  if(parent.tagName==='LABEL'){
    const field=document.createElement('div');field.className=parent.className;
    while(parent.firstChild)field.append(parent.firstChild);parent.replaceWith(field);
  }
  open.setAttribute('aria-label','Event date: choose a date');
  const calendar=new Calendar(calendarRoot,{load:blockedDates,choose:(date)=>{
    input.value=date;open.textContent=pretty(date);open.setAttribute('aria-label','Event date: '+pretty(date));message.textContent='';
    panel.hidden=true;open.setAttribute('aria-expanded','false');open.focus();
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }});
  open.onclick=()=>{panel.hidden=!panel.hidden;open.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)calendar.refresh();};
  clear.onclick=()=>{input.value='';calendar.selected='';open.textContent='Choose event date';open.setAttribute('aria-label','Event date: choose a date');panel.hidden=true;open.setAttribute('aria-expanded','false');open.focus();};
  wrapper.addEventListener('keydown',event=>{if(event.key==='Escape'){panel.hidden=true;open.setAttribute('aria-expanded','false');open.focus();}});
  form.addEventListener('reset',()=>{calendar.selected='';open.textContent='Choose event date';open.setAttribute('aria-label','Event date: choose a date');panel.hidden=true;open.setAttribute('aria-expanded','false');message.textContent='';});
  const updateVisible=()=>{if(!panel.hidden&&!document.hidden)calendar.refresh();};
  window.addEventListener('focus',updateVisible);
  document.addEventListener('visibilitychange',updateVisible);
  setInterval(updateVisible,30000);
  let approved=null,checking=false;
  // Run before the existing form's capture handler. Recheck against the database immediately before submission.
  window.addEventListener('submit',async event=>{
    if(event.target!==form)return;
    if(approved!==null&&approved===input.value){approved=null;return;}
    event.preventDefault();event.stopImmediatePropagation();
    if(checking)return;
    const date=input.value;
    if(!date&&!wasRequired){approved='';form.requestSubmit(event.submitter||undefined);return;}
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<today()||date>horizon()){
      message.textContent='Please choose an available event date.';open.focus();return;
    }
    checking=true;message.textContent='Checking your date…';
    try{
      const blocked=await blockedDates(date,date);
      if(input.value!==date){message.textContent='Your date changed. Please send the enquiry again.';return;}
      if(blocked.has(date)){message.textContent='That date is now unavailable. Please choose another date.';open.focus();return;}
      message.textContent='';approved=date;form.requestSubmit(event.submitter||undefined);approved=null;
    }catch{message.textContent='We couldn’t check that date. Please try again or email infl8club@gmail.com.';}
    finally{checking=false;}
  },true);
}
