const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { XMLParser, XMLValidator } = require('fast-xml-parser');
require('dotenv').config({ path: path.join(__dirname, '.env.server.local'), quiet: true });
const parser = new XMLParser({ parseTagValue: false, trimValues: true });
const regions = require('./src/regions.json');
const clients = new WeakMap();
const services = {
  apartment: 'RTMSDataSvcAptTradeDev',
  villa: 'RTMSDataSvcRHTrade2',
};

async function mapLimited(values, mapper) {
  const results = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await mapper(values[index]);
    }
  }));
  return results;
}

async function queryApartments(fetcher, key, lawdCd, dealYMD, pageNo, numOfRows, housingType = 'apartment', priceRange = null) {
  if (!clients.has(fetcher)) clients.set(fetcher, { queue: Promise.resolve(), cache: new Map(), lastCall: 0 });
  const client = clients.get(fetcher);
  async function request({code, type}, page, pageSize = numOfRows) {
    const cacheKey = JSON.stringify([key, code, type, dealYMD, page, pageSize]);
    const cached = client.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.promise;
    const service = services[type];
    const upstream = new URL(`https://apis.data.go.kr/1613000/${service}/get${service}`);
    upstream.search = new URLSearchParams({serviceKey:key,LAWD_CD:code,DEAL_YMD:dealYMD,pageNo:String(page),numOfRows:String(pageSize)});
    const run = async () => {
      if (fetcher === fetch) {
        const wait = Math.max(0, 1100 - (Date.now() - client.lastCall));
        if (wait) await new Promise(resolve => setTimeout(resolve, wait));
        client.lastCall = Date.now();
      }
      const response = await fetcher(upstream, {signal:AbortSignal.timeout(15000)});
      if (!response.ok) {
        const error = new Error('Upstream HTTP failure');
        error.status = response.status;
        error.housingType = type;
        throw error;
      }
      const result = normalize(await response.text(), page, pageSize);
      if (type === 'villa') {
        result.items = result.items.map(item => ({
          ...item,
          aptNm: item.mhouseNm,
          roadNm: [item.umdNm, item.jibun].filter(Boolean).join(' '),
          housingType: type,
        }));
      }
      return result;
    };
    const promise = client.queue.then(run);
    client.queue = promise.catch(() => {});
    if (client.cache.size >= 500) client.cache.delete(client.cache.keys().next().value);
    client.cache.set(cacheKey, { promise, expires: Date.now() + 300000 });
    try { return await promise; } catch (error) { client.cache.delete(cacheKey); throw error; }
  }
  const types = housingType === 'all' ? Object.keys(services) : [housingType];
  const codes = lawdCd.length === 5 ? [lawdCd] : regions.find(region => region.code === lawdCd)
    .districts.map(district => lawdCd + district.code);
  const sources = codes.flatMap(code => types.map(type => ({code, type})));
  if (priceRange) {
    const {minPrice, maxPrice} = priceRange;
    const pageSize = 200;
    const matches = await mapLimited(sources, async source => {
      const first = await request(source, 1, pageSize);
      const matchingItems = [];
      const totalPages = Math.ceil(first.totalCount / pageSize);
      for (let page = 1; page <= totalPages; page++) {
        const data = page === 1 ? first : await request(source, page, pageSize);
        for (const item of data.items) {
          const rawAmount = String(item.dealAmount ?? '').replace(/,/g, '').trim();
          if (!/^\d+$/.test(rawAmount)) continue;
          const amount = Number(rawAmount);
          if (amount >= minPrice && amount <= maxPrice) matchingItems.push(item);
        }
      }
      return matchingItems;
    });
    const items = matches.flat();
    const start = (pageNo - 1) * numOfRows;
    return {items: items.slice(start, start + numOfRows), totalCount: items.length, pageNo, numOfRows};
  }
  if (sources.length === 1) return request(sources[0], pageNo);
  const firstPages = await mapLimited(sources, async source => ({source, data: await request(source, 1)}));
  const start = (pageNo - 1) * numOfRows;
  const end = start + numOfRows;
  let offset = 0;
  const items = [];
  for (const {source, data} of firstPages) {
    const localStart = Math.max(0, start - offset);
    const localEnd = Math.min(data.totalCount, end - offset);
    if (localEnd > localStart) {
      for (let page = Math.floor(localStart / numOfRows) + 1; page <= Math.ceil(localEnd / numOfRows); page++) {
        const part = page === 1 ? data : await request(source, page);
        const pageStart = (page - 1) * numOfRows;
        items.push(...part.items.slice(Math.max(0, localStart - pageStart), Math.min(numOfRows, localEnd - pageStart)));
      }
    }
    offset += data.totalCount;
  }
  return {items, totalCount: offset, pageNo, numOfRows};
}

