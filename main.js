import { ASSETS } from "./assets.js";
import { burstFromRect, emitEmberRise, emitBurst, emitLightOverflow } from "./particles.js";
import { createDialogueBox, createTypewriter } from "./dialogue.js";
import { STRINGS } from "./i18n.js";
import {
  initSounds,
  playSound,
  playLoop,
  playStoppable,
  stopLoop,
  toggleSfxMuted,
  toggleBgmMuted,
  isSfxMuted,
  isBgmMuted,
  resumeAudioContext,
} from "./sound.js";
import { initStats, recordVisit, recordStory } from "./stats.js";

initSounds();

// 모든 버튼 클릭에 공통으로 짧은 클릭음을 준다. 개별 버튼 핸들러마다 따로
// 연결하지 않고 document 레벨에서 위임 처리해서, 새 버튼이 추가돼도 이
// 코드를 따로 손댈 필요가 없게 한다.
// settingsClick 효과음은 설정 버튼뿐 아니라 처음 언어 선택, 설정 창 안의
// 모든 클릭(언어 토글/효과음·배경음 토글/닫기), Skip 버튼까지 확장해서
// 쓴다 — 나머지 버튼은 기존 buttonClick을 그대로 쓴다.
// "고마워"(btn-restart)는 클릭음 없이 조용히 처리한다.
// "들어가기"(btn-enter)는 공용 buttonClick 대신 전용 enterClick을 쓴다 —
// 이 버튼 핸들러에서 따로 재생하는 문 삐걱임(doorCreak)과는 별개다.
const SETTINGS_STYLE_SOUND_IDS = new Set([
  "btn-lang-ko",
  "btn-lang-en",
  "btn-settings",
  "btn-dialog-skip",
]);
const NO_CLICK_SOUND_IDS = new Set(["btn-restart"]);
const CLICK_SOUND_OVERRIDES = { "btn-enter": "enterClick" };

document.addEventListener("click", (e) => {
  const button = e.target.closest("button");
  if (!button) return;
  if (NO_CLICK_SOUND_IDS.has(button.id)) return;
  if (CLICK_SOUND_OVERRIDES[button.id]) {
    playSound(CLICK_SOUND_OVERRIDES[button.id]);
    return;
  }
  const isSettingsStyle =
    SETTINGS_STYLE_SOUND_IDS.has(button.id) || button.closest("#settings-overlay");
  playSound(isSettingsStyle ? "settingsClick" : "buttonClick");
});

const STATE = {
  ONBOARDING: "onboarding",
  ROOM: "room",
  DESTROY: "destroy",
  RESULT: "result",
};

const screens = {
  [STATE.ONBOARDING]: document.getElementById("screen-onboarding"),
  [STATE.ROOM]: document.getElementById("screen-room"),
  [STATE.DESTROY]: document.getElementById("screen-destroy"),
  [STATE.RESULT]: document.getElementById("screen-result"),
};

const appEl = document.getElementById("app");
const screenLanguage = document.getElementById("screen-language");
const btnLangKo = document.getElementById("btn-lang-ko");
const btnLangEn = document.getElementById("btn-lang-en");
const btnSettings = document.getElementById("btn-settings");
const settingsBookLabel = document.getElementById("settings-book-label");
const btnMuteSfx = document.getElementById("btn-mute-sfx");
const settingsMuteSfxLabel = document.getElementById("settings-mute-sfx-label");
const btnMuteBgm = document.getElementById("btn-mute-bgm");
const settingsMuteBgmLabel = document.getElementById("settings-mute-bgm-label");
const btnFeedback = document.getElementById("btn-feedback");
const settingsCopyright = document.getElementById("settings-copyright");
const btnFeedbackPotion = document.getElementById("btn-feedback-potion");
const feedbackPotionLabel = document.getElementById("feedback-potion-label");
const statTodayEl = document.getElementById("stat-today");
const statTotalEl = document.getElementById("stat-total");
const statStoriesEl = document.getElementById("stat-stories");
const visitStatsEl = document.getElementById("visit-stats");
const settingsOverlay = document.getElementById("settings-overlay");
const settingsPanelBg = document.getElementById("settings-panel-bg");
const btnSettingsClose = document.getElementById("btn-settings-close");
const langToggle = document.getElementById("lang-toggle");
const btnSettingsLangKo = document.getElementById("btn-settings-lang-ko");
const btnSettingsLangEn = document.getElementById("btn-settings-lang-en");
const settingsTitle = document.getElementById("settings-title");
const screenOnboarding = document.getElementById("screen-onboarding");
const doorStage = document.querySelector(".door-stage");
const sceneVeil = document.getElementById("scene-veil");
const btnEnter = document.getElementById("btn-enter");
const onboardingDialogBox = document.getElementById("onboarding-dialog-box");
const onboardingDialogText = document.getElementById("onboarding-dialog-text");
const onboardingPrivacyNotice = document.getElementById("onboarding-privacy-notice");
const imgDoor = document.getElementById("door");
const imgDoorVoid = document.getElementById("door-void");
const imgDoorLeaf = document.getElementById("door-leaf");
const imgRoom = document.getElementById("img-room");
const imgWizard = document.getElementById("img-wizard");
const imgMemo = document.getElementById("img-memo");
const imgCauldron = document.getElementById("img-cauldron");
const cauldronOutline = document.getElementById("cauldron-target-outline");
const dragMemo = document.getElementById("img-drag-memo");
const destroyFlash = document.getElementById("destroy-flash");
const roomParticleCanvas = document.getElementById("room-particle-canvas");
const memoStage = document.getElementById("memo-stage");
const dialogBox = document.getElementById("dialog-box");
const dialogText = document.getElementById("dialog-text-content");
const dialogNextHint = document.getElementById("dialog-next-hint");
const btnDialogSkip = document.getElementById("btn-dialog-skip");

