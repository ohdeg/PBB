export type PracticeMessageTree = {
  librarySettings: {
    dialogLabel: string;
    kicker: string;
    title: string;
    description: string;
    autoScrollLegend: string;
    lineTitle: string;
    lineDesc: string;
    pageTitle: string;
    pageDesc: string;
  };
  viewer: {
    pageTitle: string;
    loadingSubtitle: string;
    backToLibrary: string;
    loadingInfo: string;
    loadFailed: string;
    loadingScore: string;
    guideTitle: string;
    guideDesc: string;
    guideTip1: string;
    guideTip2: string;
    guideTip3: string;
    guideTip4: string;
    guideClose: string;
    clearAnnotationConfirm: string;
    prefsSaved: string;
    prefsSaveFailed: string;
    settingsApplyHint: string;
    statCurrentMeasure: string;
    statProgress: string;
    statTimeSignature: string;
    statMeasuresPerLine: string;
    statusCurrentMeasure: string;
    statusProgress: string;
    statusTimeSignature: string;
    statusMeasuresPerLine: string;
    statusWithRepeats: string;
    statusPracticeRange: string;
    statusRepeatOn: string;
    selectMeasure: string;
    measureOverlayLabel: string;
  };
  playback: {
    stopCountIn: string;
    pause: string;
    play: string;
    transpose: string;
    keyDown: string;
    keyDownAria: string;
    keyUp: string;
    keyUpAria: string;
    resetKey: string;
    timeSignature: string;
    beatsPerMeasureAria: string;
    beatUnitAria: string;
    measuresPerLine: string;
    measuresPerLineAria: string;
    presetLabel: string;
    elapsedTime: string;
    currentMeasure: string;
    practiceRangeHint: string;
    startMeasure: string;
    endMeasure: string;
    repeatMode: string;
    seekToStart: string;
    resetRange: string;
    beatStrengthLabel: string;
    beatStrengthHint: string;
    autoScroll: string;
    metronomeSound: string;
    measureHighlight: string;
    savingPrefs: string;
    saveBpmPrefs: string;
    applySettings: string;
    tempoChangesTitle: string;
    addTempoChange: string;
    tempoChangesHint: string;
    tempoChangesEmpty: string;
    tempoStartMeasure: string;
    tempoEndMeasure: string;
  };
  metronomePanel: {
    guideTitle: string;
    guideDesc: string;
    guideTip1: string;
    guideTip2: string;
    guideTip3: string;
    guideTip4: string;
    guideClose: string;
    summaryTempo: string;
    summaryTimeSignature: string;
    summaryStatus: string;
    statusPlaying: string;
    statusIdle: string;
    practiceStatus: string;
    prefsSaved: string;
    prefsSaveFailed: string;
    countIn: string;
    beatIndicatorAria: string;
  };
  annotation: {
    toolbarLabel: string;
    modeLabel: string;
    scroll: string;
    pen: string;
    highlighter: string;
    eraser: string;
    penSize: string;
    highlighterSize: string;
    eraserSize: string;
    undo: string;
    clearAll: string;
  };
  beatStrength: {
    silent: string;
    weak: string;
    medium: string;
    strong: string;
    beatAria: string;
    beatAriaActive: string;
  };
  floating: {
    settingsLabel: string;
    openSettings: string;
    closeSettings: string;
    practiceSettings: string;
    playbackToolbar: string;
    countInOneMeasure: string;
    progressMeasure: string;
    scrollToTop: string;
  };
};

