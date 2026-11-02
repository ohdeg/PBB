import { useEffect, useState } from 'react';
import { useCameraPageTurn } from './useCameraPageTurn';
export function CameraTurnSettings({ onTurn, suspended, manualRevision, onSettingsChange }: { onSettingsChange?: (open: boolean) => void; onTurn: (delta: -1 | 1) => void; suspended: boolean; manualRevision: number }) {
  const [open, setOpen] = useState(false); const camera = useCameraPageTurn(onTurn, suspended || open, manualRevision);
  useEffect(() => { onSettingsChange?.(open); }, [open, onSettingsChange]);
  const active = camera.status !== 'off' && camera.status !== 'error';
  return <div className="tempori-camera-settings">
    <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>카메라 넘김 · {active ? '사용 중' : '꺼짐'}</button>
    <div role={open ? "dialog" : undefined} aria-label={open ? "카메라 넘김 설정" : undefined} className={open ? 'tempori-camera-panel' : 'tempori-camera-panel tempori-camera-panel--closed'}>
      <h3>카메라로 넘기기 <small>실험 기능</small></h3>
      <p>영상은 기기에서만 처리하며 저장하거나 전송하지 않습니다. 고개를 오른쪽으로 돌려 유지하면 다음, 왼쪽이면 이전 페이지입니다.</p>
      <label>인식 속도 <select value={camera.settings.holdMs} onChange={(event) => camera.configure(Number(event.target.value), camera.settings.invert)}><option value={300}>빠르게 · 300ms</option><option value={450}>기본 · 450ms</option><option value={700}>신중하게 · 700ms</option></select></label>
      <label><input type="checkbox" checked={camera.settings.invert} onChange={(event) => camera.configure(camera.settings.holdMs, event.target.checked)} />좌우 방향 반전</label>
      <p>25° 이상 돌려 선택한 시간 동안 유지하세요. 넘긴 뒤에는 1.5초 대기하고 정면으로 300ms 돌아와야 합니다.</p>
      <video ref={camera.videoRef} muted playsInline aria-label="좌우가 반전된 카메라 미리보기" className={active ? '' : 'tempori-camera-video--off'} />
      {active && <p role="status">{camera.phase === 'calibrating' ? '정면을 2초 동안 보며 보정하세요.' : camera.practice ? '연습: 양쪽 동작을 확인하세요.' : suspended || open ? '설정·필기·확대 중에는 넘김을 쉬고 있습니다.' : '카메라 사용 중 · 고개로 넘기기 준비됨'}</p>}
      {active && camera.practice && <><p aria-live="polite">이전 {camera.tested.includes(-1) ? '✓' : '대기'} · 다음 {camera.tested.includes(1) ? '✓' : '대기'} {camera.lastDirection ? `· ${camera.lastDirection > 0 ? '다음' : '이전'} 인식` : ''}</p><button type="button" disabled={camera.tested.length < 2} onClick={() => { camera.beginTurning(); setOpen(false); }}>확인 완료 · 페이지 넘기기 시작</button></>}
      {camera.error && <p role="alert">{camera.error}</p>}
      {active ? <><button type="button" onClick={camera.stop}>카메라 즉시 끄기</button><button type="button" onClick={camera.recalibrate}>다시 보정</button></> : <button type="button" onClick={() => void camera.start()}>카메라로 넘기기 켜기</button>}
      <button type="button" onClick={() => setOpen(false)}>설정 닫기</button>
    </div>
    {active && !open && <span className="tempori-camera-live"><span aria-hidden="true">●</span> 카메라 사용 중 <button type="button" onClick={camera.stop}>끄기</button></span>}
  </div>;
}
