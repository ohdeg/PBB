import { Link } from 'react-router-dom';

export type StatusVariant = 'maintenance' | 'error' | 'notFound';

interface StatusPreset {
  kicker: string;
  title: string;
  message: string;
  icon: 'maintenance' | 'error' | 'notFound';
}

const PRESETS: Record<StatusVariant, StatusPreset> = {
  maintenance: {
    kicker: 'Maintenance',
    title: '잠시 서버를 점검하고 있어요',
    message: '더 안정적인 서비스를 위해 점검 중입니다. 잠시 후 다시 시도해 주세요.',
    icon: 'maintenance',
  },
  error: {
    kicker: 'Error',
    title: '문제가 발생했어요',
    message: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    icon: 'error',
  },
  notFound: {
    kicker: '404',
    title: '페이지를 찾을 수 없어요',
    message: '주소가 바뀌었거나 삭제된 페이지일 수 있어요.',
    icon: 'notFound',
  },
};

interface StatusViewProps {
  variant: StatusVariant;
  /** 프리셋 제목 대체 */
  title?: string;
  /** 프리셋 안내 문구 대체 */
  message?: string;
  /** 제목 아래 작은 보조 문구 (에러 코드 등) */
  detail?: string;
  /** "다시 시도" 버튼 동작. 없으면 버튼 숨김 */
  onRetry?: () => void;
  retryLabel?: string;
  /** "홈으로" 링크 노출 여부 (기본 true) */
  showHome?: boolean;
  /** 전체 화면 오버레이로 표시할지 (기본 false = 페이지 내 영역) */
  fullscreen?: boolean;
}

export function StatusView({
  variant,
  title,
  message,
  detail,
  onRetry,
  retryLabel = '다시 시도',
  showHome = true,
  fullscreen = false,
}: StatusViewProps) {
  const preset = PRESETS[variant];

  return (
    <div
      className={`status-view${fullscreen ? ' status-view--fullscreen' : ''}`}
      data-variant={variant}
      role="alert"
    >
      <div className="status-view__glow" aria-hidden="true" />
      <div className="status-view__inner">
        <StatusIcon icon={preset.icon} />
        <p className="status-view__kicker">{preset.kicker}</p>
        <h1 className="status-view__title">{title ?? preset.title}</h1>
        <p className="status-view__message">{message ?? preset.message}</p>
        {detail ? <p className="status-view__detail">{detail}</p> : null}

        {onRetry || showHome ? (
          <div className="status-view__actions">
            {onRetry ? (
              <button type="button" className="btn-primary" onClick={onRetry}>
                {retryLabel}
              </button>
            ) : null}
            {showHome ? (
              <Link to="/" className="btn-secondary link-as-btn">
                홈으로
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatusIcon({ icon }: { icon: StatusPreset['icon'] }) {
  return (
    <span className={`status-view__icon status-view__icon--${icon}`} aria-hidden="true">
      {icon === 'maintenance' ? (
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
          <path
            d="M14.7 6.3a3.5 3.5 0 0 0-4.6 4.6L4 17l3 3 6.1-6.1a3.5 3.5 0 0 0 4.6-4.6l-2.1 2.1-2.1-.6-.6-2.1 2.1-2.1Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : icon === 'error' ? (
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 8.2v4.2M12 16h.01M10.3 3.9 2.7 17.4A2 2 0 0 0 4.4 20.4h15.2a2 2 0 0 0 1.7-3l-7.6-13.5a2 2 0 0 0-3.4 0Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
          <path
            d="M11 19a8 8 0 1 1 5.7-2.3M20 20l-3.3-3.3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}
