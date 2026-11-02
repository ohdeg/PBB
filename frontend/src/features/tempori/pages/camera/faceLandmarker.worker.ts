/// <reference lib="webworker" />
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
let landmarker: FaceLandmarker | null = null;
self.onmessage = async (event: MessageEvent) => {
  if (event.data.type === 'init') {
    try {
      const files = await FilesetResolver.forVisionTasks(event.data.wasmUrl, true);
      landmarker = await FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: event.data.modelUrl, delegate: 'CPU' }, runningMode: 'VIDEO', numFaces: 2,
        minFaceDetectionConfidence: .8, minFacePresenceConfidence: .8, minTrackingConfidence: .8, outputFacialTransformationMatrixes: true });
      self.postMessage({ type: 'ready' });
    } catch { self.postMessage({ type: 'error', message: '이 브라우저에서 카메라 인식을 시작하지 못했습니다. 수동으로 넘겨 주세요.' }); }
  } else if (event.data.type === 'frame') {
    const frame = event.data.frame as ImageBitmap;
    try {
      if (!landmarker) throw new Error('Not ready');
      const result = landmarker.detectForVideo(frame, event.data.timestamp);
      const matrix = result.facialTransformationMatrixes[0]?.data;
      // Column-major rotation: physical head yaw, independent of mirrored preview.
      const yaw = matrix ? Math.atan2(matrix[8], matrix[10]) * 180 / Math.PI : NaN;
      self.postMessage({ type: 'sample', faces: result.faceLandmarks.length, yaw, timestamp: event.data.timestamp });
    } catch { self.postMessage({ type: 'error', message: '카메라 인식이 중단되었습니다. 다시 켜거나 수동으로 넘겨 주세요.' }); }
    finally { frame.close(); }
  }
};
