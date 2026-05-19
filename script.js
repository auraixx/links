/* ═══════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const toast = $('toast');
function showToast(msg, dur=2400){
  toast.textContent=msg; toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t=setTimeout(()=>toast.classList.remove('show'),dur);
}

/* ─── LOGO UPLOAD ─────────────────────────────────────── */
$('logoSlot').addEventListener('click',()=>$('logoInput').click());
$('logoInput').addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f)return;
  const url=URL.createObjectURL(f);
  const slot=$('logoSlot');
  slot.innerHTML=`<img src="${url}" alt="Logo" style="width:100%;height:100%;object-fit:contain;">`;
});

/* ─── YOUTUBE LOADER ──────────────────────────────────── */
function loadYT(){
  const id=$('ytInput').value.trim();
  if(!id){showToast('Cole um ID válido do YouTube');return;}
  const wrap=$('mainVideoWrap');
  wrap.innerHTML=`<iframe src="https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1" style="width:100%;height:100%;border:none;display:block;" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
}

/* ─── SHARE ───────────────────────────────────────────── */
$('shareBtn').addEventListener('click', async ()=>{
  const data={ title:'AURA XI — Football as Cinema', url: location.href };
  if(navigator.share){ try{await navigator.share(data);}catch(_){} }
  else {
    await navigator.clipboard.writeText(location.href);
    showToast('Link copiado para a área de transferência!');
  }
});

/* ═══════════════════════════════════════════════════════
   PENALTY GAME ENGINE
═══════════════════════════════════════════════════════ */
const canvas = $('pitchCanvas');
const ctx = canvas.getContext('2d');

// Resize canvas to container
function resizeCanvas(){
  const pw = canvas.parentElement;
  canvas.width = pw.clientWidth;
  canvas.height = Math.max(pw.clientHeight, 360);
}
resizeCanvas();
window.addEventListener('resize', ()=>{ resizeCanvas(); drawIdle(); });

/* ─── GAME STATE ──────────────────────────────────────── */
const state = {
  score:0, attempts:0, streak:0, bestStreak:0,
  player:'neymar', foot:'left', aim:'mc', power:70,
  difficulty:'base', locked:false, animating:false
};

/* ─── DIFFICULTY CONFIGS ──────────────────────────────── */
// keeperAccuracy: chance 0..1 of going to the EXACT column batido
// keeperReactionMs: delay before keeper moves
// keeperSpeed: how fast keeper covers the distance (higher = covers full distance quicker)
// saveRadius: extra reach multiplier when keeper dives correctly
// missChance: how much shot jitter there is
const DIFF = {
  base:    { keeperAccuracy:0.35, keeperReactionMs:620, keeperSpeed:0.55, saveRadius:1.0, missChance:0.03, ballSpeed:1.0 },
  jogador: { keeperAccuracy:0.58, keeperReactionMs:400, keeperSpeed:0.72, saveRadius:1.2, missChance:0.06, ballSpeed:1.08 },
  craque:  { keeperAccuracy:0.78, keeperReactionMs:200, keeperSpeed:0.88, saveRadius:1.5, missChance:0.10, ballSpeed:1.15 },
  lenda:   { keeperAccuracy:0.94, keeperReactionMs: 60, keeperSpeed:1.0,  saveRadius:1.9, missChance:0.14, ballSpeed:1.22 }
};

/* ─── PLAYER CONFIGS ──────────────────────────────────── */
const PLAYERS = {
  neymar:  { color:'#f7d55a', shimmer:'#ffe89a', favFoot:'left',  power:0.88, flair:0.92, trailColor:'rgba(255,220,80,.6)' },
  cr7:     { color:'#e83030', shimmer:'#ff7070', favFoot:'right', power:1.0,  flair:0.7,  trailColor:'rgba(220,60,60,.6)' },
  mbappe:  { color:'#3090f0', shimmer:'#90c8ff', favFoot:'right', power:0.94, flair:0.82, trailColor:'rgba(60,150,240,.6)' },
  vini:    { color:'#2dce7a', shimmer:'#80ffb8', favFoot:'left',  power:0.82, flair:0.98, trailColor:'rgba(45,200,120,.6)' },
  yamal:   { color:'#9070f0', shimmer:'#c8b0ff', favFoot:'left',  power:0.78, flair:0.84, trailColor:'rgba(140,100,240,.6)' },
  haaland: { color:'#ffffff', shimmer:'#cccccc', favFoot:'right', power:1.0,  flair:0.55, trailColor:'rgba(200,200,200,.6)' }
};

/* ─── AIM MAP ─────────────────────────────────────────── */
// Returns {cx, cy} as 0..1 fractions of goal width/height
const AIM_ZONE = {
  tl:{col:0,row:0}, tc:{col:1,row:0}, tr:{col:2,row:0},
  ml:{col:0,row:1}, mc:{col:1,row:1}, mr:{col:2,row:1},
  bl:{col:0,row:2}, bc:{col:1,row:2}, br:{col:2,row:2}
};

/* ─── KEEPER AI ───────────────────────────────────────── */
// Returns the column (0=left,1=center,2=right) the keeper will dive to.
// Higher difficulty = keeper reads the correct column more often.
function keeperDecision(aimKey, diff) {
  const zone = AIM_ZONE[aimKey];
  const cfg = DIFF[diff];
  if(Math.random() < cfg.keeperAccuracy){
    return zone.col; // Reads the shot correctly
  }
  // Misreads — goes to a random OTHER column
  const others = [0,1,2].filter(c=>c!==zone.col);
  return others[Math.floor(Math.random()*others.length)];
}

/* ─── GEOMETRY ────────────────────────────────────────── */
function getGeometry(){
  const W = canvas.width, H = canvas.height;

  // Goal — fixed size, difficulty only affects keeper behavior
  const gW = W * 0.62;
  const gH = H * 0.36;
  const gX = (W - gW) / 2;
  const gY = H * 0.06;

  // Ball start
  const bx = W/2, by = H * 0.80;
  const br = W * 0.026;

  return { W, H, gW, gH, gX, gY, bx, by, br };
}

/* ─── DRAW IDLE SCENE ─────────────────────────────────── */
function drawIdle(){
  const g = getGeometry();
  ctx.clearRect(0,0,g.W,g.H);
  drawScene(g, g.W/2, H_keeperY(g), 0);
}
function H_keeperY(g){ return g.gY + g.gH*0.08; }

function drawScene(g, keeperX, keeperY, phase, ball, trail, sparkles){
  ctx.clearRect(0,0,g.W,g.H);
  drawGrass(g);
  drawGoalPost(g);
  drawKeeper(g, keeperX, keeperY, phase);
  if(trail) drawTrail(trail);
  if(ball) drawBall(g, ball.x, ball.y, ball.r, ball.rot, ball.scale);
  else     drawBall(g, g.bx, g.by, g.br, 0, 1);
  if(sparkles && sparkles.length) drawSparkles(sparkles);
  drawPenaltySpot(g);
}

/* ─── GRASS ───────────────────────────────────────────── */
function drawGrass(g){
  // Stripes
  for(let i=0;i<8;i++){
    const x0=g.W*i/8, x1=g.W*(i+1)/8;
    ctx.fillStyle= i%2===0 ? 'rgba(10,22,10,.85)':'rgba(7,16,7,.85)';
    ctx.fillRect(x0,0,x1-x0,g.H);
  }
  // Center circle faint
  ctx.beginPath();
  ctx.arc(g.W/2, g.H*0.9, g.W*0.18, 0, Math.PI*2);
  ctx.strokeStyle='rgba(255,255,255,.06)';
  ctx.lineWidth=2; ctx.stroke();
  // Penalty box
  const pbW=g.gW*1.35, pbH=g.H*0.4;
  const pbX=(g.W-pbW)/2, pbY=g.gY+g.gH*0.5;
  ctx.strokeStyle='rgba(255,255,255,.09)';
  ctx.lineWidth=2;
  ctx.strokeRect(pbX,pbY,pbW,pbH);
  // Penalty spot
  ctx.beginPath();
  ctx.arc(g.W/2, g.by-g.br*1.5, g.br*0.28, 0,Math.PI*2);
  ctx.fillStyle='rgba(255,255,255,.2)'; ctx.fill();
}

function drawPenaltySpot(g){
  // already drawn in grass, skip
}

/* ─── GOAL POST ───────────────────────────────────────── */
function drawGoalPost(g){
  const {gX,gY,gW,gH} = g;

  // Net shadow
  ctx.save();
  ctx.beginPath();
  ctx.rect(gX, gY, gW, gH);
  ctx.clip();

  // Net lines horizontal
  ctx.strokeStyle='rgba(255,255,255,.08)';
  ctx.lineWidth=1;
  for(let y=gY;y<gY+gH;y+=16){
    ctx.beginPath(); ctx.moveTo(gX,y); ctx.lineTo(gX+gW,y); ctx.stroke();
  }
  // Net lines vertical
  for(let x=gX;x<gX+gW;x+=20){
    ctx.beginPath(); ctx.moveTo(x,gY); ctx.lineTo(x,gY+gH); ctx.stroke();
  }

  // Depth gradient inside net
  const ng=ctx.createLinearGradient(0,gY,0,gY+gH);
  ng.addColorStop(0,'rgba(0,0,0,.0)');
  ng.addColorStop(1,'rgba(0,0,0,.55)');
  ctx.fillStyle=ng; ctx.fillRect(gX,gY,gW,gH);
  ctx.restore();

  // Posts
  ctx.strokeStyle='rgba(245,242,234,.92)';
  ctx.lineWidth=5; ctx.lineCap='round';
  // Left post
  ctx.beginPath(); ctx.moveTo(gX,gY); ctx.lineTo(gX,gY+gH); ctx.stroke();
  // Right post
  ctx.beginPath(); ctx.moveTo(gX+gW,gY); ctx.lineTo(gX+gW,gY+gH); ctx.stroke();
  // Crossbar
  ctx.beginPath(); ctx.moveTo(gX,gY); ctx.lineTo(gX+gW,gY); ctx.stroke();

  // Post glow
  ctx.shadowColor='rgba(255,255,255,.3)'; ctx.shadowBlur=8;
  ctx.strokeStyle='rgba(255,255,255,.25)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(gX,gY); ctx.lineTo(gX+gW,gY); ctx.stroke();
  ctx.shadowBlur=0;
}

/* ─── KEEPER ──────────────────────────────────────────── */
function drawKeeper(g, kx, ky, phase){
  const sc = g.W * 0.048;
  ctx.save();
  ctx.translate(kx, ky);

  // Body lean
  const lean = (kx - g.W/2) / (g.W * 0.5) * 0.35;
  ctx.rotate(lean);

  // Jersey
  const jGrad = ctx.createLinearGradient(0,0,0,sc*2.8);
  jGrad.addColorStop(0,'#f0c050');
  jGrad.addColorStop(1,'#8b5a10');
  ctx.fillStyle=jGrad;
  ctx.beginPath();
  ctx.roundRect(-sc*0.7, 0, sc*1.4, sc*2.8, sc*0.3);
  ctx.fill();

  // Arms — stretch when diving
  const armExtend = Math.abs(lean)*3.5;
  ctx.fillStyle='#d4a040';
  // Left arm
  ctx.save();
  ctx.translate(-sc*0.7, sc*0.4);
  ctx.rotate(-0.3 - lean*2);
  ctx.beginPath();
  ctx.roundRect(-sc*0.28*(1+armExtend), 0, sc*0.28*(1+armExtend), sc*0.8, sc*0.14);
  ctx.fill(); ctx.restore();
  // Right arm
  ctx.save();
  ctx.translate(sc*0.7, sc*0.4);
  ctx.rotate(0.3 - lean*2);
  ctx.beginPath();
  ctx.roundRect(0, 0, sc*0.28*(1+armExtend), sc*0.8, sc*0.14);
  ctx.fill(); ctx.restore();

  // Gloves
  ctx.fillStyle='#e8e8e8';
  ctx.beginPath(); ctx.arc(-sc*(0.7+0.28*(1+armExtend)*0.8),sc*0.7,sc*0.22,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc( sc*(0.7+0.28*(1+armExtend)*0.8),sc*0.7,sc*0.22,0,Math.PI*2); ctx.fill();

  // Legs
  ctx.fillStyle='#1a1a1a';
  ctx.beginPath(); ctx.roundRect(-sc*0.52, sc*2.5, sc*0.44, sc*1.4, sc*0.16); ctx.fill();
  ctx.beginPath(); ctx.roundRect( sc*0.08, sc*2.5, sc*0.44, sc*1.4, sc*0.16); ctx.fill();
  // Boots
  ctx.fillStyle='#f0c050';
  ctx.beginPath(); ctx.roundRect(-sc*0.58, sc*3.7, sc*0.56, sc*0.44, sc*0.1); ctx.fill();
  ctx.beginPath(); ctx.roundRect( sc*0.02, sc*3.7, sc*0.56, sc*0.44, sc*0.1); ctx.fill();

  // Head
  ctx.fillStyle='#d4a060';
  ctx.beginPath(); ctx.arc(0,-sc*0.55, sc*0.56, 0, Math.PI*2); ctx.fill();
  // Hair
  ctx.fillStyle='#3a2000';
  ctx.beginPath(); ctx.arc(0,-sc*0.55, sc*0.56, Math.PI, 2*Math.PI); ctx.fill();
  // Eyes
  ctx.fillStyle='#111';
  ctx.beginPath(); ctx.arc(-sc*0.18,-sc*0.62,sc*0.09,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc( sc*0.18,-sc*0.62,sc*0.09,0,Math.PI*2); ctx.fill();

  ctx.restore();
}

/* ─── BALL ────────────────────────────────────────────── */
function drawBall(g, x, y, r, rot, scale){
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(scale,scale);
  ctx.rotate(rot);

  // Shadow
  ctx.save();
  ctx.scale(1,0.28);
  ctx.beginPath(); ctx.arc(0, r*1.8/0.28, r*0.9, 0, Math.PI*2);
  ctx.fillStyle=`rgba(0,0,0,${0.4*scale})`; ctx.fill();
  ctx.restore();

  // Ball body
  const bg=ctx.createRadialGradient(-r*0.28,-r*0.28,0,0,0,r);
  bg.addColorStop(0,'#ffffff');
  bg.addColorStop(0.45,'#e8e8e8');
  bg.addColorStop(1,'#aaaaaa');
  ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2);
  ctx.fillStyle=bg; ctx.fill();

  // Pentagons (simplified)
  ctx.fillStyle='rgba(0,0,0,.82)';
  const pts=[[0,0],[r*0.42,r*0.28],[r*0.24,-r*0.4],[-r*0.38,-r*0.3],[-r*0.44,r*0.22]];
  pts.forEach(([px,py])=>{
    ctx.beginPath();
    for(let i=0;i<5;i++){
      const a=i*Math.PI*2/5 - Math.PI/2;
      const nx=px+Math.cos(a)*r*0.18, ny=py+Math.sin(a)*r*0.18;
      i===0?ctx.moveTo(nx,ny):ctx.lineTo(nx,ny);
    }
    ctx.closePath(); ctx.fill();
  });

  // Shine
  const sh=ctx.createRadialGradient(-r*0.34,-r*0.34,0,-r*0.2,-r*0.2,r*0.4);
  sh.addColorStop(0,'rgba(255,255,255,.65)');
  sh.addColorStop(1,'rgba(255,255,255,0)');
  ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2);
  ctx.fillStyle=sh; ctx.fill();

  ctx.restore();
}

/* ─── TRAIL ───────────────────────────────────────────── */
function drawTrail(trail){
  if(!trail || !trail.points || trail.points.length<2) return;
  const pData = PLAYERS[state.player];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(trail.points[0].x, trail.points[0].y);
  for(let i=1;i<trail.points.length;i++){
    ctx.lineTo(trail.points[i].x, trail.points[i].y);
  }
  ctx.strokeStyle= pData ? pData.trailColor : 'rgba(255,220,80,.5)';
  ctx.lineWidth=6;
  ctx.lineCap='round';
  ctx.globalAlpha=trail.alpha||0.7;
  ctx.stroke();
  ctx.restore();
}

/* ─── SPARKLES (GOAL FX) ─────────────────────────────── */
function drawSparkles(sps){
  sps.forEach(s=>{
    ctx.save();
    ctx.globalAlpha=s.a;
    ctx.fillStyle=s.color;
    ctx.beginPath();
    ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  });
}

/* ─── INITIAL DRAW ────────────────────────────────────── */
drawIdle();

/* ─── ANIMATION ENGINE ────────────────────────────────── */
function animateShot(targetX, targetY, keeperTarget, onDone){
  const g = getGeometry();
  const cfg = DIFF[state.difficulty];
  const pData = PLAYERS[state.player];
  const dur = 700 / cfg.ballSpeed;

  let startTime = null;
  const startX = g.bx, startY = g.by;
  const startR = g.br;
  const trailPoints = [];

  // Keeper target X — three zones: left post area, center, right post area
  const keeperZones = [g.gX + g.gW*0.13, g.W/2, g.gX + g.gW*0.87];
  const keeperDestX = keeperZones[keeperTarget];
  const keeperStartX = g.W/2;
  const keeperY = H_keeperY(g);
  let keeperCurrentX = keeperStartX;

  // Keeper starts moving after reaction time, then uses keeperSpeed to scale how quickly it covers full distance
  const reactionMs = cfg.keeperReactionMs;
  // keeperSpeed=1.0 means full distance in remaining time; <1 means partial coverage
  const coverageFraction = cfg.keeperSpeed;

  function easeOut(t){ return 1 - Math.pow(1-t,3); }
  function easeInOut(t){ return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2; }

  function step(ts){
    if(!startTime) startTime = ts;
    const elapsed = ts - startTime;
    const t = Math.min(elapsed / dur, 1);
    const te = easeOut(t);

    // Ball position (parabolic arc)
    const bx = startX + (targetX - startX) * te;
    const arcH = g.H * 0.24; // arc height
    const by = startY + (targetY - startY) * te - Math.sin(t*Math.PI) * arcH;
    const ballR = startR * (1 - t*0.38); // perspective shrink
    const ballRot = t * 18;
    const ballScale = 1 - t*0.28 + Math.sin(t*Math.PI)*0.12;

    // Trail
    trailPoints.push({x:bx,y:by});
    if(trailPoints.length>18) trailPoints.shift();

    // Keeper movement (delayed by reaction time, then sprints based on speed)
    if(elapsed > reactionMs){
      const kt = Math.min((elapsed - reactionMs)/(dur - reactionMs + 1), 1);
      const eased = easeOut(kt);
      // coverageFraction=1.0 → reaches full dest; 0.55 → reaches 55% of distance
      const actualDest = keeperStartX + (keeperDestX - keeperStartX) * coverageFraction;
      keeperCurrentX = keeperStartX + (actualDest - keeperStartX) * eased;
    }

    drawScene(g, keeperCurrentX, keeperY, t,
      {x:bx,y:by,r:ballR,rot:ballRot,scale:ballScale},
      {points:[...trailPoints],alpha:0.65*(1-t*0.4)},
      null
    );

    if(t < 1){
      requestAnimationFrame(step);
    } else {
      // Impact flash
      setTimeout(()=>onDone(g, keeperCurrentX, targetX, targetY), 80);
    }
  }
  requestAnimationFrame(step);
}

function goalCelebration(g, tx, ty){
  let sps = [];
  for(let i=0;i<34;i++){
    const angle=Math.random()*Math.PI*2;
    const speed=2+Math.random()*4;
    sps.push({
      x:tx, y:ty,
      vx:Math.cos(angle)*speed,
      vy:Math.sin(angle)*speed - 2,
      r:3+Math.random()*5,
      a:1,
      color: ['#f0c96a','#c9963b','#fff0c2','#2dce7a','#ffffff'][Math.floor(Math.random()*5)]
    });
  }
  let frame=0;
  function tick(){
    frame++;
    sps.forEach(s=>{
      s.x+=s.vx; s.y+=s.vy; s.vy+=0.2; s.a-=0.028;
    });
    sps=sps.filter(s=>s.a>0);
    const geo=getGeometry();
    drawScene(geo, geo.W/2, H_keeperY(geo), 0, null, null, sps);
    if(sps.length>0) requestAnimationFrame(tick);
    else { setTimeout(drawIdle,200); }
  }
  requestAnimationFrame(tick);
}

/* ─── SHOOT LOGIC ─────────────────────────────────────── */
function computeTarget(){
  const g = getGeometry();
  const zone = AIM_ZONE[state.aim];
  const cfg = DIFF[state.difficulty];
  const pData = PLAYERS[state.player];

  // Base aim within goal
  const colPad = g.gW * 0.14;
  const rowPad = g.gH * 0.18;
  const colStep = (g.gW - colPad*2) / 2;
  const rowStep = (g.gH - rowPad*2) / 2;

  let tx = g.gX + colPad + zone.col * colStep;
  let ty = g.gY + rowPad + zone.row * rowStep;

  // Add jitter based on difficulty and player's opposing foot penalty
  const wrongFoot = (pData.favFoot !== state.foot);
  const jitterBase = cfg.missChance * g.gW * 0.35;
  const jitterExtra = wrongFoot ? g.gW*0.06 : 0;
  const jitter = (Math.random()*2-1)*jitterBase + (Math.random()*2-1)*jitterExtra;
  const jitterY = (Math.random()*2-1)*jitterBase*0.6;
  tx += jitter;
  ty += jitterY;

  return {tx, ty, g};
}

function didScore(g, keeperTarget, tx, ty){
  const cfg = DIFF[state.difficulty];
  const pData = PLAYERS[state.player];

  // Is ball inside goal?
  const insideGoal = tx > g.gX + 6 && tx < g.gX + g.gW - 6
                  && ty > g.gY + 6 && ty < g.gY + g.gH - 6;

  if(!insideGoal) return 'miss';

  // Where did the ball actually land (column)?
  const ballCol = tx < g.gX + g.gW*0.34 ? 0 : tx < g.gX + g.gW*0.66 ? 1 : 2;
  const keeperCol = keeperTarget;

  if(ballCol === keeperCol){
    // Keeper went to correct column — save chance scales with difficulty + saveRadius
    // Base reach covers ~40% of goal width per side at lenda level
    const baseReach = g.gW * 0.18 * cfg.saveRadius;
    const keeperZones = [g.gX + g.gW*0.13, g.W/2, g.gX + g.gW*0.87];
    const keeperFinalX = keeperZones[keeperCol];

    // Distance from ball to keeper center
    const dist = Math.abs(tx - keeperFinalX);
    // Vertical: top corners are harder to save
    const isTopRow = ty < g.gY + g.gH * 0.38;
    const reachMod = isTopRow ? 0.72 : 1.0;
    const effectiveReach = baseReach * reachMod;

    if(dist < effectiveReach) return 'saved';

    // Even if slightly out of reach, fast keepers have a chance
    const chanceSave = cfg.keeperSpeed * 0.28 * (1 - dist/g.gW);
    if(chanceSave > 0 && Math.random() < chanceSave) return 'saved';
  }

  // Wrong foot tiny miss chance
  if(pData.favFoot !== state.foot && Math.random() < 0.05) return 'miss';

  return 'goal';
}

function shoot(){
  if(state.locked) return;
  state.locked = true;
  $('shootBtn').disabled = true;

  const {tx, ty, g} = computeTarget();
  const keeperTarget = keeperDecision(state.aim, state.difficulty);

  animateShot(tx, ty, keeperTarget, (geo, keeperFinalX, ftx, fty)=>{
    const outcome = didScore(geo, keeperTarget, ftx, fty);
    state.attempts++;

    if(outcome==='goal'){
      state.score++;
      state.streak++;
      if(state.streak>state.bestStreak) state.bestStreak=state.streak;
      updateHUD();
      const msgs=['GOAL! A multidão enlouquece!','Que chute incrível!','GOL! Aura desbloqueada!','Perfeito! O goleiro não teve chance!','GOL! Isso é cinema!'];
      setResult(msgs[Math.floor(Math.random()*msgs.length)],'goal');
      showToast(state.streak>=3?`🔥 Série de ${state.streak}! Imparável!`:'⚽ GOOOOL!');
      goalCelebration(geo, ftx, fty);
    } else if(outcome==='saved'){
      state.streak=0;
      updateHUD();
      const msgs=['Defendido! O goleiro leu o chute.','Grande defesa!','Bloqueado! Tente outro ângulo.','O goleiro se jogou no caminho certo!'];
      setResult(msgs[Math.floor(Math.random()*msgs.length)],'saved');
      showToast('🧤 Defendido! O goleiro foi no canto certo.');
      setTimeout(()=>{ drawIdle(); }, 600);
    } else {
      state.streak=0;
      updateHUD();
      const msgs=['Fora! O chute saiu da meta.','Errou o alvo! Ajuste a mira.','Que erro! Acertou o poste.','Para fora! Concentração!'];
      setResult(msgs[Math.floor(Math.random()*msgs.length)],'miss');
      showToast('❌ Errou! O chute saiu da meta.');
      setTimeout(()=>{ drawIdle(); }, 600);
    }

    setTimeout(()=>{
      state.locked = false;
      $('shootBtn').disabled = false;
    }, 1000);
  });
}

function updateHUD(){
  $('hudScore').textContent = state.score;
  $('hudAttempts').textContent = state.attempts;
  $('hudStreak').textContent = state.streak;
  $('streakBadge').textContent = state.streak;
  $('bestStreak').textContent = state.bestStreak;

  const acc = state.attempts>0 ? Math.round(state.score/state.attempts*100)+'%' : '—';
  $('hudAccuracy').textContent = acc;

  let aura='Rookie';
  if(state.score>=20) aura='⭐ Lenda';
  else if(state.score>=12) aura='🔥 Ícone';
  else if(state.score>=6)  aura='💫 Craque';
  else if(state.score>=3)  aura='⚡ Rising';
  $('hudAura').textContent = aura;
}

function setResult(msg, type){
  const el=$('resultMsg');
  el.textContent=msg;
  el.className='result-msg '+type;
}

/* ─── CONTROLS ────────────────────────────────────────── */
// Difficulty
document.querySelectorAll('.diff-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.diff-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    state.difficulty = btn.dataset.diff;
    showToast({base:'🟢 Modo Base',jogador:'🔵 Modo Jogador',craque:'🟠 Modo Craque',lenda:'🔴 MODO LENDA — Boa sorte!'}[state.difficulty]);
    drawIdle();
  });
});

// Player
document.querySelectorAll('.player-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.player-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    state.player = btn.dataset.player;
  });
});

// Foot
document.querySelectorAll('[data-foot]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-foot]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    state.foot = btn.dataset.foot;
  });
});

// Aim
document.querySelectorAll('.aim-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.aim-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    state.aim = btn.dataset.aim;
  });
});

// Power
const powerTrack = $('powerTrack');
let draggingPower = false;
function setPowerFromEvent(e){
  const rect = powerTrack.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const pct = Math.min(Math.max((clientX-rect.left)/rect.width*100,10),100);
  state.power = Math.round(pct);
  $('powerFill').style.width = pct+'%';
  $('powerVal').textContent = pct+'%';
}
powerTrack.addEventListener('mousedown',e=>{ draggingPower=true; setPowerFromEvent(e); });
powerTrack.addEventListener('touchstart',e=>{ draggingPower=true; setPowerFromEvent(e); },{passive:true});
window.addEventListener('mousemove',e=>{ if(draggingPower) setPowerFromEvent(e); });
window.addEventListener('touchmove',e=>{ if(draggingPower) setPowerFromEvent(e); },{passive:true});
window.addEventListener('mouseup',()=>draggingPower=false);
window.addEventListener('touchend',()=>draggingPower=false);

// Shoot
$('shootBtn').addEventListener('click', shoot);
// Keyboard shortcut
window.addEventListener('keydown',e=>{ if(e.code==='Space'||e.code==='Enter'){ e.preventDefault(); shoot(); }});

/* ─── INITIAL HUD ─────────────────────────────────────── */
updateHUD();