export const PRACTICE_MESSAGES_KO: PracticeMessageTree = {
  librarySettings: {
    dialogLabel: '보관함 설정',
    kicker: 'LIBRARY SETTINGS',
    title: '보관함 설정',
    description: '여기서 변경한 설정은 모든 악보 뷰어에 공통으로 적용됩니다.',
    autoScrollLegend: '자동 스크롤 단위',
    lineTitle: '줄 단위',
    lineDesc: '재생 위치가 다음 줄로 넘어갈 때마다 스크롤합니다.',
    pageTitle: '페이지 단위',
    pageDesc: '화면 높이 기준으로 페이지 단위로 스크롤합니다.',
  },
  viewer: {
    pageTitle: '악보 뷰어',
    loadingSubtitle: '악보를 불러오는 중입니다.',
    backToLibrary: '← 보관함',
    loadingInfo: '악보 정보를 불러오는 중...',
    loadFailed: '악보를 불러오지 못했습니다.',
    loadingScore: '악보를 불러오는 중...',
    guideTitle: '악보 뷰어 사용법',
    guideDesc: '처음 한 번만 확인하면, 원하는 마디에서 정확하게 반복 연습할 수 있습니다.',
    guideTip1: '설정에서 시작·끝 마디를 직접 입력해 연습 구간을 정하세요',
    guideTip2: '재생을 누르면 예비박 후 시작 마디부터 재생됩니다',
    guideTip3: '반복 재생을 켜면 구간이 끝날 때마다 예비박 후 다시 시작합니다',
    guideTip4: 'Space 키로 빠르게 재생/일시정지',
    guideClose: '바로 연습하기',
    clearAnnotationConfirm: '필기를 모두 지울까요?',
    prefsSaved: 'BPM/줄당 마디 설정을 저장했습니다.',
    prefsSaveFailed: 'BPM 저장에 실패했습니다.',
    settingsApplyHint: '설정을 바꾼 뒤 완료를 눌러야 적용됩니다.',
    statCurrentMeasure: '현재 마디',
    statProgress: '진행',
    statTimeSignature: '박자',
    statMeasuresPerLine: '줄당 마디',
    statusCurrentMeasure: '현재 마디',
    statusProgress: '진행',
    statusTimeSignature: '박자',
    statusMeasuresPerLine: '줄당 마디',
    statusWithRepeats: '반복 포함',
    statusPracticeRange: '연습 구간: {{start}}–{{end}}마디',
    statusRepeatOn: ' (반복)',
    selectMeasure: '마디 {{measure}} 선택',
    measureOverlayLabel: '마디 선택',
  },
  playback: {
    stopCountIn: '예비박 중지',
    pause: '일시정지',
    play: '재생',
    transpose: '조옮김',
    keyDown: '키 다운',
    keyDownAria: '키 다운 (반음 내림)',
    keyUp: '키 업',
    keyUpAria: '키 업 (반음 올림)',
    resetKey: '원조',
    timeSignature: '박자',
    beatsPerMeasureAria: '한 마디 박 수',
    beatUnitAria: '박 단위',
    measuresPerLine: '줄당 마디 수',
    measuresPerLineAria: '줄당 마디 수',
    presetLabel: '박자 프리셋',
    elapsedTime: '경과 시간: {{seconds}}s',
    currentMeasure: ' · 현재 마디: {{current}} / {{total}}',
    practiceRangeHint: '첫 클릭: 시작 마디(끝은 악보 마지막) · 두 번째 클릭: 끝 마디 지정',
    startMeasure: '시작 마디',
    endMeasure: '끝 마디',
    repeatMode: '반복 재생 (구간 반복)',
    seekToStart: '시작 위치로 이동',
    resetRange: '전체 구간으로',
    beatStrengthLabel: '박자 강약',
    beatStrengthHint: '막대 클릭: 강 → 중간 → 약 → 무음 · 아이콘 클릭: 세분화 선택',
    autoScroll: '자동 스크롤',
    metronomeSound: '박자 소리',
    measureHighlight: '진행 마디 표시',
    savingPrefs: '저장 중...',
    saveBpmPrefs: 'BPM 설정 저장',
    applySettings: '완료',
    tempoChangesTitle: '변박 (템포 변경)',
    addTempoChange: '변박 추가',
    tempoChangesHint: '시작·끝 마디와 BPM, 박자를 지정하면 해당 구간에만 적용됩니다.',
    tempoChangesEmpty: '등록된 변박이 없습니다.',
    tempoStartMeasure: '시작 마디',
    tempoEndMeasure: '끝 마디',
  },
  metronomePanel: {
    guideTitle: '메트로놈 사용법',
    guideDesc: '연습 시작 전에 기본 설정만 맞추면 바로 리듬 훈련을 시작할 수 있습니다.',
    guideTip1: '재생 버튼 또는 Space 키로 시작/일시정지',
    guideTip2: '박자 강약 바를 눌러 강세 패턴 만들기',
    guideTip3: '아이콘 버튼으로 세분화(8분/16분/3연음) 선택',
    guideTip4: '설정이 마음에 들면 BPM 설정 저장으로 고정',
    guideClose: '확인했어요',
    summaryTempo: '현재 템포',
    summaryTimeSignature: '박자',
    summaryStatus: '상태',
    statusPlaying: '재생 중',
    statusIdle: '대기 중',
    practiceStatus: '박자: {{beatsPerMeasure}}/{{beatType}} · BPM {{bpm}}',
    prefsSaved: 'BPM 설정을 저장했습니다.',
    prefsSaveFailed: 'BPM 저장에 실패했습니다.',
    countIn: '예비박',
    beatIndicatorAria: '메트로놈 박자 진행',
  },
  annotation: {
    toolbarLabel: '필기 도구',
    modeLabel: '필기 모드',
    scroll: '스크롤',
    pen: '펜',
    highlighter: '형광펜',
    eraser: '지우개',
    penSize: '펜 굵기',
    highlighterSize: '형광펜 굵기',
    eraserSize: '지우개 크기',
    undo: '실행취소',
    clearAll: '전체지우기',
  },
  beatStrength: {
    silent: '무음',
    weak: '약',
    medium: '중간',
    strong: '강',
    beatAria: '{{beat}}박 {{strength}}',
    beatAriaActive: ' (현재 박)',
  },
  floating: {
    settingsLabel: '설정',
    openSettings: '설정 열기',
    closeSettings: '설정 닫기',
    practiceSettings: '연습 설정',
    playbackToolbar: '재생 컨트롤',
    countInOneMeasure: '예비박 1마디',
    progressMeasure: '진행 {{current}}/{{total}}',
    scrollToTop: '맨 위로 이동',
  },
};

