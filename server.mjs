import http from 'node:http';
import https from 'node:https';
import {readFile} from 'node:fs/promises';
const assets=new Map([['/','index.html'],...['style.css','app.mjs','engine.mjs'].map(p=>['/'+p,p])]);
function gateway(){
 return new Promise(resolve=>{
 const req=https.get('https://localhost:5000/v1/api/iserver/auth/status',{timeout:2500},res=>{
 let data='';res.on('data',chunk=>data+=chunk);res.on('end',()=>{try{const state=JSON.parse(data);resolve(state.authenticated&&state.connected?'הברוקר מדווח על חיבור מאומת. ההדמיה המקומית נפרדת.':'השער זמין. נדרשת כניסה לחשבון Paper דרך IBKR.');}catch{resolve('התגובה מהשער אינה מאומתת.');}});
 });req.on('error',e=>resolve(e.code==='ECONNREFUSED'?'שער IBKR אינו מחובר. הפעילו את Client Portal Gateway והיכנסו לחשבון Paper.':'בדיקת החיבור נכשלה. בדקו את השער ואת אישור האבטחה שלו.'));req.on('timeout',()=>req.destroy());
 });
}
http.createServer(async(req,res)=>{
 if(!['localhost:4173','127.0.0.1:4173'].includes(req.headers.host)||req.method!=='GET'){res.writeHead(403).end();return;}
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.url==='/api/broker'){res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({message:await gateway()}));return;}
 const asset=assets.get(req.url);if(!asset){res.writeHead(404).end();return;}
 try{const data=await readFile(new URL(asset,import.meta.url));res.setHeader('Content-Type',(asset.endsWith('html')?'text/html':asset.endsWith('css')?'text/css':'text/javascript')+'; charset=utf-8');res.end(data);}catch{res.writeHead(500).end();}
}).listen(4173,'127.0.0.1',()=>console.log('Trading City: http://127.0.0.1:4173'));
