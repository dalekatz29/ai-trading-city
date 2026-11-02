// Coordinates are in floor-plan units. Height is measured upward from the floor.
const crew = [
  { title:'סורק השוק', code:'RADAR', color:'#30f3ef', x:-240, y:-140, skin:'#b88068', hair:'#193045' },
  { title:'סקאלפ מומנטום', code:'PULSE', color:'#ffbc68', x:-47, y:-140, skin:'#efbd94', hair:'#713f30' },
  { title:'סקאלפ פריצה', code:'BREAK', color:'#81adff', x:149, y:-140, skin:'#cf9778', hair:'#30283b' },
  { title:'סקאלפ התאוששות', code:'REVERT', color:'#eaa0ff', x:-240, y:98, skin:'#ae795f', hair:'#24243a' },
  { title:'מנהל סיכונים', code:'RISK', color:'#81f4b9', x:-47, y:98, skin:'#e0ac94', hair:'#a7afbc' },
  { title:'סוכן ביצוע', code:'EXEC', color:'#ff8fa6', x:149, y:98, skin:'#bb8a73', hair:'#292b3a' }
];

const project=(x,y,z=0)=>[548+(x-y)*.90,356+(x+y)*.445-z];
const coords=points=>points.map(p=>project(...p).map(n=>n.toFixed(1)).join(',')).join(' ');
const face=(points,fill)=>`<polygon points="${coords(points)}" fill="${fill}"/>`;
const seam=(points,color,width=1,extras='')=>`<polyline points="${coords(points)}" fill="none" stroke="${color}" stroke-width="${width}" ${extras}/>`;
const slab=(x,y,w,d,z,c)=>face([[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z]],c);

function box(x,y,w,d,h,z,top,front,side){
  return face([[x+w,y,z],[x+w,y+d,z],[x+w,y+d,z+h],[x+w,y,z+h]],side)
    +face([[x,y+d,z],[x+w,y+d,z],[x+w,y+d,z+h],[x,y+d,z+h]],front)
    +slab(x,y,w,d,z+h,top);
}
function plane(x,y,z,west,content){
  const [px,py]=project(x,y,z);
  return `<g transform="matrix(.90 ${west?'-.445':'.445'} 0 1 ${px} ${py})">${content}</g>`;
}
function label(x,y,text,size,color='#83a5bb',attrs=''){
  return `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-family="Consolas,monospace" direction="ltr" ${attrs}>${text}</text>`;
}
function chartTrace(series,x,y,width,height,color) {
  if(series.length<2)return '';
  const points=series.map(([t,v])=>[(x+width*t).toFixed(2),(y+height*(1-v)).toFixed(2)].join(',')).join(' ');
  return `<polygon points="${x},${y+height} ${points} ${x+width},${y+height}" fill="${color}" opacity=".1"/>
    <polyline points="${points}" fill="none" stroke="${color}" stroke-linejoin="round" stroke-linecap="round" stroke-width="1.65"/>`;
}
function normalized(prices){
  const samples=prices.filter(Number.isFinite).slice(-32);
  if(samples.length<2)return [];
  const min=Math.min(...samples), range=Math.max(...samples)-min;
  return samples.map((price,k)=>[k/(samples.length-1),range?(price-min)/range:.5]);
}
function defs(){
  return `<defs>
    <linearGradient id="ocFloor" x1=".1" y1=".1" x2="1" y2="1"><stop stop-color="#274255"/><stop offset=".4" stop-color="#182e44"/><stop offset="1" stop-color="#2c3b5a"/></linearGradient>
    <linearGradient id="ocWall" x2="1" y2=".8"><stop stop-color="#1a3047"/><stop offset=".45" stop-color="#31455c"/><stop offset="1" stop-color="#14243b"/></linearGradient>
    <linearGradient id="ocGlass" x2=".35" y2="1"><stop stop-color="#172346"/><stop offset=".42" stop-color="#294163"/><stop offset=".75" stop-color="#61718e"/><stop offset="1" stop-color="#4585a0"/></linearGradient>
    <linearGradient id="ocDesk" x2=".65" y2="1"><stop stop-color="#7290a1"/><stop offset=".38" stop-color="#3a5569"/><stop offset="1" stop-color="#2e465f"/></linearGradient>
    <radialGradient id="ocHolo"><stop stop-color="#9ffbff" stop-opacity=".65"/><stop offset=".6" stop-color="#31c5e5" stop-opacity=".22"/><stop offset="1" stop-color="#2fbbdb" stop-opacity="0"/></radialGradient>
    <filter id="ocBloom" x="-.35" y="-.35" width="1.7" height="1.7"><feGaussianBlur stdDeviation="2.5"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    ${crew.map((a,i)=>`<linearGradient id="ocSuit${i}" x2="1" y2="1"><stop stop-color="${a.color}"/><stop offset=".48" stop-color="${a.color}" stop-opacity=".65"/><stop offset="1" stop-color="#26334b"/></linearGradient>`).join('')}
  </defs>`;
}

