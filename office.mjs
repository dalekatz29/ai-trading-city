const palette = ['#51eaff', '#ffbd73', '#7fa4ff', '#e897ff', '#65f6bd', '#ff8f9a'];
const titles = ['סורק השוק', 'סקאלפ מומנטום', 'סקאלפ פריצה', 'סקאלפ התאוששות', 'מנהל סיכונים', 'סוכן ביצוע'];
const stations = [[-225,-85],[-40,-85],[145,-85],[-225,105],[-40,105],[145,105]];

const hair = [
 'M-13-44q-5-17 12-16q12 0 14 12l-6-1-2 6-7-7-7 8z',
 'M-13-43q-3-15 6-17q13-6 19 9l1 8-6-5-11-1-5 8z',
 'M-13-42q-4-17 10-19q14-3 17 13l-3 13-5-14-11 1-4 10z',
 'M-15-33q-5-26 12-29q13-1 15 9l2 23-7-4-2-17-13 5-2 14z',
 'M-13-44q1-17 13-17q11 1 13 15l-8-6-12 4-4 7z',
 'M-12-42q-3-14 7-17q9-5 17 6v10l-5-6-13-1-3 9z'
];
const skin = ['#bb856a','#e7b491','#d6a68b','#a87862','#e8bd9b','#a77967'];
const hairColor = ['#1a2e49','#573c3d','#454666','#2d2533','#adabbe','#1f2538'];

function seatedAgent(x, y, i) {
 const accent=palette[i];
 return `<g transform="translate(${x} ${y})">
  <ellipse cy="19" rx="23" ry="7" fill="#050a1c" opacity=".45"/>
  <path d="M-11-4l-4 17 9 4m12-18 4 16 8 2" fill="none" stroke="#162336" stroke-width="7" stroke-linecap="round"/>
  <path d="M-12-7l-3-17q2-7 11-9h11q9 1 10 10l-2 18q-14 8-27-2" fill="url(#jacket-${i})" stroke="#24374e"/>
  <path d="M-6-31l7 7 7-7M1-24v18" stroke="#d9e9f3" opacity=".7" stroke-width="1.5" fill="none"/>
  <path d="M-12-24l-4 11 9 2m20-14 5 8 8-6" stroke="${accent}" stroke-width="6" fill="none" stroke-linecap="round"/>
  <circle cx="-7" cy="-11" r="3.1" fill="${skin[i]}"/><circle cx="26" cy="-23" r="3.1" fill="${skin[i]}"/>
  <rect x="-4" y="-37" width="8" height="8" rx="3" fill="${skin[i]}"/>
  <ellipse cy="-44" rx="12" ry="14" fill="${skin[i]}"/>
  <path d="${hair[i]}" fill="${hairColor[i]}"/>
  <path d="M-6-43h2m7 0h2m-5 7h4" stroke="#594447" stroke-linecap="round" stroke-width="1.4"/>
  ${(i===1||i===4)?'<g fill="#152c43" fill-opacity=".65" stroke="#9ab2ca" stroke-width="1.2"><rect x="-9" y="-46" width="8" height="5" rx="1.5"/><rect x="1" y="-46" width="8" height="5" rx="1.5"/><path d="M-1-44h2"/></g>':''}
  ${(i===0||i===5)?'<path d="M-12-45q-1-17 12-17t13 17v6q0 5-8 5" fill="none" stroke="#47667a" stroke-width="2.3"/><rect x="-15" y="-47" width="5" height="10" rx="2" fill="'+accent+'"/>':''}
  <rect x="6" y="-21" width="4" height="6" rx="1" fill="#dbeaf7"/>
 </g>`;
}

function normalizePrices(prices) {
 const samples=prices.filter(Number.isFinite).slice(-32);
 if(samples.length<2) return [];
 const min=Math.min(...samples), span=Math.max(...samples)-min;
 return samples.map((value,i)=>[i/(samples.length-1),span?(value-min)/span:.5]);
}

