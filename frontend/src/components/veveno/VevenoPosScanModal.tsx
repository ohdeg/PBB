import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { vevenoApi } from '../../api/vevenoApi';
import { getVevenoErrorMessage } from '../../features/veveno/i18n/error';
import { useTranslation } from '../../features/veveno/i18n/LanguageContext';
import { parsePosQr } from '../../features/veveno/pos/parseQr';
import { VevenoButton } from './VevenoButton';
import { VevenoModal } from './VevenoModal';

interface VevenoPosScanModalProps {
  open: boolean;
  storeId: string;
  onClose: () => void;
}

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

function createDetector(): BarcodeDetectorLike | null {
  const Detector = (
    window as Window & {
      BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
    }
  ).BarcodeDetector;
  if (!Detector) {
    return null;
  }
  try {
    return new Detector({ formats: ['qr_code'] });
  } catch {
    return null;
  }
}

export function VevenoPosScanModal({
  open,
  storeId,
  onClose,
}: VevenoPosScanModalProps) {
  const t = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const lockingRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setError('');
      setDone(false);
      lockingRef.current = false;
      return;
    }
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const detector = createDetector();

    const approve = async (raw: string) => {
      const parsed = parsePosQr(raw);
      if (!parsed) {
        if (raw) {
          setError(t('pos.badQr'));
        }
        return;
      }
      if (lockingRef.current) {
        return;
      }
      lockingRef.current = true;
      try {
        await vevenoApi.posApprove(parsed.pairId, storeId, parsed.secret);
        stopped = true;
        setDone(true);
        setError('');
      } catch (err: unknown) {
        lockingRef.current = false;
        setError(getVevenoErrorMessage(err, t('errors.failPosApprove'), t));
      }
    };

    const tick = async () => {
      if (stopped || done || lockingRef.current) {
        if (!stopped && !done) {
          raf = window.requestAnimationFrame(() => {
            void tick();
          });
        }
        return;
      }
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2) {
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (width > 0 && height > 0) {
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            if (detector) {
              const codes = await detector.detect(canvas);
              if (codes[0]?.rawValue) {
                await approve(codes[0].rawValue);
              }
            } else {
              const image = ctx.getImageData(0, 0, width, height);
              const code = jsQR(image.data, width, height);
              if (code?.data) {
                await approve(code.data);
              }
            }
          }
        }
      }
      if (!stopped) {
        raf = window.requestAnimationFrame(() => {
          void tick();
        });
      }
    };

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        const video = videoRef.current;
        if (!video) {
          return;
        }
        video.srcObject = stream;
        await video.play();
        raf = window.requestAnimationFrame(() => {
          void tick();
        });
      } catch {
        setError(t('pos.cameraDenied'));
      }
    })();

    return () => {
      stopped = true;
      window.cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [open, storeId, t]);

  return (
    <VevenoModal open={open} title={t('pos.scanTitle')} onClose={onClose}>
      {done ? (
        <p className="veveno-empty">{t('pos.scanOk')}</p>
      ) : (
        <>
          <p className="veveno-card-lead">{t('pos.scanHelp')}</p>
          <div className="veveno-pos-scan">
            <video ref={videoRef} className="veveno-pos-scan__video" playsInline muted />
            <canvas ref={canvasRef} hidden />
          </div>
          {error ? <p className="veveno-error">{error}</p> : null}
        </>
      )}
      <div className="veveno-btn-row">
        <VevenoButton type="button" onClick={onClose}>
          {t('common.close')}
        </VevenoButton>
      </div>
    </VevenoModal>
  );
}
