import logo from './logo.svg';
import './App.css';
import axios from 'axios';
import { useState } from "react";

export default function App() {
  const [data, setData] = useState(null);
  function onClick(){
    // 인증키-필수
    let serviceKey = "wrNlJtlld9YOEXrP5OjsQ2Pg00C2J7t8XMMUWfFIKkdfItYwfsbYWzLA3ILirKIbQMcoIWIqT2SHVhMy8cWzcg==";
		let LAWD_CD = "11110"; // 지역코드-필수
		let DEAL_YMD = "202407"; // 계약월(6자리)-필수
		let pageNo = "1"; // 페이지 번호
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
      <div>
        <button onClick={onClick}>불러오기</button>
      </div>
      {data && (
        <textarea
          rows={7}
          value={JSON.stringify(data, null, 2)}
          readOnly={true}
        />
      )}
    </div>
  );
}
