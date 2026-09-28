(() => {
  'use strict';
  const $=id=>document.getElementById(id),game=$('duoGame'),canvas=$('duoCanvas'),ctx=canvas.getContext('2d'),P=window.DuoPhysics;
  const levels=[
    {name:'НОЧЬ В ДОКАХ',time:180,heatRate:24,cool:7,hack:2.2,loot:1.6,
      walls:[{x:230,y:90,w:100,h:150},{x:380,y:90,w:170,h:75},{x:380,y:270,w:95,h:140},{x:550,y:220,w:110,h:75},{x:735,y:245,w:90,h:95},{x:220,y:355,w:95,h:70}],
      terminal:{x:770,y:115},safe:{x:655,y:395},car:{x:110,y:465},
      patrols:[['security',[[355,200],[695,200]],50],['police',[[505,455],[815,455]],54],['security',[[160,80],[160,320]],50]]},
    {name:'ОБЛАВА У КЛУБА',time:150,heatRate:30,cool:5,hack:3.2,loot:2.4,
      walls:[{x:220,y:90,w:95,h:160},{x:375,y:80,w:180,h:90},{x:660,y:90,w:90,h:130},{x:370,y:285,w:100,h:125},{x:560,y:285,w:100,h:70},{x:225,y:365,w:75,h:75},{x:740,y:330,w:85,h:80}],
      terminal:{x:810,y:115},safe:{x:690,y:450},car:{x:105,y:465},
      patrols:[['security',[[340,215],[625,215]],65],['security',[[600,380],[700,380],[700,490],[505,490]],63],['security',[[790,170],[790,285],[845,285],[845,65]],61],['police',[[150,90],[150,335]],72],['police',[[335,450],[510,450],[510,235],[335,235]],70],['police',[[80,300],[190,300],[190,495],[80,495]],68]]}
    ,{name:'ПОСЛЕДНИЙ ЗАКАЗ · BIG SMOKE',time:210,heatRate:28,cool:4,hack:0,loot:0,
      walls:[{x:285,y:105,w:105,h:90},{x:285,y:355,w:105,h:90},{x:505,y:245,w:100,h:70},{x:700,y:270,w:80,h:70}],
      terminal:null,safe:null,car:{x:105,y:465},
      patrols:[['security',[[425,100],[620,100],[620,195],[425,195]],65],['security',[[440,445],[655,445]],65]]}
  ];

  const weapons=[{name:'9MM',clip:12,damage:34,interval:.23,reload:1.2},{name:'M1911',clip:8,damage:42,interval:.34,reload:1.45}];
  let walls,terminal,safe,car,s,raf=0,last=0,best=0,unlocked=0,camera={zoom:1,ox:0,oy:0};const keys=new Set(),inputs=new Map();let audio=null,soundOn=true;
  function input(action,held,source){if(!action)return;if(held){inputs.set(source,action);keys.add(action)}else{inputs.delete(source);if(![...inputs.values()].includes(action))keys.delete(action)}}
  function clearInput(){inputs.clear();keys.clear()}
  function initSound(){if(!soundOn)return;try{const Audio=window.AudioContext||window.webkitAudioContext;if(Audio){audio??=new Audio();if(audio.state==='suspended')audio.resume().catch(()=>{})}}catch{}}
  function gunSound(heavy){if(!soundOn||!audio||audio.state!=='running')return;try{const now=audio.currentTime,duration=heavy ? .18 : .09,buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/(audio.sampleRate*(heavy ? .04 : .018)));const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=heavy?1800:3300;gain.gain.value=heavy ? .12 : .06;source.connect(filter);filter.connect(gain);gain.connect(audio.destination);source.start(now);const osc=audio.createOscillator(),thump=audio.createGain();osc.frequency.setValueAtTime(heavy?110:190,now);osc.frequency.exponentialRampToValueAtTime(45,now+.09);thump.gain.setValueAtTime(heavy ? .1 : .04,now);thump.gain.exponentialRampToValueAtTime(.001,now+.11);osc.connect(thump);thump.connect(audio.destination);osc.start(now);osc.stop(now+.12)}catch{}}
  function asset(src){const im=new Image();im.onload=()=>{if(s)draw()};im.src=src;return im}
  const enemies=asset('enemy-animation.png'),combat=asset('combat-animation-v2.png'),bossAtlas=asset('big-smoke-animation-v2.png');
  try{best=Number(localStorage.getItem('duoBest'))||0;unlocked=Math.max(0,Math.min(2,Math.floor(Number(localStorage.getItem('duoLevel'))||0)))}catch{}
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),alive=p=>p.hp>0;
  function reset(level=0){
    stop();const n=typeof level==='number'?Math.max(0,Math.min(2,Math.floor(level))):0,c=levels[n];({walls,terminal,safe,car}=c);
    const human=(x,y)=>({x,y,face:1,phase:0,moving:false,heading:'front',hp:100,maxHp:100,flash:0,hurt:0,fire:0,reload:0,nav:[],navTime:0});
    s={level:n,mode:'ready',active:0,heroes:[human(110,410),human(145,410)],
      guards:c.patrols.map(([type,points,speed])=>({...human(...points[0]),type,speed,hp:72,maxHp:72,angle:Math.atan2(points[1][1]-points[0][1],points[1][0]-points[0][0]),route:points.map(([x,y])=>({x,y})),step:1,ammo:6,cooldown:.6,windup:0,memory:0,deadTime:0})),
      boss:n===2?{...human(725,155),type:'boss',hp:840,maxHp:840,angle:Math.PI,route:[{x:725,y:155},{x:805,y:435},{x:650,y:455},{x:625,y:145}],step:1,ammo:7,cooldown:1.4,windup:0,burst:0,burstTimer:0,engaged:false,deadTime:0}:null,
      time:c.time,elapsed:0,heat:0,hacked:n===2,loot:false,progress:0,interaction:null,crouch:false,dash:0,dashCooldown:0,decoyCooldown:0,decoy:null,bullets:[],sparks:[],kills:0,pointerAim:null,pointerTimer:0,
      medkits:(n===2?[{x:155,y:210},{x:465,y:465},{x:840,y:440}]:[{x:70,y:240},{x:830,y:490}]).map(p=>({...p,taken:false})),
      toast:n===2?'Биг Смоук ждёт на арене. Уклоняйтесь от дигла и держитесь за укрытиями.':n===1?'Шесть вооружённых патрулей. Стреляй или пройди скрытно.':'Терминал — на северо-востоке. Оружие: J / кнопка ОГОНЬ.',toastTime:5};
    s.heroes.forEach((h,i)=>{h.ammo=weapons[i].clip;h.cooldown=0;h.angle=-Math.PI/2});
    showOverlay(`0${n+1} · ${c.name}`,n===2?'Босс — Биг Смоук с Desert Eagle. Красный луч предупреждает о выстреле. На половине здоровья он переходит к очередям. Победите его и выведите обоих к машине. Аптечки лежат на арене.':'Второй герой взламывает терминал, первый забирает груз. J — огонь с автонаведением, мышь — прицел и стрельба, R — перезарядка. Укрытия защищают от пуль, шум выстрелов поднимает тревогу.','НАЧАТЬ ДЕЛО ↗');hud();draw();
  }
  function stop(){cancelAnimationFrame(raf);raf=0;clearInput();if(s)s.mode='closed'}
  function showOverlay(title,message,button){$('duoOverlay').hidden=false;$('duoTitle').textContent=title;$('duoMessage').textContent=message;$('duoStart').textContent=button}
  function start(){
    initSound();
    if(s.mode!=='paused'){const next=s.mode==='cleared'?s.level+1:s.mode==='complete'?0:s.level;reset(next)}
    clearInput();s.mode='running';$('duoOverlay').hidden=true;canvas.focus?.({preventScroll:true});last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);
  }
  function pause(){if(s.mode==='paused')return start();if(s.mode!=='running')return;s.mode='paused';clearInput();s.pointerAim=null;cancelAnimationFrame(raf);showOverlay('ПАУЗА','Бой приостановлен. Здоровье, патроны и противники сохраняются.','ПРОДОЛЖИТЬ ↗')}
  function notify(text){s.toast=text;s.toastTime=3}
  function swap(){if(s.mode!=='running')return;s.active=1-s.active;s.progress=0;s.interaction=null;s.pointerAim=null;notify(s.active?'Второй герой · M1911':'Первый герой · 9MM');hud()}
  function blocked(x,y){return x<25||x>875||y<35||y>525||walls.some(r=>x>=r.x-13&&x<=r.x+r.w+13&&y>=r.y-13&&y<=r.y+r.h+13)}
  function orient(p,angle){p.angle=angle;const dx=Math.cos(angle),dy=Math.sin(angle);p.face=dx<0?-1:1;p.heading=Math.abs(dy)>Math.abs(dx)*1.4?(dy<0?'back':'front'):'side'}
  function move(p,dx,dy){const ox=p.x,oy=p.y;if(!blocked(p.x+dx,p.y))p.x+=dx;if(!blocked(p.x,p.y+dy))p.y+=dy;const mx=p.x-ox,my=p.y-oy,d=Math.hypot(mx,my);if(d>.01){p.phase+=d/45*Math.PI*2;p.moving=true;orient(p,Math.atan2(my,mx))}}
  const lineClear=(a,b)=>P.clear(a,b,walls),clearPath=(a,b)=>P.clear(a,b,walls,13);
  function approach(p,target,speed,dt){
    p.navTime-=dt;let dest=target;
    if(!clearPath(p,target)){
      if(p.navTime<=0||!p.nav.length){p.nav=P.path(p,target,walls,blocked);p.navTime=.8}
      while(p.nav.length>1&&clearPath(p,p.nav[1]))p.nav.shift();while(p.nav.length&&dist(p,p.nav[0])<7)p.nav.shift();
      if(!p.nav.length)return;dest=p.nav[0];
    }else p.nav=[];
    const d=dist(p,dest);if(d>.1){const step=Math.min(d,speed*dt);move(p,(dest.x-p.x)/d*step,(dest.y-p.y)/d*step)}
  }
  function dash(){if(s.mode!=='running'||s.dashCooldown>0)return;s.dash=.3;s.dashCooldown=4;notify('Рывок: уклоняйся от линии огня!')}
  function distract(){if(s.mode!=='running'||s.decoyCooldown>0)return;const p=s.heroes[s.active],target={x:p.x+60*p.face,y:p.y};if(blocked(target.x,target.y)){notify('Перед тобой укрытие. Брось отвлечение в проход.');return}s.decoy={...target,life:5};s.decoyCooldown=9;notify('Шум отвлекает ближайший живой патруль.')}
  function reload(){const h=s.heroes[s.active],w=weapons[s.active];if(s.mode!=='running'||h.reload>0||h.ammo===w.clip)return;h.reload=w.reload;h.flash=0;notify('Перезарядка…');hud()}
  function targets(){return [...s.guards,...(s.boss?[s.boss]:[])].filter(alive)}
  function chooseAim(h){
    if(s.pointerAim&&s.pointerTimer>0)return s.pointerAim;
    const visible=targets().filter(g=>dist(h,g)<560&&lineClear(h,g)).sort((a,b)=>dist(h,a)-dist(h,b));
    return visible[0]||{x:h.x+Math.cos(h.angle)*300,y:h.y+Math.sin(h.angle)*300};
  }
  function projectile(owner,target,damage,speed,team){
    const angle=Math.atan2(target.y-owner.y,target.x-owner.x);orient(owner,angle);owner.flash=.12;owner.fire=.28;gunSound(owner.type==='boss');s.sparks.push({x:owner.x+Math.sin(angle)*8,y:owner.y-Math.cos(angle)*8,vx:Math.sin(angle)*55,vy:-35,life:.32,color:'#e2be6b'});
    // Begin at the owner, so a barrel adjacent to a wall cannot shoot through it.
    s.bullets.push({x:owner.x,y:owner.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,damage,team,life:1.5,boss:owner.type==='boss'});
  }
  function shoot(){
    if(s.mode!=='running')return;const h=s.heroes[s.active],w=weapons[s.active];if(h.cooldown>0||h.reload>0)return;if(h.ammo<=0){reload();return}
    const target=chooseAim(h);projectile(h,target,w.damage,660,'hero');h.ammo--;h.cooldown=w.interval;s.heat=Math.min(100,s.heat+13);
    s.guards.filter(g=>alive(g)&&dist(h,g)<360).forEach(g=>g.memory=5);hud();
  }
  function impact(x,y,color){for(let i=0;i<5;i++)s.sparks.push({x,y,vx:(Math.random()-.5)*100,vy:(Math.random()-.5)*100,life:.22,color})}
  function damage(actor,value){
    if(!alive(actor))return;
    if(s.heroes.includes(actor)){if(actor.hurt>0)return;actor.hurt=.22;actor.hp=Math.max(0,actor.hp-value);impact(actor.x,actor.y,'#ff8eb5');if(!alive(actor)){notify('Один из героев ранен. Дело сорвано.');finish(false)}return}
    const previous=actor.hp;actor.hp=Math.max(0,actor.hp-(actor.type==='boss'&&actor.hp>actor.maxHp/2?value*.8:value));actor.hurt=.13;actor.memory=6;impact(actor.x,actor.y,actor.type==='boss'?'#ffc06c':'#e9bb90');
    if(actor.type==='boss'&&previous>actor.maxHp/2&&actor.hp<=actor.maxHp/2)notify('Биг Смоук в ярости! Три выстрела подряд — уклоняйся.');
    if(!alive(actor)){actor.deadTime=0;actor.windup=0;actor.burst=0;actor.flash=0;s.kills++;if(actor.type==='boss'){s.loot=true;notify('Биг Смоук повержен. Оба героя → машина!')}else if(Math.random()<.4)s.medkits.push({x:actor.x,y:actor.y,taken:false})}
  }
  function updateBullets(dt){
    for(const a of [...s.heroes,...targets()])if(a.flash>0&&a.heading!=='side'){const x=a.x+Math.cos(a.angle)*18,y=a.y-30+Math.sin(a.angle)*18;ctx.fillStyle='#fff5b7';ctx.beginPath();ctx.arc(x,y,a.type==='boss'?7:4,0,Math.PI*2);ctx.fill()}
    for(const b of s.bullets){const a={x:b.x,y:b.y},end={x:b.x+b.vx*dt,y:b.y+b.vy*dt};let first=1,hit=null,wall=false;
      for(const r of walls){const t=P.segmentRect(a,end,r);if(t!==null&&t<=first){first=t;wall=true;hit=null}}
      const actors=b.team==='hero'?targets():s.heroes.filter(alive);
      for(const actor of actors){const t=P.segmentCircle(a,end,actor,actor.type==='boss'?23:14);if(t!==null&&t<first){first=t;hit=actor;wall=false}}
      b.x=a.x+(end.x-a.x)*first;b.y=a.y+(end.y-a.y)*first;b.life-=dt;
      if(hit){damage(hit,b.damage);b.life=0}else if(wall){impact(b.x,b.y,'#ffd59c');b.life=0}
      if(b.x<0||b.x>900||b.y<0||b.y>560)b.life=0;
      if(s.mode!=='running')break;
    }
    s.bullets=s.bullets.filter(b=>b.life>0);
  }
  function interact(dt){
    const p=s.heroes[s.active];let target=null;
    if(s.level!==2&&!s.hacked&&dist(p,terminal)<55){if(s.active!==1){notify('Терминал взламывает второй герой. Переключись.');s.progress=0;s.interaction=null;return}target='hack'}
    else if(s.level!==2&&s.hacked&&!s.loot&&dist(p,safe)<55){if(s.active!==0){notify('Груз забирает первый герой. Переключись.');s.progress=0;s.interaction=null;return}target='loot'}
    else if(s.loot&&dist(p,car)<65){if(s.heroes.some(h=>dist(h,car)>105)){notify('Подведи обоих к машине.');s.progress=0;return}finish(true);return}
    if(!target){s.progress=0;s.interaction=null;return}if(s.interaction!==target){s.progress=0;s.interaction=target}
    s.progress+=dt/(target==='hack'?levels[s.level].hack:levels[s.level].loot);
    if(s.progress>=1){s.progress=0;s.interaction=null;if(target==='hack'){s.hacked=true;notify('Замок отключён! Первый герой забирает груз.')}else{s.loot=true;notify('Груз у нас. Вернитесь вдвоём к машине!')}}
  }
  function finish(won){
    if(s.mode!=='running')return;s.mode=won?(s.level<2?'cleared':'complete'):'over';clearInput();cancelAnimationFrame(raf);s.pointerAim=null;
    const score=won?Math.max(100,Math.floor(s.time*10+(100-s.heat)*5+s.kills*80)*(s.level+1)):0;
    if(won){best=Math.max(best,score);unlocked=Math.max(unlocked,Math.min(2,s.level+1));try{localStorage.setItem('duoBest',best);localStorage.setItem('duoLevel',unlocked)}catch{}}
    const title=won?['ДОКИ ПРОЙДЕНЫ','ОБЛАВА ПОЗАДИ','BIG SMOKE ПОВЕРЖЕН'][s.level]:'ПЛАН СОРВАН';
    showOverlay(title,won?`${score} очков · ${s.kills} противников побеждено. Рекорд: ${best}. ${s.level<2?'Следующая миссия уже открыта.':'Все три уровня пройдены!'}`:s.time<=0?'Время вышло. Сократите маршрут и используйте рывок.':s.heroes.some(h=>!alive(h))?'Герой погиб. Следи за здоровьем обоих, подбирай аптечки и прячься от выстрелов.':'Повторите этот уровень.',won?(s.level<2?`УРОВЕНЬ ${s.level+2} ↗`:'ПРОЙТИ СНОВА ↗'):'ПОВТОРИТЬ УРОВЕНЬ ↗');hud();
  }
  function tickActor(a,dt){
    a.moving=false;for(const key of ['hurt','flash','fire','cooldown','memory'])if(a[key]>0)a[key]=Math.max(0,a[key]-dt);
    if(a.reload>0){a.reload=Math.max(0,a.reload-dt);if(a.reload===0)a.ammo=s.heroes.includes(a)?weapons[s.heroes.indexOf(a)].clip:a.type==='boss'?7:6}
    if(!alive(a))a.deadTime+=dt;
  }
  function enemyFire(g,target,dt,boss=false){
    if(g.reload>0)return;
    if(g.burst>0){g.burstTimer-=dt;if(g.burstTimer<=0){projectile(g,g.aimPoint,boss?22:9,boss?430:355,'enemy');g.ammo--;g.burst--;g.burstTimer=.2;if(g.ammo<=0){g.burst=0;g.reload=boss?2.1:1.7}return}}
    if(g.windup>0){g.windup=Math.max(0,g.windup-dt);orient(g,Math.atan2(g.aimPoint.y-g.y,g.aimPoint.x-g.x));if(g.windup===0){projectile(g,g.aimPoint,boss?22:9,boss?430:355,'enemy');g.ammo--;g.cooldown=boss?(g.hp<=g.maxHp/2?1.0:1.35):1.45;if(boss&&g.hp<=g.maxHp/2&&g.ammo>0){g.burst=Math.min(2,g.ammo);g.burstTimer=.2}if(g.ammo<=0)g.reload=boss?2.1:1.7}return}
    if(g.cooldown<=0&&dist(g,target)<(boss?440:285)&&lineClear(g,target)){g.aimPoint={x:target.x,y:target.y};g.windup=boss ? .72 : .4;orient(g,Math.atan2(target.y-g.y,target.x-g.x))}
  }
  function update(dt){
    if(s.mode!=='running')return;dt=Math.max(0,Math.min(.05,dt));s.elapsed+=dt;s.time=Math.max(0,s.time-dt);if(s.time<=0){finish(false);return}
    for(const k of ['dash','dashCooldown','decoyCooldown','toastTime','pointerTimer'])s[k]=Math.max(0,s[k]-dt);
    [...s.heroes,...s.guards,...(s.boss?[s.boss]:[])].forEach(a=>tickActor(a,dt));
    const p=s.heroes[s.active],other=s.heroes[1-s.active],dx=Number(keys.has('right'))-Number(keys.has('left')),dy=Number(keys.has('down'))-Number(keys.has('up')),len=Math.hypot(dx,dy)||1,speed=s.dash>0?320:s.crouch?75:145;
    move(p,dx/len*speed*dt,dy/len*speed*dt);if(dist(other,p)>58)approach(other,p,s.crouch?95:160,dt);
    const gap=dist(other,p);if(gap<27){const ax=gap>.01?(other.x-p.x)/gap:0,ay=gap>.01?(other.y-p.y)/gap:1;move(other,ax*(27-gap),ay*(27-gap))}
    if(keys.has('shoot'))shoot();if(keys.has('interact'))interact(dt);else{s.progress=0;s.interaction=null}if(s.mode!=='running')return;
    for(const kit of s.medkits)if(!kit.taken){const injured=s.heroes.filter(h=>h.hp<100&&dist(h,kit)<25).sort((a,b)=>a.hp-b.hp)[0];if(injured){injured.hp=Math.min(100,injured.hp+40);kit.taken=true;notify('Аптечка · +40 здоровья')}}
    if(s.decoy){s.decoy.life-=dt;if(s.decoy.life<=0)s.decoy=null}
    const guards=s.guards.filter(alive),decoyGuard=s.decoy&&guards.length?guards.reduce((a,b)=>dist(a,s.decoy)<dist(b,s.decoy)?a:b):null;let visible=false;
    for(const g of guards){
      const nearest=s.heroes.reduce((a,b)=>dist(g,a)<dist(g,b)?a:b);g.range=(s.level?175:155)*(s.crouch ? .6 : 1);g.cone=s.level ? .64 : .58;
      const sees=s.heroes.some(h=>{const a=Math.atan2(h.y-g.y,h.x-g.x),delta=Math.atan2(Math.sin(a-g.angle),Math.cos(a-g.angle));return lineClear(g,h)&&(dist(g,h)<27||dist(g,h)<g.range&&Math.abs(delta)<g.cone)});
      if(sees){visible=true;g.memory=4}g.alert=g.memory>0||s.heat>65;
      if(g===decoyGuard&&g.memory<=0){approach(g,s.decoy,g.speed,dt);continue}
      if(g.alert){if(!g.windup&&!g.burst&&g.reload<=0&&dist(g,nearest)>170)approach(g,nearest,g.speed*(g.type==='police'?1.55:1.2),dt);enemyFire(g,nearest,dt)}
      else{const target=g.route[g.step];if(dist(g,target)>8)approach(g,target,g.speed,dt);else g.step=(g.step+1)%g.route.length}
    }
    if(s.boss&&alive(s.boss)){
      const b=s.boss,nearest=s.heroes.reduce((a,c)=>dist(b,a)<dist(b,c)?a:c);if(s.heroes.some(h=>h.x>220)||b.hp<b.maxHp)b.engaged=true;
      if(b.engaged){b.alert=true;if(!b.windup&&!b.burst&&b.reload<=0){if(dist(b,nearest)>280)approach(b,nearest,b.hp<=420?85:58,dt);else{const target=b.route[b.step];if(dist(b,target)>12)approach(b,target,b.hp<=420?65:40,dt);else b.step=(b.step+1)%b.route.length}}enemyFire(b,nearest,dt,true)}
    }
    s.heat=Math.max(0,Math.min(100,s.heat+(visible?levels[s.level].heatRate:-levels[s.level].cool)*dt));
    updateBullets(dt);s.sparks.forEach(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=120*dt});s.sparks=s.sparks.filter(p=>p.life>0);hud();
  }
  function hud(){
    $('duoLevel').textContent=`0${s.level+1} / 03 · ${levels[s.level].name}`;
    for(let i=0;i<3;i++){const el=$('duoLevel'+(i+1));el.disabled=i>unlocked;el.classList.toggle('active',i===s.level)}
    $('duoTimer').textContent=`${Math.floor(s.time/60)}:${String(Math.floor(s.time%60)).padStart(2,'0')}`;$('duoHero').textContent=s.active?'ВТОРОЙ ГЕРОЙ':'ПЕРВЫЙ ГЕРОЙ';
    $('duoWanted').textContent='★'.repeat(Math.ceil(s.heat/20))+'☆'.repeat(5-Math.ceil(s.heat/20));
    $('duoMission').textContent=s.toastTime>0?s.toast:s.level===2&&!s.loot?'БОСС · Победите Биг Смоука':!s.hacked?'01 · Второй герой → терминал':!s.loot?'02 · Первый герой → груз':'ВЫХОД · Оба героя → машина';
    $('duoProgress').style.width=`${Math.min(1,s.progress)*100}%`;$('duoCrouch').classList.toggle('active',s.crouch);
    s.heroes.forEach((h,i)=>{$('duoHealth'+i).textContent=`${Math.ceil(h.hp)} HP`;$('duoHealth'+i).style.color=h.hp<30?'#ff668f':'#a7edcf'});
    const h=s.heroes[s.active],w=weapons[s.active];$('duoAmmo').textContent=h.reload>0?`${w.name} · ПЕРЕЗАРЯДКА ${h.reload.toFixed(1)}с`:`${w.name} · ${h.ammo} / ${w.clip}`;
    $('duoBossHud').hidden=!s.boss;if(s.boss){$('duoBossFill').style.width=`${s.boss.hp/s.boss.maxHp*100}%`;$('duoBossLabel').textContent=`BIG SMOKE · DESERT EAGLE · ${Math.ceil(s.boss.hp)} HP${s.boss.hp<=420&&alive(s.boss)?' · ЯРОСТЬ':''}`}
  }
  function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h)}
  function label(x,y,text,color,size=12){ctx.font=`bold ${size}px monospace`;ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(text,x,y)}
  function atlasFrame(im,row,col,size,mirror=false,opacity=1){if(!im.complete||!im.naturalWidth)return false;ctx.save();ctx.globalAlpha*=opacity;if(mirror)ctx.scale(-1,1);ctx.drawImage(im,col*256,row*256,256,256,-size/2,-size*244/256,size,size);ctx.restore();return true}
  function drawActor(a,i){
    const hero=i>=0,boss=a.type==='boss',dead=!alive(a),size=boss?108:hero?63:70,dir=a.heading==='side'?0:a.heading==='back'?1:2,mirror=a.heading==='side'&&a.face<0;
    ctx.fillStyle='#0b101780';ctx.beginPath();ctx.ellipse(a.x,a.y+3,boss?24:14,5,0,0,Math.PI*2);ctx.fill();
    if(hero&&i===s.active){ctx.strokeStyle=i?'#ff8fba':'#76e4da';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(a.x,a.y+3,18,8,0,0,Math.PI*2);ctx.stroke()}
    ctx.save();ctx.translate(a.x,a.y);if(a.hurt>0)ctx.globalAlpha=.6+Math.sin(s.elapsed*65)*.2;
    let painted=false;
    if(boss){
      let row=dir,col=a.moving?Math.floor(a.phase/(Math.PI*2)*6)%6:0;
      if(dead){row=6;col=a.deadTime<.15?3:a.deadTime<.3?4:5}
      else if(a.reload>0){row=6;col=1}
      else if(a.hurt>0&&a.flash<=0){row=6;col=2}
      else if(a.windup>0||a.flash>0||a.fire>0||a.burst){row=3+(dir===1?2:dir===2?1:0);col=a.flash>0?1:a.fire>0?2:0}
      else if(!a.moving){row=6;col=0}
      painted=atlasFrame(bossAtlas,row,col,size,mirror);
    }else if(dead||a.reload>0||a.windup>0||a.flash>0||a.fire>0||(hero&&s.pointerAim&&s.pointerTimer>0)){
      const row=hero?i:a.type==='police'?2:3,col=dead?5:a.reload>0?4:a.flash>0&&a.heading==='side'?3:a.heading==='side'?1:a.heading==='back'?2:0;
      painted=atlasFrame(combat,row,col,size,(col===1||col===3||col===4)&&a.face<0);
    }
    if(!painted&&!dead){if(hero)HumanAvatar.draw(ctx,{id:i,phase:a.phase,moving:s.mode==='running'&&a.moving,heading:a.heading,face:a.face,scale:size/85,crouch:s.crouch,time:s.elapsed});else atlasFrame(enemies,(a.type==='police'?0:3)+dir,a.moving?Math.floor(a.phase/(Math.PI*2)*6)%6:0,size,mirror)}
    ctx.restore();
    if(!dead){if(hero)label(a.x,a.y-size+8,String(i+1),i?'#ffb6cb':'#89ede0');else{label(a.x,a.y-size+6,boss?'BIG SMOKE':a.alert?'!':a.type==='police'?'POLICE':'SECURITY',boss?'#ffc789':'#cad9ed',boss?13:10);if(a.hp<a.maxHp){rect(a.x-18,a.y-size+11,36,3,'#2b1724');rect(a.x-18,a.y-size+11,36*a.hp/a.maxHp,3,'#ff95aa')}}}
  }
  function draw(){
    if(!s)return;const w=canvas.clientWidth||800,h=canvas.clientHeight||400,dpr=Math.min(2,window.devicePixelRatio||1);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const zoom=w<600?Math.min(1.05,h/390):Math.min(w/900,h/560),p=s.heroes[s.active],cx=w<600?Math.max(w/(2*zoom),Math.min(900-w/(2*zoom),p.x)):450,cy=w<600?Math.max(h/(2*zoom),Math.min(560-h/(2*zoom),p.y)):280;
    camera={zoom,ox:w/2-cx*zoom,oy:h/2-cy*zoom};ctx.save();ctx.translate(camera.ox,camera.oy);ctx.scale(zoom,zoom);ctx.imageSmoothingEnabled=false;
    rect(0,0,900,560,'#263748');for(let y=0;y<560;y+=35){rect(0,y,900,1,'#ffffff08')}rect(0,0,900,28,'#568698');for(let i=0;i<20;i++)rect(i*57+Math.sin(s.time+i)*8,12,28,2,'#a7d9d740');
    rect(25,45,840,470,s.level?'#302238':'#30303f');if(s.level===2){ctx.strokeStyle='#ff995219';ctx.lineWidth=2;ctx.beginPath();ctx.arc(650,285,210,0,Math.PI*2);ctx.stroke();label(650,225,'LAST ORDER','#986277',16)}if(s.level){rect(355,52,220,18,'#100f23');label(465,66,s.level===2?'SMOKE’S LAST STAND':'VICE AFTER DARK','#ff89cb');ctx.shadowColor='#f35ab9';ctx.shadowBlur=12;rect(370,75,190,3,'#ff67c9');ctx.shadowBlur=0;for(const x of [55,845]){rect(x,85,3,345,'#54cedc');rect(x+7,85,2,345,'#e85baa')}label(690,521,'VIP · RESTRICTED','#e9a2cf')}rect(38,54,816,452,'#ffffff03');for(let x=45;x<860;x+=40)rect(x,55,1,450,'#ffffff04');
    walls.forEach((r,i)=>{rect(r.x+7,r.y+8,r.w,r.h,'#111723aa');rect(r.x,r.y,r.w,r.h,s.level?(i%2?'#463e56':'#353d50'):(i%2?'#525474':'#376472'));rect(r.x,r.y,r.w,5,s.level?'#e582bc':'#99adbb');if(s.level){rect(r.x+8,r.y+12,r.w-16,r.h-24,'#181e2b55');for(let x=r.x+10;x<r.x+r.w-12;x+=25){rect(x,r.y+r.h-9,14,4,i%2?'#ff82bd':'#67cddd')}rect(r.x+r.w/2-10,r.y+r.h-20,20,20,'#161927');label(r.x+r.w/2,r.y+r.h/2,(s.level===2?['SPEAKERS','VIP SOFA','BAR','ARMORY']:['LOUNGE','CLUB VI','VIP','BAR','STAFF','POWER','GARAGE'])[i],'#a9a0b9')}else for(let x=r.x+8;x<r.x+r.w;x+=14)rect(x,r.y+9,2,r.h-14,'#162c424d')});
    for(const [x,y]of[[80,70],[840,60],[855,480]]){ctx.strokeStyle='#182838';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x,y+25);ctx.lineTo(x,y-15);ctx.stroke();for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(x,y-15);ctx.quadraticCurveTo(x+i*10,y-38,x+i*20,y-10);ctx.stroke()}}
    const marker=(pos,text,color)=>{ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(pos.x,pos.y,26+Math.sin(s.time*3)*3,0,Math.PI*2);ctx.stroke();label(pos.x,pos.y-37,text,color)};
    if(terminal){rect(terminal.x-13,terminal.y-12,26,24,'#151e2e');rect(terminal.x-9,terminal.y-8,18,13,s.hacked?'#86ebc6':'#ff8bb5');marker(terminal,s.hacked?'ВЗЛОМАНО':'01 · ТЕРМИНАЛ','#ff91b6');}
    if(safe){rect(safe.x-17,safe.y-14,34,28,s.loot?'#556170':'#d4a771');if(!s.loot)marker(safe,s.hacked?'02 · ГРУЗ':'ГРУЗ ЗАПЕРТ','#ffd598');}
    rect(car.x-35,car.y-19,70,39,'#ba68a4');rect(car.x-13,car.y-15,32,29,'#212a42');rect(car.x-37,car.y-23,15,7,'#141924');rect(car.x+18,car.y-23,15,7,'#141924');rect(car.x-37,car.y+17,15,7,'#141924');rect(car.x+18,car.y+17,15,7,'#141924');marker(car,s.loot?'УЕЗЖАЕМ':'МАШИНА','#7ee4d5');

    for(const kit of s.medkits)if(!kit.taken){rect(kit.x-9,kit.y-9,18,18,'#244a42');rect(kit.x-2,kit.y-6,4,12,'#a3ffe0');rect(kit.x-6,kit.y-2,12,4,'#a3ffe0')}
    for(const g of s.guards.filter(alive))if(!g.alert){ctx.fillStyle=g.type==='police'?'#6cb5ff1d':'#ffe3961d';ctx.beginPath();ctx.moveTo(g.x,g.y);const range=g.range||155,cone=g.cone||.58;for(let j=0;j<=24;j++){const angle=g.angle-cone+cone*2*j/24,end={x:g.x+Math.cos(angle)*range,y:g.y+Math.sin(angle)*range};let t=1;for(const r of walls){const hit=P.segmentRect(g,end,r);if(hit!==null)t=Math.min(t,hit)}ctx.lineTo(g.x+(end.x-g.x)*t,g.y+(end.y-g.y)*t)}ctx.closePath();ctx.fill()}
    for(const g of targets())if(g.windup>0){ctx.strokeStyle=g.type==='boss'?'#ff7847':'#ff8fa4';ctx.lineWidth=g.type==='boss'?3:1;ctx.setLineDash([7,7]);ctx.beginPath();ctx.moveTo(g.x,g.y-30);ctx.lineTo(g.aimPoint.x,g.aimPoint.y-30);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='#ff986b';ctx.beginPath();ctx.arc(g.x,g.y,24+(g.windup*18),0,Math.PI*2);ctx.stroke()}
    if(s.decoy){ctx.strokeStyle='#ffe69c';ctx.beginPath();ctx.arc(s.decoy.x,s.decoy.y,12+(5-s.decoy.life)*15,0,Math.PI*2);ctx.stroke()}
    const actors=[...s.heroes.map((a,i)=>({a,i})),...s.guards.map(a=>({a,i:-1})),...(s.boss?[{a:s.boss,i:-1}]:[])];
    actors.sort((a,b)=>Number(alive(a.a))-Number(alive(b.a))||a.a.y-b.a.y).forEach(({a,i})=>drawActor(a,i));
    for(const a of [...s.heroes,...targets()])if(a.flash>0&&a.heading!=='side'){const x=a.x+Math.cos(a.angle)*18,y=a.y-30+Math.sin(a.angle)*18;ctx.fillStyle='#fff5b7';ctx.beginPath();ctx.arc(x,y,a.type==='boss'?7:4,0,Math.PI*2);ctx.fill()}
    for(const b of s.bullets){ctx.strokeStyle=b.team==='hero'?'#fff0ac':b.boss?'#ff944f':'#ff9db1';ctx.lineWidth=b.boss?3:2;ctx.beginPath();ctx.moveTo(b.x-b.vx*.015,b.y-30-b.vy*.015);ctx.lineTo(b.x,b.y-30);ctx.stroke()}
    for(const spark of s.sparks)rect(spark.x,spark.y-30,3,3,spark.color);
    if(s.pointerAim&&s.pointerTimer>0){const aim=s.pointerAim;ctx.strokeStyle='#a5ffe3';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(aim.x,aim.y-30,9,0,Math.PI*2);ctx.stroke();rect(aim.x-15,aim.y-31,6,2,'#a5ffe3');rect(aim.x+9,aim.y-31,6,2,'#a5ffe3')}
    ctx.restore();
    if(s.heroes[s.active].hurt>0){ctx.strokeStyle='#ff527a99';ctx.lineWidth=10;ctx.strokeRect(5,5,w-10,h-10)}
    if(w<600){const mx=w-115,my=10;rect(mx,my,105,68,'#10182de8');const dot=(v,color)=>{if(v){ctx.fillStyle=color;ctx.fillRect(mx+v.x/900*105-2,my+v.y/560*68-2,4,4)}};dot(terminal,'#ff8ab2');dot(safe,'#ffd598');dot(car,'#7ee4d5');s.heroes.forEach((v,i)=>dot(v,i?'#ffb6cb':'#8bf0e1'));if(s.boss&&alive(s.boss))dot(s.boss,'#ff9a47')}
  }
  function frame(now){if(s.mode!=='running')return;const dt=Math.min(.04,Math.max(0,(now-last)/1000));last=now;update(dt);draw();if(s.mode==='running')raf=requestAnimationFrame(frame)}
  for(let i=0;i<3;i++)$('duoLevel'+(i+1)).addEventListener('click',()=>{if(i<=unlocked)reset(i)});
  $('duoStart').addEventListener('click',start);$('duoSwap').addEventListener('click',swap);$('duoCrouch').addEventListener('click',()=>{if(s.mode==='running')s.crouch=!s.crouch});$('duoDash').addEventListener('click',dash);$('duoDistract').addEventListener('click',distract);$('duoPause').addEventListener('click',pause);$('duoReload').addEventListener('click',reload);$('duoSound').addEventListener('click',()=>{soundOn=!soundOn;$('duoSound').textContent=soundOn?'ЗВУК ВКЛ':'ЗВУК ВЫКЛ';if(soundOn)initSound()});
  game.querySelectorAll('[data-duo-hold]').forEach(b=>{b.addEventListener('pointerdown',e=>{if(s.mode!=='running')return;e.preventDefault();b.setPointerCapture(e.pointerId);input(b.dataset.duoHold,true,'pad:'+e.pointerId)});['pointerup','pointercancel','lostpointercapture'].forEach(event=>b.addEventListener(event,e=>input(b.dataset.duoHold,false,'pad:'+e.pointerId)))});
  function pointerAim(e){const r=canvas.getBoundingClientRect(),point={x:((e.clientX-r.left)*(canvas.clientWidth/r.width)-camera.ox)/camera.zoom,y:((e.clientY-r.top)*(canvas.clientHeight/r.height)-camera.oy)/camera.zoom};const hover=targets().find(g=>Math.hypot(g.x-point.x,g.y-30-point.y)<(g.type==='boss'?45:28));s.pointerAim=hover?{x:hover.x,y:hover.y}:{x:point.x,y:point.y+30};s.pointerTimer=3;orient(s.heroes[s.active],Math.atan2(s.pointerAim.y-s.heroes[s.active].y,s.pointerAim.x-s.heroes[s.active].x))}
  canvas.addEventListener('pointerdown',e=>{if(s.mode!=='running'||e.button!==0)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);pointerAim(e);input('shoot',true,'canvas:'+e.pointerId)});
  canvas.addEventListener('pointermove',e=>{if(s.mode==='running'&&(e.pointerType==='mouse'||keys.has('shoot')))pointerAim(e)});
  ['pointerup','pointercancel','lostpointercapture'].forEach(name=>canvas.addEventListener(name,e=>input('shoot',false,'canvas:'+e.pointerId)));canvas.addEventListener('contextmenu',e=>e.preventDefault());
  // Physical key codes keep WASD working with Russian layout and Shift/Caps Lock.
  const codeMap={KeyA:'left',KeyD:'right',KeyW:'up',KeyS:'down',ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',KeyE:'interact',KeyJ:'shoot'};
  const layoutKeys={'ф':'a','в':'d','ц':'w','ы':'s','у':'e','о':'j','й':'q','а':'f','к':'r','з':'p'};
  const keyMap={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',e:'interact',j:'shoot'};
  function keyInfo(e){const raw=(e.key||'').toLowerCase(),key=/^Key[A-Z]$/.test(e.code||'')?e.code.slice(3).toLowerCase():layoutKeys[raw]||raw;return {key,action:codeMap[e.code]||keyMap[e.key]||keyMap[key],source:'key:'+(e.code||key)}}
  document.addEventListener('keydown',e=>{if(game.hidden||s.mode==='closed')return;const {key,action,source}=keyInfo(e);
    if(action&&s.mode==='running'){e.preventDefault();input(action,true,source);if(action==='shoot')s.pointerAim=null}if(e.repeat)return;
    if(key==='tab'||key==='1'||key==='2'){e.preventDefault();if(key==='1'&&s.active===0||key==='2'&&s.active===1)return;swap()}
    if(key===' '){e.preventDefault();if(s.mode==='running')s.crouch=!s.crouch}if(key==='q')dash();if(key==='f')distract();if(key==='r')reload();if(key==='p')pause();
  },true);
  document.addEventListener('keyup',e=>{const {action,source}=keyInfo(e);input(action,false,source)},true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&s.mode==='running')pause()});window.addEventListener('blur',()=>{clearInput();if(s.mode==='running')pause()});window.addEventListener('resize',()=>{if(s)draw()});window.addEventListener('avatarready',()=>{if(s)draw()});
  canvas.tabIndex=0;window.DuoGame={open:()=>reset(0),stop};reset();
})();
