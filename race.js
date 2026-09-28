(() => {
  'use strict';
  const $=id=>document.getElementById(id),game=$('raceGame'),canvas=$('raceCanvas'),ctx=canvas.getContext('2d');
  const W=620,H=700,PLAYER=.1,GOAL=3000,LIMIT=120,STEP=1/120,sources=new Map();
  const sections=['OCEAN DRIVE','BISCAYNE BRIDGE','DOWNTOWN'];
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
  let s,raf=0,last=0,accumulator=0,best=0,bestTime=0,swipe=null,sound=false,audio;
  try{best=Math.max(0,Number(localStorage.getItem('viceBest'))||0);bestTime=Math.max(0,Number(localStorage.getItem('viceBestTime'))||0)}catch{}
  const held=action=>[...sources.values()].includes(action);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const clock=t=>`${Math.floor(Math.max(0,t)/60)}:${String(Math.floor(Math.max(0,t)%60)).padStart(2,'0')}`;
  function tone(freq,duration=.1,type='sine',volume=.04){if(!sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration)}catch{}}
  function overlay(title,message,button){$('raceOverlay').hidden=false;$('raceTitle').textContent=title;$('raceMessage').textContent=message;$('raceStart').textContent=button;if(s&&['paused','over'].includes(s.mode)&&!game.hidden)$('raceStart').focus?.({preventScroll:true})}
  function controls(){const paused=s.mode==='paused';$('racePause').textContent=paused?'▶':'Ⅱ';$('racePause').setAttribute?.('aria-label',paused?'Продолжить':'Пауза');$('racePause').setAttribute?.('aria-pressed',String(paused));game.querySelectorAll('[data-race]').forEach(b=>{b.classList?.toggle('held',held(b.dataset.race));if(['nitro','brake'].includes(b.dataset.race))b.setAttribute?.('aria-pressed',String(held(b.dataset.race)))})}
  function stop(){cancelAnimationFrame(raf);raf=0;sources.clear();swipe=null;accumulator=0;if(s)s.mode='closed'}
  function reset(){stop();s={mode:'ready',lane:1,target:1,score:0,distance:0,time:LIMIT,elapsed:0,objects:[],nextRow:95,lastSafe:1,row:0,hp:3,invincible:0,shield:0,nitro:60,nitroLocked:false,boost:false,speed:0,damage:0,shake:0,particles:[],section:0,passed:0,near:0,pickups:0,hits:0,countdown:3,toast:'Три района · 3 км · 2 минуты на заезд.',toastTime:5};overlay('VICE CITY RACE','Одно нажатие A / D или ← → — одна полоса. Удерживай W / пробел для нитро, S для тормоза. Щит поглощает один удар. Доезжай за 2 минуты: три аварии — сход.','НАЧАТЬ ЗАЕЗД ↗');hud();draw()}
  function start(){if(s.mode==='paused')s.mode=s.resumeMode;else{reset();s.mode='countdown'}sources.clear();$('raceOverlay').hidden=true;canvas.focus?.({preventScroll:true});last=performance.now();accumulator=0;controls();cancelAnimationFrame(raf);raf=requestAnimationFrame(frame)}
  function pause(){if(s.mode==='paused')return start();if(!['running','countdown'].includes(s.mode))return;s.resumeMode=s.mode;s.mode='paused';sources.clear();swipe=null;cancelAnimationFrame(raf);overlay('ПАУЗА','Таймер остановлен. Продолжи заезд с тем же здоровьем и бустами.','ПРОДОЛЖИТЬ ↗');controls()}
  function notify(text){s.toast=text;s.toastTime=2.5}
  function steer(d){if(s.mode!=='running')return;s.target=clamp(s.target+d,0,2)}
  function setInput(action,source,on){if(on&&['running','countdown'].includes(s.mode)){if(sources.has(source))return;sources.set(source,action);if(action==='left'||action==='right')steer(action==='left'?-1:1)}else sources.delete(source);controls()}
  function finish(won){if(s.mode!=='running')return;s.mode='over';sources.clear();cancelAnimationFrame(raf);const medal=s.elapsed<=70?'ЗОЛОТО':s.elapsed<=85?'СЕРЕБРО':'БРОНЗА',bonus=won?1000+(s.elapsed<=70?500:s.elapsed<=85?250:0)+s.hp*100:0;s.score=Math.floor(s.score)+bonus;best=Math.max(best,s.score);if(won)bestTime=bestTime?Math.min(bestTime,s.elapsed):s.elapsed;try{localStorage.setItem('viceBest',best);if(bestTime)localStorage.setItem('viceBestTime',bestTime)}catch{}overlay(won?`ФИНИШ · ${medal}`:'ЗАЕЗД ОКОНЧЕН',`${Math.floor(s.score)} очков · ${s.elapsed.toFixed(1)} с · ${Math.floor(s.distance)} м. Обгоны: ${s.passed}, близкие: ${s.near}, аварии: ${s.hits}. ${won?`Бонус финиша +${bonus}. Лучшее время ${bestTime.toFixed(1)} с.`:s.hp<=0?'Машина разбита. Тормози заранее и выбирай свободную полосу.':'Время вышло. Нитро помогает на свободных участках.'}`,'ЕЩЁ ЗАЕЗД ↗');tone(won?660:130,.35);hud();controls()}
  function spawn(){
    const candidates=[0,1,2].filter(l=>Math.abs(l-s.lastSafe)<=1),safe=candidates[Math.floor(Math.random()*candidates.length)];s.lastSafe=safe;
    const others=[0,1,2].filter(l=>l!==safe),hard=s.distance>1000&&Math.random()<(s.distance>2000?.68:.42);
    const lanes=hard?others:[others[Math.floor(Math.random()*2)]],pace=.9+Math.random()*.12;
    for(const lane of lanes){const kind=s.distance>600&&Math.random()<.25?'van':Math.random()<.4?'sport':'sedan';s.objects.push({lane,z:1,type:'car',kind,pace,color:['#42cbb9','#f6c977','#a899ef','#e887a0'][Math.floor(Math.random()*4)],passed:false,hit:false})}
    // Consecutive escape lanes differ by at most one lane; every row has an exit.
    if(s.row%2===0||Math.random()<.38)s.objects.push({lane:safe,z:1,type:s.hp<3&&s.row%7===0?'repair':['nitro','shield','cash'][s.row%3],pace,passed:false});
    s.row++;s.nextRow+=s.distance>2000?65:s.distance>1000?72:82;
  }
  function project(lane,z){const q=1-z,width=120+q*q*420;return{x:310+(lane-1)*width/3,y:130+q*q*570,scale:.16+q*.84,width}}
  function dimensions(o){const p=project(o.lane,o.z);return {...p,w:(o.kind==='van'?66:57)*p.scale,h:(o.kind==='van'?116:100)*p.scale}}
  function burst(x,y,color,n=12){for(let i=0;i<n;i++){const angle=Math.random()*Math.PI*2,v=35+Math.random()*100;s.particles.push({x,y,vx:Math.cos(angle)*v,vy:Math.sin(angle)*v,life:.45,max:.45,color})}}
  function collide(o,p){o.hit=true;if(s.invincible>0)return;if(s.shield>0){s.shield=0;s.invincible=.8;notify('ЩИТ ПОГЛОТИЛ УДАР');burst(p.x,p.y,'#84f4df');tone(340,.12)}else{s.hp--;s.hits++;s.invincible=1.4;s.damage=.7;s.shake=.35;burst(p.x,p.y-35,'#ffd48a',20);notify('АВАРИЯ · −1 ЖИЗНЬ');tone(90,.22,'sawtooth',.06);if(s.hp<=0)finish(false)}}
  function update(dt){
    if(s.mode==='countdown'){s.countdown-=dt;if(s.countdown<=0){s.mode='running';tone(660,.15);notify('ПОЕХАЛИ · OCEAN DRIVE')}return}
    if(s.mode!=='running')return;s.elapsed+=dt;s.time=Math.max(0,LIMIT-s.elapsed);
    for(const k of ['invincible','shield','toastTime','damage','shake'])s[k]=Math.max(0,s[k]-dt);
    s.lane+=(s.target-s.lane)*(1-Math.exp(-dt*14));
    if(s.nitro<=.1)s.nitroLocked=true;if(!held('nitro')||s.nitro>=25)s.nitroLocked=false;
    s.boost=held('nitro')&&!s.nitroLocked&&s.nitro>.1&&!held('brake');s.nitro=clamp(s.nitro+(s.boost?-26:6)*dt,0,100);
    const desired=(140+Math.min(35,s.distance/85))*(held('brake')?.58:1)+(s.boost?65:0);
    s.speed+=(desired*(s.damage>0?.55:1)-s.speed)*(1-Math.exp(-dt*(held('brake')?7:2.5)));
    const travel=s.speed/3.6*dt;s.distance+=travel;s.score+=travel*(s.boost?1.4:1);
    const section=Math.min(2,Math.floor(s.distance/1000));if(section!==s.section){s.section=section;notify(`УЧАСТОК ${section+1}/3 · ${sections[section]}`);tone(520,.2)}
    if(s.distance>=s.nextRow&&s.distance<GOAL-180)spawn();
    const player=dimensions({lane:s.lane,z:PLAYER}),px=player.x,py=player.y;
    for(const o of s.objects){o.z-=travel/170*o.pace;const p=dimensions(o),dx=Math.abs(px-p.x),dy=Math.abs(py-p.y);
      // Fixed substeps cover the full visible longitudinal overlap, using drawn vehicle sizes.
      if(o.type==='car'){
        if(!o.hit&&dx<(player.w+p.w)*.47&&dy<(player.h+p.h)*.43)collide(o,player);
        if(s.mode!=='running')return;
        if(!o.passed&&p.y-p.h/2>py+player.h/2){o.passed=true;if(!o.hit){s.passed++;s.score+=30;if(dx<(player.w+p.w)*.8){s.near++;s.score+=50;notify('БЛИЗКИЙ ОБГОН · +80');tone(430,.06)}}}
      }else if(!o.passed&&dx<player.w*.5+18*p.scale&&dy<player.h*.35+15*p.scale){
        o.passed=true;s.pickups++;burst(p.x,p.y,o.type==='shield'?'#84f4df':'#ffe09c');tone(780,.08);
        if(o.type==='nitro'){s.nitro=clamp(s.nitro+50,0,100);notify('КАНИСТРА · +50 НИТРО')}
        else if(o.type==='shield'){s.shield=10;notify('ЩИТ · 1 УДАР / 10 СЕК')}
        else if(o.type==='repair'){s.hp=Math.min(3,s.hp+1);notify('РЕМОНТ · +1 ЖИЗНЬ')}
        else{s.score+=150;notify('НАЛИЧНЫЕ · +150')}
      }
    }
    s.objects=s.objects.filter(o=>o.z>-.22&&!(o.type!=='car'&&o.passed));
    for(const p of s.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=150*dt}s.particles=s.particles.filter(p=>p.life>0);
    if(s.distance>=GOAL){s.distance=GOAL;finish(true)}else if(s.time<=0)finish(false);
  }
  function hud(){
    $('raceScore').textContent=Math.floor(s.score);$('raceBest').textContent=Math.floor(best);$('raceHealth').textContent='♥'.repeat(s.hp)+'♡'.repeat(3-s.hp);$('raceSpeed').textContent=`${Math.round(s.speed)} КМ/Ч`;$('raceDistance').textContent=`${Math.floor(s.distance)} / ${GOAL} М`;
    if($('raceTimer')){$('raceTimer').textContent=clock(s.time);$('raceTimer').classList?.toggle('urgent',s.time<20)}
    if($('raceSection'))$('raceSection').textContent=`0${s.section+1} · ${sections[s.section]}`;
    $('raceNitroFill').style.width=`${s.nitro}%`;$('raceBoost').textContent=s.toastTime>0?s.toast:s.boost?'НИТРО · +65 КМ/Ч · ОЧКИ ×1.4':s.nitroLocked?'НИТРО ОСТЫВАЕТ · ОТПУСТИ W':s.shield>0?`ЩИТ · ${s.shield.toFixed(1)} СЕК`:'ЗОЛОТО ≤70 С · СЕРЕБРО ≤85 С · W — НИТРО';
    $('raceRoute').style.width=`${Math.min(100,s.distance/GOAL*100)}%`;
  }
  function car(x,y,scale,color,player=false,kind='sedan'){
    const w=(kind==='van'?66:57)*scale,h=(kind==='van'?116:100)*scale;ctx.save();ctx.translate(x,y);ctx.rotate(player?(s.target-s.lane)*.035:0);
    ctx.fillStyle='#05091688';ctx.beginPath();ctx.ellipse(4,8,w*.7,h*.54,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#090e17';for(const yy of [-h*.3,h*.22]){ctx.fillRect(-w*.58,yy,w*.2,h*.2);ctx.fillRect(w*.38,yy,w*.2,h*.2)}
    const g=ctx.createLinearGradient(-w/2,0,w/2,0);g.addColorStop(0,'#111b29');g.addColorStop(.18,color);g.addColorStop(.65,color);g.addColorStop(1,'#172637');ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,(kind==='van'?4:9)*scale);ctx.fill();
    ctx.strokeStyle='#fff6';ctx.lineWidth=scale;ctx.stroke();ctx.fillStyle='#f7dcb72a';ctx.fillRect(-w*.35,-h*.43,w*.7,h*.14);ctx.fillStyle='#14263b';ctx.beginPath();ctx.moveTo(-w*.38,-h*.13);ctx.lineTo(-w*.3,-h*.3);ctx.lineTo(w*.3,-h*.3);ctx.lineTo(w*.38,-h*.13);ctx.closePath();ctx.fill();
    ctx.fillStyle='#8fd6e533';ctx.fillRect(-w*.29,-h*.26,w*.3,h*.08);ctx.fillStyle='#10202d';ctx.fillRect(-w*.33,h*.1,w*.66,h*.18);ctx.strokeStyle='#f7dcb755';ctx.strokeRect(-w*.35,-h*.06,w*.7,h*.13);
    if(kind==='sport'){ctx.fillStyle='#152538';ctx.fillRect(-w*.45,h*.33,w*.9,5*scale);ctx.fillStyle='#fbe4c950';ctx.fillRect(-w*.06,-h*.46,w*.12,h*.5)}
    if(kind==='van'){ctx.strokeStyle='#0005';for(let yy=-h*.07;yy<h*.31;yy+=h*.1){ctx.beginPath();ctx.moveTo(-w*.37,yy);ctx.lineTo(w*.37,yy);ctx.stroke()}}
    ctx.fillStyle='#ffeed2';ctx.fillRect(-w*.42,-h*.46,w*.24,h*.045);ctx.fillRect(w*.18,-h*.46,w*.24,h*.045);
    ctx.shadowColor='#ff477f';ctx.shadowBlur=player&&held('brake')?15:4;ctx.fillStyle=player&&held('brake')?'#ffb19c':'#ff477f';ctx.fillRect(-w*.42,h*.4,w*.25,h*.055);ctx.fillRect(w*.17,h*.4,w*.25,h*.055);ctx.shadowBlur=0;
    if(player&&s.boost){ctx.fillStyle='#64e7ed';ctx.shadowColor='#64e7ed';ctx.shadowBlur=14;for(const xx of [-w*.23,w*.23]){ctx.beginPath();ctx.moveTo(xx-4*scale,h/2);ctx.lineTo(xx+4*scale,h/2);ctx.lineTo(xx,h/2+(22+(reduced?0:Math.sin(s.elapsed*40)*8))*scale);ctx.fill()}}
    ctx.restore();
  }
  function pickup(o,p){ctx.save();ctx.translate(p.x,p.y);ctx.scale(p.scale,p.scale);ctx.shadowColor=o.type==='shield'?'#7fe8da':'#ffbd86';ctx.shadowBlur=12;ctx.fillStyle='#131f37';ctx.strokeStyle=o.type==='shield'?'#7fe8da':'#ffe09c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,24,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    if(o.type==='shield'){ctx.fillStyle='#7fe8da';ctx.beginPath();ctx.moveTo(-12,-12);ctx.lineTo(0,-16);ctx.lineTo(12,-12);ctx.lineTo(10,3);ctx.lineTo(0,15);ctx.lineTo(-10,3);ctx.closePath();ctx.fill();ctx.strokeStyle='#173640';ctx.beginPath();ctx.moveTo(-6,-1);ctx.lineTo(-1,5);ctx.lineTo(7,-6);ctx.stroke()}
    else if(o.type==='nitro'){ctx.fillStyle='#ff8db9';ctx.fillRect(-11,-10,22,26);ctx.fillRect(1,-16,9,6);ctx.strokeStyle='#513044';ctx.strokeRect(-7,-5,14,16);ctx.beginPath();ctx.moveTo(-7,-5);ctx.lineTo(7,11);ctx.moveTo(7,-5);ctx.lineTo(-7,11);ctx.stroke()}
    else if(o.type==='repair'){ctx.fillStyle='#ffe09c';ctx.fillRect(-5,-14,10,28);ctx.fillRect(-14,-5,28,10)}
    else{ctx.fillStyle='#84d7ad';ctx.fillRect(-16,-8,32,18);ctx.strokeStyle='#194d41';ctx.strokeRect(-13,-5,26,12);ctx.fillStyle='#ffe5ac';ctx.fillRect(-3,-8,6,18)}ctx.restore()}
  function draw(){
    const cw=canvas.clientWidth||620,ch=canvas.clientHeight||700,dpr=Math.min(2,window.devicePixelRatio||1);if(canvas.width!==Math.round(cw*dpr)||canvas.height!==Math.round(ch*dpr)){canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr)}ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
    let g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,s.section===2?'#252642':'#433456');g.addColorStop(.17,'#d16e98');g.addColorStop(.23,'#ffb779');g.addColorStop(.235,'#244753');g.addColorStop(1,'#102535');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.fillStyle='#ffdb98';ctx.beginPath();ctx.arc(310,105,42,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#253044';for(let i=0;i<19;i++){const x=i*35,h=22+i*47%61;ctx.fillRect(x,136-h,26,h);ctx.fillStyle='#ffd8bd66';for(let yy=141-h;yy<129;yy+=12){ctx.fillRect(x+7,yy,3,4);ctx.fillRect(x+17,yy,3,4)}ctx.fillStyle='#253044'}
    ctx.fillStyle='#ee93b822';for(let i=0;i<8;i++)ctx.fillRect(20+i*73,153+i*21,50-i*3,2);
    ctx.save();if(s.shake>0&&!reduced)ctx.translate(Math.sin(s.elapsed*90)*s.shake*9,Math.cos(s.elapsed*70)*s.shake*5);
    ctx.fillStyle='#242737';ctx.beginPath();ctx.moveTo(250,130);ctx.lineTo(40,700);ctx.lineTo(580,700);ctx.lineTo(370,130);ctx.closePath();ctx.fill();ctx.strokeStyle='#ffa0c2';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(250,130);ctx.lineTo(40,700);ctx.moveTo(370,130);ctx.lineTo(580,700);ctx.stroke();
    // Each marker has its own cyclic world position; wraps occur only offscreen.
    for(let i=0;i<20;i++){const z=1-((i/20+s.distance/170)%1),p=project(1,z);for(const lane of [.5,1.5]){const q=project(lane,z);ctx.fillStyle='#ffdfba99';ctx.fillRect(q.x-2*p.scale,q.y,4*p.scale,15*p.scale)}}
    const roadside=[];for(let i=0;i<9;i++){const z=1-((i/9+s.distance/170)%1);roadside.push({z,p:project(1,z)})}roadside.sort((a,b)=>b.z-a.z);
    for(const {p}of roadside)for(const side of [-1,1]){const x=310+side*(p.width/2+24*p.scale);if(s.section===1){ctx.strokeStyle='#7fd6d9';ctx.lineWidth=4*p.scale;ctx.beginPath();ctx.moveTo(x,p.y+40*p.scale);ctx.lineTo(x,p.y-100*p.scale);ctx.stroke();ctx.strokeStyle='#fbbca0';ctx.lineWidth=2*p.scale;ctx.beginPath();ctx.moveTo(x,p.y-100*p.scale);ctx.lineTo(x-side*40*p.scale,p.y);ctx.stroke()}
      else if(s.section===2){ctx.fillStyle='#19273a';ctx.fillRect(x-(side<0?65*p.scale:0),p.y-120*p.scale,65*p.scale,140*p.scale);ctx.fillStyle=iColor(side);for(let yy=0;yy<4;yy++)ctx.fillRect(x+(side<0?-52:15)*p.scale,p.y-(105-yy*27)*p.scale,30*p.scale,6*p.scale)}
      else{ctx.strokeStyle='#21333e';ctx.lineWidth=6*p.scale;ctx.beginPath();ctx.moveTo(x,p.y+35*p.scale);ctx.lineTo(x,p.y-45*p.scale);ctx.stroke();ctx.strokeStyle='#194839';ctx.lineWidth=6*p.scale;for(let j=-2;j<=2;j++){ctx.beginPath();ctx.moveTo(x,p.y-45*p.scale);ctx.quadraticCurveTo(x+j*14*p.scale,p.y-75*p.scale,x+j*26*p.scale,p.y-42*p.scale);ctx.stroke()}}}
    if(s.distance>GOAL-170){const p=project(1,clamp(PLAYER+(GOAL-s.distance)/170,PLAYER,1));for(let row=0;row<2;row++)for(let col=0;col<18;col++){ctx.fillStyle=(row+col)%2?'#ede5d4':'#19212f';ctx.fillRect(310-p.width/2+col*p.width/18,p.y+row*9*p.scale,p.width/18+1,9*p.scale)}ctx.fillStyle='#ffe2b0';ctx.font=`900 ${Math.max(10,20*p.scale)}px monospace`;ctx.textAlign='center';ctx.fillText('FINISH',310,p.y-20*p.scale)}
    const items=s.objects.map(o=>({o,z:o.z}));items.push({z:PLAYER,player:true});items.sort((a,b)=>b.z-a.z);
    for(const item of items){if(item.player){const p=project(s.lane,PLAYER);if(s.shield>0){ctx.strokeStyle='#84f4df';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(p.x,p.y,38*p.scale,60*p.scale,0,0,Math.PI*2);ctx.stroke()}ctx.globalAlpha=s.invincible>0?(reduced?.65:.6+Math.sin(s.elapsed*30)*.25):1;car(p.x,p.y,p.scale,'#f47d9d',true,'sport');ctx.globalAlpha=1}
      else{const o=item.o,p=project(o.lane,o.z);if(o.type==='car')car(p.x,p.y,p.scale,o.color,false,o.kind);else if(!o.passed)pickup(o,p)}}
    if(s.boost&&!reduced){ctx.strokeStyle='#79e9e855';ctx.lineWidth=2;for(let i=0;i<12;i++){const y=220+((i*47+s.distance*5)%450),side=i%2?1:-1,x=310+side*(160+(y-220)*.25);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+side*18,y+55);ctx.stroke()}}
    for(const p of s.particles){ctx.globalAlpha=p.life/p.max;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4)}ctx.globalAlpha=1;ctx.restore();
    ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.font='bold 14px monospace';ctx.fillStyle='#fff0d7';ctx.fillText(`${sections[s.section]} · VICE CITY`,310,28);
    if(s.mode==='countdown'){ctx.fillStyle='#10192788';ctx.fillRect(0,0,W,H);ctx.fillStyle='#ceff72';ctx.font='900 110px Impact,sans-serif';ctx.fillText(Math.ceil(s.countdown),310,390)}
  }
  const iColor=side=>side<0?'#ff89be':'#7de6df';
  function frame(now){if(!['running','countdown'].includes(s.mode))return;accumulator+=clamp((now-last)/1000,0,.25);last=now;while(accumulator>=STEP&&['running','countdown'].includes(s.mode)){update(STEP);accumulator-=STEP}hud();draw();if(['running','countdown'].includes(s.mode))raf=requestAnimationFrame(frame)}
  const codeActions={KeyA:'left',KeyD:'right',ArrowLeft:'left',ArrowRight:'right',KeyW:'nitro',Space:'nitro',ArrowUp:'nitro',KeyS:'brake',ArrowDown:'brake'},keyActions={a:'left',ф:'left',d:'right',в:'right',w:'nitro',ц:'nitro',' ':'nitro',s:'brake',ы:'brake'};
  const sourceFor=e=>'key:'+(e.code||e.key.toLowerCase());
  document.addEventListener('keydown',e=>{if(game.hidden||s.mode==='closed')return;
    // Focused buttons retain native Enter/Space activation. Hold controls also work with a keyboard.
    const button=e.target?.closest?.('button');if(button&&(['Space','Enter'].includes(e.code)||[' ','Enter'].includes(e.key))){if(button.dataset?.race){e.preventDefault();if(!e.repeat)setInput(button.dataset.race,sourceFor(e),true)}return}
    const action=codeActions[e.code]||codeActions[e.key]||keyActions[(e.key||'').toLowerCase()];if(action){e.preventDefault();if(!e.repeat)setInput(action,sourceFor(e),true)}
    if(!e.repeat&&(e.code==='KeyP'||['p','з'].includes((e.key||'').toLowerCase()))){e.preventDefault();pause()}
  });
  document.addEventListener('keyup',e=>{sources.delete(sourceFor(e));controls()});
  game.querySelectorAll('[data-race]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture?.(e.pointerId);setInput(b.dataset.race,'pointer:'+e.pointerId,true)});['pointerup','pointercancel','lostpointercapture'].forEach(name=>b.addEventListener(name,e=>{sources.delete('pointer:'+e.pointerId);controls()}));b.addEventListener('click',e=>{if(e.detail===0){const action=b.dataset.race,source='assistive:'+action;if(action==='left'||action==='right'){setInput(action,source,true);setInput(action,source,false)}else{setInput(action,source,!sources.has(source));b.setAttribute?.('aria-pressed',String(sources.has(source)))}}})});
  canvas.addEventListener('pointerdown',e=>{if(s.mode!=='running')return;e.preventDefault();canvas.setPointerCapture?.(e.pointerId);swipe={id:e.pointerId,x:e.clientX}});canvas.addEventListener('pointermove',e=>{const threshold=Math.max(24,(canvas.clientWidth||620)*.08);if(swipe?.id===e.pointerId&&Math.abs(e.clientX-swipe.x)>threshold){steer(e.clientX>swipe.x?1:-1);swipe.x=e.clientX}});['pointerup','pointercancel','lostpointercapture'].forEach(name=>canvas.addEventListener(name,()=>swipe=null));
  $('raceStart').addEventListener('click',start);$('racePause').addEventListener('click',pause);if($('raceSound'))$('raceSound').addEventListener('click',()=>{sound=!sound;$('raceSound').textContent=sound?'ЗВУК ВКЛ':'ЗВУК ВЫКЛ';$('raceSound').setAttribute?.('aria-pressed',String(sound));if(sound)tone(440)});
  window.addEventListener('blur',()=>{sources.clear();if(['running','countdown'].includes(s.mode))pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&['running','countdown'].includes(s.mode))pause()});window.addEventListener('resize',draw);canvas.tabIndex=0;
  window.ViceCityRace={open:reset,stop};reset();
})();
