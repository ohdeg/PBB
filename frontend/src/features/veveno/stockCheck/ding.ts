let ctx: AudioContext | null = null;
let unlocked = false;

function context(): AudioContext | null {
  const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    return null;
  }
  if (!ctx) {
    ctx = new AudioCtx();
  }
  return ctx;
}

export function unlockStockCheckDing(): void {
  if (unlocked) {
    return;
  }
  const audio = context();
  if (!audio) {
    return;
  }
  void audio.resume();
  unlocked = true;
}

export function playStockCheckDing(): void {
  const audio = context();
  if (!audio) {
    return;
  }
  void audio.resume();
  const now = audio.currentTime;
  const beep = (freq: number, start: number, dur: number) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + start);
    gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now + start);
    osc.stop(now + start + dur + 0.02);
  };
  beep(880, 0, 0.12);
  beep(1318.5, 0.14, 0.16);
}
