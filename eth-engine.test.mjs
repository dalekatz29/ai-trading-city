import test from 'node:test';
import assert from 'node:assert/strict';
import {createEthEngine} from './eth-engine.mjs';

const minute = 60_000;
const config = {budget:500, maxPosition:75, dailyLoss:30, mode:'manual'};
const reservedEth = 2;
const clone = structuredClone;
const acceptableError = async promise => { try { await promise; } catch { /* some rejected actions are reported as errors */ } };

async function deskFixture() {
  let clock = Date.UTC(2026,8,12,10,10,2);
  let price = 2000;
  let disk = null;
  let sequence = 0;
  let walletEth = reservedEth;
  const state = {uncertain:false, hideOrder:false};
  const submissions=[], cancellations=[], midnightRequests=[], orders=new Map(), fills=new Map();

  function market() {
    const end = Math.floor(clock/minute)*minute;
    const candles=Array.from({length:30},(_,i)=>({
      time:end-(30-i)*minute,open:price,high:price+0.2,low:price-0.2,close:price,volume:20
    }));
    return {symbol:'ETHUSDT',source:'Bybit Spot',interval:'1m',serverTime:clock,lastClosedAt:end,candles,
      quote:{bid:price,ask:price+0.01,time:clock}};
  }
  const broker={
    getBalances: async()=>({ETH:{wallet:walletEth,available:walletEth},USDT:{wallet:5000,available:5000}}),
    getInstrument: async()=>({tickSize:'0.01',qtyStep:'0.00001',minQty:'0.00001',minAmount:'5',maxLimitQty:'1000'}),
    createOrder: async order=>{
      submissions.push(clone(order));
      const orderId='ord-'+submissions.length;
      assert(!orders.has(order.clientId),'must not submit twice with the same id');
      orders.set(order.clientId,{...order,quantity:Number(order.quantity),orderId,status:'New',filledQty:0,avgPrice:0,updatedAt:clock});
      if(state.uncertain)throw Object.assign(Error('Timed out after exchange accepted demo order'),{uncertain:true});
      return {clientId:order.clientId,orderId};
    },
    getOrder: async id=>state.hideOrder?null:clone(orders.get(id)??null),
    getExecutions: async id=>state.hideOrder?[]:clone(fills.get(id)??[]),
    cancelOrder: async id=>{
      cancellations.push(id);
      const order=orders.get(id);
      if(order && order.status==='New') Object.assign(order,{status:'Cancelled',updatedAt:clock});
      return {clientId:id,orderId:order?.orderId};
    }
  };
  function fillOrder(index=0) {
    const order=orders.get(submissions[index].clientId);
    const quantity=order.quantity;
    const feeCurrency=order.side==='Buy'?'ETH':'USDT';
    const fee=order.side==='Buy'?0.00001:0.01;
    walletEth += order.side==='Buy'?quantity-fee:-quantity;
    Object.assign(order,{status:'Filled',filledQty:quantity,avgPrice:price,updatedAt:clock});
    fills.set(order.clientId,[{execId:'exec-'+index,orderId:order.orderId,clientId:order.clientId,side:order.side,
      quantity,price,fee,feeCurrency,time:clock}]);
    return quantity;
  }
  const opts={
    makeBroker:()=>broker,configured:()=>true,
    loadCredentials:async()=>({apiKey:'fixture',apiSecret:'fixture',fingerprint:'f'.repeat(64)}),
    fetchMarket:async()=>market(),
    evaluateSignals:candles=>[{name:'מומנטום בדיקה',id:'momentum',agent:1,action:'buy',reason:'fixture',price:candles.at(-1).close,
      atrPct:0.1,signalTime:candles.at(-1).time+minute}],
    selectSetup:signals=>signals.find(s=>s.action==='buy')??null,
    read:async()=>clone(disk),save:async record=>{disk=clone(record);},
    now:()=>clock,makeId:()=>'city-demo-'+(++sequence).toString(16).padStart(24,'0'),
    midnightMark:async boundary=>{midnightRequests.push(boundary);return 2010;}
  };
  const engine=await createEthEngine(opts);
  return {engine,state,submissions,cancellations,midnightRequests,fillOrder, restart:()=>createEthEngine(opts),
    feeCurrency:(index,currency)=>{fills.get(submissions[index].clientId)[0].feeCurrency=currency;},
    expireUnfilled:(i)=>Object.assign(orders.get(submissions[i].clientId),{status:'Cancelled',updatedAt:clock}),
    advance:(ms,nextPrice=price)=>{clock+=ms;price=nextPrice;}};
}

async function start(engine,mode='manual',limits={}) {
  await engine.act({action:'connect'});
  await engine.act({action:'start',...config,mode,...limits});
  await engine.tick();
}
function approve(engine) {
  const {proposal}=engine.view();
  assert.ok(proposal,'expected pending proposal in manual mode');
  return engine.act({action:'approve',proposalId:proposal.id});
}

