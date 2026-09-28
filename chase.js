(() => {
  'use strict';
  const game = document.getElementById('chaseGame');
  const canvas = document.getElementById('chaseCanvas');
  const ctx = canvas.getContext('2d');
  const sprite = new Image(); sprite.src = 'chase-runner.png';
  const $ = id => document.getElementById(id);
  let state, frameId = 0, lastTime = 0;
  let best = 0;
  try { best = Number(localStorage.getItem('chaseMeBest')) || 0; } catch {}
  const project = (lane, depth) => {
    const p = Math.pow(Math.max(0, depth), 1.65);
    const width = 82 + p * 385;
    return { x:240 + (lane - 1) * width / 3, y:190 + p * 450, scale:.2 + p * .95, width };
  };
  function reset() {
    cancelAnimationFrame(frameId);
    state = {mode:'ready',lane:1,xLane:1,time:0,distance:0,coins:0,score:0,lives:3,items:[],particles:[],wave:1.2,jump:0,slide:0,shield:0,magnet:0,invincible:0,flash:0};
    updateHUD(); draw();
    $('chaseOverlay').hidden=false;
    $('chaseTitle').textContent='CHASE ME';
    $('chaseMessage').textContent='Беги по улицам Вайс-Сити. Барьеры перепрыгивай, под арками скользи, фургоны обходи. Собирай монеты, щит и магнит.';
    $('chaseStart').textContent='НАЧАТЬ ПОГОНЮ ↗';
    $('chasePause').textContent='Ⅱ'; $('chasePause').disabled=true;
  }
  function start() {
    if(state.mode==='paused'){state.mode='running';$('chaseOverlay').hidden=true;lastTime=performance.now();frameId=requestAnimationFrame(frame);return;}
    reset();state.mode='running';$('chaseOverlay').hidden=true;$('chasePause').disabled=false;lastTime=performance.now();frameId=requestAnimationFrame(frame);
  }
  function stop(){cancelAnimationFrame(frameId);if(state)state.mode='closed';}
  function pause(){
    if(state.mode==='paused'){start();return;}
    if(state.mode!=='running')return;
    state.mode='paused';cancelAnimationFrame(frameId);$('chaseOverlay').hidden=false;$('chaseTitle').textContent='ПАУЗА';$('chaseMessage').textContent='Город подождёт. Продолжай, когда будешь готов.';$('chaseStart').textContent='ПРОДОЛЖИТЬ ↗';
  }
  function action(a){
    if(state.mode!=='running')return;
    if(a==='left')state.lane=Math.max(0,state.lane-1);
    if(a==='right')state.lane=Math.min(2,state.lane+1);
    if(a==='jump'&&!state.jump&&!state.slide)state.jump=.85;
    if(a==='slide'&&!state.jump&&!state.slide)state.slide=.85;
  }
  function burst(x,y,color){for(let i=0;i<12;i++)state.particles.push({x,y,vx:(Math.random()-.5)*180,vy:-Math.random()*160,life:.6,color});}
  function spawn(){
    const lane=Math.floor(Math.random()*3),type=['barrier','arch','van'][Math.floor(Math.random()*3)];
    state.items.push({lane,depth:0,type,hit:false});
    const safe=(lane+1+Math.floor(Math.random()*2))%3;
    for(let i=0;i<4;i++)state.items.push({lane:safe,depth:-.1-i*.11,type:'coin',hit:false});
    if(Math.random()<.32)state.items.push({lane:(lane+2)%3,depth:-.5,type:Math.random()<.5?'shield':'magnet',hit:false});
  }
  function finish(){
    state.score=Math.floor(state.distance+state.coins*20);state.mode='over';best=Math.max(best,state.score);try{localStorage.setItem('chaseMeBest',best)}catch{}
    $('chaseOverlay').hidden=false;$('chaseTitle').textContent='ПОЙМАЛИ!';$('chaseMessage').textContent=`${state.score} очков · ${Math.floor(state.distance)} метров · ${state.coins} монет. Рекорд: ${best}.`;$('chaseStart').textContent='ЕЩЁ ОДНА ПОПЫТКА ↗';$('chasePause').disabled=true;updateHUD();
  }
  function update(dt){
    state.time+=dt;const speed=Math.min(.43,.21+state.time*.0024);state.distance+=dt*speed*110;
    state.xLane+=(state.lane-state.xLane)*Math.min(1,dt*14);
    ['jump','slide','shield','magnet','invincible','flash'].forEach(k=>state[k]=Math.max(0,state[k]-dt));
    state.wave-=dt;if(state.wave<=0){spawn();state.wave=Math.max(1.12,1.65-state.time*.005);}
    for(const item of state.items){
      item.depth+=dt*speed;if(item.hit||item.depth<.89||item.depth>.98)continue;
      const aligned=Math.abs(state.xLane-item.lane)<.34;
      if(item.type==='coin'&&(aligned||state.magnet>0)){item.hit=true;state.coins++;burst(project(item.lane,item.depth).x,project(item.lane,item.depth).y,'#ffdb77');continue;}
      if(!aligned)continue;
      if(item.type==='shield'||item.type==='magnet'){item.hit=true;state[item.type]=item.type==='shield'?8:7;burst(project(item.lane,item.depth).x,560,item.type==='shield'?'#78e8dc':'#ff8bbb');continue;}
      const jumpHeight=state.jump>0?Math.sin((.85-state.jump)/.85*Math.PI):0;
      const avoided=item.type==='barrier'&&jumpHeight>.4||item.type==='arch'&&state.slide>0;
      if(avoided){item.hit=true;continue;}if(state.invincible>0)continue;
      item.hit=true;state.flash=.25;burst(project(item.lane,item.depth).x,550,'#ff5b8e');
      if(state.shield>0)state.shield=0;else state.lives--;
      state.invincible=1.2;if(state.lives<=0){finish();break;}
    }
    state.items=state.items.filter(i=>i.depth<1.15&&!i.hit);
    state.particles.forEach(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=350*dt});state.particles=state.particles.filter(p=>p.life>0);
    state.score=Math.floor(state.distance+state.coins*20);updateHUD();
  }
  function updateHUD(){
    $('chaseScore').textContent=state.score;$('chaseCoins').textContent=state.coins;$('chaseBest').textContent=best;$('chaseLives').textContent='♥'.repeat(state.lives)+'♡'.repeat(3-state.lives);
    $('chaseEffects').textContent=[state.shield>0?`ЩИТ ${Math.ceil(state.shield)}с`:'',state.magnet>0?`МАГНИТ ${Math.ceil(state.magnet)}с`:''].filter(Boolean).join(' · ')||'БАРЬЕР ↑ · АРКА ↓ · ФУРГОН ← →';
  }
  function polygon(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill()}
  function palm(x,y,size){ctx.save();ctx.translate(x,y);ctx.scale(size,size);ctx.strokeStyle='#1c2745';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(0,70);ctx.quadraticCurveTo(12,30,0,0);ctx.stroke();ctx.lineWidth=4;for(let i=-3;i<=3;i++){ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(i*12,-23,i*18,Math.abs(i)*5);ctx.stroke()}ctx.restore()}
  function draw(){
    ctx.imageSmoothingEnabled=false;
    const sky=ctx.createLinearGradient(0,0,0,340);sky.addColorStop(0,'#273965');sky.addColorStop(.5,'#b36d9c');sky.addColorStop(1,'#ffbe96');ctx.fillStyle=sky;ctx.fillRect(0,0,480,640);
    ctx.fillStyle='#ffd1a2';ctx.beginPath();ctx.arc(290,126,53,0,Math.PI*2);ctx.fill();
    for(let i=0;i<15;i++){const x=i*37-10,h=40+(i*43%92);ctx.fillStyle=i%2?'#56577e':'#494565';ctx.fillRect(x,198-h,29,h);ctx.fillStyle='#f9c4c77a';for(let y=208-h;y<194;y+=12){ctx.fillRect(x+5,y,3,5);ctx.fillRect(x+17,y,3,5)}}
    ctx.fillStyle='#4b6b85';ctx.fillRect(0,195,480,445);
    polygon([[199,190],[281,190],[475,640],[5,640]],'#303247');
    polygon([[187,190],[198,190],[5,640],[0,640],[0,602]],'#c37d9d');polygon([[282,190],[294,190],[480,602],[480,640],[475,640]],'#d18ea2');
    const offset=state.distance*.018;
    for(let i=0;i<22;i++){const d=((i/22+offset)%1),p=project(1,d),p2=project(1,Math.min(1.03,d+.022));ctx.strokeStyle='#efd0b990';ctx.lineWidth=1+d*3;for(const k of [-.5,.5]){ctx.beginPath();ctx.moveTo(p.x+k*p.width/3,p.y);ctx.lineTo(p2.x+k*p2.width/3,p2.y);ctx.stroke()}ctx.strokeStyle='#ffffff08';ctx.beginPath();ctx.moveTo(240-p.width/2,p.y);ctx.lineTo(240+p.width/2,p.y);ctx.stroke()}
    for(let i=0;i<7;i++){const d=((i/7+offset*.35)%1),p=project(1,d),side=p.width/2+25,scale=.2+d*1.5;palm(240-side,p.y-80*scale,scale);palm(240+side,p.y-80*scale,scale)}
    state.items.filter(i=>i.depth>=0).sort((a,b)=>a.depth-b.depth).forEach(item=>{
      const p=project(item.lane,item.depth),s=p.scale;ctx.save();ctx.translate(p.x,p.y);ctx.scale(s,s);
      if(item.type==='coin'||item.type==='shield'||item.type==='magnet'){const color=item.type==='coin'?'#ffd76d':item.type==='shield'?'#77e9d8':'#f77fab';ctx.shadowColor=color;ctx.shadowBlur=14;ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(0,-30,16,19,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#3b2949';ctx.textAlign='center';ctx.font='bold 19px monospace';ctx.fillText(item.type==='coin'?'$':item.type==='shield'?'S':'M',0,-23);}
      if(item.type==='barrier'){ctx.fillStyle='#171827';ctx.fillRect(-39,-8,8,10);ctx.fillRect(31,-8,8,10);ctx.fillStyle='#fc9469';ctx.fillRect(-45,-40,90,31);for(let i=-35;i<40;i+=26)polygon([[i,-40],[i+13,-40],[i+2,-9],[i-11,-9]],'#ffe6bd');ctx.fillStyle='#ffcd80';ctx.fillRect(-38,-46,8,6);ctx.fillRect(30,-46,8,6);}
      if(item.type==='arch'){ctx.fillStyle='#435871';ctx.fillRect(-51,-115,9,115);ctx.fillRect(42,-115,9,115);ctx.fillStyle='#f287a8';ctx.fillRect(-55,-120,110,53);ctx.fillStyle='#ffe5c7';ctx.textAlign='center';ctx.font='bold 13px monospace';ctx.fillText('↓ SLIDE ↓',0,-89);}
      if(item.type==='van'){ctx.fillStyle='#171a2a';ctx.fillRect(-38,-80,11,80);ctx.fillRect(27,-80,11,80);ctx.fillStyle='#738fc0';ctx.fillRect(-34,-115,68,111);ctx.fillStyle='#1b2943';ctx.fillRect(-27,-97,54,29);ctx.fillStyle='#c0ddf0';ctx.fillRect(-27,-111,54,8);ctx.fillStyle='#ffbca0';ctx.fillRect(-26,-18,12,8);ctx.fillRect(14,-18,12,8);ctx.fillStyle='#243147';ctx.fillRect(-27,-5,54,8);}
      ctx.restore();
    });
    const player=project(state.xLane,.91),jumpHeight=state.jump>0?Math.sin((.85-state.jump)/.85*Math.PI)*115:0;
    ctx.fillStyle='#10182970';ctx.beginPath();ctx.ellipse(player.x,player.y+4,35,9,0,0,Math.PI*2);ctx.fill();
    const bob=0;
    ctx.save();ctx.translate(player.x,player.y-jumpHeight+bob);
    if(state.shield>0){ctx.strokeStyle='#7cead9';ctx.lineWidth=3;ctx.shadowColor='#7cead9';ctx.shadowBlur=15;ctx.beginPath();ctx.ellipse(0,-56,50,74,0,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0}
    if(state.invincible<=0||Math.floor(state.time*14)%2===0){HumanAvatar.draw(ctx,{id:0,phase:state.time*Math.PI*2*2.7,moving:state.mode==='running',heading:state.mode==='running'?'back':'front',scale:1.7,pose:state.slide>0?'slide':state.jump>0?'jump':'normal',time:state.time});}ctx.restore();
    state.particles.forEach(p=>{ctx.globalAlpha=p.life/.6;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,5,5)});ctx.globalAlpha=1;
    if(state.flash>0){ctx.fillStyle=`rgba(255,80,125,${state.flash})`;ctx.fillRect(0,0,480,640)}
    ctx.fillStyle='#161c34bb';ctx.fillRect(14,16,104,29);ctx.fillStyle='#ffc6df';ctx.font='bold 13px monospace';ctx.fillText('VICE CITY',24,36);
  }
  function frame(now){if(state.mode!=='running')return;const dt=Math.min(.04,Math.max(0,(now-lastTime)/1000));lastTime=now;update(dt);draw();if(state.mode==='running')frameId=requestAnimationFrame(frame)}
  $('chaseStart').addEventListener('click',start);$('chasePause').addEventListener('click',pause);
  game.querySelectorAll('[data-chase]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();action(b.dataset.chase)}));
  document.addEventListener('keydown',e=>{if(game.hidden||!document.getElementById('modal').classList.contains('open'))return;const keys={ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',ArrowUp:'jump',w:'jump',W:'jump',' ':'jump',ArrowDown:'slide',s:'slide',S:'slide'};if(keys[e.key]){e.preventDefault();if(!e.repeat)action(keys[e.key])}if(e.key.toLowerCase()==='p'){e.preventDefault();pause()}});
  let touch;
  canvas.addEventListener('pointerdown',e=>{touch={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)});
  canvas.addEventListener('pointerup',e=>{if(!touch)return;const dx=e.clientX-touch.x,dy=e.clientY-touch.y;touch=null;if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;action(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'slide':'jump')});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.mode==='running')pause()});
  window.addEventListener('avatarready',()=>{if(state)draw()});sprite.onload=()=>{if(state)draw()};
  window.ChaseMe={open:reset,stop};reset();
})();
