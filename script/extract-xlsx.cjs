const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');

class I18nExcelConverter {
  constructor(localesDir = './src/lib/i18n/locales', excelFile = './translations.xlsx') {
    this.localesDir = localesDir;
    this.excelFile = excelFile;
  }

  /**
   * JSON 파일들을 Excel로 변환
   * 각 언어의 JSON 파일을 읽어서 하나의 Excel 파일로 통합
   */
  async jsonToExcel() {
    try {
      console.log('📁 JSON 파일들을 Excel로 변환 중...');
      
      // locales 디렉토리에서 JSON 파일들 찾기
      const files = await fs.readdir(this.localesDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      if (jsonFiles.length === 0) {
        throw new Error('JSON 파일을 찾을 수 없습니다.');
      }

      // 모든 언어 데이터 로드
      const languageData = {};
      const allKeys = new Set();

      for (const file of jsonFiles) {
        const lang = path.basename(file, '.json');
        const filePath = path.join(this.localesDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content);
        
        // 중첩된 객체를 평면화
        languageData[lang] = this.flattenObject(data);
        
        // 모든 키 수집
        Object.keys(languageData[lang]).forEach(key => allKeys.add(key));
      }

      // Excel 워크북 생성
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Translations');

      // 헤더 설정 - 새로운 형식으로 변경
      const languages = Object.keys(languageData).sort();
      const headers = ['Name', 'Type', ...languages, 'Key', 'Notes'];
      worksheet.addRow(headers);

      // 헤더 스타일링
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6F3FF' }
      };

      // 데이터 행 추가
      const sortedKeys = Array.from(allKeys).sort();
      for (const key of sortedKeys) {
        const row = [];
        
        // Name: 키값에서 .을 /로 변환
        row.push(key.replace(/\./g, '/'));
        
        // Type: 고정값 "String"
        row.push('STRING');
        
        // 각 언어별 번역 추가
        for (const lang of languages) {
          row.push(languageData[lang][key] || '');
        }
        
        // Key: 원본 키값
        row.push(key);
        
        // Notes: 빈 값
        row.push('');
        
        worksheet.addRow(row);
      }

      // 컬럼 너비 자동 조정
      worksheet.columns.forEach((column, index) => {
        if (index === 0) {
          column.width = 40; // Name 컬럼
        } else if (index === 1) {
          column.width = 15; // Type 컬럼
        } else if (index === headers.length - 2) {
          column.width = 40; // Key 컬럼
        } else if (index === headers.length - 1) {
          column.width = 20; // Notes 컬럼
        } else {
          column.width = 25; // 언어 컬럼들
        }
      });

      // 필터 추가
      worksheet.autoFilter = {
        from: 'A1',
        to: `${String.fromCharCode(65 + headers.length - 1)}1`
      };

      // Excel 파일 저장
      await workbook.xlsx.writeFile(this.excelFile);
      
      console.log(`✅ Excel 파일이 생성되었습니다: ${this.excelFile}`);
      console.log(`📊 총 ${sortedKeys.length}개의 키, ${languages.length}개의 언어`);
      
    } catch (error) {
      console.error('❌ JSON → Excel 변환 실패:', error.message);
      throw error;
    }
  }

  /**
   * Excel 파일을 JSON 파일들로 변환 (파일 경로 또는 URL 지원)
   */
  async excelToJson(excelSource = null) {
    try {
      console.log('📊 Excel 파일을 JSON으로 변환 중...');
      
      let excelFilePath = this.excelFile;
      let shouldCleanup = false;
      
      // URL이 제공된 경우 다운로드
      if (excelSource && (excelSource.startsWith('http://') || excelSource.startsWith('https://'))) {
        const tempFileName = `temp_excel_${Date.now()}.xlsx`;
        excelFilePath = path.join(process.cwd(), tempFileName);
        await this.downloadFromUrl(excelSource, excelFilePath);
        shouldCleanup = true;
      } else if (excelSource) {
        // 파일 경로가 제공된 경우
        excelFilePath = excelSource;
      }
      
      // Excel 파일 읽기
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(excelFilePath);
      
      const worksheet = workbook.getWorksheet('Translations');
      if (!worksheet) {
        throw new Error('Translations 워크시트를 찾을 수 없습니다.');
      }

      // 헤더 행 읽기
      const headerRow = worksheet.getRow(1);
      const headers = [];
      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = cell.value?.toString() || '';
      });

      console.log('📋 발견된 헤더:', headers);

      // 언어 컬럼 식별 (Name, Type, Key, Notes 제외)
      const languages = headers.filter(header => 
        header !== 'Name' && header !== 'Type' && header !== 'Key' && header !== 'Notes' && header.trim() !== ''
      );

      console.log('🌍 발견된 언어:', languages);

      if (languages.length === 0) {
        throw new Error('언어 컬럼을 찾을 수 없습니다. 헤더를 확인해주세요.');
      }

