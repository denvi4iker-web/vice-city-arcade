(() => {
  'use strict';
  const $=id=>document.getElementById(id),game=$('warehouseGame'),canvas=$('warehouseCanvas'),ctx=canvas.getContext('2d');
  const W=960,H=540,GROUND=437,types=[
    {name:'СКАУТ',hp:4,speed:29,radius:22,damage:7,value:18,color:'#89ead9',shape:'quad'},
    {name:'FPV',hp:3,speed:55,radius:17,damage:8,value:22,color:'#ff9fbe',shape:'fpv'},
    {name:'БРОНЯ',hp:11,speed:23,radius:27,damage:12,value:36,color:'#eac185',shape:'hex'},
    {name:'БОМБЕР',hp:8,speed:24,radius:30,damage:10,value:32,color:'#d1b7ff',shape:'wing'},
    {name:'НОСИТЕЛЬ',hp:20,speed:16,radius:37,damage:18,value:70,color:'#ffac76',shape:'carrier'}
  ];
  const waves=[
    {name:'ТИХАЯ СМЕНА',mix:[0,0,0,1,0,0,1,0],gap:2.25,radio:'Диспетчер: на радаре восемь целей. Заказы уже собраны. Держи небо, пока выезжают первые фургоны.'},
    {name:'БЫСТРАЯ ДОСТАВКА',mix:[0,1,1,0,1,2,0,1,0,1,2,0],gap:1.85,radio:'Диспетчер: FPV заходят зигзагом. Не ведись на скорость — стреляй с упреждением или захватывай цель ракетой.'},
    {name:'ТЯЖЁЛЫЙ ГРУЗ',mix:[2,0,3,1,2,0,2,3,1,2,0,3,1,2,0,1],gap:1.65,radio:'Механик: появилась броня и бомберы. Перехватывай падающие заряды. Ракета задевает несколько целей рядом.'},
    {name:'ЧЁРНАЯ ПЯТНИЦА',mix:[1,3,2,1,0,3,1,2,3,0,1,2,1,3,2,0,1,3,2,1],gap:1.45,radio:'Диспетчер: небо забито. Склад должен пережить эту ночь. Сохрани импульс для плотной группы.'},
    {name:'ПЛОХАЯ КОМПАНИЯ',mix:[4,0,1,2,3,1,2,0,3,4,1,2,3,0,1,2,3,1,0,2,1,3],gap:1.35,radio:'Механик: тяжёлые носители выпускают разведчиков. Сбивай их первыми, иначе целей станет ещё больше.'},
    {name:'ПОСЛЕДНЯЯ ДОСТАВКА',mix:[2,1,3,0,1,2,4,3,1,2,0,3,1,2,3,0,1,2,3,1,2,1,3,4],gap:1.3,radio:'Диспетчер: последний фургон ждёт рассвета. В конце идёт «Ковчег». Сбей его, и мы вывезем оставшиеся заказы.'}
  ];
  const bg=new Image();bg.src='warehouse-waterfront.png';bg.onload=()=>draw();
  const defender=new Image();defender.src='warehouse-defender.png';defender.onload=()=>draw();
  let s=null,raf=0,last=0,camera={scale:1,x:0,y:0},soundOn=false,audio=null;
  const inputs=new Map(),held=action=>[...inputs.values()].includes(action),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  let best=0;try{best=Number(localStorage.getItem('warehouseBest'))||0}catch{}
  function beep(freq,duration=.06,volume=.035){if(!soundOn)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(40,freq*.55),audio.currentTime+duration);g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration)}catch{}}
  function halt(){if(raf)cancelAnimationFrame(raf);raf=0;inputs.clear()}
  function stop(){halt();if(s)s.mode='closed'}
  function panel(title,message,button){$('warehouseOverlay').hidden=false;$('warehouseTitle').textContent=title;$('warehouseMessage').textContent=message;$('warehouseStart').textContent=button}
  function open(){halt();s={mode:'ready',wave:0,hp:100,shield:25,maxShield:25,credits:0,score:0,kills:0,combo:0,comboTime:0,elapsed:0,waveTime:0,spawnTimer:1.5,spawnIndex:0,nextId:1,drones:[],bombs:[],bullets:[],missiles:[],fx:[],particles:[],heat:0,overheated:false,fireCooldown:0,missileAmmo:3,missileCharge:0,missileCooldown:0,empCooldown:0,empRing:0,gun:0,cooling:0,shieldLevel:0,playerX:480,playerPhase:0,aim:{x:480,y:180},manualAim:false,pointerTimer:0,shots:0,hits:0,bossDefeated:false,shake:0,flash:0,radioTime:0,radio:waves[0].radio};
    $('warehouseUpgrades').hidden=true;$('warehouseResult').hidden=true;$('warehouseTypes').hidden=false;
    panel('ПОСЛЕДНЯЯ ДОСТАВКА','Ночная смена в Вайс-Сити. Защити склад маркетплейса: отбей шесть волн и сохрани заказы до рассвета.\n\nЗажми ОГОНЬ для автонаведения или веди прицел по небу. Между волнами — ремонт и улучшения.','НАЧАТЬ СМЕНУ ↗');hud();draw();
  }
  function startLoop(){halt();last=performance.now();raf=requestAnimationFrame(frame)}
  function beginWave(){s.mode='running';s.spawnIndex=0;s.spawnTimer=1.2;s.waveTime=0;s.combo=0;s.comboTime=0;s.heat=0;s.overheated=false;s.missileAmmo=3;s.missileCharge=0;s.fireCooldown=0;s.manualAim=false;s.shots=0;s.hits=0;s.empCooldown=Math.min(s.empCooldown,6);s.radio=waves[s.wave].radio;s.radioTime=9;
    $('warehouseOverlay').hidden=true;$('warehouseUpgrades').hidden=true;$('warehouseResult').hidden=true;startLoop();hud();draw();
  }
  function start(){if(!s)return;if(s.mode==='ready')beginWave();else if(s.mode==='paused'){s.mode='running';$('warehouseOverlay').hidden=true;startLoop()}else if(s.mode==='shop'){s.wave++;beginWave()}else if(s.mode==='won'||s.mode==='lost'){open();beginWave()}}
  function pause(){if(s?.mode==='paused'){start();return}if(s?.mode!=='running')return;halt();s.mode='paused';$('warehouseUpgrades').hidden=true;$('warehouseTypes').hidden=true;panel('СМЕНА НА ПАУЗЕ','Небо подождёт. Продолжишь с тем же складом, оружием и оставшимися целями.','ПРОДОЛЖИТЬ ↗');hud();draw()}
  function spawn(type,boss=false,origin=null){const t=types[type],x=origin?.x??(65+Math.random()*830),y=origin?.y??-40,scale=1+s.wave*.035;
    const d={id:s.nextId++,type,x,y,baseX:x,targetX:180+Math.random()*600,hp:boss?78:t.hp*scale,maxHp:boss?78:t.hp*scale,radius:t.radius*(boss?1.6:1),speed:t.speed*(1+s.wave*.045)*(boss?.6:1),damage:boss?32:t.damage,value:boss?240:t.value,phase:Math.random()*6.28,age:0,stun:0,bombTimer:4.5,childTimer:7,children:0,elite:boss};s.drones.push(d);return d;
  }
  function notify(text){s.radio=text;s.radioTime=4}
  function effect(x,y,r,color){s.fx.push({x,y,r,age:0,life:.45,color});for(let i=0;i<10;i++){const a=Math.random()*Math.PI*2,v=25+Math.random()*95;s.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.4+Math.random()*.5,color})}}
  function hit(d,damage){if(d.hp<=0)return;d.hp-=damage;d.hurt=.12;if(d.hp>0)return;d.hp=0;s.kills++;s.comboTime=2.8;s.combo++;const bonus=Math.min(5,s.combo);s.score+=d.value*10+bonus*15;s.credits+=d.value;effect(d.x,d.y,d.radius*1.6,types[d.type].color);beep(95,.12,.035);if(d.elite){s.bossDefeated=true;notify('Диспетчер: «Ковчег» сбит! Убери оставшиеся цели — фургон готов выезжать.')}}
  function impact(damage,x){const absorbed=Math.min(s.shield,damage);s.shield-=absorbed;s.hp=Math.max(0,s.hp-(damage-absorbed));s.combo=0;s.shake=.25;s.flash=.2;effect(x,GROUND,45,'#ff866c');beep(70,.16,.05);if(s.hp<=0)finish(false)}
  function aimTarget(){const threats=s.drones.filter(d=>d.hp>0&&d.y>=-5&&d.y<GROUND);if(!threats.length)return null;if(s.manualAim&&s.pointerTimer>0)return threats.sort((a,b)=>distance(a,s.aim)-distance(b,s.aim))[0];return threats.sort((a,b)=>(b.y+b.speed*1.5)-(a.y+a.speed*1.5))[0]}
  function shoot(){if(s.mode!=='running'||s.overheated||s.fireCooldown>0)return;
    const origin={x:s.playerX,y:477},target=!s.manualAim||s.pointerTimer<=0?aimTarget():null;let aim=s.aim;
    if(target){const travel=distance(origin,target)/780;aim={x:clamp(target.x+(target.vx||0)*travel,8,952),y:target.y+(target.vy||target.speed)*travel}}
    const a=clamp(Math.atan2(aim.y-origin.y,aim.x-origin.x),-Math.PI+.08,-.08);s.bullets.push({x:origin.x+Math.cos(a)*25,y:origin.y+Math.sin(a)*25,vx:Math.cos(a)*780,vy:Math.sin(a)*780,damage:1.8+s.gun*.65,life:1.3});s.heat=Math.min(100,s.heat+7.8);s.fireCooldown=.13-s.gun*.012;s.shots++;s.muzzle=.045;if(s.heat>=100){s.overheated=true;notify('Механик: ствол перегрелся! Отпусти огонь или используй ракету.')}beep(260,.035,.012);
  }
  function missile(){if(s.mode!=='running'||s.missileCooldown>0||s.missileAmmo<=0)return;const target=aimTarget();if(!target){notify('ПВО: цель ещё не вошла в сектор.');return}if(s.manualAim&&s.pointerTimer>0&&distance(target,s.aim)>150){notify('ПВО: подведи прицел ближе к дрону для захвата.');return}
    s.missileAmmo--;s.missileCooldown=.7;s.missiles.push({x:s.playerX,y:466,vx:0,vy:-180,targetId:target.id,life:4,trail:[]});beep(420,.15,.035);hud();
  }
  function detonate(m){effect(m.x,m.y,86,'#ffc48b');for(const d of s.drones)if(d.hp>0&&distance(d,m)<86+d.radius)hit(d,8+s.gun);s.bombs=s.bombs.filter(b=>{if(distance(b,m)<86){effect(b.x,b.y,18,'#ffe0a7');s.score+=25;return false}return true});s.shake=.12}
  function emp(){if(s.mode!=='running'||s.empCooldown>0)return;if(!s.drones.some(d=>d.hp>0&&d.y>0)&&!s.bombs.length){notify('ПВО: в секторе пока нет целей для импульса.');return}s.empCooldown=26;s.empRing=.65;let n=0;for(const d of s.drones)if(d.hp>0&&d.y>0){d.stun=3;hit(d,3.5);n++}for(const b of s.bombs)effect(b.x,b.y,20,'#9cf6e3');s.score+=s.bombs.length*25;s.bombs=[];notify(`ПВО: импульс. Целей остановлено: ${n}.`);beep(700,.3,.04);hud()}
  // Swept collision prevents a fast shot passing through a small FPV between frames.
  function segmentHit(a,b,c,r){const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy,ox=a.x-c.x,oy=a.y-c.y,cc=ox*ox+oy*oy-r*r;if(cc<=0)return 0;if(!len)return null;const bb=2*(ox*dx+oy*dy),disc=bb*bb-4*len*cc;if(disc<0)return null;const t=(-bb-Math.sqrt(disc))/(2*len);return t>=0&&t<=1?t:null}
  function update(dt){if(s?.mode!=='running')return;dt=clamp(dt,0,.05);s.elapsed+=dt;s.waveTime+=dt;s.radioTime=Math.max(0,s.radioTime-dt);s.pointerTimer=Math.max(0,s.pointerTimer-dt);s.comboTime=Math.max(0,s.comboTime-dt);if(!s.comboTime)s.combo=0;
    for(const key of ['fireCooldown','missileCooldown','empCooldown','empRing','shake','flash','muzzle'])s[key]=Math.max(0,(s[key]||0)-dt);
    const moving=Number(held('right'))-Number(held('left'));s.playerX=clamp(s.playerX+moving*190*dt,75,885);if(moving)s.playerPhase+=dt*9;
    s.heat=Math.max(0,s.heat-(18+s.cooling*8)*dt);if(s.overheated&&s.heat<35)s.overheated=false;
    if(s.missileAmmo<3){s.missileCharge+=dt;if(s.missileCharge>=7){s.missileCharge-=7;s.missileAmmo++}}else s.missileCharge=0;
    if(held('fire'))shoot();
    const wave=waves[s.wave];s.spawnTimer-=dt;if(s.spawnIndex<wave.mix.length&&s.spawnTimer<=0){const index=s.spawnIndex++,elite=s.wave===5&&index===wave.mix.length-1;spawn(wave.mix[index],elite);s.spawnTimer+=wave.gap;}
    for(const d of [...s.drones]){if(d.hp<=0)continue;d.age+=dt;d.hurt=Math.max(0,(d.hurt||0)-dt);d.stun=Math.max(0,d.stun-dt);if(d.stun>0){d.vx=0;d.vy=0;continue}
      const oldX=d.x,oldY=d.y;d.y+=d.speed*dt;const center=d.baseX+(d.targetX-d.baseX)*clamp(d.y/GROUND,0,1);d.x=clamp(center+Math.sin(d.age*(d.type===1?3.6:1.25)+d.phase)*(d.type===1?46:d.type===0?17:9),25,935);d.vx=(d.x-oldX)/dt||0;d.vy=(d.y-oldY)/dt||0;
      if(d.type===3&&d.y>95){d.bombTimer-=dt;if(d.bombTimer<=0){d.bombTimer=5.5;s.bombs.push({x:d.x,y:d.y+15,vy:70,radius:9})}}
      if(d.type===4&&d.y>75){d.childTimer-=dt;if(d.childTimer<=0&&d.children<(d.elite?6:2)){d.childTimer=d.elite?6:8;d.children++;spawn(d.elite?1:0,false,{x:clamp(d.x+(d.children%2?35:-35),30,930),y:d.y+15})}}
      if(d.y>=GROUND){d.hp=0;impact(d.elite?s.hp+s.shield:d.damage,d.x);if(s.mode!=='running')return}
    }
    for(const b of s.bombs){b.vy+=45*dt;b.y+=b.vy*dt;if(b.y>=GROUND){b.dead=true;impact(9,b.x);if(s.mode!=='running')return}}
    for(const b of s.bullets){const old={x:b.x,y:b.y};b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;let collision=null;
      for(const target of [...s.drones.filter(d=>d.hp>0),...s.bombs.filter(d=>!d.dead)]){const t=segmentHit(old,b,target,target.radius);if(t!==null&&(!collision||t<collision.t))collision={target,t}}
      if(collision){b.life=0;s.hits++;if(collision.target.hp!==undefined)hit(collision.target,b.damage);else{collision.target.dead=true;s.score+=25;effect(collision.target.x,collision.target.y,18,'#ffe0a7')}}
    }
    for(const m of s.missiles){m.life-=dt;let d=s.drones.find(d=>d.id===m.targetId&&d.hp>0);if(!d){d=s.drones.filter(d=>d.hp>0).sort((a,b)=>distance(a,m)-distance(b,m))[0];if(d)m.targetId=d.id}
      m.trail.push({x:m.x,y:m.y});if(m.trail.length>12)m.trail.shift();const old={x:m.x,y:m.y};if(d){const a=Math.atan2(d.y-m.y,d.x-m.x),speed=370;m.vx+=(Math.cos(a)*speed-m.vx)*Math.min(1,dt*9);m.vy+=(Math.sin(a)*speed-m.vy)*Math.min(1,dt*9)}else m.vy-=150*dt;
      m.x+=m.vx*dt;m.y+=m.vy*dt;if(d&&segmentHit(old,m,d,d.radius+8)!==null){detonate(m);m.life=0}
    }
    s.drones=s.drones.filter(d=>d.hp>0);s.bombs=s.bombs.filter(b=>!b.dead);s.bullets=s.bullets.filter(b=>b.life>0&&b.y>-40&&b.x>-30&&b.x<990);s.missiles=s.missiles.filter(m=>m.life>0&&m.y>-80&&m.y<550&&m.x>-80&&m.x<1040);
    for(const f of s.fx)f.age+=dt;s.fx=s.fx.filter(f=>f.age<f.life);for(const p of s.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=65*dt}s.particles=s.particles.filter(p=>p.life>0).slice(-220);
    if(s.spawnIndex===wave.mix.length&&!s.drones.length&&!s.bombs.length)clearWave();
  }
  function clearWave(){halt();s.bullets=[];s.missiles=[];const reward=90+s.wave*20;s.score+=300+Math.round(s.hp)*5;s.credits+=reward;if(s.wave===5){finish(true);return}s.mode='shop';s.hp=Math.min(100,s.hp+10);s.shield=s.maxShield;s.heat=0;s.empCooldown=Math.max(0,s.empCooldown-8);$('warehouseTypes').hidden=true;$('warehouseUpgrades').hidden=false;$('warehouseResult').hidden=false;
    panel('ВОЛНА ОТБИТА',`Фургон вышел из ворот. +10 прочности и +${reward} кредитов.\n\nСледующая волна: ${waves[s.wave+1].name}. Выбери улучшения.`,`ВОЛНА ${s.wave+2} / 6 ↗`);shop();results();hud();draw();
  }
  const prices={gun:110,cooling:85,shield:100,repair:60};
  function cost(kind){return prices[kind]+(kind==='repair'?0:(kind==='shield'?s.shieldLevel:s[kind])*65)}
  function upgrade(kind){if(s.mode!=='shop'||!Object.hasOwn(prices,kind))return;const level=kind==='shield'?s.shieldLevel:s[kind];if(kind!=='repair'&&level>=3||kind==='repair'&&s.hp>=100||s.credits<cost(kind))return;s.credits-=cost(kind);if(kind==='repair')s.hp=Math.min(100,s.hp+30);else if(kind==='shield'){s.shieldLevel++;s.maxShield=25+s.shieldLevel*15;s.shield=s.maxShield}else s[kind]++;shop();results();hud();draw()}
  function shop(){for(const kind of ['gun','cooling','shield','repair']){const b=$('warehouseUpgrade'+kind),level=kind==='shield'?s.shieldLevel:s[kind],max=kind!=='repair'&&level>=3;b.disabled=max||kind==='repair'&&s.hp>=100||s.credits<cost(kind);b.querySelector('span').textContent=max?'МАКСИМУМ':`${cost(kind)} КР · ${kind==='repair'?'+30 ПРОЧНОСТИ':`${level}/3 → ${level+1}/3`}`}}
  function results(){$('warehouseResultScore').textContent=s.score;$('warehouseResultKills').textContent=s.kills;$('warehouseResultHp').textContent=Math.ceil(s.hp)+'%'}
  function finish(won){halt();s.mode=won?'won':'lost';if(won)s.score+=Math.round(s.hp)*20;if(s.score>best){best=s.score;try{localStorage.setItem('warehouseBest',String(best))}catch{}}$('warehouseUpgrades').hidden=true;$('warehouseTypes').hidden=true;$('warehouseResult').hidden=false;results();
    panel(won?'ДОСТАВЛЕНО К РАССВЕТУ':'СКЛАД НЕ ВЫДЕРЖАЛ',won?'Рассвет над доками. Последний фургон уходит за ворота, в небе тихо. Все шесть волн отбиты — заказы спасены.\n\nДиспетчер: «Хорошая смена. Кофе за мой счёт».':`Связь оборвалась на волне ${s.wave+1}. Попробуй снова: не держи перегретую пушку, перехватывай заряды и улучшай ПВО между волнами.`,'НОВАЯ СМЕНА ↗');hud();draw();
  }
  function hud(){if(!s)return;$('warehouseWave').textContent=`${String(s.wave+1).padStart(2,'0')} / 06 · ${waves[s.wave].name}`;$('warehouseHp').textContent=`${Math.ceil(s.hp)}% · ЩИТ ${Math.ceil(s.shield)}`;$('warehouseHpFill').style.width=s.hp+'%';$('warehouseCredits').textContent=`${s.credits} КР · ${s.score} ОЧКОВ`;$('warehouseHeat').style.width=s.heat+'%';$('warehouseHeat').style.background=s.overheated?'#ff668b':'#ffb179';$('warehouseHeatLabel').textContent=s.overheated?'ПЕРЕГРЕВ':'СТВОЛ';$('warehouseMissile').textContent=`R · РАКЕТА ${s.missileAmmo}/3`;$('warehouseMissile').disabled=s.mode!=='running'||!s.missileAmmo||s.missileCooldown>0;$('warehouseEmp').textContent=s.empCooldown>0?`Q · ИМПУЛЬС ${Math.ceil(s.empCooldown)}с`:'Q · ИМПУЛЬС';$('warehouseEmp').disabled=s.mode!=='running'||s.empCooldown>0||(!s.drones.some(d=>d.hp>0&&d.y>0)&&!s.bombs.length);$('warehouseRadio').textContent=s.radioTime>0||s.mode!=='running'?s.radio:`РАДАР · В НЕБЕ ${s.drones.length} · СБИТО ${s.kills} · РЕКОРД ${best}`;$('warehousePause').textContent=s.mode==='paused'?'▶':'Ⅱ'}
  function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h)}
  function text(x,y,t,color='#eee2dc',size=11,align='center'){ctx.fillStyle=color;ctx.font=`bold ${size}px monospace`;ctx.textAlign=align;ctx.fillText(t,x,y)}
  function line(points,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke()}
  function rotor(x,y,r,phase,color){ctx.save();ctx.translate(x,y);ctx.rotate(phase);ctx.strokeStyle='#071221';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(0,0,r,r*.4,0,0,Math.PI*2);ctx.stroke();line([[-r,0],[r,0]],color,2);line([[0,-r*.4],[0,r*.4]],color,2);ctx.restore()}
  function drawDrone(d){const t=types[d.type],r=d.radius,c=d.hurt>0?'#fff2d8':t.color;ctx.save();ctx.translate(d.x,d.y);ctx.rotate(Math.sin(d.age*3+d.phase)*.08);const k=r/t.radius;ctx.scale(k,k);const phase=s.elapsed*23+d.phase;
    ctx.shadowColor=c;ctx.shadowBlur=d.elite?15:5;
    if(d.type===3){ctx.fillStyle='#152033';ctx.strokeStyle=c;ctx.lineWidth=2;ctx.beginPath();for(const [x,y]of [[-32,4],[-9,-6],[0,-19],[9,-6],[32,4],[29,10],[7,6],[4,21],[-4,21],[-7,6],[-29,10]])ctx.lineTo(x,y);ctx.closePath();ctx.fill();ctx.stroke();rect(-7,-7,14,22,'#50516f');rect(-2,-8,4,10,c);rotor(-20,3,9,phase,c);rotor(20,3,9,-phase,c);rect(-4,17,8,5,'#ffd4a0');}
    else if(d.type===4){ctx.fillStyle='#25303a';ctx.strokeStyle=c;ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-23,-15,46,32,6);ctx.fill();ctx.stroke();for(const x of [-33,33])for(const y of [-18,18]){line([[x*.5,y*.5],[x,y]],'#505a66',5);rotor(x,y,11,phase,c)}rect(-14,-7,28,9,'#445463');rect(-10,-5,20,3,c);rect(-15,10,7,11,'#977162');rect(8,10,7,11,'#977162');}
    else{const points=d.type===2?[[-24,-12],[0,-23],[24,-12],[-24,12],[0,23],[24,12]]:d.type===1?[[-14,-10],[14,-10],[-14,10],[14,10]]:[[-20,-14],[20,-14],[-20,14],[20,14]];for(const [x,y]of points){line([[0,0],[x,y]],'#243c4a',5);rotor(x,y,d.type===1?7:10,phase,c)}ctx.fillStyle=d.type===2?'#525566':'#244250';ctx.strokeStyle=c;ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-10,-9,20,19,4);ctx.fill();ctx.stroke();rect(-5,-4,10,7,d.type===2?'#bba386':'#7296a0');rect(-3,7,6,4,c);if(d.type===2){line([[-8,-4],[8,5]],'#ece0b9',2);line([[8,-4],[-8,5]],'#ece0b9',2)}}
    ctx.shadowBlur=0;if(d.stun>0){ctx.strokeStyle='#9affed';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,t.radius+7,-s.elapsed*3,Math.PI*1.5-s.elapsed*3);ctx.stroke()}ctx.restore();
    if(d.hp<d.maxHp){rect(d.x-r,d.y-r-11,r*2,3,'#0b1525');rect(d.x-r,d.y-r-11,r*2*d.hp/d.maxHp,3,c)}if(d.elite)text(d.x,d.y-r-19,'КОВЧЕГ · '+Math.ceil(d.hp),c,12);
  }
  function drawTurret(){const x=s.playerX,y=485,target=!s.manualAim||s.pointerTimer<=0?aimTarget():null,aim=target||s.aim,a=clamp(Math.atan2(aim.y-477,aim.x-x),-Math.PI+.08,-.08);ctx.save();ctx.translate(x-43,y+18);
    if(defender.complete&&defender.naturalWidth){
      const moving=held('left')||held('right'),row=moving?0:1,col=moving?Math.floor(s.playerPhase/(Math.PI*2)*6)%6:s.mode==='won'?5:s.muzzle>0?4:held('fire')?3:0;
      if(moving?held('left'):col>=3&&col<=4&&aim.x<x)ctx.scale(-1,1);
      const size=82;ctx.drawImage(defender,col*256,row*256,256,256,-size/2,-size*244/256,size,size);
    }else{rect(-10,-48,20,40,'#252536');rect(-7,-63,14,17,'#353b49');rect(-7,-69,3,8,'#252536');rect(4,-69,3,8,'#252536')}
    ctx.restore();
    // The operator's prepared hand poses meet a solid control console.
    line([[x-12,y+8],[x-21,y-26]],'#4d6975',6);rect(x-41,y-43,43,29,'#112535');rect(x-39,y-41,39,25,'#608482');rect(x-36,y-38,32,17,'#173c48');rect(x-33,y-35,19,8,'#83d6c0');rect(x-10,y-35,3,3,'#d6ff70');rect(x-10,y-29,3,3,'#ffb480');
    rect(x-31,y+12,62,11,'#0b1724');rect(x-25,y+7,50,9,'#55747b');rect(x-17,y-2,34,14,'#a1b3a7');rect(x-12,y,24,7,'#435565');for(const xx of [-22,22]){ctx.fillStyle='#0c1721';ctx.beginPath();ctx.arc(x+xx,y+20,7,0,Math.PI*2);ctx.fill();rect(x+xx-2,y+18,4,4,'#708f93')}ctx.save();ctx.translate(x,y-8);ctx.rotate(a);rect(-6,-10,30,20,'#3c5b68');rect(12,-8,36,5,'#8dafaa');rect(12,3,36,5,'#8dafaa');rect(37,-8,11,5,'#2c3d4c');rect(37,3,11,5,'#2c3d4c');if(s.muzzle>0){ctx.fillStyle='#ffe5a0';ctx.beginPath();ctx.moveTo(47,-11);ctx.lineTo(67,0);ctx.lineTo(47,12);ctx.lineTo(53,0);ctx.fill()}ctx.restore();rect(x-9,y-12,18,10,'#8fa397');rect(x-3,y-10,6,3,'#9ce4da');text(x,y+40,'ПВО · ТЫ','#baf8dc',9);
  }
  function draw(){if(!s)return;const width=canvas.clientWidth||960,height=canvas.clientHeight||540,dpr=Math.min(2,window.devicePixelRatio||1);if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr)}ctx.setTransform(dpr,0,0,dpr,0,0);rect(0,0,width,height,'#101928');const scale=Math.min(width/W,height/H);camera={scale,x:(width-W*scale)/2,y:(height-H*scale)/2};ctx.save();ctx.translate(camera.x+(s.shake?Math.sin(s.elapsed*110)*3:0),camera.y);ctx.scale(scale,scale);ctx.imageSmoothingEnabled=false;
    if(bg.complete&&bg.naturalWidth)ctx.drawImage(bg,0,0,W,H);else{const gradient=ctx.createLinearGradient(0,0,0,H);gradient.addColorStop(0,'#171b35');gradient.addColorStop(.67,'#a84e7e');gradient.addColorStop(1,'#233743');ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);rect(100,390,760,90,'#233442')}
    // The backdrop is decorative; the defense line and all enemies are live objects.
    rect(0,0,W,355,'#0c183238');rect(0,467,W,73,'#132330b8');line([[125,GROUND+1],[835,GROUND+1]],'#ffd79c6b',1);text(480,455,'MERCADO · СКЛАД 07','#ffd5b2',12);if(s.shield>0){ctx.save();ctx.strokeStyle='#93ffe76b';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(480,451,365,31,0,Math.PI,Math.PI*2);ctx.stroke();ctx.restore()}
    for(let i=0;i<5;i++){const x=170+i*142;rect(x,GROUND+3,55,6,i<s.wave?'#d6ff7090':'#ffffff20')}
    const vignette=ctx.createLinearGradient(0,0,0,140);vignette.addColorStop(0,'#111a3299');vignette.addColorStop(1,'#111a3200');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,140);
    // Dotted radar sweep and entry markers reveal incoming targets before contact.
    const radarY=(s.elapsed*50)%355;line([[25,radarY],[935,radarY]],'#89e5d515',1);
    for(const d of s.drones){if(d.y<0){text(d.x,22,'▼',types[d.type].color,15);continue}drawDrone(d)}
    for(const b of s.bombs){ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.sin(s.elapsed*5)*.15);rect(-4,-8,8,16,'#172537');rect(-3,-5,6,9,'#ffaf76');line([[-7,-8],[7,-8]],'#e6c8b0',2);ctx.restore();line([[b.x,b.y-15],[b.x,b.y-27]],'#ffae7350',2)}
    for(const b of s.bullets)line([[b.x-b.vx*.014,b.y-b.vy*.014],[b.x,b.y]],'#ffe5a6',2);
    for(const m of s.missiles){if(m.trail.length>1)line(m.trail.map(p=>[p.x,p.y]),'#ffe0bb75',3);ctx.save();ctx.translate(m.x,m.y);ctx.rotate(Math.atan2(m.vy,m.vx));rect(-7,-2,14,4,'#fff0c6');rect(-11,-3,4,6,'#ff9962');ctx.restore()}
    for(const f of s.fx){const p=f.age/f.life;ctx.save();ctx.globalAlpha=1-p;ctx.strokeStyle=f.color;ctx.lineWidth=3*(1-p)+1;ctx.beginPath();ctx.arc(f.x,f.y,f.r*(.2+p),0,Math.PI*2);ctx.stroke();if(p<.3){ctx.fillStyle='#ffe9bd';ctx.beginPath();ctx.arc(f.x,f.y,9*(1-p),0,Math.PI*2);ctx.fill()}ctx.restore()}
    for(const p of s.particles)rect(p.x,p.y,3,3,p.color);drawTurret();
    if(s.empRing>0){ctx.strokeStyle='#a2ffe5';ctx.lineWidth=4;ctx.globalAlpha=s.empRing;ctx.beginPath();ctx.arc(s.playerX,320,(.65-s.empRing)*1200,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
    const target=aimTarget(),aim=s.manualAim&&s.pointerTimer>0?s.aim:target||s.aim;ctx.strokeStyle=target?'#ddff99':'#ffd2be';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(aim.x,aim.y,13,0,Math.PI*2);ctx.stroke();for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])line([[aim.x+dx*17,aim.y+dy*17],[aim.x+dx*23,aim.y+dy*23]],ctx.strokeStyle,1.5);if(target&&s.missileAmmo>0&&distance(target,aim)<150){ctx.strokeStyle='#a2f5d1';ctx.strokeRect(target.x-target.radius-5,target.y-target.radius-5,target.radius*2+10,target.radius*2+10)}
    text(25,24,`СБИТО ${s.kills} · ${s.score} ОЧКОВ`,'#ffedcf',12,'left');text(935,24,`РАКЕТЫ ${'◆'.repeat(s.missileAmmo)}${'◇'.repeat(3-s.missileAmmo)}`,'#b7eee1',12,'right');if(s.combo>1)text(480,33,`СЕРИЯ ×${s.combo}`,'#d6ff70',16);
    if(s.spawnIndex<waves[s.wave].mix.length)text(25,43,`ЦЕЛЬ ${s.spawnIndex+1} / ${waves[s.wave].mix.length}`,'#a9c1d1',9,'left');else text(25,43,'ПОСЛЕДНИЕ ЦЕЛИ','#d6ff70',9,'left');
    if(s.missileAmmo<3){rect(845,35,90,3,'#ffffff18');rect(845,35,90*s.missileCharge/7,3,'#a9e8d4')}
    if(s.overheated)text(s.playerX,424,'СТВОЛ ОСТЫВАЕТ','#ff9cb7',11);if(s.flash>0)rect(0,0,W,H,'#ff78651c');ctx.restore();
  }
  function frame(now){raf=0;if(s?.mode!=='running')return;const dt=Math.min(.04,Math.max(0,(now-last)/1000));last=now;update(dt);hud();draw();if(s.mode==='running')raf=requestAnimationFrame(frame)}
  function pointer(e){const box=canvas.getBoundingClientRect(),x=(e.clientX-box.left-camera.x)/camera.scale,y=(e.clientY-box.top-camera.y)/camera.scale;s.aim={x:clamp(x,0,W),y:clamp(y,0,GROUND-8)};s.manualAim=true;s.pointerTimer=8}
  const codes={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'fire',KeyJ:'fire'},chars={a:'left',ф:'left',d:'right',в:'right',j:'fire',о:'fire',' ':'fire'};
  document.addEventListener('keydown',e=>{if(game.hidden||!s||s.mode==='closed')return;const key=(e.key||'').toLowerCase(),code=e.code||'';if((code==='Enter'||key==='enter')&&!e.repeat){if(e.target?.closest?.('button'))return;e.preventDefault();start();return}if(code==='KeyP'||['p','з'].includes(key)){e.preventDefault();if(!e.repeat)pause();return}if(s.mode!=='running')return;const action=codes[code]||codes[e.key]||chars[key];if(action){e.preventDefault();inputs.set('key:'+(code||key),action)}if(e.repeat)return;if(code==='KeyR'||['r','к'].includes(key)){e.preventDefault();missile()}if(code==='KeyQ'||['q','й'].includes(key)){e.preventDefault();emp()}});
  document.addEventListener('keyup',e=>inputs.delete('key:'+(e.code||(e.key||'').toLowerCase())));
  canvas.addEventListener('pointermove',e=>{if(s?.mode==='running')pointer(e)});canvas.addEventListener('pointerdown',e=>{if(s?.mode!=='running')return;e.preventDefault();pointer(e);if(e.button===2){missile();return}if(e.button&&e.button!==0)return;canvas.setPointerCapture(e.pointerId);inputs.set('pointer:'+e.pointerId,'fire')});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>inputs.delete('pointer:'+e.pointerId));canvas.addEventListener('contextmenu',e=>e.preventDefault());
  game.querySelectorAll('[data-warehouse-hold]').forEach(b=>{b.addEventListener('pointerdown',e=>{if(s?.mode!=='running')return;e.preventDefault();b.setPointerCapture(e.pointerId);const action=b.dataset.warehouseHold;if(action==='fire'){s.manualAim=false;s.pointerTimer=0}inputs.set('touch:'+e.pointerId,action)});for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,e=>inputs.delete('touch:'+e.pointerId))});
  $('warehouseStart').addEventListener('click',start);$('warehouseMissile').addEventListener('click',missile);$('warehouseEmp').addEventListener('click',emp);$('warehousePause').addEventListener('click',pause);$('warehouseSound').addEventListener('click',()=>{soundOn=!soundOn;$('warehouseSound').textContent=soundOn?'ЗВУК ВКЛ':'ЗВУК ВЫКЛ';if(soundOn)beep(500,.1)});
  for(const kind of ['gun','cooling','shield','repair'])$('warehouseUpgrade'+kind).addEventListener('click',()=>upgrade(kind));
  window.addEventListener('blur',()=>pause());document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});window.addEventListener('resize',draw);window.addEventListener('avatarready',draw);canvas.tabIndex=0;
  window.WarehouseDefense={open,stop};open();stop();
})();