// 문구가 대화창(안내판) 높이보다 길어지면 overflow-y:auto로 스크롤이
// 생기는데, 타이핑/문구 교체가 일어날 때마다 항상 최신 줄이 보이도록
// 맨 아래로 자동으로 내려준다. 타이핑 엔진(dialogue.js)의 char-by-char
// 출력이든, main.js 곳곳의 직접 textContent 대입이든 전부 이 한 곳에서
// 커버하기 위해 MutationObserver로 두 대화창을 감시한다.
function keepDialogBoxScrolledToBottom(boxEl) {
  const observer = new MutationObserver(() => {
    boxEl.scrollTop = boxEl.scrollHeight;
  });
  observer.observe(boxEl, { childList: true, characterData: true, subtree: true });
}
keepDialogBoxScrolledToBottom(onboardingDialogBox);
keepDialogBoxScrolledToBottom(dialogBox);
const inputArea = document.getElementById("input-area");
const inputText = document.getElementById("input-text");
const inputError = document.getElementById("input-error");
const btnSubmit = document.getElementById("btn-submit");
const submitNotice = document.getElementById("submit-notice");
const destroyWrap = document.getElementById("destroy-text-wrap");
const destroyTop = document.getElementById("destroy-text-top");
const destroyBottom = document.getElementById("destroy-text-bottom");
const particleCanvas = document.getElementById("particle-canvas");
const resultMessage = document.getElementById("result-message");
const btnRestart = document.getElementById("btn-restart");

imgDoor.src = ASSETS.door;
imgDoorVoid.src = ASSETS.doorVoid;
imgDoorLeaf.src = ASSETS.doorLeaf;
imgRoom.src = ASSETS.room;
imgWizard.src = ASSETS.wizard;
imgMemo.src = ASSETS.memo;
imgCauldron.src = ASSETS.cauldron;
dragMemo.src = ASSETS.dragMemo;
settingsPanelBg.src = ASSETS.settingsPanel;

let current = STATE.ONBOARDING;

function setState(next) {
  screens[current].classList.remove("active");
  current = next;
  screens[current].classList.add("active");
  if (next === STATE.ONBOARDING) {
    screenOnboarding.classList.remove("opening");
    doorStage.classList.remove("zooming");
    sceneVeil.style.opacity = "0";
    btnEnter.classList.remove("is-visible");
    onboardingTypewriter?.restart();
  }
}

// ---------- 언어 선택 ----------
// 맨 처음 진입 화면. 테두리·이미지 없이 언어 버튼 두 개만 보여주고, 고른
// 언어로 이후 모든 문구(대사·버튼·placeholder·alt 등)를 채운 뒤에야
// #app(테두리 포함 실제 게임 화면)을 드러낸다.

let currentLang = "ko";
let onboardingTypewriter = null;

// 방문/이야기 횟수. Firebase가 설정돼 있으면 모든 기기·방문자가 공유하는
// 값을 실시간 구독하고(누가 어디서 올리든 즉시 반영), 아니면 이 기기의
// localStorage 값으로 대체된다(stats.js가 알아서 고른다).
let visitStats = { today: 0, total: 0, stories: 0 };

function renderStats() {
  const t = STRINGS[currentLang];
  statTodayEl.textContent = `${t.statTodayLabel} ${visitStats.today}`;
  statTotalEl.textContent = `${t.statTotalLabel} ${visitStats.total}`;
  statStoriesEl.textContent = `${t.statStoriesLabel} ${visitStats.stories}`;
}

initStats((stats) => {
  visitStats = stats;
  renderStats();
});

function applyLanguage(lang) {
  currentLang = lang;
  const t = STRINGS[lang];
  document.documentElement.lang = lang;

  btnEnter.textContent = t.enterButton;
  btnSubmit.textContent = t.submitButton;
  btnRestart.textContent = t.restartButton;

  inputText.placeholder = t.inputPlaceholder;
  inputError.textContent = t.inputError;
  submitNotice.textContent = t.submitNotice;
  onboardingPrivacyNotice.textContent = t.onboardingPrivacyNotice;

  imgDoor.alt = t.doorAlt;
  imgRoom.alt = t.roomAlt;
  imgWizard.alt = t.wizardAlt;
  imgCauldron.alt = t.cauldronAlt;
  dragMemo.alt = t.dragMemoAlt;
  imgMemo.alt = t.memoAlt;

  onboardingDialogBox.setAttribute("aria-label", t.skipAria);
  dialogBox.setAttribute("aria-label", t.nextAria);
  settingsTitle.textContent = t.settingsTitle;
  btnSettings.setAttribute("aria-label", t.settingsTitle);
  settingsBookLabel.textContent = t.settingsTitle;
  btnDialogSkip.textContent = t.skipButtonLabel;
  btnFeedback.textContent = t.feedbackLabel;
  settingsCopyright.textContent = t.copyrightNotice;
  btnFeedbackPotion.setAttribute("aria-label", t.feedbackLabel);
  feedbackPotionLabel.textContent = t.feedbackTitle;
  renderStats();

  const isEn = lang === "en";
  langToggle.classList.toggle("is-en", isEn);
  langToggle.classList.toggle("is-ko", !isEn);
  btnSettingsLangKo.classList.toggle("is-active", !isEn);
  btnSettingsLangEn.classList.toggle("is-active", isEn);

  updateMuteButtons();
}

