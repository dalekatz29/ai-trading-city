// Only the local server authenticates with Bybit. This view submits desk commands.
const endpoint = '/api/eth-demo';
const prices = new Intl.NumberFormat('en-US', {maximumFractionDigits:2});
const amounts = new Intl.NumberFormat('en-US', {maximumFractionDigits:8});
const clock = new Intl.DateTimeFormat('he-IL', {
  timeZone:'Asia/Jerusalem', day:'2-digit', month:'2-digit',
  hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
});

function numeric(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function quantity(value) {
  const n = numeric(value);
  return n === null ? '—' : amounts.format(n);
}
function money(value) {
  const n = numeric(value);
  return n === null ? '—' : prices.format(n) + ' USDT';
}
function time(value) {
  const ts = numeric(value);
  return ts !== null && ts > 0 && ts <= 8.64e15 ? clock.format(ts) : '—';
}
function side(value) {
  if (String(value).toLowerCase() === 'buy') return 'קנייה';
  if (String(value).toLowerCase() === 'sell') return 'מכירה';
  return value || '—';
}
const statuses = {
  New:'פתוחה', Created:'נוצרה', PartiallyFilled:'ביצוע חלקי', Filled:'בוצעה',
  Cancelled:'בוטלה', Canceled:'בוטלה', Rejected:'נדחתה', Expired:'פג תוקף',
  PendingCancel:'ביטול ממתין', PartiallyFilledCanceled:'ביצוע חלקי וביטול יתרה'
};

function table(root, columns, records, empty) {
  const rows=records.map(record=>columns.map(column=>column[1](record)));
  const signature=JSON.stringify(rows);
  if (root.dataset.rows===signature) return;
  root.dataset.rows=signature;
  if (!rows.length) {
    const note=document.createElement('p');
    note.className='ed-empty';
    note.textContent=empty;
    root.replaceChildren(note);
    return;
  }
  const grid=document.createElement('table');
  const head=grid.createTHead().insertRow();
  for (const [name] of columns) {
    const th=document.createElement('th');
    th.scope='col';
    th.textContent=name;
    head.append(th);
  }
  const body=grid.createTBody();
  for (const values of rows) {
    const row=body.insertRow();
    for(const value of values) {
      const cell=row.insertCell();
      const text=document.createElement('bdi');
      text.textContent=String(value ?? '—');
      cell.append(text);
    }
  }
  root.replaceChildren(grid);
}

export function mountEthDesk(root) {
  root.classList.add('eth-desk');
  root.innerHTML = `
    <div class="ed-head"><div><a href="#city" class="back">← חזרה לעיר</a>
    <span class="ed-kicker" dir="ltr">ETHEREUM / SPOT DESK</span><h1>דסק ETH · Bybit Demo</h1>
    <p>אותות על ETH/USDT ממחירי ספוט ציבוריים. הוראות הדסק מיועדות לחשבון Bybit Demo.</p></div>
    <span class="ed-mode">◈ ביצוע בכספי דמו</span></div>
    <div class="ed-status" data-el="connection" style="position:sticky;top:4px;z-index:3"><span data-el="connectionText" role="status">ממתין למצב השרת</span><span class="ed-age" data-el="age"></span><button class="ed-stop" style="min-height:44px" type="button" data-cmd="stop">■ עצירת הדסק</button></div>
    <section class="ed-metrics" aria-label="סיכום דסק ETH">
      <div class="ed-metric"><small>מחיר קנייה מוצע · Ask</small><b data-el="ask">—</b></div>
      <div class="ed-metric"><small>מחיר מכירה מוצע · Bid</small><b data-el="bid">—</b></div>
      <div class="ed-metric"><small>כמות בפוזיציית הדסק</small><b data-el="size">—</b></div>
      <div class="ed-metric"><small>תוצאת הדסק היום</small><b data-el="net">—</b></div>
    </section>
    <div class="ed-grid">
      <section class="ed-panel"><div class="ed-section-head"><h2>בקרת הדסק</h2><small>DESK CONTROL</small></div>
        <p class="ed-note" data-el="setup"></p><p class="ed-note"><a href="https://bybit-exchange.github.io/docs/v5/demo#create-api-key" target="_blank" rel="noopener noreferrer">מדריך Bybit להגדרת מפתח בחשבון Demo ↗</a></p><div class="ed-row"><button type="button" data-cmd="connect">בדיקת חיבור הדמו</button><button type="button" data-cmd="scan">סריקת ETH כעת</button></div>
        <form data-el="params"><div class="ed-form">
          <label>מצב אישור עסקאות<select name="mode"><option value="manual" selected>אישור שלי לכל הוראה</option><option value="auto">ביצוע דמו אוטונומי</option></select></label>
          <label>תקציב לדסק · USDT<input name="budget" type="number" step="any" min="0.00000001" required></label>
          <label>תקרת פוזיציה · USDT<input name="maxPosition" type="number" step="any" min="0.00000001" required></label>
          <label>סף הפסד יומי · USDT<input name="dailyLoss" type="number" step="any" min="0.00000001" required></label>
        </div><div class="ed-row"><button class="ed-start" type="submit" data-cmd="start">▶ הפעלת הדסק בדמו</button></div></form>
        <p class="ed-note">במצב ידני גם קנייה וגם מכירה דורשות אישור. עצירה עשויה להשאיר יתרת ETH בחשבון.</p>
      </section>
      <section class="ed-panel"><div class="ed-section-head"><h2>החלטת מסחר</h2><small>ORDER REVIEW</small></div>
        <div data-el="offer"></div><button type="button" data-cmd="approve" hidden>אישור הוראת דמו</button>
        <h3>אותות הסוכנים</h3><p class="ed-note" data-el="scanTime"></p><div class="ed-records" data-el="signals"></div>
      </section>
    </div>
    <p class="ed-feedback" role="status" data-el="feedback"></p>
    <div class="ed-grid">
      <section class="ed-panel"><div class="ed-section-head"><h2>ארנק Bybit Demo</h2><small>DEMO WALLET</small></div>
        <p class="ed-note" data-el="walletTime"></p><div data-el="wallet"></div></section>
      <section class="ed-panel"><div class="ed-section-head"><h2>פוזיציית הדסק</h2><small>ETH / USDT</small></div><div data-el="position"></div></section>
      <section class="ed-panel"><div class="ed-section-head"><h2>הוראות דמו</h2><small>ORDERS</small></div><div class="ed-records" data-el="orders"></div></section>
      <section class="ed-panel"><div class="ed-section-head"><h2>ביצועים ועמלות</h2><small>FILLS</small></div><div class="ed-records" data-el="fills"></div></section>
    </div>
    <section class="ed-panel"><div class="ed-section-head"><h2>יומן הדסק</h2><small>ACTIVITY</small></div><div class="ed-records" data-el="journal"></div></section>
    <p class="ed-note">השעות המוצגות הן שעון ישראל. מפתחות ה־API מוגדרים במחשב ומנוהלים בצד השרת.</p>
  `;
  const el=Object.fromEntries([...root.querySelectorAll('[data-el]')].map(node=>[node.dataset.el,node]));
  const buttons=Object.fromEntries([...root.querySelectorAll('[data-cmd]')].map(node=>[node.dataset.cmd,node]));
  const inputs=el.params.elements;
  let state=null, visible=false, disposed=false, receipt=0, pollTimer, request;
  let pending='', inputEdited=false, configLoaded=false, readError='', approvalId='';
  let actionVersion=0, inFlight=0;
  el.params.addEventListener('input',()=>{inputEdited=true;});
  const put=(target,text)=>{if(target.textContent!==text)target.textContent=text;};

  function render() {
    const data=state || {};
    const stale=!!readError || !receipt || Date.now()-receipt>18000;
    const accountState=data.connected?'חשבון הדמו מחובר':data.configured?'מפתחות הוגדרו · נדרש חיבור':'ממתין להגדרת מפתחות דמו';
    const runState=data.locked?'נעילת סיכון פעילה':data.running?'הדסק פועל':'הדסק עצור';
    const status=readError || (!state?'טוען את מצב הדסק…':stale?'הנתונים האחרונים טרם רועננו':accountState+' · '+runState);
    el.connection.dataset.tone=stale||!data.connected||data.locked?'warn':'ok';
    put(el.connectionText,status);
    put(el.age,receipt?time(receipt)+' IL':'');
    put(el.setup,data.configured?'מפתחות ה־Demo הוגדרו. בדיקת החיבור מבקשת את מצב הארנק מהבורסה.':'להגדרת מפתחות Demo פתחו במחשב את ״הגדרת Bybit Demo.cmd״ בתיקיית הפרויקט, ואז לחצו על בדיקת החיבור. סריקת מחירים ציבוריים זמינה גם לפני ההגדרה.');
    if (data.config && !inputEdited && !configLoaded) {
      for(const key of ['budget','maxPosition','dailyLoss']) inputs[key].value=data.config[key] ?? '';
      inputs.mode.value=data.config.mode==='auto'?'auto':'manual';
      configLoaded=true;
    }
    const market=data.market;
    const quoteOld=market?.time && Date.now()-market.time>90000;
    put(el.ask,money(market?.ask)); put(el.bid,money(market?.bid));
    put(el.scanTime,market ? 'עדכון ציטוט '+time(market.time)+(quoteOld?' · ציטוט ישן':'')+' · סגירת נר '+time(market.lastClosedAt) : 'ממתין לסריקת שוק');
    const pos=data.position;
    put(el.size,numeric(pos?.qty)===null?'—':quantity(pos.qty)+' ETH');
    put(el.net,money(pos?.dailyNet));
    const proposal=data.proposal;
    const expired=proposal && Number(proposal.expiresAt)<=Date.now();
    approvalId=proposal?.id || '';
    if (proposal) {
      const lines=[
        side(proposal.side)+' · '+quantity(proposal.quantity)+' ETH',
        'מחיר הגבלה '+money(proposal.limitPrice)+' · '+(proposal.agent||''),
        proposal.reason||'',
        (expired?'פג תוקף ב־':'תקף עד ')+time(proposal.expiresAt)
      ];
      const signature=JSON.stringify(lines);
      if (el.offer.dataset.proposal!==signature) {
        el.offer.dataset.proposal=signature;
        el.offer.className='ed-offer';
        el.offer.replaceChildren(...lines.filter(Boolean).map((line,index)=>{
          const node=document.createElement(index===0?'h3':'p');
          node.textContent=line;
          return node;
        }));
      }
    } else {
      el.offer.className='ed-empty';
      el.offer.dataset.proposal='';
      put(el.offer,'אין הצעה שממתינה לאישור.');
    }
    const busy=inFlight>0;
    buttons.approve.hidden=!proposal;
    buttons.approve.disabled=busy||stale||!data.connected||!data.running||data.locked||!proposal||expired||data.config?.mode!=='manual';
    if(proposal)put(buttons.approve, 'אישור '+side(proposal.side)+' בחשבון הדמו');
    buttons.connect.disabled=busy||!data.configured;
    buttons.scan.disabled=busy;
    buttons.start.disabled=busy||stale||!data.connected||data.running||data.locked;
    // Stop is an independent request. It must reach the server latch even during an approval or outage.
    buttons.stop.disabled=pending==='stop';
    for (const key of ['mode','budget','maxPosition','dailyLoss']) inputs[key].disabled=busy||Boolean(data.running);
    const signals=data.signals||[];
    table(el.signals,[['סוכן',r=>r.name||r.agent],['החלטה',r=>r.action==='buy'?'קנייה':r.action==='wait'?'המתנה':r.action],['נימוק',r=>r.reason]],signals,'טרם התקבלו אותות.');
    const wallet=data.wallet;
    put(el.walletTime,data.walletAt?'עדכון אחרון '+time(data.walletAt)+(Date.now()-data.walletAt>120000?' · נתוני ארנק קודמים':''):'טרם התקבלה יתרה מהבורסה');
    table(el.wallet,[['מטבע',r=>r.coin],['יתרה',r=>quantity(r.wallet)],['זמין',r=>quantity(r.available)]],wallet?['ETH','USDT'].filter(coin=>wallet[coin]).map(coin=>({coin,...wallet[coin]})):[],'יתרות יתעדכנו לאחר חיבור לחשבון הדמו.');
    table(el.position,[['נתון',r=>r[0]],['ערך',r=>r[1]]],pos?[
      ['כמות ETH',quantity(pos.qty)],['מחיר כניסה ממוצע',pos.qty>0?money(pos.avgPrice):'—'],
      ['רווח ממומש',money(pos.realized)],['רווח פתוח',money(pos.unrealized)]
    ]:[],'אין נתוני פוזיציה זמינים.');
    table(el.orders,[
      ['זמן',r=>time(r.createdAt)],['פעולה',r=>side(r.side)],['כמות ETH',r=>quantity(r.quantity)],
      ['בוצע',r=>quantity(r.filledQty)],['מחיר ממוצע',r=>money(r.avgPrice)],['סטטוס',r=>statuses[r.status]||r.status]
    ],data.orders||[],'הוראות הדסק יופיעו כאן לאחר שליחה.');
    table(el.fills,[
      ['זמן',r=>time(r.time)],['פעולה',r=>side(r.side)],['כמות ETH',r=>quantity(r.quantity)],
      ['מחיר',r=>money(r.price)],['עמלה',r=>quantity(r.fee)+' '+(r.feeCurrency||'')]
    ],data.fills||[],'טרם התקבל דיווח ביצוע.');
    table(el.journal,[['זמן',r=>time(r.time)],['אירוע',r=>r.message]],data.journal||[],'אירועי החיבור, האסטרטגיות והביצוע יופיעו כאן.');
    if(data.error && !pending && !el.feedback.dataset.action) put(el.feedback,data.error);
    else if(!data.error && !pending && !el.feedback.dataset.action) put(el.feedback,'');
  }
  function schedule() {
    clearTimeout(pollTimer);
    if(visible&&!disposed&&!document.hidden&&!inFlight) pollTimer=setTimeout(refresh,3500);
  }
  async function refresh() {
    if(!visible||document.hidden||disposed||request||inFlight)return;
    const abort=new AbortController();
    request=abort;
    const timeout=setTimeout(()=>abort.abort(),10000);
    try {
      const response=await fetch(endpoint,{cache:'no-store',signal:abort.signal});
      if(!response.ok)throw Error();
      const data=await response.json();
      if(disposed||request!==abort)return;
      if(typeof data?.configured!=='boolean')throw Error();
      state=data;receipt=Date.now();readError='';
    } catch {
      if(!disposed&&request===abort)readError='השרת המקומי אינו זמין. הנתונים המוצגים הם מהעדכון האחרון.';
    } finally {
      clearTimeout(timeout);
      if(request===abort){request=null;if(!disposed){render();schedule();}}
    }
  }
  async function act(action, payload={}) {
    if(disposed||buttons[action].disabled||(inFlight&&action!=='stop'))return;
    const version=++actionVersion;
    inFlight++;
    const activeRequest=request; request=null; activeRequest?.abort();
    clearTimeout(pollTimer);
    pending=action;
    const message={connect:'בודק את החיבור…',start:'מבקש להפעיל את הדסק…',stop:'מבקש לעצור את הדסק…',scan:'סורק מחירי ETH…',approve:'שולח אישור…'};
    el.feedback.dataset.action='true';put(el.feedback,message[action]);render();
    let timedOut=false;
    const abort=new AbortController();
    const limit=setTimeout(()=>{timedOut=true;abort.abort();},30000);
    try{
      const response=await fetch(endpoint+'/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload}),signal:abort.signal});
      const result=await response.json();
      if(!response.ok)throw Error(typeof result.error==='string'?result.error:'הפעולה לא הצליחה.');
      if(typeof result?.configured!=='boolean')throw Error('התקבלה תשובה לא מוכרת מהשרת.');
      if(disposed||version!==actionVersion)return;
      state=result;receipt=Date.now();readError='';
      delete el.feedback.dataset.action;
      put(el.feedback,state.error||'');
    } catch(error){
      if(disposed||version!==actionVersion)return;
      put(el.feedback,timedOut?'השרת לא השיב בזמן. מצב הפעולה ייבדק מול השרת.':error instanceof TypeError?'החיבור לשרת נקטע. מצב הפעולה ייבדק מחדש.':error.message);
      readError='בודק את מצב הדסק אחרי בקשת הפעולה.';
    } finally {
      clearTimeout(limit);inFlight--;
      if(version===actionVersion)pending='';
      if(!disposed){render();refresh();}
    }
  }
  el.params.onsubmit=event=>{
    event.preventDefault();
    const values=Object.fromEntries(['budget','maxPosition','dailyLoss'].map(key=>[key,inputs[key].valueAsNumber]));
    if(Object.values(values).some(value=>!Number.isFinite(value)||value<=0)||values.maxPosition>values.budget) {
      el.feedback.dataset.action='true';put(el.feedback,'הזינו שלוש מגבלות חיוביות. תקרת הפוזיציה צריכה להיות לכל היותר תקציב הדסק.');return;
    }
    act('start',{...values,mode:inputs.mode.value});
  };
  for(const command of ['connect','scan','stop'])buttons[command].onclick=()=>act(command);
  buttons.approve.onclick=()=>{
    if(state?.proposal?.id===approvalId && approvalId && Date.now()<state.proposal.expiresAt)act('approve',{proposalId:approvalId});
    else {render();refresh();}
  };
  function suspend() {
    clearTimeout(pollTimer);
    const prev=request;request=null;prev?.abort();
  }
  const visibilityChanged=()=>{
    if(document.hidden)suspend();
    else if(visible&&!disposed)refresh();
  };
  document.addEventListener('visibilitychange',visibilityChanged);
  render();
  return {
    setVisible(value){
      if(disposed||visible===Boolean(value))return;
      visible=Boolean(value);
      if(visible){render();refresh();}else suspend();
    },
    destroy(){disposed=true;suspend();document.removeEventListener('visibilitychange',visibilityChanged);root.replaceChildren();}
  };
}

