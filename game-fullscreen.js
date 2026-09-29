(() => {
  const modal = document.getElementById('modal');
  const box = modal?.querySelector('.modal-box');
  const button = document.getElementById('gameFullscreen');
  if (!modal || !box || !button) return;
  let nativeFullscreen = false;
  const setExpanded = on => {
    modal.classList.toggle('is-expanded', on);
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', on ? 'Выйти из полноэкранного режима' : 'Развернуть игру на весь экран');
    button.title = on ? 'Свернуть' : 'На весь экран';
    button.textContent = on ? '⤢' : '⛶';
  };
  const leave = async () => {
    if (document.fullscreenElement === box && document.exitFullscreen) {
      try { await document.exitFullscreen(); } catch (_) {}
    }
    nativeFullscreen = false;
    setExpanded(false);
  };
  button.addEventListener('click', async () => {
    if (modal.classList.contains('is-expanded')) { await leave(); return; }
    setExpanded(true);
    const mobileViewport = window.matchMedia('(pointer:coarse), (max-width:760px)').matches;
    if (box.requestFullscreen && !mobileViewport) {
      try { await box.requestFullscreen(); nativeFullscreen = true; } catch (_) { /* The CSS viewport mode works on browsers without native fullscreen. */ }
    }
  });
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === box) { nativeFullscreen = true; setExpanded(true); }
    else if (nativeFullscreen) { nativeFullscreen = false; setExpanded(false); }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('is-expanded') && document.fullscreenElement !== box) {
      event.preventDefault();
      setExpanded(false);
      button.focus();
    }
  });
  document.addEventListener('arcade:modal', event => { if (!event.detail.open) void leave(); });
})();
