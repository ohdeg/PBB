export type ConsentKey =
  | 'terms'
  | 'privacy'
  | 'age14'
  | 'marketing_privacy'
  | 'marketing_email'
  | 'marketing_sms'
  | 'marketing_push'
  | 'location'
  | 'third_party'
  | 'social_login';

export type ConsentGroup = 'required' | 'optional' | 'special';

export interface ConsentDefinition {
  key: ConsentKey;
  group: ConsentGroup;
  /** false면 UI·검증에서 제외. 기능 추가 시 true로 켜면 자동 노출 */
  enabled: boolean;
  required: boolean;
  title: string;
  summary: string;
  /** 전문 모달용 */
  body: string;
  version: string;
}

/** 신규 동의 항목은 여기에 추가하고 enabled만 켜면 가입 화면에 자동 반영됩니다. */
export const CONSENT_CATALOG: ConsentDefinition[] = [
  {
    key: 'terms',
    group: 'required',
    enabled: true,
    required: true,
    title: '서비스 이용약관',
    summary:
      '서비스 이용 조건, 회사와 회원의 권리·의무 및 책임사항, 서비스 이용 제한 및 해지 등에 관한 규정입니다.',
    body: `제1조 (목적)
본 약관은 PBB(Play beom's BAG, 이하 "회사")가 제공하는 서비스의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.

제2조 (정의)
1. "서비스"란 회사가 제공하는 웹·앱 기반 취미 서비스 일체를 말합니다.
2. "회원"이란 본 약관에 동의하고 계정을 생성한 자를 말합니다.

제3조 (약관의 효력 및 변경)
회사는 관련 법령을 위배하지 않는 범위에서 약관을 개정할 수 있으며, 개정 시 적용일자 및 사유를 공지합니다.

제4조 (서비스의 제공 및 변경)
회사는 서비스의 일부 또는 전부를 운영상·기술상 필요에 따라 수정·중단할 수 있습니다.

제5조 (회원의 의무)
회원은 관련 법령, 본 약관, 서비스 이용 안내를 준수해야 하며, 타인의 권리를 침해하거나 서비스를 부정하게 이용해서는 안 됩니다.

제6조 (콘텐츠 및 저작권)
서비스 내 제공 콘텐츠의 저작권은 회사 또는 정당한 권리자에게 귀속되며, 회원은 무단 복제·배포·상업적 이용을 해서는 안 됩니다.

제7조 (이용 제한 및 해지)
회원이 약관을 위반한 경우 회사는 서비스 이용을 제한하거나 계정을 해지할 수 있습니다. 회원은 언제든지 탈퇴를 요청할 수 있습니다.

제8조 (면책)
천재지변, 통신 장애 등 불가항력으로 인한 서비스 중단에 대해 회사는 관련 법령이 허용하는 범위에서 책임을 제한합니다.

(본 약관은 공정거래위원회 표준약관을 참고하여 서비스 특성에 맞게 작성된 초안이며, 정식 서비스 전 법률 검토 후 확정합니다.)`,
    version: '2026-07-15',
  },
  {
    key: 'privacy',
    group: 'required',
    enabled: true,
    required: true,
    title: '개인정보 수집 및 이용 동의',
    summary:
      '회원가입·서비스 제공을 위해 이메일, 비밀번호, 닉네임 등 개인정보를 수집·이용합니다.',
    body: `개인정보보호법에 따라 아래 내용을 고지하고 동의를 받습니다.

1. 수집하는 개인정보 항목
- 필수: 이메일, 비밀번호(암호화 저장), 닉네임
- 자동 수집: 접속 로그, 기기·브라우저 정보(부정 이용 방지 및 서비스 안정화 목적)

2. 개인정보의 수집 및 이용 목적
- 회원 식별 및 가입·로그인 처리
- 서비스 제공 및 고객 문의 대응
- 약관·정책 변경, 서비스 공지 전달

3. 개인정보의 보유 및 이용 기간
- 회원 탈퇴 시까지
- 관련 법령에 따라 보관이 필요한 경우 해당 기간 동안 보관 후 파기

4. 동의 거부 권리 및 불이익 안내
- 귀하는 동의를 거부할 수 있습니다.
- 다만 본 동의는 회원가입을 위한 필수 사항이므로, 동의하지 않으면 서비스 가입 및 이용이 불가합니다.`,
    version: '2026-07-15',
  },
  {
    key: 'age14',
    group: 'required',
    enabled: true,
    required: true,
    title: '만 14세 이상 확인',
    summary:
      '만 14세 미만은 법정대리인 동의 없이 가입할 수 없습니다. 만 14세 이상임을 확인합니다.',
    body: `정보통신망 이용촉진 및 정보보호 등에 관한 법률 등 관련 법령에 따라 만 14세 미만 아동의 개인정보를 수집하는 경우 법정대리인의 동의가 필요합니다.

본 서비스는 별도의 법정대리인 동의 절차를 운영하지 않으므로, 만 14세 이상인 분만 가입할 수 있습니다.

체크박스를 선택함으로써 본인이 만 14세 이상임을 확인합니다.`,
    version: '2026-07-15',
  },
  {
    key: 'marketing_privacy',
    group: 'optional',
    enabled: true,
    required: false,
    title: '마케팅 목적 개인정보 수집 및 이용 동의',
    summary:
      '이벤트 알림, 맞춤형 추천, 혜택 안내 등을 위해 이메일 등 개인정보를 활용할 수 있습니다.',
    body: `1. 수집·이용 항목: 이메일, 닉네임, 서비스 이용 기록(맞춤 안내 목적)
2. 이용 목적: 이벤트·프로모션 안내, 맞춤형 추천, 혜택 제공
3. 보유 기간: 동의 철회 또는 회원 탈퇴 시까지
4. 동의 거부: 거부하셔도 회원가입 및 기본 서비스 이용에는 영향이 없습니다.`,
    version: '2026-07-15',
  },
  {
    key: 'marketing_email',
    group: 'optional',
    enabled: true,
    required: false,
    title: '마케팅 정보 수신 동의 (이메일)',
    summary: '광고성·이벤트 정보를 이메일로 수신합니다.',
    body: `정보통신망법에 따라 광고성 정보 수신에 대한 동의를 받습니다.
수신 채널: 이메일
동의하지 않아도 회원가입이 가능하며, 마이페이지 등에서 언제든 철회할 수 있습니다.`,
    version: '2026-07-15',
  },
  {
    key: 'marketing_sms',
    group: 'optional',
    enabled: true,
    required: false,
    title: '마케팅 정보 수신 동의 (SMS)',
    summary: '광고성·이벤트 정보를 SMS로 수신합니다. (연락처 수집 시 적용)',
    body: `수신 채널: SMS
현재 서비스에서 연락처를 수집하지 않는 경우에도 동의를 미리 받을 수 있으며, 실제 발송은 연락처 등록 이후에만 이루어집니다.
동의하지 않아도 회원가입이 가능합니다.`,
    version: '2026-07-15',
  },
  {
    key: 'marketing_push',
    group: 'optional',
    enabled: true,
    required: false,
    title: '마케팅 정보 수신 동의 (앱 푸시)',
    summary: '광고성·이벤트 정보를 앱 푸시로 수신합니다.',
    body: `수신 채널: 앱 푸시(Push)
동의하지 않아도 회원가입이 가능하며, 기기 알림 설정과 별개로 마케팅 푸시 발송 여부를 관리합니다.`,
    version: '2026-07-15',
  },
  {
    key: 'location',
    group: 'special',
    enabled: false,
    required: true,
    title: '위치기반서비스 이용약관 동의',
    summary: 'GPS 등 위치 정보를 활용한 기능 제공 시 필요합니다.',
    body: `위치정보의 보호 및 이용 등에 관한 법률에 따라 위치기반서비스 이용약관 동의가 필요합니다.
(현재 미사용 — 위치 기능 도입 시 enabled 를 true 로 전환합니다.)`,
    version: '2026-07-15',
  },
  {
    key: 'third_party',
    group: 'special',
    enabled: false,
    required: true,
    title: '개인정보 제3자 제공 동의',
    summary: '결제·배송·제휴사 등 외부 제공이 필요한 경우 별도 동의합니다.',
    body: `제공 받는 자, 제공 목적, 제공 항목, 보유 기간을 명시하여 동의를 받습니다.
(현재 미사용 — PG/배송/제휴 연동 시 enabled 를 true 로 전환합니다.)`,
    version: '2026-07-15',
  },
  {
    key: 'social_login',
    group: 'special',
    enabled: false,
    required: true,
    title: '간편 로그인 정보 제공 동의',
    summary: '카카오·네이버·구글 등에서 제공받을 프로필·이메일에 대한 동의입니다.',
    body: `소셜 로그인 도입 시 해당 플랫폼 동의 절차와 함께 본 항목을 활성화합니다.
(현재 미사용)`,
    version: '2026-07-15',
  },
];

export function getActiveConsents(): ConsentDefinition[] {
  return CONSENT_CATALOG.filter((item) => item.enabled);
}

export function getRequiredConsentKeys(): ConsentKey[] {
  return getActiveConsents()
    .filter((item) => item.required)
    .map((item) => item.key);
}

export function createInitialConsentState(): Record<ConsentKey, boolean> {
  return CONSENT_CATALOG.reduce(
    (acc, item) => {
      acc[item.key] = false;
      return acc;
    },
    {} as Record<ConsentKey, boolean>,
  );
}

export function areRequiredConsentsAgreed(
  state: Record<ConsentKey, boolean>,
): boolean {
  return getRequiredConsentKeys().every((key) => state[key]);
}

export const CONSENT_GROUP_LABEL: Record<ConsentGroup, string> = {
  required: '필수 동의',
  optional: '선택 동의',
  special: '추가 동의',
};
