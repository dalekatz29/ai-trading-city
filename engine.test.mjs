import test from 'node:test';
import assert from 'node:assert/strict';
import {create,next,halt,review} from './engine.mjs';
function proposal(){const s=create();while(!s.active&&s.i<77)next(s);assert.ok(s.active);return s;}
test('manual approval, partial fills and settlement',()=>{const s=proposal(),i=s.i;next(s);assert.equal(s.i,i);next(s,true);assert.equal(s.qty,0);next(s);assert.equal(s.qty,1);next(s);assert.equal(s.qty,2);for(let j=0;j<3;j++)next(s);assert.equal(s.qty,0);assert.equal(s.trades[0].net,s.cash);});
test('stop preserves existing contracts and cancels remainder',()=>{const s=proposal();next(s,true);next(s);halt(s);next(s);assert.equal(s.qty,1);assert.equal(s.active,null);});
test('budget veto',()=>{const s=proposal();s.budget=1;next(s,true);assert.equal(s.active,null);assert.equal(s.qty,0);});
test('all strategies finish holdout days',()=>{for(const a of [1,2,3])for(const t of [2,4])assert.ok(Number.isFinite(review(a,t).net));});
test('scalps close within three 15-second steps after first fill',()=>{
 for(const day of [1,2,3,81,82]){
  const s=create(day);s.mode='auto';
  while(s.i<77&&!s.stopped)next(s);
  for(const trade of s.trades.filter(t=>t.status==='נסגרה')){
   const first=trade.events.find(e=>e.label.includes('חוזה אחד'));
   const exit=trade.events.at(-1);
   assert.ok(exit.i-first.i<=3);
  }
 }
});
test('profit target and loss exit cancel an unfilled remainder',()=>{
 for(const avg of [20000,21000]){
  const s=proposal();s.loss=10000;next(s,true);next(s);s.avg=avg;
  next(s);
  assert.equal(s.qty,0);
  assert.equal(s.trades[0].status,'נסגרה');
  assert.match(s.trades[0].events.at(-1).label,/יעד רווח|עצירת הפסד/);
 }
});
