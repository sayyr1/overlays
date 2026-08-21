export const currentElapsedSeconds = (clock, now = Date.now()) => {
  const base = Math.max(0, Number(clock?.elapsedSeconds) || 0);
  if (!clock?.running || !clock?.startedAt) return base;
  return base + Math.max(0, Math.floor((now - new Date(clock.startedAt).getTime()) / 1000));
};

export const pauseClock = (clock, now = Date.now()) => ({
  ...clock,
  elapsedSeconds: currentElapsedSeconds(clock, now),
  startedAt: null,
  running: false
});

export const startClock = (clock, now = new Date()) => ({
  ...clock,
  startedAt: now,
  running: true
});

export const formatClock = seconds => {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};
