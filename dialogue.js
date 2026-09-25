// 대화창 타이핑 효과. 한 줄씩 순차 출력하고, 타이핑 중 탭하면 즉시 완성,
// 완성된 상태에서 탭하면 다음 줄로 넘어간다. 마지막 줄 이후 탭하면 onDone 호출.
// onLineStart(index)는 특정 줄이 나오기 시작할 때(예: 중간에 캐릭터 등장 같은
// 연출을 걸고 싶을 때) 쓸 수 있는 선택적 훅. lineDelayMs(index)는 그 줄의
// 타이핑을 몇 ms 늦춰서 시작할지 정하는 선택적 함수(연출 텀을 주고 싶을 때).
// onChar(charIndex)는 글자가 한 칸씩 출력될 때마다 불리는 선택적 훅(타이핑
// 사운드 등을 붙이고 싶을 때). 몇 글자마다 실제로 소리를 낼지 같은 정책은
// 이 모듈이 아니라 훅을 넘기는 쪽에서 결정한다(대화 엔진은 사운드를 모른다).

const TYPE_SPEED_MS = 40; // 글자당 간격. 30~50ms 권장.

export function createDialogueBox({
  textEl,
  hintEl,
  onDone,
  onLineStart,
  lineDelayMs,
  onChar,
}) {
  let lines = [];
  let lineIndex = 0;
  let charIndex = 0;
  let timerId = null;
  let typing = false;

  function typeNextChar() {
    const line = lines[lineIndex];
    charIndex += 1;
    textEl.textContent = line.slice(0, charIndex);
    if (onChar) onChar(charIndex);
    if (charIndex >= line.length) {
      finishTyping();
      return;
    }
    timerId = setTimeout(typeNextChar, TYPE_SPEED_MS);
  }

  function finishTyping() {
    clearTimeout(timerId);
    timerId = null;
    typing = false;
    textEl.textContent = lines[lineIndex];
    hintEl.hidden = false;
  }

  function startLine() {
    clearTimeout(timerId);
    charIndex = 0;
    typing = true;
    hintEl.hidden = true;
    textEl.textContent = "";
    if (onLineStart) onLineStart(lineIndex);
    const delay = TYPE_SPEED_MS + (lineDelayMs ? lineDelayMs(lineIndex) : 0);
    timerId = setTimeout(typeNextChar, delay);
  }

  function show(newLines) {
    lines = newLines;
    lineIndex = 0;
    startLine();
  }

  function tap() {
    if (typing) {
      finishTyping();
      return;
    }
    lineIndex += 1;
    if (lineIndex >= lines.length) {
      hintEl.hidden = true;
      onDone();
      return;
    }
    startLine();
  }

  // 지금 보여주고 있는 줄을 그대로(같은 줄 번호) 다른 언어 버전으로 즉시
  // 바꿔 보여준다. 타이핑 중이었어도 애니메이션 없이 바로 완성된 텍스트로
  // 전환한다(언어 설정을 바꾸는 도중 어색하게 다시 타이핑되지 않도록).
  // lineIndex가 이미 끝(마지막 줄 이후)까지 가 있었다면 새 배열의 마지막
  // 줄로 맞춰서 보여준다.
  function retext(newLines) {
    clearTimeout(timerId);
    timerId = null;
    typing = false;
    lines = newLines;
    const idx = Math.min(lineIndex, lines.length - 1);
    textEl.textContent = lines[idx];
    hintEl.hidden = false;
  }

  // 지금 진행 중인 타이핑을 완전히 멈춘다(onDone도 부르지 않는다). 대화를
  // 다 보여주지 않고 다른 화면으로 바로 건너뛰고 싶을 때(Skip 같은 기능)
  // 쓴다 — 멈추지 않으면 타이머가 백그라운드에서 계속 돌다가 나중에 혼자
  // 다음 줄로 넘어가거나 onDone을 다시 불러버릴 수 있다.
  function stop() {
    clearTimeout(timerId);
    timerId = null;
    typing = false;
  }

  return { show, tap, retext, stop };
}

// 한 줄짜리 단순 타이핑 효과. 다 타이핑되면(또는 클릭으로 건너뛰면)
// onComplete을 자동으로 한 번 호출한다. (다음 줄로 "넘어가는" 개념이 없는
// 온보딩 인트로 문구용)
export function createTypewriter({ textEl, text, onComplete, autoStart = true }) {
  let currentText = text;
  let timerId = null;
  let charIndex = 0;
  let done = false;

  function typeNextChar() {
    charIndex += 1;
    textEl.textContent = currentText.slice(0, charIndex);
    if (charIndex >= currentText.length) {
      complete();
      return;
    }
    timerId = setTimeout(typeNextChar, TYPE_SPEED_MS);
  }

  function complete() {
    clearTimeout(timerId);
    timerId = null;
    if (done) return;
    done = true;
    textEl.textContent = currentText;
    onComplete();
  }

  function restart() {
    clearTimeout(timerId);
    charIndex = 0;
    done = false;
    textEl.textContent = "";
    timerId = setTimeout(typeNextChar, TYPE_SPEED_MS);
  }

  function skip() {
    if (!done) complete();
  }

  // 지금 보여주는(또는 타이핑 중인) 문구를 다른 언어 버전으로 즉시 바꾼다.
  // 타이핑 중이었다면 애니메이션 없이 바로 완성된 새 텍스트로 전환하고,
  // 아직 onComplete이 안 불렸다면 그때 호출해 이후 흐름이 막히지 않게 한다.
  function retext(newText) {
    clearTimeout(timerId);
    timerId = null;
    currentText = newText;
    charIndex = currentText.length;
    textEl.textContent = currentText;
    const wasDone = done;
    done = true;
    if (!wasDone) onComplete();
  }

  // 화면에 지금 보여주고 있지 않을 때(다른 화면에 있는 동안 언어를 바꿨을
  // 때) 쓴다. 화면을 건드리지 않고 다음 restart()가 사용할 문구만 최신
  // 언어로 미리 갱신해둔다.
  function setText(newText) {
    currentText = newText;
  }

  if (autoStart) restart();

  return { skip, restart, retext, setText };
}
