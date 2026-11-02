
// The two facades of every rectangular building share the same projection.
const mint = '#87ffe1';
const gold = '#ffc476';
function p(x,y,z=0) { return [x-y,(x+y)*.43-z]; }
function poly(vertices,fill,stroke='none',width=1) {
  return `<polygon points="${vertices.map(v=>p(...v).join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
}
function prism(x,y,w,d,z,h,roof,west,east) {
  const r=x+w, f=y+d, top=z+h;
  return poly([[x,f,z],[r,f,z],[r,f,top],[x,f,top]],west)
    + poly([[r,f,z],[r,y,z],[r,y,top],[r,f,top]],east)
    + poly([[x,y,top],[r,y,top],[r,f,top],[x,f,top]],roof);
}
function tree(x,y,s=1,tone='#286c63') {
  return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse rx="17" ry="5" fill="#030f18" opacity=".65"/>
   <path d="M0 0v-17" stroke="#907967" stroke-width="3"/><path d="M0-47l-13 19 4 12 12 4 11-13z" fill="${tone}"/><path d="M0-47l3 35 11-13z" fill="#174639"/><path d="M-11-27l11-19-1 20" fill="#87d9ab" opacity=".35"/></g>`;
}
function pedestrian(x,y,color) {
  return `<g transform="translate(${x} ${y})"><ellipse rx="4" ry="1.7" fill="#071a25"/><path d="M-1.5 0l1-5m2 5-.4-5" stroke="#0e1e31" stroke-width="1.8"/><rect x="-2.6" y="-11" width="5.2" height="7" rx="2" fill="${color}"/><circle cy="-13" r="2" fill="#dcad8c"/></g>`;
}
function lamp(x,y,tint) {
  return `<g transform="translate(${x} ${y})"><ellipse rx="13" ry="4" fill="${tint}" opacity=".1"/>
    <path d="M0 0v-29l9-4" fill="none" stroke="#697d84" stroke-width="1.7"/><path d="M3-31l7-3" stroke="${tint}" stroke-width="3" stroke-linecap="round"/></g>`;
}
function skyline() {
  let result='';
  for(let layer=0;layer<2;layer++) {
    const count=layer?23:31;
    for(let i=0;i<count;i++) {
      const x=i*(1020/count)-20, w=layer?26+i*13%20:15+i*7%17;
      const h=(layer?25:39)+(i*83+layer*11)%82, y=(layer?195:160)+15*Math.sin(i*.75);
      result+=`<g opacity="${layer?.74:.42}"><path d="M${x} ${y}v-${h}l${w*.6} -5 ${w*.4} 5v${h}z" fill="${layer?'#192c3c':'#233b4c'}"/>`;
      for(let row=1;row<Math.floor(h/15);row++) {
        if((i+row)%3===0)result+=`<path d="M${x+4} ${y-h+row*13}h${w*.56}" stroke="${(i+row)%2?'#558284':'#a48264'}" stroke-width="1.9" stroke-dasharray="2 4" opacity=".52"/>`;
      }
      result+='</g>';
    }
  }
  return `<g mask="url(#harbor-mask)">${result}</g>`;
}
function glazedStoreys(x,y,w,d,z,h,floors) {
  const top=z+h;
  let art=prism(x,y,w,d,z,h,'#4c7c79','url(#tower-sun)','url(#tower-shade)');
  for(const side of [0,1]) {
    const span=side?d:w;
    const columns=Math.max(4,Math.round(span/12));
    const paneW=span/columns;
    const plane=(u,v)=>side?[x+w,y+d-u,z+v]:[x+u,y+d,z+v];
    for(let row=0;row<floors;row++) {
      const sill=row*h/floors+3;
      const ceiling=(row+1)*h/floors-3;
      for(let col=0;col<columns;col++) {
        const a=col*paneW+1.2, b=(col+1)*paneW-1.2;
        const shine=(col*13+row*17+side*19)%19;
        const color=shine<3?'#cde0af':shine<8?'#6ab9ac':shine<12?'#398482':'#245b66';
        art+=poly([plane(a,sill),plane(b,sill),plane(b,ceiling),plane(a,ceiling)],color);
        if(shine<5)art+=poly([plane(a,sill+2),plane(b,sill+2),plane(b,sill+3.6),plane(a,sill+3.6)],'#cceae0');
      }
    }
    // Slender structural mullions make the glass read as a continuous skin.
    for(let i=0;i<=columns;i+=3) {
      const u=Math.min(span-1,i*paneW);
      art+=poly([plane(u,0),plane(u+1.5,0),plane(u+1.5,h),plane(u,h)],side?'#508b89':'#95d9c9');
    }
  }
  art+=prism(x-2,y-2,w+4,d+4,top,3,'#67ab98','#a4edd6','#528e81');
  return art;
}
function tradingTower() {
  let art=prism(-100,-88,200,176,-5,6,'#56656a','#243d49','#152d38');
  art+=prism(-93,-81,186,162,1,5,'#869387','#475b5a','#385253');
  art+=glazedStoreys(-79,-62,160,132,6,40,2);
  art+=prism(-84,-67,170,142,46,5,'#65897c','#9ed6b6','#405f5e');
  art+=glazedStoreys(-68,-56,126,112,51,84,5);
  art+=prism(-72,-60,134,120,135,6,'#7da48f','#acdbc4','#416e6b');
  art+=glazedStoreys(-64,-48,100,91,141,72,4);
  art+=prism(-66,-50,104,95,213,6,'#76af9c','#b7fce4','#578f84');
  art+=prism(-53,-37,78,69,219,6,'#264f52','#487674','#1c4f50');
  art+=prism(-43,-28,50,38,225,13,'#64958e','#497871','#325b63');
  art+=prism(-38,-20,22,17,238,4,'#90b2a1','#5b837c','#31545a');
  const [mastX,mastY]=p(-26,-13,242);
  art+=`<path d="M${mastX} ${mastY}v-21m-4 17h8" stroke="#a6cbba" stroke-width="1.4"/><circle cx="${mastX}" cy="${mastY-21}" r="2.1" fill="#ffe9ad"/>`;
  for(const [x,y,z] of [[70,38,51],[69,0,51],[47,15,141],[48,-16,141]]) {
    const [px,py]=p(x,y,z);
    art+=tree(px,py,.35);
  }
  const [sx,sy]=p(83,57,22);
  art+=`<g transform="matrix(1 -.43 0 1 ${sx} ${sy})"><rect width="91" height="20" y="-12" rx="2" fill="#061c26" stroke="#65a7a0"/><text x="45" y="1" direction="ltr" text-anchor="middle" fill="#abffe6" font-size="8" font-weight="bold" font-family="Consolas,monospace" letter-spacing="1.7">SCALP LAB</text><path d="M3 7H88" stroke="#78f7d2"/></g>`;
  art+=prism(-17,69,60,17,2,2,'#a6b9a9','#5f7a77','#455f62');
  art+=prism(-17,69,60,16,29,3,'#a4c5b7','#80dfc4','#36685c');
  for(const x of [-15,38])art+=prism(x,82,2,2,3,25,'#f2e9bf','#a1b8bb','#385b61');
  return `<g transform="translate(308 340)">${art}</g>`;
}

