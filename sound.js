// Web Audio API 기반 효과음(SFX) 매니저. <audio> 태그를 여러 개 만드는
// 방식 대신 Web Audio API만 쓴다. 사운드는 두 종류로 나뉜다:
//   A. 합성(synth) — 파일 없이 OscillatorNode로 코드에서 직접 만들어내는
//      짧은 UI 사운드(타이핑, 버튼 클릭, 솥 투입, 문 삐걱임).
//   B. 파일(file) — 질감이 중요한 자연음이라 나중에 실제 음원 파일로
//      교체할 예정인 것들(드래그 사각거림, 소멸 연출, BGM). 지금은 파일이
//      없으므로 재생 시도 시 조용히 무시된다.
// playSound(key)/playLoop(key)를 호출하는 쪽은 이게 합성인지 파일인지
// 몰라도 된다 — 아래에서 알아서 분기한다.
//
// 파일(B) 준비 시 참고: 효과음은 1초 이내로 짧게, OGG 또는 WebM 포맷을
// 권장한다(MP3보다 용량이 작다). 효과음 전체 합쳐서 200KB 이내를 목표로
// 한다(BGM은 예외).

// ---------- B. 파일 기반 사운드 경로 ----------
export const SOUND_PATHS = {
  // 문이 삐걱이며 열리는 소리(원래대로 유지).
  doorCreak: "./assets/sounds/effect-door.ogg",
  buttonClick: "./assets/sounds/effect-botton.ogg",
  settingsClick: "./assets/sounds/effect-click.ogg",
  // "들어가기" 버튼 자체의 클릭음(공용 buttonClick 대신 이걸 쓴다). 문
  // 삐걱임(doorCreak)과는 별개로, 같은 클릭에 둘 다 겹쳐 재생된다.
  enterClick: "./assets/sounds/effect-enter.ogg",
  paperDrag: "./assets/sounds/paper-drag.ogg",
  // 냄비가 등장할 때부터 부글부글 끓는 소리. 종이를 성공적으로 드래그해
  // 넣으면 멈춘다(main.js에서 loop로 재생하고 성공 시점에 stopLoop).
  boiling: "./assets/sounds/effect-boiling.ogg",
  // 종이(빈 종이)가 화면에 처음 나타날 때.
  paperAppear: "./assets/sounds/effect-paper.ogg",
  // 종이에 글 쓰는 중 나는 사각거림. 타이핑이 이어지는 동안 반복 재생하고
  // (source.loop = true라서 파일 길이를 넘겨도 끊김 없이 계속 반복된다),
  // 입력이 잠깐이라도 멈추면(main.js에서 디바운스) 자동으로 멈춘다.
  writing: "./assets/sounds/effect-write.ogg",
  effectEmberRise: "./assets/sounds/effect-magic-blight.ogg",
  effectBurst: "./assets/sounds/effect-magic-bomd.ogg",
  effectLightOverflow: "./assets/sounds/effect-magic-melt.ogg",
  // 배경음악. "들어가기"를 누르는 시점(최초 사용자 상호작용)에 재생을
  // 시작해서 계속 반복 재생한다.
  bgm: "./assets/sounds/background.ogg",
};

let audioCtx = null;
const buffers = {}; // key -> AudioBuffer (B 방식, 로드에 성공한 것만)
const activeLoops = {}; // key -> 현재 재생 중인 AudioBufferSourceNode(B 방식만 해당)
// 배경음악(bgm)과 그 외 모든 소리(효과음: 버튼 클릭, 타이핑, 종이 소리,
// 소멸 이펙트 등)를 독립적으로 켜고 끌 수 있도록 음소거 상태를 둘로
// 나눈다. bgm은 playLoop("bgm")으로만 재생되고, 그 외에는 전부 playSound나
// playLoop(그 외 키)로 재생되므로 "효과음" = bgm을 제외한 전부다.
let sfxMuted = false;
let bgmMuted = false;

