const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source = path.join(root, 'data', '국토교통부_법정동코드_20260813.csv');
const text = new TextDecoder('euc-kr').decode(fs.readFileSync(source));
const rows = text.trim().split(/\r?\n/).slice(1).map(line => line.split(','))
  .filter(([code, , status]) => /^\d{10}$/.test(code) && status.trim() === '존재');
const provinces = new Map();
for (const [code, name] of rows) {
  if (!provinces.has(code.slice(0, 2))) provinces.set(code.slice(0, 2), { code: code.slice(0, 2), name: name.split(' ')[0], districts: [] });
}
const districts = rows.filter(([code]) => code.endsWith('00000') && code.slice(2, 5) !== '000');
for (const [code, name] of districts) {
  // 구가 있는 시의 상위 코드는 제외하고 실제 조회할 시군구만 남깁니다.
  if (districts.some(([otherCode, otherName]) => otherCode !== code && otherName.startsWith(name + ' '))) continue;
  const province = provinces.get(code.slice(0, 2));
  province.districts.push({ code: code.slice(2, 5), name: name.slice(province.name.length).trim() || '전체' });
}
const result = [...provinces.values()].filter(province => province.districts.length);
fs.writeFileSync(path.join(root, 'src', 'regions.json'), JSON.stringify(result, null, 2) + '\n');
console.log(`지역 목록 생성: ${result.length}개 시도, ${result.reduce((sum, province) => sum + province.districts.length, 0)}개 시군구`);