function normalize(text, pageNo, numOfRows) {
  let payload;
  try {
    if (text.trim().startsWith('{')) payload = JSON.parse(text);
    else {
      if (XMLValidator.validate(text) !== true) throw new Error();
      payload = parser.parse(text);
    }
  } catch { throw new Error('공공데이터 응답을 읽을 수 없습니다.'); }
  const response = payload?.response;
  if (!response?.header || !['000', '00', '0'].includes(String(response.header.resultCode))) {
    throw new Error('공공데이터 API에서 조회를 처리하지 못했습니다. 인증키와 요청 조건을 확인하세요.');
  }
  const body = response.body;
  if (!body || !Number.isInteger(Number(body.totalCount)) || Number(body.totalCount) < 0) throw new Error('공공데이터 응답 형식이 올바르지 않습니다.');
  const item = body.items?.item;
  const items = item == null || item === '' ? [] : Array.isArray(item) ? item : [item];
  if (items.some(row => !row || typeof row !== 'object') || (Number(body.totalCount) > 0 && !items.length)) throw new Error('거래 목록 응답이 올바르지 않습니다.');
  return { items, totalCount: Number(body.totalCount), pageNo, numOfRows };
}
function createServer(fetcher = fetch) {
  return http.createServer(async (req,res) => {
    const url = new URL(req.url, 'http://localhost');
    const send = (status,data) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); };
    if (url.pathname === '/api/apartments') {
      if (req.method !== 'GET') return send(405,{error:'GET 요청만 지원합니다.'});
      const lawdCd = url.searchParams.get('lawdCd');
      const dealYMD = url.searchParams.get('dealYMD');
      const pageNo = Number(url.searchParams.get('pageNo') || 1);
      const numOfRows = Number(url.searchParams.get('numOfRows') || 20);
      const housingType = url.searchParams.get('housingType') ?? 'apartment';
      const minPrice = url.searchParams.get('minPrice');
      const maxPrice = url.searchParams.get('maxPrice');
      const validPrice = value => value !== null && /^\d+$/.test(value) && Number(value) <= 100000 && Number(value) % 1000 === 0;
      const usePrice = minPrice !== null || maxPrice !== null;
      if (usePrice && (!validPrice(minPrice) || !validPrice(maxPrice) || Number(minPrice) > Number(maxPrice))) {
        return send(400,{error:'가격 범위를 0원부터 10억원까지 1천만원 단위로 선택하세요.'});
      }
      const priceRange = usePrice ? {minPrice: Number(minPrice), maxPrice: Number(maxPrice)} : null;
      if (!['all', 'apartment', 'villa'].includes(housingType)) return send(400,{error:'주택 유형을 확인하세요.'});
      const validRegion = regions.some(province => lawdCd === province.code || province.districts.some(district => lawdCd === province.code + district.code));
      if (!validRegion || !/^\d{4}(0[1-9]|1[0-2])$/.test(dealYMD || '') || !Number.isInteger(pageNo) || pageNo < 1 || ![20,50,100,200].includes(numOfRows)) return send(400,{error:'지역코드, 계약월, 페이지 조건을 확인하세요.'});
      const key = process.env.APART_API_SERVICE_KEY;
      if (!key) return send(503,{error:'서버의 API 인증키가 설정되지 않았습니다.'});
      try {
        return send(200, await queryApartments(fetcher, key, lawdCd, dealYMD, pageNo, numOfRows, housingType, priceRange));
      } catch (err) {
        const code = err.cause?.code;
        // URL과 원본 오류 메시지에는 인증키가 포함될 수 있으므로 기록하지 않습니다.
        console.error('[apartments] upstream failure', { name: err.name, code, status: err.status, syscall: err.cause?.syscall });
        const message = err.housingType === 'villa' && [401, 403].includes(err.status)
          ? '빌라 조회 권한을 확인해 주세요. 공공데이터포털에서 연립다세대 매매 실거래가 API 활용신청이 필요합니다.'
          : err.status === 429
          ? '공공데이터 API 요청 제한에 도달했습니다. 잠시 후 다시 조회해 주세요.'
          : err.name === 'TimeoutError'
          ? '조회 시간이 초과되었습니다. 다시 시도해 주세요.'
          : ['EACCES', 'EPERM'].includes(code)
            ? 'API 서버의 외부 네트워크 접근 권한이 차단되었습니다. 서버 실행 권한을 확인하세요.'
            : '공공데이터 조회에 실패했습니다. 인증키와 연결 상태를 확인하세요.';
        return send(502, { error: message });
      }
    }
    if (url.pathname.startsWith('/api/')) return send(404,{error:'존재하지 않는 API입니다.'});
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(405,{error:'지원하지 않는 요청입니다.'});
    const root = path.join(__dirname,'build');
    let file;
    try { file = path.resolve(root, '.' + decodeURIComponent(url.pathname)); } catch { return send(400,{error:'잘못된 경로입니다.'}); }
    if (!file.startsWith(root + path.sep) && file !== root) return send(404,{error:'파일을 찾을 수 없습니다.'});
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root,'index.html');
    if (!fs.existsSync(file)) return send(404,{error:'개발 화면은 npm start로 실행하세요.'});
    const mime = {'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
    res.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream','X-Content-Type-Options':'nosniff'});
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}
if (require.main === module) createServer().listen(Number(process.env.PORT) || 3001, '127.0.0.1', () => console.log('ApartSearch server: http://127.0.0.1:' + (process.env.PORT || 3001)));
module.exports = {createServer, normalize, queryApartments};