// ---------- 사운드 / 음소거 ----------
// 효과음(배경음악을 제외한 전부)과 배경음악을 독립적으로 켜고 끌 수 있게
// 토글을 두 개로 나눴다. 버튼에 보이는 라벨("효과음"/"배경음")은 항상
// 고정이고, on/off 상태는 슬라이드 손잡이 위치(is-on)와 ON/OFF 텍스트,
// aria-pressed/aria-label로 표시한다.

function updateMuteButtons() {
  const t = STRINGS[currentLang];

  const sfxOn = !isSfxMuted();
  btnMuteSfx.classList.toggle("is-on", sfxOn);
  btnMuteSfx.setAttribute("aria-pressed", String(sfxOn));
  btnMuteSfx.setAttribute("aria-label", sfxOn ? t.sfxMuteAria : t.sfxUnmuteAria);
  settingsMuteSfxLabel.textContent = t.sfxLabel;

  const bgmOn = !isBgmMuted();
  btnMuteBgm.classList.toggle("is-on", bgmOn);
  btnMuteBgm.setAttribute("aria-pressed", String(bgmOn));
  btnMuteBgm.setAttribute("aria-label", bgmOn ? t.bgmMuteAria : t.bgmUnmuteAria);
  settingsMuteBgmLabel.textContent = t.bgmLabel;
}

btnMuteSfx.addEventListener("click", () => {
  toggleSfxMuted();
  updateMuteButtons();
});

btnMuteBgm.addEventListener("click", () => {
  toggleBgmMuted();
  updateMuteButtons();
});

const BGM_START_DELAY_MS = 600; // 언어 선택 직후 바로 터지지 않고 살짝 뒤에 시작

function selectLanguage(lang) {
  // 언어 버튼 클릭이 이 앱에서 최초의 사용자 상호작용이므로, 여기서
  // AudioContext를 깨운다(자동재생 정책 때문에 사용자 제스처 안에서 바로
  // 호출해야 한다). 배경음악 자체는 살짝 뒤에 시작한다.
  resumeAudioContext();
  setTimeout(() => playLoop("bgm"), BGM_START_DELAY_MS);

  applyLanguage(lang);
  screenLanguage.classList.add("hidden");
  appEl.classList.add("is-ready");

  if (!onboardingTypewriter) {
    onboardingTypewriter = createTypewriter({
      textEl: onboardingDialogText,
      text: STRINGS[currentLang].onboardingLine,
      onComplete: () => {
        btnEnter.classList.add("is-visible");
      },
    });
  } else {
    onboardingTypewriter.restart();
  }
}

btnLangKo.addEventListener("click", () => selectLanguage("ko"));
btnLangEn.addEventListener("click", () => selectLanguage("en"));

// ---------- 설정(언어 변경) ----------
// 게임 중간에 톱니바퀴로 언어를 바꾸면, 버튼/placeholder 같은 고정 문구뿐
// 아니라 지금 화면에 떠 있는 대사·문구도 그 자리에서 바로 새 언어로
// 바뀌어야 한다. 어떤 화면·어떤 단계인지에 따라 "지금 보여주고 있는 텍스트"
// 출처가 다르므로(온보딩 타자기, 방 대화, 전달 후 대화, 드래그 안내 문구,
// 결과 문구) 하나씩 확인해서 그것만 즉시 다시 그려준다.
function refreshCurrentText() {
  const t = STRINGS[currentLang];
  // 지금 온보딩 화면이 아니어도(예: 결과 화면에서 언어를 바꾼 뒤 "고마워"로
  // 되돌아가는 경우) 다음 restart()가 최신 언어로 나오도록 문구를 미리
  // 갱신해둔다. 온보딩 화면을 보고 있는 중이면 그 자리에서 바로 다시 그린다.
  onboardingTypewriter?.setText(t.onboardingLine);
  if (current === STATE.ONBOARDING) {
    onboardingTypewriter?.retext(t.onboardingLine);
  } else if (current === STATE.ROOM) {
    if (dialogAdvanceLocked) {
      // 냄비 투입 단계: 대화창이 아니라 고정 안내 문구를 직접 넣어둔 상태.
      dialogText.textContent = t.dragPrompt;
    } else if (activeDialogue === postSubmitDialogue) {
      postSubmitDialogue.retext(t.postSubmitLines);
    } else {
      roomDialogue.retext(t.roomLines);
    }
  } else if (current === STATE.RESULT) {
    resultMessage.textContent = t.resultMessage;
  }
}

function changeLanguage(lang) {
  if (lang === currentLang) return;
  applyLanguage(lang);
  refreshCurrentText();
}

function openSettings() {
  settingsOverlay.classList.remove("hidden");
}

function closeSettings() {
  settingsOverlay.classList.add("hidden");
}

btnSettings.addEventListener("click", openSettings);
btnSettingsClose.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", (e) => {
  if (e.target === settingsOverlay) closeSettings(); // 바깥(배경) 클릭만 닫기
});
// 토글이라 고르자마자 창이 닫히지 않는다 — 눌렀을 때 슬라이드가 움직이는
// 걸 보여주고, 계속 바꿔보거나 다른 설정도 만질 수 있게 열린 채로 둔다.
// 닫기는 X 버튼이나 바깥 클릭으로.
btnSettingsLangKo.addEventListener("click", () => {
  changeLanguage("ko");
});
btnSettingsLangEn.addEventListener("click", () => {
  changeLanguage("en");
});

// ---------- ONBOARDING ----------

const DOOR_OPEN_MS = 840; // 기존 700ms에서 20% 느리게

