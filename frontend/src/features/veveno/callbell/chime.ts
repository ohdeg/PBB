const SRC = '/veveno/call-bell.mp3';
/** Speak the number after the 띵-동, while the tail still rings. */
const SPEAK_AFTER_MS = 1400;

let current: HTMLAudioElement | null = null;
let speakTimer = 0;

/** Mixkit “Home standard ding dong” — cafe-style 띵-동, then `onDone`. */
export function playCallBellChime(onDone: () => void): void {
  current?.pause();
  window.clearTimeout(speakTimer);
  const audio = new Audio(SRC);
  current = audio;
  let spoken = false;
  const speak = () => {
    if (spoken) {
      return;
    }
    spoken = true;
    onDone();
  };
  audio.addEventListener('error', speak, { once: true });
  audio.addEventListener(
    'ended',
    () => {
      if (current === audio) {
        current = null;
      }
    },
    { once: true },
  );
  void audio.play().catch(speak);
  speakTimer = window.setTimeout(speak, SPEAK_AFTER_MS);
}