// 전체 사운드의 기본 음량. 개별 소리마다 destination에 직접 연결하는 대신
// 전부 이 공용 게인 노드를 거치게 해서, 여기 값 하나만 바꾸면 모든
// 소리(합성 A + 파일 B)의 크기가 한 번에 조절된다.
const DEFAULT_VOLUME = 0.6;
let masterGain = null;

function getContext() {
  if (audioCtx) return audioCtx;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = DEFAULT_VOLUME;
    masterGain.connect(audioCtx.destination);
  } catch {
    audioCtx = null; // Web Audio API 자체를 못 쓰는 환경 — 이후 모든 재생은 조용히 무시된다.
  }
  return audioCtx;
}

// 브라우저는 사용자 상호작용 없이는 오디오 재생을 막는다. 온보딩의
// "들어가기" 클릭처럼 이 앱에서 첫 사용자 상호작용이 일어나는 시점에
// 호출해서 AudioContext를 생성/재개(resume)해둔다. 한 번 만든 컨텍스트는
// 계속 재사용한다(매번 새로 만들지 않는다).
export function resumeAudioContext() {
  const ctx = getContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

// B 방식(파일) 사운드를 미리 fetch + decodeAudioData 해서 캐싱한다. 개별
// 파일이 없거나 디코딩에 실패해도 그 사운드만 조용히 건너뛰고 나머지
// 로딩에는 영향을 주지 않는다. A 방식(합성) 사운드는 로딩이 필요 없다.
// 이 로딩이 끝나기 전에 playLoop("bgm")이 먼저 불릴 수 있어서(언어 선택은
// 페이지 진입 직후라 아직 디코딩 중일 수 있음), 진행 중인 로딩을
// playLoop에서 기다렸다가 재생을 시작할 수 있도록 이 Promise를 저장해둔다.
let loadPromise = null;

export function initSounds() {
  const ctx = getContext();
  if (!ctx) return Promise.resolve();
  loadPromise = Promise.all(
    Object.entries(SOUND_PATHS).map(async ([key, path]) => {
      try {
        const res = await fetch(path);
        if (!res.ok) return; // 아직 파일이 없음(플레이스홀더 단계) — 무시
        const arrayBuffer = await res.arrayBuffer();
        buffers[key] = await ctx.decodeAudioData(arrayBuffer);
      } catch {
        // 네트워크 오류·디코딩 실패 등 — 조용히 무시
      }
    })
  );
  return loadPromise;
}

// ---------- A. 오실레이터로 직접 합성하는 짧은 UI 사운드 ----------

// 재사용 가능한 기본 유틸: 지정한 파형/주파수/길이로 짧은 톤 하나를 만들어
// 재생한다. startFrequency/endFrequency를 함께 주면 재생하는 동안 주파수가
// 미끄러지듯 변한다(potDrop의 "위→아래로 떨어지는" 느낌에 사용). delay를
// 주면 지금부터 그만큼(초) 뒤에 시작하도록 예약한다 — 같은 호출 틱 안에서
// 여러 톤을 정확한 간격으로 겹쳐/이어서 재생할 때 쓴다(아래 playArpeggio).
// 시작/끝에 아주 짧은 볼륨 램프를 줘서 뚝 끊기는 클릭 잡음(pop)을 없앤다.
function playTone({
  frequency,
  startFrequency,
  endFrequency,
  duration,
  type = "square",
  gain = 0.15,
  delay = 0,
}) {
  if (sfxMuted) return;
  const ctx = getContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;

  const startAt = ctx.currentTime + delay;
  if (startFrequency != null && endFrequency != null) {
    osc.frequency.setValueAtTime(startFrequency, startAt);
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFrequency, 1), startAt + duration);
  } else {
    osc.frequency.setValueAtTime(frequency, startAt);
  }

  // 0에서 바로 exponentialRamp를 걸 수 없어서 아주 작은 값에서 시작한다.
  gainNode.gain.setValueAtTime(gain, startAt);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gainNode);
  gainNode.connect(masterGain);
  osc.start(startAt);
  osc.stop(startAt + duration);
}

