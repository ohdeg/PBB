export type MusicXmlGuideMessageTree = {
  dialogLabel: string;
  kicker: string;
  title: string;
  desc: string;
  playscoreTitle: string;
  playscoreDescPrefix: string;
  playscoreDescSuffix: string;
  playscoreStep1: string;
  playscoreStep2: string;
  playscoreStep3: string;
  playscoreStep4: string;
  playscoreStep5: string;
  playscoreStep6: string;
  playscoreStep7: string;
  musescoreTitle: string;
  musescoreDescPrefix: string;
  musescoreDescSuffix: string;
  musescoreWebHeading: string;
  musescoreStep1Prefix: string;
  musescoreStep1Suffix: string;
  musescoreStep2: string;
  musescoreStep3: string;
  musescoreStep4: string;
  musescoreStep5: string;
  musescoreStep6: string;
  musescoreStep7: string;
  musescoreTipFree: string;
  musescoreTipPro: string;
  musescoreTipMissing: string;
  workflowTitle: string;
  workflowStep1: string;
  workflowStep2: string;
  workflowStep3: string;
  note: string;
  openMusescore: string;
};

export const MUSIC_XML_GUIDE_MESSAGES_KO: MusicXmlGuideMessageTree = {
  dialogLabel: 'MusicXML 파일 구하는 방법',
  kicker: 'MUSICXML GUIDE',
  title: 'MusicXML 파일 구하는 방법',
  desc: 'TEMPO-FLOW는 MusicXML(.musicxml) 또는 MXL(.mxl)만 업로드할 수 있습니다. PDF는 직접 올릴 수 없으니, 아래 방법으로 변환하거나 MusicXML을 준비해 주세요.',
  playscoreTitle: '① PDF 악보 → MusicXML (PlayScore 2)',
  playscoreDescPrefix: '스마트폰·태블릿 앱 ',
  playscoreDescSuffix:
    '로 PDF나 종이 악보를 MusicXML로 변환할 수 있습니다. MusicXML 보내기는 Professional 구독이 필요합니다.',
  playscoreStep1: 'App Store / Google Play에서 PlayScore 2를 설치합니다.',
  playscoreStep2:
    'PDF 불러오기: Safari·Chrome에서 PDF를 연 뒤 공유 메뉴에서 PlayScore 2로 보내기를 선택하거나, 앱 안의 가져오기(+)로 PDF를 선택합니다.',
  playscoreStep3:
    '종이 악보: 카메라로 페이지를 촬영해 인식합니다. 글자가 선명하고 그림자가 적을수록 정확도가 높습니다.',
  playscoreStep4: '썸네일에서 필요한 페이지를 고른 뒤 재생 화면으로 들어갑니다.',
  playscoreStep5: '재생 화면의 보내기(export) 아이콘 → Save as MusicXML을 선택합니다.',
  playscoreStep6:
    'AirDrop, 이메일, 파일 앱 등으로 MusicXML을 PC·Mac·휴대폰으로 옮깁니다. (MIDI 대신 반드시 MusicXML을 사용하세요.)',
  playscoreStep7:
    '보내기가 비활성화되어 있으면 Professional 구독 여부를 확인하고, 문서 설정에서 재처리(reprocess) 후 다시 시도합니다.',
  musescoreTitle: '② MusicXML 다운받기 (MuseScore.com)',
  musescoreDescPrefix: '이미 올라와 있는 악보를 MusicXML로 받고 싶다면 프로그램 설치 없이 ',
  musescoreDescSuffix: ' 사이트에서 바로 다운로드할 수 있습니다.',
  musescoreWebHeading: '웹사이트에서 MusicXML 받기',
  musescoreStep1Prefix: 'PC·태블릿·휴대폰 브라우저에서 ',
  musescoreStep1Suffix: '에 접속합니다.',
  musescoreStep2: '무료 계정으로 가입·로그인합니다. (다운로드 시 로그인이 필요할 수 있습니다.)',
  musescoreStep3: '상단 검색창에 곡 제목이나 작곡가를 입력합니다.',
  musescoreStep4: '검색 결과에서 원하는 악보를 눌러 악보 상세 페이지로 이동합니다.',
  musescoreStep5: '재생 버튼으로 악보를 미리 확인한 뒤, Download 버튼을 누릅니다.',
  musescoreStep6: '형식 목록에서 MusicXML 또는 MXL을 선택해 저장합니다.',
  musescoreStep7: '다운로드한 파일을 TEMPO-FLOW 보관함에 업로드합니다.',
  musescoreTipFree:
    '무료 다운로드: 공개 도메인·무료 공유 악보는 MusicXML을 무료로 받을 수 있는 경우가 많습니다.',
  musescoreTipPro:
    'Pro 구독: 일부 저작권 악보는 MuseScore Pro 구독이 있어야 MusicXML 다운로드가 가능합니다.',
  musescoreTipMissing:
    'MusicXML이 안 보일 때: 업로더가 다운로드를 제한했거나, 해당 악보가 PDF·MIDI만 제공하는 경우일 수 있습니다. 비슷한 다른 악보를 검색해 보세요.',
  workflowTitle: '추천 작업 순서',
  workflowStep1: '내 PDF / 종이 악보 → PlayScore 2로 MusicXML 변환',
  workflowStep2: '인터넷에 있는 악보 → MuseScore.com에서 MusicXML 다운로드',
  workflowStep3: 'TEMPO-FLOW 보관함에 업로드',
  note: '자동 변환·다운로드한 악보는 박자나 쉼표가 어긋날 수 있습니다. 업로드 전 악보를 한 번 훑어보면 연습 시 재생 오류를 줄일 수 있습니다.',
  openMusescore: 'MuseScore.com 열기',
};

