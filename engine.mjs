export const names=['מגדל התצפית','בית המגמה','בית הפריצות','בית הממוצע','הבנק העירוני','בורסת העיר'];
export function bar(i,day=1){
 const wave=Math.sin(i*.32+day)*9+Math.sin(i*.87+day*3)*3+Math.cos(i*.11-day)*13;
 return {price:Math.round((20500+wave)*4)/4,volume:Math.round(110+45*Math.sin(i*.9+day)+Math.abs(wave)*2)};
}
export function create(day=1){return {day,i:12,qty:0,avg:0,cash:0,trades:[],active:null,stopped:false,mode:'manual',budget:100000,max:2,loss:200,threshold:2,focus:0};}
export function signals(s){
 const bars=Array.from({length:9},(_,k)=>bar(s.i-8+k,s.day)),last=bars.pop(),mean=bars.reduce((a,b)=>a+b.price,0)/8,high=Math.max(...bars.map(b=>b.price));
 return [last.price-bars[4].price>=s.threshold,last.price>=high+s.threshold&&last.volume>bars[7].volume,mean-last.price>=s.threshold&&last.price>bars[7].price];
}
export function openPNL(s){return s.qty*(bar(s.i,s.day).price-s.avg)*2;}
function event(s,label){s.active.events.push({i:s.i,label});}
export function halt(s){
 s.stopped=true;if(s.active){event(s,'ביטול יתרת ההוראה ועצירת הוראות חדשות');s.active.status='נעצר';s.active=null;}
}
export function next(s,approve=false){
 if(s.stopped||s.i>=77)return;
 const t=s.active;
 if(t?.status==='אישור'&&s.mode==='manual'&&!approve)return;
 if(t?.status==='אישור'){
  const p=bar(s.i,s.day).price;
  t.total=Math.min(2,s.max,Math.floor(s.budget/(2*p)));
  if(!t.total||s.cash+openPNL(s)<=-s.loss){event(s,'הבנק דחה את ההצעה לפי מגבלות החשבון');t.status='נדחה';s.active=null;s.i++;return;}
  event(s,'הבנק אישר '+t.total+' חוזים • נשלחה הוראת הדמיה');t.status='נשלחה';return;
 }
 s.i++;const p=bar(s.i,s.day).price;
 if(s.cash+openPNL(s)<=-s.loss){halt(s);return;}
 if(t){
  if(s.qty<t.total){
   const fill=p+.25;
   if((s.qty+1)*fill*2>s.budget){halt(s);return;}
   s.avg=(s.avg*s.qty+fill)/(s.qty+1);s.qty++;s.cash-=1;t.net-=1;
   t.status=s.qty===t.total?'בוצעה':'ביצוע חלקי';event(s,t.status+' • חוזה אחד במחיר '+fill);
   if(s.qty===t.total)t.exit=s.i+3;
  }else if(s.i>=t.exit){
   const gain=(p-.25-s.avg)*2*s.qty-s.qty;s.cash+=gain;t.net+=gain;s.qty=0;s.avg=0;t.status='נסגרה';event(s,'סגירה במחיר '+(p-.25)+' • כולל עמלה והחלקה');s.active=null;
  }
 }else if(s.i<70){
  const flags=signals(s);const agent=s.focus?(flags[s.focus-1]?s.focus:0):flags.indexOf(true)+1;
  if(agent){s.active={agent,status:'אישור',net:0,events:[]};s.trades.push(s.active);event(s,names[agent]+' הציע קנייה • מחיר '+p+' • נפח '+bar(s.i,s.day).volume);}
 }
}
export function review(agent,threshold){
 let net=0,draw=0,count=0,peak=0;
 for(const day of [81,82,83,84,85]){
 const s=create(day);s.threshold=threshold;s.focus=agent;s.mode='auto';
 while(s.i<77&&!s.stopped){next(s);const equity=net+s.cash+openPNL(s);peak=Math.max(peak,equity);draw=Math.max(draw,peak-equity);}
 net+=s.cash+openPNL(s);count+=s.trades.filter(t=>t.status==='נסגרה').length;
 }
 return {net,draw,count};
}