export function bankBuilding(x,y) {
  const prefix='bank-'+x+'-'+y;
  let columns='';
  for(let i=0;i<10;i++) {
    const rad=Math.PI*i/9;
    const cx=100*Math.cos(rad), cy=35*Math.sin(rad);
    columns+=`<g transform="translate(${cx} ${cy})"><path d="M-6 1l1.3-83h9.4L6 1Z" fill="url(#${prefix}-column)"/><path d="M-2.2-4l.8-71M1.2-3l.4-73" stroke="#8e7455" stroke-width=".85"/><path d="M-8-84H8v4H-8zM-7-1H7v3H-7z" fill="#e1c398" stroke="#90785e" stroke-width=".6"/><path d="M-8-85h16" stroke="#ffe4ad" stroke-width="2"/></g>`;
  }
  return `<g transform="translate(${x} ${y})">
   <defs><linearGradient id="${prefix}-column"><stop stop-color="#786c61"/><stop offset=".23" stop-color="#ead5b0"/><stop offset=".48" stop-color="#d4b992"/><stop offset=".82" stop-color="#998872"/><stop offset="1" stop-color="#5a655e"/></linearGradient>
   <radialGradient id="${prefix}-dome" cx="30%" cy="20%" r="88%"><stop stop-color="#d8d6a3"/><stop offset=".31" stop-color="#97a582"/><stop offset=".58" stop-color="#577c70"/><stop offset=".83" stop-color="#2c534f"/><stop offset="1" stop-color="#1b3938"/></radialGradient>
   <linearGradient id="${prefix}-drum"><stop stop-color="#4a554f"/><stop offset=".35" stop-color="#b19c79"/><stop offset=".62" stop-color="#86795f"/><stop offset="1" stop-color="#354841"/></linearGradient></defs>
   <ellipse cy="18" rx="133" ry="52" fill="#23363c" stroke="#786e58"/><ellipse cy="13" rx="128" ry="49" fill="#566057" stroke="#bba681"/><ellipse cy="8" rx="122" ry="46" fill="#747568" stroke="#c7b38c"/><ellipse cy="3" rx="117" ry="43" fill="#909085" stroke="#d0bd96"/>
   <path d="M-96 0v-89H96V0a96 35 0 0 1-192 0z" fill="url(#${prefix}-drum)"/>
   <path d="M-27 34V-7a27 26 0 0 1 54 0v41z" fill="#192b2d" stroke="#c0a67d" stroke-width="3"/><path d="M-19 33V-6a19 18 0 0 1 38 0v39M0-22v55" fill="none" stroke="#dbc18f"/>
   ${columns}
   <path d="M-113-95a113 42 0 0 0 226 0v-15h-226z" fill="url(#${prefix}-column)" stroke="#c8b695"/><ellipse cy="-110" rx="113" ry="42" fill="#a3997d" stroke="#e6c392" stroke-width="2"/>
   <path d="M-111-99a111 41 0 0 0 222 0" fill="none" stroke="#ffd392" stroke-width="2.3"/>
   <path d="M-96-115v-15c2-37 36-66 96-86 60 20 94 49 96 86v15a96 35 0 0 1-192 0z" fill="url(#${prefix}-dome)" stroke="#a6b3a0" stroke-width="1.5"/>
   <g fill="none" stroke="#a4bd9d" stroke-width="1.3"><path d="M0-214v133m0-133q-75 45-65 124m65-124q75 45 65 124m-65-124q-101 47-90 109m90-109q101 47 90 109"/><path d="M-79-164q73 41 158 0m-171 22q90 52 184 0m-187 21q96 58 190 0"/></g>
   <path d="M-96-124a96 35 0 0 0 192 0" fill="none" stroke="#d3b47b" stroke-width="3"/>
   <path d="M-12-212v-10l12-6 12 6v10l-12 5z" fill="#538071" stroke="#b8ba94"/><path d="M-7-223v-13l7-4 7 4v13l-7 4z" fill="#ffd78b" stroke="#9c957e"/><path d="M-11-236l11-12 11 12-11 5z" fill="#93aa8a"/>
   <path d="M-35 42h70l9 5h-88zm-10 8h90l10 5h-110zm-10 8H55l12 6H-67z" fill="#a69f89" stroke="#e2cba1" stroke-width=".9"/>
   <text y="-59" direction="ltr" text-anchor="middle" fill="#fff1cb" font-size="7.5" font-family="Georgia,serif" letter-spacing="2.5">CITY TREASURY</text></g>`;
}
function plaque(x,y,code,name,detail,color) {
  return `<g transform="translate(${x} ${y})"><rect x="-113" y="-24" width="226" height="59" rx="5" fill="#0a1821" stroke="${color}" stroke-opacity=".77"/><path d="M-112-10v-12h27" fill="none" stroke="${color}" stroke-width="2.5"/>
   <text y="-10" font-family="Consolas,monospace" font-size="7.8" text-anchor="middle" direction="ltr" letter-spacing="2" fill="${color}">${code}</text><text y="9" font-family="Segoe UI,Arial" font-weight="700" font-size="16.5" text-anchor="middle" fill="#f1f6f0">${name}</text><text y="25" font-family="Segoe UI,Arial" font-size="10.4" fill="#b0bec1" text-anchor="middle">${detail}</text></g>`;
}
function garden(x,y) {
  return `<g transform="translate(${x} ${y})"><path d="M-28 0l36-16 20 9-36 16z" fill="#5f716c" stroke="#94a18b"/><path d="M-23 0l30-13 15 6-30 14z" fill="#2a5145"/>${tree(-7,1,.48)}${tree(9,-5,.55)}</g>`;
}
export function cityScene() {
  const ground='M32 354L490 151 968 352 510 592z';
  const road='M-50 321L589 606M220 471L808 209M33 403L541 168M432 145l616 263';
  let art=`<defs><linearGradient id="tower-sun" x2="1" y2=".8"><stop stop-color="#1b5660"/><stop offset=".35" stop-color="#558a80"/><stop offset=".65" stop-color="#194750"/><stop offset="1" stop-color="#143841"/></linearGradient><linearGradient id="tower-shade" x2="1" y2="1"><stop stop-color="#132e3c"/><stop offset="1" stop-color="#387078"/></linearGradient>
   <linearGradient id="plaza" x2="1" y2="1"><stop stop-color="#697976"/><stop offset=".47" stop-color="#495e61"/><stop offset="1" stop-color="#2a414b"/></linearGradient><linearGradient id="harbor-depth" x2="0" y2="1"><stop stop-color="#aac1bb"/><stop offset="1" stop-color="#000"/></linearGradient><mask id="harbor-mask"><rect x="0" y="1" width="1000" height="240" fill="url(#harbor-depth)"/></mask><pattern id="plaza-tile" width="28" height="12" patternUnits="userSpaceOnUse"><path d="M0 0l28 12M28 0L0 12" fill="none" stroke="#c1c8b5" stroke-opacity=".14" stroke-width=".75"/></pattern>
   <clipPath id="sector-edge"><path d="${ground}"/></clipPath></defs>
   ${skyline()}
   <path d="M32 354L490 151 968 352v31L510 624 32 385z" fill="#0b2029" stroke="#29434d"/><path d="M32 354L510 592v32L32 385z" fill="#152b34"/><path d="${ground}" fill="url(#plaza)" stroke="#899b94"/>
   <g clip-path="url(#sector-edge)"><path d="${ground}" fill="url(#plaza-tile)"/><g fill="none"><path d="${road}" stroke="#8a9691" stroke-width="34"/><path d="${road}" stroke="#172c36" stroke-width="30"/><path d="${road}" stroke="#c4b897" stroke-width="1.6" stroke-dasharray="9 12"/></g>
    <g transform="translate(516 345) skewY(-24)"><path d="M-15-10v20m5-20v20m5-20v20m5-20v20m5-20v20" stroke="#dbd6b4" stroke-width="2.6"/></g>
    <path d="M463 548l84-40 30 13-85 42z" fill="#1f4f47" stroke="#728d7b"/><path d="M479 549l66-31m-50 39 64-31" stroke="#b4c89c" stroke-width="2"/>
   </g>
   <path d="M36 371l474 236 452-237" fill="none" stroke="#84b7aa" opacity=".65"/><path d="M37 378l473 235 452-237" fill="none" stroke="#324956" stroke-width="3"/>
   ${garden(113,359)}${garden(473,260)}${garden(854,342)}${garden(519,480)}
   <g data-place="office" class="city-destination" role="button" tabindex="0" aria-label="כניסה למשרד הסקאלפינג">${tradingTower()}${plaque(303,453,'01   /   SCALPING LAB','משרד הסקאלפינג','שש עמדות מסחר　↗',mint)}</g>
   <g data-place="bank" class="city-destination" role="button" tabindex="0" aria-label="כניסה לבנק הראשי">${bankBuilding(705,344)}${plaque(705,453,'02   /   CITY BANK','הבנק הראשי','תקציב ובקרת סיכון　↗',gold)}</g>`;
  art+='<g pointer-events="none">';
  for(const [x,y,c] of [[100,369,mint],[474,286,mint],[484,474,mint],[901,352,gold],[583,500,gold]])art+=lamp(x,y,c);
  for(const [x,y,c] of [[351,399,'#bdb797'],[364,395,'#668b89'],[618,386,'#d9ae80'],[628,381,'#97a9ae'],[462,432,'#bfbb8f']])art+=pedestrian(x,y,c);
  return art+'</g>';
}

