// Cesium Ion 액세스 토큰 (https://cesium.com/ion/tokens 에서 발급)
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIzYjhhNmI2MC0yMDkzLTRlYzAtOTJkZS1lMDRiYTFlM2RkMTciLCJpZCI6MTM5Mjc3LCJpYXQiOjE2ODQzMDAwNDB9.KaVQgHZBbL8lkr7EXhMOu061CeA3SOC8UQL5zER-2UE";

let viewer;

// 배경 지도 (Web Mercator)
var webMercator = new Cesium.WebMercatorTilingScheme();

// CARTO 다크맵
function createCartoDarkImagery() {
  return new Cesium.UrlTemplateImageryProvider({
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    tilingScheme: webMercator,
    maximumLevel: 20,
    subdomains: ["a", "b", "c", "d"],
    credit: "© CARTO © OpenStreetMap contributors",
  });
}

(async function init() {
  const defaultTerrain = new Cesium.EllipsoidTerrainProvider();
  let terrain = defaultTerrain;

  // Ion 토큰이 있으면 3D 지형만 시도
  try {
    if (Cesium.Ion.defaultAccessToken && Cesium.Ion.defaultAccessToken !== "YOUR_ION_ACCESS_TOKEN") {
      terrain = await Cesium.createWorldTerrainAsync();
    }
  } catch (e) {
    console.warn("Ion 지형 로드 실패:", e);
  }

  viewer = new Cesium.Viewer("cesiumContainer", {
    terrainProvider: terrain,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: true,
    sceneModePicker: true,
    navigationHelpButton: true,
    fullscreenButton: true,
    animation: false,
    timeline: false,
    useDefaultRenderLoop: true,
    requestRenderMode: false,
  });

  // 배경 지도: CARTO 다크맵
  viewer.scene.imageryLayers.removeAll();
  var baseProvider = createCartoDarkImagery();
  await baseProvider.readyPromise;
  viewer.scene.imageryLayers.addImageryProvider(baseProvider);

  await runScene();
})();