onboardingDialogBox.addEventListener("click", () => onboardingTypewriter?.skip());
onboardingDialogBox.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    onboardingTypewriter?.skip();
  }
});

const VEIL_FADE_IN_MS = 500; // 서서히 암전(빨려들어감)
const VEIL_FADE_OUT_MS = 300; // 암전 걷고 다음 화면 노출

btnEnter.addEventListener("click", () => {
  // AudioContext/배경음악은 이미 언어 선택 시점에 시작됐다. 혹시 몰라 한 번
  // 더 불러도 안전하다(이미 켜져 있으면 아무 일도 안 함).
  resumeAudioContext();
  if (screenOnboarding.classList.contains("opening")) return;
  screenOnboarding.classList.add("opening");
  playSound("doorCreak");
  recordVisit();
  setTimeout(() => {
    // 문이 다 열린 뒤: 문 안쪽으로 빨려들어가듯 확대 + 서서히 암전
    doorStage.classList.add("zooming");
    sceneVeil.style.transitionDuration = `${VEIL_FADE_IN_MS}ms`;
    sceneVeil.style.opacity = "1";
    setTimeout(() => {
      setState(STATE.ROOM);
      inputArea.hidden = true;
      btnSubmit.disabled = true;
      btnSubmit.classList.remove("is-visible");
      submitNotice.classList.remove("is-visible");
      inputText.disabled = false;
      inputText.value = "";
      clearTimeout(writingSoundStopTimer);
      stopLoop("writing");
      stopLoop("boiling");
      imgWizard.classList.remove("is-visible");
      memoStage.classList.remove("is-visible");
      settingsBookLabel.classList.remove("is-hidden");
      feedbackPotionLabel.classList.remove("is-hidden");
      visitStatsEl.classList.remove("is-hidden");
      imgCauldron.classList.remove("is-visible");
      resetDragMemo();
      dialogAdvanceLocked = false;
      activeDialogue = roomDialogue;
      // 처음 플레이할 때는 대사를 다 보여줘야 하니 Skip을 숨기고, 한 번
      // 완주한 뒤 다시 시작할 때만 보여준다.
      btnDialogSkip.classList.toggle("is-visible", hasSeenAllDialogueOnce);
      roomDialogue.show(STRINGS[currentLang].roomLines);
      sceneVeil.style.transitionDuration = `${VEIL_FADE_OUT_MS}ms`;
      sceneVeil.style.opacity = "0";
    }, VEIL_FADE_IN_MS);
  }, DOOR_OPEN_MS);
});

// ---------- ROOM ----------

// roomLines 맨 앞의 분위기 묘사 줄("은은한 달빛 아래...")을 삭제하면서
// 전체 줄 번호가 하나씩 당겨져, 이 인덱스도 3에서 2로 같이 조정했다(ko/en
// 둘 다 같은 구조를 유지해야 이 인덱스 하나로 두 언어 모두 맞는다).
const WIZARD_APPEAR_LINE_INDEX = 2; // "캐릭터 등장" 이후 이어지는 첫 줄
const WIZARD_LINE_DELAY_MS = 500; // 캐릭터 등장 후 그 줄 문구가 뜨기까지 텀
const MEMO_REVEAL_STAGGER_MS = 400; // 종이 등장 → 입력창 노출 간격
// style.css의 .memo-stage.is-visible이 쓰는 dissolve-in 애니메이션 길이와
// 맞춘다 — 종이가 다 나타나는 시점에 효과음도 같이 멈춘다.
const PAPER_APPEAR_ANIM_MS = 600;

// 방 대화(roomDialogue)가 정상적으로 끝났을 때도, Skip으로 건너뛸 때도
// 똑같이 종이 작성 화면을 드러낸다.
function revealMemoStage() {
  btnDialogSkip.classList.remove("is-visible");
  memoStage.classList.add("is-visible");
  // 종이가 나타나는 동안만 재생하고, 다 나타나면(애니메이션 종료 시점)
  // 자동으로 멈춘다 — 파일이 더 길어도 남아서 계속 흐르지 않는다.
  playStoppable("paperAppear");
  setTimeout(() => stopLoop("paperAppear"), PAPER_APPEAR_ANIM_MS);
  settingsBookLabel.classList.add("is-hidden"); // 종이 위에 겹쳐 보이지 않게
  feedbackPotionLabel.classList.add("is-hidden");
  visitStatsEl.classList.add("is-hidden");
  setTimeout(() => {
    inputArea.hidden = false;
  }, MEMO_REVEAL_STAGGER_MS);
}

const roomDialogue = createDialogueBox({
  textEl: dialogText,
  hintEl: dialogNextHint,
  onLineStart: (index) => {
    if (index === WIZARD_APPEAR_LINE_INDEX) {
      imgWizard.classList.add("is-visible");
    }
  },
  lineDelayMs: (index) =>
    index === WIZARD_APPEAR_LINE_INDEX ? WIZARD_LINE_DELAY_MS : 0,
  onDone: revealMemoStage,
});

// 한 번이라도 끝까지(결과 화면까지) 플레이해서 모든 대사를 본 뒤에
// "다시 시작"하면, 방 대화 화면에 Skip 버튼이 나타나 바로 종이 작성
// 화면으로 건너뛸 수 있다. 세션 동안만 유지되면 되므로 저장하지 않는다.
let hasSeenAllDialogueOnce = false;

btnDialogSkip.addEventListener("click", () => {
  roomDialogue.stop();
  btnDialogSkip.classList.remove("is-visible");
  revealMemoStage();
});

// 전달하기를 누른 뒤 마법사가 다시 나와 짧게 이어가는 대화. 같은 대화창
// (dialog-box)을 이어서 쓴다. 모든 줄이 다른 대화와 동일하게 탭으로 넘어간다.

