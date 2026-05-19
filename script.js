const $ = (id) => document.getElementById(id);
const toast = $('toast');
const canvas = $('pitchCanvas');
const ctx = canvas.getContext('2d');

function showToast(message, duration = 2300) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

function extractYouTubeId(value) {
  const text = value.trim();
  if (!text) return '';

  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/,
    /^([a-zA-Z0-9_-]{6,})$/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return '';
}

/* LOGO */
$('logoSlot')?.addEventListener('click', () => $('logoInput')?.click());

$('logoInput')?.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);

  $('logoSlot').innerHTML = `
    <img src="${url}" alt="Logo AURA XI">
    <span class="logo-hint">Trocar logo</span>
    <input type="file" id="logoInput" accept="image/*" hidden />
  `;

  showToast('Logo carregada nesta visualização.');
});

/* YOUTUBE */
$('ytForm')?.addEventListener('submit', (event) => {
  event.preventDefault();

  const id = extractYouTubeId($('ytInput').value);

  if (!id) {
    showToast('Cole um ID ou link válido do YouTube.');
    return;
  }

  $('mainVideoWrap').innerHTML = `
    <iframe 
      src="https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1" 
      title="Vídeo em destaque" 
      allow="autoplay; encrypted-media; picture-in-picture" 
      allowfullscreen>
    </iframe>
  `;
});

/* COMPARTILHAR */
$('shareBtn')?.addEventListener('click', async () => {
  const data = {
    title: 'AURA XI — Football as Cinema',
    url: location.href
  };

  try {
    if (navigator.share) {
      await navigator.share(data);
    } else {
      await navigator.clipboard.writeText(location.href);
      showToast('Link copiado para a área de transferência!');
    }
  } catch (_) {}
});

/* ESTADO DO JOGO */
const state = {
  score: 0,
  attempts: 0,
  streak: 0,
  bestStreak: 0,
  player: 'neymar',
  foot: 'left',
  aim: 'mc',
  power: 72,
  difficulty: 'base',
  locked: false,
  pointerAim: null
};

/* DIFICULDADES */
const DIFF = {
  base: {
    keeperRead: 0.32,
    reaction: 460,
    speed: 0.60,
    reach: 0.78,
    jitter: 0.032,
    ballSpeed: 0.92
  },
  jogador: {
    keeperRead: 0.52,
    reaction: 340,
    speed: 0.74,
    reach: 0.92,
    jitter: 0.050,
    ballSpeed: 1.00
  },
  craque: {
    keeperRead: 0.72,
    reaction: 225,
    speed: 0.88,
    reach: 1.08,
    jitter: 0.072,
    ballSpeed: 1.08
  },
  lenda: {
    keeperRead: 0.88,
    reaction: 120,
    speed: 1.02,
    reach: 1.24,
    jitter: 0.094,
    ballSpeed: 1.15
  }
};

/* JOGADORES */
const PLAYERS = {
  neymar: {
    color: '#f7d55a',
    boot: '#fff0b0',
    fav: 'left',
    curve: 0.95,
    power: 0.88,
    trail: 'rgba(255,218,84,.72)'
  },
  cr7: {
    color: '#d93030',
    boot: '#ffffff',
    fav: 'right',
    curve: 0.48,
    power: 1.04,
    trail: 'rgba(255,70,70,.70)'
  },
  mbappe: {
    color: '#2f91ff',
    boot: '#ffffff',
    fav: 'right',
    curve: 0.72,
    power: 0.97,
    trail: 'rgba(70,160,255,.70)'
  },
  vini: {
    color: '#2dce7a',
    boot: '#ffe36e',
    fav: 'left',
    curve: 1.04,
    power: 0.86,
    trail: 'rgba(45,220,130,.70)'
  },
  yamal: {
    color: '#8b6dff',
    boot: '#ffffff',
    fav: 'left',
    curve: 0.86,
    power: 0.80,
    trail: 'rgba(160,130,255,.72)'
  },
  haaland: {
    color: '#f5f5f5',
    boot: '#f0c96a',
    fav: 'right',
    curve: 0.35,
    power: 1.10,
    trail: 'rgba(230,230,230,.68)'
  }
};

