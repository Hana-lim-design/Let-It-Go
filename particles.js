// Canvas 2D 파티클 이펙트.
// burstFromRect: 사각형 파편이 흩어지는 기본 버전.
// emitPoofSmoke: 한 지점에서 "펑" 하고 사방으로 퍼지는 연기 뭉치.
// emitEmberRise: 영역 위쪽으로 천천히 떠오르며 사라지는 불티(도트 사각형).
// 나중에 이펙트 종류를 늘릴 때는 이런 형태의 함수를 추가하면 된다.

export function burstFromRect(canvas, rect, options = {}) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  function resizeCanvas() {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  const count = options.count || 70;
  const colors = options.colors || ["#ffffff", "#cbd5ff", "#8f9dff", "#ffd166"];
  const duration = options.duration || 1200;

  const particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: rect.left + Math.random() * rect.width,
      y: rect.top + Math.random() * rect.height,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 1.4) * 5,
      size: 3 + Math.random() * 5,
      rotation: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }

  let start = null;

  function frame(ts) {
    if (start === null) start = ts;
    const elapsed = ts - start;
    const alpha = Math.max(0, 1 - elapsed / duration);

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (const p of particles) {
      p.vy += 0.12;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vr;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }

    if (elapsed < duration) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      window.removeEventListener("resize", resizeCanvas);
      if (options.onDone) options.onDone();
    }
  }

  requestAnimationFrame(frame);
}

// 한 지점에서 "펑" 하고 사방으로 퍼지는 연기 뭉치. burstFromRect처럼
// 중력으로 떨어지지 않고, 바깥으로 퍼지던 속도가 마찰로 줄어들면서 서서히
// 위로(연기처럼) 떠오르다 옅어져 사라진다. options.image(이미 로드된
// HTMLImageElement, 정사각형 도트 연기 한 장)를 회전/크기만 바꿔가며 찍어
// 그린다 — 픽셀아트 그림체와 맞추기 위해 매끈한 원 대신 이 이미지를 쓴다.
export function emitPoofSmoke(canvas, point, options = {}) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  function resizeCanvas() {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  const count = options.count || 5;
  const duration = options.duration || 800;
  const image = options.image;
  const imageReady = !!(image && image.complete && image.naturalWidth > 0);

  // 겹치는 반투명 도트 이미지가 많고 각자 제멋대로 회전까지 하면, 알파
  // 가장자리끼리 겹겹이 섞이면서 뭉개져 매끈한 뭉게구름처럼 보여 픽셀아트
  // 느낌이 사라진다. 그래서 개수는 적게, 회전은 살짝만, 불투명도는 높게
  // 유지해서 한 장 한 장이 또렷하게 보이도록 한다.
  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.8 + Math.random() * 2.2;
    particles.push({
      x: point.x,
      y: point.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 6 + Math.random() * 8,
      rotation: (Math.random() - 0.5) * 0.5,
      life: 0,
      maxLife: duration * (0.7 + Math.random() * 0.3),
    });
  }

  let start = null;

  function frame(ts) {
    if (start === null) start = ts;
    const elapsed = ts - start;

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.imageSmoothingEnabled = false;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += 16;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.vy -= 0.06; // 퍼지는 힘이 죽으면서 연기처럼 위로 떠오름
      p.x += p.vx;
      p.y += p.vy;

      const t = p.life / p.maxLife;
      if (t >= 1) {
        particles.splice(i, 1);
        continue;
      }
      const d = p.size * (1 + t) * 2; // 지름, 시간이 갈수록 커짐

      ctx.save();
      ctx.globalAlpha = (1 - t * t) * 0.95;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      if (imageReady) {
        ctx.drawImage(image, -d / 2, -d / 2, d, d);
      } else {
        // 이미지가 아직 안 불려왔을 때를 대비한 대체 표현.
        ctx.fillStyle = "#dcd0f5";
        ctx.beginPath();
        ctx.arc(0, 0, d / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (elapsed < duration || particles.length > 0) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      window.removeEventListener("resize", resizeCanvas);
      if (options.onDone) options.onDone();
    }
  }

  requestAnimationFrame(frame);
}

