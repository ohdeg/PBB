import { useCallback, useEffect, useRef, useState } from 'react';
import { createGestureState, normalizeHoldMs, type GesturePhase } from './gestureState';
const preferencesKey = 'tempori:camera-turn-preferences';
function preferences() { try { const value = JSON.parse(localStorage.getItem(preferencesKey) ?? '{}'); return { holdMs: normalizeHoldMs(value.holdMs), invert: value.invert === true }; } catch { return { holdMs: 450 as const, invert: false }; } }
export function useCameraPageTurn(onTurn: (delta: -1 | 1) => void, suspended: boolean, manualRevision: number) {
  const [settings, setSettings] = useState(preferences); const [status, setStatus] = useState<'off' | 'requesting' | 'calibrating' | 'active' | 'error'>('off');
  const [phase, setPhase] = useState<GesturePhase>('calibrating'); const [error, setError] = useState('');
  const [practice, setPractice] = useState(true); const [tested, setTested] = useState<number[]>([]); const [lastDirection, setLastDirection] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null); const stream = useRef<MediaStream | null>(null); const worker = useRef<Worker | null>(null);
  const frameTimer = useRef<ReturnType<typeof setTimeout> | null>(null); const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null); const generation = useRef(0); const machine = useRef(createGestureState(settings.holdMs));
  const current = useRef({ onTurn, suspended, settings, practice }); current.current = { onTurn, suspended, settings, practice };
  const stop = useCallback(() => { generation.current += 1; if (watchdog.current) clearTimeout(watchdog.current); watchdog.current = null; if (frameTimer.current) clearTimeout(frameTimer.current); frameTimer.current = null; stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; worker.current?.terminate(); worker.current = null; if (videoRef.current) videoRef.current.srcObject = null; setStatus('off'); }, []);
  const fail = useCallback((message: string) => { stop(); setError(message); setStatus('error'); }, [stop]);
  const start = useCallback(async () => {
    stop(); const revision = generation.current; setError(''); setPractice(true); setTested([]); setLastDirection(null); setStatus('requesting');
    machine.current = createGestureState(current.current.settings.holdMs);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !('Worker' in window) || !('OffscreenCanvas' in window) || !('createImageBitmap' in window)) { fail('이 브라우저에서는 카메라 넘김을 지원하지 않습니다. 하단 버튼이나 스와이프를 사용해 주세요.'); return; }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640, max: 640 }, height: { ideal: 480, max: 480 } }, audio: false });
      if (revision !== generation.current) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media; const video = videoRef.current; if (!video) { stop(); return; } video.srcObject = media; await video.play();
      if (revision !== generation.current) return;
      const runtime = new Worker(new URL('./faceLandmarker.worker.ts', import.meta.url), { type: 'module' }); worker.current = runtime; watchdog.current = setTimeout(() => { if (revision === generation.current) fail('카메라 모델 응답 시간이 초과되었습니다. 다시 시도해 주세요.'); }, 30000);
      let busy = false; let lastFrame = -Infinity;
      const tick = async () => {
        if (revision !== generation.current) return;
        const timestamp = performance.now();
        if (!busy && video.readyState >= 2 && timestamp - lastFrame >= 100) {
          busy = true; lastFrame = timestamp;
          try {
            const captureScale = Math.min(1, 640 / video.videoWidth, 480 / video.videoHeight);
            const bitmap = await createImageBitmap(video, { resizeWidth: Math.max(1, Math.round(video.videoWidth * captureScale)), resizeHeight: Math.max(1, Math.round(video.videoHeight * captureScale)) });
            if (revision !== generation.current) { bitmap.close(); return; }
            runtime.postMessage({ type: 'frame', frame: bitmap, timestamp }, [bitmap]);
            watchdog.current = setTimeout(() => { if (revision === generation.current) fail('카메라 인식 응답이 중단되었습니다. 수동으로 넘기거나 다시 켜 주세요.'); }, 5000);
          } catch { if (revision === generation.current) fail('카메라 프레임을 읽지 못했습니다. 다시 켜 주세요.'); return; }
        }
        frameTimer.current = setTimeout(tick, 50);
      };
      runtime.onerror = () => { if (revision === generation.current) fail('이 브라우저의 카메라 인식 Worker를 사용할 수 없습니다. 수동으로 넘겨 주세요.'); };
      runtime.onmessage = (event) => {
        if (revision !== generation.current) return;
        if (watchdog.current) clearTimeout(watchdog.current); watchdog.current = null;
        if (event.data.type === 'error') { fail(event.data.message); return; }
        if (event.data.type === 'ready') { setStatus('calibrating'); void tick(); return; }
        if (event.data.type !== 'sample') return; busy = false;
        if (current.current.suspended && !current.current.practice) { machine.current.requireNeutral(); return; }
        const delta = machine.current.sample(event.data); setPhase(machine.current.phase());
        if (machine.current.phase() !== 'calibrating') setStatus('active');
        if (delta) {
          const direction = (current.current.settings.invert ? -delta : delta) as -1 | 1;
          setLastDirection(direction);
          if (current.current.practice) setTested((previous) => [...new Set([...previous, direction])]); else current.current.onTurn(direction);
        }
      };
      const assetRoot = new URL(`${import.meta.env.BASE_URL}tempori/vision/`, window.location.href);
      runtime.postMessage({ type: 'init', wasmUrl: new URL('1.2.0/', assetRoot).href, modelUrl: new URL('face_landmarker.float16.task', assetRoot).href });
    } catch { if (revision === generation.current) fail('카메라 권한 또는 모델 로딩을 확인해 주세요. 다시 켜기 전에는 권한을 요청하지 않습니다.'); }
  }, [stop, fail]);
  useEffect(() => { machine.current.requireNeutral(); }, [manualRevision, suspended]);
  useEffect(() => { const hidden = () => { if (document.hidden) stop(); }; const rotate = () => { machine.current.recalibrate(); setPractice(true); setTested([]); }; document.addEventListener('visibilitychange', hidden); window.addEventListener('orientationchange', rotate); return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('orientationchange', rotate); stop(); }; }, [stop]);
  const configure = (holdMs: unknown, invert: boolean) => { const next = { holdMs: normalizeHoldMs(holdMs), invert }; machine.current.configure(next.holdMs); if (invert !== settings.invert) { machine.current.recalibrate(); setPractice(true); setTested([]); } setSettings(next); try { localStorage.setItem(preferencesKey, JSON.stringify(next)); } catch { setError('설정을 저장하지 못했습니다. 이번 연습에는 선택한 설정을 사용합니다.'); } };
  return { videoRef, status, phase, error, settings, practice, tested, lastDirection, start, stop, configure,
    beginTurning() { if (tested.includes(-1) && tested.includes(1)) { machine.current.requireNeutral(); setPractice(false); } },
    recalibrate() { machine.current.recalibrate(); setPractice(true); setTested([]); },
  };
}