/* MIRA */
const AIM = {
  tl: { col: 0, row: 0 },
  tc: { col: 1, row: 0 },
  tr: { col: 2, row: 0 },
  ml: { col: 0, row: 1 },
  mc: { col: 1, row: 1 },
  mr: { col: 2, row: 1 },
  bl: { col: 0, row: 2 },
  bc: { col: 1, row: 2 },
  br: { col: 2, row: 2 }
};

/* CANVAS RESPONSIVO */
function fitCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.max(320, Math.floor(rect.width * dpr));
  canvas.height = Math.max(320, Math.floor(rect.height * dpr));

  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  canvas._w = rect.width;
  canvas._h = rect.height;
}

/* GEOMETRIA DO CAMPO */
function geo() {
  const W = canvas._w || 900;
  const H = canvas._h || 560;

  const gW = Math.min(W * 0.72, 720);
  const gH = Math.min(H * 0.36, 245);
  const gX = (W - gW) / 2;
  const gY = H * 0.105;

  return {
    W,
    H,
    gW,
    gH,
    gX,
    gY,
    ballX: W / 2,
    ballY: H * 0.825,
    ballR: Math.max(10, Math.min(20, W * 0.022)),
    keeperY: gY + gH * 0.56
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOut(t) {
  return t < 0.5
    ? 2 * t * t
    : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function drawRoundedRect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);

  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/* CAMPO */
function drawPitch(g) {
  const grad = ctx.createRadialGradient(
    g.W / 2,
    g.H * 0.8,
    g.W * 0.08,
    g.W / 2,
    g.H,
    g.W * 0.86
  );

  grad.addColorStop(0, '#1c5a25');
  grad.addColorStop(0.42, '#0e3516');
  grad.addColorStop(1, '#041006');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, g.W, g.H);

  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2
      ? 'rgba(255,255,255,.026)'
      : 'rgba(0,0,0,.08)';

    const x = i * g.W / 12;

    ctx.beginPath();
    ctx.moveTo(x + g.W * 0.035, 0);
    ctx.lineTo(x + g.W / 12 + g.W * 0.035, 0);
    ctx.lineTo(x + g.W / 12, g.H);
    ctx.lineTo(x, g.H);
    ctx.closePath();
    ctx.fill();
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.34)';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(g.gX - g.gW * 0.22, g.gY + g.gH);
  ctx.lineTo(g.gX + g.gW * 1.22, g.gY + g.gH);
  ctx.lineTo(g.gX + g.gW * 1.50, g.H + 20);

  ctx.moveTo(g.gX - g.gW * 0.22, g.gY + g.gH);
  ctx.lineTo(g.gX - g.gW * 0.50, g.H + 20);

  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(
    g.W / 2,
    g.H * 0.81,
    g.W * 0.16,
    g.H * 0.055,
    0,
    Math.PI,
    0
  );
  ctx.stroke();

  ctx.restore();
}

