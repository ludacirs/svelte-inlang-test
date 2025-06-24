export interface TranslationObject {
  [key: string]: string | TranslationObject;
}

export const basicTranslationData: TranslationObject = {
  common: {
    cancel: '취소',
    welcome: '안녕하세요, {userName}님!',
    count: '{count}개',
  },
  home: {
    title: '홈',
    greeting: '환영합니다, {userName}님!',
  },
};

export const complexTranslationData: TranslationObject = {
  settings: {
    user: {
      profile: '{userName}의 프로필',
      settings: '설정',
      preferences: '{userName}님의 {preferenceType} 설정',
    },
    system: {
      language: '언어: {language}',
      theme: '테마: {theme}',
    },
  },
  events: {
    create: '새로운 {eventType} 이벤트를 생성합니다',
    edit: '{eventName} 이벤트를 수정합니다',
    delete: '{eventName} 이벤트를 삭제하겠습니까?',
  },
};

export const noParamsTranslationData: TranslationObject = {
  common: {
    cancel: '취소',
    title: '제목',
    loading: '로딩 중...',
  },
  navigation: {
    home: '홈',
    settings: '설정',
    profile: '프로필',
  },
};

export const completeTranslationData: TranslationObject = {
  common: {
    cancel: '취소',
    welcome: '안녕하세요, {userName}님!',
    count: '{count}개',
    complex: '{userName}님이 {count}개의 {item}을 {action}했습니다.',
  },
  home: {
    title: '홈',
    greeting: '환영합니다, {userName}님!',
    stats: '총 {total}개 중 {current}개 완료',
  },
  settings: {
    user: {
      profile: '{userName}의 프로필',
      settings: '설정',
    },
  },
};

export const completeEnglishTranslationData: TranslationObject = {
  common: {
    cancel: 'Cancel',
    welcome: 'Hello, {userName}!',
    count: '{count} items',
    complex: '{userName} has {action} {count} {item}.',
  },
  home: {
    title: 'Home',
    greeting: 'Welcome, {userName}!',
    stats: '{current} of {total} completed',
  },
  settings: {
    user: {
      profile: "{userName}'s Profile",
      settings: 'Settings',
    },
  },
};

export const mismatchedTranslationData: TranslationObject = {
  common: {
    cancel: '취소',
    welcome: '안녕하세요!',
    extra: '추가',
  },
};

export const mismatchedEnglishTranslationData: TranslationObject = {
  common: {
    cancel: 'Cancel',
    welcome: 'Hello!',
  },
};

export const parameterTestCases = [
  {
    input: 'Hello {userName}!',
    expected: ['userName'],
    description: '단일 파라미터',
  },
  {
    input: '{userName} has {action} {count} {item}',
    expected: ['userName', 'action', 'count', 'item'],
    description: '다중 파라미터',
  },
  {
    input: 'Multiple {userName} {userName} same',
    expected: ['userName'],
    description: '중복 파라미터',
  },
  {
    input: 'No parameters here',
    expected: [],
    description: '파라미터 없음',
  },
  {
    input: 'Empty braces {}',
    expected: [],
    description: '빈 중괄호',
  },
  {
    input: '{user.name} has {count} {item.type}',
    expected: ['user.name', 'count', 'item.type'],
    description: '복잡한 중첩 파라미터',
  },
] as const;
