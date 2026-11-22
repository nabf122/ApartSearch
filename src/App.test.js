import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import App from './App';
jest.mock('axios', () => ({ get: jest.fn() }));
const response = (pageNo = 1) => ({ data: { items: [{aptNm:'테스트 아파트',dealAmount:'50,000'}],totalCount:45,pageNo,numOfRows:20 } });
beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers({ doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'performance'] }); jest.setSystemTime(new Date(2026, 9, 5)); });
afterEach(() => jest.useRealTimers());
async function submit() { fireEvent.click(screen.getByRole('button',{name:'거래 검색 →'})); await screen.findByText('테스트 아파트'); }
test('renders search and initial guidance without requesting data', () => {
  render(<App />); expect(screen.getByLabelText('시·도')).toHaveValue('11'); expect(screen.getByLabelText('시·군·구')).toHaveValue('110'); expect(axios.get).not.toHaveBeenCalled();
  expect(screen.getByLabelText('계약 연도')).toHaveValue('2026');
  expect(screen.getByLabelText('계약 월')).toHaveValue('09');
  expect(screen.getByLabelText('조회 건수')).toHaveValue('20');
  expect(within(screen.getByLabelText('조회 건수')).getAllByRole('option').map(option => option.value)).toEqual(['20', '50', '100', '200']);
});
test('opens the transaction location in a new Google Maps tab', async () => {
  const result = response();
  Object.assign(result.data.items[0], {sggCd: '11110', umdNm: '청운동', jibun: '12-3'});
  axios.get.mockResolvedValue(result);
  render(<App />);
  await submit();
  const link = screen.getByRole('link', {name: '테스트 아파트'});
  const url = new URL(link.href);
  expect(link).toHaveAttribute('target', '_blank');
  expect(url.origin + url.pathname).toBe('https://www.google.com/maps/search/');
  expect(url.searchParams.get('api')).toBe('1');
  expect(url.searchParams.get('query')).toBe('서울특별시 종로구 청운동 12-3 테스트 아파트');
});
test('sends the selected price range and clears it when disabled', async () => {
  axios.get.mockResolvedValue(response());
  render(<App />);
  const toggle = screen.getByRole('checkbox', {name: '가격 범위 사용'});
  expect(toggle).not.toBeChecked();
  fireEvent.click(toggle);
  fireEvent.change(screen.getByRole('slider', {name: '최소 거래금액'}), {target: {value: '5000'}});
  fireEvent.change(screen.getByRole('slider', {name: '최대 거래금액'}), {target: {value: '10000'}});
  await submit();
  expect(axios.get.mock.calls.at(-1)[1].params).toMatchObject({minPrice: 5000, maxPrice: 10000});
  fireEvent.click(toggle);
  await submit();
  expect(axios.get.mock.calls.at(-1)[1].params).not.toHaveProperty('maxPrice');
});
test('defaults to December of the previous year in January', () => {
  jest.setSystemTime(new Date(2027, 0, 31));
  render(<App />);
  expect(screen.getByLabelText('계약 연도')).toHaveValue('2026');
  expect(screen.getByLabelText('계약 월')).toHaveValue('12');
});
test('province change resets district and allows a province-wide search', async () => {
  axios.get.mockResolvedValue(response());
  render(<App />);
  fireEvent.change(screen.getByLabelText('시·도'), { target: { value: '41' } });
  expect(screen.getByLabelText('시·군·구')).toHaveValue('');
  expect(screen.queryByRole('option', { name: '종로구' })).not.toBeInTheDocument();
  await submit();
  expect(axios.get).toHaveBeenLastCalledWith('/api/apartments', { params: { lawdCd: '41', dealYMD: '202609', numOfRows: '20', pageNo: 1 } });
  fireEvent.change(screen.getByLabelText('시·군·구'), { target: { value: '111' } });
  await submit();
  expect(axios.get).toHaveBeenLastCalledWith('/api/apartments', { params: { lawdCd: '41111', dealYMD: '202609', numOfRows: '20', pageNo: 1 } });
});

