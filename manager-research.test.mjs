import assert from 'node:assert/strict';
import test from 'node:test';
import {replayEthStrategies} from './manager-research.mjs';

const minute = 60_000;
const start = Date.UTC(2025, 0, 1, 9, 0);
function bars(length) {
  return Array.from({length}, (_, index) => ({
    time:start + index * minute, open:100, close:100, high:100.04, low:99.96, volume:10
  }));
}

function spike(candle) {
  Object.assign(candle, {high:100.28, close:100.26, volume:14});
}

function replay(candles) {
  return replayEthStrategies(candles, candles.at(-1).time + minute);
}

const net = (buy, sell) => 25 * sell * 0.9998 * 0.999 / (buy * 1.0002 * 1.001) - 25;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, actual + ' vs ' + expected);

test('a final-minute signal alone cannot create a fill', () => {
  const candles = bars(24);
  spike(candles.at(-1));
  const report = replay(candles);
  assert.equal(report.from, candles[22].time);
  assert.equal(report.to, candles.at(-1).time + minute);
  assert.equal(report.strategies.length, 3);
  for (const strategy of report.strategies) {
    assert.equal(strategy.trades, 0);
    assert.equal(strategy.net, 0);
    assert.equal(strategy.maxDrawdown, 0);
  }
});

test('a gap after a signal changes the entry and a final open position pays costs on both sides', () => {
  const candles = bars(23);
  spike(candles[21]);
  Object.assign(candles[22], {open:110, low:109.9, high:110.2, close:110});
  const [momentum, breakout, reversion] = replay(candles).strategies;
  for (const strategy of [momentum, breakout]) {
    assert.equal(strategy.trades, 1);
    near(strategy.net, net(110, 110));
    near(strategy.maxDrawdown, -strategy.net);
  }
  assert.equal(reversion.trades, 0);
});

test('a target observed on a close exits at next open, and drawdown includes the intervening peak', () => {
  const candles = bars(24);
  spike(candles[21]);
  Object.assign(candles[22], {open:100, low:100, high:100.7, close:100.6});
  Object.assign(candles[23], {open:98, low:96.9, high:98.1, close:97});
  const strategy = replay(candles).strategies[0];
  assert.equal(strategy.trades, 1);
  near(strategy.net, net(100, 98));
  near(strategy.maxDrawdown, net(100, 100.6) - net(100, 98));
});

test('rejects insufficient history, broken series, and future or stale final bars', () => {
  assert.throws(() => replay(bars(22)));
  const candles = bars(26);
  candles.splice(8, 1);
  assert.throws(() => replay(candles));
  const good = bars(26);
  assert.throws(() => replayEthStrategies(good, good.at(-1).time));
  assert.throws(() => replayEthStrategies(good, good.at(-1).time + 2 * minute));
});