const postSubmitDialogue = createDialogueBox({
  textEl: dialogText,
  hintEl: dialogNextHint,
  // 예전에는 여기서 "이야기를 없앤다" 버튼을 보여주고 눌러야 다음으로
  // 넘어갔지만, 버튼을 없애면서 대사가 끝나면 바로 냄비 단계로 넘어간다.
  onDone: showCauldron,
});

// dialog-box는 흐름 단계에 따라 roomDialogue → postSubmitDialogue 순으로
// 서로 다른 대화 인스턴스를 이어서 쓴다. 탭/키보드 입력은 항상 "현재
// 활성" 인스턴스로만 전달한다.
let activeDialogue = roomDialogue;

// 냄비 투입 단계로 넘어가면 이 대화창은 안내 문구만 고정으로 보여주는
// 용도로 바뀌고, 더 이상 다음 줄로 "넘기는" 대상이 아니게 된다(그 상태에서
// 탭하면 대화 인스턴스가 끝난 줄 인덱스를 다시 넘기려 해서 UI가 잘못
// 재노출될 수 있다). 이 플래그로 그 시점 이후의 탭/키보드 입력을 막는다.
let dialogAdvanceLocked = false;

dialogBox.addEventListener("click", () => {
  if (dialogAdvanceLocked) return;
  activeDialogue.tap();
});
dialogBox.addEventListener("keydown", (e) => {
  if (dialogAdvanceLocked) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    activeDialogue.tap();
  }
});

const MIN_INPUT_LENGTH = 10; // 이 글자 수 이상이어야 전달하기 버튼 활성화

// 한글(및 CJK)은 영어보다 한 글자에 담기는 정보/차지하는 폭이 커서, 그냥
// 글자 수로만 세면 같은 글자 수라도 한글 쪽이 체감상 훨씬 길게 느껴진다.
// 그래서 한글은 가중치 2, 그 외(영어·숫자·공백·문장부호 등)는 1로 세서
// 실제 체감 분량이 언어에 상관없이 비슷해지도록 한다.
const HANGUL_PATTERN =
  /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힣ힰ-퟿]/;
const HANGUL_WEIGHT = 2;
const DEFAULT_WEIGHT = 1;
// 지금 입력 박스 높이(종이 여백에 맞춘 고정 크기) 기준으로 실측해보면
// 가중치 약 1000~1100부터 박스 안에 다 안 들어가고 스크롤이 생긴다.
// 예전 600이면 최대로 채워도 스크롤 없이 항상 다 들어가 버려서 "길면
// 스크롤" 동작이 사실상 발동하지 않았다. 그 한계보다 넉넉히 위로 잡아서,
// 박스 크기는 그대로 두고 최대치까지 쓰면 자연스럽게 스크롤이 생기게 한다.
const INPUT_WEIGHT_LIMIT = 1500;

function computeWeightedLength(text) {
  let total = 0;
  for (const ch of text) {
    total += HANGUL_PATTERN.test(ch) ? HANGUL_WEIGHT : DEFAULT_WEIGHT;
  }
  return total;
}

// 입력 중 가중치 예산을 넘으면, 넘기 직전까지만 남기고 잘라낸다.
function clampToWeightLimit(text, limit) {
  let total = 0;
  let cut = text.length;
  for (let i = 0; i < text.length; i++) {
    total += HANGUL_PATTERN.test(text[i]) ? HANGUL_WEIGHT : DEFAULT_WEIGHT;
    if (total > limit) {
      cut = i;
      break;
    }
  }
  return text.slice(0, cut);
}

// ---------- 냄비 드래그 투입 ----------
// 1단계: 드래그(또는 탭) → 솥과 겹치는지 판정 → 성공하면 다음 단계로.
// 실제 소멸 연출(A/B/C)은 2~3단계에서 채워 넣을 자리이고, 지금은 자리만
// 잡아두는 임시 처리(살짝 사라졌다 결과 화면으로 이동)로 흐름만 연결한다.

const CAULDRON_APPEAR_DELAY_MS = 400; // 냄비가 뜬 뒤 메모지가 나타나기까지 텀
const DRAG_MOVE_THRESHOLD = 4; // 이보다 적게 움직이면 "탭"으로 취급(접근성 대체 경로)

let dragState = null;

function resetDragMemo() {
  dragState = null;
  stopLoop("paperDrag");
  dragMemo.classList.remove("is-visible", "dragging", "ember-bounce", "burst-suck");
  imgCauldron.classList.remove("impact-pulse");
  cauldronOutline.classList.remove("is-active");
  destroyFlash.classList.remove("flashing");
  appEl.classList.remove("screen-shake");
  dragMemo.style.left = "";
  dragMemo.style.top = "";
  dragMemo.style.transform = "";
  dragMemo.style.opacity = "";
}

function returnDragMemoHome() {
  dragMemo.classList.remove("dragging");
  cauldronOutline.classList.remove("is-active");
  dragMemo.style.left = "";
  dragMemo.style.top = "";
  dragMemo.style.transform = "";
}

// imgCauldron은 배경 전체를 덮는 이미지라 getBoundingClientRect()가 화면
// 대부분을 차지한다. 그 전체를 히트 영역으로 쓰면 종이의 제자리(홈 포지션)
// 조차 이미 겹친 것으로 판정돼 버려서(드래그 없이 탭만 해도 성공 처리되는
// 버그), 실제로 그려진 솥 부분(그림을 픽셀 단위로 실측한 비율)만 별도
// 영역으로 잡아 종이의 "중심"이 그 안에 들어왔을 때만 겹친 것으로 본다.
function getCauldronDropZone() {
  const r = imgCauldron.getBoundingClientRect();
  return {
    left: r.left + r.width * 0.3,
    right: r.left + r.width * 0.72,
    top: r.top + r.height * 0.48,
    bottom: r.top + r.height * 0.92,
  };
}

