import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const i18nDir = path.resolve(__dirname, '../../src/lib/shared/config/i18n');
const outputDir = path.resolve(__dirname, '../../src/lib/shared/model/types/');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

interface TranslationObject {
  [key: string]: string | TranslationObject;
}

export function extractParams(value: string): string[] {
  const paramRegex = /\{([^}]+)\}/g;
  const params: string[] = [];
  let match;

  while ((match = paramRegex.exec(value)) !== null) {
    params.push(match[1]);
  }

  return [...new Set(params)];
}

export function getAllKeys(obj: TranslationObject, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) {
    return [prefix];
  }

  if (Array.isArray(obj)) {
    return [prefix];
  }

  return Object.entries(obj).flatMap(([key, value]) => {
    const newPrefix = prefix ? `${prefix}.${key}` : key;
    return getAllKeys(value as TranslationObject, newPrefix);
  });
}

export function getAllKeysWithValues(
  obj: TranslationObject,
  prefix = '',
): { key: string; value: string }[] {
  if (typeof obj !== 'object' || obj === null) {
    return [];
  }

  if (Array.isArray(obj)) {
    return [];
  }

  return Object.entries(obj).flatMap(([key, value]) => {
    const newPrefix = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      return [{ key: newPrefix, value }];
    } else {
      return getAllKeysWithValues(value as TranslationObject, newPrefix);
    }
  });
}

export function getParamTypesFromObject(obj: TranslationObject): Record<string, string[]> {
  const keysWithValues = getAllKeysWithValues(obj);
  const paramTypes: { [key: string]: string[] } = {};

  keysWithValues.forEach(({ key, value }) => {
    const params = extractParams(value);
    if (params.length > 0) {
      paramTypes[key] = params;
    }
  });

  return paramTypes;
}

export function generateTypeDefinition(
  translationKeys: string[],
  paramTypes: Record<string, string[]>,
): string {
  return `// This file is auto-generated. Do not edit manually.
// Generated at: ${new Date().toISOString()}

export type TranslationKeys = ${translationKeys.map((key) => `'${key}'`).join(' | ')};

export type TranslationParams = {
${Object.entries(paramTypes)
  .map(
    ([key, params]) =>
      `  '${key}': { ${params.map((param) => `${param}: string | number`).join('; ')} }`,
  )
  .join(';\n')}
};

`;
}

export function validateTranslationFiles(translations: { [key: string]: TranslationObject }): void {
  const languages = Object.keys(translations);
  const allKeys: { [key: string]: Set<string> } = {};

  languages.forEach((lang) => {
    allKeys[lang] = new Set(getAllKeys(translations[lang]));
  });

  let hasErrors = false;

  for (let i = 0; i < languages.length; i++) {
    for (let j = i + 1; j < languages.length; j++) {
      const lang1 = languages[i];
      const lang2 = languages[j];

      const missingInLang2 = [...allKeys[lang1]].filter((key) => !allKeys[lang2].has(key));
      const missingInLang1 = [...allKeys[lang2]].filter((key) => !allKeys[lang1].has(key));

      if (missingInLang2.length > 0) {
        console.error(`\nMissing keys in ${lang2}.json that exist in ${lang1}.json:`);
        missingInLang2.forEach((key) => console.error(`  - ${key}`));
        hasErrors = true;
      }

      if (missingInLang1.length > 0) {
        console.error(`\nMissing keys in ${lang1}.json that exist in ${lang2}.json:`);
        missingInLang1.forEach((key) => console.error(`  - ${key}`));
        hasErrors = true;
      }
    }
  }

  if (hasErrors) {
    throw new Error(
      'Translation validation failed! Please fix the missing keys before generating types.',
    );
  }
}

export function loadTranslationFiles(i18nDirPath: string): { [key: string]: TranslationObject } {
  const files = fs.readdirSync(i18nDirPath).filter((file) => file.endsWith('.json'));

  if (files.length === 0) {
    throw new Error(`No JSON files found in ${i18nDirPath}`);
  }

  const translations: { [key: string]: TranslationObject } = {};

  files.forEach((file) => {
    const lang = path.basename(file, '.json');
    const content = JSON.parse(fs.readFileSync(path.join(i18nDirPath, file), 'utf8'));
    translations[lang] = content;
  });

  return translations;
}

export function generateI18nTypes(i18nDirPath: string, outputDirPath: string): void {
  const translations = loadTranslationFiles(i18nDirPath);

  validateTranslationFiles(translations);

  const firstLang = Object.keys(translations)[0];
  const firstLangData = translations[firstLang];

  const paramTypes = getParamTypesFromObject(firstLangData);

  const translationKeys = getAllKeys(firstLangData);

  const typeDefinition = generateTypeDefinition(translationKeys, paramTypes);

  const outputFilePath = path.join(outputDirPath, 'i18n-types.ts');
  fs.writeFileSync(outputFilePath, typeDefinition);

  console.log('i18n type definitions generated successfully! 🎉');

  try {
    console.log('Running Prettier on the generated file...');
    execSync(`npx prettier --write "${outputFilePath}"`, { stdio: 'inherit' });
    console.log('Prettier formatting completed successfully! 🎨');
  } catch (error) {
    console.error('Error running Prettier:', error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    generateI18nTypes(i18nDir, outputDir);
  } catch (error) {
    console.error('Error generating i18n types:', error);
    process.exit(1);
  }
}
