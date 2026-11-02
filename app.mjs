import {cityScene,bankBuilding} from './city.mjs';
import {officeScene} from './office.mjs';
import {names,create,next,bar,signals,openPNL,halt,review} from './engine.mjs';
const $=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
let s=create(),selected=0,timer;
try{const saved=JSON.parse(localStorage.scalpingStateV1||'null');if(saved){s=saved;if(s.active)s.active=s.trades.at(-1);}}catch{}
const time=i=>new Date(Date.UTC(2026,0,1,9,30,i*15)).toISOString().slice(11,19);
let marketChart, stationOpener, sceneKey;
const portraitStyles = [
  { skin:'#c78c70', light:'#e5af88', shade:'#9b6858', hair:'#27364e', glint:'#435b75', uniform:'#2796ad', trim:'#79f6ef',
    cut:'M5 12V7h1V5h2V4h7v1h2v2h1v4h-2V8h-3v1h-3v1H7v2z', sheen:'M7 6h3V5h4v1h-3v1H7z' },
  { skin:'#e7aa79', light:'#ffd29b', shade:'#b97a5d', hair:'#643c36', glint:'#ae6851', uniform:'#c97e43', trim:'#ffca85',
    cut:'M5 12V6h2V4h3V3h4v1h2v2h2v4h-2V8h-5V7H9v2H7v3z', sheen:'M8 5h4V4h2v1h-2v1H8z' },
  { skin:'#c9957f', light:'#edc0a2', shade:'#a27269', hair:'#474561', glint:'#8276a1', uniform:'#5078bd', trim:'#a4bdff',
    cut:'M5 13V7h1V5h4V3h5v1h3v6h-2V7h-2v2h-3v1H8v3z', sheen:'M8 7h3V5h4v1h-3v2H8z' },
  { skin:'#aa735e', light:'#d79a77', shade:'#825448', hair:'#393046', glint:'#774f6d', uniform:'#915b9c', trim:'#edb5ff',
    cut:'M4 17V8h1V5h2V4h3V3h4v1h2v1h2v3h1v9h-3v-3h-1V8h-2v1h-3v1H7v5H6v2z', sheen:'M6 9V6h2V5h3v1H9v1H7v2z' },
  { skin:'#d8a386', light:'#f4c7a6', shade:'#aa7767', hair:'#a6acb9', glint:'#dce6e8', uniform:'#377f75', trim:'#90e8bf',
    cut:'M5 12V7h1V5h3V4h6v1h2v2h1v5h-2V8h-3V7h-2v1H8v4z', sheen:'M7 6h3V5h4v1h-3v1H7z' },
  { skin:'#b07865', light:'#db9b80', shade:'#88584e', hair:'#243041', glint:'#516175', uniform:'#aa5866', trim:'#ffa9ab',
    cut:'M5 12V7h1V6h2V4h7v1h2v1h1v5h-2V8h-3v1H8v3z', sheen:'M8 6h2V5h4v1h-3v1H8z' }
];

