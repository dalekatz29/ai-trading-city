import {randomUUID} from 'node:crypto';
import {createBybitDemo, newDemoOrderId} from './bybit-demo.mjs';
import {fetchEthMarket, fetchEthMidnightMark, evaluateEthSignals, selectEthSetup} from './eth-signals.mjs';
import {loadDemoCredentials, hasDemoCredentials, readLedger, writeLedger} from './eth-store.mjs';

const terminal = new Set(['Filled', 'Cancelled', 'Canceled', 'PartiallyFilledCanceled', 'PartiallyFilledCancelled', 'Rejected', 'Deactivated']);
const utcDay = time => new Date(time).toISOString().slice(0, 10);
const tolerance = 1e-9;
function check(condition, message) { if (!condition) throw Error(message); }

function rounded(value, stepStr, up = false) {
  const step = Number(stepStr);
  const decimals = Math.max(0,(String(stepStr).split('.')[1] || '').length);
  const units = up ? Math.ceil(value / step) : Math.floor(value / step);
  return (units * step).toFixed(decimals);
}

// Cost basis and P&L include only broker-confirmed fills that belong to this application.
function inventory(orders, bid, now, before = Infinity) {
  let qty = 0, cost = 0, realized = 0, today = 0, openedAt = 0;
  for (const order of orders) {
    for (const fill of order.fills) {
      if (fill.time >= before) continue;
      const {quantity, price, feeCurrency, fee} = fill;
      check(feeCurrency === 'ETH' || feeCurrency === 'USDT', 'מטבע העמלה אינו נתמך. נדרש בירור לפני מסחר נוסף.');
      const quoteFee = feeCurrency === 'USDT' ? fee : 0;
      const baseFee = feeCurrency === 'ETH' ? fee : 0;
      if (fill.side === 'Buy') {
        if (qty < tolerance) openedAt = fill.time;
        qty += quantity - baseFee;
        cost += quantity * price + quoteFee;
      } else {
        const removed = quantity + baseFee;
        check(qty > 0 && removed <= qty + tolerance, 'ביצוע מכירה חורג מהכמות שנרכשה בדסק.');
        const book = cost * Math.min(1, removed / qty);
        const gain = quantity * price - quoteFee - book;
        realized += gain;
        if (utcDay(fill.time) === utcDay(now)) today += gain;
        qty -= removed;
        cost -= book;
        if (qty < tolerance) { qty = 0; cost = 0; openedAt = 0; }
      }
    }
  }
  const unrealized = qty === 0 ? 0 : bid ? qty * bid - cost : null;
  return {qty, cost, openedAt, avgPrice:qty ? cost / qty : 0, realized, unrealized,
    dailyNet:unrealized === null ? null : today + unrealized};
}

