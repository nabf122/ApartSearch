import logo from './logo.svg';
import './App.css';
import axios from 'axios';
import { useState } from "react";

export default function App() {
  const [data, setData] = useState(null);

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
		let numOfRows = "10"; // 한 페이지 결과 수

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
        setData(response.data);
      });
  }

  return (
    <div className="App">
      <form className='search_box'>
        지역코드      <input type="text" name="lawdCd" value={value.lawdCd} onChange={handleChange} /><br></br>
        계약월 6자리  <input type="text" name="dealYMD" value={value.dealYMD} onChange={handleChange} /><br></br>
        페이지 번호   <input type="text" name="pageNo" value={value.pageNo} onChange={handleChange} />

      </form>


      <div>
        <button onClick={onClick}>검색</button>
      </div>
      {data && (
        <div className='result_box'>
          <textarea
            rows={30}
            value={JSON.stringify(data, null, 2)}
            readOnly={true}
            cols={70}
          />
        </div>
      )}
    </div>
  );
}
