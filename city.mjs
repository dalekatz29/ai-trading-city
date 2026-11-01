export function cityScene() {
 let art = '<defs><linearGradient id="cityGlass" x2="1" y2="1"><stop stop-color="#1d607c" stop-opacity=".9"/><stop offset=".5" stop-color="#102e53"/><stop offset="1" stop-color="#07192e"/></linearGradient><linearGradient id="dome" x2="0" y2="1"><stop stop-color="#79eaf8" stop-opacity=".75"/><stop offset=".5" stop-color="#355378"/><stop offset="1" stop-color="#172e4c"/></linearGradient><linearGradient id="island" x2="0" y2="1"><stop stop-color="#1c3457"/><stop offset="1" stop-color="#091426"/></linearGradient><filter id="neon"><feGaussianBlur stdDeviation="4"/></filter><pattern id="futureGrid" width="60" height="30" patternUnits="userSpaceOnUse"><path d="M0 0l60 30M60 0L0 30" fill="none" stroke="#4582a2" stroke-opacity=".16"/></pattern></defs>';
 art += '<path d="M65 390L500 175 935 390v24L500 631 65 414z" fill="#080e21" stroke="#264965"/><path d="M65 390L500 175 935 390 500 607z" fill="url(#island)" stroke="#526887"/><path d="M65 390L500 175 935 390 500 607z" fill="url(#futureGrid)"/>';
 art += '<path d="M105 407L539 194M461 194L896 407M185 449L620 235M382 234L817 449" fill="none" stroke="#030c20" stroke-width="22"/>';
 art += '<path d="M105 407L539 194M461 194L896 407" fill="none" stroke="#58dce5" stroke-width="1.5" stroke-dasharray="12 17" opacity=".8"/><path d="M185 449L620 235M382 234L817 449" fill="none" stroke="#a187fb" stroke-width="1" opacity=".65"/>';
 // A glass trading office, with the clickable geometry following the building.
 art += '<g class="city-destination" data-place="office" role="button" tabindex="0" aria-label="כניסה למשרד הסקאלפינג"><path d="M169 356L308 288 450 359 310 427z" fill="#101f38" stroke="#5b99bd"/><path d="M184 345L309 406 309 211 184 150z" fill="url(#cityGlass)" stroke="#5689af"/><path d="M309 406L431 345 431 150 309 211z" fill="#0e2039" stroke="#355f82"/><path d="M184 150L309 89 431 150 309 211z" fill="#203d5b" stroke="#72eef2" stroke-width="2"/><path d="M204 151L309 100 411 151 309 201z" fill="#102d4d" stroke="#647da6"/>';
 for(let i=1;i<6;i++){
  const y=150+i*32;
  art+='<path d="M184 '+y+'l125 61 122-61" stroke="'+(i===3?'#8b7dfa':'#36738e')+'" stroke-width="'+(i===3?3:1)+'" fill="none"/>';
 }
 for(let i=1;i<5;i++){
  const x=184+i*25;
  art+='<path d="M'+x+' '+(150+i*12.2)+'v191" stroke="#3d849f" opacity=".7"/>';
 }
 art += '<path d="M187 157L187 342 309 401 428 342 428 157M309 214v187" fill="none" stroke="#58dfe9" stroke-width="2"/><path d="M330 245l76-38v73l-76 38z" fill="#06152a" stroke="#8c89fa"/><path d="M339 291l9-14 11 2 9-24 12 3 16-31" stroke="#7dedde" fill="none" stroke-width="3"/><path d="M339 299l56-28" stroke="#426383"/><path d="M272 387v-43l37 18 30-15v44l-30 15z" fill="#58cbdf" fill-opacity=".25" stroke="#67f4e5"/>';
 art+='<path d="M250 130l58-28 56 28-57 29z" fill="#1d385c" stroke="#b498fb"/><path d="M307 158v-30" stroke="#86e7f4"/><circle cx="307" cy="125" r="4" fill="#79ffe8"/>';
 art+='<g transform="translate(309 450)"><rect x="-110" y="-22" width="220" height="55" rx="9" fill="#0b1930" stroke="#55d9e4"/><text y="0" fill="#e2f4ff" font-size="17" text-anchor="middle" font-family="Segoe UI">משרד הסקאלפינג</text><text y="20" fill="#75a9c1" font-size="11" text-anchor="middle" font-family="Segoe UI">6 סוכנים · כניסה למשרד ↗</text></g></g>';
 art += '<g class="city-destination" data-place="bank" role="button" tabindex="0" aria-label="כניסה לבנק הראשי">';
 art += bankBuilding(686,358);
 art += '<g transform="translate(686 453)"><rect x="-103" y="-22" width="206" height="55" rx="9" fill="#11182e" stroke="#a58bfa"/><text y="0" fill="#f1eaff" font-size="17" text-anchor="middle" font-family="Segoe UI">הבנק הראשי</text><text y="20" fill="#aaa0cb" font-size="11" text-anchor="middle" font-family="Segoe UI">תקציב · סיכון · חיבורים ↗</text></g></g>';
 for(const [x,y] of [[130,378],[467,280],[525,490],[867,378]]) {
  art+='<path d="M'+x+' '+y+'v-55l14-7" stroke="#61849f" stroke-width="3"/><path d="M'+x+' '+(y-55)+'l14-7" stroke="#83f4f1" stroke-width="3"/><ellipse cx="'+x+'" cy="'+y+'" rx="17" ry="6" fill="#5fd5ec" opacity=".15"/>';
 }
 art+='<path d="M405 548l95 47 98-47" stroke="#927bfa" stroke-width="2" fill="none"/><text x="500" y="653" text-anchor="middle" fill="#536f96" font-family="Consolas" font-size="10" letter-spacing="4">FINANCIAL DISTRICT / SECTOR 01</text>';
 return art;
}

