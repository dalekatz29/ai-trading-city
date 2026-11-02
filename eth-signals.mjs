/** Public ETH/USDT spot market. Prices use USDT per ETH, volume uses ETH.
 *  Bybit V5: /market/kline (newest first) and /market/tickers (top of book).
 */
const SYMBOL = 'ETHUSDT';
const MINUTE = 60_000;
const MIN_HISTORY = 22;
const MAX_CLOCK_AGE = 15_000;

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function readNumber(raw) {
  if (typeof raw === 'number') return raw;
  return typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
}

function checkHistory(candles) {
  requireValue(Array.isArray(candles) && candles.length >= MIN_HISTORY, 'חסרים נרות דקה סגורים לחישוב האותות.');
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    requireValue(candle && Number.isSafeInteger(candle.time) && candle.time > 0 && candle.time % MINUTE === 0, 'זמן נר הדקה אינו תקין.');
    const {open, high, low, close, volume} = candle;
    requireValue([open, high, low, close].every(price => Number.isFinite(price) && price > 0) &&
      low <= Math.min(open, close) && high >= Math.max(open, close) && Number.isFinite(volume) && volume >= 0,
      'מחיר או נפח לא תקינים בנרות ETH.');
    requireValue(i === 0 || candle.time - candles[i - 1].time === MINUTE, 'רצף נרות ETH מכיל דקה חסרה או כפולה.');
  }
}

async function requestMarket(path, request) {
  let response;
  try {
    response = await request('https://api.bybit.com/v5/market/' + path, {
      headers: {Accept: 'application/json'}, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(7000)
    });
  } catch {
    throw new Error('החיבור הציבורי ל־Bybit אינו זמין כעת.');
  }
  requireValue(response.ok, 'Bybit לא החזירה נתוני מסחר תקינים (HTTP ' + response.status + ').');
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error('התקבלה מ־Bybit תשובה שאינה נתוני מסחר.'); }
  requireValue(payload?.retCode === 0 && payload.result?.category === 'spot' && Array.isArray(payload.result.list),
    'בקשת נתוני הספוט ל־Bybit נכשלה.');
  requireValue(Number.isSafeInteger(payload.time) && payload.time > 0, 'שעון השרת של Bybit אינו תקין.');
  return payload;
}

/** Optional request and now arguments allow deterministic replay of HTTP fixtures in tests. */
export async function fetchEthMarket({request = fetch, now = Date.now} = {}) {
  const [bars, book] = await Promise.all([
    requestMarket('kline?category=spot&symbol=ETHUSDT&interval=1&limit=121', request),
    requestMarket('tickers?category=spot&symbol=ETHUSDT', request)
  ]);
  const observedAt = now();
  for (const {time} of [bars, book]) {
    requireValue(observedAt - time <= MAX_CLOCK_AGE && time - observedAt <= 2000,
      'חותמת הזמן של Bybit ישנה או שהשעון המקומי אינו מסונכרן.');
  }
  const serverTime = Math.max(book.time, bars.time);
  requireValue(bars.result.symbol === SYMBOL && book.result.list.length === 1 && book.result.list[0]?.symbol === SYMBOL,
    'הסמל שהתקבל מ־Bybit אינו ETHUSDT.');
  const ticker = book.result.list[0];
  const bid = readNumber(ticker.bid1Price);
  const ask = readNumber(ticker.ask1Price);
  requireValue(Number.isFinite(ask) && Number.isFinite(bid) && bid > 0 && ask >= bid, 'מחירי הקנייה והמכירה של ETH אינם תקינים.');

  const rows = bars.result.list.map(row => {
    requireValue(Array.isArray(row) && row.length >= 6, 'מבנה נר ETH אינו תקין.');
    const [time, open, high, low, close, volume] = row.slice(0, 6).map(readNumber);
    return {time, open, high, low, close, volume};
  }).reverse();
  checkHistory(rows);
  const currentMinute = Math.floor(bars.time / MINUTE) * MINUTE;
  requireValue(rows.at(-1).time <= currentMinute, 'התקבל נר ETH עם זמן התחלה עתידי.');
  // Bybit includes the current (unclosed) candle. It must never become an agent input.
  const candles = rows.filter(candle => candle.time + MINUTE <= bars.time);
  checkHistory(candles);
  const lastClosedAt = candles.at(-1).time + MINUTE;
  requireValue(lastClosedAt === Math.floor(serverTime / MINUTE) * MINUTE && book.time >= lastClosedAt,
    'נר הדקה הסגור האחרון והציטוט העדכני עדיין אינם זמינים יחד.');
  return {
    symbol: SYMBOL, source: 'Bybit Spot', interval: '1m', serverTime, lastClosedAt, candles,
    quote: {bid, ask, time: book.time}
  };
}

const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const priceText = value => value.toFixed(2);
const pctText = value => value.toFixed(3) + '%';