/* GOL */
function drawGoal(g, impact = null) {
  ctx.save();

  const depth = g.gH * 0.22;

  ctx.fillStyle = 'rgba(0,0,0,.54)';
  drawRoundedRect(g.gX, g.gY, g.gW, g.gH, 8);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.lineWidth = 1;

  const cols = 16;
  const rows = 8;

  for (let i = 0; i <= cols; i++) {
    const x = g.gX + g.gW * i / cols;

    ctx.beginPath();
    ctx.moveTo(x, g.gY);
    ctx.lineTo(lerp(x, g.W / 2, 0.16), g.gY + g.gH + depth * 0.22);
    ctx.stroke();
  }

  for (let j = 0; j <= rows; j++) {
    const y = g.gY + g.gH * j / rows;

    ctx.beginPath();
    ctx.moveTo(g.gX, y);
    ctx.quadraticCurveTo(g.W / 2, y + (j / rows) * 12, g.gX + g.gW, y);
    ctx.stroke();
  }

  if (impact) {
    ctx.strokeStyle = 'rgba(240,201,106,.45)';
    ctx.lineWidth = 2;

    for (let r = 18; r < 90; r += 18) {
      ctx.beginPath();
      ctx.arc(impact.x, impact.y, r * impact.a, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const post = ctx.createLinearGradient(g.gX, g.gY, g.gX, g.gY + g.gH);
  post.addColorStop(0, '#ffffff');
  post.addColorStop(0.45, '#d8d8d8');
  post.addColorStop(1, '#8e8e8e');

  ctx.strokeStyle = post;
  ctx.lineWidth = Math.max(5, g.W * 0.007);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(255,255,255,.28)';
  ctx.shadowBlur = 10;

  ctx.beginPath();
  ctx.moveTo(g.gX, g.gY + g.gH);
  ctx.lineTo(g.gX, g.gY);
  ctx.lineTo(g.gX + g.gW, g.gY);
  ctx.lineTo(g.gX + g.gW, g.gY + g.gH);
  ctx.stroke();

  ctx.restore();
}

/* GOLEIRO */
function drawKeeper(g, x, y, dive = 0, side = 0) {
  const s = clamp(g.W * 0.055, 28, 48);

  ctx.save();
  ctx.translate(x, y);

  const lean = side * dive * 0.78;
  const air = Math.sin(dive * Math.PI) * s * 0.45;

  ctx.translate(0, -air);
  ctx.rotate(lean);

  ctx.save();
  ctx.globalAlpha = 0.48;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(0, s * 1.92 + air * 0.82, s * 1.75, s * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const jersey = ctx.createLinearGradient(0, -s * 1.2, 0, s * 1.15);
  jersey.addColorStop(0, '#ffe184');
  jersey.addColorStop(0.55, '#c9963b');
  jersey.addColorStop(1, '#6e4712');

  ctx.fillStyle = jersey;
  drawRoundedRect(-s * 0.72, -s * 0.55, s * 1.44, s * 1.7, s * 0.28);
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,.24)';
  drawRoundedRect(-s * 0.42, -s * 0.30, s * 0.84, s * 0.22, s * 0.1);
  ctx.fill();

  const armReach = s * (1.15 + dive * 0.78);

  ctx.strokeStyle = '#c89155';
  ctx.lineWidth = s * 0.22;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(-s * 0.62, -s * 0.2);
  ctx.lineTo(-s * 0.62 - armReach, -s * 0.08 - dive * s * 0.55);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(s * 0.62, -s * 0.2);
  ctx.lineTo(s * 0.62 + armReach, -s * 0.08 - dive * s * 0.55);
  ctx.stroke();

  ctx.fillStyle = '#f7f3ea';

  ctx.beginPath();
  ctx.arc(-s * 0.62 - armReach, -s * 0.08 - dive * s * 0.55, s * 0.27, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(s * 0.62 + armReach, -s * 0.08 - dive * s * 0.55, s * 0.27, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#101010';
  ctx.lineWidth = s * 0.25;

  ctx.beginPath();
  ctx.moveTo(-s * 0.35, s * 1.04);
  ctx.lineTo(-s * 0.70 - dive * s * 0.3, s * 1.85);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(s * 0.35, s * 1.04);
  ctx.lineTo(s * 0.70 + dive * s * 0.3, s * 1.85);
  ctx.stroke();

  ctx.fillStyle = '#f7f3ea';
  ctx.fillRect(-s * 0.92 - dive * s * 0.3, s * 1.83, s * 0.42, s * 0.14);
  ctx.fillRect(s * 0.50 + dive * s * 0.3, s * 1.83, s * 0.42, s * 0.14);

  ctx.fillStyle = '#dfad7d';
  ctx.beginPath();
  ctx.arc(0, -s * 1.05, s * 0.46, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#161616';
  ctx.beginPath();
  ctx.arc(0, -s * 1.15, s * 0.47, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.fillRect(-s * 0.16, -s * 1.04, s * 0.09, s * 0.04);
  ctx.fillRect(s * 0.07, -s * 1.04, s * 0.09, s * 0.04);

  ctx.restore();
}

/* BOLA */
function drawBall(g, x, y, r, rot = 0, scale = 1, blur = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(0, r * 1.75, r * 1.4, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (blur > 0) {
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-r * 0.45, 0, r * (1 + blur), r * 0.72, rot, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.rotate(rot);

  const bg = ctx.createRadialGradient(-r * 0.35, -r * 0.38, r * 0.05, 0, 0, r * 1.05);
  bg.addColorStop(0, '#fff');
  bg.addColorStop(0.55, '#e8e8e8');
  bg.addColorStop(1, '#777');

  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,.72)';
  ctx.lineWidth = Math.max(1, r * 0.09);

  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;

    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.32, r * 0.28, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(0,0,0,.82)';
  ctx.beginPath();

  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
    const px = Math.cos(a) * r * 0.28;
    const py = Math.sin(a) * r * 0.28;

    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }

  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,.42)';
  ctx.beginPath();
  ctx.arc(-r * 0.38, -r * 0.42, r * 0.24, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/* RASTRO DA BOLA */
function drawTrail(points, color) {
  if (points.length < 2) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 1; i < points.length; i++) {
    const a = i / points.length;

    ctx.strokeStyle = color;
    ctx.globalAlpha = a * 0.58;
    ctx.lineWidth = lerp(2, 9, a);

    ctx.beginPath();
    ctx.moveTo(points[i - 1].x, points[i - 1].y);
    ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }

  ctx.restore();
}

/* ALVO */
function drawTarget(g) {
  const t = targetFromAim(true);

  ctx.save();
  ctx.strokeStyle = 'rgba(240,201,106,.34)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 8]);

  ctx.beginPath();
  ctx.arc(t.tx, t.ty, 16, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(t.tx - 24, t.ty);
  ctx.lineTo(t.tx + 24, t.ty);
  ctx.moveTo(t.tx, t.ty - 24);
  ctx.lineTo(t.tx, t.ty + 24);
  ctx.stroke();

  ctx.restore();
}

/* RENDERIZAÇÃO */
function render(ball = null, keeper = null, trail = [], particles = [], impact = null) {
  const g = geo();

  ctx.clearRect(0, 0, g.W, g.H);

  drawPitch(g);
  drawGoal(g, impact);
  drawTarget(g);

  const k = keeper || {
    x: g.W / 2,
    y: g.keeperY,
    dive: 0,
    side: 0
  };

  drawKeeper(g, k.x, k.y, k.dive, k.side);

  if (trail.length) {
    drawTrail(trail, PLAYERS[state.player].trail);
  }

  const b = ball || {
    x: g.ballX,
    y: g.ballY,
    r: g.ballR,
    rot: 0,
    scale: 1,
    blur: 0
  };

  drawBall(g, b.x, b.y, b.r, b.rot, b.scale, b.blur);

  if (particles.length) {
    drawParticles(particles);
  }
}

/* MIRA DO CHUTE */
function targetFromAim(preview = false) {
  const g = geo();

  if (state.pointerAim && !preview) {
    return {
      tx: state.pointerAim.x,
      ty: state.pointerAim.y,
      g
    };
  }

  const zone = AIM[state.aim];

  const colPad = g.gW * 0.13;
  const rowPad = g.gH * 0.15;

  const tx = g.gX + colPad + zone.col * ((g.gW - colPad * 2) / 2);
  const ty = g.gY + rowPad + zone.row * ((g.gH - rowPad * 2) / 2);

  return {
    tx,
    ty,
    g
  };
}

/* CÁLCULO DO CHUTE */
function computeShot() {
  const { tx, ty, g } = targetFromAim(false);

  const player = PLAYERS[state.player];
  const diff = DIFF[state.difficulty];

  const wrongFoot = player.fav !== state.foot;
  const powerN = state.power / 100;

  const baseJitter = diff.jitter * g.gW;
  const footPenalty = wrongFoot ? g.gW * 0.045 : 0;
  const powerPenalty = Math.abs(powerN - 0.74) * g.gW * 0.09;

  const finalX =
    tx +
    rand(-baseJitter, baseJitter) +
    rand(-footPenalty, footPenalty) +
    rand(-powerPenalty, powerPenalty);

  const finalY =
    ty +
    rand(-baseJitter * 0.58, baseJitter * 0.58) +
    (powerN > 0.9 ? rand(-g.gH * 0.07, g.gH * 0.015) : 0);

  const curve =
    player.curve *
    (state.foot === 'left' ? -1 : 1) *
    g.W *
    0.055 *
    rand(0.65, 1.1);

  return {
    g,
    targetX: finalX,
    targetY: finalY,
    curve
  };
}

/* IA DO GOLEIRO */
function keeperDecision(targetX, g) {
  const diff = DIFF[state.difficulty];

  const realCol =
    targetX < g.gX + g.gW * 0.34
      ? 0
      : targetX < g.gX + g.gW * 0.66
        ? 1
        : 2;

  if (Math.random() < diff.keeperRead) {
    return {
      col: realCol,
      read: true
    };
  }

  const other = [0, 1, 2].filter((c) => c !== realCol);

  return {
    col: other[Math.floor(Math.random() * other.length)],
    read: false
  };
}

/* RESULTADO DO CHUTE */
function outcome(g, targetX, targetY, keeperCol) {
  const inside =
    targetX > g.gX + 7 &&
    targetX < g.gX + g.gW - 7 &&
    targetY > g.gY + 7 &&
    targetY < g.gY + g.gH - 7;

  if (!inside) return 'miss';

  const diff = DIFF[state.difficulty];

  const ballCol =
    targetX < g.gX + g.gW * 0.34
      ? 0
      : targetX < g.gX + g.gW * 0.66
        ? 1
        : 2;

  if (ballCol !== keeperCol) return 'goal';

  const zones = [
    g.gX + g.gW * 0.17,
    g.W / 2,
    g.gX + g.gW * 0.83
  ];

  const distance = Math.abs(targetX - zones[keeperCol]);
  const topCorner = targetY < g.gY + g.gH * 0.36;
  const powerBoost = state.power > 84 ? 0.86 : 1;

  const reach =
    g.gW *
    0.18 *
    diff.reach *
    (topCorner ? 0.68 : 1) *
    powerBoost;

  return distance < reach ? 'saved' : 'goal';
}

/* ANIMAÇÃO DO CHUTE */
function animateShot() {
  if (state.locked) return;

  state.locked = true;
  $('shootBtn').disabled = true;

  state.attempts += 1;
  updateHUD();

  const shot = computeShot();
  const { g, targetX, targetY, curve } = shot;

  const decision = keeperDecision(targetX, g);

  const keeperZones = [
    g.gX + g.gW * 0.16,
    g.W / 2,
    g.gX + g.gW * 0.84
  ];

  const keeperStartX = g.W / 2;
  const keeperEndX = keeperZones[decision.col];
  const side = Math.sign(keeperEndX - keeperStartX);

  const diff = DIFF[state.difficulty];
  const player = PLAYERS[state.player];

  const duration = clamp(
    820 / diff.ballSpeed / (player.power * (0.78 + state.power / 170)),
    460,
    920
  );

  const start = {
    x: g.ballX,
    y: g.ballY,
    r: g.ballR
  };

  const trail = [];
  let started = null;

  function frame(now) {
    if (!started) started = now;

    const elapsed = now - started;
    const t = clamp(elapsed / duration, 0, 1);
    const e = easeOutCubic(t);

    const cx =
      lerp(start.x, targetX, e) +
      Math.sin(t * Math.PI) * curve;

    const cy =
      lerp(start.y, targetY, e) -
      Math.sin(t * Math.PI) * g.H * 0.23;

    const r = lerp(start.r, start.r * 0.58, e);

    trail.push({
      x: cx,
      y: cy
    });

    if (trail.length > 20) {
      trail.shift();
    }

    let keeperX = keeperStartX;
    let dive = 0;

    if (elapsed > diff.reaction) {
      const kt = clamp(
        (elapsed - diff.reaction) / (duration - diff.reaction + 1),
        0,
        1
      );

      const ke = easeInOut(kt);

      keeperX = lerp(
        keeperStartX,
        keeperEndX,
        clamp(ke * diff.speed, 0, 1)
      );

      dive = Math.min(1, ke * 1.2);
    }

    render(
      {
        x: cx,
        y: cy,
        r,
        rot: t * Math.PI * 11,
        scale: 1 + Math.sin(t * Math.PI) * 0.08,
        blur: t > 0.2 ? 0.22 : 0
      },
      {
        x: keeperX,
        y: g.keeperY,
        dive,
        side
      },
      trail
    );

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      finishShot(g, targetX, targetY, decision.col);
    }
  }

  requestAnimationFrame(frame);
}

/* FINALIZAÇÃO DO CHUTE */
function finishShot(g, targetX, targetY, keeperCol) {
  const result = outcome(g, targetX, targetY, keeperCol);

  if (result === 'goal') {
    state.score++;
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);

    const messages = [
      'GOOOL! Isso é cinema puro.',
      'Chute perfeito. O goleiro nem viu.',
      'Na gaveta! Aura desbloqueada.',
      'Frieza absurda na cobrança.'
    ];

    setResult(messages[Math.floor(Math.random() * messages.length)], 'goal');
    celebrate(targetX, targetY, true);

    showToast(state.streak >= 3 ? `🔥 Série de ${state.streak}!` : '⚽ GOOOOL!');
  }

  else if (result === 'saved') {
    state.streak = 0;

    setResult('Defesaça! O goleiro leu o canto e chegou inteiro na bola.', 'saved');
    celebrate(targetX, targetY, false);

    showToast('🧤 Defendido!');
  }

  else {
    state.streak = 0;

    setResult('Fora! Ajuste a mira ou controle melhor a potência.', 'miss');
    celebrate(targetX, targetY, false);

    showToast('❌ Para fora!');
  }

  updateHUD();

  setTimeout(() => {
    state.locked = false;
    $('shootBtn').disabled = false;
    render();
  }, 950);
}

/* PARTÍCULAS */
function drawParticles(parts) {
  ctx.save();

  parts.forEach((p) => {
    ctx.globalAlpha = p.a;
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

/* COMEMORAÇÃO */
function celebrate(x, y, goal) {
  let parts = Array.from({ length: goal ? 42 : 18 }, () => {
    const a = rand(0, Math.PI * 2);
    const sp = rand(1.4, goal ? 5.2 : 3.2);

    return {
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - rand(0.5, 2.4),
      r: rand(2, goal ? 5 : 4),
      a: 1,
      c: goal
        ? ['#f0c96a', '#fff1c7', '#2dce7a', '#ffffff'][Math.floor(rand(0, 4))]
        : ['#ffffff', '#c9963b'][Math.floor(rand(0, 2))]
    };
  });

  let tick = 0;

  function loop() {
    tick++;

    parts.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.a -= 0.027;
    });

    parts = parts.filter((p) => p.a > 0);

    render(
      null,
      null,
      [],
      parts,
      {
        x,
        y,
        a: Math.max(0, 1 - tick / 38)
      }
    );

    if (parts.length) {
      requestAnimationFrame(loop);
    }
  }

  requestAnimationFrame(loop);
}

/* HUD */
function updateHUD() {
  $('hudScore').textContent = state.score;
  $('hudAttempts').textContent = state.attempts;
  $('hudStreak').textContent = state.streak;
  $('streakBadge').textContent = state.streak;
  $('bestStreak').textContent = state.bestStreak;

  $('hudAccuracy').textContent = state.attempts
    ? `${Math.round(state.score / state.attempts * 100)}%`
    : '—';

  let aura = 'Rookie';

  if (state.score >= 20) aura = '⭐ Lenda';
  else if (state.score >= 12) aura = '🔥 Ícone';
  else if (state.score >= 6) aura = '💫 Craque';
  else if (state.score >= 3) aura = '⚡ Rising';

  $('hudAura').textContent = aura;
}

function setResult(text, type) {
  const el = $('resultMsg');

  el.textContent = text;
  el.className = `result-msg ${type || ''}`;
}

/* SELEÇÃO DE BOTÕES */
function selectByData(selector, key, value) {
  document.querySelectorAll(selector).forEach((btn) => {
    btn.classList.toggle('active', btn.dataset[key] === value);
  });
}

/* DIFICULDADE */
document.querySelectorAll('.diff-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.difficulty = btn.dataset.diff;

    selectByData('.diff-btn', 'diff', state.difficulty);

    render();

    const msg = {
      base: '🟢 Modo Base',
      jogador: '🔵 Modo Jogador',
      craque: '🟠 Modo Craque',
      lenda: '🔴 MODO LENDA'
    };

    showToast(msg[state.difficulty]);
  });
});

/* JOGADOR */
document.querySelectorAll('.player-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.player = btn.dataset.player;

    selectByData('.player-btn', 'player', state.player);

    render();
  });
});

/* PÉ */
document.querySelectorAll('[data-foot]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.foot = btn.dataset.foot;

    selectByData('[data-foot]', 'foot', state.foot);
  });
});

