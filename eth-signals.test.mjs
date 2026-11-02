import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchEthMarket,evaluateEthSignals,selectEthSetup} from './eth-signals.mjs';

const minute = 60_000;
const now = Date.UTC(2026, 8, 12, 10, 10, 4);
const cutoff = now - now % minute;
function history() {
  return Array.from({length: 30}, (_,i)=>({
    time:cutoff-(30-i)*minute, open:100, high:100.04, low:99.96, close:100, volume:10
  }));
}
function snapshot(candles = history(), ticker = {}) {
  const current = {...candles.at(-1), time:cutoff, high:120, close:120, volume:1000};
  const list = [...candles, current].reverse().map(c=>[c.time,c.open,c.high,c.low,c.close,c.volume].map(String));
  return {
    bars:{time:now,retCode:0,result:{category:'spot',symbol:'ETHUSDT',list}},
    book:{time:now+5,retCode:0,result:{category:'spot',list:[{symbol:'ETHUSDT',bid1Price:'100',ask1Price:'100.02',...ticker}]}}
  };
}
function readFixture(pair) {
  return fetchEthMarket({
    now:()=>now+8,
    request:async url=>({ok:true,json:async()=>url.includes('/kline?')?pair.bars:pair.book})
  });
}

test('only finalized candles enter strategy decision, not the in-progress spike',async()=>{
  const market=await readFixture(snapshot());
  assert.equal(market.candles.length,30);
  assert.equal(market.lastClosedAt,cutoff);
  assert.deepEqual(market.quote,{bid:100,ask:100.02,time:now+5});
  assert.equal(selectEthSetup(evaluateEthSignals(market.candles, market.serverTime)),null);
});

test('rejects old clocks, incomplete series, minute-boundary mismatch and invalid books',async()=>{
  const stale=snapshot();stale.bars.time=now-30_000;
  await assert.rejects(readFixture(stale));
  const crossed=snapshot(history(),{ask1Price:'99'});
  await assert.rejects(readFixture(crossed));
  const gap=snapshot();gap.bars.result.list.splice(6,1);
  await assert.rejects(readFixture(gap));
  const future=snapshot();future.bars.result.list[0][0]=String(cutoff+minute);
  await assert.rejects(readFixture(future));
  const boundary=snapshot();boundary.bars.time=cutoff-10;
  boundary.bars.result.list.shift();
  await assert.rejects(readFixture(boundary));
});

test('all three rules require their own observed conditions',()=>{
  const trend=history();
  Object.assign(trend.at(-1),{high:100.28,close:100.26,volume:11});
  assert.deepEqual(evaluateEthSignals(trend,now).map(x=>x.action),['buy','wait','wait']);
  trend.at(-1).volume=14;
  assert.deepEqual(evaluateEthSignals(trend,now).map(x=>x.action),['buy','buy','wait']);
  const dip=history();
  Object.assign(dip.at(-2),{low:99.65,close:99.7});
  Object.assign(dip.at(-1),{open:99.7,low:99.63,high:99.88,close:99.85});
  assert.deepEqual(evaluateEthSignals(dip,now).map(x=>x.action),['wait','wait','buy']);
  assert.throws(()=>evaluateEthSignals(dip,cutoff-1));
  assert.throws(()=>evaluateEthSignals(dip,cutoff+minute));
});