function windowPanorama() {
  // A terrace window with a city panorama embedded in its own architectural plane.
  let view='<rect width="585" height="91" rx="2" fill="url(#ocGlass)"/><circle cx="459" cy="19" r="10" fill="#c8cddd" opacity=".7"/>';
  for(let k=0;k<31;k++){
    const x=k*19, h=12+(k*17%54), w=10+k*7%9;
    view+=`<path d="M${x} 91v-${h}l${w*.6} -3 ${w*.4} 2v${h+1}z" fill="${k%3?'#1d334e':'#2f4961'}"/>`;
    for(let j=9; j<h; j+=8)view+=`<path d="M${x+2} ${92-j}h${w-4}" stroke="${k%4?'#8da5af':'#e9bd8e'}" stroke-width="1.2" stroke-dasharray="2 2"/>`;
  }
  view+='<path d="M0 1h68L17 90H0zm128 0h15L90 91H75zm158 0h50l-54 89h-50z" fill="#abd9e3" opacity=".07"/>';
  for(let k=0;k<=6;k++)view+=`<path d="M${k*97} 0v91" stroke="#1c2b42" stroke-width="5"/><path d="M${k*97+2} 0v91" stroke="#8badba" stroke-width="1"/>`;
  return plane(-281,-185,113,false,view);
}

function wallScreen(series){
  let screen='<rect x="-8" y="-6" width="335" height="100" rx="5" fill="#0b162b" stroke="#678495" stroke-width="2"/><rect width="318" height="86" rx="3" fill="#091d2c"/>';
  screen+=label(9,14,'MARKET OBSERVATORY',9,'#a7ddeb','letter-spacing="1.6"');
  screen+=label(150,14,'MNQ / SIM',7,'#58f7ee');
  screen+='<path d="M8 21h224m-224 15h224m-224 15h224m-224 15h224" fill="none" stroke="#244556" stroke-width=".8"/>';
  screen+=chartTrace(series,10,25,220,47,'#65f7ed');
  screen+='<path d="M243 7v72" stroke="#335363"/>';
  screen+=label(254,20,'DESKS',8)+label(254,49,'06',22,'#edfbff');
  screen+='<path d="M255 63h45m-45 6h31" stroke="#42b4cc" stroke-width="2"/>';
  return plane(-292,157,115,true,screen);
}

function architecture(series) {
  let room=box(-306,-202,620,463,23,-23,'url(#ocFloor)','#18283c','#101a31');
  // Catwalk lip, edge lights and access panels give the cutaway a visible thickness.
  room+=seam([[-305,261,-9],[314,261,-9],[314,-201,-9]],'#679aa8',2);
  room+=seam([[-300,261,-13],[-80,261,-13]],'#68efed',2.2);
  room+=seam([[314,245,-13],[314,80,-13]],'#a4a3fa',2);
  for(let x=-275;x<312;x+=58)room+=seam([[x,-198,1],[x,255,1]],'#32485a',.8);
  for(let y=-178;y<260;y+=48)room+=seam([[-300,y,1],[309,y,1]],'#304456',.85);
  room+=box(-306,-202,620,15,123,0,'#63798c','url(#ocWall)','#162b41')
      +box(-306,-202,14,463,122,0,'#7b8c9e','#354458','url(#ocWall)');
  room+=windowPanorama()+wallScreen(series);
  // Back-wall canopy, gantry brackets and long suspended luminaires.
  room+=box(-306,-202,619,28,10,120,'#455c6f','#263a4b','#253348');
  room+=box(-306,-201,23,462,10,120,'#718194','#475867','#394a61');
  room+=seam([[-286,248,121],[-286,-184,121],[309,-184,121]],'#7ce9f5',2.5,'class="light-strip"');
  for(let x=-257;x<285;x+=147){
    room+=box(x,-196,9,38,8,115,'#627787','#324f64','#273a4d');
    room+=box(x-5,-165,90,6,4,111,'#617e8d','#253e54','#334b61');
    room+=seam([[x-2,-159,112],[x+80,-159,112]],'#dbffff',2.8);
  }
  for(let y=-155;y<235;y+=96){
    room+=box(-293,y,10,5,29,0,'#5c7182','#25384b','#4e647a');
  }
  // Below the panoramic window, six inset equipment bays remain behind the desks.
  for(let x=-273;x<295;x+=97){
    room+=box(x,-185,82,12,15,1,'#56697b','#293f50','#233446');
    for(let j=0;j<7;j++)room+=seam([[x+6+j*9,-173,5],[x+9+j*9,-173,11]],'#5c7284',1.2);
  }
  return room;
}