      // 각 언어별 데이터 객체 초기화
      const languageData = {};
      languages.forEach(lang => {
        languageData[lang] = {};
      });

      // 데이터 행 처리
      let processedRows = 0;
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // 헤더 행 스킵

        const cells = [];
        row.eachCell((cell, colNumber) => {
          cells[colNumber - 1] = cell.value?.toString() || '';
        });

        // Key 컬럼에서 실제 키값 가져오기
        const keyColumnIndex = headers.indexOf('Key');
        const key = cells[keyColumnIndex]?.trim();

        if (!key) return; // 키가 없으면 스킵

        // 각 언어별 번역 데이터 추출
        languages.forEach((lang) => {
          const langColumnIndex = headers.indexOf(lang);
          const translation = cells[langColumnIndex]?.trim() || '';
          
          languageData[lang][key] = translation;
        });

        processedRows++;
      });

      // locales 디렉토리 생성 (존재하지 않는 경우)
      await fs.mkdir(this.localesDir, { recursive: true });

      // 각 언어별 JSON 파일 생성
      for (const lang of languages) {
        // 평면화된 객체를 중첩 구조로 복원
        const nestedData = this.unflattenObject(languageData[lang]);
        const jsonContent = JSON.stringify(nestedData, null, 2);
        const filePath = path.join(this.localesDir, `${lang}.json`);
        
        await fs.writeFile(filePath, jsonContent, 'utf8');
        console.log(`✅ ${lang}.json 파일이 생성되었습니다 (${Object.keys(languageData[lang]).length}개 키)`);
      }

      console.log(`📁 총 ${processedRows}개 행, ${languages.length}개 언어 파일 생성 완료`);
      
      // 임시 파일 정리
      if (shouldCleanup) {
        try {
          await fs.unlink(excelFilePath);
          console.log(`🧹 임시 파일 정리 완료: ${excelFilePath}`);
        } catch (cleanupError) {
          console.warn(`⚠️ 임시 파일 정리 실패: ${cleanupError.message}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Excel → JSON 변환 실패:', error.message);
      throw error;
    }
  }

  /**
   * 중첩된 객체를 평면화 (dot notation 키로 변환)
   */
  flattenObject(obj, prefix = '') {
    const flattened = {};
    
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        Object.assign(flattened, this.flattenObject(obj[key], fullKey));
      } else {
        flattened[fullKey] = obj[key];
      }
    }
    
    return flattened;
  }

  /**
   * 평면화된 객체를 중첩 구조로 복원
   */
  unflattenObject(flattened) {
    const result = {};
    
    for (const key in flattened) {
      const keys = key.split('.');
      let current = result;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!(keys[i] in current)) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = flattened[key];
    }
    
    return result;
  }

  /**
   * 번역 파일 상태 체크
   */
  async checkTranslationStatus() {
    try {
      console.log('🔍 번역 상태를 확인 중...');
      
      const files = await fs.readdir(this.localesDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      if (jsonFiles.length === 0) {
        console.log('❌ JSON 파일을 찾을 수 없습니다.');
        return;
      }

      const languageData = {};
      const allKeys = new Set();

      // 모든 언어 파일 로드
      for (const file of jsonFiles) {
        const lang = path.basename(file, '.json');
        const filePath = path.join(this.localesDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content);
        
        languageData[lang] = this.flattenObject(data);
        Object.keys(languageData[lang]).forEach(key => allKeys.add(key));
      }

      const languages = Object.keys(languageData).sort();
      const totalKeys = allKeys.size;

      console.log('\n📊 번역 상태 리포트:');
      console.log('═'.repeat(50));
      
      for (const lang of languages) {
        const translatedKeys = Object.keys(languageData[lang]).length;
        const percentage = ((translatedKeys / totalKeys) * 100).toFixed(1);
        const missing = totalKeys - translatedKeys;
        
        console.log(`${lang.toUpperCase().padEnd(8)} │ ${translatedKeys.toString().padStart(4)}/${totalKeys} (${percentage.padStart(5)}%) │ 누락: ${missing}`);
      }
      
      console.log('═'.repeat(50));
      console.log(`총 ${totalKeys}개의 번역 키`);

      // 누락된 키 찾기
      if (languages.length > 1) {
        console.log('\n🔍 누락된 키 분석:');
        
        for (const lang of languages) {
          const missingKeys = Array.from(allKeys).filter(key => !(key in languageData[lang]));
          
          if (missingKeys.length > 0) {
            console.log(`\n${lang.toUpperCase()} 언어에서 누락된 키 (${missingKeys.length}개):`);
            missingKeys.slice(0, 10).forEach(key => console.log(`  • ${key}`));
            
            if (missingKeys.length > 10) {
              console.log(`  ... 및 ${missingKeys.length - 10}개 더`);
            }
          }
        }
      }
      
    } catch (error) {
      console.error('❌ 번역 상태 확인 실패:', error.message);
    }
  }

  /**
   * URL에서 파일 다운로드
   */
  async downloadFromUrl(url, outputPath, redirectCount = 0) {
    if (redirectCount > 10) {
      throw new Error('리디렉션이 너무 많습니다.');
    }

    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;
      
      console.log(`📥 URL에서 파일 다운로드 중: ${url}`);
      
      const request = protocol.get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          const redirectUrl = new URL(response.headers.location, url).toString();
          console.log(`➡️ 리디렉션: ${redirectUrl}`);
          this.downloadFromUrl(redirectUrl, outputPath, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        // Content-Type 확인
        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
          reject(new Error('다운로드된 파일이 HTML 페이지입니다. 올바른 Excel 파일 URL을 사용하세요.'));
          return;
        }

        const fileStream = fsSync.createWriteStream(outputPath);
        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`✅ 파일 다운로드 완료: ${outputPath}`);
          
          // 파일이 실제 Excel 파일인지 확인
          this.validateExcelFile(outputPath).then(() => {
            resolve(outputPath);
          }).catch((error) => {
            reject(error);
          });
        });

        fileStream.on('error', (err) => {
          fsSync.unlink(outputPath, () => {}); // 다운로드된 파일 삭제
          reject(err);
        });
      });

      request.on('error', (err) => {
        reject(err);
      });

      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error('다운로드 시간 초과'));
      });
    });
  }

  /**
   * Excel 파일 유효성 검사
   */
  async validateExcelFile(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      
      // Excel 파일 시그니처 확인 (PK\x03\x04 - ZIP 파일 시그니처)
      if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4B || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
        // HTML 파일인지 확인
        const content = buffer.toString('utf8', 0, Math.min(1000, buffer.length));
        if (content.includes('<!DOCTYPE html>') || content.includes('<html')) {
          throw new Error('다운로드된 파일이 HTML 페이지입니다. Google Sheets의 경우 올바른 다운로드 URL을 사용하세요:\nhttps://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=xlsx');
        }
        throw new Error('유효하지 않은 Excel 파일입니다.');
      }
      
      console.log('✅ Excel 파일 유효성 검사 통과');
    } catch (error) {
      // 파일 삭제
      try {
        await fs.unlink(filePath);
      } catch {
        // 무시
      }
      throw error;
    }
  }
}

// 사용 예시 및 CLI 인터페이스
async function main() {
  const converter = new I18nExcelConverter();
  
  const command = process.argv[2];
  const source = process.argv[3]; // 파일 경로 또는 URL
  
  try {
    switch (command) {
      case 'to-excel':
      case 'export':
        await converter.jsonToExcel();
        break;
        
      case 'to-json':
      case 'import':
        await converter.excelToJson(source);
        break;
        
      case 'status':
      case 'check':
        await converter.checkTranslationStatus();
        break;
        
      case 'sync':
        console.log('🔄 양방향 동기화 실행...');
        await converter.jsonToExcel();
        console.log('');
        await converter.checkTranslationStatus();
        break;
        
      default:
        console.log(`
🌐 Svelte i18n Excel 변환 도구

사용법:
  node extract-xlsx.cjs <command> [source]

명령어:
  to-excel, export           │ JSON 파일들을 Excel로 변환
  to-json, import [source]   │ Excel 파일을 JSON 파일들로 변환  
  status, check              │ 번역 상태 확인
  sync                      │ JSON → Excel 변환 후 상태 확인

source 옵션 (to-json/import 명령어):
  - 파일 경로: ./translations.xlsx
  - URL: https://example.com/translations.xlsx
  - 생략 시 기본 파일 사용: ./translations.xlsx

Google Sheets 사용 시:
  올바른 다운로드 URL 형식:
  https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=xlsx
  
  예시:
  https://docs.google.com/spreadsheets/d/1OfUFVV5Piie8-NP4Edv6JCwl4j9bu58K/export?format=xlsx

파일 경로:
  JSON 파일들: ./src/lib/i18n/locales/*.json
  Excel 파일: ./translations.xlsx

예시:
  node extract-xlsx.cjs export                    # JSON → Excel
  node extract-xlsx.cjs import                    # Excel → JSON (기본 파일)
  node extract-xlsx.cjs import ./data.xlsx        # Excel → JSON (특정 파일)
  node extract-xlsx.cjs import https://docs.google.com/spreadsheets/d/1OfUFVV5Piie8-NP4Edv6JCwl4j9bu58K/export?format=xlsx  # URL에서 다운로드
  node extract-xlsx.cjs status                    # 번역 상태 확인
        `);
        break;
    }
  } catch (error) {
    console.error('실행 중 오류가 발생했습니다:', error.message);
    process.exit(1);
  }
}

// CLI로 실행된 경우
if (require.main === module) {
  main();
}

module.exports = I18nExcelConverter;