/* MIRA POR BOTÃO */
document.querySelectorAll('.aim-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.pointerAim = null;
    state.aim = btn.dataset.aim;

    selectByData('.aim-btn', 'aim', state.aim);

    render();
  });
});

/* POTÊNCIA */
const powerTrack = $('powerTrack');

function setPower(clientX) {
  const rect = powerTrack.getBoundingClientRect();

  const pct = clamp(
    (clientX - rect.left) / rect.width * 100,
    10,
    100
  );

  state.power = Math.round(pct);

  $('powerFill').style.width = `${state.power}%`;
  $('powerVal').textContent = `${state.power}%`;
}

let dragging = false;

powerTrack.addEventListener('pointerdown', (e) => {
  dragging = true;
  powerTrack.setPointerCapture?.(e.pointerId);
  setPower(e.clientX);
});

window.addEventListener('pointermove', (e) => {
  if (dragging) setPower(e.clientX);
});

window.addEventListener('pointerup', () => {
  dragging = false;
});

/* MIRA CLICANDO NO GOL */
canvas.addEventListener('pointerdown', (e) => {
  if (state.locked) return;

  const g = geo();
  const rect = canvas.getBoundingClientRect();

  const x = clamp(
    e.clientX - rect.left,
    g.gX + 10,
    g.gX + g.gW - 10
  );

  const y = clamp(
    e.clientY - rect.top,
    g.gY + 10,
    g.gY + g.gH - 10
  );

  state.pointerAim = {
    x,
    y
  };

  document.querySelectorAll('.aim-btn').forEach((b) => {
    b.classList.remove('active');
  });

  render();
});

/* CHUTAR */
$('shootBtn').addEventListener('click', animateShot);

/* TECLADO */
window.addEventListener('keydown', (e) => {
  const tag = document.activeElement.tagName;

  if (
    (e.code === 'Space' || e.code === 'Enter') &&
    !/INPUT|TEXTAREA/.test(tag)
  ) {
    e.preventDefault();
    animateShot();
  }
});

/* INICIAR */
function init() {
  fitCanvas();

  $('powerFill').style.width = `${state.power}%`;

  updateHUD();
  render();
}

window.addEventListener('resize', () => {
  fitCanvas();
  render();
});

if (document.fonts?.ready) {
  document.fonts.ready.then(init);
} else {
  init();
}
