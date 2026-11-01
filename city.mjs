export function cityScene() {
 const point=(x,y,z=0)=>[500+(x-y)*.88,260+(x+y)*.44-z];
 const polygon=(points,fill,stroke='none')=>'<polygon points="'+points.map(p=>point(...p).join(',')).join(' ')+'" fill="'+fill+'" stroke="'+stroke+'"/>';
 function box(x,y,w,d,h,top,left,right,z=0) {
  return polygon([[x,y,z],[x,y+d,z],[x,y+d,z+h],[x,y,z+h]],left)+polygon([[x,y+d,z],[x+w,y+d,z],[x+w,y+d,z+h],[x,y+d,z+h]],right)+polygon([[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]],top);
 }
 function tree(x,y){
  const [px,py]=point(x,y);
  return '<ellipse cx="'+px+'" cy="'+py+'" rx="21" ry="9" fill="#102c2c66"/>'+box(x-3,y-3,6,6,28,'#9a8165','#695640','#7b644d')+'<path d="M'+px+' '+(py-75)+'l-25 40q25 18 50 0z" fill="#639179"/><path d="M'+px+' '+(py-75)+'v52q12-2 25-12z" fill="#456b5c"/>';
 }
 let art='<defs><filter id="glow"><feGaussianBlur stdDeviation="4"/></filter></defs>';
 art+=box(-245,-200,490,400,18,'#71827a','#354d50','#3e5856',-18);
 art+=polygon([[-240,-195,1],[240,-195,1],[240,195,1],[-240,195,1]],'#718a79');
 art+=polygon([[-245,94,2],[245,94,2],[245,155,2],[-245,155,2]],'#30424b');
 art+=polygon([[150,-200,2],[211,-200,2],[211,200,2],[150,200,2]],'#30424b');
 for(let x=-230;x<240;x+=44)art+=polygon([[x,123,3],[x+20,123,3],[x+20,126,3],[x,126,3]],'#8e9990');
 for(let y=-180;y<180;y+=44)art+=polygon([[178,y,3],[181,y,3],[181,y+20,3],[178,y+20,3]],'#8e9990');
 art+=box(-135,-110,270,195,5,'#b6b7a1','#879788','#8a9586');
 for(let y=-100;y<70;y+=28)art+=polygon([[-135,y,6],[135,y,6],[135,y+1,6],[-135,y+1,6]],'#a2a993');
 for(let x=-130;x<135;x+=30)art+=polygon([[x,-110,6],[x+1,-110,6],[x+1,85,6],[x,85,6]],'#a2a993');
 for(const [x,y] of [[-190,-125],[-190,-50],[90,-155],[225,-100],[225,-40],[-190,180],[-110,180]])art+=tree(x,y);
 art+='<g class="main-building">';
 art+=box(-90,-75,180,125,8,'#cfccaf','#939c8b','#a4ac96',6);
 art+=box(-80,-65,160,110,115,'#d7d8c2','#aab7aa','#738f8a',14);
 // Two glazed facades with repeated brass mullions.
 art+=polygon([[-81,-53,34],[-81,33,34],[-81,33,112],[-81,-53,112]],'#284f59');
 art+=polygon([[-68,46,34],[68,46,34],[68,46,112],[-68,46,112]],'#244751');
 for(let y=-50;y<34;y+=18)art+=polygon([[-82,y,34],[-82,y+2,34],[-82,y+2,112],[-82,y,112]],'#a8bfa6');
 for(let x=-65;x<68;x+=22)art+=polygon([[x,47,34],[x+2,47,34],[x+2,47,112],[x,47,112]],'#adc0a4');
 for(const z of [60,88]){art+=polygon([[-81,-53,z],[-81,33,z],[-81,33,z+2],[-81,-53,z+2]],'#93aa99');art+=polygon([[-68,47,z],[68,47,z],[68,47,z+2],[-68,47,z+2]],'#93aa99');}
 for(let x=-57;x<65;x+=22)art+=polygon([[x,48,67],[x+12,48,67],[x+12,48,78],[x,48,78]],'#cce1a3');
 art+=box(-87,-72,174,124,9,'#dfdfc7','#bcc4ab','#a5b7a4',129);
 art+=box(-70,-55,140,90,5,'#5d7873','#9dae97','#9dae97',138);
 art+=box(-53,-40,55,47,23,'#ccd0bc','#98ab9c','#829e91',143);
 art+=box(20,-38,34,55,5,'#284b5a','#75938e','#648078',146);
 for(let y=-35;y<16;y+=10)art+=polygon([[23,y,152],[51,y,152],[51,y+1,152],[23,y+1,152]],'#5e8e9d');
 art+=polygon([[14,49,15],[43,49,15],[43,49,48],[14,49,48]],'#1b373f');
 art+=box(7,44,43,25,4,'#d0dbb2','#96b29c','#96b29c',49);
 for(let step=0;step<3;step++)art+=box(9,51+step*7,40,7,7-step*2,'#d7d8bd','#9baa98','#b8bfaa',6);
 const sign=point(-13,49,119);
 art+='<text x="'+sign[0]+'" y="'+sign[1]+'" fill="#233e42" font-family="Consolas" font-size="10" text-anchor="middle" transform="rotate(26.565 '+sign.join(' ')+')">SCALPING LAB</text>';
 art+='</g>';
 for(const [x,y] of [[-118,60],[118,60],[-212,77],[135,-152]]){
  art+=box(x,y,3,3,59,'#c6d2bb','#647e78','#647e78',4);
  const [px,py]=point(x,y,64);art+='<circle cx="'+px+'" cy="'+py+'" r="12" fill="#f6df9b" opacity=".14" filter="url(#glow)"/><circle cx="'+px+'" cy="'+py+'" r="4" fill="#ffe4a4"/>';
 }
 art+=box(-134,170,58,20,10,'#939c84','#607b6c','#6c8674',2);
 for(const [x,y,c] of [[-35,73,'#d9c59a'],[95,15,'#d6e3b2'],[-110,-10,'#a4bace']]){
  const [px,py]=point(x,y,8);
  art+='<ellipse cx="'+px+'" cy="'+py+'" rx="8" ry="4" fill="#183b3555"/><path d="M'+(px-4)+' '+py+'v-11q4-4 8 0v11" fill="'+c+'"/><circle cx="'+px+'" cy="'+(py-17)+'" r="4" fill="#e8bc91"/>';
 }
 return art;
}
