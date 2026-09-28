(() => {
  'use strict';
  // Whole painted frames: preserve the original anatomy and pixel shading.
  const atlas=new Image();atlas.src='character-animation-v2.png';
  const fallback=[new Image(),new Image()];fallback[0].src='chase-runner.png';fallback[1].src='duo-partner.png';
  const CELL_W=256,CELL_H=256;
  function draw(ctx,{id=0,phase=0,moving=false,heading='front',face=1,scale=1,crouch=false,pose='normal',time=0}){
    id=id===1?1:0;const direction=heading==='back'?1:heading==='side'?2:0;
    let row,col;
    if(pose==='jump'){row=8+id;col=3+direction;}
    else if(crouch||pose==='slide'){row=8+id;col=direction;}
    else if(moving){row=id*3+(direction===2?0:direction===1?1:2);col=((Math.floor(phase/(Math.PI*2)*6)%6)+6)%6;}
    else{row=6+id;col=direction;}
    ctx.save();ctx.imageSmoothingEnabled=false;
    if(direction===2&&face<0)ctx.scale(-1,1);
    const breathe=!moving&&pose==='normal'&&!crouch?Math.sin(time*1.8)*.3:0;
    if(atlas.complete&&atlas.naturalWidth){
      // The 244px foot baseline stays fixed across every 256px cell.
      const height=85*scale,width=height*CELL_W/CELL_H;
      ctx.drawImage(atlas,col*CELL_W,row*CELL_H,CELL_W,CELL_H,-width/2,-height*244/CELL_H+breathe,width,height);
    }else if(fallback[id].complete&&fallback[id].naturalWidth){
      ctx.drawImage(fallback[id],-30*scale,-75*scale,60*scale,75*scale);
    }
    ctx.restore();
  }
  atlas.onload=()=>{if(typeof window.dispatchEvent==='function')window.dispatchEvent(new Event('avatarready'))};
  window.HumanAvatar={draw,get ready(){return atlas.complete&&atlas.naturalWidth>0}};
})();
