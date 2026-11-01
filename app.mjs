import {cityScene,bankBuilding} from './city.mjs';
import {officeScene} from './office.mjs';
import {names,create,next,bar,signals,openPNL,halt,review} from './engine.mjs';
const $=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
let s=create(),selected=0,timer;
try{const saved=JSON.parse(localStorage.scalpingStateV1||'null');if(saved){s=saved;if(s.active)s.active=s.trades.at(-1);}}catch{}
const time=i=>new Date(Date.UTC(2026,0,1,9,30,i*15)).toISOString().slice(11,19);
const roles = [
 'סורק את המחיר והנפח בכל 15 שניות ומעביר נתונים לחוקרים.',
 'בודק המשך תנועה קצרה על פני ארבעה צעדים, כלומר דקה.',
 'בודק פריצה של טווח שתי הדקות האחרונות עם עלייה בנפח.',
 'בודק התאוששות אחרי ירידה מתחת לממוצע שתי הדקות האחרונות.',
 'בודק חשיפה מצטברת, מספר חוזים וסף הפסד לפני כל כניסה.',
 'מדמה ביצוע חלקי, עמלות, החלקה ויציאה מהירה מהעסקה.'
];
function map(){
 $('officeRoom').innerHTML=officeScene($('agentDetails').hidden?-1:selected,s.active?.agent,Boolean(timer));
 $('role').textContent=roles[selected];
 $('officeActivity').textContent=s.stopped?'● המשרד עצור':s.i>=77?'● התרגול הסתיים':timer?'● הסריקה פועלת':s.active?.status==='אישור'?'● ממתינים לאישור':'● ממתינים להפעלה';
 $('bankSummary').innerHTML='<span>חשיפה נומינלית פתוחה</span><strong>'+fmt(s.qty*bar(s.i,s.day).price*2)+'</strong><span>מתוך תקרה של '+fmt(s.budget)+'</span><p>'+s.qty+' חוזים פתוחים · רווח ממומש '+fmt(s.cash)+'</p>';
}
function route(){
 const inside=location.hash==='#office';
 const bank=location.hash==='#bank';
 $('cityView').hidden=inside||bank;
 $('officeView').hidden=!inside;
 $('bankView').hidden=!bank;
 if(!inside)pause();
 map();
 window.scrollTo(0,0);
}
$('city').innerHTML=cityScene();
$('bankArt').innerHTML='<defs><linearGradient id="bankDome" x2="0" y2="1"><stop stop-color="#79eaf8" stop-opacity=".75"/><stop offset="1" stop-color="#172e4c"/></linearGradient><linearGradient id="bankGlass" x2="1" y2="1"><stop stop-color="#1d607c"/><stop offset="1" stop-color="#07192e"/></linearGradient></defs>'+bankBuilding(200,245).replaceAll('url(#dome)','url(#bankDome)').replaceAll('url(#cityGlass)','url(#bankGlass)');
$('city').onclick=e=>{const destination=e.target.closest('[data-place]');if(destination)location.hash=destination.dataset.place;};
$('city').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){const destination=e.target.closest('[data-place]');if(destination){e.preventDefault();location.hash=destination.dataset.place;}}};
window.addEventListener('hashchange',route);
function show(html){pause();map();$('dialogBody').innerHTML=html;$('dialog').showModal();}
function pause(){clearInterval(timer);timer=null;$('run').textContent='▶ הפעלה';}
function paint(){
 const b=bar(s.i,s.day),prev=bar(s.i-1,s.day),flags=signals(s);
 $('clock').textContent='שעון הדמיה '+time(s.i)+' ET';
 $('metrics').innerHTML=[['מחיר MNQ',b.price.toFixed(2)],['רווח ממומש אחרי עמלות',fmt(s.cash)],['רווח פתוח',fmt(openPNL(s))],['חוזים פתוחים',s.qty]].map(([k,v])=>'<div>'+k+'<strong dir="ltr">'+v+'</strong></div>').join('');
 $('agent').textContent=names[selected];const prices=Array.from({length:9},(_,j)=>bar(s.i-8+j,s.day).price),prior=prices.slice(0,-1);
 const reasons=['שינוי מחיר '+(b.price-prev.price).toFixed(2)+' נקודות • שינוי נפח '+(b.volume-prev.volume),'שינוי בדקה '+(b.price-prices[4]).toFixed(2)+' נקודות','שיא שמונת הנרות '+Math.max(...prior)+' • נפח נוכחי '+b.volume+' מול '+prev.volume,'ממוצע שתי דקות '+(prior.reduce((a,v)=>a+v,0)/8).toFixed(2)+' • מחיר קודם '+prev.price,'חשיפה פתוחה '+fmt(s.qty*b.price*2)+' מתוך '+fmt(s.budget),'מצב ההוראה האחרונה • '+(s.trades.at(-1)?.status||'אין הוראות')];
 $('insight').textContent=reasons[selected];let series=Array.from({length:24},(_,j)=>bar(Math.max(0,s.i-23+j),s.day).price),min=Math.min(...series),max=Math.max(...series);
 $('chart').innerHTML='<path fill="none" stroke="#93dfc4" stroke-width="2.5" d="'+series.map((p,i)=>(i?'L':'M')+(5+i*11.7)+' '+(74-63*(p-min)/(max-min||1))).join(' ')+'"/>';
 $('info').innerHTML='<p>סוכן סקאלפינג מבוסס כללים · גרסה 1</p><p>'+(['סריקת MNQ',...flags.map(f=>f?'אות קנייה':'ממתין לתנאי כניסה'),'בדיקת מגבלות משותפות','מעקב ביצועים'][selected])+'</p>'+(selected>0&&selected<4?'תוצאה מעסקאות סגורות '+fmt(s.trades.filter(t=>t.agent===selected&&t.status==='נסגרה').reduce((n,t)=>n+t.net,0)):'')+'<p>תרגול '+s.day+' · נתונים סינתטיים<br>צעדי 15 שניות · יעד 4 נקודות · עצירה 3 נקודות · עד 45 שניות מהביצוע הראשון.<br>עמלה מדומה $1 לחוזה לכל צד והחלקה של טיק אחד.</p>';
 $('log').innerHTML=s.trades.length?s.trades.map((t,i)=>'<button class="entry" data-t="'+i+'">'+time(t.events[0].i)+'　'+names[t.agent]+'　·　'+t.status+'</button>').reverse().join(''):'<p>העיר ממתינה לנר הבא. לחצו על הפעלה כדי להתחיל בסריקה.</p>';
 $('approve').disabled=s.active?.status!=='אישור'||s.stopped;$('run').disabled=$('step').disabled=s.stopped||s.i>=77;
 if(s.stopped||s.i>=77){pause();$('msg').textContent=(s.stopped?'המערכת עצורה':'יום ההדמיה הסתיים')+' • חוזים פתוחים '+s.qty;}
 map();localStorage.scalpingStateV1=JSON.stringify(s);
}
function tick(){next(s);if(s.mode==='manual'&&s.active?.status==='אישור')pause();paint();}
$('officeRoom').onclick=e=>{const station=e.target.closest('[data-a]');if(station){selected=Number(station.dataset.a);$('agentDetails').hidden=false;$('roomLayout').classList.add('has-selection');paint();$('officeRoom').querySelector('[data-a="'+selected+'"]').focus();}};
$('officeRoom').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}};
$('closeAgent').onclick=()=>{$('agentDetails').hidden=true;$('roomLayout').classList.remove('has-selection');map();$('officeRoom').querySelector('[data-a="'+selected+'"]').focus();};
$('run').onclick=()=>{if(timer){pause();paint();return;}timer=setInterval(tick,800);$('run').textContent='Ⅱ השהיה';tick();};$('step').onclick=tick;$('approve').onclick=()=>{next(s,true);paint();};$('stop').onclick=()=>{halt(s);paint();};
$('log').onclick=e=>{if(!e.target.dataset.t)return;const t=s.trades[+e.target.dataset.t];show('<h2 id="dialogTitle">סיפור העסקה</h2><p>'+names[t.agent]+'</p>'+t.events.map(v=>'<p>'+time(v.i)+'　'+v.label+'</p>').join(''));};
function settings(){for(const k of ['mode','budget','max','loss'])$(k).value=s[k];}
$('save').onclick=()=>{const vals=['budget','max','loss'].map(k=>Number($(k).value));if(vals.some(v=>!Number.isFinite(v)||v<=0)||!Number.isInteger(vals[1])||vals[1]<s.qty||vals[0]<s.qty*bar(s.i,s.day).price*2)return $('msg').textContent='נדרשים ערכים חיוביים המכסים את הפוזיציה הקיימת ומספר חוזים שלם.';[s.budget,s.max,s.loss]=vals;s.mode=$('mode').value;$('msg').textContent='המגבלות נשמרו';paint();};
$('reset').onclick=()=>{if(!confirm('לשמור את היום בארכיון המקומי ולהתחיל יום הדמיה חדש?'))return;pause();localStorage.setItem('scalpingDay'+s.day,JSON.stringify(s));const old=s;s=create(s.day+1);for(const k of ['mode','budget','max','loss'])s[k]=old[k];$('msg').textContent='';settings();paint();route();};
$('learn').onclick=()=>{let html='<h2 id="dialogTitle">מעבדת סקאלפינג</h2><p>השוואה על חמישה תרחישי בדיקה סינתטיים נפרדים. גרסת המקור נשמרת. הנתונים אינם מעידים על ביצועים בשוק.</p>';for(const a of [1,2,3]){html+='<h3>'+names[a]+'</h3>';for(const v of [2,4]){const r=review(a,v);html+='<p>גרסה '+(v===2?'1':'ניסוי')+' · סף '+v+' נקודות · נטו '+fmt(r.net)+' · ירידה מרבית '+fmt(r.draw)+' · '+r.count+' עסקאות</p>';}}show(html);};
$('broker').onclick=async()=>{try{const r=await fetch('/api/broker'),b=await r.json();$('msg').textContent=b.message;}catch{$('msg').textContent='שרת החיבור אינו זמין';}};
$('close').onclick=()=>$('dialog').close();settings();paint();route();

