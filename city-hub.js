(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const cards=[...document.querySelectorAll('[data-news]')],filters=[...document.querySelectorAll('[data-news-filter]')];
  filters.forEach(b=>b.addEventListener('click',()=>{let count=0;cards.forEach(c=>{c.hidden=b.dataset.newsFilter!=='all'&&c.dataset.news!==b.dataset.newsFilter;if(!c.hidden)count++});filters.forEach(f=>{const on=f===b;f.classList.toggle('active',on);f.setAttribute('aria-pressed',String(on))});$('newsCount').textContent=`${count} ${count===1?'МАТЕРИАЛ':count<5?'МАТЕРИАЛА':'МАТЕРИАЛОВ'}`}));
  const audio=$('radioAudio');if(!audio||typeof audio.play!=='function')return;
  const tracks=[
    {station:'OCEAN FM',frequency:'94.6 FM',title:'Ocean Afterglow',description:'Тёплый синтвейв для поездки вдоль океана.',file:'audio/ocean-afterglow.wav'},
    {station:'NIGHT DRIVE',frequency:'107.7 FM',title:'Midnight Run',description:'Пульсирующий бас и ночной ритм для следующего заезда.',file:'audio/midnight-run.wav'},
    {station:'LIGHTHOUSE',frequency:'88.3 FM',title:'Lighthouse Breeze',description:'Мягкие синтезаторы и морская атмосфера у маяка.',file:'audio/lighthouse-breeze.wav'}
  ];
  let station=0,volume=.45,muted=false,duck=true,wantsPlay=false,inView=true,inGame=false,request=0,started=false,loading=false,problem='';
  try{const saved=JSON.parse(localStorage.getItem('viceRadio')||'null');if(saved){station=Number.isInteger(saved.station)&&saved.station>=0&&saved.station<tracks.length?saved.station:0;volume=Number.isFinite(saved.volume)?Math.max(0,Math.min(1,saved.volume)):.45;muted=!!saved.muted;duck=saved.duck!==false}}catch{}
  const buttons=[...document.querySelectorAll('[data-station]')];
  const time=n=>!Number.isFinite(n)?'—:—':`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
  function save(){try{localStorage.setItem('viceRadio',JSON.stringify({station,volume,muted,duck}))}catch{}}
  function applyVolume(){audio.volume=Math.max(0,Math.min(1,volume*(inGame && duck ? .22 : 1)));audio.muted=muted;$('radioVolume').value=String(Math.round(volume*100));$('radioVolumeValue').textContent=`${Math.round(volume*100)}%`;$('radioMute').textContent=muted?'◖×':'◖))';$('radioMute').setAttribute('aria-pressed',String(muted));$('radioMute').setAttribute('aria-label',muted?'Включить звук':'Выключить звук');$('radioDuck').checked=duck;renderStatus()}
  function renderStatus(){let text=problem|| (loading?'Подключаем эфир…':audio.paused?(started?'Эфир на паузе. Продолжи с того же места.':`${tracks[station].station} готово к прослушиванию.`):muted||volume===0?'Эфир идёт без звука. Увеличь громкость или включи звук.':inGame&&duck?'Эфир приглушён на время игры.':`Сейчас в эфире: ${tracks[station].title}.`);$('radioStatus').textContent=text}
  function progress(){const duration=audio.duration,current=audio.currentTime||0;$('radioElapsed').textContent=time(current);$('radioDuration').textContent=time(duration);$('radioSeek').disabled=!Number.isFinite(duration)||duration<=0;if(Number.isFinite(duration)&&duration>0)$('radioSeek').value=String(current/duration*100)}
  function ui(){const playing=!audio.paused&&!audio.ended;$('radioDeck').classList.toggle('playing',playing);$('radioPlay').textContent=playing?'Ⅱ ПАУЗА ЭФИРА':'▶ ВКЛЮЧИТЬ ЭФИР';$('radioPlay').setAttribute('aria-pressed',String(playing));$('radioOnAir').textContent=playing?'● В ЭФИРЕ':'● ВНЕ ЭФИРА';$('radioMiniPlay').textContent=playing?'Ⅱ':'▶';$('radioMiniPlay').setAttribute('aria-label',playing?'Пауза радио':'Включить радио');$('radioMini').hidden=!started||inView||inGame}
  function choose(index,continuePlaying=wantsPlay){request++;loading=false;problem='';station=(index+tracks.length)%tracks.length;audio.pause();audio.src=tracks[station].file;audio.load();const t=tracks[station];$('radioStationName').textContent=t.station;$('radioFrequency').textContent=t.frequency;$('radioTrack').textContent=t.title;$('radioDescription').textContent=t.description;$('radioMiniStation').textContent=t.station;$('radioMiniTrack').textContent=t.title;buttons.forEach(b=>{const on=Number(b.dataset.station)===station;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on))});$('radioSeek').value='0';progress();applyVolume();save();ui();$('radioStatus').textContent=`${t.station} · ${t.title}. ${continuePlaying?'Подключаем эфир…':'Готово к прослушиванию.'}`;if(continuePlaying)play()}
  async function play(){wantsPlay=true;loading=true;problem='';const token=++request;renderStatus();try{await audio.play();if(token!==request)return;started=true;loading=false;renderStatus();ui()}catch(error){if(token!==request)return;wantsPlay=false;loading=false;problem=error?.name==='NotAllowedError'?'Нажми «Включить эфир», чтобы браузер разрешил звук.':'Не удалось загрузить музыку. Повтори запуск эфира.';renderStatus();ui()}}
  function pause(){wantsPlay=false;loading=false;problem='';request++;audio.pause();ui();renderStatus()}
  const toggle=()=>audio.paused?play():pause();
  $('radioPlay').addEventListener('click',toggle);$('radioMiniPlay').addEventListener('click',toggle);
  $('radioNext').addEventListener('click',()=>choose(station+1));$('radioPrev').addEventListener('click',()=>choose(station-1));$('radioMiniNext').addEventListener('click',()=>choose(station+1));buttons.forEach(b=>b.addEventListener('click',()=>{const index=Number(b.dataset.station);if(index!==station)choose(index)}));
  $('radioMute').addEventListener('click',()=>{muted=!muted;applyVolume();save();renderStatus()});
  $('radioVolume').addEventListener('input',e=>{volume=Math.max(0,Math.min(1,Number(e.target.value)/100));if(volume>0)muted=false;applyVolume();save()});
  $('radioDuck').addEventListener('change',e=>{duck=e.target.checked;applyVolume();save()});
  $('radioSeek').addEventListener('input',e=>{if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=audio.duration*Math.max(0,Math.min(100,Number(e.target.value)))/100;progress()});
  ['loadedmetadata','durationchange','timeupdate'].forEach(event=>audio.addEventListener(event,progress));['play','pause','ended'].forEach(event=>audio.addEventListener(event,ui));audio.addEventListener('error',()=>{if(wantsPlay){wantsPlay=false;loading=false;problem='Аудиофайл не загрузился. Попробуй ещё раз.';ui();renderStatus()}});
  document.addEventListener('arcade:modal',e=>{inGame=!!e.detail?.open;applyVolume();ui();renderStatus()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&!audio.paused)pause()});
  if(window.IntersectionObserver){new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;ui()},{threshold:0}).observe(document.querySelector('.radio-playback'))}
  choose(station,false);
})();