// 마법 지팡이로 톡톡 두드리는 듯한 "반짝이는" 짧은 음 여러 개를 순서대로
// 이어 재생한다(아르페지오). potDrop의 "빨려들어간 뒤 반짝" 같은 잔향
// 플러리시나 doorCreak의 마법 기운 오버레이에 쓴다.
function playArpeggio(frequencies, { noteDuration = 0.05, gap = 0.03, type = "sine", gain = 0.08, startDelay = 0 } = {}) {
  frequencies.forEach((freq, i) => {
    playTone({
      frequency: freq,
      duration: noteDuration,
      type,
      gain,
      delay: startDelay + i * (noteDuration + gap),
    });
  });
}

// 종이가 솥에 들어갈 때: 훅 빨려들어가듯 음이 위→아래로 떨어진 뒤, 마법
// 솥이 반응하듯 짧게 반짝이는 상승 아르페지오가 뒤따른다.
function playPotDrop() {
  playTone({ startFrequency: 550, endFrequency: 150, duration: 0.18, type: "sine", gain: 0.16 });
  playArpeggio([700, 950, 1300], { noteDuration: 0.055, gap: 0.02, gain: 0.06, startDelay: 0.15 });
}

// key -> 합성 함수. 여기 등록된 키는 A방식(파일 불필요)으로 재생되고,
// 여기 없는 키는 SOUND_PATHS를 찾아 B방식(파일)으로 재생된다.
const SYNTH_SOUNDS = {
  potDrop: playPotDrop,
};

// ---------- 통합 재생 인터페이스 ----------
// 호출하는 쪽은 이 사운드가 합성(A)인지 파일(B)인지 몰라도 된다 — 키
// 이름만 넘기면 알아서 맞는 방식으로 재생된다.

export function playSound(key) {
  if (sfxMuted) return;
  const synthFn = SYNTH_SOUNDS[key];
  if (synthFn) {
    synthFn();
    return;
  }
  playFileOnce(key);
}

// 사운드별 기본 볼륨 배수(masterGain 위에 추가로 곱해지는 값). 1이면 다른
// 소리들과 같은 기준 볼륨, 그보다 작으면 그 소리만 더 조용하게 들린다.
// 여기 없는 키는 전부 1(배수 없음)로 취급한다.
const FILE_VOLUME = {
  doorCreak: 0.25,
  bgm: 0.25,
};

// 배수가 1이 아닌 소리만 개별 GainNode를 거치게 하고, 나머지는 지금처럼
// masterGain에 바로 연결한다(불필요한 노드를 늘리지 않는다).
function connectWithVolume(ctx, source, key) {
  const volume = FILE_VOLUME[key] ?? 1;
  if (volume === 1) {
    source.connect(masterGain);
    return;
  }
  const gainNode = ctx.createGain();
  gainNode.gain.value = volume;
  source.connect(gainNode);
  gainNode.connect(masterGain);
}

function playFileOnce(key) {
  const buffer = buffers[key];
  const ctx = audioCtx;
  if (!buffer || !ctx) return; // 파일이 없으면(B 방식 플레이스홀더 단계) 조용히 무시
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  connectWithVolume(ctx, source, key);
  source.start(0);
}

// 한 번만 재생하지만(반복 X) 끝나기 전에 중간에 멈출 수도 있는 사운드(냄비
// 소멸 연출 A/B/C처럼, 화면 연출이 사운드 파일보다 먼저 끝나면 거기 맞춰
// 소리도 뚝 끊어야 하는 경우). stopLoop(key)로 멈출 수 있도록 activeLoops에
// 등록해두되, loop는 켜지 않는다 — 끝까지 다 재생되면(멈추지 않아도) 스스로
// 끝나면서 activeLoops에서 자동으로 빠진다.
export function playStoppable(key) {
  if (sfxMuted) return;
  if (activeLoops[key]) stopLoopSource(key); // 같은 키로 이미 재생 중이면 새로 교체
  const buffer = buffers[key];
  const ctx = audioCtx;
  if (!buffer || !ctx) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(masterGain);
  source.onended = () => {
    if (activeLoops[key] === source) delete activeLoops[key];
  };
  source.start(0);
  activeLoops[key] = source;
}