export function officeScene(selected, activeAgent, running, prices = []) {
 const series=normalizePrices(prices);
 const point = (x,y,z=0) => [545 + (x-y)*.9, 365 + (x+y)*.44-z];
 const polygon = (points, color) => '<polygon points="' + points.map(p=>point(...p).join(',')).join(' ') + '" fill="' + color + '"/>';
 function box(x,y,w,d,h,z,top,left,right) {
  return polygon([[x,y,z],[x,y+d,z],[x,y+d,z+h],[x,y,z+h]],left)
   + polygon([[x,y+d,z],[x+w,y+d,z],[x+w,y+d,z+h],[x,y+d,z+h]],right)
   + polygon([[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]],top);
 }
 function plant(x,y) {
  const [px,py]=point(x,y);
  return box(x-12,y-12,24,24,20,0,'#d6c6ab','#a5967f','#bdaf95')
   + '<path d="M'+px+' '+(py-14)+'q-36-18-23-46q26 0 23 46q-2-45 22-54q21 33-22 54" fill="#6c9a79"/>';
 }
 let scene = `<defs>
 <linearGradient id="officeGlass" x2="1" y2=".9"><stop stop-color="#2689a5"/><stop offset=".5" stop-color="#173a62"/><stop offset="1" stop-color="#232745"/></linearGradient>
 <linearGradient id="floorTiles" x2="1" y2="1"><stop stop-color="#29485f"/><stop offset=".4" stop-color="#142a40"/><stop offset="1" stop-color="#25364e"/></linearGradient>
 <linearGradient id="deskSurface" x2="0" y2="1"><stop stop-color="#547186"/><stop offset=".6" stop-color="#344e64"/><stop offset="1" stop-color="#273f57"/></linearGradient>
 ${palette.map((color,i)=>'<linearGradient id="jacket-'+i+'" x2="1" y2="1"><stop stop-color="'+color+'"/><stop offset="1" stop-color="#21374a"/></linearGradient>').join('')}
 </defs>`;
 let labels = '';
 scene += box(-310,-205,620,475,17,-17,'url(#floorTiles)','#0a1226','#152442');
 for(let x=-300;x<310;x+=30) {
  scene+=polygon([[x,-205,1],[x+1,-205,1],[x+1,270,1],[x,270,1]],'#23425e');
 }
 for(let y=-195;y<266;y+=35) scene+=polygon([[-309,y,1],[310,y,1],[310,y+1,1],[-309,y+1,1]],'#2b485c');
 scene+=polygon([[-310,265,2],[310,265,2],[310,268,2],[-310,268,2]],'#5bdef1');
 scene+=polygon([[305,-200,2],[308,-200,2],[308,266,2],[305,266,2]],'#ac8ef8');
 scene += box(-310,-205,620,12,138,0,'#637d9e','#1b304e','#142b49');
 scene += box(-310,-205,12,475,138,0,'#637d9e','#192e4c','#213b59');
 scene+=polygon([[-297,-201,130],[-297,265,130],[-297,265,133],[-297,-201,133]],'#93abff');
 scene+=polygon([[-296,-190,130],[307,-190,130],[307,-190,133],[-296,-190,133]],'#76f1ff');
 const edge=[point(-297,264,131),point(-297,-190,131),point(308,-190,131)].map(p=>p.join(',')).join(' ');
 scene+='<polyline class="light-strip" points="'+edge+'" fill="none" stroke="#75eaff" stroke-width="2.4"/>';
 scene += polygon([[-297,-145,55],[-297,135,55],[-297,135,120],[-297,-145,120]],'#081b35');
 for(let panel=0;panel<3;panel++){
  const y=-140+panel*92;
  scene += polygon([[-296,y,60],[-296,y+84,60],[-296,y+84,115],[-296,y,115]],'#153b60');
  const slice=series.slice(panel*3);
  if(slice.length>1){
   const line=slice.map(([t,v])=>point(-295,y+7+t*70,67+v*37));
   scene += '<polyline points="'+line.map(p=>p.join(',')).join(' ')+'" stroke="'+palette[panel]+'" stroke-width="2" fill="none"/>';
  }
  for(let k=0;k<4;k++)scene+=polygon([[-295,y+8+k*17,62],[-295,y+16+k*17,62],[-295,y+16+k*17,63],[-295,y+8+k*17,63]],'#485f7f');
 }
 // Glazed wall and window frames at the rear of the room.
 scene+=polygon([[-270,-191,40],[245,-191,40],[245,-191,120],[-270,-191,120]],'url(#officeGlass)');
 // Distant towers and lit windows behind the glass.
 for(let k=0;k<26;k++){
  const x=-266+k*19, h=12+(k*17%54);
  scene+=polygon([[x,-190.8,42],[x+13,-190.8,42],[x+13,-190.8,42+h],[x,-190.8,42+h]],'#172c49');
  for(let z=48;z<40+h;z+=8)scene+=polygon([[x+3,-190.7,z],[x+9,-190.7,z],[x+9,-190.7,z+1.8],[x+3,-190.7,z+1.8]],k%3?'#6e9fae':'#e0b483');
 }
 for(let x=-270;x<260;x+=65) scene+=polygon([[x,-190,40],[x+4,-190,40],[x+4,-190,120],[x,-190,120]],'#4eb7c7');
 scene+=polygon([[-270,-190,78],[245,-190,78],[245,-190,81],[-270,-190,81]],'#4eb7c7');
 scene+=plant(275,-140);
 scene+=plant(-265,220);
 // Lounge and coffee corner.
 scene+=box(-281,-140,27,90,37,0,'#d6c4a2','#a59375','#bca989');
 scene+=box(-279,-130,20,21,26,37,'#303b3e','#202b31','#495654');
 scene+=box(-279,-89,20,17,2,37,'#e8ddbe','#c0b696','#c0b696');
 scene+=box(202,216,80,33,28,0,'#799594','#456565','#587a78');
 scene+=box(202,241,80,8,30,18,'#9ab0a4','#62827d','#73958d');
 for(const [i,[x,y]] of stations.entries()) {
  const c=palette[i];
  const [labelX,labelY]=point(x+48,y+102);
  const active=running && (i===0 || i===activeAgent);
  scene+='<g class="workstation'+(selected===i?' selected':'')+'" data-a="'+i+'" role="button" tabindex="0" aria-label="'+titles[i]+'">';
  scene+=polygon([[x-12,y-12,2],[x+122,y-12,2],[x+122,y+106,2],[x-12,y+106,2]],selected===i?'#294962':'#1e3148');
  const pad=[point(x-12,y+106,3),point(x+122,y+106,3),point(x+122,y+82,3)].map(p=>p.join(',')).join(' ');
  scene+='<polyline class="light-strip" points="'+pad+'" stroke="'+c+'" stroke-width="1.8" fill="none" opacity=".76"/>';
  scene+=box(x+5,y+5,7,48,42,0,'#9a9b89','#566869','#6b7973');
  scene+=box(x+98,y+5,7,48,42,0,'#9a9b89','#566869','#6b7973');
  scene+=box(x,y,114,60,6,42,'url(#deskSurface)','#14293f','#263d57');
  scene+=box(x+36,y+10,30,15,3,48,'#53666b','#354e55','#354e55');
  scene+=box(x+48,y+13,5,5,14,51,'#668080','#3c535c','#3c535c');
  scene+=box(x+16,y+10,71,5,37,61,'#3e5760','#2d424d','#2d424d');
  scene+=polygon([[x+20,y+16,65],[x+83,y+16,65],[x+83,y+16,94],[x+20,y+16,94]],'#132d3a');
  for(let grid=0;grid<3;grid++){
   scene+=polygon([[x+21,y+16.5,68+grid*9],[x+81,y+16.5,68+grid*9],[x+81,y+16.5,68.5+grid*9],[x+21,y+16.5,68.5+grid*9]],'#305167');
  }
  if(series.length){
   const chart=series.map(([t,v])=>point(x+23+t*55,y+17,69+v*21));
   scene+='<polyline points="'+chart.map(p=>p.join(',')).join(' ')+'" stroke="'+c+'" stroke-width="1.55" fill="none"/>';
  }
  scene+=box(x+34,y+37,39,15,2,48,'#405966','#344c55','#344c55');
  for(let keys=0;keys<3;keys++)scene+=polygon([[x+36,y+39+keys*4,51],[x+70,y+39+keys*4,51],[x+70,y+40+keys*4,51],[x+36,y+40+keys*4,51]],'#7896aa');
  scene+=polygon([[x,y+60,45],[x+114,y+60,45],[x+114,y+60,46.8],[x,y+60,46.8]],c);
  scene+=box(x+83,y+32,6,10,2,48,'#a3bcca','#506776','#586c7e');
  // Small rack under the desk with instrument status lamps.
  scene+=box(x+82,y+20,19,25,33,3,'#405268','#263b4b','#192b3e');
  for(let slot=0;slot<4;slot++)scene+=polygon([[x+85,y+45.1,9+slot*6],[x+99,y+45.1,9+slot*6],[x+99,y+45.1,10+slot*6],[x+85,y+45.1,10+slot*6]],slot===0?c:'#586679');
  scene+=box(x+92,y+32,10,10,12,48,'#f2e5c8','#bfaa8a','#d8c4a5');
  scene+=box(x+42,y+72,34,29,16,5,'#4b666f','#263e4d','#355461');
  const [px,py]=point(x+60,y+81,23);
  scene+=seatedAgent(px,py,i);
  labels+='<g data-a="'+i+'" class="station-label" aria-hidden="true"><rect x="'+(labelX-69)+'" y="'+(labelY+9)+'" width="138" height="28" rx="8" fill="'+(selected===i?'#344f4f':'#203442')+'" stroke="'+(selected===i?c:'#566967')+'"/><text x="'+labelX+'" y="'+(labelY+28)+'" text-anchor="middle" fill="#edf6ff" font-size="12" font-family="Segoe UI">'+titles[i]+'</text></g>';
  if(active) labels+='<circle cx="'+(labelX+59)+'" cy="'+(labelY+15)+'" r="4" fill="#d4ed9b"/>';
  scene+='</g>';
 }
 return scene+labels;
}


