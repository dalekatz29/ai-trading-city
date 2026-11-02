import { createHmac, randomBytes } from 'node:crypto';

const DEMO_ORIGIN = 'https://api-demo.bybit.com';
const MARKET = Object.freeze({ category: 'spot', symbol: 'ETHUSDT' });
const WINDOW = '5000';
const ORDER_STATES = new Set(['Created', 'New', 'PartiallyFilled', 'Filled', 'PartiallyFilledCanceled', 'Cancelled', 'Rejected', 'PendingCancel']);
const CREATE_REJECTIONS = new Set([170105, 170115, 170116, 170117, 170121, 170124, 170130, 170131,
  170132, 170133, 170134, 170136, 170137, 170140, 170157, 170192, 170193, 170194, 170210, 170381, 170382]);
const ownId = /^city-demo-[0-9a-f]{24}$/;
const exchangeId = /^[\w-]{1,80}$/;
const amountPattern = /^-?(?:0|[1-9]\d{0,29})(?:\.\d{1,20})?$/;

export function newDemoOrderId() {
  return 'city-demo-' + randomBytes(12).toString('hex');
}

function check(ok, message = 'Invalid Bybit Demo response') {
  if (!ok) throw new Error(message);
}

function decimal(value, { positive = false, signed = false } = {}) {
  check(typeof value === 'string' || typeof value === 'number', 'Invalid decimal amount');
  const s = String(value);
  check(amountPattern.test(s) && Number.isFinite(Number(s)), 'Invalid decimal amount');
  check((signed || Number(s) >= 0) && (!positive || Number(s) > 0), 'Invalid decimal amount');
  return s;
}

// Exchange filters must be checked in decimal units, including minimum notional.
function fraction(value) {
  const [whole, part = ''] = value.split('.');
  return { units: BigInt(whole + part), scale: 10n ** BigInt(part.length) };
}

function aligned(value, step) {
  const a = fraction(value), b = fraction(step);
  return (a.units * b.scale) % (a.scale * b.units) === 0n;
}

function compare(a, b) {
  return a.units * b.scale - b.units * a.scale;
}

function verifiedClientId(id) {
  check(typeof id === 'string' && ownId.test(id), 'Invalid city demo order ID');
  return id;
}

function verifiedSide(side) {
  check(side === 'Buy' || side === 'Sell', 'Invalid spot side');
  return side;
}

function acknowledged(value, id) {
  check(value?.orderLinkId === id && typeof value.orderId === 'string' && exchangeId.test(value.orderId));
  return { clientId: id, orderId: value.orderId };
}

function spotList(result) {
  check(result?.category === 'spot' && Array.isArray(result.list));
  return result.list;
}

function timestamp(value) {
  const n = Number(decimal(value, { positive: true }));
  check(Number.isSafeInteger(n));
  return n;
}

function uncertain(message) {
  return Object.assign(new Error(message), { uncertain: true });
}

