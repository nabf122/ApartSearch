import './App.css';
import axios from 'axios';
import { useState } from 'react';
import regions from './regions.json';

const columns = [
  { key: 'index', label: '순번', numeric: true },
  { key: 'aptNm', label: '아파트 / 도로명' },
  { key: 'dealAmount', label: '거래 금액 (만원)', numeric: true },
  { key: 'excluUseAr', label: '전용면적 (㎡)', numeric: true },
  { key: 'floor', label: '층 / 동', numeric: true },
  { key: 'date', label: '계약 일자' },
  { key: 'buildYear', label: '건축 연도', numeric: true },
  { key: 'dealingGbn', label: '거래 방법' },
  { key: 'buyerGbn', label: '매수자 구분' },
  { key: 'estateAgentSggNm', label: '중개사 소재지' },
];
function sortValue(apt, column, index) {
  if (column.key === 'index') return index;
  if (column.key === 'date') {
    return apt.dealYear && apt.dealMonth && apt.dealDay
      ? `${apt.dealYear}${String(apt.dealMonth).padStart(2, '0')}${String(apt.dealDay).padStart(2, '0')}` : null;
  }
  const value = apt[column.key];
  if (value == null || String(value).trim() === '') return null;
  if (!column.numeric) return String(value);
  const number = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(number) ? number : null;
}