/** Evaluate one confirmed ETH minute; timestamps are candle opens in milliseconds.
 *  Pass an explicit asOf to replay historical data. No future or stale bars are accepted.
 */
export function evaluateEthSignals(candles, asOf = Date.now()) {
  checkHistory(candles);
  const current = candles.at(-1);
  const signalTime = current.time + MINUTE;
  requireValue(Number.isSafeInteger(asOf) && signalTime <= asOf && asOf - signalTime < MINUTE,
    'אין נר ETH סגור ועדכני לזמן ההחלטה.');
  const previous = candles.at(-2);
  const prior = candles.slice(-21, -1); // excludes signal candle
  const ranges = candles.slice(-16, -1);
  const atr = mean(ranges.slice(1).map((candle, i) => Math.max(
    candle.high - candle.low, Math.abs(candle.high - ranges[i].close), Math.abs(candle.low - ranges[i].close)
  )));
  const atrPct = 100 * atr / previous.close;
  const baseVolume = mean(prior.map(candle => candle.volume));
  const relativeVolume = baseVolume > 0 ? current.volume / baseVolume : 0;
  const unit = {price: current.close, signalTime, atrPct};
  const canSignal = current.volume > 0 && baseVolume > 0 && atr > 0;
  function signal(agent, id, name, condition, reason) {
    const action = canSignal && condition ? 'buy' : 'wait';
    if (!canSignal) reason = 'ממתין לנפח מסחר ולטווח מחירים מדידים. ' + reason;
    return {...unit, agent, id, name, action, reason};
  }

  const change3 = 100 * (current.close / candles.at(-4).close - 1);
  const momentumFloor = Math.max(0.10, 1.25 * atrPct);
  const momentum = signal(1, 'momentum', 'סקאלפ מומנטום ETH',
    change3 >= momentumFloor && current.close > previous.close && relativeVolume >= 1,
    'שינוי בשלוש דקות ' + pctText(change3) + ' מול סף ' + pctText(momentumFloor) +
    ', סגירה ' + priceText(current.close) + ' מול קודמת ' + priceText(previous.close) +
    ', ונפח פי ' + relativeVolume.toFixed(2) + ' מהממוצע (נדרש לפחות 1).');

  const priorHigh = Math.max(...prior.map(candle => candle.high));
  const breakoutLevel = priorHigh + Math.max(priorHigh * 0.00015, 0.15 * atr);
  const breakout = signal(2, 'breakout', 'סקאלפ פריצה ETH',
    current.close > breakoutLevel && relativeVolume >= 1.35,
    'שיא 20 הדקות הקודמות ' + priceText(priorHigh) + ', סף פריצה ' + priceText(breakoutLevel) +
    ' וסגירה ' + priceText(current.close) + '. הנפח פי ' + relativeVolume.toFixed(2) + ' (נדרש 1.35).');

  // Baseline ends two bars ago so a dip on the previous bar cannot move its own baseline.
  const meanBeforeDip = mean(candles.slice(-22, -2).map(candle => candle.close));
  const dipPct = 100 * (meanBeforeDip - previous.close) / meanBeforeDip;
  const dipFloor = Math.max(0.10, atrPct);
  const bouncePct = 100 * (current.close / previous.close - 1);
  const bounceFloor = Math.max(0.02, 0.2 * atrPct);
  const reversion = signal(3, 'reversion', 'סקאלפ התאוששות ETH',
    dipPct >= dipFloor && bouncePct >= bounceFloor && current.close < meanBeforeDip,
    'פער קודם מתחת לממוצע ' + pctText(dipPct) + ' (סף ' + pctText(dipFloor) +
    '), תיקון ' + pctText(bouncePct) + ' (סף ' + pctText(bounceFloor) + '). סגירה ' +
    priceText(current.close) + ' מול ממוצע ' + priceText(meanBeforeDip) + '.');
  return [momentum, breakout, reversion];
}

export function selectEthSetup(signals) {
  return signals.find(signal => signal.action === 'buy') ?? null;
}

// A carried position needs a UTC opening mark even after a long outage.
export async function fetchEthMidnightMark(boundary) {
  requireValue(Number.isSafeInteger(boundary) && boundary > 0 && boundary % 86400000 === 0, 'גבול היום אינו תקין.');
  const start = boundary - MINUTE;
  const payload = await requestMarket('kline?category=spot&symbol=ETHUSDT&interval=1&start='+start+'&end='+(boundary-1)+'&limit=1', fetch);
  const rows = payload.result.list;
  requireValue(payload.result.symbol === SYMBOL && payload.time >= boundary && rows.length === 1 &&
    readNumber(rows[0][0]) === start && readNumber(rows[0][4]) > 0, 'חסר נר סגירה מאומת בחצות UTC.');
  return readNumber(rows[0][4]);
}