async function runScene() {
  // 초기 카메라: 충주 인근 (아이소메트릭 뷰)
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(127.92, 36.98, 7500),
    orientation: {
      heading: Cesium.Math.toRadians(-25),
      pitch: Cesium.Math.toRadians(-32),
      roll: 0,
    },
  });

  // 3D 건물 (LOD1: Cesium OSM Buildings - Ion 자산)
  try {
    const buildingTileset = await Cesium.Cesium3DTileset.fromIonAssetId(96188);
    viewer.scene.primitives.add(buildingTileset);
  } catch (e) {
    console.warn("3D 건물 타일셋을 불러오지 못했습니다. Ion 토큰을 확인하세요.", e);
  }

  // 도로별 다양한 색상 (전송선, 전류 흐름)
  var roadColorPairs = [
    [new Cesium.Color(0.0, 0.83, 1.0, 0.9), new Cesium.Color(0.6, 1.0, 1.0, 0.95)],   // 시안
    [new Cesium.Color(0.72, 1.0, 0.0, 0.9), new Cesium.Color(1.0, 1.0, 0.7, 0.95)],   // 라임
    [new Cesium.Color(1.0, 0.4, 0.2, 0.9), new Cesium.Color(1.0, 0.9, 0.6, 0.95)],   // 오렌지
    [new Cesium.Color(0.9, 0.2, 0.9, 0.9), new Cesium.Color(1.0, 0.8, 1.0, 0.95)],     // 마젠타
    [new Cesium.Color(0.2, 0.9, 0.5, 0.9), new Cesium.Color(0.7, 1.0, 0.85, 0.95)],    // 민트
    [new Cesium.Color(1.0, 0.85, 0.0, 0.9), new Cesium.Color(1.0, 1.0, 0.85, 0.95)],   // 골드
    [new Cesium.Color(0.4, 0.6, 1.0, 0.9), new Cesium.Color(0.8, 0.9, 1.0, 0.95)],    // 하늘
    [new Cesium.Color(1.0, 0.35, 0.5, 0.9), new Cesium.Color(1.0, 0.85, 0.9, 0.95)],   // 코랄
    [new Cesium.Color(0.5, 1.0, 0.5, 0.9), new Cesium.Color(0.85, 1.0, 0.85, 0.95)],   // 연두
    [new Cesium.Color(0.7, 0.4, 1.0, 0.9), new Cesium.Color(0.9, 0.8, 1.0, 0.95)],     // 보라
  ];

  // 충주시 도로 데이터 (OpenStreetMap Overpass API)
  const CHUNGJU_BBOX = { south: 36.90, west: 127.82, north: 37.06, east: 128.05 };
  const ROAD_HEIGHT = 140; // 지형 위에 보이도록 고도(m)
  const LINE_GLOW_POWER = 0.1; // 글로우 테두리 두께 (0.1~0.6 권장, 클수록 두꺼움)

  function toCartesian(lon, lat, height) {
    return Cesium.Cartesian3.fromDegrees(lon, lat, height != null ? height : ROAD_HEIGHT);
  }

  async function fetchChungjuRoads() {
    var query = [
      "[out:json][timeout:30];",
      "way[\"highway\"~\"^(motorway|trunk|primary|secondary|tertiary)$\"](",
      CHUNGJU_BBOX.south + "," + CHUNGJU_BBOX.west + "," + CHUNGJU_BBOX.north + "," + CHUNGJU_BBOX.east,
      ");",
      "out geom;"
    ].join("");
    var endpoints = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter"
    ];
    var json = null;
    for (var e = 0; e < endpoints.length && !json; e++) {
      try {
        var res = await fetch(endpoints[e] + "?data=" + encodeURIComponent(query));
        if (res.ok) json = await res.json();
      } catch (err) { /* 다음 엔드포인트 시도 */ }
    }
    try {
      if (!json || !json.elements) return getFallbackChungjuRoads();
      var roads = [];
      for (var i = 0; i < json.elements.length; i++) {
        var way = json.elements[i];
        if (!way.geometry || way.geometry.length < 2) continue;
        var positions = [];
        for (var j = 0; j < way.geometry.length; j++) {
          var n = way.geometry[j];
          positions.push(toCartesian(n.lon, n.lat, ROAD_HEIGHT));
        }
        roads.push(positions);
      }
      return roads;
    } catch (e) {
      console.warn("충주 도로 데이터 로드 실패(Overpass API). 폴리라인 폴백 사용.", e);
      return getFallbackChungjuRoads();
    }
  }

  function getFallbackChungjuRoads() {
    var c = function (lon, lat) { return toCartesian(lon, lat, ROAD_HEIGHT); };
    return [
      [c(127.88, 36.99), c(127.91, 36.99), c(127.94, 36.985), c(127.97, 36.98), c(128.0, 36.975)],
      [c(127.92, 37.02), c(127.92, 36.99), c(127.92, 36.96), c(127.93, 36.94)],
      [c(127.88, 36.97), c(127.91, 36.97), c(127.94, 36.965), c(127.97, 36.96)],
      [c(127.90, 36.99), c(127.90, 36.97), c(127.90, 36.95)],
      [c(127.96, 36.99), c(127.96, 36.97), c(127.96, 36.95)],
    ];
  }

  var roadPositionsList = await fetchChungjuRoads();
  if (roadPositionsList.length === 0) roadPositionsList = getFallbackChungjuRoads();

  // 라인 위 파라미터(0~1) 위치에서의 3D 점 반환
  function positionAlongLine(positions, t, result) {
    var len = positions.length;
    if (len < 2) return positions[0] ? Cesium.Cartesian3.clone(positions[0], result) : result;
    var idx = Cesium.Math.clamp(t, 0, 1) * (len - 1);
    var i0 = Math.floor(idx);
    var i1 = Math.min(i0 + 1, len - 1);
    var local = idx - i0;
    return Cesium.Cartesian3.lerp(positions[i0], positions[i1], local, result || new Cesium.Cartesian3());
  }

  var FLOW_CYCLE_MS = 3000;
  var FLOW_SEGMENT_LENGTH = 0.2;
  var FLOW_POINTS = 12;
  var FLOW_PHASE_STEP = 0.12; // 도로마다 위상 밀어서 겹칠 때 동시에 넘어가는 것 방지

  function getFlowSegmentPositions(positions, phaseOffset, result) {
    if (!positions || positions.length < 2) return [];
    var t = (Date.now() / FLOW_CYCLE_MS + (phaseOffset || 0)) % 1;
    var out = result || [];
    out.length = 0;
    // 0~1 경계를 넘지 않도록: 끝에서는 구간을 짧게, 시작에서 다시 길게 (넘어갈 때 깜빡임 방지)
    var endP = t + FLOW_SEGMENT_LENGTH <= 1 ? t + FLOW_SEGMENT_LENGTH : 1;
    var startP = t;
    var segLen = endP - startP;
    if (segLen < 0.008) return out; // 극히 짧을 때만 생략
    var numPts = Math.max(2, Math.ceil((FLOW_POINTS + 1) * (segLen / FLOW_SEGMENT_LENGTH)));
    for (var i = 0; i <= numPts; i++) {
      var p = startP + (i / numPts) * segLen;
      out.push(Cesium.Cartesian3.clone(positionAlongLine(positions, p, new Cesium.Cartesian3())));
    }
    return out;
  }

  // 도로별 전송선(배경) + 전류 흐름 애니메이션 (색상 순환)
  for (var r = 0; r < roadPositionsList.length; r++) {
    var positions = roadPositionsList[r];
    if (positions.length < 2) continue;
    var lineColor = roadColorPairs[r % roadColorPairs.length][0];
    var flowColor = lineColor; // 전류 흐름은 해당 라인과 같은 색

    viewer.entities.add({
      name: "Road line " + r,
      polyline: {
        positions: positions,
        width: 15,
        material: new Cesium.PolylineGlowMaterialProperty({
          color: lineColor,
          glowPower: LINE_GLOW_POWER,
          taperPower: 0.8,
        }),
        clampToGround: false,
      },
    });

    (function (roadPositions, flowCol, phaseOffset) {
      viewer.entities.add({
        name: "Road flow " + r,
        polyline: {
          positions: new Cesium.CallbackProperty(function (time, result) {
            return getFlowSegmentPositions(roadPositions, phaseOffset, result);
          }, false),
          width:6,
          material: new Cesium.PolylineOutlineMaterialProperty({
            color: flowCol,
            outlineColor: flowCol,
            outlineWidth: 4,
          }),
          clampToGround: false,
        },
      });
    })(positions, flowColor, r * FLOW_PHASE_STEP);
  }

