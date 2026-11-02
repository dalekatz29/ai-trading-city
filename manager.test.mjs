import test from 'node:test';
import assert from 'node:assert/strict';
import {createManager,managerIntent} from './manager.mjs';

test('demo instructions are explicit and cannot accidentally execute hypothetical, live or conditional text',()=>{
  for (const text of ['התחל מסחר בדמו של Bybit','אני רוצה שתתחיל לסחור בחשבון דמו של bybit','בבקשה תן לסוכנים להתחיל לסחור בדמו','תסחור בדמו על ETH','start trading on bybit demo']) assert.equal(managerIntent(text),'start',text);
  for (const text of ['אל תתחיל מסחר בדמו','תתחיל מסחר בדמו?','תתחיל בדמו אם המחיר ירד','תתחיל בדמו עם 20000','התחל מסחר בדמו על BTC','התחל מסחר בדמו ואז בכסף אמיתי','אני רוצה שיהיה מנהל שאני אומר לו להתחיל לסחור בדמו','תתחיל בדמו מחר','תתחיל לסחור בחשבון חי']) assert.notEqual(managerIntent(text),'start',text);
  assert.equal(managerIntent('הצג תוצאות'),'status');
  assert.equal(managerIntent('בדוק אסטרטגיות'),'research');
  for (const cmd of ['עצור','תפסיק לסחור','עצירת חירום']) assert.equal(managerIntent(cmd),'stop');
});
const historical={source:'fixture',from:100,to:200,assumptions:'test',strategies:[]};
function setup(configured, config=null) {
  const sent=[],saved=[];
  const state={configured,connected:false,running:false,config,position:{realized:0,unrealized:0},totals:{orders:0,fills:0}};
  const desk={view:()=>state, async act(cmd) {sent.push(cmd);
    if(cmd.action==='manager-start') Object.assign(state,{running:true,connected:true,config:{...cmd,mode:'auto'}});
    if(cmd.action==='stop') state.running=false;
    return state;}};
  return {sent,saved,desk,research:async()=>historical,load:async()=>null,save:async r=>saved.push(r)};
}
test('missing demo key runs public research only, saves result, and does not call a trading action',async()=>{
  const harness=setup(false);
  const manager=await createManager(harness);
  const v=await manager.command('התחל מסחר בדמו של Bybit');
  assert.match(v.message,/מסחר הדמו לא הופעל/);
  assert.deepEqual(v.research,historical);
  assert.equal(v.state.running,false);assert.equal(harness.sent.length,0);assert.equal(harness.saved.length,1);
  const reopened=await createManager({...harness,load:async()=>harness.saved[0]});
  assert.deepEqual(reopened.report().research,historical);
});
test('manager respects previously chosen limits, starts once and reports real desk state',async()=>{
  const limits={budget:80,maxPosition:12,dailyLoss:3,mode:'manual'};
  const h=setup(true,limits);
  const manager=await createManager(h);
  await manager.command('תתחיל לסחור בדמו');
  await manager.command('תתחיל לסחור בדמו');
  assert.deepEqual(h.sent,[{action:'manager-start',budget:80,maxPosition:12,dailyLoss:3}]);
  assert.match((await manager.command('הצג תוצאות')).message,/0 ביצועים מאומתים/);
  await manager.command('עצור');
  assert.equal(h.desk.view().running,false);
});

