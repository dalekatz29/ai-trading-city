function skyline() {
  let shapes = '';
  for (let i=0; i<32; i++) {
    const x=i*33-30, w=20+(i*11%18), h=24+(i*29%95);
    shapes += `<path d="M${x} 210v-${h}l${w*.72} -7 ${w*.28} 4v${h+3}z" fill="#18304a"/>`;
    for(let k=0; k<Math.floor(h/12); k++) {
      shapes += `<path d="M${x+3} ${215-h+k*12}h${w*.55}" stroke="#6d9ab2" stroke-width="2" stroke-dasharray="3 4"/>`;
    }
  }
  return `<g opacity=".46" mask="url(#skyMask)">${shapes}</g>`;
}

function tradingTower() {
  let windows = '';
  for (let side=0; side<2; side++) {
    for(let col=0; col<8; col++) {
      for(let row=0; row<7; row++) {
        const x=172+side*134+col*16.75;
        const y=121+(side?67-col*8.375:col*8.375)+row*29;
        const rise=side?-7.25:7.25;
        const light=(col*13+row*7+side*11)%10;
        const tint=light<2?'#7cebf3':light<5?'#4ea1db':'#767cdb';
        windows += `<g transform="translate(${x+1} ${y+3})"><path d="M0 0l14.5 ${rise}v23l-14.5 ${-rise}z" fill="${tint}" opacity="${light<3?'.48':'.16'}"/><path d="M1 18l12 ${side?-6:6}" stroke="${tint}" stroke-width="1.6" opacity="${light<4?'.85':'.24'}"/></g>`;
      }
    }
  }
  return `<path d="M132 354l167-81 175 85-171 92z" fill="#081629" stroke="#467ba9"/>
  <path d="M145 348l154-76 161 79-157 83z" fill="#21405c" stroke="#5b9bb9"/>
  <path d="M172 118l134 67v205l-134-67z" fill="url(#cityGlass)"/>
  <path d="M306 185l134-67v205l-134 67z" fill="url(#nightGlass)"/>
  ${windows}
  <path d="M172 118l134 67 134-67M172 214l134 67 134-67" fill="none" stroke="#6df8ff" stroke-width="2" filter="url(#cityBloom)"/>
  <path d="M172 324V118l134-67 134 67v206l-134 66z" fill="none" stroke="#80d9f1" stroke-width="1.4"/>
  <path d="M172 118l134-67 134 67-134 67z" fill="#2a526f" stroke="#8cf3f6" stroke-width="2"/>
  <path d="M183 118l123-61 123 61-123 61z" fill="#152e49" stroke="#4e7a9b"/>
  <path d="M200 117l100-49 60 29-99 50z" fill="url(#cityGlass)" stroke="#7291c1"/>
  <path d="M200 117v9l61 31v-10zM261 147l99-50v10l-99 50z" fill="#224059"/>
  <path d="M219 116l80-39 43 20-80 40z" fill="#1c3357" stroke="#64d4e6"/>
  <path d="M234 111l42 21m-28-28 43 21m-28-28 43 21m-28-28 43 21" fill="none" stroke="#678bb2" stroke-width="2"/>
  <path d="M366 109l27 13-35 17-27-13zM324 132l27 13-26 12-27-13z" fill="#385371" stroke="#7797ad"/>
  <path d="M290 72v-28m10 25V31m8 35V48" stroke="#8dcee4" stroke-width="2"/>
  <circle cx="300" cy="29" r="2.8" fill="#ff86cc" filter="url(#cityBloom)"/>
  <g transform="matrix(1,-.5,0,1,324,222)">
    <rect width="99" height="48" rx="2" fill="#071122" stroke="#bb8afb" stroke-width="2"/>
    <text x="9" y="16" direction="ltr" font-family="Consolas" font-size="10" letter-spacing="2" fill="#d1a7ff">SCALP LAB</text>
    <path d="M9 25h80M9 34h45" stroke="#3b7694"/><path d="M69 36l3-12 4 9 4-17 4 10 4-2" fill="none" stroke="#76f8f2" stroke-width="2"/>
  </g>
  <path d="M256 367v-34l49 24 44-22v34l-44 22z" fill="#143a5b" stroke="#90dae6"/>
  <path d="M267 370v-27l19 9v27m28 5v-27l19-9v27" stroke="#6be6f1" fill="none"/>
  <path d="M244 330l63 30 56-28-8-5-48 23-56-27z" fill="#7ab3c6"/>
  <path d="M243 330l64 31 56-29" fill="none" stroke="#72faff" stroke-width="2" filter="url(#cityBloom)"/>`;
}