// 재생/일시정지 및 시계 제어
const clock = viewer.clock;
let isPlaying = false;

function updatePlayPauseIcon() {
  const iconPlay = document.querySelector("#btnPlayPause .icon-play");
  const iconPause = document.querySelector("#btnPlayPause .icon-pause");
  if (!iconPlay || !iconPause) return;
  iconPlay.style.display = isPlaying ? "none" : "block";
  iconPause.style.display = isPlaying ? "block" : "none";
}

var btnPlayPause = document.getElementById("btnPlayPause");
var btnRewind = document.getElementById("btnRewind");
var btnFastForward = document.getElementById("btnFastForward");
if (btnPlayPause) {
  btnPlayPause.addEventListener("click", () => {
    isPlaying = !isPlaying;
    clock.shouldAnimate = isPlaying;
    updatePlayPauseIcon();
  });
}
if (btnRewind) {
  btnRewind.addEventListener("click", () => {
    clock.multiplier = -2.0;
    clock.shouldAnimate = true;
    isPlaying = true;
    updatePlayPauseIcon();
  });
}
if (btnFastForward) {
  btnFastForward.addEventListener("click", () => {
    clock.multiplier = 2.0;
    clock.shouldAnimate = true;
    isPlaying = true;
    updatePlayPauseIcon();
  });
}

  updatePlayPauseIcon();
}