function portrait(index) {
  const style = portraitStyles[index] || portraitStyles[0];
  const path = (fill, d) => '<path fill="'+fill+'" d="'+d+'"/>';
  const { skin, light, shade, hair, glint, uniform, trim } = style;
  let layers = path('#111c2c','M0 0h22v22H0z') + path('#1c2b3c','M1 8h2V5h2V3h3V2h7v1h3v2h2v3h1v12H1z');
  // High collar, folded shoulders and undershirt.
  layers += path('#0b1522','M1 22v-3h2v-2h4v-1h8v1h4v2h2v3z');
  layers += path(uniform,'M2 22v-3h3v-1h3v-1h6v1h3v1h3v3z');
  layers += path('#26394c','M8 17h6v2h-1v2h-1v1h-2v-2H9v-1H8z');
  layers += path(trim,'M4 19h3v1H4zM15 19h2v2h-2z');
  layers += path(shade,'M9 15h5v3h-1v1h-3v-1H9z');
  // Pixel-cut jaw with warm side lighting.
  layers += path(skin,'M7 7h9v2h1v2h1v2h-2v2h-1v1h-2v1H9v-1H7v-2H6v-1H5v-2h1V8h1z');
  layers += path(light,'M8 8h5v2h-3v1H8zm0 5h2v1H8z');
  layers += path(shade,'M15 10h1v4h-1v2h-2v-1h1v-2h1zm-4 2h1v1h1v1h-2z');
  layers += path(hair,style.cut) + path(glint,style.sheen);
  layers += path('#303041','M8 11h2v1H8zm5 0h2v1h-2z');
  layers += path('#7f4b50','M10 15h3v1h-3z');
  if (index===0 || index===5) {
    layers += path('#7990a5','M4 10V7h1V5h2v1H6v2H5v2zm13-5h1v2h1v3h-1V8h-1z');
    layers += path(uniform,'M4 10h2v4H4zm13 0h2v4h-2z') + path(trim,'M4 10h1v3H4zm14 4h1v1h-2v1h-3v-1h2v-1z');
  }
  if (index===1 || index===4) {
    layers += path('#24394a','M6 10h5v1h1v-1h5v3h-1v1h-3v-1h-1v-1h-1v1h-1v1H7v-1H6z');
    layers += path(index===1?'#e9af77':'#b3d7c9','M7 11h3v1H7zm6 0h3v1h-3z');
  }
  if (index===2) layers+=path(trim,'M15 6h2v1h-2zm1 7h1v2h-1z');
  if (index===3) layers+=path(trim,'M5 7h2v1H5zm11 7h1v2h-1z');
  if (index===4) layers+=path('#b7a39b','M8 14h2v1h3v-1h2v2h-2v1H9v-1H8z');
  if (index===5) layers+=path(trim,'M6 7h9v1H6z');
  return '<svg viewBox="0 0 22 22" width="44" height="44" aria-hidden="true" focusable="false" shape-rendering="crispEdges">'+layers+'</svg>';
}