function isOverCauldron() {
  const rect = dragMemo.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const zone = getCauldronDropZone();
  return cx >= zone.left && cx <= zone.right && cy >= zone.top && cy <= zone.bottom;
}

dragMemo.addEventListener("pointerdown", (e) => {
  if (!dragMemo.classList.contains("is-visible")) return;
  dragMemo.setPointerCapture(e.pointerId);
  const rect = dragMemo.getBoundingClientRect();
  dragState = {
    pointerId: e.pointerId,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    startClientX: e.clientX,
    startClientY: e.clientY,
    moved: false,
  };
  dragMemo.classList.add("dragging");
  playLoop("paperDrag");
});

dragMemo.addEventListener("pointermove", (e) => {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  const dx = e.clientX - dragState.startClientX;
  const dy = e.clientY - dragState.startClientY;
  if (Math.abs(dx) > DRAG_MOVE_THRESHOLD || Math.abs(dy) > DRAG_MOVE_THRESHOLD) {
    dragState.moved = true;
  }

  const parentRect = dragMemo.parentElement.getBoundingClientRect();
  const left = e.clientX - dragState.offsetX - parentRect.left;
  const top = e.clientY - dragState.offsetY - parentRect.top;
  dragMemo.style.left = `${left}px`;
  dragMemo.style.top = `${top}px`;

  // 이동 중 미세하게 구겨지는 느낌: 스케일/회전을 아주 살짝 랜덤하게.
  const scale = (0.95 + Math.random() * 0.1).toFixed(3);
  const rotate = ((Math.random() - 0.5) * 10).toFixed(2); // -5deg ~ 5deg
  dragMemo.style.transform = `scale(${scale}) rotate(${rotate}deg)`;

  // 솥과 겹치는 동안은 판정 영역에 테두리를 표시해서 "여기 넣을 수 있다"는
  // 피드백을 준다(이미지 색은 그대로 두고 테두리만).
  cauldronOutline.classList.toggle("is-active", isOverCauldron());
});

dragMemo.addEventListener("pointerup", (e) => {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  // 실제로 드래그해서 냄비와 겹친 경우에만 투입 성공. 그냥 탭만 하거나
  // 냄비 밖에 놓으면 아무 일도 일어나지 않고 제자리로 돌아간다.
  const overlapping = isOverCauldron();
  dragState = null;
  stopLoop("paperDrag");

  if (overlapping) {
    handleMemoDropSuccess();
  } else {
    returnDragMemoHome();
  }
});

dragMemo.addEventListener("pointercancel", () => {
  dragState = null;
  stopLoop("paperDrag");
  returnDragMemoHome();
});

// ---------- 소멸 연출 (3단계: A, B에 이어 C 추가) ----------
// 각 함수는 (onComplete) => void 형태로, 연출이 다 끝나면 onComplete을 호출한다.

const EMBER_BOUNCE_MS = 500; // style.css의 ember-bounce-shrink 재생 시간과 맞춘다
const BURST_SUCK_MS = 300; // style.css의 burst-suck-in 재생 시간과 맞춘다
const LIGHT_OVERFLOW_MS = 2800; // particles.js의 emitLightOverflow 기본 duration과 맞춘다

// A. 불티 상승: 종이가 통통 튀듯 작아져 사라진 뒤, 솥 위쪽에서 불티가
// 천천히 떠오르며 옅어진다. (공통 규칙: 파티클은 항상 위/바깥쪽으로만)
function effectEmberRise(onComplete) {
  dragMemo.classList.remove("dragging");
  cauldronOutline.classList.remove("is-active");
  dragMemo.classList.add("ember-bounce");

  const cauldronRect = imgCauldron.getBoundingClientRect();
  const spawnRect = {
    x: cauldronRect.left + cauldronRect.width * 0.26,
    y: cauldronRect.top + cauldronRect.height * 0.42,
    width: cauldronRect.width * 0.48,
    height: cauldronRect.height * 0.22,
  };

  setTimeout(() => {
    dragMemo.classList.remove("is-visible", "ember-bounce");
    dragMemo.style.opacity = "0";

    // 종이가 다 사라진 이 시점부터 효과음을 재생하고, 연출이 끝나면
    // (onDone) 소리도 같이 끊는다 — 파일이 연출보다 길어도 남지 않는다.
    playStoppable("effectEmberRise");

    // 종이가 들어가는 순간 잠깐 밝게 터뜨려서 임팩트를 준다.
    destroyFlash.classList.remove("flashing");
    void destroyFlash.offsetWidth; // 애니메이션을 강제로 재시작(리플로우)
    destroyFlash.classList.add("flashing");

    // 냄비 자체도 같은 순간 짧게 밝아졌다 돌아오며 "반응"하는 느낌을 준다.
    imgCauldron.classList.remove("impact-pulse");
    void imgCauldron.offsetWidth;
    imgCauldron.classList.add("impact-pulse");

    emitEmberRise(roomParticleCanvas, spawnRect, {
      duration: 1500,
      onDone: () => {
        imgCauldron.classList.remove("is-visible", "impact-pulse");
        destroyFlash.classList.remove("flashing");
        stopLoop("effectEmberRise");
        onComplete();
      },
    });
  }, EMBER_BOUNCE_MS);
}

