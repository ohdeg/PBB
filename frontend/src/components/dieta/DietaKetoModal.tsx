import { Dialog } from '../ui/Dialog';

interface DietaKetoModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (easeRequested: boolean) => void;
}

export function DietaKetoModal({
  open,
  onClose,
  onConfirm,
}: DietaKetoModalProps) {
  if (!open) {
    return null;
  }

  return (
    <Dialog
      open={open}
      title="키토플루 대체법"
      onClose={onClose}
      backdropClassName="dieta-modal-backdrop"
      panelClassName="dieta-modal"
      description
    >
      {({ titleId, descriptionId }) => (
        <>
        <h2 id={titleId}>키토플루 대체법</h2>
        <p id={descriptionId} className="dieta-muted">
          증상의 약 80%는 나트륨·수분 부족에서 옵니다. 탄수가 줄면 인슐린이
          낮아져 신장이 나트륨을 더 배출하기 때문입니다.
        </p>

        <section>
          <h3>1) 소금물 · 따뜻한 국물</h3>
          <ul>
            <li>따뜻한 물 200ml + 천일염/핑크소금 0.5~1티스푼 (약 2~3g)</li>
            <li>사골·미역국(짭짤하게)·육수도 좋아요</li>
            <li>30분~1시간 안에 두통·어지럼이 줄어드는 경우가 많아요</li>
          </ul>
        </section>

        <section>
          <h3>수분</h3>
          <p>하루 2.5~3L. 맹물만 과하면 전해질이 희석될 수 있어 소금·전해질과 함께.</p>
        </section>

        <section>
          <h3>2) 마그네슘 · 칼륨</h3>
          <ul>
            <li>Mg: 아보카도, 시금치, 아몬드, 호박씨 (영양제 참고 200~400mg)</li>
            <li>K: 잎채소·아보카도·샐러리 — 고용량 칼륨제는 식품 위주 권장</li>
          </ul>
        </section>

        <section>
          <h3>심할 때 · 복합 탄수 +20~30g</h3>
          <p>단호박, 고구마, 현미밥, 베리류로 적응 기간을 유연하게.</p>
        </section>

        <section>
          <h3>3) 고강도 자제 · 휴식</h3>
          <p>케톤 적응 1~2주. 산책·스트레칭 위주, 수면 충분히.</p>
        </section>

        <div style={{ display: 'grid', gap: '0.55rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            className="dieta-btn dieta-btn--primary dieta-btn--block"
            onClick={() => onConfirm(false)}
          >
            확인 · 기록하기
          </button>
          <button
            type="button"
            className="dieta-btn dieta-btn--soft dieta-btn--block"
            onClick={() => onConfirm(true)}
          >
            이번 주 완화 요청
          </button>
          <button
            type="button"
            className="dieta-btn dieta-btn--ghost dieta-btn--block"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
        </>
      )}
    </Dialog>
  );
}