function commandCore() {
  const [cx,cy]=project(12,44,2);
  let core=`<g transform="translate(${cx} ${cy})" pointer-events="none">
    <ellipse rx="92" ry="43" fill="url(#ocHolo)"/>
    <ellipse cy="1" rx="60" ry="25" fill="#122839" stroke="#2b7182" stroke-width="1.4"/>
    <ellipse rx="52" ry="22" fill="none" stroke="#58cdd7" stroke-width="1.3" stroke-dasharray="44 9 8 6"/>
    <ellipse rx="40" ry="17" fill="#123449" stroke="#8bdfed" stroke-width="1" stroke-dasharray="19 4"/>
    <ellipse rx="25" ry="10" fill="#0a2539"/>
    <path d="M-17 0L0-7l17 7L0 7z" fill="#2facc2" opacity=".65"/>
    <path d="M-13-3L0-28 13-3 0 4z" fill="#3cd2e0" fill-opacity=".2" stroke="#8df4ff" stroke-opacity=".8"/>
    <path d="M0-28v32m-13-7L0-9l13 6" stroke="#8df4ff" stroke-opacity=".5" fill="none"/>
  </g>`;
  return core;
}

function screen(x,y,z,width,height,series,tint,legend) {
  let panel=`<rect x="-2" y="-2" width="${width+4}" height="${height+4}" rx="2.5" fill="#25374a" stroke="#8497aa" stroke-width="1.4"/>
    <rect width="${width}" height="${height}" rx="1" fill="#071b28"/>
    <path d="M4 10h${width-8}m-${width-8} 9h${width-8}m-${width-8} 9h${width-8}" stroke="#204152" stroke-width=".7" fill="none"/>`;
  panel+=label(4,7,legend,4.7,tint,'letter-spacing=".7"');
  panel+=chartTrace(series,4,11,width-8,height-15,tint);
  return plane(x,y,z,false,panel);
}
function chair(x,y) {
  let chairArt=box(x+43,y+74,30,24,5,16,'#3f526a','#283c53','#1d3045');
  const [cx,cy]=project(x+58,y+86,12);
  chairArt+=`<g transform="translate(${cx} ${cy})"><path d="M0-5v11m0-2-15 6m15-6 6 8m-6-8 14 1" fill="none" stroke="#698194" stroke-width="3" stroke-linecap="round"/>
  <circle cx="-15" cy="10" r="2.5" fill="#141c30"/><circle cx="7" cy="12" r="2.5" fill="#141c30"/></g>`;
  return chairArt;
}

function avatar(x,y,i) {
  const a=crew[i], [px,py]=project(x+60,y+78,23);
  const hairstyles=[
    'M-13-47q-1-15 11-16q12-3 15 11l-6-1-2 8-8-7-7 9z',
    'M-13-48q0-13 8-15q15-7 19 8l-3 6-5-6-10 2-7 8z',
    'M-12-48q-4-16 11-18q12 0 15 14l-3 12-6-12-11 0-4 9z',
    'M-16-39q-4-24 10-27q14-4 19 9l3 23-7 1-5-21-13 7-3 14z',
    'M-13-48q1-16 14-16q12 2 12 16l-8-7-11 5-6 6z',
    'M-12-47q-2-13 7-16q12-5 18 8l1 9-9-8-10 3-5 7z'
  ];
  let drawing=`<g transform="translate(${px} ${py})"><ellipse cy="21" rx="23" ry="7" fill="#031423" opacity=".35"/>
  <path d="M-11-4l-4 17 9 4m12-18 4 16 8 2" fill="none" stroke="#142638" stroke-width="7" stroke-linecap="round"/>
  <path d="M-12-7l-3-17q1-9 13-12h8q10 1 12 11l-2 18q-14 8-28 0" fill="url(#ocSuit${i})" stroke="#1e3446"/>
  <path d="M-5-34l7 9 7-8M2-25v19" stroke="#e2f3f8" opacity=".7" stroke-width="1.5" fill="none"/>
  <path d="M-12-25l-6 9 12 4m19-13 7 6 8-6" stroke="${a.color}" stroke-width="6" fill="none" stroke-linecap="round"/>
  <circle cx="-6" cy="-12" r="3" fill="${a.skin}"/><circle cx="28" cy="-25" r="3" fill="${a.skin}"/>
  <rect x="-5" y="-41" width="10" height="10" rx="3" fill="${a.skin}"/>
  <ellipse cy="-48" rx="12" ry="14" fill="${a.skin}"/><path d="${hairstyles[i]}" fill="${a.hair}"/>
  <path d="M-7-47h3m7-1h3m-6 8h4" stroke="#58434a" stroke-linecap="round" stroke-width="1.4"/>
  <rect x="7" y="-26" width="4" height="6" rx="1" fill="#e2f4fa"/>`;
  if(i===1||i===4)drawing+='<g fill="#132c43" fill-opacity=".6" stroke="#b4d2e0" stroke-width="1.1"><rect x="-10" y="-50" width="9" height="5" rx="2"/><rect x="1" y="-51" width="9" height="5" rx="2"/><path d="M-1-48h2"/></g>';
  if(i===0||i===5)drawing+=`<path d="M-12-48q-2-18 12-18t13 18v6q0 5-8 5" fill="none" stroke="#59758a" stroke-width="2.2"/><rect x="-15" y="-50" width="5" height="11" rx="2" fill="${a.color}"/>`;
  return drawing+'</g>';
}