function placard(x, y, code, name, note, color) {
  return `<g transform="translate(${x} ${y})">
    <path d="M-112-25H100l12 12v37h-212l-12-12z" fill="#091628" stroke="${color}" stroke-opacity=".8"/>
    <path d="M-105-19h19m-19 0v9M105 18H86" stroke="${color}" stroke-width="2"/>
    <text x="90" y="-10" text-anchor="end" direction="ltr" fill="${color}" font-family="Consolas" font-size="7" letter-spacing="2">${code}</text>
    <text y="3" text-anchor="middle" fill="#f0f7ff" font-size="17" font-weight="600" font-family="Segoe UI,Arial">${name}</text>
    <text y="17" text-anchor="middle" fill="#b3c6dc" font-size="10" font-family="Segoe UI,Arial">${note}</text></g>`;
}

export function bankBuilding(x,y) {
  const id = 'rotunda-'+x+'-'+y;
  let columns = '';
  for(let i=0;i<10;i++) {
    const angle=Math.PI*i/9, cx=Math.cos(angle)*98, cy=Math.sin(angle)*38;
    columns += `<g transform="translate(${cx} ${cy})"><path d="M-5 0l1-90h8L5 0z" fill="url(#${id}-stone)" stroke="#adc5e0" stroke-width=".75"/>
      <path d="M-2-4v-80m4 80v-80" stroke="#e5dbff" stroke-width="1"/><path d="M-7 0H7v3H-7zM-7-94H7v5H-7z" fill="#97a9c9" stroke="#dfcafa" stroke-width=".8"/></g>`;
  }
  return `<g transform="translate(${x} ${y})"><defs>
  <linearGradient id="${id}-stone"><stop stop-color="#425570"/><stop offset=".4" stop-color="#d7e6f0"/><stop offset=".65" stop-color="#a5b3cf"/><stop offset="1" stop-color="#645b82"/></linearGradient>
  <radialGradient id="${id}-glass" cx=".31" cy=".17" r=".91"><stop stop-color="#d2f9ff"/><stop offset=".27" stop-color="#91bdd3"/><stop offset=".53" stop-color="#527a9b"/><stop offset=".81" stop-color="#47416f"/><stop offset="1" stop-color="#20223f"/></radialGradient></defs>
  <ellipse cy="23" rx="134" ry="59" fill="#0b1429" stroke="#746a9f"/><ellipse cy="16" rx="125" ry="54" fill="#384059" stroke="#a7a3d1"/>
  <ellipse cy="10" rx="118" ry="50" fill="#374862" stroke="#9598bb"/><ellipse cy="6" rx="112" ry="45" fill="#192940" stroke="#a9a2cc"/>
  <path d="M-99 0v-99H99V0A99 40 0 0 1-99 0" fill="#1d2f4b"/>
  <path d="M-34 37V-2a34 28 0 0 1 68 0v39z" fill="#0a1528" stroke="#b9b3dc" stroke-width="2"/>
  <path d="M-21 35V0a21 18 0 0 1 42 0v35M0-17v53" fill="none" stroke="#796f9a"/>
  ${columns}
  <path d="M-112-103a112 45 0 0 0 224 0v-16h-224z" fill="#525b79" stroke="#cabfe6"/>
  <ellipse cy="-119" rx="112" ry="47" fill="#737991" stroke="#d5deef" stroke-width="2"/>
  <path d="M-109-111a109 45 0 0 0 218 0" stroke="#dcb8ff" stroke-width="2.5" fill="none"/>
  <path d="M-97-124Q-94-204 0-219Q92-204 97-124A97 41 0 0 1-97-124z" fill="url(#${id}-glass)" stroke="#cfdeff" stroke-width="1.6"/>
  <g fill="none" stroke="#d6d7f3" opacity=".81"><path d="M0-218v134m0-134q-70 41-63 124m63-124q70 41 63 124m-63-124q-105 49-89 106m89-106q105 49 89 106"/>
  <path d="M-81-172q74 59 162 0M-95-143q90 64 190 0"/></g>
  <ellipse cy="-123" rx="97" ry="40" fill="none" stroke="#d4d4f3" stroke-width="1.5"/>
  <path d="M-8-217v-9l8-4 8 4v9l-8 3z" fill="#a0aec9" stroke="#ede2ff"/>
  <path d="M0-228v-10" stroke="#d7b8ff" stroke-width="2"/><circle cy="-239" r="2.5" fill="#fbd9ff"/>
  <path d="M-36 44h72l11 7h-94zM-47 53h94l10 6h-114z" fill="#73839a" stroke="#c2bed9" stroke-width=".8"/>
  <text y="-55" text-anchor="middle" font-family="Consolas" font-size="8" fill="#fff1ff" letter-spacing="3">CITY TREASURY</text></g>`;
}

