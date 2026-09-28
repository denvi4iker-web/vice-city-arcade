(() => {
  const root = document.getElementById('releaseCountdown');
  if (!root) return;
  const fields = [document.getElementById('countDays'), document.getElementById('countHours'), document.getElementById('countMinutes'), document.getElementById('countSeconds')];
  const note = document.getElementById('countdownNote');
  const target = new Date(2026, 10, 19).getTime();
  const render = () => {
    const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    [days, hours, minutes, seconds].forEach((value, index) => {
      fields[index].textContent = index === 0 ? String(value) : String(value).padStart(2, '0');
    });
    if (remaining === 0) {
      root.classList.add('released');
      note.textContent = 'Дата релиза наступила. Проверьте актуальную информацию у Rockstar Games.';
    }
  };
  render();
  setInterval(render, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
})();