function desk(a,i,series,selected){
 const {x,y,color}=a;
 let station=box(x-12,y-12,143,114,3,1,selected?'#284d5b':'#172b3f','#233c4d','#1d3547');
 station+=seam([[x-12,y+93,5],[x-12,y+102,5],[x+131,y+102,5],[x+131,y+78,5]],color,selected?2.5:1.35);
 station+=box(x+4,y+4,15,47,36,3,'#466274','#2c455b','#243b4c');
 station+=box(x+89,y+6,24,43,37,3,'#4e697b','#2a4256','#1e3347');
 station+=box(x,y,121,57,7,39,'url(#ocDesk)','#29435b','#233b4e');
 station+=seam([[x+3,y+57,43],[x+118,y+57,43],[x+121,y+54,43]],color,1.6);
 for(let k=0;k<4;k++)station+=seam([[x+92,y+49,10+k*6],[x+109,y+49,10+k*6]],k===0?color:'#597284',1.4);
 station+=box(x+46,y+9,25,14,2,46,'#6a8594','#32475b','#2b4055')
  +box(x+55,y+12,6,5,14,48,'#5a7484','#32475b','#314959');
 // Each specialist has its own work surface: single, twin, or ultrawide display.
 if(i===0||i===3) {
   station+=screen(x+6,y+12,92,55,31,series,color,a.code);
   station+=screen(x+67,y+13,92,45,31,series.slice(10),color,'15 SEC');
 }else if(i===2||i===5){
   station+=screen(x+9,y+12,96,103,37,series,color,a.code+' / MNQ');
 }else{
   station+=screen(x+18,y+12,100,79,43,series,color,a.code+' / MNQ');
 }
 station+=box(x+30,y+33,43,17,2,46,'#263f52','#142a3b','#162d41');
 for(let row=0;row<3;row++){
   for(let col=0;col<8;col++)station+=slab(x+32+col*5,y+35+row*4,3,2.3,48.3,'#7397aa');
 }
 station+=box(x+81,y+33,7,10,2,46,'#91acb8','#516f83','#516f83');
 station+=box(x+104,y+32,8,9,11,46,i%2?'#c3c8bb':'#c3b3bd','#a69c99','#8d9094');
 return station+chair(x,y)+avatar(x,y,i);
}

function plaque(a,i,selected,active){
 const [x,y]=project(a.x+56,a.y+117,0);
 return `<g class="station-label" data-a="${i}" aria-hidden="true" transform="translate(${x} ${y})">
  <path d="M-72-11h136l8 7v17H-65l-7-7z" fill="${selected?'#17394b':'#102234'}" stroke="${selected?a.color:'#496172'}"/>
  <path d="M-72-10h20" fill="none" stroke="${a.color}" stroke-width="2.2"/>
  ${label(-64,5,'0'+(i+1),9,a.color)}
  <text x="10" y="5" text-anchor="middle" font-size="12" font-family="Segoe UI,Arial" font-weight="600" fill="#e9f5fc">${a.title}</text>
  ${active?`<circle cx="63" cy="-7" r="3.2" fill="${a.color}"/>`:''}</g>`;
}

export function officeScene(selected, activeAgent, running, prices=[]){
 const series=normalized(prices);
 let room=defs()+architecture(series)+commandCore();
 let labels='';
 for(const [i,a] of crew.entries()){
   const chosen=i===selected, active=running&&(i===0||i===activeAgent);
   room+=`<g class="workstation${chosen?' selected':''}" data-a="${i}" role="button" tabindex="0" aria-label="${a.title}" aria-pressed="${chosen}">${desk(a,i,series,chosen)}</g>`;
   labels+=plaque(a,i,chosen,active);
 }
 return room+labels;
}

