export function today() {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne', year:'numeric', month:'2-digit', day:'2-digit'
  }).formatToParts(new Date());
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export const iso = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const parse = value => new Date(...value.split('-').map((v,i) => Number(v) - (i === 1 ? 1 : 0)));
export const pretty = value => new Intl.DateTimeFormat('en-AU', {day:'numeric',month:'long',year:'numeric'}).format(parse(value));
export function horizon() { const d=parse(today()); d.setMonth(d.getMonth()+24); return iso(d); }
export class Calendar {
  constructor(root, { load, choose, admin = false }) {
    this.root=root; this.load=load; this.choose=choose; this.admin=admin;
    this.month=parse(today()); this.month.setDate(1); this.selected=''; this.generation=0;
    root.classList.add('av-calendar');
    root.innerHTML=`<div class="av-month-nav"><button type="button" class="av-prev" aria-label="Previous month">←</button><h3 class="av-month"></h3><button type="button" class="av-next" aria-label="Next month">→</button></div><div class="av-week" aria-hidden="true">${['M','T','W','T','F','S','S'].map(d=>`<span>${d}</span>`).join('')}</div><div class="av-days" aria-label="Choose a date"></div><p class="av-cal-status" role="status" aria-live="polite"></p><button type="button" class="av-retry" hidden>Try again</button>`;
    this.days=root.querySelector('.av-days'); this.status=root.querySelector('.av-cal-status');
    root.querySelector('.av-prev').onclick=()=>this.move(-1);
    root.querySelector('.av-next').onclick=()=>this.move(1);
    root.querySelector('.av-retry').onclick=()=>this.refresh();
  }
  move(delta) { this.month.setMonth(this.month.getMonth()+delta); this.refresh(); }
  async refresh() {
    const generation=++this.generation;
    this.root.querySelector('.av-month').textContent=new Intl.DateTimeFormat('en-AU',{month:'long',year:'numeric'}).format(this.month);
    const start=iso(this.month), last=new Date(this.month.getFullYear(),this.month.getMonth()+1,0), end=iso(last);
    this.root.querySelector('.av-prev').disabled=start.slice(0,7)<=today().slice(0,7);
    this.root.querySelector('.av-next').disabled=start.slice(0,7)>=horizon().slice(0,7);
    this.days.replaceChildren(); this.status.textContent='Checking dates…'; this.root.querySelector('.av-retry').hidden=true;
    try {
      const blocked=await this.load(start,end); if(generation!==this.generation)return;
      const offset=(this.month.getDay()+6)%7;
      for(let i=0;i<offset;i++)this.days.append(document.createElement('span'));
      for(let day=1;day<=last.getDate();day++){
        const date=iso(new Date(this.month.getFullYear(),this.month.getMonth(),day));
        const b=document.createElement('button'); b.type='button'; b.textContent=day;
        const unavailable=blocked.has(date);
        b.className='av-day'+(unavailable?' av-blocked':'')+(date===this.selected?' av-selected':'');
        b.dataset.date=date; b.disabled=date<today()||date>horizon()||(!this.admin&&unavailable);
        b.setAttribute('aria-label',pretty(date)+(unavailable?' — unavailable':' — available'));
        b.setAttribute('aria-pressed',String(date===this.selected));
        if(date===today())b.setAttribute('aria-current','date');
        b.onclick=()=>{this.selected=date;this.days.querySelectorAll('button').forEach(x=>{
          x.classList.toggle('av-selected',x===b);x.setAttribute('aria-pressed',String(x===b));
        });this.choose(date,unavailable);};
        this.days.append(b);
      }
      this.status.textContent=this.admin?'Tap a date to manage it.':'Crossed-out dates are unavailable. Dates use Melbourne time.';
      return true;
    } catch {
      if(generation!==this.generation)return;
      this.status.textContent='Unable to check availability. Please retry or email infl8club@gmail.com.';
      this.root.querySelector('.av-retry').hidden=false;
      return false;
    }
  }
}