// B. 터뜨리기: 종이가 한 점으로 빨려들어가듯 훅 줄어든 뒤, 그 자리에서
// 수백 개의 입자가 사방으로 터졌다가 위로 흩어지며 사라진다. 화면이
// 아주 짧게 흔들려 임팩트를 더한다. A보다 짧고 강렬한 느낌.
function effectBurst(onComplete) {
  dragMemo.classList.remove("dragging");
  cauldronOutline.classList.remove("is-active");
  dragMemo.classList.add("burst-suck");

  setTimeout(() => {
    dragMemo.classList.remove("is-visible", "burst-suck");
    dragMemo.style.opacity = "0";

    // 종이가 다 사라진 이 시점부터 효과음을 재생하고, 연출이 끝나면
    // (onDone) 소리도 같이 끊는다.
    playStoppable("effectBurst");

    // 종이를 어디서 놓았든, 폭죽은 항상 냄비 가운데(입구)에서 터진다.
    const cauldronRect = imgCauldron.getBoundingClientRect();
    const burstPoint = {
      x: cauldronRect.left + cauldronRect.width * 0.5,
      y: cauldronRect.top + cauldronRect.height * 0.6,
    };

    destroyFlash.classList.remove("flashing");
    void destroyFlash.offsetWidth;
    destroyFlash.classList.add("flashing");

    imgCauldron.classList.remove("impact-pulse");
    void imgCauldron.offsetWidth;
    imgCauldron.classList.add("impact-pulse");

    appEl.classList.remove("screen-shake");
    void appEl.offsetWidth;
    appEl.classList.add("screen-shake");

    emitBurst(roomParticleCanvas, burstPoint, {
      duration: 1500,
      onDone: () => {
        imgCauldron.classList.remove("is-visible", "impact-pulse");
        destroyFlash.classList.remove("flashing");
        appEl.classList.remove("screen-shake");
        stopLoop("effectBurst");
        onComplete();
      },
    });
  }, BURST_SUCK_MS);
}

// C. 빛바래며 사라지기: 종이가 일렁이며 옅어져 사라지고, 동시에 냄비
// 가장자리에서 은은한 빛이 천천히 새어나온다. A/B보다 느리고 차분해서
// 임팩트 플래시나 화면 흔들림은 넣지 않는다.
function effectLightOverflow(onComplete) {
  dragMemo.classList.remove("dragging");
  cauldronOutline.classList.remove("is-active");

  // 지금부터는 <img>가 아니라 캔버스가 이 그림을 대신 그리므로, 실제
  // 요소는 바로 감춘다. getBoundingClientRect()는 드래그 중 남은 회전/
  // 스케일까지 반영된 실제 화면 위치를 준다.
  const paperRect = dragMemo.getBoundingClientRect();
  const cauldronRect = imgCauldron.getBoundingClientRect();
  dragMemo.classList.remove("is-visible");
  dragMemo.style.opacity = "0";

  // 종이가 다 사라진 이 시점부터 효과음을 재생하고, 연출이 끝나면(onDone)
  // 소리도 같이 끊는다.
  playStoppable("effectLightOverflow");

  emitLightOverflow(roomParticleCanvas, {
    paperImage: dragMemo,
    paperRect: {
      x: paperRect.left,
      y: paperRect.top,
      width: paperRect.width,
      height: paperRect.height,
    },
    cauldronRect: {
      left: cauldronRect.left,
      top: cauldronRect.top,
      width: cauldronRect.width,
      height: cauldronRect.height,
    },
    duration: LIGHT_OVERFLOW_MS,
    onDone: () => {
      imgCauldron.classList.remove("is-visible");
      stopLoop("effectLightOverflow");
      onComplete();
    },
  });
}

// A, B, C 모두 사용자 확인 및 승인 완료. 최종 랜덤 풀.
const destroyEffects = [effectEmberRise, effectBurst, effectLightOverflow];

function handleMemoDropSuccess() {
  // is-visible을 바로 지워서 pointerdown 가드가 추가 조작을 막게 한다.
  dragMemo.classList.remove("is-visible");
  stopLoop("boiling");
  playSound("potDrop");
  // 드래그가 성공한 순간부터 결과 화면으로 넘어가기 전까지, 안내 문구
  // 대신 이 문구를 계속 보여준다(dialogAdvanceLocked라 탭해도 안 바뀐다).
  dialogText.textContent = STRINGS[currentLang].afterDropMessage;
  recordStory();
  const effect = destroyEffects[Math.floor(Math.random() * destroyEffects.length)];
  effect(() => enterResult());
}

// 전달하기를 누르면: 종이를 치우고 냄비 등장 → 잠깐 뒤 드래그용 메모지 노출.
function showCauldron() {
  memoStage.classList.remove("is-visible");
  settingsBookLabel.classList.remove("is-hidden");
  feedbackPotionLabel.classList.remove("is-hidden");
  visitStatsEl.classList.remove("is-hidden");
  imgCauldron.classList.add("is-visible");
  // 성공적으로 드래그해 넣기 전까지(handleMemoDropSuccess에서 멈춘다)
  // 부글부글 끓는 소리가 반복 재생된다.
  playLoop("boiling");

  // 이 시점부터는 대화창이 다음 줄로 "넘어가는" 용도가 아니라 안내 문구를
  // 고정으로 보여주는 용도로 바뀐다.
  dialogAdvanceLocked = true;
  dialogNextHint.hidden = true;
  dialogText.textContent = STRINGS[currentLang].dragPrompt;

  setTimeout(() => {
    resetDragMemo();
    dragMemo.classList.add("is-visible");
  }, CAULDRON_APPEAR_DELAY_MS);
}