// 소멸 연출 A(불티 상승)용. rect 영역 안에서 랜덤하게 태어난 작은 도트가
// 항상 위쪽으로만 천천히 떠오르며(옆으로는 아주 살짝만) 옅어져 사라진다.
// 원 대신 정수 좌표에 딱 맞춘 작은 정사각형을 단색으로 찍어서, 작은
// 크기에서도 매끈해 보이지 않고 도트 느낌이 유지되게 한다.
export function emitEmberRise(canvas, rect, options = {}) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  function resizeCanvas() {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  const count = options.count || 45 + Math.floor(Math.random() * 26); // 45~70
  const duration = options.duration || 1500;
  const spawnUntil = options.spawnUntil ?? duration * 0.45;
  // 밝은 흰색~노란색 위주로, 기존 냄비 그림의 보라색 반짝임과 확실히
  // 대비되게 잡는다.
  const colors = options.colors || [
    "#fffdf0",
    "#fff3c2",
    "#ffe38a",
    "#ffd166",
    "#ff9d4d",
  ];

  const particles = [];
  let spawned = 0;

  function spawnOne(elapsedAtSpawn) {
    // 5개 중 1개 꼴로, 문 장면에 이미 쓰던 것과 같은 십자 스파클 모양으로
    // 그려서 더 화려하고 "마법같은" 인상을 준다. 나머지는 "멀리 있는" 흐리고
    // 작은 먼지와 "가까이 있는" 진하고 큰 도트로 나눠서, 개수를 더 늘리지
    // 않아도 레이어감(원근감)으로 더 풍성해 보이게 한다.
    const roll = Math.random();
    const isSparkle = roll < 0.22;
    const isFar = !isSparkle && roll < 0.6;

    let size;
    let alphaMul;
    if (isSparkle) {
      size = 7 + Math.round(Math.random() * 5);
      alphaMul = 1;
    } else if (isFar) {
      size = 2 + Math.round(Math.random() * 1.5);
      alphaMul = 0.5 + Math.random() * 0.15;
    } else {
      size = 4 + Math.round(Math.random() * 4);
      alphaMul = 0.85 + Math.random() * 0.15;
    }

    particles.push({
      x: rect.x + Math.random() * rect.width,
      y: rect.y + Math.random() * (rect.height || 1),
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(isFar ? 0.3 + Math.random() * 0.6 : 0.4 + Math.random() * 0.9), // 항상 위쪽
      size,
      alphaMul,
      isSparkle,
      life: 0,
      // 남은 시간(= duration - 스폰 시점) 안에서만 살도록 잡아서, 늦게
      // 태어난 파티클이 duration을 넘겨 오래 살아남는 일이 없게 한다.
      maxLife: Math.max(200, duration - elapsedAtSpawn) * (0.6 + Math.random() * 0.4),
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }

  let start = null;
  let lastSpawn = 0;

  function frame(ts) {
    if (start === null) start = ts;
    const elapsed = ts - start;

    if (
      elapsed < spawnUntil &&
      spawned < count &&
      elapsed - lastSpawn > spawnUntil / count
    ) {
      spawnOne(elapsed);
      spawned += 1;
      lastSpawn = elapsed;
    }

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += 16;
      p.vy -= 0.0015; // 아주 살짝 더 위로(부력이 붙는 느낌)
      p.x += p.vx;
      p.y += p.vy;

      const t = p.life / p.maxLife;
      if (t >= 1) {
        particles.splice(i, 1);
        continue;
      }
      // 살짝 페이드인 후 나머지 구간에서 서서히 페이드아웃.
      const alpha = (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85) * p.alphaMul;
      const cx = Math.round(p.x);
      const cy = Math.round(p.y);

      if (p.isSparkle) {
        // 스파클 뒤로 살짝 잔상(꼬리)을 남겨서 위로 솟구치는 느낌을 강조한다.
        // 실제 이전 프레임 위치를 저장하는 대신, 속도 방향으로 그라디언트를
        // 그려서 가볍게 흉내낸다.
        const tailLen = p.size * 2.4;
        const tailThick = Math.max(1, Math.round(p.size / 3));
        const grad = ctx.createLinearGradient(cx, cy, cx, cy + tailLen);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = Math.max(0, alpha) * 0.5;
        ctx.fillStyle = grad;
        ctx.fillRect(cx - Math.round(tailThick / 2), cy, tailThick, tailLen);

        // 십자(+) 모양 스파클: 가는 가로줄 + 세로줄을 겹쳐서 그린다.
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = p.color;
        const arm = p.size;
        const thick = Math.max(1, Math.round(p.size / 4));
        ctx.fillRect(cx - arm, cy - Math.round(thick / 2), arm * 2, thick);
        ctx.fillRect(cx - Math.round(thick / 2), cy - arm, thick, arm * 2);
        ctx.fillRect(cx - 1, cy - 1, 2, 2); // 중심을 살짝 더 밝게
      } else {
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = p.color;
        ctx.fillRect(cx - p.size / 2, cy - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;

    if (elapsed < duration || particles.length > 0) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      window.removeEventListener("resize", resizeCanvas);
      if (options.onDone) options.onDone();
    }
  }

  requestAnimationFrame(frame);
}

// 소멸 연출 B(터뜨리기)용. 한 점에서 사방(360도)으로 수백 개의 입자가
// 강하게 튀어나갔다가, 마찰로 바깥으로 튀는 힘이 빠르게 죽고 위로 뜨는
// 힘이 붙으면서 결국 모두 위쪽으로 흘러가며 사라진다. burstFromRect처럼
// 중력으로 떨어지는 낙하 연출과 달리, 초반에 잠깐 사방으로 퍼질 뿐 절대
// 아래로 떨어지지 않는다(항상 위/바깥쪽 규칙).
export function emitBurst(canvas, point, options = {}) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  function resizeCanvas() {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  const count = options.count || 240 + Math.floor(Math.random() * 120); // 240~360
  const duration = options.duration || 1500;
  // 폭죽 느낌의 빨간 계열: 중심에 가까운 뜨거운 흰빛~분홍에서 바깥은 짙은 빨강까지.
  const colors = options.colors || [
    "#fff5f0",
    "#ffcdd2",
    "#ff8a80",
    "#ff5252",
    "#e53935",
    "#b71c1c",
  ];

  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2; // 전방향
    const speed = 3 + Math.random() * 8;
    const isSparkle = Math.random() < 0.2;
    particles.push({
      x: point.x,
      y: point.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: isSparkle ? 8 + Math.round(Math.random() * 5) : 3 + Math.round(Math.random() * 4),
      isSparkle,
      life: 0,
      maxLife: duration * (0.5 + Math.random() * 0.5),
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }

  let start = null;

  function frame(ts) {
    if (start === null) start = ts;
    const elapsed = ts - start;

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += 16;
      // 바깥으로 튀는 힘은 마찰로 죽고, 위로 뜨는 힘이 점점 붙는다. 마찰을
      // 이전보다 약하게(0.92) 둬서 더 멀리, 크게 퍼지는 느낌을 준다.
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.vy -= 0.12;
      p.x += p.vx;
      p.y += p.vy;

      const t = p.life / p.maxLife;
      if (t >= 1) {
        particles.splice(i, 1);
        continue;
      }
      const alpha = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9;

      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = p.color;
      const cx = Math.round(p.x);
      const cy = Math.round(p.y);

      if (p.isSparkle) {
        const arm = p.size;
        const thick = Math.max(1, Math.round(p.size / 4));
        ctx.fillRect(cx - arm, cy - Math.round(thick / 2), arm * 2, thick);
        ctx.fillRect(cx - Math.round(thick / 2), cy - arm, thick, arm * 2);
      } else {
        ctx.fillRect(cx - p.size / 2, cy - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;

    if (elapsed < duration || particles.length > 0) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      window.removeEventListener("resize", resizeCanvas);
      if (options.onDone) options.onDone();
    }
  }

  requestAnimationFrame(frame);
}

// 소멸 연출 C(빛바래며 사라지기)용. 두 가지를 한 캔버스에서 같이 그린다:
// 1) 종이를 가로줄(row)로 잘게 썰어 각 줄을 사인파로 좌우로 흔들며(CSS/SVG
//    필터가 아니라 캔버스 2D drawImage를 여러 번 호출하는 방식) 점점
//    옅어지게 만드는 "일렁이며 사라지는" 효과.
// 2) 냄비 좌우 가장자리에서 은은한 빛 입자가 천천히 새어나와 위/바깥으로
//    흩어지는 효과. A/B보다 느리고 차분하다(임팩트 플래시·화면 흔들림 없음).
export function emitLightOverflow(canvas, options = {}) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  function resizeCanvas() {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  const duration = options.duration || 2800;
  const paperImage = options.paperImage;
  const paperRect = options.paperRect;
  const cauldronRect = options.cauldronRect;
  const paperFadeMs = options.paperFadeMs || duration * 0.55;

  const colors = options.colors || ["#fff6e0", "#e6d9ff", "#d8e8ff", "#ffffff"];
  const spawnUntil = duration * 0.75; // 끝나기 전에 스폰을 멈춰 마지막엔 잔잔히 사그라들게
  const spawnIntervalMs = 65;
  const releasePoint = cauldronRect
    ? {
        x: cauldronRect.left + cauldronRect.width * 0.5,
        y: cauldronRect.top + cauldronRect.height * 0.6,
      }
    : null;
  const GLOW_DURATION = 700;

  const particles = [];
  let lastSpawn = -Infinity;
  let glowStart = null;

  function spawnEdgeParticle(elapsedAtSpawn) {
    if (!cauldronRect) return;
    const fromLeft = Math.random() < 0.5;
    const edgeX = fromLeft
      ? cauldronRect.left + cauldronRect.width * 0.29
      : cauldronRect.left + cauldronRect.width * 0.71;
    const y = cauldronRect.top + cauldronRect.height * (0.58 + Math.random() * 0.28);
    const dir = fromLeft ? -1 : 1;
    particles.push({
      x: edgeX,
      y,
      vx: dir * (0.15 + Math.random() * 0.35),
      vy: -(0.08 + Math.random() * 0.22),
      size: 5 + Math.random() * 6,
      life: 0,
      // 남은 시간 안에서만 살도록 잡아서, 늦게 태어난 입자가 duration을
      // 넘겨 오래 살아남는 일이 없게 한다(전체 연출이 예정보다 길어지는
      // 것을 방지).
      maxLife: Math.max(300, duration - elapsedAtSpawn) * (0.55 + Math.random() * 0.45),
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }

  // 종이를 가로로 얇게 썰어, 각 줄을 사인파 오프셋을 주며 다시 그린다.
  // 시간이 지날수록 파도 진폭이 커지고 동시에 옅어져서, "빛으로 풀어지며
  // 흩어지는" 느낌을 준다.
  function drawDistortedPaper(elapsed) {
    if (!paperImage || !paperRect || elapsed >= paperFadeMs) return;
    const t = elapsed / paperFadeMs; // 0~1
    const alpha = 1 - t;
    const amplitude = 1 + t * 15; // 점점 더 크게 일렁인다(더 강하게)
    const phase = elapsed * 0.006;

    const sliceH = 2; // 화면 px 기준 한 줄 두께
    const rows = Math.max(1, Math.ceil(paperRect.height / sliceH));
    const naturalW = paperImage.naturalWidth || paperRect.width;
    const naturalH = paperImage.naturalHeight || paperRect.height;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    for (let r = 0; r < rows; r++) {
      const rowFrac = r / rows;
      const offsetX = Math.sin(rowFrac * Math.PI * 2 * 3 + phase) * amplitude;
      const srcY = rowFrac * naturalH;
      const srcH = naturalH / rows;
      const destY = paperRect.y + r * sliceH;
      ctx.drawImage(
        paperImage,
        0,
        srcY,
        naturalW,
        srcH,
        paperRect.x + offsetX,
        destY,
        paperRect.width,
        sliceH + 1
      );
    }
    ctx.restore();
  }

  // 종이가 다 녹아 사라지는 순간, 냄비 입구에서 부드러운 빛이 한 번 크게
  // 번지듯 퍼졌다 사라진다("놓아준" 순간의 임팩트). A/B의 또렷한 플래시와
  // 달리 가장자리가 흐릿한 광원이 천천히 확산·소멸한다.
  function drawReleaseGlow(elapsed) {
    if (glowStart === null || !releasePoint) return;
    const glowElapsed = elapsed - glowStart;
    if (glowElapsed >= GLOW_DURATION) return;
    const t = glowElapsed / GLOW_DURATION;
    const radius = (cauldronRect.width * 0.18) + t * cauldronRect.width * 0.55;
    const alpha = (1 - t) * 0.6;

    const grad = ctx.createRadialGradient(
      releasePoint.x,
      releasePoint.y,
      0,
      releasePoint.x,
      releasePoint.y,
      radius
    );
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.5, "rgba(255,246,224,0.5)");
    grad.addColorStop(1, "rgba(255,246,224,0)");

    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(releasePoint.x, releasePoint.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  let start = null;

  function frame(ts) {
    if (start === null) start = ts;
    const elapsed = ts - start;

    if (elapsed < spawnUntil && elapsed - lastSpawn > spawnIntervalMs) {
      spawnEdgeParticle(elapsed);
      lastSpawn = elapsed;
    }

    if (glowStart === null && elapsed >= paperFadeMs) {
      glowStart = elapsed;
    }

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    drawReleaseGlow(elapsed);

    // 은은한 빛 입자: 또렷한 도트가 아니라 부드러운 광원(라디얼 그라디언트)으로
    // 그려서 A/B의 또렷한 불티/불꽃과 질감을 다르게 가져간다.
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += 16;
      p.vy -= 0.004;
      p.x += p.vx;
      p.y += p.vy;

      const t = p.life / p.maxLife;
      if (t >= 1) {
        particles.splice(i, 1);
        continue;
      }
      const alpha = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;

      const cx = p.x;
      const cy = p.y;
      const r = p.size * (1 + t * 0.6);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, p.color);
      grad.addColorStop(1, "rgba(255,255,255,0)");

      ctx.globalAlpha = Math.max(0, alpha) * 0.85;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    drawDistortedPaper(elapsed);

    if (elapsed < duration || particles.length > 0) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      window.removeEventListener("resize", resizeCanvas);
      if (options.onDone) options.onDone();
    }
  }

  requestAnimationFrame(frame);
}