test('manual spot entry, exchange fill, fee attribution and exit only for ETH owned by this desk',async()=>{
  const d=await deskFixture();
  await start(d.engine);
  assert.equal(d.submissions.length,0,'a signal alone cannot submit a manual order');
  assert.equal(d.engine.view().position.qty,0,'existing exchange wallet is not a city-owned position');
  assert.equal(d.engine.view().proposal.side,'Buy');
  await approve(d.engine);
  assert.equal(d.submissions.length,1);
  const buy=d.submissions[0];
  assert.equal(buy.side,'Buy');
  assert.ok(Number(buy.limitPrice)>0 && Number(buy.quantity)*Number(buy.limitPrice)<=config.maxPosition+1e-8);
  const gross=d.fillOrder(0);
  d.advance(minute,2040);
  await d.engine.tick();
  const observed=d.engine.view();
  assert(Math.abs(observed.position.qty-(gross-0.00001))<1e-9,'ETH-denominated commission reduces attributable ETH');
  assert.equal(observed.proposal?.side,'Sell');
  await approve(d.engine);
  assert.equal(d.submissions.length,2);
  assert.equal(d.submissions[1].side,'Sell');
  assert(Number(d.submissions[1].quantity)>0 && Number(d.submissions[1].quantity)<=gross-0.00001+1e-10);
  d.fillOrder(1);
  d.advance(1000);
  await d.engine.tick();
  await d.engine.tick();
  assert.equal(d.engine.view().fills.length,2,'repeated broker history is counted only once');
  assert(d.engine.view().position.qty < 0.000011,'only step-size dust may remain');
});

test('lost acknowledgement, stop and restart never resubmit the same proposal',async()=>{
  const d=await deskFixture();
  await start(d.engine);
  const id=d.engine.view().proposal.id;
  d.state.uncertain=true;
  d.state.hideOrder=true;
  await acceptableError(d.engine.act({action:'approve',proposalId:id}));
  assert.equal(d.submissions.length,1,'broker received the first order');
  await acceptableError(d.engine.act({action:'approve',proposalId:id}));
  await acceptableError(d.engine.act({action:'stop'}));
  const restarted=await d.restart();
  await acceptableError(restarted.act({action:'connect'}));
  await acceptableError(restarted.tick());
  assert.equal(restarted.view().running,false);
  assert.equal(d.submissions.length,1,'an absent lookup is not permission to send another buy');
  d.state.uncertain=false;
  d.state.hideOrder=false;
  await acceptableError(restarted.act({action:'connect'}));
  await acceptableError(restarted.tick());
  assert.equal(d.submissions.length,1);
  assert(d.cancellations.every(link=>link===d.submissions[0].clientId),'cancel only city-owned orders');
});

test('autonomous scans cannot buy twice on one closed candle',async()=>{
  const d=await deskFixture();
  await start(d.engine,'auto');
  assert.equal(d.submissions.length,1);
  d.expireUnfilled(0); // Simulate an unfilled IOC. No order remains to prevent another entry.
  await d.engine.tick();
  await d.engine.tick();
  assert.equal(d.submissions.length,1);
  d.advance(minute);
  await d.engine.tick();
  assert.equal(d.submissions.length,2,'a new completed candle permits the next entry');
  const pending=d.submissions[1];
  await d.engine.act({action:'stop'});
  assert.equal(d.engine.view().running,false);
  assert(d.cancellations.includes(pending.clientId),'stop requests cancellation for the unfilled own order');
});

test('a realized loss reduces the next buy limit even with extra USDT in the account',async()=>{
  const d=await deskFixture();
  const budget=75;
  await start(d.engine,'manual',{budget,maxPosition:budget});
  await approve(d.engine);
  d.fillOrder(0);
  d.advance(minute,1800); // loss is below the budget-sized daily stop but material to re-entry
  await d.engine.tick();
  assert.equal(d.engine.view().proposal.side,'Sell');
  await approve(d.engine);
  d.fillOrder(1);
  d.advance(minute);
  await d.engine.tick();
  const {proposal,position}=d.engine.view();
  assert(position.realized < -5 && position.realized > -30);
  assert.equal(proposal?.side,'Buy','an affordable re-entry should remain possible');
  const cashLeft=budget+position.realized-position.cost;
  assert(Number(proposal.limitPrice)*Number(proposal.quantity)<=cashLeft+1e-8,
    'unrelated wallet cash cannot replenish the desk allocation');
  await approve(d.engine);
  const order=d.submissions.at(-1);
  assert(Number(order.limitPrice)*Number(order.quantity)<=cashLeft+1e-8);
});

test('UTC carry is measured against the preceding midnight mark after a long gap',async()=>{
  const d=await deskFixture();
  await start(d.engine);
  await approve(d.engine);
  d.fillOrder(0); // buy on Sep 12, carry across Sep 13 00:00 UTC
  await d.engine.tick();
  d.advance((15*60)*minute,1990); // midnight is no longer included in the latest 30-candle market window
  await d.engine.tick();
  const {position}=d.engine.view();
  assert.deepEqual(d.midnightRequests,[Date.UTC(2026,8,13)]);
  assert(position.qty>0);
  assert(Math.abs(position.dailyNet-(1990-2010)*position.qty)<1e-8);
  assert(position.dailyNet<position.unrealized,'prior-day open P&L is excluded');
  await d.engine.tick();
  assert.equal(d.midnightRequests.length,1,'confirmed mark is cached for the UTC day');
});

test('an unsupported execution fee locks reconciliation without poisoning restart',async()=>{
  const d=await deskFixture();
  await start(d.engine);
  await approve(d.engine);
  const gross=d.fillOrder(0);
  d.feeCurrency(0,'XYZ');
  await assert.rejects(d.engine.tick());
  assert(d.engine.view().locked);
  assert.equal(d.engine.view().fills.length,0);
  assert.equal(d.engine.view().position.qty,0);
  const restarted=await d.restart();
  assert.equal(restarted.view().fills.length,0);
  d.feeCurrency(0,'ETH');
  await restarted.act({action:'connect'});
  assert.equal(restarted.view().fills.length,1);
  assert(Math.abs(restarted.view().position.qty-(gross-0.00001))<1e-9);
  assert.equal(d.submissions.length,1);
});