export function bankBuilding(x,y) {
 let bank = '<g transform="translate('+x+' '+y+')">';
 bank+='<ellipse cy="18" rx="128" ry="62" fill="#091428" stroke="#565680"/><ellipse cy="10" rx="118" ry="56" fill="#273047" stroke="#8585a3"/><ellipse cy="0" rx="108" ry="50" fill="#17253d" stroke="#abb6d1"/>';
 bank+='<path d="M-97 0V-103H97V0a97 45 0 0 1-194 0" fill="url(#cityGlass)" stroke="#667e9e"/><ellipse cy="-103" rx="97" ry="45" fill="#1d3859"/>';
 for(let i=0;i<9;i++){
  const angle=Math.PI*(i/8);
  const cx=Math.cos(angle)*94, cy=Math.sin(angle)*40;
  bank+='<path d="M'+cx+' '+(cy-1)+'v-96" stroke="#96a9c5" stroke-width="9"/><path d="M'+(cx+2)+' '+(cy-1)+'v-96" stroke="#c4afff" stroke-width="2"/><ellipse cx="'+cx+'" cy="'+cy+'" rx="7" ry="3" fill="#b6b3d3"/>';
 }
 bank+='<path d="M-112-106a112 48 0 0 0 224 0v-10h-224z" fill="#424861" stroke="#c2b6e3"/><ellipse cy="-116" rx="112" ry="48" fill="#536485" stroke="#b3e4f0"/>';
 bank+='<path d="M-94-121Q-91-208 0-210Q91-208 94-121A94 40 0 0 1-94-121" fill="url(#dome)" stroke="#96daf6"/>';
 bank+='<path d="M0-210v127M0-210Q-75-183-59-91M0-210Q75-183 59-91" stroke="#9fc7e6" stroke-opacity=".6" fill="none"/><ellipse cy="-121" rx="94" ry="40" fill="none" stroke="#a1c8ed"/>';
 bank+='<circle cy="-214" r="5" fill="#c9b4ff"/><path d="M-22 37V-1a22 19 0 0 1 44 0v38" fill="#071224" stroke="#bcaff2"/><path d="M0-15v53" stroke="#7d91ba"/><path d="M-37 47h74m-45 7h54" stroke="#ac9dea" stroke-width="2"/><text y="-54" text-anchor="middle" font-family="Consolas" font-size="11" fill="#e9dcff" letter-spacing="2">CITY BANK</text>';
 return bank+'</g>';
}
