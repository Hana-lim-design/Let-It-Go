// 방문/이야기 횟수 집계. 작성한 걱정 내용 자체는 어디에도 저장하지 않지만,
// 이 숫자 집계는 개인적인 내용을 담지 않으므로 그 약속과는 무관하다.
// localStorage에 저장해서 새로고침·재방문해도 값이 유지된다.

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

function readInt(key) {
  const v = parseInt(localStorage.getItem(key) ?? "0", 10);
  return Number.isFinite(v) ? v : 0;
}

// 저장된 "오늘" 날짜가 실제 오늘과 다르면(자정이 지났으면) Today만 0으로
// 되돌린다. Total/Stories는 건드리지 않는다.
function ensureTodayIsCurrent() {
  const storedDate = localStorage.getItem(KEY_TODAY_DATE);
  const currentDate = todayDateKey();
  if (storedDate !== currentDate) {
    localStorage.setItem(KEY_TODAY_DATE, currentDate);
    localStorage.setItem(KEY_TODAY_VISITS, "0");
  }
}

export function getStats() {
  ensureTodayIsCurrent();
  return {
    today: readInt(KEY_TODAY_VISITS),
    total: readInt(KEY_TOTAL_VISITS),
    stories: readInt(KEY_TOTAL_STORIES),
  };
}

// "들어가기"를 눌러 문을 여는 순간 호출한다. Today/Total을 함께 1 늘린다.
export function recordVisit() {
  ensureTodayIsCurrent();
  const today = readInt(KEY_TODAY_VISITS) + 1;
  const total = readInt(KEY_TOTAL_VISITS) + 1;
  localStorage.setItem(KEY_TODAY_VISITS, String(today));
  localStorage.setItem(KEY_TOTAL_VISITS, String(total));
  return { today, total, stories: readInt(KEY_TOTAL_STORIES) };
}

// 종이를 없애는 소멸 애니메이션이 실행되는 순간 호출한다. Stories만 1 늘린다.
export function recordStory() {
  const stories = readInt(KEY_TOTAL_STORIES) + 1;
  localStorage.setItem(KEY_TOTAL_STORIES, String(stories));
  return stories;
}

// 탭을 자정 너머로 계속 켜둔 채로 있는 경우까지 대비해, 다음 로컬 자정
// 시점에 Today를 0으로 리셋하는 타이머를 건다(새로고침 없이도 화면에 바로
// 반영되도록 onReset 콜백에 최신 값을 넘겨준다). 자정 경계 오차를 피하려고
// 5초 여유를 둔 뒤 스스로 다음 자정으로 다시 예약한다.
export function scheduleMidnightReset(onReset) {
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
      ensureTodayIsCurrent();
      onReset(getStats());
      scheduleNext();
    }, delay);
  }
  scheduleNext();
}
