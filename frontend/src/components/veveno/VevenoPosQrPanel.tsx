import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { vevenoApi } from '../../api/vevenoApi';
import { getVevenoErrorMessage } from '../../features/veveno/i18n/error';
import { useTranslation } from '../../features/veveno/i18n/LanguageContext';
import {
  getOrCreatePosDeviceId,
  setVevenoPosToken,
} from '../../features/veveno/pos/session';

interface ActivePair {
  pairId: string;
  secret: string;
  payload: string;
}

const ROTATE_MS = 110_000;
const POLL_MS = 1500;

function formatRemain(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}

export function VevenoPosQrPanel() {
  const t = useTranslation();
  const navigate = useNavigate();
  const [qrUrl, setQrUrl] = useState('');
  const [error, setError] = useState('');
  const [expireAt, setExpireAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const currentRef = useRef<ActivePair | null>(null);
  const previousRef = useRef<ActivePair | null>(null);
  const claimingRef = useRef(false);

  const paintQr = useCallback(async (payload: string) => {
    const url = await QRCode.toDataURL(payload, {
      margin: 1,
      width: 280,
      color: { dark: '#1c1917', light: '#ffffff' },
    });
    setQrUrl(url);
  }, []);

  const rotatePair = useCallback(async () => {
    const created = await vevenoApi.posCreateSession(getOrCreatePosDeviceId());
    previousRef.current = currentRef.current;
    const next: ActivePair = {
      pairId: created.data.pairId,
      secret: created.data.secret,
      payload: created.data.payload,
    };
    currentRef.current = next;
    await paintQr(next.payload);
    const stamped = Date.now();
    setNow(stamped);
    setExpireAt(stamped + ROTATE_MS);
  }, [paintQr]);

  useEffect(() => {
    let cancelled = false;
    void rotatePair().catch((err: unknown) => {
      if (!cancelled) {
        setError(getVevenoErrorMessage(err, t('errors.failPosPair'), t));
      }
    });
    const rotateTimer = window.setInterval(() => {
      void rotatePair().catch((err: unknown) => {
        setError(getVevenoErrorMessage(err, t('errors.failPosPair'), t));
      });
    }, ROTATE_MS);
    return () => {
      cancelled = true;
      window.clearInterval(rotateTimer);
    };
  }, [rotatePair, t]);

  useEffect(() => {
    const pollTimer = window.setInterval(() => {
      const pairs = [currentRef.current, previousRef.current].filter(
        (pair): pair is ActivePair => pair !== null,
      );
      if (pairs.length === 0 || claimingRef.current) {
        return;
      }
      void vevenoApi
        .posPoll(pairs.map((pair) => ({ pairId: pair.pairId, secret: pair.secret })))
        .then(async (res) => {
          if (res.data.status !== 'ready' || !res.data.pairId || claimingRef.current) {
            return;
          }
          const ready = pairs.find((pair) => pair.pairId === res.data.pairId);
          if (!ready) {
            return;
          }
          claimingRef.current = true;
          const claimed = await vevenoApi.posClaim(ready.pairId, ready.secret);
          setVevenoPosToken(claimed.data.accessToken, claimed.data.storeId);
          void navigate(`/hobbies/veveno/pos/store/${claimed.data.storeId}`, {
            replace: true,
          });
        })
        .catch((err: unknown) => {
          claimingRef.current = false;
          setError(getVevenoErrorMessage(err, t('errors.failPosClaim'), t));
        });
    }, POLL_MS);
    return () => {
      window.clearInterval(pollTimer);
    };
  }, [navigate, t]);

  useEffect(() => {
    if (expireAt === null) {
      return;
    }
    const tick = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(tick);
    };
  }, [expireAt]);

  return (
    <div className="veveno-pos-wait">
      <p className="veveno-shell__meta">{t('pos.waitingHelp')}</p>
      <div className="veveno-pos-qr">
        {qrUrl ? (
          <img src={qrUrl} alt={t('pos.qrAlt')} width={280} height={280} />
        ) : (
          <p className="veveno-empty">{t('store.loading')}</p>
        )}
      </div>
      {qrUrl && expireAt !== null ? (
        <p className="veveno-pos-qr-remain">
          {t('pos.qrRemain', { time: formatRemain(expireAt - now) })}
        </p>
      ) : null}
      {error ? <p className="veveno-error">{error}</p> : null}
    </div>
  );
}
