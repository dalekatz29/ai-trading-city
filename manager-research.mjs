import {evaluateEthSignals, fetchEthMarket} from './eth-signals.mjs';

const MINUTE = 60_000;
const HISTORY = 22;
const STAKE = 25;
const FEE = 0.001;
const SLIPPAGE = 0.0002;

function estimatedProceeds(quantity, price) {
  return quantity * price * (1 - SLIPPAGE) * (1 - FEE);
}

function mark(account, price) {
  const value = account.position
    ? account.net + estimatedProceeds(account.position.quantity, price) - STAKE
    : account.net;
  account.peak = Math.max(account.peak, value);
  account.maxDrawdown = Math.max(account.maxDrawdown, account.peak - value);
}

function closePosition(account, price) {
  account.net += estimatedProceeds(account.position.quantity, price) - STAKE;
  account.position = null;
  account.trades++;
}

function shouldExit(position, candle) {
  const change = candle.close / position.costPerEth - 1;
  return change >= 0.0035 || change <= -0.0025 || candle.time + MINUTE - position.openedAt >= 5 * MINUTE;
}

/** Replay only closed bars. Each decision normally takes effect at the following open. */
export function replayEthStrategies(candles, asOf) {
  if (!Array.isArray(candles) || candles.length <= HISTORY || !Number.isSafeInteger(asOf)) {
    throw new Error('חסרים נרות ETH סגורים לתקופת ההרצה אחרי חימום האסטרטגיות.');
  }
  const end = candles.at(-1)?.time + MINUTE;
  if (!Number.isSafeInteger(end) || end > asOf || asOf - end >= MINUTE) {
    throw new Error('סוף תקופת הבדיקה אינו תואם לנר ETH הסגור האחרון.');
  }
  const accounts = new Map();
  for (let index = HISTORY - 1; index < candles.length; index++) {
    const candle = candles[index];
    const signals = evaluateEthSignals(candles.slice(index - HISTORY + 1, index + 1), candle.time + MINUTE);
    for (const signal of signals) {
      let account = accounts.get(signal.id);
      if (!account) {
        account = {name:signal.name, pending:null, position:null, net:0, trades:0, peak:0, maxDrawdown:0};
        accounts.set(signal.id, account);
      }
      if (account.pending === 'exit') closePosition(account, candle.open);
      if (account.pending === 'enter') {
        const costPerEth = candle.open * (1 + SLIPPAGE) * (1 + FEE);
        account.position = {quantity:STAKE / costPerEth, costPerEth, openedAt:candle.time};
      }
      account.pending = null;
      mark(account, candle.open);
      if (index === candles.length - 1) {
        if (account.position) closePosition(account, candle.close);
      } else if (account.position) {
        if (shouldExit(account.position, candle)) account.pending = 'exit';
      } else if (signal.action === 'buy') {
        account.pending = 'enter';
      }
      mark(account, candle.close);
    }
  }
  const strategies = Array.from(accounts.values(), ({name, trades, net, maxDrawdown}) => ({name, trades, net, maxDrawdown}));
  return {
    source:'Bybit Spot · ETH/USDT · נרות דקה סגורים',
    from:candles[HISTORY - 1].time + MINUTE,
    to:end,
    assumptions:'כל אסטרטגיה נבדקת בנפרד עם 25 USDT לכניסה, כולל עמלת קנייה. עמלה משוערת של 0.10% והחלקה של 0.02% בכל צד. לאחר 22 נרות חימום, החלטות לפי סגירת נר מבוצעות בפתיחת הנר הבא. יציאה ביעד 0.35%, בהפסד 0.25% או אחרי חמש דקות. יתרה פתוחה נסגרת במחיר הסגירה האחרון בניכוי עלויות. הירידה המרבית נמדדת בפתיחות ובסגירות לפי שווי מימוש משוער. כל הסכומים ב־USDT. זו הדמיה היסטורית.',
    strategies
  };
}

export async function runResearch() {
  const market = await fetchEthMarket();
  return replayEthStrategies(market.candles, market.serverTime);
}

