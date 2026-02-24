# Power Transmission Monitoring Simulation

Cesium JS 기반 전력 전송 모니터링 시뮬레이션입니다. 충주시 도로를 따라 전류가 흐르는 모습을 3D 지도 위에 표시합니다.

## 기능

- **배경 지도**: ArcGIS World Imagery (항공/위성)
- **전송 라인**: 충주시 도로 데이터(OpenStreetMap Overpass API) 기반
- **전류 흐름 애니메이션**: 도로별 위상 오프셋 적용
- **다양한 라인 색상**: 시안, 라임, 오렌지, 마젠타 등

## 실행 방법

1. 로컬 웹 서버로 실행 (Cesium은 `file://` 프로토콜에서 제한이 있을 수 있음)

   ```bash
   npx serve .
   # 또는
   python -m http.server 8080
   ```

2. 브라우저에서 `http://localhost:3000` (또는 사용한 포트) 접속

## Cesium Ion 토큰 (선택)

3D 건물(OSM Buildings)을 사용하려면 [Cesium Ion](https://cesium.com/ion/tokens)에서 액세스 토큰을 발급한 뒤 `app.js`의 `Cesium.Ion.defaultAccessToken`에 설정하세요.

## 파일 구성

- `index.html` - 진입점, Cesium 뷰어 및 하단 UI
- `app.js` - 뷰어 초기화, 도로 데이터 로드, 전송선·전류 흐름 시각화
- `style.css` - 시뮬레이션 패널 등 오버레이 스타일

## 라이선스

MIT
