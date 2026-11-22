const {test} = require('node:test');
const assert = require('node:assert/strict');
const {normalize,createServer} = require('./server');
const {queryApartments} = require('./server');
test('province queries combine district totals and paginate across district boundaries', async () => {
  const districts = require('./src/regions.json').find(region => region.code === '11').districts;
  const codes = districts.slice(0, 2).map(district => '11' + district.code);
  const fetcher = async url => {
    const code = url.searchParams.get('LAWD_CD');
    assert.match(code, /^\d{5}$/);
    const totalCount = code === codes[0] ? 25 : code === codes[1] ? 13 : 0;
    const page = Number(url.searchParams.get('pageNo'));
    const size = Number(url.searchParams.get('numOfRows'));
    const items = Array.from({length: totalCount}, (_, index) => ({aptNm: `${code}-${index}`})).slice((page - 1) * size, page * size);
    return {ok: true, text: async () => JSON.stringify({response: {header: {resultCode: '000'}, body: {totalCount, items: {item: items}}}})};
  };
  const result = await queryApartments(fetcher, 'test', '11', '202609', 2, 20);
  assert.equal(result.totalCount, 38);
  assert.equal(result.items.length, 18);
  assert.equal(result.items[0].aptNm, `${codes[0]}-20`);
  assert.equal(result.items[4].aptNm, `${codes[0]}-24`);
  assert.equal(result.items[5].aptNm, `${codes[1]}-0`);
  assert.equal(result.items[17].aptNm, `${codes[1]}-12`);
});
test('all housing types paginate across providers and normalize villa rows', async () => {
  const fetcher = async url => {
    const villa = url.pathname.endsWith('/getRTMSDataSvcRHTrade2');
    const totalCount = villa ? 13 : 25;
    const page = Number(url.searchParams.get('pageNo'));
    const items = Array.from({length: totalCount}, (_, i) => villa
      ? {mhouseNm: `Villa ${i}`, umdNm: '청운동', jibun: '1'}
      : {aptNm: `Apartment ${i}`}).slice((page - 1) * 20, page * 20);
    return {ok: true, text: async () => JSON.stringify({
      response: {header: {resultCode: '000'}, body: {totalCount, items: {item: items}}},
    })};
  };
  const result = await queryApartments(fetcher, 'test', '11110', '202610', 2, 20, 'all');
  assert.equal(result.totalCount, 38);
  assert.equal(result.items.length, 18);
  assert.equal(result.items[4].aptNm, 'Apartment 24');
  assert.equal(result.items[5].aptNm, 'Villa 0');
  assert.equal(result.items[5].roadNm, '청운동 1');
  assert.equal(result.items[5].housingType, 'villa');
});
const xml = items => `<response><header><resultCode>000</resultCode></header><body><totalCount>${items ? 1 : 0}</totalCount><items>${items}</items></body></response>`;
test('normalizes XML single item, empty items and JSON arrays', () => {
  assert.equal(normalize(xml('<item><aptNm>테스트</aptNm><dealAmount>50,000</dealAmount></item>'),1,10).items[0].dealAmount,'50,000');
  assert.deepEqual(normalize(xml(''),1,10).items,[]);
  assert.equal(normalize(JSON.stringify({response:{header:{resultCode:'00'},body:{totalCount:2,items:{item:[{aptNm:'A'},{aptNm:'B'}]}}}}),2,10).items.length,2);
});
test('rejects provider errors and malformed responses', () => {
  for (const text of ['<bad>', '{}','<response><header><resultCode>30</resultCode></header></response>']) assert.throws(() => normalize(text,1,10));
});
test('validates query and hides service key in responses, including failure', async () => {
  let called=0; let upstream;
  const server=createServer(async url => {called++;upstream=url;return {ok:true,text:async()=>xml('<item><aptNm>A</aptNm></item>')};});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const original=process.env.APART_API_SERVICE_KEY; process.env.APART_API_SERVICE_KEY='test+/secret==';
  try {
    assert.equal((await fetch(base+'/api/apartments?lawdCd=bad')).status,400);assert.equal(called,0);
    const res=await fetch(base+'/api/apartments?lawdCd=11110&dealYMD=202507&pageNo=2&numOfRows=20');
    assert.equal(res.status,200);const text=await res.text();assert.equal(JSON.parse(text).pageNo,2);assert.ok(!text.includes('test+/secret'));assert.equal(upstream.searchParams.get('serviceKey'),'test+/secret==');
    delete process.env.APART_API_SERVICE_KEY;assert.equal((await fetch(base+'/api/apartments?lawdCd=11110&dealYMD=202507')).status,503);
  } finally {if(original===undefined) delete process.env.APART_API_SERVICE_KEY;else process.env.APART_API_SERVICE_KEY=original;await new Promise(resolve=>server.close(resolve));}
});
