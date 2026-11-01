const palette = ['#88c8c1', '#ecc98d', '#a4b9e2', '#ceacda', '#a7c59e', '#dc9f84'];
const titles = ['סורק השוק', 'סקאלפ מומנטום', 'סקאלפ פריצה', 'סקאלפ התאוששות', 'מנהל סיכונים', 'סוכן ביצוע'];
const stations = [[-225,-85],[-40,-85],[145,-85],[-225,105],[-40,105],[145,105]];

export function officeScene(selected, activeAgent, running) {
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
 let scene = '<defs><linearGradient id="officeGlass" x2="0" y2="1"><stop stop-color="#234f80"/><stop offset="1" stop-color="#0c1c38"/></linearGradient></defs>';
 let labels = '';
 scene += box(-310,-205,620,475,17,-17,'#172942','#0a1226','#152442');
 for(let x=-300;x<310;x+=30) {
  scene+=polygon([[x,-205,1],[x+1,-205,1],[x+1,270,1],[x,270,1]],'#23425e');
 }
 scene += box(-310,-205,620,12,138,0,'#637d9e','#1b304e','#142b49');
 scene += box(-310,-205,12,475,138,0,'#637d9e','#192e4c','#213b59');
 scene += polygon([[-297,-145,55],[-297,135,55],[-297,135,120],[-297,-145,120]],'#081b35');
 for(let panel=0;panel<3;panel++){
  const y=-140+panel*92;
  scene += polygon([[-296,y,60],[-296,y+84,60],[-296,y+84,115],[-296,y,115]],'#153b60');
  const line=[[-295,y+8,73],[-295,y+23,89],[-295,y+37,82],[-295,y+51,102],[-295,y+72,94]];
  scene += '<polyline points="'+line.map(p=>point(...p).join(',')).join(' ')+'" stroke="'+palette[panel]+'" stroke-width="2" fill="none"/>';
 }
 // Glazed wall and window frames at the rear of the room.
 scene+=polygon([[-270,-191,40],[245,-191,40],[245,-191,120],[-270,-191,120]],'url(#officeGlass)');
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
  scene+=box(x+5,y+5,7,48,42,0,'#9a9b89','#566869','#6b7973');
  scene+=box(x+98,y+5,7,48,42,0,'#9a9b89','#566869','#6b7973');
  scene+=box(x,y,114,60,6,42,'#36526b','#14293f','#263d57');
  scene+=box(x+36,y+10,30,15,3,48,'#53666b','#354e55','#354e55');
  scene+=box(x+48,y+13,5,5,14,51,'#668080','#3c535c','#3c535c');
  scene+=box(x+16,y+10,71,5,37,61,'#3e5760','#2d424d','#2d424d');
  scene+=polygon([[x+20,y+16,65],[x+83,y+16,65],[x+83,y+16,94],[x+20,y+16,94]],'#132d3a');
  const chart = [[x+25,y+17,73],[x+35,y+17,78],[x+45,y+17,75],[x+57,y+17,85],[x+66,y+17,81],[x+77,y+17,90]];
  scene+='<polyline points="'+chart.map(p=>point(...p).join(',')).join(' ')+'" stroke="'+c+'" stroke-width="2" fill="none"/>';
  scene+=box(x+34,y+37,39,15,2,48,'#405966','#344c55','#344c55');
  scene+=box(x+92,y+32,10,10,12,48,'#f2e5c8','#bfaa8a','#d8c4a5');
  scene+=box(x+42,y+72,34,29,16,5,'#4b666f','#263e4d','#355461');
  const [px,py]=point(x+60,y+81,23);
  scene+='<ellipse cx="'+px+'" cy="'+(py+20)+'" rx="21" ry="7" fill="#3f4e4933"/><path d="M'+(px-12)+' '+(py+6)+'l-3 15m24-15 3 15" stroke="#293d4b" stroke-width="6"/><path d="M'+(px-15)+' '+py+'v-23q15-14 30 0v23z" fill="'+c+'"/><circle cx="'+px+'" cy="'+(py-39)+'" r="12" fill="'+(i%2?'#d3a17c':'#e7bc92')+'"/><path d="M'+(px-12)+' '+(py-39)+'v-7q12-16 24 0v7l-6-6-18 2z" fill="'+(i%3===0?'#3f3b3e':'#6a4f42')+'"/>';
  labels+='<g data-a="'+i+'" class="station-label" aria-hidden="true"><rect x="'+(labelX-69)+'" y="'+(labelY+9)+'" width="138" height="28" rx="8" fill="'+(selected===i?'#344f4f':'#203442')+'" stroke="'+(selected===i?c:'#566967')+'"/><text x="'+labelX+'" y="'+(labelY+28)+'" text-anchor="middle" fill="#edf6ff" font-size="12" font-family="Segoe UI">'+titles[i]+'</text></g>';
  if(active) scene+='<circle cx="'+(labelX+59)+'" cy="'+(labelY+15)+'" r="4" fill="#d4ed9b"/>';
  scene+='</g>';
 }
 return scene+labels;
}