// ============================
// 대시보드 UI 상태 & 모의 데이터
// ============================

const uiState = {
  kpi: {
    genMW: 520,
    storageMWh: 720,
    effPct: 97.8,
    pf: 0.985,
    co2Kg: 11800,
  },
  alerts: [], // { id, type, severity, msg, detail, expiresAt }
  events: [], // { time, event, severity, section, value }
  severityFilter: "ALL",
};

const ALERT_TYPES = ["OVERLOAD", "VOLTAGE", "EFFICIENCY"];
const SEVERITIES = ["CRITICAL", "WARNING", "RESOLVED"];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// DOM 캐시
const dom = {
  kpiGenValue: document.getElementById("kpiGenValue"),
  kpiGenBar: document.getElementById("kpiGenBar"),
  kpiStorageValue: document.getElementById("kpiStorageValue"),
  kpiStorageBar: document.getElementById("kpiStorageBar"),
  kpiEffValue: document.getElementById("kpiEffValue"),
  kpiEffBar: document.getElementById("kpiEffBar"),
  kpiPfValue: document.getElementById("kpiPfValue"),
  kpiPfBar: document.getElementById("kpiPfBar"),
  kpiCo2Value: document.getElementById("kpiCo2Value"),
  kpiCo2Bar: document.getElementById("kpiCo2Bar"),
  leftGenValue: document.getElementById("leftGenValue"),
  leftGenBar: document.getElementById("leftGenBar"),
  leftStorageValue: document.getElementById("leftStorageValue"),
  leftStorageBar: document.getElementById("leftStorageBar"),
  overallStatusText: document.getElementById("overallStatusText"),
  overallUpdatedText: document.getElementById("overallUpdatedText"),
  statusSummaryText: document.getElementById("statusSummaryText"),
  alertList: document.getElementById("alertList"),
  eventTableBody: document.getElementById("eventTableBody"),
  filterChips: document.querySelectorAll(".filter-chip"),
  btnExport: document.getElementById("btnExport"),
  btnDetails: document.getElementById("btnDetails"),
};

function updateKpiValues() {
  const k = uiState.kpi;
  // 부드러운 랜덤 변동
  k.genMW = clamp(k.genMW + (Math.random() - 0.5) * 10, 480, 680);
  k.storageMWh = clamp(k.storageMWh + (Math.random() - 0.5) * 5, 650, 735);
  k.effPct = clamp(k.effPct + (Math.random() - 0.5) * 0.4, 95.0, 99.2);
  k.pf = clamp(k.pf + (Math.random() - 0.5) * 0.004, 0.96, 0.995);
  k.co2Kg = clamp(k.co2Kg + (Math.random() - 0.5) * 40, 11000, 14000);
}

function renderKpi() {
  const k = uiState.kpi;
  if (!dom.kpiGenValue) return; // UI가 없는 환경(테스트 등) 방어

  dom.kpiGenValue.textContent = k.genMW.toFixed(0);
  dom.kpiGenBar.style.width = `${(k.genMW / 680) * 100}%`;

  dom.kpiStorageValue.textContent = k.storageMWh.toFixed(0);
  dom.kpiStorageBar.style.width = `${(k.storageMWh / 735) * 100}%`;

  dom.kpiEffValue.textContent = k.effPct.toFixed(1);
  dom.kpiEffBar.style.width = `${((k.effPct - 95) / (99.2 - 95)) * 100}%`;

  dom.kpiPfValue.textContent = k.pf.toFixed(3);
  dom.kpiPfBar.style.width = `${((k.pf - 0.96) / (0.995 - 0.96)) * 100}%`;

  dom.kpiCo2Value.textContent = k.co2Kg.toFixed(0);
  dom.kpiCo2Bar.style.width = `${((k.co2Kg - 11000) / (14000 - 11000)) * 100}%`;

  // 좌측 요약 동기화
  dom.leftGenValue.textContent = k.genMW.toFixed(0);
  dom.leftGenBar.style.width = `${(k.genMW / 680) * 100}%`;
  dom.leftStorageValue.textContent = k.storageMWh.toFixed(0);
  dom.leftStorageBar.style.width = `${(k.storageMWh / 735) * 100}%`;

  // 상단 업데이트 시간
  const now = new Date();
  dom.overallUpdatedText.textContent = formatTime(now);
}

