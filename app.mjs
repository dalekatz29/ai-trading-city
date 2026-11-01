import {names,create,next,bar,signals,openPNL,halt,review} from './engine.mjs';
const $=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
let s=create(),selected=0,timer;
try{const saved=JSON.parse(localStorage.cityState||'null');if(saved){s=saved;if(s.active)s.active=s.trades.at(-1);}}catch{}
const time=i=>String(9+Math.floor((30+i)/60)).padStart(2,'0')+':'+String((30+i)%60).padStart(2,'0');
const colors=['#9ce8cb','#f3c37d','#a6bfff','#d6a5db','#9ed8b1','#f4a789'];
const sites=[[330,122,75],[190,196,45],[468,188,57],[320,248,42],[155,280,44],[470,280,65]];
function block(w,h,color){return '<path fill="#476676" d="M-'+w+' 0l'+w+' '+w/2+'v-'+h+'l-'+w+' -'+w/2+'z"/><path fill="#294951" d="M0 '+w/2+'l'+w+' -'+w/2+'v-'+h+'l-'+w+' '+w/2+'z"/><path fill="'+color+'" d="M0 -'+(h+w/2)+'l'+w+' '+w/2+' -'+w+' '+w/2+' -'+w+' -'+w/2+'z"/>';}
function map(){
 let svg='<defs><pattern id="grid" width="60" height="30" patternUnits="userSpaceOnUse"><path d="M0 0L60 30M60 0L0 30" fill="none" stroke="#436266" opacity=".32"/></pattern></defs><rect width="700" height="400" fill="url(#grid)"/><path d="M40 219L346 66 654 219 346 373Z" fill="#305456" stroke="#698079" stroke-width="3"/><path d="M97 191l309 153m-215-201l307 153M101 250L409 96m-218 201L499 143" stroke="#1d393e" stroke-width="16"/>';
 sites.forEach(([x,y,h],a)=>{
 let windows='';for(let row=0;row<Math.floor(h/12)-1;row++)for(let col=0;col<4;col++)windows+='<path d="M'+(-38+col*9)+' '+(-h+10+row*12+col*4.5)+'l5 2.5v4l-5 -2.5z" fill="'+colors[a]+'"/>';
 const active=s.active&&!s.stopped&&(a===s.active.agent||a===(s.active.status==='אישור'?0:5));
 svg+='<g class="building" tabindex="0" role="button" aria-label="'+names[a]+'" data-a="'+a+'" transform="translate('+x+' '+y+')">'+block(54,6,'#738b83')+'<g transform="translate(0,-6)">'+block(42,h,colors[a])+windows+'<g transform="translate(0,-'+(h+9)+')">'+block(a===0?11:17,a===0?29:7,colors[a])+'</g></g><g transform="translate(45,12)"><ellipse rx="10" ry="4" fill="#203b40"/><path d="M-6 0v-10q6-6 12 0v10" fill="'+colors[a]+'"/><circle cy="-16" r="5" fill="#edc99f"/></g><rect x="-52" y="31" width="104" height="23" rx="7" fill="'+(selected===a?'#426466':'#152e36')+'"/><text y="47" text-anchor="middle" fill="white" font-size="13">'+names[a]+'</text>'+(active?'<circle cy="-'+(h+45)+'" r="7" fill="#ffcc79"/>':'')+'</g>';
 });$('city').innerHTML=svg;
}
function show(html){pause();$('dialogBody').innerHTML=html;$('dialog').showModal();}
function pause(){clearInterval(timer);timer=null;$('run').textContent='▶ הפעלה';}
function paint(){
 const b=bar(s.i,s.day),prev=bar(s.i-1,s.day),flags=signals(s);
 $('clock').textContent='שעון הדמיה '+time(s.i)+' ET';
 $('metrics').innerHTML=[['מחיר MNQ',b.price.toFixed(2)],['רווח ממומש אחרי עמלות',fmt(s.cash)],['רווח פתוח',fmt(openPNL(s))],['חוזים פתוחים',s.qty]].map(([k,v])=>'<div>'+k+'<strong dir="ltr">'+v+'</strong></div>').join('');
 $('agent').textContent=names[selected];const prices=Array.from({length:9},(_,j)=>bar(s.i-8+j,s.day).price),prior=prices.slice(0,-1);
 const reasons=['שינוי מחיר '+(b.price-prev.price).toFixed(2)+' נקודות • שינוי נפח '+(b.volume-prev.volume),'שינוי בארבע דקות '+(b.price-prices[4]).toFixed(2)+' נקודות','שיא שמונת הנרות '+Math.max(...prior)+' • נפח נוכחי '+b.volume+' מול '+prev.volume,'ממוצע שמונה דקות '+(prior.reduce((a,v)=>a+v,0)/8).toFixed(2)+' • מחיר קודם '+prev.price,'חשיפה פתוחה '+fmt(s.qty*b.price*2)+' מתוך '+fmt(s.budget),'מצב ההוראה האחרונה • '+(s.trades.at(-1)?.status||'אין הוראות')];
 $('insight').textContent=reasons[selected];let series=Array.from({length:24},(_,j)=>bar(Math.max(0,s.i-23+j),s.day).price),min=Math.min(...series),max=Math.max(...series);
 $('chart').innerHTML='<path fill="none" stroke="#93dfc4" stroke-width="2.5" d="'+series.map((p,i)=>(i?'L':'M')+(5+i*11.7)+' '+(74-63*(p-min)/(max-min||1))).join(' ')+'"/>';
 $('info').innerHTML='<p>סוכן מבוסס כללים · גרסה 1</p><p>'+(['סריקת MNQ',...flags.map(f=>f?'אות קנייה':'ממתין לתנאי כניסה'),'בדיקת מגבלות משותפות','מעקב ביצועים'][selected])+'</p>'+(selected>0&&selected<4?'תוצאה מעסקאות סגורות '+fmt(s.trades.filter(t=>t.agent===selected&&t.status==='נסגרה').reduce((n,t)=>n+t.net,0)):'')+'<p>יום תרגול '+s.day+' · נתונים סינתטיים<br>עמלה מדומה $1 לחוזה לכל צד והחלקה של טיק אחד.</p>';
 $('log').innerHTML=s.trades.length?s.trades.map((t,i)=>'<button class="entry" data-t="'+i+'">'+time(t.events[0].i)+'　'+names[t.agent]+'　·　'+t.status+'</button>').reverse().join(''):'<p>העיר ממתינה לנר הבא. לחצו על הפעלה כדי להתחיל בסריקה.</p>';
 $('approve').disabled=s.active?.status!=='אישור'||s.stopped;$('run').disabled=$('step').disabled=s.stopped||s.i>=77;
 if(s.stopped||s.i>=77){pause();$('msg').textContent=(s.stopped?'המערכת עצורה':'יום ההדמיה הסתיים')+' • חוזים פתוחים '+s.qty;}
 map();localStorage.cityState=JSON.stringify(s);
}
function tick(){next(s);if(s.mode==='manual'&&s.active?.status==='אישור')pause();paint();}
$('city').onclick=e=>{const g=e.target.closest('[data-a]');if(g){selected=+g.dataset.a;paint();}};$('city').onkeydown=e=>{if(['Enter',' '].includes(e.key))e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));};
$('run').onclick=()=>{if(timer)return pause();timer=setInterval(tick,800);$('run').textContent='Ⅱ השהיה';tick();};$('step').onclick=tick;$('approve').onclick=()=>{next(s,true);paint();};$('stop').onclick=()=>{halt(s);paint();};
$('log').onclick=e=>{if(!e.target.dataset.t)return;const t=s.trades[+e.target.dataset.t];show('<h2>סיפור העסקה</h2><p>'+names[t.agent]+'</p>'+t.events.map(v=>'<p>'+time(v.i)+'　'+v.label+'</p>').join(''));};
function settings(){for(const k of ['mode','budget','max','loss'])$(k).value=s[k];}
$('save').onclick=()=>{const vals=['budget','max','loss'].map(k=>Number($(k).value));if(vals.some(v=>!Number.isFinite(v)||v<=0)||!Number.isInteger(vals[1])||vals[1]<s.qty||vals[0]<s.qty*bar(s.i,s.day).price*2)return $('msg').textContent='נדרשים ערכים חיוביים המכסים את הפוזיציה הקיימת ומספר חוזים שלם.';[s.budget,s.max,s.loss]=vals;s.mode=$('mode').value;$('msg').textContent='המגבלות נשמרו';paint();};
$('reset').onclick=()=>{if(!confirm('לשמור את היום בארכיון המקומי ולהתחיל יום הדמיה חדש?'))return;pause();localStorage.setItem('cityDay'+s.day,JSON.stringify(s));const old=s;s=create(s.day+1);for(const k of ['mode','budget','max','loss'])s[k]=old[k];$('msg').textContent='';settings();paint();};
$('learn').onclick=()=>{let html='<h2>מעבדת אסטרטגיות</h2><p>השוואה על חמישה תרחישי בדיקה סינתטיים נפרדים. גרסת המקור נשמרת. הנתונים אינם מעידים על ביצועים בשוק.</p>';for(const a of [1,2,3]){html+='<h3>'+names[a]+'</h3>';for(const v of [2,4]){const r=review(a,v);html+='<p>גרסה '+(v===2?'1':'ניסוי')+' · סף '+v+' נקודות · נטו '+fmt(r.net)+' · ירידה מרבית '+fmt(r.draw)+' · '+r.count+' עסקאות</p>';}}show(html);};
$('broker').onclick=async()=>{try{const r=await fetch('/api/broker'),b=await r.json();$('msg').textContent=b.message;}catch{$('msg').textContent='שרת החיבור אינו זמין';}};
$('close').onclick=()=>$('dialog').close();settings();paint();