export function createBybitDemo({ apiKey, apiSecret, fetchImpl = fetch, now = Date.now } = {}) {
  check(typeof apiKey === 'string' && /^[\x21-\x7e]+$/.test(apiKey) &&
    typeof apiSecret === 'string' && /^[\x21-\x7e]+$/.test(apiSecret), 'Demo credentials required');

  async function request(path, params, { write = false, signed = true } = {}) {
    const data = write ? JSON.stringify(params) : new URLSearchParams(params).toString();
    const url = DEMO_ORIGIN + path + (write ? '' : '?' + data);
    const headers = { Accept: 'application/json' };
    if (signed) {
      const time = String(now());
      Object.assign(headers, {
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-TIMESTAMP': time,
        'X-BAPI-RECV-WINDOW': WINDOW,
        'X-BAPI-SIGN': createHmac('sha256', apiSecret).update(time + apiKey + WINDOW + data).digest('hex'),
      });
    }
    if (write) headers['Content-Type'] = 'application/json';
    let response, payload;
    try {
      response = await fetchImpl(url, { method: write ? 'POST' : 'GET', headers, ...(write ? { body: data } : {}),
        redirect: 'error', signal: AbortSignal.timeout(8000), cache: 'no-store' });
      if (!response.ok) throw new Error();
      payload = await response.json();
    } catch {
      const message = 'Bybit Demo request could not be verified';
      throw write ? uncertain(message) : new Error(message);
    }
    if (!Number.isInteger(payload?.retCode)) {
      throw write ? uncertain('Invalid Bybit Demo acknowledgement') : new Error('Invalid Bybit Demo response');
    }
    if (payload.retCode !== 0) {
      const error = new Error('Bybit Demo returned code ' + payload.retCode);
      error.bybitCode = payload.retCode;
      // A timeout, duplicate or service restart can follow an accepted submission.
      if (path === '/v5/order/create' && CREATE_REJECTIONS.has(payload.retCode)) error.definitiveRejection = true;
      else if (write) error.uncertain = true;
      throw error;
    }
    if (!payload.result || Array.isArray(payload.result) || typeof payload.result !== 'object') {
      throw write ? uncertain('Invalid Bybit Demo acknowledgement') : new Error('Invalid Bybit Demo response');
    }
    return payload.result;
  }

  async function getBalances() {
    const result = await request('/v5/account/wallet-balance', { accountType: 'UNIFIED', coin: 'ETH,USDT' });
    check(Array.isArray(result.list) && result.list.length === 1);
    const account = result.list[0];
    check(account?.accountType === 'UNIFIED' && Array.isArray(account.coin) && account.coin.length > 0);
    const remaining = { ETH: { wallet: 0, available: 0 }, USDT: { wallet: 0, available: 0 } };
    const seen = new Set();
    // Account-wide margin is not reported for some modes. Do not spend on such an account.
    let restricted = account.totalInitialMargin == null || account.totalInitialMargin === '' ||
      Number(decimal(account.totalInitialMargin)) > 0;
    for (const c of account.coin) {
      check(c && Object.hasOwn(remaining, c.coin) && !seen.has(c.coin));
      seen.add(c.coin);
      const wallet = Number(decimal(c.walletBalance, { signed: true }));
      const equity = Number(decimal(c.equity, { signed: true }));
      const locked = Number(decimal(c.locked));
      const bonus = Number(decimal(c.bonus));
      for (const key of ['spotBorrow', 'borrowAmount', 'accruedInterest']) {
        if (Number(decimal(c[key])) > 0) restricted = true;
      }
      remaining[c.coin] = { wallet, available: Math.max(0, Math.min(wallet, equity) - locked - bonus) };
    }
    if (restricted) for (const balance of Object.values(remaining)) balance.available = 0;
    return remaining;
  }

  async function getInstrument() {
    const result = await request('/v5/market/instruments-info', MARKET, { signed: false });
    const list = spotList(result), row = list[0];
    check(list.length === 1 && row?.symbol === MARKET.symbol && row.baseCoin === 'ETH' &&
      row.quoteCoin === 'USDT' && row.status === 'Trading', 'ETHUSDT spot trading unavailable');
    const lot = row.lotSizeFilter;
    const positive = (v) => decimal(v, { positive: true });
    const qtyStep = positive(lot?.basePrecision);
    const maxLimitQty = positive(lot.maxLimitOrderQty ?? lot.maxOrderQty);
    return { tickSize: positive(row.priceFilter?.tickSize), qtyStep, minQty: qtyStep,
      minAmount: positive(lot.minOrderAmt), maxLimitQty,
      maxMarketQty: lot.maxMarketOrderQty == null ? null : positive(lot.maxMarketOrderQty) };
  }

  async function writeOrder(path, id, params) {
    const value = await request(path, params, { write: true });
    try { return acknowledged(value, id); }
    catch { throw uncertain('Bybit Demo returned an unverified order acknowledgement'); }
  }

  async function createOrder({ clientId, side, quantity, limitPrice }, beforeSubmit = () => {}) {
    const id = verifiedClientId(clientId);
    verifiedSide(side);
    const qty = decimal(quantity, { positive: true });
    const price = decimal(limitPrice, { positive: true });
    try {
      const filters = await getInstrument();
      const q = fraction(qty), p = fraction(price);
      const notional = { units: q.units * p.units, scale: q.scale * p.scale };
      check(aligned(qty, filters.qtyStep) && aligned(price, filters.tickSize), 'Order does not match ETHUSDT increments');
      check(compare(q, fraction(filters.maxLimitQty)) <= 0 && compare(notional, fraction(filters.minAmount)) >= 0,
      'Order falls outside ETHUSDT spot limits');
      beforeSubmit();
    } catch (err) { err.notSent = true; throw err; }
    return writeOrder('/v5/order/create', id, { ...MARKET, side, orderType: 'Limit', qty, price,
      timeInForce: 'IOC', isLeverage: 0, orderLinkId: id });
  }

  async function getOrder(clientId) {
    const id = verifiedClientId(clientId);
    const params = { ...MARKET, orderLinkId: id };
    for (const path of ['/v5/order/realtime', '/v5/order/history']) {
      const rows = spotList(await request(path, params));
      if (!rows.length) continue;
      const row = rows[0];
      check(rows.length === 1 && row?.symbol === MARKET.symbol && row.orderType === 'Limit' &&
        row.timeInForce === 'IOC' && String(row.isLeverage) === '0' && ORDER_STATES.has(row.orderStatus));
      const quantity = Number(decimal(row.qty, { positive: true }));
      const filledQty = Number(decimal(row.cumExecQty));
      const avgPrice = row.avgPrice === '' && !filledQty ? 0 : Number(decimal(row.avgPrice));
      check(filledQty <= quantity && (!filledQty || avgPrice > 0) && (row.orderStatus !== 'Filled' || filledQty === quantity));
      return { ...acknowledged(row, id), side: verifiedSide(row.side), status: row.orderStatus,
        quantity, limitPrice: Number(decimal(row.price, { positive: true })), filledQty, avgPrice, updatedAt: timestamp(row.updatedTime) };
    }
    return null; // Exchange history may lag. An empty result is not a rejected order.
  }

  async function getExecutions(clientId) {
    const id = verifiedClientId(clientId);
    const fills = new Map(), cursors = new Set();
    let cursor = '';
    for (let page = 0; page < 100; page++) {
      const result = await request('/v5/execution/list', { ...MARKET, orderLinkId: id, limit: '100', ...(cursor ? { cursor } : {}) });
      for (const row of spotList(result)) {
        check(row?.symbol === MARKET.symbol && row.execType === 'Trade' && typeof row.execId === 'string' &&
          exchangeId.test(row.execId) && typeof row.feeCurrency === 'string' && /^[A-Z0-9]{1,20}$/.test(row.feeCurrency));
        check(row.extraFees == null || row.extraFees === '' || (Array.isArray(row.extraFees) && !row.extraFees.length),
          'Additional execution fees require manual reconciliation');
        const fill = { ...acknowledged(row, id), execId: row.execId, side: verifiedSide(row.side),
          quantity: Number(decimal(row.execQty, { positive: true })), price: Number(decimal(row.execPrice, { positive: true })),
          fee: Number(decimal(row.execFee, { signed: true })), feeCurrency: row.feeCurrency, time: timestamp(row.execTime) };
        const prior = fills.get(fill.execId);
        check(!prior || JSON.stringify(prior) === JSON.stringify(fill));
        fills.set(fill.execId, fill);
      }
      cursor = result.nextPageCursor;
      check(typeof cursor === 'string' && cursor.length <= 2048 && !cursors.has(cursor));
      if (!cursor) return Array.from(fills.values()).sort((a, b) => a.time - b.time || a.execId.localeCompare(b.execId));
      cursors.add(cursor);
    }
    throw new Error('Bybit Demo execution history exceeded the reconciliation limit');
  }

  function cancelOrder(clientId) {
    const id = verifiedClientId(clientId);
    return writeOrder('/v5/order/cancel', id, { ...MARKET, orderLinkId: id });
  }

  return Object.freeze({ getBalances, getInstrument, createOrder, getOrder, getExecutions, cancelOrder });
}
