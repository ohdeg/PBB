import { MUSIC_XML_GUIDE_MESSAGES_KO, type MusicXmlGuideMessageTree } from './messagesMusicXmlGuide';
import { PRACTICE_MESSAGES_KO, type PracticeMessageTree } from './messagesPractice';

export type TranslationParams = Record<string, string | number | boolean | undefined>;

type CommonMessages = {
  close: string;
  cancel: string;
  delete: string;
  loading: string;
  homeBack: string;
  save: string;
};

type LibraryMessages = {
  title: string;
  subtitle: string;
  searchLabel: string;
  searchPlaceholder: string;
  clearSearch: string;
  clearSearchAria: string;
  addSectionTitle: string;
  addHelper: string;
  parsingFile: string;
  importLocal: string;
  musicXmlGuide: string;
  listTitle: string;
  searchResultMeta: string;
  totalMeta: string;
  emptyTitle: string;
  emptySubtitle: string;
  searchEmpty: string;
  deleteScoreAria: string;
  loadFailed: string;
  parseFailed: string;
  saveTitleRequired: string;
  saveFailed: string;
  deleteFailed: string;
};

type BeatSubdivisionMessages = {
  dialogLabel: string;
  title: string;
  close: string;
  page1: string;
  page2: string;
  page1Aria: string;
  page2Aria: string;
  selectAria: string;
};

type ErrorsMessages = {
  scoreNotFound: string;
  storageLoadFailed: string;
  storageNotFound: string;
  localDbOpenFailed: string;
  localDbOperationFailed: string;
  localDbTransactionFailed: string;
  invalidScoreFileType: string;
  musicXmlMetadataParseFailed: string;
  mxlNoMusicXml: string;
  invalidMusicXmlContent: string;
  storageEmptyBlob: string;
};

export type MessageTree = PracticeMessageTree & {
  common: CommonMessages;
  library: LibraryMessages;
  musicXmlGuide: MusicXmlGuideMessageTree;
  beatSubdivision: BeatSubdivisionMessages;
  errors: ErrorsMessages;
};

export type TranslationKey = string;

export const SCORE_MESSAGES_KO: MessageTree = {
  common: {
    close: '닫기',
    cancel: '취소',
    delete: '삭제',
    loading: '불러오는 중...',
    homeBack: '← 메인',
    save: '저장',
  },
  library: {
    title: '악보 보관함',
    subtitle: 'MusicXML / MXL을 가져와 기기에서 바로 연습하세요.',
    searchLabel: '악보 검색',
    searchPlaceholder: '제목, 아티스트, 파일명으로 검색',
    clearSearch: '지우기',
    clearSearchAria: '검색어 지우기',
    addSectionTitle: '악보 추가',
    addHelper: '새 악보는 이 기기(IndexedDB)에 저장됩니다. 계정 연동 없이 바로 연습할 수 있습니다.',
    parsingFile: '파일 분석 중...',
    importLocal: 'MusicXML / MXL 가져오기',
    musicXmlGuide: 'MusicXML 구하는 방법',
    listTitle: '내 악보',
    searchResultMeta: '검색 결과 {{filtered}} / {{total}}개',
    totalMeta: '총 {{total}}개',
    emptyTitle: '저장된 악보가 없습니다.',
    emptySubtitle: '첫 악보를 가져와 연습 루틴을 시작해 보세요.',
    searchEmpty: '검색 결과가 없습니다.',
    deleteScoreAria: '{{title}} 삭제',
    loadFailed: '악보 목록을 불러오지 못했습니다.',
    parseFailed: '악보 파일을 분석하지 못했습니다.',
    saveTitleRequired: '곡 제목을 입력해 주세요.',
    saveFailed: '저장에 실패했습니다.',
    deleteFailed: '악보 삭제에 실패했습니다.',
  },
  beatSubdivision: {
    dialogLabel: '{{beat}}박 세분화 선택',
    title: '{{beat}}박 세분화',
    close: '닫기',
    page1: '◀ 1페이지',
    page2: '2페이지 ▶',
    page1Aria: '세분화 1페이지',
    page2Aria: '세분화 2페이지',
    selectAria: '{{beat}}박 세분화 선택',
  },
  errors: {
    scoreNotFound: '악보를 찾을 수 없습니다.',
    storageLoadFailed: '악보 데이터를 불러오지 못했습니다.',
    storageNotFound: '저장된 악보 파일을 찾을 수 없습니다. 보관함에서 다시 업로드해 주세요.',
    localDbOpenFailed: '로컬 악보 저장소를 열지 못했습니다.',
    localDbOperationFailed: '로컬 악보 작업에 실패했습니다.',
    localDbTransactionFailed: '로컬 악보 트랜잭션에 실패했습니다.',
    invalidScoreFileType: 'MusicXML(.musicxml) 또는 MXL(.mxl) 파일만 업로드할 수 있습니다.',
    musicXmlMetadataParseFailed: 'MusicXML 메타데이터를 읽지 못했습니다.',
    mxlNoMusicXml: 'MXL 파일에서 MusicXML을 찾지 못했습니다.',
    invalidMusicXmlContent: '올바르지 않은 MusicXML 파일입니다.',
    storageEmptyBlob: '저장된 악보 파일이 비어 있습니다. 보관함에서 다시 업로드해 주세요.',
  },
  musicXmlGuide: MUSIC_XML_GUIDE_MESSAGES_KO,
  ...PRACTICE_MESSAGES_KO,
};
