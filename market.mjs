import {readFile} from 'node:fs/promises';

const symbols=new Set(['BTCUSDT','ETHUSDT']);
const intervals=new Set(['1','5','15']);
const cache=new Map();

export async function getMarketData(url, recording=false, request=fetch) {
 const symbol=url.searchParams.get('symbol'), interval=url.searchParams.get('interval');
 if(!symbols.has(symbol)||!intervals.has(interval))return {status:400,data:{error:'זוג המסחר או טווח הנר אינם נתמכים.'}};
 const key=symbol+':'+interval;
 if(recording){
  const archive=JSON.parse(await readFile(new URL('./recordings.json',import.meta.url),'utf8'));
  return {status:200,data:archive[key]};
 }
 const previous=cache.get(key);
 if(previous && Date.now()-previous.receivedAt<4000)return {status:200,data:previous.data};
 try{
  const endpoint=new URL('https://api.bybit.com/v5/market/kline');
  endpoint.search=new URLSearchParams({category:'spot',symbol,interval,limit:'120'});
  const response=await request(endpoint,{signal:AbortSignal.timeout(4500),redirect:'error'});
  if(!response.ok)throw Error(String(response.status));
  const payload=await response.json();
  if(payload.retCode!==0||payload.result?.symbol!==symbol||!Array.isArray(payload.result.list))throw Error('upstream');
  const candles=payload.result.list.map(row=>{
   const [time,open,high,low,close,volume]=row.slice(0,6).map(Number);
   if(![time,open,high,low,close,volume].every(Number.isFinite)||time<=0||low<=0||volume<0||high<Math.max(open,close)||low>Math.min(open,close))throw Error('invalid candle');
   return {time,open,high,low,close,volume};
  }).sort((a,b)=>a.time-b.time);
  if(!candles.length||!Number.isFinite(payload.time))throw Error('no data');
  const data={candles,updatedAt:payload.time,source:'Bybit Spot',symbol,interval,recorded:false};
  cache.set(key,{receivedAt:Date.now(),data});
  return {status:200,data};
 }catch{
  return {status:502,data:{error:'לא התקבלו נתוני שוק עדכניים מ־Bybit.'}};
 }
}
