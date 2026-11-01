import test from 'node:test';
import assert from 'node:assert/strict';
import {create,next,halt,review} from './engine.mjs';
function proposal(){const s=create();while(!s.active&&s.i<77)next(s);assert.ok(s.active);return s;}
test('manual approval, partial fills and settlement',()=>{const s=proposal(),i=s.i;next(s);assert.equal(s.i,i);next(s,true);assert.equal(s.qty,0);next(s);assert.equal(s.qty,1);next(s);assert.equal(s.qty,2);for(let j=0;j<3;j++)next(s);assert.equal(s.qty,0);assert.equal(s.trades[0].net,s.cash);});
test('stop preserves existing contracts and cancels remainder',()=>{const s=proposal();next(s,true);next(s);halt(s);next(s);assert.equal(s.qty,1);assert.equal(s.active,null);});
test('budget veto',()=>{const s=proposal();s.budget=1;next(s,true);assert.equal(s.active,null);assert.equal(s.qty,0);});
test('all strategies finish holdout days',()=>{for(const a of [1,2,3])for(const t of [2,4])assert.ok(Number.isFinite(review(a,t).net));});
