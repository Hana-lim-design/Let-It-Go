// 방문/이야기 횟수 집계. 작성한 걱정 내용 자체는 어디에도 저장하지 않지만,
// 이 숫자 집계는 개인적인 내용을 담지 않으므로 그 약속과는 무관하다.
//
// firebase-config.js에 실제 프로젝트 설정을 채워두면 Firebase Realtime
// Database를 통해 웹/모바일 등 모든 기기·모든 방문자가 공유하는 값을 실시간으로
// 반영한다(누가 어디서 카운트를 올리든 그 순간 모든 화면에 반영됨). 설정을
// 아직 안 채웠으면(placeholder 그대로면) 이 기기에만 저장되는 localStorage
// 방식으로 조용히 대체된다 — 앱이 깨지지 않는다.
import { FIREBASE_CONFIG } from "./firebase-config.js";

const KEY_TOTAL_VISITS = "letItGo_totalVisits";
const KEY_TODAY_VISITS = "letItGo_todayVisits";
const KEY_TODAY_DATE = "letItGo_todayDate";
const KEY_TOTAL_STORIES = "letItGo_totalStories";

// 기기의 로컬 자정 기준으로 날짜가 바뀌었는지 비교하기 위한 키(YYYY-MM-DD).
function todayDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// firebase-config.js를 아직 실제 값으로 안 채웠으면(placeholder 그대로면)
// Firebase를 아예 시도하지 않는다.
function isFirebaseConfigured() {
  return Boolean(
    FIREBASE_CONFIG &&
      FIREBASE_CONFIG.apiKey &&
      FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY" &&
      FIREBASE_CONFIG.databaseURL
  );
}

// ---------- localStorage 방식(기기별, 기존 방식) ----------

function readInt(key) {
  const v = parseInt(localStorage.getItem(key) ?? "0", 10);
  return Number.isFinite(v) ? v : 0;
}

function ensureTodayIsCurrent() {
  const storedDate = localStorage.getItem(KEY_TODAY_DATE);
  const currentDate = todayDateKey();
  if (storedDate !== currentDate) {
    localStorage.setItem(KEY_TODAY_DATE, currentDate);
    localStorage.setItem(KEY_TODAY_VISITS, "0");
  }
}

function getLocalStats() {
  ensureTodayIsCurrent();
  return {
    today: readInt(KEY_TODAY_VISITS),
    total: readInt(KEY_TOTAL_VISITS),
    stories: readInt(KEY_TOTAL_STORIES),
  };
}

function recordLocalVisit() {
  ensureTodayIsCurrent();
  localStorage.setItem(KEY_TODAY_VISITS, String(readInt(KEY_TODAY_VISITS) + 1));
  localStorage.setItem(KEY_TOTAL_VISITS, String(readInt(KEY_TOTAL_VISITS) + 1));
}

function recordLocalStory() {
  localStorage.setItem(KEY_TOTAL_STORIES, String(readInt(KEY_TOTAL_STORIES) + 1));
}

// 탭을 자정 너머로 계속 켜둔 채로 있어도, 새로고침 없이 Today가 0으로
// 바로 반영되게 한다(로컬 모드 전용 — Firebase 모드는 누군가의 다음 방문이
// 트랜잭션 안에서 자동으로 리셋하고, 그 값이 실시간 구독으로 모두에게 퍼진다).
function scheduleLocalMidnightReset(onReset) {
  function scheduleNext() {
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      5
    );
    const delay = nextMidnight.getTime() - now.getTime();
    setTimeout(() => {
      onReset(getLocalStats());
      scheduleNext();
    }, delay);
  }
  scheduleNext();
}

// ---------- Firebase Realtime Database 방식(전역 공유, 실시간) ----------

let firebaseApp = null;
let statsRef = null;

function getFirebaseStatsRef() {
  if (statsRef) return statsRef;
  // index.html에서 firebase-app-compat.js / firebase-database-compat.js를
  // 먼저 불러와서 전역 firebase 네임스페이스를 만들어둔다(이 모듈은 그걸 쓴다).
  firebaseApp = window.firebase.initializeApp(FIREBASE_CONFIG);
  statsRef = firebaseApp.database().ref("stats");
  return statsRef;
}

function normalizeSnapshotValue(val) {
  const today = todayDateKey();
  const storedTodayDate = val?.today?.date;
  return {
    today: storedTodayDate === today ? val?.today?.count || 0 : 0,
    total: val?.total || 0,
    stories: val?.stories || 0,
  };
}

function recordFirebaseVisit() {
  const ref = getFirebaseStatsRef();
  const today = todayDateKey();
  ref.transaction((current) => {
    const next = current || {};
    if (!next.today || next.today.date !== today) {
      next.today = { date: today, count: 0 };
    }
    next.total = (next.total || 0) + 1;
    next.today.count = (next.today.count || 0) + 1;
    return next;
  });
}

function recordFirebaseStory() {
  const ref = getFirebaseStatsRef();
  ref.transaction((current) => {
    const next = current || {};
    next.stories = (next.stories || 0) + 1;
    return next;
  });
}

function subscribeFirebaseStats(onUpdate) {
  const ref = getFirebaseStatsRef();
  ref.on("value", (snapshot) => {
    onUpdate(normalizeSnapshotValue(snapshot.val()));
  });
}

// ---------- 공개 API: 위 두 방식을 감춘 단일 인터페이스 ----------

const useFirebase = isFirebaseConfigured();

// 로컬(기기별) 모드에서는 Firebase의 실시간 구독이 없어서, record* 호출 뒤에
// 이 모듈이 직접 onUpdate를 다시 불러줘야 화면이 갱신된다. initStats에서
// 등록해둔다.
let localOnUpdate = null;

// 시작할 때 한 번, 그리고 값이 바뀔 때마다(파이어베이스 모드에서는 나를
// 포함한 누구든 어디서 카운트를 올리든) onUpdate(stats)가 불린다.
export function initStats(onUpdate) {
  if (useFirebase) {
    subscribeFirebaseStats(onUpdate);
  } else {
    localOnUpdate = onUpdate;
    onUpdate(getLocalStats());
    scheduleLocalMidnightReset(onUpdate);
  }
}

// "들어가기"를 눌러 문을 여는 순간 호출한다. Today/Total을 함께 1 늘린다.
// 결과는 initStats의 onUpdate 콜백으로 비동기 반영된다(리턴값 없음).
export function recordVisit() {
  if (useFirebase) {
    recordFirebaseVisit();
  } else {
    recordLocalVisit();
    localOnUpdate?.(getLocalStats());
  }
}

// 종이를 없애는 소멸 애니메이션이 실행되는 순간 호출한다. Stories만 1 늘린다.
export function recordStory() {
  if (useFirebase) {
    recordFirebaseStory();
  } else {
    recordLocalStory();
    localOnUpdate?.(getLocalStats());
  }
}
