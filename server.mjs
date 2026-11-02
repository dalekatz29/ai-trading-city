import http from 'node:http';
import {createEthEngine} from './eth-engine.mjs';
import {getMarketData} from './market.mjs';
import https from 'node:https';
import {readFile} from 'node:fs/promises';
const assets=new Map([['/','index.html'],...['style.css','app.mjs','engine.mjs','city.mjs','office.mjs','chart.mjs','eth-desk.mjs','eth-desk.css'].map(p=>['/'+p,p])]);
function gateway(){
 return new Promise(resolve=>{
 const req=https.get('https://localhost:5000/v1/api/iserver/auth/status',{timeout:2500},res=>{
 let data='';res.on('data',chunk=>data+=chunk);res.on('end',()=>{try{const state=JSON.parse(data);resolve(state.authenticated&&state.connected?'הברוקר מדווח על חיבור מאומת. ההדמיה המקומית נפרדת.':'השער זמין. נדרשת כניסה לחשבון Paper דרך IBKR.');}catch{resolve('התגובה מהשער אינה מאומתת.');}});
 });req.on('error',e=>resolve(e.code==='ECONNREFUSED'?'שער IBKR אינו מחובר. הפעילו את Client Portal Gateway והיכנסו לחשבון Paper.':'בדיקת החיבור נכשלה. בדקו את השער ואת אישור האבטחה שלו.'));req.on('timeout',()=>req.destroy());
 });
}
const ethDesk = await createEthEngine();
const ethTimer = setInterval(() => ethDesk.tick().catch(() => {}), 10000);
ethTimer.unref();

function json(res,status,payload) {
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify(payload));
}

async function readCommand(request) {
 let size=0;
 const chunks=[];
 for await (const part of request) {
  size+=part.length;
  if (size>2048) throw Error('גוף בקשה גדול מדי.');
  chunks.push(part);
 }
 const cmd=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if (!cmd || Array.isArray(cmd) || typeof cmd.action!=='string') throw Error('פעולה לא תקינה.');
 return cmd;
}

http.createServer(async(req,res)=>{
 if(!['localhost:4173','127.0.0.1:4173'].includes(req.headers.host)){res.writeHead(403).end();return;}
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('X-Frame-Options','DENY');
 const url=new URL(req.url,'http://127.0.0.1:4173');
 if (url.pathname === '/api/eth-demo' && req.method === 'GET') {
  return json(res,200,ethDesk.view());
 }
 if (url.pathname === '/api/eth-demo/action' && req.method === 'POST') {
  if (req.headers.origin !== 'http://'+req.headers.host ||
     req.headers['content-type']?.split(';')[0].trim() !== 'application/json' ||
     (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin'))
   return json(res,403,{error:'אפשר להפעיל את הדסק רק מתוך העיר המקומית.'});
  let cmd;
  try {cmd=await readCommand(req);} catch {return json(res,400,{error:'בקשת דמו לא תקינה.'});}
  try {return json(res,200,await ethDesk.act(cmd));} catch (err) {return json(res,409,{error:err.message});}
 }
 if(req.method!=='GET'){res.writeHead(405).end();return;}
 if(url.pathname==='/api/market/klines'||url.pathname==='/api/market/recording'){
  try{
   const {status,data}=await getMarketData(url,url.pathname.endsWith('/recording'));
   res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify(data));
  }catch{res.writeHead(500,{'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify({error:'נתוני השוק אינם זמינים.'}));}
  return;
 }
 if(req.url==='/api/broker'){res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({message:await gateway()}));return;}
 const asset=assets.get(req.url);if(!asset){res.writeHead(404).end();return;}
 try{const data=await readFile(new URL(asset,import.meta.url));res.setHeader('Content-Type',(asset.endsWith('html')?'text/html':asset.endsWith('css')?'text/css':'text/javascript')+'; charset=utf-8');res.end(data);}catch{res.writeHead(500).end();}
}).listen(4173,'127.0.0.1',()=>console.log('Trading City: http://127.0.0.1:4173'));

