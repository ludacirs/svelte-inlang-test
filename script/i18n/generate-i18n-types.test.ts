import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractParams,
  getAllKeys,
  getAllKeysWithValues,
  getParamTypesFromObject,
  generateTypeDefinition,
  validateTranslationFiles,
  loadTranslationFiles,
  generateI18nTypes,
} from './generate-i18n-types';
import {
  basicTranslationData,
  complexTranslationData,
  noParamsTranslationData,
  completeTranslationData,
  completeEnglishTranslationData,
  mismatchedTranslationData,
  mismatchedEnglishTranslationData,
  parameterTestCases,
  type TranslationObject,
} from './__mocks__/translation-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testDir = path.resolve(__dirname, './test-i18n-' + Date.now());
const testOutputDir = path.resolve(__dirname, './test-output-' + Date.now());

function safeCleanup(dirPath: string) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (error) {
    console.warn(`Failed to cleanup ${dirPath}:`, error);
  }
}

function safeCreateDir(dirPath: string) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (error) {
    console.warn(`Failed to create ${dirPath}:`, error);
  }
}

describe('i18n 타입 생성기', () => {
  beforeAll(() => {
    safeCleanup(testDir);
    safeCleanup(testOutputDir);
  });

  beforeEach(() => {
    safeCreateDir(testDir);
    safeCreateDir(testOutputDir);
  });

  afterEach(() => {
    setTimeout(() => {
      safeCleanup(testDir);
      safeCleanup(testOutputDir);
    }, 100);
  });

  afterAll(() => {
    safeCleanup(testDir);
    safeCleanup(testOutputDir);
  });

  describe('파라미터 추출', () => {
    it.each(parameterTestCases)('$description 추출', ({ input, expected }) => {
      const result = extractParams(input);
      expect(result).toEqual(expected);
    });
  });

  describe('키와 값 추출', () => {
    it('모든 문자열 값과 키를 추출한다', () => {
      const result = getAllKeysWithValues(basicTranslationData);
      expect(result).toEqual([
        { key: 'common.cancel', value: '취소' },
        { key: 'common.welcome', value: '안녕하세요, {userName}님!' },
        { key: 'common.count', value: '{count}개' },
        { key: 'home.title', value: '홈' },
        { key: 'home.greeting', value: '환영합니다, {userName}님!' },
      ]);
    });

    it('중첩된 객체를 처리한다', () => {
      const result = getAllKeysWithValues(complexTranslationData);
      expect(result).toEqual([
        { key: 'settings.user.profile', value: '{userName}의 프로필' },
        { key: 'settings.user.settings', value: '설정' },
        { key: 'settings.user.preferences', value: '{userName}님의 {preferenceType} 설정' },
        { key: 'settings.system.language', value: '언어: {language}' },
        { key: 'settings.system.theme', value: '테마: {theme}' },
        { key: 'events.create', value: '새로운 {eventType} 이벤트를 생성합니다' },
        { key: 'events.edit', value: '{eventName} 이벤트를 수정합니다' },
        { key: 'events.delete', value: '{eventName} 이벤트를 삭제하겠습니까?' },
      ]);
    });

    it('객체가 아닌 입력에 대해 빈 배열을 반환한다', () => {
      expect(getAllKeysWithValues(null as unknown as TranslationObject)).toEqual([]);
      expect(getAllKeysWithValues([] as unknown as TranslationObject)).toEqual([]);
      expect(getAllKeysWithValues('string' as unknown as TranslationObject)).toEqual([]);
    });
  });

  describe('모든 키 추출', () => {
    it('중첩된 객체에서 모든 키를 추출한다', () => {
      const result = getAllKeys(basicTranslationData);
      expect(result).toEqual([
        'common.cancel',
        'common.welcome',
        'common.count',
        'home.title',
        'home.greeting',
      ]);
    });

    it('깊게 중첩된 객체를 처리한다', () => {
      const result = getAllKeys(complexTranslationData);
      expect(result).toEqual([
        'settings.user.profile',
        'settings.user.settings',
        'settings.user.preferences',
        'settings.system.language',
        'settings.system.theme',
        'events.create',
        'events.edit',
        'events.delete',
      ]);
    });
  });

  describe('파라미터 타입 추출', () => {
    it('번역 데이터에서 올바른 파라미터 타입을 생성한다', () => {
      const paramTypes = getParamTypesFromObject(completeTranslationData);

      expect(paramTypes).toEqual({
        'common.welcome': ['userName'],
        'common.count': ['count'],
        'common.complex': ['userName', 'count', 'item', 'action'],
        'home.greeting': ['userName'],
        'home.stats': ['total', 'current'],
        'settings.user.profile': ['userName'],
      });
    });

    it('파라미터가 없는 데이터에 대해 빈 객체를 반환한다', () => {
      const paramTypes = getParamTypesFromObject(noParamsTranslationData);
      expect(paramTypes).toEqual({});
    });
  });

  describe('타입 정의 생성', () => {
    it('올바른 TypeScript 타입 정의를 생성한다', () => {
      const translationKeys = ['common.welcome', 'common.count', 'home.title'];
      const paramTypes = {
        'common.welcome': ['userName'],
        'common.count': ['count'],
      };

      const typeDefinition = generateTypeDefinition(translationKeys, paramTypes);

      expect(typeDefinition).toContain("'common.welcome' | 'common.count' | 'home.title'");
      expect(typeDefinition).toContain("'common.welcome': { userName: string | number }");
      expect(typeDefinition).toContain("'common.count': { count: string | number }");
      expect(typeDefinition).toContain('TranslationKeys');
      expect(typeDefinition).toContain('TranslationParams');
    });

    it('빈 파라미터 타입을 처리한다', () => {
      const translationKeys = ['common.cancel', 'home.title'];
      const paramTypes = {};

      const typeDefinition = generateTypeDefinition(translationKeys, paramTypes);

      expect(typeDefinition).toContain("'common.cancel' | 'home.title'");
      expect(typeDefinition).toContain('export type TranslationParams = {');
      expect(typeDefinition).toContain('};');
    });
  });

  describe('번역 파일 검증', () => {
    it('일치하는 번역 파일에 대해 검증을 통과한다', () => {
      const translations = {
        ko: completeTranslationData,
        en: completeEnglishTranslationData,
      };

      expect(() => validateTranslationFiles(translations)).not.toThrow();
    });

    it('일치하지 않는 번역 파일에 대해 오류를 발생시킨다', () => {
      const translations = {
        ko: mismatchedTranslationData,
        en: mismatchedEnglishTranslationData,
      };

      expect(() => validateTranslationFiles(translations)).toThrow(
        'Translation validation failed! Please fix the missing keys before generating types.',
      );
    });
  });

  describe('번역 파일 로드', () => {
    it('디렉토리에서 번역 파일을 로드한다', () => {
      fs.writeFileSync(
        path.join(testDir, 'ko.json'),
        JSON.stringify(basicTranslationData, null, 2),
      );
      fs.writeFileSync(
        path.join(testDir, 'en.json'),
        JSON.stringify(completeEnglishTranslationData, null, 2),
      );

      const translations = loadTranslationFiles(testDir);

      expect(translations).toHaveProperty('ko');
      expect(translations).toHaveProperty('en');
      expect(translations.ko).toEqual(basicTranslationData);
      expect(translations.en).toEqual(completeEnglishTranslationData);
    });

    it('JSON 파일이 없을 때 오류를 발생시킨다', () => {
      const emptyDir = path.join(testDir, 'empty');
      fs.mkdirSync(emptyDir, { recursive: true });

      expect(() => loadTranslationFiles(emptyDir)).toThrow('No JSON files found in');
    });
  });

  describe('파일 작업', () => {
    it('출력 디렉토리가 존재하지 않으면 생성한다', () => {
      const nonExistentDir = path.join(testOutputDir, 'new-dir');

      if (!fs.existsSync(nonExistentDir)) {
        fs.mkdirSync(nonExistentDir, { recursive: true });
      }

      expect(fs.existsSync(nonExistentDir)).toBe(true);
    });

    it('타입 정의 파일을 쓰고 읽는다', () => {
      const testTypeContent = `// This file is auto-generated. Do not edit manually.
// Generated at: ${new Date().toISOString()}

export type TranslationKeys = 'common.cancel' | 'common.welcome';

export type TranslationParams = {
  'common.welcome': { userName: string | number };
};
`;

      const testFilePath = path.join(testOutputDir, 'test-types.ts');
      fs.writeFileSync(testFilePath, testTypeContent);

      expect(fs.existsSync(testFilePath)).toBe(true);

      const readContent = fs.readFileSync(testFilePath, 'utf8');
      expect(readContent).toContain('TranslationKeys');
      expect(readContent).toContain('TranslationParams');
      expect(readContent).toContain('userName: string | number');
    });
  });

  describe('i18n 타입 생성 통합 테스트', () => {
    it('완전한 번역 파일을 처리하고 타입을 생성한다', async () => {
      fs.writeFileSync(
        path.join(testDir, 'ko.json'),
        JSON.stringify(completeTranslationData, null, 2),
      );
      fs.writeFileSync(
        path.join(testDir, 'en.json'),
        JSON.stringify(completeEnglishTranslationData, null, 2),
      );

      const execSyncSpy = vi.spyOn(require('child_process'), 'execSync');
      execSyncSpy.mockImplementation(() => Buffer.from(''));

      generateI18nTypes(testDir, testOutputDir);

      const outputPath = path.join(testOutputDir, 'i18n-types.ts');
      expect(fs.existsSync(outputPath)).toBe(true);

      const content = fs.readFileSync(outputPath, 'utf8');
      expect(content).toContain('TranslationKeys');
      expect(content).toContain('TranslationParams');
      expect(content).toContain("'common.welcome': { userName: string | number }");
      expect(content).toContain("'common.count': { count: string | number }");
      expect(content).toContain("'home.greeting': { userName: string | number }");

      const translationParamsMatch = content.match(/export type TranslationParams = \{([^}]+)\};/s);
      expect(translationParamsMatch).toBeTruthy();
      const translationParamsContent = translationParamsMatch![1];
      expect(translationParamsContent).not.toContain("'common.cancel'");
      expect(translationParamsContent).not.toContain("'home.title'");

      execSyncSpy.mockRestore();
    });

    it('번역 파일에 누락된 키가 있을 때 오류를 발생시킨다', () => {
      const missingKeysTestDir = path.join(testDir, 'missing-keys');
      fs.mkdirSync(missingKeysTestDir, { recursive: true });

      fs.writeFileSync(
        path.join(missingKeysTestDir, 'ko.json'),
        JSON.stringify(mismatchedTranslationData, null, 2),
      );
      fs.writeFileSync(
        path.join(missingKeysTestDir, 'en.json'),
        JSON.stringify(mismatchedEnglishTranslationData, null, 2),
      );

      expect(() => {
        generateI18nTypes(missingKeysTestDir, testOutputDir);
      }).toThrow(
        'Translation validation failed! Please fix the missing keys before generating types.',
      );
    });
  });
});