export function cityScene() {
 let art = `<defs>
   <linearGradient id="cityGlass" x2=".85" y2="1"><stop stop-color="#3585a2"/><stop offset=".36" stop-color="#1b4f75"/><stop offset=".68" stop-color="#102d49"/><stop offset="1" stop-color="#205372"/></linearGradient>
   <linearGradient id="nightGlass" x2=".8" y2="1"><stop stop-color="#233c61"/><stop offset=".45" stop-color="#101d36"/><stop offset="1" stop-color="#355170"/></linearGradient>
   <linearGradient id="ground" x2="1" y2="1"><stop stop-color="#345070"/><stop offset=".49" stop-color="#223e57"/><stop offset="1" stop-color="#182c45"/></linearGradient>
   <linearGradient id="skyFade" x2="0" y2="1"><stop stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>
   <mask id="skyMask"><path d="M0 54h1000v170H0z" fill="url(#skyFade)"/></mask>
   <filter id="cityBloom" x="-.35" y="-.35" width="1.7" height="1.7"><feGaussianBlur stdDeviation="3"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
   <pattern id="paving" width="35" height="17.5" patternUnits="userSpaceOnUse"><path d="M0 0l35 17.5M35 0L0 17.5" fill="none" stroke="#98c5e0" opacity=".14" stroke-width=".8"/></pattern>
   <clipPath id="districtEdge"><path d="M34 364L490 141 966 366 506 601z"/></clipPath>
 </defs>
 ${skyline()}
 <path d="M34 364L490 141 966 366v25L506 626 34 391z" fill="#0a162a" stroke="#36617b"/>
 <path d="M34 364L490 141 966 366 506 601z" fill="url(#ground)" stroke="#6f9bb3"/>
 <g clip-path="url(#districtEdge)"><path d="M0 130h1000v490H0z" fill="url(#paving)"/>
 <g fill="none"><path d="M-10 326L560 610M54 392l487-243M220 466l520-254M420 148l597 290" stroke="#76879b" stroke-width="31"/>
 <path d="M-10 326L560 610M54 392l487-243M220 466l520-254M420 148l597 290" stroke="#101d32" stroke-width="27"/>
 <path d="M-10 326L560 610M54 392l487-243M220 466l520-254M420 148l597 290" stroke="#a4b4c8" stroke-opacity=".7" stroke-dasharray="9 9" stroke-width="1.2"/></g></g>
 <path d="M37 379l469 235 456-231" fill="none" stroke="#4fd5e8" stroke-opacity=".68" stroke-width="2"/>
 <path d="M282 502l224 113 175-89" fill="none" stroke="#8aa5ff" stroke-width="2"/>
 <g class="city-destination" data-place="office" role="button" tabindex="0" aria-label="כניסה למשרד הסקאלפינג">
 ${tradingTower()}${placard(307,455,'01   /   SCALPING LAB','משרד הסקאלפינג','שש עמדות מסחר　↗','#64f3ff')}</g>
 <g class="city-destination" data-place="bank" role="button" tabindex="0" aria-label="כניסה לבנק הראשי">
 ${bankBuilding(694,344)}${placard(694,455,'02   /   CITY BANK','הבנק הראשי','תקציב ובקרת סיכון　↗','#bc8cff')}</g>`;
 for(const [x,y] of [[98,352],[476,280],[494,494],[916,351],[608,525]]) {
   art+=`<g pointer-events="none"><ellipse cx="${x+3}" cy="${y}" rx="16" ry="5" fill="#67ebff" opacity=".13"/><path d="M${x} ${y}v-40l13-6" stroke="#688a9e" stroke-width="2.5" fill="none"/><path d="M${x+4} ${y-42}l9-4" stroke="#a9fbff" stroke-width="2" filter="url(#cityBloom)"/></g>`;
 }
 return art;
}