export const PRACTICE_MESSAGES_EN: PracticeMessageTree = {
  librarySettings: {
    dialogLabel: 'Library settings',
    kicker: 'LIBRARY SETTINGS',
    title: 'Library settings',
    description: 'Changes here apply to every score viewer.',
    autoScrollLegend: 'Auto-scroll unit',
    lineTitle: 'By line',
    lineDesc: 'Scroll whenever playback moves to the next line.',
    pageTitle: 'By page',
    pageDesc: 'Scroll by page based on viewport height.',
  },
  viewer: {
    pageTitle: 'Score viewer',
    loadingSubtitle: 'Loading score...',
    backToLibrary: '← Library',
    loadingInfo: 'Loading score info...',
    loadFailed: 'Could not load the score.',
    loadingScore: 'Loading score...',
    guideTitle: 'How to use the score viewer',
    guideDesc: 'A quick read helps you loop the exact measures you want to practice.',
    guideTip1: 'Set start and end measures in settings to define your practice range',
    guideTip2: 'Press play for a count-in, then playback starts at the first measure',
    guideTip3: 'With repeat on, the range restarts with a count-in after each pass',
    guideTip4: 'Use Space to quickly play or pause',
    guideClose: 'Start practicing',
    clearAnnotationConfirm: 'Clear all annotations?',
    prefsSaved: 'Saved BPM and measures-per-line settings.',
    prefsSaveFailed: 'Could not save BPM settings.',
    settingsApplyHint: 'Tap Done to apply setting changes.',
    statCurrentMeasure: 'Measure',
    statProgress: 'Progress',
    statTimeSignature: 'Time',
    statMeasuresPerLine: 'Measures/line',
    statusCurrentMeasure: 'Measure',
    statusProgress: 'Progress',
    statusTimeSignature: 'Time',
    statusMeasuresPerLine: 'Measures/line',
    statusWithRepeats: 'includes repeats',
    statusPracticeRange: 'Range: measures {{start}}–{{end}}',
    statusRepeatOn: ' (repeat)',
    selectMeasure: 'Select measure {{measure}}',
    measureOverlayLabel: 'Select measure',
  },
  playback: {
    stopCountIn: 'Stop count-in',
    pause: 'Pause',
    play: 'Play',
    transpose: 'Transpose',
    keyDown: 'Down',
    keyDownAria: 'Transpose down (semitone)',
    keyUp: 'Up',
    keyUpAria: 'Transpose up (semitone)',
    resetKey: 'Reset',
    timeSignature: 'Time signature',
    beatsPerMeasureAria: 'Beats per measure',
    beatUnitAria: 'Beat unit',
    measuresPerLine: 'Measures per line',
    measuresPerLineAria: 'Measures per line',
    presetLabel: 'Time presets',
    elapsedTime: 'Elapsed: {{seconds}}s',
    currentMeasure: ' · Measure: {{current}} / {{total}}',
    practiceRangeHint: 'First click: start measure (end = last measure) · Second click: set end measure',
    startMeasure: 'Start measure',
    endMeasure: 'End measure',
    repeatMode: 'Loop section',
    seekToStart: 'Go to start',
    resetRange: 'Reset to full score',
    beatStrengthLabel: 'Beat accents',
    beatStrengthHint: 'Tap bar: strong → medium → weak → silent · Tap icon: choose subdivision',
    autoScroll: 'Auto scroll',
    metronomeSound: 'Click sound',
    measureHighlight: 'Highlight current measure',
    savingPrefs: 'Saving...',
    saveBpmPrefs: 'Save BPM settings',
    applySettings: 'Done',
    tempoChangesTitle: 'Tempo changes',
    addTempoChange: 'Add tempo change',
    tempoChangesHint: 'Set start/end measures, BPM, and time signature for each section.',
    tempoChangesEmpty: 'No tempo changes yet.',
    tempoStartMeasure: 'Start measure',
    tempoEndMeasure: 'End measure',
  },
  metronomePanel: {
    guideTitle: 'How to use the metronome',
    guideDesc: 'Adjust a few basics and start rhythm training right away.',
    guideTip1: 'Use the play button or Space to start/pause',
    guideTip2: 'Tap accent bars to shape the beat pattern',
    guideTip3: 'Use icon buttons to choose subdivisions (eighth/sixteenth/triplets)',
    guideTip4: 'Save BPM settings when you like the setup',
    guideClose: 'Got it',
    summaryTempo: 'Current tempo',
    summaryTimeSignature: 'Time signature',
    summaryStatus: 'Status',
    statusPlaying: 'Playing',
    statusIdle: 'Idle',
    practiceStatus: 'Time: {{beatsPerMeasure}}/{{beatType}} · BPM {{bpm}}',
    prefsSaved: 'Saved BPM settings.',
    prefsSaveFailed: 'Could not save BPM settings.',
    countIn: 'Count-in',
    beatIndicatorAria: 'Metronome beat progress',
  },
  annotation: {
    toolbarLabel: 'Annotation tools',
    modeLabel: 'Annotation mode',
    scroll: 'Scroll',
    pen: 'Pen',
    highlighter: 'Highlighter',
    eraser: 'Eraser',
    penSize: 'Pen size',
    highlighterSize: 'Highlighter size',
    eraserSize: 'Eraser size',
    undo: 'Undo',
    clearAll: 'Clear all',
  },
  beatStrength: {
    silent: 'silent',
    weak: 'weak',
    medium: 'medium',
    strong: 'strong',
    beatAria: 'Beat {{beat}} {{strength}}',
    beatAriaActive: ' (current)',
  },
  floating: {
    settingsLabel: 'Settings',
    openSettings: 'Open settings',
    closeSettings: 'Close settings',
    practiceSettings: 'Practice settings',
    playbackToolbar: 'Playback controls',
    countInOneMeasure: 'Count-in 1 measure',
    progressMeasure: 'Progress {{current}}/{{total}}',
    scrollToTop: 'Scroll to top',
  },
};
