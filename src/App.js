import logo from './logo.svg';
import './App.css';
import axios from 'axios';
import { useState, useEffect } from "react";

export default function App() {
  const [data, setData] = useState(null);
  const [totalCnt, setCnt] = useState(null);
  const [numOfRows, setRowNum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [value, setValues] = useState({
    lawdCd: '11110',
    dealYMD: '202507',
    pageNo: '1'
  })

  const handleChange = (e) => {
    setValues(prevValues => {
      const {name, value} = e.target;
      return {
        ...prevValues,
        [name]: value
      }
    });
  }

  function onClick(){

    // 인증키-필수
    let serviceKey = "wrNlJtlld9YOEXrP5OjsQ2Pg00C2J7t8XMMUWfFIKkdfItYwfsbYWzLA3ILirKIbQMcoIWIqT2SHVhMy8cWzcg==";
		let LAWD_CD = value.lawdCd; // 지역코드-필수
		let DEAL_YMD = value.dealYMD; // 계약월(6자리)-필수
		let pageNo = value.pageNo; // 페이지 번호
		let numOfRows = "20"; // 한 페이지 결과 수

    let url = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?";
    url += "serviceKey=" + serviceKey;
		url += "&LAWD_CD=" + LAWD_CD;
		url += "&DEAL_YMD=" + DEAL_YMD;

    if(pageNo != null) {
			url += "&pageNo=" + pageNo;
		}
		
		if(numOfRows != null) {
			url += "&numOfRows=" + numOfRows;
		}

    axios
      .get(url)
      .then((response) => {
        setData(response.data.response.body.items.item);
        setCnt(response.data.response.body.totalCount);
        setRowNum(response.data.response.body.numOfRows);
      });
  }

  return (
    <>
      <div className="search-container">
        <h2 className="search-title">아파트 검색</h2>
        <input className="search-input" type="text" name="lawdCd" value={value.lawdCd} onChange={handleChange} /><br></br>
        <input className="search-input" type="text" name="dealYMD" value={value.dealYMD} onChange={handleChange} /><br></br>
        <button className="search-button" onClick={onClick}>검색</button>
      </div>
    
      {data && (
        <div className="styled-table-container">
          총 {totalCnt}건
          <table className="styled-table">
            <thead>
              <tr>
                <th>순번</th>
                <th>아파트 이름</th>
                <th>건축 연도</th>
                <th>동명</th>
                <th>층수</th>
                <th>거래 유형</th>
                <th>주소1</th>
                <th>주소2</th>
                <th>거래 방법</th>
                <th>계약 일자</th>
                <th>거래 금액(만원)</th>
                <th>전용면적</th>
              </tr>
            </thead>
            <tbody>
              {data.map((apt) => (
                <tr key={apt.aptSeq}>
                  <td>{numOfRows}</td>
                  <td>{apt.aptNm}</td>
                  <td>{apt.buildYear}</td>
                  <td>{apt.aptDong}</td>
                  <td>{apt.floor}</td>
                  <td>{apt.buyerGbn}</td>
                  <td>{apt.estateAgentSggNm}</td>
                  <td>{apt.roadNm}</td>
                  <td>{apt.dealingGbn}</td>
                  <td>{apt.dealYear}-{apt.dealMonth}-{apt.dealDay}</td>
                  <td>{apt.dealAmount}</td>
                  <td>{apt.excluUseAr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    
    </>
  );
}
