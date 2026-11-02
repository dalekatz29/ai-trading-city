const endpoint = '/api/manager';
const dateFormat = new Intl.DateTimeFormat('he-IL', {timeZone:'Asia/Jerusalem', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
const usdt = new Intl.NumberFormat('en-US', {minimumFractionDigits:2, maximumFractionDigits:3});
const units = new Intl.NumberFormat('en-US', {maximumFractionDigits:6});
const displayValue = (n, fmt=usdt) => n != null && Number.isFinite(Number(n)) ? fmt.format(Number(n)) : '—';

function time(value) {
  if (value == null || value === '') return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? dateFormat.format(date) : '—';
}
function node(tag, value, cls) {
  const el=document.createElement(tag);
  if (cls) el.className=cls;
  if (value!=null) el.textContent=value;
  return el;
}
function signed(element, value) {
  element.textContent=displayValue(value);
  element.dataset.sign=Number.isFinite(value)?Math.sign(value):0;
}

export function mountManager(root) {
  root.innerHTML=`
    <div class="mg-heading">
      <div><div class="breadcrumb"><a href="#city">מפת העיר</a><span aria-hidden="true">/</span> חדר המנהל</div>
        <p class="kicker"><i></i><bdi>OPERATIONS / 01</bdi></p><h1>המנהל הראשי<span class="title-period">.</span></h1>
        <p>כותבים משימה בעברית. המנהל מתאם בין סוכני ה־ETH, בודק סיכון ומדווח על התוצאה.</p></div>
      <div class="mg-market"><bdi>ETH / USDT</bdi><span>Bybit Spot · דמו</span></div>
    </div>
    <div class="mg-toolbar"><span class="mg-status" data-el="status" role="status">טוען מצב…</span>
      <small data-el="sync"></small><button type="button" data-el="stop" class="mg-stop">■ עצירת הדמו</button></div>
    <div class="mg-layout">
      <section class="mg-card mg-talk" aria-labelledby="mgTalkTitle">
        <div class="mg-card-head"><div><small>01 / COMMAND</small><h2 id="mgTalkTitle">שיחה עם המנהל</h2></div>
          <svg class="mg-insignia ui-icon" aria-hidden="true"><use href="#ui-crew"/></svg></div>
        <div class="mg-chat" data-el="chat" role="log" aria-label="השיחה עם המנהל" aria-live="polite" aria-relevant="additions">
          <div class="mg-turn"><div class="mg-speaker">המנהל הראשי</div><p>אפשר לבקש להתחיל לסחור בדמו, לבדוק את שלוש האסטרטגיות או להציג תוצאות. מה תרצה שאעשה?</p></div>
        </div>
        <form class="mg-form" data-el="form"><label for="mgCommand">פקודה למנהל</label><div class="mg-input-row">
          <input id="mgCommand" name="command" type="text" maxlength="220" autocomplete="off" placeholder="למשל, התחל לסחור ב־ETH בדמו של Bybit" required>
          <button class="mg-send" type="submit" data-el="send">שליחה ↵</button></div></form>
        <div class="mg-suggest" aria-label="פקודות לדוגמה"><button type="button">בדוק אסטרטגיות</button><button type="button">הצג תוצאות</button></div>
      </section>
      <section class="mg-card mg-review" aria-labelledby="mgResultsTitle">
        <div class="mg-card-head"><div><small>02 / DESK</small><h2 id="mgResultsTitle">תוצאות הדסק</h2></div>
          <svg class="ui-icon" aria-hidden="true"><use href="#ui-wave"/></svg></div>
        <div class="mg-metrics">
          <div><span>רווח ממומש אחרי עמלות</span><bdi data-el="realized">—</bdi><small>USDT</small></div>
          <div><span>רווח פתוח</span><bdi data-el="unrealized">—</bdi><small>USDT</small></div>
          <div><span>כמות פתוחה בדסק</span><bdi data-el="qty">—</bdi><small>ETH</small></div>
          <div><span>סה״כ יומי</span><bdi data-el="dailyNet">—</bdi><small>USDT</small></div>
        </div>
        <p class="mg-note" data-el="totals"></p><p class="mg-note" data-el="account"></p>
        <p class="mg-note" data-el="issue" hidden></p><p class="mg-note" data-el="limits"></p>
        <a class="mg-details" href="#eth">פתיחת הדסק, הארנק ויומן הביצועים ↗</a>
      </section>
      <section class="mg-card mg-research" aria-labelledby="mgResearchTitle"><div class="mg-card-head">
        <div><small>03 / RESEARCH</small><h2 id="mgResearchTitle">השוואת האסטרטגיות</h2></div></div>
        <div data-el="research"><p class="mg-note">כתבו ״בדוק אסטרטגיות״ כדי להשוות את שלושת הסוכנים על נתוני עבר.</p></div>
      </section>
      <section class="mg-card mg-agents" aria-labelledby="mgAgentsTitle"><div class="mg-card-head">
        <div><small>04 / SIGNALS</small><h2 id="mgAgentsTitle">החלטות הסוכנים</h2></div></div>
        <p class="mg-note" data-el="marketTime"></p><div data-el="signals"></div>
      </section>
    </div>`;
  const el=Object.fromEntries([...root.querySelectorAll('[data-el]')].map(item=>[item.dataset.el,item]));
  const input=el.form.elements.command;
  const stopRequested=()=>/^(עצור|תעצור|stop)$/iu.test(input.value.trim());
  let active=false, timer, revision=0, sending=false, stopping=false, polling=false, last=null, seen=0;
  let shownResearch, shownSignals;
  function append(speaker, text, kind='') {
    const row=node('div',null,'mg-turn '+kind);
    row.append(node('div',speaker,'mg-speaker'),node('p',text));
    el.chat.append(row);
    while(el.chat.childElementCount>18) el.chat.firstElementChild.remove();
    el.chat.scrollTop=el.chat.scrollHeight;
  }
  function researchPanel(value) {
    const signature=JSON.stringify(value||null);
    if(signature===shownResearch)return;
    shownResearch=signature;
    if(!value?.strategies?.length){
      el.research.replaceChildren(node('p','כתבו ״בדוק אסטרטגיות״ כדי להשוות את שלושת הסוכנים על נתוני עבר.','mg-note'));return;
    }
    const table=node('table'), caption=node('caption','השוואה היסטורית · סכומים ב־USDT'), head=table.createTHead().insertRow();
    const body=table.createTBody();
    table.prepend(caption);
    for(const title of ['אסטרטגיה','עסקאות','רווח נטו','ירידה מרבית']) {
      const th=node('th',title);th.scope='col';head.append(th);
    }
    for(const s of value.strategies) {
      const row=body.insertRow();
      const label=node('th',s.name);label.scope='row';row.append(label);
      const count=row.insertCell(), net=row.insertCell(), draw=row.insertCell();
      count.textContent=displayValue(s.trades,units); net.dir=draw.dir='ltr'; signed(net,s.net);draw.textContent=displayValue(s.maxDrawdown);
    }
    const wrapper=node('div',null,'mg-table-wrap');wrapper.append(table);
    const dates=node('p',null,'mg-note');
    dates.append(node('bdi',value.source||'Bybit'),' · ',node('bdi',time(value.from)),' עד ',node('bdi',time(value.to)),' · שעון ישראל');
    const assumptions=Array.isArray(value.assumptions)?value.assumptions.join(' · '):value.assumptions;
    el.research.replaceChildren(dates,wrapper);
    if(typeof assumptions==='string' && assumptions)el.research.append(node('p',assumptions,'mg-note'));
  }
  function signalPanel(items) {
    const signature=JSON.stringify(items);
    if(signature===shownSignals)return;
    shownSignals=signature;
    if(!items.length){el.signals.replaceChildren(node('p','טרם התקבלה החלטה מסריקת ETH.','mg-note'));return;}
    el.signals.replaceChildren(...items.map((s,index)=>{
      const row=node('div',null,'mg-signal'), title=node('div',null,'mg-signal-title');
      const badge=node('span',s.action==='buy'?'אות קנייה':'המתנה','mg-signal-badge');
      if(s.action==='buy')badge.dataset.tone='on';
      title.append(node('small',String(index+1).padStart(2,'0')),node('strong',s.name),badge);
      row.append(title,node('p',s.reason||'טרם התקבל נימוק.'));return row;
    }));
  }
  function render(stale=false) {
    const state=last?.state;
    el.send.disabled=stopping||(sending&&!stopRequested());
    el.stop.disabled=stopping;
    el.form.setAttribute('aria-busy',String(sending));
    el.send.textContent=sending&&!stopRequested()?'בטיפול…':'שליחה ↵';
    const status=stale?'אין עדכון מהשרת':!state?'טוען מצב…':state.locked?'הדסק נעול':state.running?'הדסק פועל בדמו':state.connected?'הדמו מחובר · הדסק עצור':state.configured?'מפתח דמו מוגדר · הדסק מנותק':'ממתין לחיבור Bybit Demo';
    el.status.textContent=status;
    el.status.dataset.tone=!stale && state?.connected && !state.locked?'on':'idle';
    el.sync.textContent=seen?'עדכון מהשרת '+time(seen)+' · שעון ישראל':'';
    if(!state)return;
    if(!state.configured)el.account.textContent='נדרשת הרשאה ייעודית ל־Bybit Demo. תת־חשבון AI חי משתמש במפתח נפרד. אפשר כבר לבקש בדיקת אסטרטגיות על נתוני השוק.';
    else el.account.textContent=state.connected?'הדסק מאומת מול חשבון Bybit Demo. הנתונים כוללים את הפוזיציה של סוכני הדסק.':'החיבור יאומת מול Bybit בעת בקשת הפעלה בדמו.';
    el.issue.textContent=state.error||'';el.issue.hidden=!state.error;
    el.totals.textContent=state.totals?'הוראות ביומן הדסק '+displayValue(state.totals.orders,units)+' · ביצועים מאומתים '+displayValue(state.totals.fills,units):'';
    const limits=state.config||last.defaults;
    el.limits.textContent=limits?(state.config?'מגבלות הדסק':'ברירת מחדל לדמו')+' · תקציב '+displayValue(limits.budget,units)+' · תקרת פוזיציה '+displayValue(limits.maxPosition,units)+' · הפסד יומי '+displayValue(limits.dailyLoss,units)+' USDT':'';
    const pos=state.position;
    const hasAccounting=state.connected || state.orders?.length || state.fills?.length;
    signed(el.realized,hasAccounting?pos?.realized:null); signed(el.unrealized,hasAccounting?pos?.unrealized:null); signed(el.dailyNet,hasAccounting?pos?.dailyNet:null);
    el.qty.textContent=displayValue(hasAccounting?pos?.qty:null,units);
    el.marketTime.textContent=state.market?.lastClosedAt?'נר דקה אחרון '+time(state.market.lastClosedAt)+' · שעון ישראל':'';
    researchPanel(last.research);
    signalPanel(state.signals||[]);
  }
  function accept(data) {
    if(!data?.state)throw Error('תשובת השרת אינה כוללת את מצב הדסק.');
    last=data;seen=Date.now();render();
  }
  async function refresh() {
    if(!active||document.hidden||polling||sending||stopping)return;
    const version=revision;
    polling=true;
    try {
      const response=await fetch(endpoint,{cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw Error('offline');
      const result=await response.json();
      if(version===revision)accept(result);
    }catch{if(version===revision)render(true);}finally{polling=false;}
  }
  async function command(text, stop=false) {
    if(!text || stopping || sending&&!stop)return;
    if(stop)stopping=true;else sending=true;
    const version=++revision;
    append('אתה',text,'mg-user');
    render();
    try{
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'command',text}),signal:AbortSignal.timeout(45000)});
      const result=await response.json();
      if(version!==revision)return;
      if(result.state)accept(result);
      append('המנהל הראשי',result.message||result.error||(response.ok?'הפקודה התקבלה.':'הפקודה לא בוצעה.'));
    }catch{
      if(version===revision)append('המנהל הראשי','לא התקבל אישור מהשרת. בדקו את מצב הדסק לפני שליחה נוספת.','mg-error');
    }finally{
      if(stop)stopping=false;else sending=false;
      render(!last || Date.now()-seen>15000);
      if(active)void refresh();
    }
  }
  el.form.addEventListener('submit',event=>{
    event.preventDefault();const text=input.value.trim(), stop=stopRequested();
    if(!text||stopping||(sending&&!stop))return;
    input.value='';void command(text,stop);
  });
  input.addEventListener('input',()=>{if(sending)render(!last||Date.now()-seen>15000);});
  root.querySelector('.mg-suggest').addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(button)void command(button.textContent);
  });
  el.stop.addEventListener('click',()=>void command('עצור',true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
  return {setVisible(value) {
    clearInterval(timer);active=value;
    if(active){void refresh();timer=setInterval(refresh,5000);}
  }};
}

