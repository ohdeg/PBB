import { useNavigate } from 'react-router-dom';
import { HobbyLandingLayout } from '../components/HobbyLandingLayout';

export const SCORE_VIEWER_LANDING = '/hobbies/score-viewer';
export const SCORE_VIEWER_LIBRARY = '/hobbies/score-viewer/library';

/** 공개 소개 랜딩 — 보관함은 /hobbies/score-viewer/library */
export function ScoreViewerLandingPage() {
  const navigate = useNavigate();

  return (
    <HobbyLandingLayout
      eyebrow="음악 · 악보 뷰어"
      title="Score Viewer"
      lead="MusicXML·MXL 악보를 열고, 메트로놈·조옮김·자동 스크롤로 연습하는 로컬 악보 노트."
      note="악보는 이 기기 IndexedDB에만 저장돼요. 로그인 없이 바로 쓸 수 있어요."
      marqueeItems={['MusicXML', '메트로놈', '조옮김', '자동 스크롤', 'Score Viewer']}
      blockTone="navy"
      blockTitle="악보를 크게, 연습은 편하게"
      blockSubhead="보관함 · 연습 뷰어"
      blockBody="오선보를 열고 템포·조·스크롤을 맞춰 가며 손을 악보에 더 오래 두세요."
      productImage="/hobbies/score-viewer-product.png?v=angle"
      productImageDark="/hobbies/score-viewer-product-dark.png?v=angle"
      features={[
        {
          title: '악보 보관함',
          body: 'MusicXML/MXL을 가져와 목록으로 모아 두고 검색해 열어요.',
        },
        {
          title: '연습 뷰어',
          body: '오선보를 크게 보고, 마디 하이라이트와 재생으로 따라가요.',
        },
        {
          title: '메트로놈·BPM',
          body: '템포를 맞추고 메트로놈으로 박자를 잡아 연습해요.',
        },
        {
          title: '조옮김·스크롤',
          body: '키를 옮기고, 자동 스크롤로 손을 악보에 더 오래 두게 해요.',
        },
      ]}
      closingCopy="보관함으로 가서 악보를 열 수 있어요."
      startLabel="악보 열기"
      onStart={() => {
        void navigate(SCORE_VIEWER_LIBRARY);
      }}
    />
  );
}