export const MUSIC_XML_GUIDE_MESSAGES_EN: MusicXmlGuideMessageTree = {
  dialogLabel: 'How to get MusicXML files',
  kicker: 'MUSICXML GUIDE',
  title: 'How to get MusicXML files',
  desc: 'TEMPO-FLOW accepts MusicXML (.musicxml) or MXL (.mxl) only. PDFs cannot be uploaded directly—use the methods below to convert or prepare MusicXML.',
  playscoreTitle: '① PDF score → MusicXML (PlayScore 2)',
  playscoreDescPrefix: 'Use the mobile app ',
  playscoreDescSuffix:
    ' to convert PDF or paper scores to MusicXML. Exporting MusicXML requires a Professional subscription.',
  playscoreStep1: 'Install PlayScore 2 from the App Store or Google Play.',
  playscoreStep2:
    'Import PDF: Open a PDF in Safari or Chrome, share to PlayScore 2, or use the import (+) button inside the app.',
  playscoreStep3:
    'Paper score: Photograph each page with the camera. Clear text and even lighting improve accuracy.',
  playscoreStep4: 'Select the pages you need from thumbnails, then open the playback screen.',
  playscoreStep5: 'On the playback screen, tap the export icon → Save as MusicXML.',
  playscoreStep6:
    'Transfer the MusicXML to your PC, Mac, or phone via AirDrop, email, or Files. Use MusicXML, not MIDI.',
  playscoreStep7:
    'If export is disabled, confirm your Professional subscription and try reprocess in document settings.',
  musescoreTitle: '② Download MusicXML (MuseScore.com)',
  musescoreDescPrefix: 'To download existing scores as MusicXML without installing desktop software, use ',
  musescoreDescSuffix: ' in your browser.',
  musescoreWebHeading: 'Download MusicXML from the website',
  musescoreStep1Prefix: 'Open ',
  musescoreStep1Suffix: ' in a browser on your computer, tablet, or phone.',
  musescoreStep2: 'Sign up or log in with a free account. (Login may be required to download.)',
  musescoreStep3: 'Search by song title or composer in the top search bar.',
  musescoreStep4: 'Open the score you want from the search results.',
  musescoreStep5: 'Preview the score with the play button, then tap Download.',
  musescoreStep6: 'Choose MusicXML or MXL from the format list and save the file.',
  musescoreStep7: 'Upload the downloaded file to your TEMPO-FLOW library.',
  musescoreTipFree:
    'Free downloads: Public-domain and freely shared scores are often available as MusicXML at no cost.',
  musescoreTipPro:
    'Pro subscription: Some copyrighted scores require MuseScore Pro to download MusicXML.',
  musescoreTipMissing:
    'No MusicXML option: The uploader may restrict downloads, or the score may be PDF/MIDI only. Try a similar arrangement.',
  workflowTitle: 'Recommended workflow',
  workflowStep1: 'Your PDF / paper score → convert with PlayScore 2',
  workflowStep2: 'Scores on the web → download MusicXML from MuseScore.com',
  workflowStep3: 'Upload to your TEMPO-FLOW library',
  note: 'Converted or downloaded scores may have rhythm or rest errors. Skim the score before upload to reduce playback issues during practice.',
  openMusescore: 'Open MuseScore.com',
};
