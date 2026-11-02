const marketSymbols=['BTCUSDT','ETHUSDT'];
const priceFormat=new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const volumeFormat=new Intl.NumberFormat('en-US',{maximumFractionDigits:3});
const timeFormat=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'UTC'});
const dateFormat=new Intl.DateTimeFormat('he-IL',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'});
const maxBars=64;

function aggregate(samples,interval){
 const bars=[];
 for(const sample of samples){
  const duration=Number(interval)*60000,time=Math.floor(sample.time/duration)*duration;
  let candle=bars.at(-1);
  if(!candle||candle.time!==time){
   candle={time,open:sample.price,high:sample.price,low:sample.price,close:sample.price,volume:0};
   bars.push(candle);
  }
  candle.high=Math.max(candle.high,sample.price);candle.low=Math.min(candle.low,sample.price);
  candle.close=sample.price;candle.volume+=sample.volume;
 }
 return bars;
}

function valid(candle){
 const {time,open,high,low,close,volume}=candle;
 return [time,open,high,low,close,volume].every(Number.isFinite)&&time>0&&low>0&&high>=Math.max(open,close)&&low<=Math.min(open,close)&&volume>=0;
}

export function mountMarketChart(host){
 host.innerHTML='<div class="chart-head"><div><small>MARKET DATA</small><h2>מסוף נרות</h2></div><label>שוק <select data-el="symbol"><option value="BTCUSDT">BTC / USDT · Bybit</option><option value="ETHUSDT">ETH / USDT · Bybit</option><option value="MNQ">MNQ · תרגול סינתטי</option></select></label></div>'+
 '<div class="ticker-band"><div><small data-el="pair"></small><b data-el="price" dir="ltr">—</b></div><span data-el="status" role="status"></span></div>'+
 '<div class="chart-toolbar"><div data-el="intervals" class="frame-buttons" aria-label="טווח נר"></div><span data-el="timezone"></span></div>'+
 '<svg data-el="plot" class="candle-plot" viewBox="0 0 700 310" role="img" aria-label="גרף נרות ונפח מסחר"></svg>'+
 '<div data-el="readout" class="ohlcv" dir="ltr"></div><p data-el="stamp" class="chart-stamp"></p>'+
 '<div class="chart-actions"><button data-el="retry" type="button" hidden>בדיקת חיבור מחדש</button><button data-el="replay" type="button" hidden>▶ ניגון ההקלטה</button></div>';
 const find=name=>host.querySelector('[data-el="'+name+'"]');
 const symbolSelect=find('symbol'),plot=find('plot'),intervals=find('intervals');
 let symbol=marketSymbols[0],interval='1',visible=false,simulation=[],bars=[],mode='waiting',updated=0;
 let generation=0,socket,aborter,poll,reconnect,ping,replay,replayIndex=null,hover=null;
 let wsUpdate=0,lastRequest=0;
 for(const value of ['1','5','15']){
  const button=document.createElement('button');button.type='button';button.textContent=value+' דק׳';button.dataset.interval=value;
  intervals.append(button);
 }
 function stopReplay(){clearInterval(replay);replay=null;replayIndex=null;}
 function disconnect(){
  generation++;
  aborter?.abort();aborter=null;
  clearInterval(poll);clearTimeout(reconnect);clearInterval(ping);stopReplay();
  if(socket){socket.onclose=null;socket.onerror=null;socket.onmessage=null;socket.close();socket=null;}
 }
 function draw(){
  const simulated=symbol==='MNQ',source=simulated?'MNQ · הדמיה':'BYBIT SPOT · '+symbol;
  const series=simulated?aggregate(simulation,interval):bars;
  const presented=replayIndex!==null?series.slice(0,replayIndex):series;
  const shown=presented.slice(-maxBars);
  const last=shown.at(-1),selected=shown[hover]||last;
  find('pair').textContent=source;
  find('price').textContent=last?priceFormat.format(last.close):'—';
  const old=last&&!simulated&&(Date.now()-last.time>Number(interval)*60000+90000);
  const phases={waiting:'מתחבר לנתוני שוק…',live:'● שידור חי',snapshot:'● רענון תקופתי',recorded:'◈ הקלטת שוק · החיבור החי אינו זמין',stale:'החיבור נותק · נתון אחרון',failed:'מקור הנתונים אינו זמין'};
  const status=simulated?'◈ תרגול מקומי':old&&['snapshot','live'].includes(mode)?'נתון ישן · ממתין לעדכון':phases[mode];
  find('status').textContent=status;
  find('status').dataset.fresh=String(!simulated&&!old&&['live','snapshot'].includes(mode));
  find('timezone').textContent=simulated?'שעון תרגול · ET':'שעון שוק · UTC';
  for(const b of intervals.children)b.setAttribute('aria-pressed',String(b.dataset.interval===interval));
  find('replay').hidden=mode!=='recorded'||simulated;
  find('replay').textContent=replay?'Ⅱ השהיית ההקלטה':replayIndex!==null?'▶ המשך הקלטה':'▶ ניגון ההקלטה';
  find('retry').hidden=simulated||!['recorded','failed','stale'].includes(mode);
  find('stamp').textContent=!last?'':simulated?'נרות שחושבו ממחירי תרגול של 15 שניות.':
   (mode==='recorded'?'הקלטת Bybit מתאריך ':'עדכון מקור ')+dateFormat.format(updated)+' · '+timeFormat.format(updated)+' UTC';
  if(!selected){
   plot.innerHTML='<text x="350" y="155" text-anchor="middle" font-size="16" fill="#95a8c2">'+status+'</text>';
   find('readout').textContent='';return;
  }
  const left=10,right=608,top=15,bottom=210,volBottom=268;
  const peak=Math.max(...shown.map(b=>b.high)),floor=Math.min(...shown.map(b=>b.low));
  const margin=Math.max((peak-floor)*.08,peak*.00004);
  const hi=peak+margin,lo=floor-margin,priceY=v=>top+(hi-v)*(bottom-top)/(hi-lo);
  const maxVol=Math.max(1,...shown.map(b=>b.volume));
  const step=(right-left)/Math.max(12,shown.length),width=Math.max(2,step*.67);
  const barX=i=>right-(shown.length-i-.5)*step;
  let svg='';
  for(let i=0;i<=4;i++){
   const price=lo+(hi-lo)*i/4,y=priceY(price);
   svg+='<path d="M10 '+y+'H608" stroke="#273952" stroke-dasharray="2 4"/><text x="619" y="'+(y+3)+'">'+priceFormat.format(price)+'</text>';
  }
  for(const [i,b] of shown.entries()){
   const x=barX(i),color=b.close>=b.open?'#4cf0c7':'#f17da0',y=priceY(Math.max(b.open,b.close));
   const h=Math.max(1.4,Math.abs(priceY(b.open)-priceY(b.close))),v=b.volume/maxVol*40;
   svg+='<g fill="'+color+'"><path d="M'+x+' '+priceY(b.high)+'V'+priceY(b.low)+'" stroke="'+color+'" stroke-width="1.2"/>'+
    '<rect x="'+(x-width/2)+'" y="'+y+'" width="'+width+'" height="'+h+'"/><rect opacity=".5" x="'+(x-width/2)+'" y="'+(volBottom-v)+'" width="'+width+'" height="'+v+'"/></g>';
  }
  const markY=priceY(last.close);
  svg+='<path d="M10 '+markY+'H608" stroke="#66dbe4" opacity=".5" stroke-dasharray="4 4"/><rect x="611" y="'+(markY-9)+'" width="86" height="18" rx="3" fill="#254c59"/><text x="617" y="'+(markY+4)+'" style="fill:#adffeb">'+priceFormat.format(last.close)+'</text>';
  for(const i of new Set([0,Math.floor(shown.length/2),shown.length-1])){
   const x=Math.max(36,Math.min(590,barX(i)));
   svg+='<text x="'+x+'" y="294" text-anchor="middle">'+timeFormat.format(shown[i].time).slice(0,5)+'</text>';
  }
  if(hover!==null&&shown[hover])svg+='<path d="M'+barX(hover)+' 12V270" stroke="#d3dfed" stroke-dasharray="3 4"/>';
  plot.innerHTML=svg;
  find('readout').textContent=timeFormat.format(selected.time).slice(0,5)+'   O '+priceFormat.format(selected.open)+'   H '+priceFormat.format(selected.high)+'   L '+priceFormat.format(selected.low)+'   C '+priceFormat.format(selected.close)+'   VOL '+volumeFormat.format(selected.volume);
 }
 function start(){
  disconnect();bars=[];updated=wsUpdate=lastRequest=0;hover=null;mode='waiting';draw();
  if(!visible||document.hidden||symbol==='MNQ')return;
  const token=generation;aborter=new AbortController();
  const query='?'+new URLSearchParams({symbol,interval});
  let pending=false;
  async function read(endpoint){
   const res=await fetch('/api/market/'+endpoint+query,{signal:aborter.signal,cache:'no-store'});
   if(!res.ok)throw Error('no feed');
   const data=await res.json();
   if(data.symbol!==symbol||String(data.interval)!==interval||!data.candles?.length||!data.candles.every(valid)||!Number.isFinite(data.updatedAt))throw Error('invalid feed');
   return data;
  }
  async function refresh(){
   if(token!==generation||pending)return;pending=true;lastRequest=Date.now();
   try{
    const data=await read('klines');if(token!==generation)return;
    const recent=wsUpdate>data.updatedAt?bars.filter(b=>b.time>=data.candles.at(-1).time):[];
    bars=[...new Map([...data.candles,...recent].map(b=>[b.time,b])).values()].sort((a,b)=>a.time-b.time).slice(-180);
    updated=Math.max(data.updatedAt,wsUpdate);stopReplay();mode=Date.now()-wsUpdate<20000?'live':'snapshot';
   }catch{
    if(token!==generation)return;
    if(bars.length){if(mode!=='recorded')mode=Date.now()-wsUpdate<20000?'live':'stale';}
    else{
     try{
      const archive=await read('recording');
      if(token!==generation||bars.length)return;
      bars=archive.candles;updated=archive.updatedAt;mode='recorded';
     }catch{if(token===generation&&!bars.length)mode='failed';}
    }
   }finally{pending=false;if(token===generation)draw();}
  }
  function stream(){
   if(token!==generation)return;
   try{socket=new WebSocket('wss://stream.bybit.com/v5/public/spot');}catch{ return; }
   const ws=socket,topic='kline.'+interval+'.'+symbol;
   ws.onopen=()=>{
    if(token!==generation)return;
    ws.send(JSON.stringify({op:'subscribe',args:[topic]}));
    ping=setInterval(()=>{if(ws.readyState===1)ws.send(JSON.stringify({op:'ping'}));},20000);
   };
   ws.onmessage=event=>{
    if(token!==generation)return;
    let packet;try{packet=JSON.parse(event.data);}catch{return;}
    if(packet.topic!==topic||!Array.isArray(packet.data)||!Number.isFinite(packet.ts)||packet.ts<wsUpdate||packet.ts<updated&&mode!=='recorded')return;
    const incoming=packet.data.map(k=>({time:+k.start,open:+k.open,high:+k.high,low:+k.low,close:+k.close,volume:+k.volume})).filter(valid);
    if(!incoming.length)return;
    if(mode==='recorded'){bars=[];stopReplay();}
    bars=[...new Map([...bars,...incoming].map(b=>[b.time,b])).values()].sort((a,b)=>a.time-b.time).slice(-180);
    wsUpdate=updated=packet.ts;mode='live';draw();
   };
   ws.onclose=()=>{clearInterval(ping);if(token===generation){if(mode==='live')mode='stale';draw();reconnect=setTimeout(stream,8000);}};
  }
  refresh();stream();
  poll=setInterval(()=>{if(Date.now()-wsUpdate>18000||bars.length<16){if(Date.now()-lastRequest>7000)refresh();}},4000);
 }
 intervals.onclick=e=>{const b=e.target.closest('[data-interval]');if(b&&interval!==b.dataset.interval){interval=b.dataset.interval;start();}};
 symbolSelect.onchange=()=>{symbol=symbolSelect.value;start();};
 find('retry').onclick=start;
 find('replay').onclick=()=>{
  if(mode!=='recorded')return;
  if(replay){clearInterval(replay);replay=null;}
  else{
   if(replayIndex===null||replayIndex>=bars.length)replayIndex=Math.min(12,bars.length);
   replay=setInterval(()=>{replayIndex++;if(replayIndex>=bars.length)stopReplay();draw();},600);
  }
  draw();
 };
 plot.onpointermove=e=>{
  const matrix=plot.getScreenCTM();if(!matrix)return;
  const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
  const n=Math.min(maxBars,symbol==='MNQ'?aggregate(simulation,interval).length:replayIndex??bars.length);
  const i=n-1-Math.floor((608-point.x)/((608-10)/Math.max(12,n)));
  const next=i>=0&&i<n?i:null;if(next!==hover){hover=next;draw();}
 };
 plot.onpointerleave=()=>{if(hover!==null){hover=null;draw();}};
 document.addEventListener('visibilitychange',()=>{if(visible)start();});
 draw();
 return {
  setVisible(value){if(visible===value)return;visible=value;if(value)start();else disconnect();},
  setSimulation(samples){simulation=samples;if(visible&&symbol==='MNQ')draw();}
 };
}