// 경보 및 이벤트 생성
let nextId = 1;

function pushEvent(event) {
  uiState.events.unshift(event);
  if (uiState.events.length > 30) {
    uiState.events.length = 30;
  }
}

function maybeGenerateRandomEvent() {
  const rand = Math.random();
  if (rand < 0.6) return; // 약 40% 확률로 이벤트 생성

  const now = new Date();
  const type = ALERT_TYPES[Math.floor(Math.random() * ALERT_TYPES.length)];
  const severity = Math.random() < 0.6 ? "WARNING" : "CRITICAL";

  let section = "";
  let value = "";
  let eventLabel = "";

  if (type === "OVERLOAD") {
    section = `구간 #${300 + Math.floor(Math.random() * 20)}`;
    value = `${(90 + Math.random() * 10).toFixed(1)} %`;
    eventLabel = "과부하";
  } else if (type === "VOLTAGE") {
    section = `구간 #${100 + Math.floor(Math.random() * 20)}`;
    value = `${(340 + Math.random() * 15).toFixed(1)} V`;
    eventLabel = "전압 편차";
  } else {
    section = `구간 #${200 + Math.floor(Math.random() * 20)}`;
    value = `${(88 + Math.random() * 6).toFixed(1)} %`;
    eventLabel = "효율 저하";
  }

  const evt = {
    id: nextId++,
    time: formatTime(now),
    event: eventLabel,
    severity,
    section,
    value,
    type,
  };

  pushEvent(evt);

  // 해당 타입의 알림 생성/갱신
  const durationSec = 10 + Math.floor(Math.random() * 10);
  const alert = {
    id: evt.id,
    type,
    severity,
    msg: `${eventLabel} 감지`,
    detail: `${section} · ${value}`,
    expiresAt: now.getTime() + durationSec * 1000,
  };

  // 기존 동일 타입 알림 교체
  uiState.alerts = uiState.alerts.filter((a) => a.type !== type);
  uiState.alerts.push(alert);
}

function updateAlertExpirations() {
  const nowTs = Date.now();
  uiState.alerts.forEach((a) => {
    if (a.severity !== "RESOLVED" && nowTs > a.expiresAt) {
      a.severity = "RESOLVED";
      a.msg = "정상 상태로 복구";

      pushEvent({
        id: nextId++,
        time: formatTime(new Date()),
        event: "경보 해제",
        severity: "RESOLVED",
        section: a.type === "OVERLOAD" ? "과부하 구간" : a.type === "VOLTAGE" ? "전압 구간" : "효율 구간",
        value: "정상",
        type: a.type,
      });
    }
  });
}

function renderAlerts() {
  if (!dom.alertList) return;
  const container = dom.alertList;
  container.innerHTML = "";

  // 항상 세 가지 타입을 표시하되, 없으면 RESOLVED 기본값
  ALERT_TYPES.forEach((type) => {
    const existing = uiState.alerts.find((a) => a.type === type);
    const severity = existing ? existing.severity : "RESOLVED";
    const li = document.createElement("li");
    li.className = `alert-item alert-item--${severity}`;

    const badge = document.createElement("span");
    badge.className = "alert-badge";
    badge.textContent =
      type === "OVERLOAD" ? "과부하" : type === "VOLTAGE" ? "전압편차" : "효율저하";

    const textWrap = document.createElement("div");
    textWrap.className = "alert-text";

    const label = document.createElement("p");
    label.className = "alert-label";
    label.textContent = existing ? existing.msg : "정상";

    const meta = document.createElement("p");
    meta.className = "alert-meta";
    meta.textContent = existing ? existing.detail : "현재 이상 없음";

    textWrap.appendChild(label);
    textWrap.appendChild(meta);
    li.appendChild(badge);
    li.appendChild(textWrap);
    container.appendChild(li);
  });
}