const specialties = ['מחיר ונפח', 'המשכיות מגמה', 'פריצת טווח', 'חזרה לממוצע', 'חשיפה ומגבלות', 'ביצוע הוראות'];
const roster = $('crewList');
for (const [index, name] of names.entries()) {
 const row = document.createElement('button');
 row.type = 'button';
 row.className = 'crew-row';
 row.dataset.desk = index;
 row.setAttribute('aria-haspopup', 'dialog');
 row.setAttribute('aria-label', 'פתיחת עמדה · ' + name);
 row.style.setProperty('--accent', portraitStyles[index].trim);
 row.innerHTML = '<span class="crew-avatar">' + portrait(index) + '</span><span class="crew-name"><strong>' + name + '</strong><small>' + specialties[index] + '</small></span><span class="crew-number" aria-hidden="true">0' + (index + 1) + '</span>';
 roster.append(row);
}
function highlightDesk(index) {
 for (const desk of document.querySelectorAll('#officeRoom .workstation, #officeRoom .station-label')) {
  desk.classList.toggle('linked-hover', desk.dataset.a === index);
 }
 for (const row of roster.children) row.classList.toggle('linked-hover', row.dataset.desk === index);
}
function linkHover(host, selector, key) {
 const update = event => highlightDesk(event.target.closest(selector)?.dataset[key]);
 host.addEventListener('pointerover', update);
 host.addEventListener('focusin', update);
 host.addEventListener('pointerleave', () => highlightDesk(null));
 host.addEventListener('focusout', () => highlightDesk(null));
}
linkHover(roster, '[data-desk]', 'desk');
linkHover($('officeRoom'), '[data-a]', 'a');
roster.onclick = event => {
 const row = event.target.closest('[data-desk]');
 if (row) openStation(Number(row.dataset.desk), row);
};
function simulationHistory(){
 const first=Math.max(0,s.i-119);
 return Array.from({length:s.i-first+1},(_,offset)=>{
  const i=first+offset;
  return {time:Date.UTC(2026,0,s.day,9,30,i*15),...bar(i,s.day)};
 });
}
const roles = [
 'סורק את המחיר והנפח בכל 15 שניות ומעביר נתונים לחוקרים.',
 'בודק המשך תנועה קצרה על פני ארבעה צעדים, כלומר דקה.',
 'בודק פריצה של טווח שתי הדקות האחרונות עם עלייה בנפח.',
 'בודק התאוששות אחרי ירידה מתחת לממוצע שתי הדקות האחרונות.',
 'בודק חשיפה מצטברת, מספר חוזים וסף הפסד לפני כל כניסה.',
 'מדמה ביצוע חלקי, עמלות, החלקה ויציאה מהירה מהעסקה.'
];
function map(){
 if (!$('officeView').hidden) {
  const active = s.active?.agent;
  const selectedDesk = $('agentDetails').open ? selected : -1;
  const key = [s.day, s.i, active, selectedDesk, Boolean(timer)].join('/');
  if (sceneKey !== key) {
   const history = simulationHistory();
   const focusedDesk = document.activeElement?.closest('#officeRoom [data-a]')?.dataset.a;
   $('officeRoom').innerHTML = officeScene(selectedDesk, active, Boolean(timer), history.map(sample => sample.price));
   if (focusedDesk !== undefined) $('officeRoom').querySelector('[role="button"][data-a="'+focusedDesk+'"]')?.focus({preventScroll:true});
   marketChart?.setSimulation(history);
   sceneKey = key;
  }
 }
 $('role').textContent=roles[selected];
 const activity = $('officeActivity');
 const states = s.stopped ? ['stopped','המשרד עצור'] : s.i >= 77 ? ['idle','התרגול הסתיים'] : timer ? ['running','הסריקה פועלת'] : s.active?.status === 'אישור' ? ['waiting','ממתינים לאישור'] : ['idle','ממתינים להפעלה'];
 [activity.dataset.state, activity.textContent] = states;
 $('bankSummary').innerHTML='<span>חשיפה נומינלית פתוחה</span><strong>'+fmt(s.qty*bar(s.i,s.day).price*2)+'</strong><span>מתוך תקרה של '+fmt(s.budget)+'</span><p>'+s.qty+' חוזים פתוחים · רווח ממומש '+fmt(s.cash)+'</p>';
}
function route(){
 const inside=location.hash==='#office';
 const bank=location.hash==='#bank';
 $('cityView').hidden=inside||bank;
 $('officeView').hidden=!inside;
 $('bankView').hidden=!bank;
 if(!inside){
  pause();
  if($('agentDetails').open)$('agentDetails').close();
 }
 const place=inside?'office':bank?'bank':'city';
 document.querySelectorAll('header nav a').forEach(link=>{
  if(link.hash==='#'+place)link.setAttribute('aria-current','page');
  else link.removeAttribute('aria-current');
 });
 map();
 window.scrollTo(0,0);
}
$('city').innerHTML=cityScene();
$('bankArt').innerHTML=bankBuilding(200,245);
$('city').onclick=e=>{const destination=e.target.closest('[data-place]');if(destination)location.hash=destination.dataset.place;};
$('city').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){const destination=e.target.closest('[data-place]');if(destination){e.preventDefault();location.hash=destination.dataset.place;}}};
window.addEventListener('hashchange',route);
function show(html){pause();map();$('dialogBody').innerHTML=html;$('dialog').showModal();}
function pause(){clearInterval(timer);timer=null;$('run').textContent='▶ הפעלה';}
function paint(){
 const b=bar(s.i,s.day),prev=bar(s.i-1,s.day),flags=signals(s);
 $('clock').innerHTML='<bdi>'+time(s.i)+' ET</bdi><span>שעון הדמיה</span>';
 const metrics = [
  ['מחיר MNQ', b.price.toFixed(2), 'chart'],
  ['רווח ממומש אחרי עמלות', fmt(s.cash), 'book', Math.sign(s.cash)],
  ['רווח פתוח', fmt(openPNL(s)), 'wave', Math.sign(openPNL(s))],
  ['חוזים פתוחים', s.qty, 'layers']
 ];
 $('metrics').innerHTML = metrics.map(([label,value,icon,sign]) =>
  '<div class="metric"><div class="metric-icon"><svg class="ui-icon" aria-hidden="true"><use href="#ui-'+icon+'"/></svg></div><div><span>'+label+'</span><strong dir="ltr" data-sign="'+(sign||0)+'">'+value+'</strong></div></div>'
 ).join('');
 $('agent').textContent=names[selected];const prices=Array.from({length:9},(_,j)=>bar(s.i-8+j,s.day).price),prior=prices.slice(0,-1);
 const reasons=['שינוי מחיר '+(b.price-prev.price).toFixed(2)+' נקודות • שינוי נפח '+(b.volume-prev.volume),'שינוי בדקה '+(b.price-prices[4]).toFixed(2)+' נקודות','שיא שמונת הנרות '+Math.max(...prior)+' • נפח נוכחי '+b.volume+' מול '+prev.volume,'ממוצע שתי דקות '+(prior.reduce((a,v)=>a+v,0)/8).toFixed(2)+' • מחיר קודם '+prev.price,'חשיפה פתוחה '+fmt(s.qty*b.price*2)+' מתוך '+fmt(s.budget),'מצב ההוראה האחרונה • '+(s.trades.at(-1)?.status||'אין הוראות')];
 $('insight').textContent=reasons[selected];
 $('terminalCode').textContent='DESK 0'+(selected+1);
 $('info').innerHTML='<p>סוכן סקאלפינג מבוסס כללים · גרסה 1</p><p>'+(['סריקת MNQ',...flags.map(f=>f?'אות קנייה':'ממתין לתנאי כניסה'),'בדיקת מגבלות משותפות','מעקב ביצועים'][selected])+'</p>'+(selected>0&&selected<4?'תוצאה מעסקאות סגורות '+fmt(s.trades.filter(t=>t.agent===selected&&t.status==='נסגרה').reduce((n,t)=>n+t.net,0)):'')+'<p>תרגול '+s.day+' · נתונים סינתטיים<br>צעדי 15 שניות · יעד 4 נקודות · עצירה 3 נקודות · עד 45 שניות מהביצוע הראשון.<br>עמלה מדומה $1 לחוזה לכל צד והחלקה של טיק אחד.</p>';
 $('log').innerHTML=s.trades.length?s.trades.map((t,i)=>'<button class="entry" data-t="'+i+'">'+time(t.events[0].i)+'　'+names[t.agent]+'　·　'+t.status+'</button>').reverse().join(''):'<p>העיר ממתינה לנר הבא. לחצו על הפעלה כדי להתחיל בסריקה.</p>';
 $('approve').disabled=s.active?.status!=='אישור'||s.stopped;$('run').disabled=$('step').disabled=s.stopped||s.i>=77;
 $('restartOffice').hidden=!$('run').disabled;
 if(s.stopped||s.i>=77){pause();$('msg').textContent=(s.stopped?'המערכת עצורה':'יום ההדמיה הסתיים')+' • חוזים פתוחים '+s.qty;}
 map();localStorage.scalpingStateV1=JSON.stringify(s);
}
function tick(){next(s);if(s.mode==='manual'&&s.active?.status==='אישור')pause();paint();}
async function openStation(index, opener){
 selected=index;
 stationOpener=opener;
 $('reportAvatar').innerHTML=portrait(selected);
 $('agentDetails').showModal();
 paint();
 if(!marketChart){
  $('marketChart').textContent='פותח מסוף שוק…';
  try{
   const {mountMarketChart}=await import('./chart.mjs');
   if(!$('agentDetails').open)return;
   marketChart??=mountMarketChart($('marketChart'));
  }catch{
   $('marketChart').textContent='המסוף לא נטען. אפשר לסגור את העמדה ולפתוח אותה שוב.';
   return;
  }
 }
 marketChart.setSimulation(simulationHistory());
 marketChart.setVisible(true);
}
$('officeRoom').onclick=e=>{const station=e.target.closest('[data-a]');if(station)openStation(Number(station.dataset.a));};
$('officeRoom').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}};
$('closeAgent').onclick=()=>$('agentDetails').close();
$('agentDetails').onclose=()=>{marketChart?.setVisible(false);map();if(!$('officeView').hidden){const target=stationOpener?.isConnected?stationOpener:$('officeRoom').querySelector('[role="button"][data-a="'+selected+'"]');target?.focus({preventScroll:true});}};
function sceneHint(scene,id,selector,label,rest){
 const update=event=>{const target=event.target.closest(selector);$(id).textContent=target?label(target):rest;};
 $(scene).addEventListener('pointerover',update);
 $(scene).addEventListener('focusin',update);
 for(const type of ['pointerleave','focusout'])$(scene).addEventListener(type,()=>{$(id).textContent=rest;});
}
sceneHint('officeRoom','deskHint','[data-a]',el=>names[Number(el.dataset.a)]+' · פתיחת מסוף ↗','בחרו דמות או עמדה במשרד');
sceneHint('city','mapHint','[data-place]',el=>el.getAttribute('aria-label'),'◈ מפת הרובע');
$('restartOffice').onclick=()=>$('reset').click();
$('run').onclick=()=>{if(timer){pause();paint();return;}timer=setInterval(tick,800);$('run').textContent='Ⅱ השהיה';tick();};$('step').onclick=tick;$('approve').onclick=()=>{next(s,true);paint();};$('stop').onclick=()=>{halt(s);paint();};
$('log').onclick=e=>{if(!e.target.dataset.t)return;const t=s.trades[+e.target.dataset.t];show('<h2 id="dialogTitle">סיפור העסקה</h2><p>'+names[t.agent]+'</p>'+t.events.map(v=>'<p>'+time(v.i)+'　'+v.label+'</p>').join(''));};
function settings(){for(const k of ['mode','budget','max','loss'])$(k).value=s[k];}
$('save').onclick=()=>{const vals=['budget','max','loss'].map(k=>Number($(k).value));if(vals.some(v=>!Number.isFinite(v)||v<=0)||!Number.isInteger(vals[1])||vals[1]<s.qty||vals[0]<s.qty*bar(s.i,s.day).price*2)return $('msg').textContent='נדרשים ערכים חיוביים המכסים את הפוזיציה הקיימת ומספר חוזים שלם.';[s.budget,s.max,s.loss]=vals;s.mode=$('mode').value;$('msg').textContent='המגבלות נשמרו';paint();};
$('reset').onclick=()=>{if(!confirm('לשמור את היום בארכיון המקומי ולהתחיל יום הדמיה חדש?'))return;pause();localStorage.setItem('scalpingDay'+s.day,JSON.stringify(s));const old=s;s=create(s.day+1);for(const k of ['mode','budget','max','loss'])s[k]=old[k];$('msg').textContent='';settings();paint();route();};
$('learn').onclick=()=>{let html='<h2 id="dialogTitle">מעבדת סקאלפינג</h2><p>השוואה על חמישה תרחישי בדיקה סינתטיים נפרדים. גרסת המקור נשמרת. הנתונים אינם מעידים על ביצועים בשוק.</p>';for(const a of [1,2,3]){html+='<h3>'+names[a]+'</h3>';for(const v of [2,4]){const r=review(a,v);html+='<p>גרסה '+(v===2?'1':'ניסוי')+' · סף '+v+' נקודות · נטו '+fmt(r.net)+' · ירידה מרבית '+fmt(r.draw)+' · '+r.count+' עסקאות</p>';}}show(html);};
$('broker').onclick=async()=>{try{const r=await fetch('/api/broker'),b=await r.json();$('msg').textContent=b.message;}catch{$('msg').textContent='שרת החיבור אינו זמין';}};
$('close').onclick=()=>$('dialog').close();settings();paint();route();