export async function createEthEngine({
  makeBroker=createBybitDemo, fetchMarket=fetchEthMarket, evaluateSignals=evaluateEthSignals,
  selectSetup=selectEthSetup, loadCredentials=loadDemoCredentials, configured=hasDemoCredentials,
  read=readLedger, save=writeLedger, now=Date.now, makeId=newDemoOrderId, midnightMark=fetchEthMidnightMark
} = {}) {
  let db = {version:1, fingerprint:null, config:null, lastEntryBar:0, orders:[], journal:[], lossDay:null};
  let corrupt = false, locked = false, connected = false, running = false, error = null;
  let market = null, signals = [], broker = null, filters = null, wallet = null, walletAt = null, proposal = null;
  let queue = Promise.resolve(), stopEpoch = 0, pendingTick = false, stopLatch = false;
  try {
    const stored = await read();
    if (stored) {
      check(stored.version === 1 && Array.isArray(stored.orders) && Array.isArray(stored.journal) &&
        stored.orders.every(order => typeof order.clientId === 'string' && Array.isArray(order.fills)), 'invalid ledger');
      inventory(stored.orders, null, now());
      db = stored;
      if (db.orders.some(order => !order.settled)) {
        locked = true; error = 'יש הוראה שממתינה לאימות אחרי הפעלה מחדש.';
      }
    }
  } catch {
    corrupt = locked = true;
    error = 'יומן המסחר המקומי אינו קריא. יש לבדוק אותו לפני שליחת הוראות.';
  }

  function event(message) {
    db.journal.push({time:now(), message});
    if (db.journal.length > 250) db.journal.shift();
  }
  function freeze(message) {
    running = connected = false;
    proposal = null;
    locked = true; error = message;
    event(message);
  }
  async function persist() {
    try { await save(db); }
    catch { corrupt = true; freeze('שמירת יומן הדמו נכשלה. שליחת הוראות נחסמה.'); throw Error(error); }
  }
  function position() {
    const stamp=now(), day=utcDay(stamp);
    const pos=inventory(db.orders,market?.quote.bid,stamp);
    const preceding=inventory(db.orders,null,stamp,Date.parse(day+'T00:00:00Z'));
    const midnight=db.mark?.day===day ? db.mark.price : null;
    const openEquity = preceding.qty===0 ? preceding.realized : midnight ?
      preceding.realized+preceding.qty*midnight-preceding.cost : null;
    pos.dailyNet=(openEquity===null || pos.unrealized===null) ? null : pos.realized+pos.unrealized-openEquity;
    return pos;
  }
  async function ensureMidnightMark() {
    const stamp=now(), day=utcDay(stamp), boundary=Date.parse(day+'T00:00:00Z');
    if (db.mark?.day === day || inventory(db.orders,null,stamp,boundary).qty === 0) return;
    const price=market.candles.find(c=>c.time===boundary-60000)?.close ?? await midnightMark(boundary);
    check(Number.isFinite(price) && price>0,'חסר מחיר מאומת לחישוב הפסד יומי.');
    db.mark={day,price};
    await persist();
  }
  function view() {
    return {configured:configured(), connected, running, locked, error, wallet, walletAt, config:db.config,
      market:market && {...market.quote, lastClosedAt:market.lastClosedAt}, signals,
      position:position(), proposal:proposal && proposal.expiresAt > now() ? proposal : null,
      orders:db.orders.slice(-100).reverse().map(({fills, ...rest})=>rest),
      fills:db.orders.flatMap(order=>order.fills).slice(-120).reverse(), journal:db.journal.slice(-80).reverse()};
  }
  function enqueue(task) {
    const result = queue.then(task);
    queue = result.catch(()=>{});
    return result;
  }
  async function readMarket() {
    market = await fetchMarket();
    signals = evaluateSignals(market.candles,market.serverTime);
  }
  async function syncBroker() {
    for (const order of db.orders.filter(order=>!order.settled)) {
      const actual = await broker.getOrder(order.clientId);
      if (!actual) {
        check(order.orderId && now() - order.createdAt < 15000,
          'טרם אותרה ההוראה ביומן Bybit. הדסק נעול עד לאימות מול הבורסה.');
        continue;
      }
      check(actual.clientId === order.clientId && actual.side === order.side &&
        (!order.orderId || actual.orderId === order.orderId) &&
        Math.abs(Number(actual.quantity) - Number(order.quantity)) < tolerance,
        'זהות ההוראה או הכמות לא תואמות ליומן הדסק.');
      const fills = await broker.getExecutions(order.clientId);
      const ids = new Set(fills.map(fill=>fill.execId));
      check(ids.size === fills.length && order.fills.every(stored=>ids.has(stored.execId)) &&
        fills.every(fill=>fill.clientId === order.clientId && fill.orderId === actual.orderId && fill.side === order.side),
        'רשימת הביצועים של Bybit אינה תואמת ליומן.');
      const filled = fills.reduce((sum,fill)=>sum+fill.quantity,0);
      check(filled <= Number(order.quantity) + tolerance, 'סך הביצועים חורג מההוראה.');
      const proposed = {...order,orderId:actual.orderId,status:actual.status,filledQty:actual.filledQty,avgPrice:actual.avgPrice,fills};
      inventory(db.orders.map(stored => stored === order ? proposed : stored), market?.quote.bid, now());
      Object.assign(order,proposed);
      const wasSettled = order.settled;
      order.settled = terminal.has(actual.status) && Math.abs(filled - actual.filledQty) < tolerance;
      if (order.settled && !wasSettled) event('אימות מול Bybit: ' + actual.status + ' · ' + filled + ' ETH');
      await persist();
      if (order.cancelWanted && !terminal.has(actual.status)) {
        await broker.cancelOrder(order.clientId);
        event('בקשת ביטול הועברה ל־Bybit.');
      }
    }
    wallet = await broker.getBalances();
    walletAt = now();
  }
  async function reconcile() {
    try { await syncBroker(); }
    catch (err) {
      freeze('האימות מול Bybit הופסק. ' + err.message);
      if (!corrupt) await persist();
      throw Error(error);
    }
  }
  async function connect() {
    running = false; proposal = null; connected = false;
    check(!corrupt, error);
    check(configured(),'תחילה יש להזין מפתח דמו במחשב באמצעות קובץ ההגדרה.');
    try {
      const credentials = await loadCredentials();
      check(typeof credentials.fingerprint === 'string' && credentials.fingerprint.length > 0, 'לא ניתן לזהות את מפתח הדמו.');
      check(!db.fingerprint || db.fingerprint === credentials.fingerprint || db.orders.length === 0,
        'המפתח שונה מזה המשויך ליומן. נדרשת התאמה ידנית לחשבון הקודם.');
      broker = makeBroker(credentials);
      filters = await broker.getInstrument();
      await reconcile();
      db.fingerprint = credentials.fingerprint;
      await persist();
      connected = true; locked = false; error = null; stopLatch = false;
      event('חשבון Bybit Demo אומת והיתרות עודכנו.');
    } catch (err) {
      broker = null; freeze(err.message); throw err;
    }
  }
  function riskCheck() {
    const pos = position();
    check(pos.dailyNet !== null,'חסר מחיר מאומת לחישוב הפסד יומי.');
    if (pos.dailyNet <= -db.config.dailyLoss || db.lossDay === utcDay(now())) {
      db.lossDay = utcDay(now());
      running = false; proposal = null;
      error = 'סף ההפסד היומי הופעל. אי אפשר לשלוח הוראות נוספות היום (UTC).';
      event(error);
      return false;
    }
    return true;
  }
  function plan() {
    if (!running || !connected || locked || stopLatch || db.orders.some(order=>!order.settled)) return null;
    if (!riskCheck()) return null;
    const {bid,ask} = market.quote;
    const pos = inventory(db.orders, bid, now());
    const sellLimit = rounded(bid * 0.999,filters.tickSize);
    const canSell = pos.qty >= Number(filters.minQty) && pos.qty * Number(sellLimit) >= Number(filters.minAmount);
    let side, quantity, limitPrice, agent, reason;
    if (canSell) {
      const move = bid / pos.avgPrice - 1;
      if (move < .0035 && move > -.0025 && now()-pos.openedAt < 300000) return null;
      side = 'Sell'; agent = 'מנהל היציאה';
      reason = move >= .0035 ? 'יעד 0.35%' : move <= -.0025 ? 'עצירה 0.25%' : 'חלפו חמש דקות מהביצוע הראשון';
      limitPrice = sellLimit;
      quantity = rounded(Math.min(pos.qty, wallet.ETH.available, Number(filters.maxLimitQty)), filters.qtyStep);
    } else {
      const setup = selectSetup(signals);
      if (!setup || db.lastEntryBar === market.lastClosedAt) return null;
      side = 'Buy'; agent = setup.name; reason = setup.reason;
      limitPrice = rounded(ask * 1.001, filters.tickSize, true);
      const cap = Math.max(0,Math.min(wallet.USDT.available, db.config.budget + Math.min(0,pos.realized) - pos.cost, db.config.maxPosition - pos.qty * ask));
      quantity = rounded(Math.min(cap / (Number(limitPrice)*1.005), Number(filters.maxLimitQty)), filters.qtyStep);
    }
    if (Number(quantity) < Number(filters.minQty) || quantity * Number(limitPrice) < Number(filters.minAmount)) return null;
    return {id:randomUUID(), side, agent, reason, quantity, limitPrice, signalBar:market.lastClosedAt, expiresAt:now()+30000};
  }
  async function send(candidate, epoch) {
    check(!stopLatch && epoch === stopEpoch && running && connected && !locked, 'השליחה נעצרה.');
    check(now() - market.quote.time < 15000 && now() - walletAt < 20000, 'המחיר או היתרה אינם עדכניים. סרקו שוב.');
    const row = {clientId:makeId(), orderId:null, side:candidate.side, agent:candidate.agent,
      quantity:candidate.quantity, limitPrice:candidate.limitPrice, createdAt:now(), status:'Submitting',filledQty:0,avgPrice:0,settled:false,fills:[]};
    db.orders.push(row);
    if (row.side === 'Buy') db.lastEntryBar = candidate.signalBar;
    proposal = null; event('נשמרה כוונת שליחה: ' + row.side + ' ' + row.quantity + ' ETH.');
    await persist();
    if (epoch !== stopEpoch || stopLatch) { row.status='Cancelled'; row.settled=true; await persist(); return; }
    try {
      const ack = await broker.createOrder(row, () => {
        if (epoch !== stopEpoch || stopLatch || !running || now()-market.quote.time >= 15000) {
          throw Object.assign(Error('ההוראה בוטלה מקומית לפני שליחה.'), {definitiveRejection:true});
        }
      });
      row.orderId = ack.orderId; row.status = 'Acknowledged'; event('Bybit קיבלה את ההוראה. ממתינים לדיווח ביצוע.');
    } catch (err) {
      if (err.notSent) {
        row.status='NotSent'; row.settled=true; freeze('ההוראה לא נשלחה. יש לבדוק את החיבור מחדש.');
      } else if (err.definitiveRejection) {
        row.status='Rejected'; row.settled=true; event('Bybit דחתה את ההוראה: ' + err.message);
      } else {
        row.status='Unknown'; freeze('לא ברור אם ההוראה התקבלה. לא תישלח הוראה נוספת עד לאימות.');
      }
      await persist(); throw Error(error || 'ההוראה נדחתה ב־Bybit.');
    }
    await persist();
  }
  async function scan(epoch, approveId = null) {
    const original = proposal;
    if (approveId) {
      check(running && connected && !locked && db.config?.mode === 'manual' &&
        original?.id === approveId && original.expiresAt > now(),'ההצעה אינה זמינה לאישור. סרקו שוב.');
    }
    if (connected) await reconcile();
    try { await readMarket(); if (running) await ensureMidnightMark(); } catch (err) {
      if (running) freeze('נתוני השוק אינם עדכניים. ' + err.message);
      else error = err.message;
      proposal = null; throw err;
    }
    if (!locked) error = null;
    if (epoch !== stopEpoch || stopLatch) return;
    const candidate = plan();
    if (!candidate) {
      proposal = null;
      if (db.lossDay === utcDay(now())) await persist();
      check(!approveId, 'ההצעה אינה עומדת עוד בתנאי המסחר.');
      return;
    }
    const same = original?.expiresAt > now() && original.side === candidate.side && original.agent === candidate.agent &&
      original.signalBar === candidate.signalBar && original.reason === candidate.reason;
    if (approveId) {
      const pos = inventory(db.orders,market.quote.bid,now());
      const approvedQty = Number(original.quantity), approvedPrice = Number(original.limitPrice);
      const safeTerms = candidate.side === 'Buy'
        ? market.quote.ask <= approvedPrice && approvedQty*approvedPrice*1.005 <=
          Math.min(wallet.USDT.available,db.config.budget+Math.min(0,pos.realized)-pos.cost,db.config.maxPosition-pos.qty*market.quote.ask)+tolerance
        : market.quote.bid >= approvedPrice && approvedQty <= Math.min(pos.qty,wallet.ETH.available)+tolerance;
      if (!same || !safeTerms) {
        proposal=candidate; throw Error('המחיר, הכמות או האות השתנו. נדרש אישור להצעה החדשה.');
      }
      await send(original,epoch);
    } else if (db.config.mode === 'auto') await send(candidate,epoch);
    else if (!same) proposal = candidate;
  }
  async function stop() {
    event('עצירה: נחסמו הוראות חדשות. פוזיציה קיימת נשארת בחשבון הדמו.');
    for (const row of db.orders.filter(order=>!order.settled)) row.cancelWanted = true;
    if (!corrupt) await persist();
    if (broker && !corrupt) await reconcile();
  }
  async function start(cmd, epoch) {
    check(connected && !locked && !corrupt && !running, 'נדרש חיבור דמו מאומת ודסק במצב המתנה.');
    check(['manual','auto'].includes(cmd.mode) && [cmd.budget,cmd.maxPosition,cmd.dailyLoss].every(x=>typeof x === 'number' && Number.isFinite(x) && x>0) &&
      cmd.maxPosition <= cmd.budget && cmd.dailyLoss <= cmd.budget, 'המגבלות חייבות להיות חיוביות ובתוך התקציב.');
    check(db.lossDay !== utcDay(now()), 'הדסק נעול להיום עקב הפסד יומי.');
    await reconcile();
    await readMarket();
    await ensureMidnightMark();
    const pos = inventory(db.orders,market.quote.bid,now());
    check(!db.orders.some(order=>!order.settled) && cmd.budget >= pos.cost && cmd.maxPosition >= pos.qty * market.quote.ask,
      'קיימת הוראה לא סופית או פוזיציה מעבר למגבלות שבחרת.');
    const entryFunds = Math.min(cmd.budget+Math.min(0,pos.realized)-pos.cost, cmd.maxPosition-pos.qty*market.quote.ask, wallet.USDT.available);
    check(pos.qty*market.quote.bid >= Number(filters.minAmount) || entryFunds >= Number(filters.minAmount)*1.005,
      'היתרה הפנויה או התקציב אינם מכסים הוראת דמו מינימלית ומרווח עלויות. מינימום הבורסה: '+filters.minAmount+' USDT.');
    check(epoch === stopEpoch, 'ההפעלה בוטלה בעצירת החירום.');
    db.config = {mode:cmd.mode,budget:cmd.budget,maxPosition:cmd.maxPosition,dailyLoss:cmd.dailyLoss};
    stopLatch=false; error=null; proposal=null;
    running=riskCheck();
    if (running) event('הדסק הופעל במצב ' + (cmd.mode==='auto'?'אוטונומי':'אישור ידני') + '.');
    await persist();
  }
  async function act(cmd) {
    if (cmd.action === 'stop') { stopEpoch++; stopLatch=true; running=false; proposal=null; }
    const epoch=stopEpoch;
    return enqueue(async()=>{
      if (cmd.action === 'connect') await connect();
      else if (cmd.action === 'stop') await stop();
      else if (cmd.action === 'start') await start(cmd,epoch);
      else if (cmd.action === 'approve') { check(typeof cmd.proposalId==='string' && cmd.proposalId.length>0,'חסר מזהה הצעה.'); await scan(epoch,cmd.proposalId); }
      else if (cmd.action === 'scan') await scan(epoch);
      else throw Error('הפעולה אינה מוכרת.');
      return view();
    });
  }
  async function tick() {
    if (pendingTick || (!running && !(connected && db.orders.some(order=>!order.settled)))) return;
    pendingTick=true;
    const epoch=stopEpoch;
    try { await enqueue(async()=>{if(running) await scan(epoch); else if(connected) await reconcile();}); }
    finally { pendingTick=false; }
  }
  return {view,act,tick};
}