// BGM은 음소거를 껐다 켜도 계속 흐르고 있어야 하는 사운드라, "재생 중"
// (activeLoops)과는 별개로 "재생되고 있어야 하는 의도"를 따로 기억해둔다
// (드래그 사각거림 같은 순간적인 루프는 이 의도 추적 대상이 아니다).
let bgmShouldPlay = false;

// 반복 재생이 필요한 사운드(종이 드래그 사각거림, 타이핑 사각거림, BGM).
// B방식(파일)에만 의미가 있다 — 합성(A) 사운드는 전부 한 번 재생하고 끝나는
// 짧은 톤이라 loop 대상이 아니다. source.loop = true라서 stopLoop(key)를
// 부를 때까지 파일이 끝나면 처음으로 되돌아가 계속 반복 재생된다.
// offset(초)을 주면 파일의 그 지점부터 재생을 시작한다(맨 앞부분을 건너뛰고
// 싶을 때 — 예: 타이핑 사각거림의 시작 0.3초는 건너뛰기). 이미 재생 중이면
// (activeLoops에 있으면) 무시되고 적용되지 않는다.
export async function playLoop(key, { offset = 0 } = {}) {
  const isBgm = key === "bgm";
  if (isBgm) bgmShouldPlay = true;
  if (isBgm ? bgmMuted : sfxMuted) return;
  if (SYNTH_SOUNDS[key]) return; // 합성 사운드는 반복 재생 대상이 아니다.
  if (activeLoops[key]) return; // 이미 재생 중이면 무시

  let buffer = buffers[key];
  if (!buffer && loadPromise) {
    // 언어 선택은 페이지 진입 직후라 이 시점엔 아직 파일 디코딩이 안
    // 끝났을 수 있다. 끝날 때까지 기다렸다가, 그사이 음소거되거나
    // 재생 의도가 취소되지(bgmShouldPlay) 않았는지 다시 확인한 뒤 재생한다.
    await loadPromise;
    buffer = buffers[key];
    if (isBgm ? bgmMuted : sfxMuted) return;
    if (isBgm && !bgmShouldPlay) return;
    if (activeLoops[key]) return;
  }

  const ctx = audioCtx;
  if (!buffer || !ctx) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  connectWithVolume(ctx, source, key);
  source.start(0, Math.min(offset, buffer.duration));
  activeLoops[key] = source;
}

function stopLoopSource(key) {
  const source = activeLoops[key];
  if (!source) return;
  try {
    source.stop();
  } catch {
    // 이미 멈춘 소스면 무시
  }
  delete activeLoops[key];
}

export function stopLoop(key) {
  if (key === "bgm") bgmShouldPlay = false;
  stopLoopSource(key);
}

// 효과음 음소거 토글(배경음악 제외 전부). 세션 동안만 유지되면 되므로
// localStorage에는 저장하지 않는다. 끄는 순간, 재생 중이던 효과음 반복
// 사운드(종이 사각거림 등)도 바로 멈춘다 — bgm은 손대지 않는다. 다시 켤 때
// 순간적인 효과음 루프는 자동으로 재개하지 않는다(다음 입력이 생기면
// 그때 다시 시작된다).
export function toggleSfxMuted() {
  sfxMuted = !sfxMuted;
  if (sfxMuted) {
    Object.keys(activeLoops)
      .filter((key) => key !== "bgm")
      .forEach(stopLoopSource);
  }
  return sfxMuted;
}

// 배경음악 음소거 토글. 끄면 bgm만 멈추고, 켜면(재생 의도가 남아있다면)
// 바로 이어서 재생한다. 효과음 쪽 상태와는 완전히 독립적이다.
export function toggleBgmMuted() {
  bgmMuted = !bgmMuted;
  if (bgmMuted) {
    stopLoopSource("bgm");
  } else if (bgmShouldPlay) {
    playLoop("bgm");
  }
  return bgmMuted;
}

export function isSfxMuted() {
  return sfxMuted;
}

export function isBgmMuted() {
  return bgmMuted;
}