export default function App() {
  const [values, setValues] = useState(() => {
    const today = new Date();
    const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return {
      lawdCd: '11110',
      dealYMD: `${previousMonth.getFullYear()}${String(previousMonth.getMonth() + 1).padStart(2, '0')}`,
      numOfRows: '20',
    };
  });
  const [query, setQuery] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sort, setSort] = useState({ key: 'index', direction: 'asc' });
  const changeSort = key => setSort(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  const handleChange = ({ target }) => setValues(prev => ({ ...prev, [target.name]: target.value }));
  const selectedProvince = regions.find(region => region.code === values.lawdCd.slice(0, 2));
  const handleProvince = ({ target }) => {
    const province = regions.find(region => region.code === target.value);
    setValues(prev => ({ ...prev, lawdCd: province.code }));
  };
  const handleDistrict = ({ target }) => setValues(prev => ({ ...prev, lawdCd: prev.lawdCd.slice(0, 2) + target.value }));
  const regionName = code => {
    const province = regions.find(region => region.code === code.slice(0, 2));
    if (code.length === 2) return `${province.name} 전체`;
    const district = province?.districts.find(region => region.code === code.slice(2));
    return district?.name === '전체' ? province.name : `${province?.name || ''} ${district?.name || ''}`.trim();
  };
  const years = Array.from({ length: new Date().getFullYear() - 2006 + 1 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const handleContractMonth = ({ target }) => setValues(prev => ({
    ...prev,
    dealYMD: target.name === 'dealYear'
      ? target.value + prev.dealYMD.slice(4)
      : prev.dealYMD.slice(0, 4) + target.value,
  }));
  async function search(params, pageNo = 1) {
    setLoading(true); setError(''); setResult(null); setQuery(params);
    try {
      const { data } = await axios.get('/api/apartments', { params: { ...params, pageNo } });
      setResult(data); setQuery(params);
    } catch (err) {
      setError(err.response?.data?.error || '조회에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally { setLoading(false); }
  }
  const totalPages = result ? Math.ceil(result.totalCount / result.numOfRows) : 0;
  const firstPage = result ? Math.floor((result.pageNo - 1) / 10) * 10 + 1 : 1;
  const pages = Array.from({ length: Math.max(0, Math.min(10, totalPages - firstPage + 1)) }, (_, i) => firstPage + i);
  const sortedItems = (result?.items || []).map((apt, index) => ({ apt, index }));
  const sortColumn = columns.find(column => column.key === sort.key);
  sortedItems.sort((a, b) => {
    const left = sortValue(a.apt, sortColumn, a.index);
    const right = sortValue(b.apt, sortColumn, b.index);
    if (left === null || right === null) return left === right ? a.index - b.index : left === null ? 1 : -1;
    const order = typeof left === 'number' ? left - right : left.localeCompare(right, 'ko', { numeric: true });
    return (sort.direction === 'asc' ? order : -order) || a.index - b.index;
  });
  return <main className="dashboard">
    <header className="topbar"><a href="/" className="brand"><span className="brand-icon">A</span> Apart<span>Search</span></a><span className="source-badge">국토교통부 공공데이터</span></header>
    <section className="hero"><span className="eyebrow">APARTMENT TRANSACTIONS</span><h1>아파트 거래 정보,<br />한눈에 살펴보세요.</h1><p>지역과 계약월로 실제 매매 거래를 확인하세요.</p></section>
    <form className="search-container" onSubmit={e => { e.preventDefault(); search({ ...values }); }}>
      <div className="section-heading"><h2>거래 검색</h2><span>원하는 조건으로 찾아보세요</span></div>
      <div className="search-fields">
        <div className="region-fields">
          <label>시·도<select aria-label="시·도" value={selectedProvince.code} onChange={handleProvince} disabled={loading}>{regions.map(region => <option key={region.code} value={region.code}>{region.name}</option>)}</select></label>
          <label>시·군·구<select aria-label="시·군·구" value={values.lawdCd.slice(2)} onChange={handleDistrict} disabled={loading}><option value="">전체</option>{selectedProvince.districts.map(district => <option key={district.code} value={district.code}>{district.name}</option>)}</select></label>
        </div>
        <div className="contract-month">
          <span className="field-title">계약월</span>
          <div className="month-selects">
            <select aria-label="계약 연도" name="dealYear" value={values.dealYMD.slice(0, 4)} onChange={handleContractMonth} disabled={loading}>{years.map(year => <option key={year} value={year}>{year}년</option>)}</select>
            <select aria-label="계약 월" name="dealMonth" value={values.dealYMD.slice(4)} onChange={handleContractMonth} disabled={loading}>{months.map(month => <option key={month} value={month}>{Number(month)}월</option>)}</select>
          </div>
          <small>조회할 연도와 월을 선택하세요</small>
        </div>
        <label>조회 건수<select aria-label="조회 건수" name="numOfRows" value={values.numOfRows} onChange={handleChange} disabled={loading}>{[20,50,100,200].map(n => <option key={n} value={n}>{n}건씩 보기</option>)}</select><small>페이지당 표시할 거래 수</small></label>
        <button className="search-button" disabled={loading}>{loading ? '조회 중…' : '거래 검색 →'}</button>
      </div>
    </form>
    {loading && <div className="empty-state" role="status"><span className="spinner" />거래 정보를 가져오고 있습니다.</div>}
    {error && <div className="error-state" role="alert">{error}<button onClick={() => search(query || values)}>다시 시도</button></div>}
    {!loading && !error && !result && <div className="empty-state"><span className="empty-icon">⌕</span><h2>어떤 지역이 궁금하신가요?</h2><p>조건을 입력하고 검색하면 아파트 실거래 내역이 표시됩니다.</p></div>}
    {result && <section className="results">
      <div className="results-heading"><div><span className="eyebrow">SEARCH RESULTS</span><h2>매매 거래 내역 <span className="count">{result.totalCount.toLocaleString()}건</span></h2></div><span className="result-meta">{regionName(query.lawdCd)} · {query.dealYMD.slice(0,4)}년 {query.dealYMD.slice(4)}월</span></div>
      {result.items.length === 0 ? <div className="empty-state"><h2>검색 결과가 없습니다.</h2><p>지역이나 계약월을 바꿔 다시 검색해 보세요.</p></div> : <>
        <p className="sort-hint">컬럼명을 클릭해 현재 페이지를 정렬하세요. 아파트 / 도로명은 아파트 이름, 층 / 동은 층수를 기준으로 정렬합니다.</p>
        <div className="table-scroll"><table><thead><tr>{columns.map(column => <th key={column.key} scope="col" aria-sort={sort.key === column.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}><button className="sort-button" onClick={() => changeSort(column.key)}>{column.label}<span aria-hidden="true">{sort.key === column.key ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>)}</tr></thead>
        <tbody>{sortedItems.map(({apt,index:i}) => <tr key={`${result.pageNo}-${i}`}><td className="muted">{(result.pageNo-1)*result.numOfRows+i+1}</td><td><strong>{apt.aptNm || '—'}</strong><small>{apt.roadNm || '도로명 정보 없음'}</small></td><td className="amount">{apt.dealAmount || '—'}</td><td>{apt.excluUseAr || '—'}</td><td>{apt.floor ?? '—'}층<small>{apt.aptDong || '—'}</small></td><td>{[apt.dealYear,apt.dealMonth,apt.dealDay].filter(Boolean).join('.') || '—'}</td><td>{apt.buildYear || '—'}</td><td><span className="tag">{apt.dealingGbn || '—'}</span></td><td>{apt.buyerGbn || '—'}</td><td>{apt.estateAgentSggNm || '—'}</td></tr>)}</tbody></table></div>
        <div className="pagination-footer"><span>{result.pageNo} / {totalPages} 페이지</span><nav aria-label="검색 결과 페이지"><button disabled={loading || result.pageNo <= 1} onClick={() => search(query,result.pageNo-1)}>이전</button>{pages.map(page => <button key={page} className={page===result.pageNo ? 'active' : ''} aria-current={page===result.pageNo ? 'page' : undefined} disabled={loading || page===result.pageNo} onClick={() => search(query,page)}>{page}</button>)}<button disabled={loading || result.pageNo>=totalPages} onClick={() => search(query,result.pageNo+1)}>다음</button></nav></div>
      </>}
    </section>}
    <footer>국토교통부 아파트 매매 실거래가 자료 · 신고 및 정정에 따라 조회 결과가 달라질 수 있습니다.</footer>
  </main>;
}