function renderEvents() {
  if (!dom.eventTableBody) return;
  const tbody = dom.eventTableBody;
  tbody.innerHTML = "";

  uiState.events
    .filter((e) => uiState.severityFilter === "ALL" || e.severity === uiState.severityFilter)
    .forEach((e) => {
      const tr = document.createElement("tr");

      const tdTime = document.createElement("td");
      tdTime.textContent = e.time;

      const tdEvent = document.createElement("td");
      tdEvent.textContent = e.event;

      const tdSeverity = document.createElement("td");
      const tag = document.createElement("span");
      tag.className = `severity-tag severity-tag--${e.severity}`;
      tag.textContent = e.severity;
      tdSeverity.appendChild(tag);

      const tdSection = document.createElement("td");
      tdSection.textContent = e.section;

      const tdValue = document.createElement("td");
      tdValue.textContent = e.value;

      tr.appendChild(tdTime);
      tr.appendChild(tdEvent);
      tr.appendChild(tdSeverity);
      tr.appendChild(tdSection);
      tr.appendChild(tdValue);

      tbody.appendChild(tr);
    });
}

function updateOverallStatus() {
  if (!dom.overallStatusText) return;

  let worst = "RESOLVED";
  uiState.alerts.forEach((a) => {
    if (a.severity === "CRITICAL") {
      worst = "CRITICAL";
    } else if (a.severity === "WARNING" && worst !== "CRITICAL") {
      worst = "WARNING";
    }
  });

  dom.overallStatusText.classList.remove(
    "status-pill--normal",
    "status-pill--warning",
    "status-pill--critical"
  );

  if (worst === "CRITICAL") {
    dom.overallStatusText.classList.add("status-pill--critical");
    dom.overallStatusText.textContent = "위험";
    dom.statusSummaryText.textContent =
      "일부 구간에서 과부하 또는 심각한 전압 편차가 감지되었습니다.";
  } else if (worst === "WARNING") {
    dom.overallStatusText.classList.add("status-pill--warning");
    dom.overallStatusText.textContent = "경고";
    dom.statusSummaryText.textContent =
      "일부 구간에서 전압 편차 또는 효율 저하 경향이 관측되고 있습니다.";
  } else {
    dom.overallStatusText.classList.add("status-pill--normal");
    dom.overallStatusText.textContent = "정상 운전";
    dom.statusSummaryText.textContent = "전체 계통이 정상 범위 내에서 운전 중입니다.";
  }
}

function initFiltersAndButtons() {
  if (dom.filterChips) {
    dom.filterChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const sev = chip.getAttribute("data-filter");
        uiState.severityFilter = sev || "ALL";
        dom.filterChips.forEach((c) => c.classList.remove("filter-chip--active"));
        chip.classList.add("filter-chip--active");
        renderEvents();
      });
    });
  }

  if (dom.btnExport) {
    dom.btnExport.addEventListener("click", () => {
      alert("리포트 내보내기 기능은 데모 모드입니다.");
    });
  }

  if (dom.btnDetails) {
    dom.btnDetails.addEventListener("click", () => {
      alert("상세 보기 기능은 데모 모드입니다.");
    });
  }
}

// UI 초기화
if (dom.kpiGenValue) {
  initFiltersAndButtons();
  renderKpi();
  renderAlerts();
  renderEvents();
  updateOverallStatus();

  setInterval(() => {
    updateKpiValues();
    maybeGenerateRandomEvent();
    updateAlertExpirations();
    renderKpi();
    renderAlerts();
    renderEvents();
    updateOverallStatus();
  }, 1000);
}