test('uses response totals immediately and requests next, numbered and previous pages', async () => {
  axios.get.mockResolvedValueOnce(response()).mockResolvedValueOnce(response(2)).mockResolvedValueOnce(response(3)).mockResolvedValueOnce(response(2));
  render(<App />); await submit(); expect(screen.getByText('1 / 3 페이지')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('시·군·구'),{target:{value:'680'}});
  fireEvent.click(screen.getByRole('button',{name:'다음'})); await screen.findByText('2 / 3 페이지');
  expect(axios.get).toHaveBeenLastCalledWith('/api/apartments',{params:{lawdCd:'11110',dealYMD:'202609',numOfRows:'20',pageNo:2}});
  fireEvent.click(screen.getByRole('button',{name:'3',exact:true})); await screen.findByText('3 / 3 페이지'); expect(screen.getByRole('button',{name:'다음'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'이전'})); await screen.findByText('2 / 3 페이지');
});
test('new search resets page and uses edited conditions', async () => {
  axios.get.mockResolvedValueOnce(response(2)).mockResolvedValueOnce(response()); render(<App />); await submit();
  fireEvent.change(screen.getByLabelText('시·군·구'),{target:{value:'680'}}); await submit();
  expect(axios.get).toHaveBeenLastCalledWith('/api/apartments',{params:{lawdCd:'11680',dealYMD:'202609',numOfRows:'20',pageNo:1}});
});
test('combines selected year and zero-padded month for searches and pagination', async () => {
  axios.get.mockResolvedValueOnce(response()).mockResolvedValueOnce(response(2));
  render(<App />);
  fireEvent.change(screen.getByRole('combobox', { name: '계약 연도' }), { target: { value: '2026' } });
  fireEvent.change(screen.getByRole('combobox', { name: '계약 월' }), { target: { value: '09' } });
  await submit();
  expect(axios.get).toHaveBeenLastCalledWith('/api/apartments', { params: { lawdCd: '11110', dealYMD: '202609', numOfRows: '20', pageNo: 1 } });
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  await screen.findByText('2 / 3 페이지');
  expect(axios.get).toHaveBeenLastCalledWith('/api/apartments', { params: { lawdCd: '11110', dealYMD: '202609', numOfRows: '20', pageNo: 2 } });
});
test('disables search while loading and shows empty result', async () => {
  let resolve; axios.get.mockImplementation(() => new Promise(done => {resolve=done;})); render(<App />);
  fireEvent.click(screen.getByRole('button',{name:'거래 검색 →'})); expect(screen.getByRole('status')).toBeInTheDocument(); expect(screen.getByRole('button',{name:'조회 중…'})).toBeDisabled();
  resolve({data:{items:[],totalCount:0,pageNo:1,numOfRows:10}}); expect(await screen.findByText('검색 결과가 없습니다.')).toBeInTheDocument();
});
test('shows error and allows retry', async () => {
  axios.get.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(response()); render(<App />);
  fireEvent.click(screen.getByRole('button',{name:'거래 검색 →'})); expect(await screen.findByRole('alert')).toHaveTextContent('조회에 실패');
  fireEvent.click(screen.getByRole('button',{name:'다시 시도'})); await waitFor(() => expect(screen.getByText('테스트 아파트')).toBeInTheDocument());
});
test('sorts money numerically, toggles direction, sorts dates and keeps missing values last', async () => {
  axios.get.mockResolvedValue({ data: { items: [
    { aptNm: '가 아파트', dealAmount: '90,000', floor: '-1', dealYear: '2026', dealMonth: '9', dealDay: '2' },
    { aptNm: '나 아파트', dealAmount: '100,000', floor: '10', dealYear: '2026', dealMonth: '9', dealDay: '10' },
    { aptNm: '다 아파트', dealAmount: '', floor: '2' },
  ], totalCount: 3, pageNo: 1, numOfRows: 10 } });
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '거래 검색 →' }));
  await screen.findByText('가 아파트');
  const names = () => screen.getAllByRole('row').slice(1).map(row =>
    within(row).getByRole('link').firstChild.textContent);
  fireEvent.click(screen.getByRole('button', { name: '거래 금액 (만원)' }));
  expect(names()).toEqual(['가 아파트', '나 아파트', '다 아파트']);
  fireEvent.click(screen.getByRole('button', { name: '거래 금액 (만원)' }));
  expect(names()).toEqual(['나 아파트', '가 아파트', '다 아파트']);
  expect(screen.getByRole('columnheader', { name: '거래 금액 (만원)' })).toHaveAttribute('aria-sort', 'descending');
  fireEvent.click(screen.getByRole('button', { name: '계약 일자' }));
  expect(names()).toEqual(['가 아파트', '나 아파트', '다 아파트']);
  fireEvent.click(screen.getByRole('button', { name: '층 / 동' }));
  expect(names()).toEqual(['가 아파트', '다 아파트', '나 아파트']);
  fireEvent.click(screen.getByRole('button', { name: '건물명 / 주소' }));
  expect(names()).toEqual(['가 아파트', '나 아파트', '다 아파트']);
  expect(axios.get).toHaveBeenCalledTimes(1);
});
