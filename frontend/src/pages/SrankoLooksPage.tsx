import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog } from '../components/ui/Dialog';
import { SRANKO_CLOSET } from '../features/sranko/paths';
import {
  formatSrankoCategoryLabel,
  SLOT_LABEL,
  type SrankoLook,
  type SrankoLookItem,
} from '../features/sranko/types';
import {
  useSrankoLooks,
  useSrankoMutations,
} from '../features/sranko/useSrankoStore';
import { useAuthStore } from '../stores/authStore';

export function SrankoLooksPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { looks, loading, error, reload } = useSrankoLooks();
  const { removeLook } = useSrankoMutations();

  const [detailLook, setDetailLook] = useState<SrankoLook | null>(null);
  const [selectedItem, setSelectedItem] = useState<SrankoLookItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const closeLookDetail = () => {
    setDetailLook(null);
    setSelectedItem(null);
    setActionError('');
  };

  if (!accessToken) {
    return (
      <section className="sranko-panel">
        <h1>내 룩</h1>
        <div className="sranko-empty">
          <Link className="sranko-link" to="/login" state={{ from: '/hobbies/sranko/looks' }}>
            로그인
          </Link>
          이 필요합니다.
        </div>
      </section>
    );
  }

  return (
    <section className="sranko-panel">
      <h1>내 룩</h1>
      <p className="sranko-panel__lede">
        입어보기·합성 결과를 모아 둡니다. 카드를 눌러 상세에서 상품을 확인하세요.
      </p>
      {error ? <p className="sranko-error">{error}</p> : null}
      {loading ? (
        <div className="sranko-empty">불러오는 중…</div>
      ) : looks.length === 0 ? (
        <div className="sranko-empty">
          등록된 look이 없습니다.{' '}
          <Link className="sranko-link" to={SRANKO_CLOSET}>
            옷장에서 입어보기
          </Link>
        </div>
      ) : (
        <div className="sranko-grid">
          {looks.map((look) => (
            <button
              key={look.id}
              type="button"
              className="sranko-card sranko-card--clickable sranko-card__hit"
              onClick={() => {
                setActionError('');
                setSelectedItem(null);
                setDetailLook(look);
              }}
            >
              <img src={look.imageUrl} alt="" />
              <div className="sranko-card__body">
                <strong>{look.name}</strong>
                <span>
                  {look.source === 'TRY_ON' ? '입어보기' : '합성'}
                  {look.itemIds.length > 0 ? ` · 상품 ${look.itemIds.length}` : ''}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {detailLook ? (
        <Dialog
          open
          title="룩 상세"
          onClose={closeLookDetail}
          closeOnBackdrop={!selectedItem}
          closeOnEscape={!selectedItem}
          backdropClassName="sranko-modal"
          panelClassName="sranko-modal__card sranko-modal__card--wide"
        >
          {({ titleId }) => (
            <>
              <h2 id={titleId}>{detailLook.name}</h2>
              <p className="sranko-muted">
                {detailLook.source === 'TRY_ON' ? '입어보기' : '합성'} ·{' '}
                {new Date(detailLook.createdAt).toLocaleString('ko-KR')}
              </p>
              <img
                className="sranko-preview sranko-preview--lg"
                src={detailLook.imageUrl}
                alt={detailLook.name}
              />

              <h3 className="sranko-detail__section">구성 상품</h3>
              {detailLook.items.length === 0 ? (
                <p className="sranko-muted">연결된 상품이 없습니다.</p>
              ) : (
                <ul className="sranko-look-detail-items">
                  {detailLook.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={
                          item.missing
                            ? 'sranko-look-detail-items__hit is-missing'
                            : 'sranko-look-detail-items__hit'
                        }
                        disabled={item.missing}
                        onClick={() => {
                          if (!item.missing) {
                            setSelectedItem(item);
                          }
                        }}
                      >
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" />
                        ) : (
                          <span className="sranko-look-items__placeholder" aria-hidden />
                        )}
                        <span className="sranko-look-detail-items__meta">
                          <strong>{item.name}</strong>
                          <span>
                            {item.missing
                              ? '옷장에서 삭제됨'
                              : [item.brand, item.slot ? SLOT_LABEL[item.slot] : null]
                                  .filter(Boolean)
                                  .join(' · ')}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {actionError ? <p className="sranko-error">{actionError}</p> : null}
              <div className="sranko-modal__actions">
                <button
                  type="button"
                  className="sranko-btn sranko-btn--ghost"
                  disabled={busy}
                  onClick={closeLookDetail}
                >
                  닫기
                </button>
                <button
                  type="button"
                  className="sranko-btn sranko-btn--ghost"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm('이 룩을 삭제할까요?')) {
                      return;
                    }
                    setBusy(true);
                    setActionError('');
                    void removeLook(detailLook.id)
                      .then(() => {
                        closeLookDetail();
                        return reload();
                      })
                      .catch((e: unknown) => {
                        setActionError(
                          e instanceof Error ? e.message : '삭제에 실패했습니다.',
                        );
                      })
                      .finally(() => setBusy(false));
                  }}
                >
                  {busy ? '삭제 중…' : '삭제'}
                </button>
              </div>
            </>
          )}
        </Dialog>
      ) : null}

      {selectedItem ? (
        <Dialog
          open
          title="상품 상세"
          onClose={() => setSelectedItem(null)}
          closeOnBackdrop
          closeOnEscape
          backdropClassName="sranko-modal"
          panelClassName="sranko-modal__card"
        >
          {({ titleId }) => (
            <>
              <h2 id={titleId}>{selectedItem.name}</h2>
              {selectedItem.imageUrl ? (
                <img
                  className="sranko-preview"
                  src={selectedItem.imageUrl}
                  alt={selectedItem.name}
                />
              ) : null}
              <p className="sranko-detail__meta">
                {selectedItem.brand ? `${selectedItem.brand} · ` : ''}
                {selectedItem.slot
                  ? `${SLOT_LABEL[selectedItem.slot]}${
                      selectedItem.categoryCode
                        ? ` · ${formatSrankoCategoryLabel(
                            selectedItem.slot,
                            selectedItem.categoryCode,
                          )}`
                        : ''
                    }`
                  : null}
              </p>
              {selectedItem.productUrl ? (
                <p className="sranko-detail__meta">
                  <a
                    className="sranko-link"
                    href={selectedItem.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    상품 링크로 이동
                  </a>
                </p>
              ) : (
                <p className="sranko-muted">등록된 상품 URL이 없습니다.</p>
              )}
              <div className="sranko-modal__actions">
                <button
                  type="button"
                  className="sranko-btn sranko-btn--ghost"
                  onClick={() => setSelectedItem(null)}
                >
                  닫기
                </button>
              </div>
            </>
          )}
        </Dialog>
      ) : null}
    </section>
  );
}