btnSubmit.addEventListener("click", () => {
  const text = inputText.value.trim();
  if (text.length < MIN_INPUT_LENGTH) {
    inputError.hidden = false;
    return;
  }
  inputError.hidden = true;
  btnSubmit.disabled = true;
  // disabled만으로는 pointer-events:auto가 남아(is-visible 클래스가 그것을
  // 켠다) 보이지 않는 버튼이 화면의 다른 요소(대화창 등) 클릭을 계속
  // 가로챌 수 있다. 클래스도 같이 지워서 완전히 비활성화한다.
  btnSubmit.classList.remove("is-visible");
  submitNotice.classList.remove("is-visible");
  inputText.disabled = true;

  clearTimeout(writingSoundStopTimer);
  stopLoop("writing");

  memoStage.classList.remove("is-visible");
  settingsBookLabel.classList.remove("is-hidden");
  feedbackPotionLabel.classList.remove("is-hidden");
  visitStatsEl.classList.remove("is-hidden");

  // 마법사가 다시 등장하는 느낌을 주기 위해 디졸브 애니메이션을 새로 재생.
  imgWizard.classList.remove("is-visible");
  void imgWizard.offsetWidth; // 리플로우로 애니메이션 강제 재시작
  imgWizard.classList.add("is-visible");

  activeDialogue = postSubmitDialogue;
  postSubmitDialogue.show(STRINGS[currentLang].postSubmitLines);
});

// 글자를 입력하는 동안 사각거리는 효과음을 반복 재생하다가, 입력이 잠깐
// 멈추면(이 시간 동안 새 입력이 없으면) 자동으로 멈춘다. playLoop는
// source.loop = true로 틀기 때문에, 파일 길이가 다 돼도 계속 입력 중이면
// 끊기지 않고 처음부터 이어서 반복된다 — 별도 처리가 필요 없다.
// 원본 파일의 시작 0.3초는 건너뛰고 그 지점부터 재생한다.
const WRITING_SOUND_STOP_DELAY_MS = 500;
const WRITING_SOUND_START_OFFSET_S = 0.3;
let writingSoundStopTimer = null;

function stopWritingSoundSoon() {
  clearTimeout(writingSoundStopTimer);
  writingSoundStopTimer = setTimeout(() => {
    stopLoop("writing");
  }, WRITING_SOUND_STOP_DELAY_MS);
}

inputText.addEventListener("input", (e) => {
  if (!inputError.hidden) inputError.hidden = true;

  if (computeWeightedLength(inputText.value) > INPUT_WEIGHT_LIMIT) {
    inputText.value = clampToWeightLimit(inputText.value, INPUT_WEIGHT_LIMIT);
  }

  const meetsMinLength = inputText.value.trim().length >= MIN_INPUT_LENGTH;
  btnSubmit.disabled = !meetsMinLength;
  if (meetsMinLength) {
    btnSubmit.classList.add("is-visible");
    submitNotice.classList.add("is-visible");
  } else {
    btnSubmit.classList.remove("is-visible");
    submitNotice.classList.remove("is-visible");
  }

  // 백스페이스 등 글자를 지우는 입력이면 사각거림을 바로 멈춘다(쓰는
  // 소리가 지우는 동작에는 안 어울려서). 글자를 쓰는 입력일 때만 재생한다.
  const isDeleting = (e.inputType || "").startsWith("delete");
  if (isDeleting) {
    clearTimeout(writingSoundStopTimer);
    stopLoop("writing");
  } else {
    playLoop("writing", { offset: WRITING_SOUND_START_OFFSET_S });
    stopWritingSoundSoon();
  }
});

// ---------- DESTROY ----------

function enterDestroy(text) {
  // 종이는 #app 밖의 별도 레이어라 화면 전환과 무관하게 남아있으므로 직접 치운다.
  memoStage.classList.remove("is-visible");

  destroyTop.textContent = text;
  destroyBottom.textContent = text;
  destroyWrap.classList.remove("tearing");
  destroyWrap.style.display = "";

  setState(STATE.DESTROY);

  // 다음 프레임에 애니메이션 클래스를 붙여 트랜지션이 확실히 재생되게 한다.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const rect = destroyWrap.getBoundingClientRect();
      destroyWrap.classList.add("tearing");

      setTimeout(() => {
        destroyWrap.style.display = "none";
        burstFromRect(particleCanvas, rect, {
          onDone: () => enterResult(),
        });
      }, 600);
    });
  });
}

// ---------- RESULT ----------

function enterResult() {
  inputText.value = "";
  resultMessage.textContent = STRINGS[currentLang].resultMessage;
  hasSeenAllDialogueOnce = true;
  setState(STATE.RESULT);
}

let restarting = false;

btnRestart.addEventListener("click", () => {
  if (restarting) return;
  restarting = true;
  // 문 장면으로 넘어갈 때와 같은 암전 디졸브로 처음 화면으로 돌아간다.
  sceneVeil.style.transitionDuration = `${VEIL_FADE_IN_MS}ms`;
  sceneVeil.style.opacity = "1";
  setTimeout(() => {
    sceneVeil.style.transitionDuration = `${VEIL_FADE_OUT_MS}ms`;
    setState(STATE.ONBOARDING); // 내부에서 opacity를 0으로 되돌려 암전이 걷힌다.
    // 처음 화면으로 돌아갈 때 배경음악도 처음부터 다시 재생한다(계속
    // 흐르던 지점에서 이어지지 않고 새로 시작).
    stopLoop("bgm");
    playLoop("bgm");
    restarting = false;
  }, VEIL_FADE_IN_MS);
});
