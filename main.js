// Quackstreet Crossing
const W = 1920;
const H = 1080;
const NAME = 'Goosetavo Quillson Swanson the 2nd';
const container = document.getElementById('game-container');
const overlay = document.getElementById('overlay');
const canvas = document.createElement('canvas');
container.appendChild(canvas);
const ctx = canvas.getContext('2d');
let scale = 1;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  const cw = W * scale;
  const ch = H * scale;
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  canvas.style.left = (window.innerWidth - cw) / 2 + 'px';
  canvas.style.top = (window.innerHeight - ch) / 2 + 'px';
  canvas.width = cw * dpr;
  canvas.height = ch * dpr;
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ---------- Audio ----------
const music = new Audio('assets/audio/commute-music.mp3');
music.loop = true;
music.volume = 0.4;
const alarm = new Audio('assets/audio/alarm-clock.mp3');
alarm.loop = true;
const horn = new Audio('assets/audio/car-horn.mp3');
let actx = null;

function unlockAudio() {
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
  }
  actx.resume();
}

function playHorn(pan) {
  if (deaf) {
    return;
  }
  horn.currentTime = 0;
  horn.play().catch(() => {});
}

function playExplosion() {
  if (!actx || deaf) {
    return;
  }
  const len = actx.sampleRate * 1.8;
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  }
  const src = actx.createBufferSource();
  src.buffer = buf;
  const filter = actx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  const g = actx.createGain();
  g.gain.value = 1.2;
  src.connect(filter).connect(g).connect(actx.destination);
  src.start();
}

function makeEngine(car) {
  if (!actx || deaf) {
    return;
  }
  const osc = actx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 70 + Math.random() * 40;
  const filter = actx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 500;
  const gain = actx.createGain();
  gain.gain.value = 0;
  const pan = actx.createStereoPanner();
  osc.connect(filter).connect(gain).connect(pan).connect(actx.destination);
  osc.start();
  car.engine = { osc, gain, pan };
}

function killEngine(car) {
  if (car.engine) {
    car.engine.osc.stop();
    car.engine = null;
  }
}

// ---------- Input ----------
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  unlockAudio();
  if (e.code === 'KeyE' || e.code === 'Space') {
    tryDoor();
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});
window.addEventListener('pointerdown', unlockAudio);

// ---------- State ----------
let state = 'title';
let deaf = false;
let t = 0;
let room = { x: 400, y: 700 };
let player = { x: 0, z: 0 };
let cars = [];
let particles = [];
let flashes = { left: 0, right: 0 };
let fade = 0;

// Road layout: z rows. 0-1 sidewalk, lanes and grass, 10 = work grass.
const LANES = [
  { z: 1, dir: 1 }, { z: 2, dir: -1 },
  { z: 4, dir: 1 }, { z: 5, dir: -1 },
  { z: 7, dir: 1 }, { z: 8, dir: -1 },
];
const GOAL_Z = 9.6;

function rowType(z) {
  const r = Math.floor(z);
  if (LANES.some((l) => l.z === r)) {
    return 'lane';
  }
  if (r <= 0) {
    return 'walk';
  }
  return 'grass';
}

function showOverlay(html, buttons) {
  overlay.innerHTML = html;
  overlay.classList.remove('hidden');
  for (const [label, fn] of buttons) {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => {
      unlockAudio();
      fn();
    };
    overlay.appendChild(b);
  }
}

function hideOverlay() {
  overlay.classList.add('hidden');
  overlay.innerHTML = '';
}

function showTitle() {
  state = 'title';
  deaf = false;
  stopAllAudio();
  showOverlay(
    `<h1>Quackstreet Crossing</h1><p>Help ${NAME} get to work across
three highways. Listen for traffic — while you still can.</p><p>WASD /
Arrows to move · E to open doors · Headphones recommended</p>`,
    [['Start Game', () => startWake(false)]]
  );
}

function stopAllAudio() {
  music.pause();
  alarm.pause();
  cars.forEach(killEngine);
}

function startWake(isDeaf) {
  hideOverlay();
  deaf = isDeaf;
  stopAllAudio();
  state = 'wake';
  t = 0;
  fade = 1;
  if (!deaf) {
    alarm.currentTime = 0;
    alarm.play().catch(() => {});
  }
}

function startRoom() {
  state = 'room';
  alarm.pause();
  room = { x: 420, y: 640 };
  if (!deaf) {
    music.play().catch(() => {});
  }
}

function tryDoor() {
  if (state === 'room' && room.x > 1500 && Math.abs(room.y - 540) < 140) {
    startRoad();
  }
}

function startRoad() {
  state = 'road';
  player = { x: 0, z: 0.3 };
  cars.forEach(killEngine);
  cars = [];
  for (const lane of LANES) {
    lane.timer = Math.random() * 2;
  }
}

function die() {
  state = 'death';
  stopAllAudio();
  const msg = deaf
    ? 'You never heard it coming. No honk, no engine — just silence.'
    : 'Splat! Listen harder for the engines and horns.';
  showOverlay(`<h1>${NAME} got hit!</h1><p>${msg}</p>`, [
    ['Try Again', () => {
      hideOverlay();
      if (!deaf) {
        music.play().catch(() => {});
      }
      startRoad();
    }],
    ['Title Screen', showTitle],
  ]);
}

function reachWork() {
  cars.forEach(killEngine);
  cars = [];
  t = 0;
  if (!deaf) {
    state = 'crash';
  } else {
    state = 'ending';
  }
}

// ---------- Update ----------
function update(dt) {
  t += dt;
  fade = Math.max(0, fade - dt * 0.8);
  if (state === 'wake' && t > 5.5) {
    startRoom();
  } else if (state === 'room') {
    updateRoom(dt);
  } else if (state === 'road') {
    updateRoad(dt);
  } else if (state === 'crash') {
    updateCrash(dt);
  } else if (state === 'ending' && t > 6 &&
overlay.classList.contains('hidden')) {
    showOverlay(`<h1>Made it… late.</h1><p>${NAME} arrived stressed
and panicked after missing the alarm he could not hear. Thanks for
playing.</p>`, [['Play Again', showTitle]]);
  }
  particles = particles.filter((p) => (p.life -= dt) > 0);
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 300 * dt;
  }
}

function axis() {
  const dx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA ||
keys.ArrowLeft ? 1 : 0);
  const dz = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS ||
keys.ArrowDown ? 1 : 0);
  return { dx, dz };
}

function updateRoom(dt) {
  const { dx, dz } = axis();
  room.x = Math.min(1640, Math.max(260, room.x + dx * 420 * dt));
  room.y = Math.min(860, Math.max(260, room.y - dz * 420 * dt));
}

function updateRoad(dt) {
  const { dx, dz } = axis();
  player.x = Math.max(-6, Math.min(6, player.x + dx * 3.2 * dt));
  player.z = Math.max(0.2, player.z + dz * 1.6 * dt);
  const speedMul = deaf ? 1.25 : 1;
  for (const lane of LANES) {
    lane.timer -= dt;
    if (lane.timer <= 0) {
      lane.timer = 1.6 + Math.random() * 2.6;
      const car = { lane, x: -lane.dir * 34, speed: (7 + Math.random()
* 5) * speedMul, honked: false, color: `hsl(${Math.random() *
360},70%,50%)` };
      makeEngine(car);
      cars.push(car);
    }
  }
  flashes.left = Math.max(0, flashes.left - dt * 3);
  flashes.right = Math.max(0, flashes.right - dt * 3);
  const pRow = Math.floor(player.z);
  for (const car of cars) {
    car.x += car.lane.dir * car.speed * dt;
    const rel = car.x - player.x;
    const approaching = rel * car.lane.dir < 0;
    const near = Math.abs(rel) < 16 && approaching;
    const relevantRow = car.lane.z === pRow || car.lane.z === pRow + 1;
    if (near && relevantRow) {
      const side = rel < 0 ? 'left' : 'right';
      flashes[side] = Math.max(flashes[side], 1 - Math.abs(rel) / 16);
    }
    if (car.lane.z === pRow && near && Math.abs(rel) < 12 && !car.honked) {
      car.honked = true;
      playHorn();
    }
    if (car.engine) {
      const dist = Math.hypot(rel, (car.lane.z + 0.5 - player.z) * 3);
      car.engine.gain.gain.value = Math.max(0, 0.25 - dist * 0.012);
      car.engine.pan.pan.value = Math.max(-1, Math.min(1, rel / 8));
    }
    if (car.lane.z === pRow && Math.abs(rel) < 1.1) {
      die();
      return;
    }
  }
  cars = cars.filter((c) => {
    const keep = Math.abs(c.x) < 40;
    if (!keep) {
      killEngine(c);
    }
    return keep;
  });
  if (player.z >= GOAL_Z) {
    reachWork();
  }
}

function burst(x, y, n, colors) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 200 + Math.random() * 700;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s -
300, life: 0.8 + Math.random() * 1.2, r: 8 + Math.random() * 22, c:
colors[i % colors.length] });
  }
}

function updateCrash(dt) {
  if (t > 1.8 && !updateCrash.boom) {
    updateCrash.boom = true;
    playExplosion();
    music.pause();
    burst(900, 760, 140, ['#ffdd33', '#ff7a1a', '#e33', '#555']);
  }
  if (t > 6.5) {
    updateCrash.boom = false;
    startWake(true);
  }
}

// ---------- Drawing ----------
const duckSprite = new Image();
duckSprite.src = 'assets/goosestavo-flipped.png';
const pondImage = new Image();
pondImage.src = 'assets/pixil-frame-0-1-1.png';
const bedImage = new Image();
bedImage.src = 'assets/pixil-frame-0-2.png';
const roomBedImage = new Image();
roomBedImage.src = 'assets/coms-bed.png';
const windowImage = new Image();
windowImage.src = 'assets/coms-window.png';
const alarmFurnitureMorning = new Image();
alarmFurnitureMorning.src = 'assets/drawer-alarm-7.png';
const alarmFurnitureLate = new Image();
alarmFurnitureLate.src = 'assets/drawer-alarm-9-47.png';

function drawDuck(x, y, s, mood) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 60, 54, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  if (duckSprite.complete && duckSprite.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(duckSprite, -70, -80, 140, 140);
  }
  if (mood === 'panic') {
    // Keep the sprite's pixel-art look while adding a small stress cue.
    ctx.fillStyle = '#7cc8ff';
    ctx.fillRect(-50, -55, 8, 8);
    ctx.fillRect(55, -72, 6, 6);
  }
  ctx.restore();
}

function text(str, x, y, size, color = '#fff', font = 'Fredoka') {
  ctx.font = `${size}px ${font}, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0008';
  ctx.fillText(str, x + 3, y + 3);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function bubble(str, x, y) {
  ctx.font = '34px Nunito, sans-serif';
  const w = ctx.measureText(str).width + 50;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 50, w, 70, 20);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.textAlign = 'center';
  ctx.fillText(str, x, y);
}

function drawBedroomSide() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#f7c9a0');
  g.addColorStop(1, '#d99a6c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#8a5a34';
  ctx.fillRect(0, 860, W, 220);
  if (windowImage.complete && windowImage.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(windowImage, 1300, 170, 360, 360);
  } else {
    ctx.fillStyle = '#7fb8ff';
    ctx.fillRect(1300, 200, 360, 260);
  }
  if (bedImage.complete && bedImage.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bedImage, 150, 275, 1320, 660);
  }
  const alarmFurniture = deaf ? alarmFurnitureLate : alarmFurnitureMorning;
  if (alarmFurniture.complete && alarmFurniture.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(alarmFurniture, 900, 420, 560, 560);
  } else {
    // Fallback until the matching combined dresser-and-alarm sprite loads.
    ctx.fillStyle = '#6b3f1f';
    ctx.fillRect(1100, 700, 160, 160);
    ctx.fillStyle = '#e33';
    ctx.beginPath();
    ctx.arc(1180, 650, 45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(1180, 650, 32, 0, Math.PI * 2);
    ctx.fill();
  }
  const shake = !deaf && t < 3 ? Math.sin(t * 60) * 6 : 0;
  if (!deaf && t < 3) {
    text('RING RING!', 1180 + shake, 520, 50, '#ff3');
  }
}

function drawWake() {
  drawBedroomSide();
  const p = Math.min(1, Math.max(0, (t - 3) / 1.5));
  const ease = 1 - (1 - p) ** 3;
  // Start on the enlarged mattress, then step down onto the bedroom floor.
  drawDuck(620 + ease * 690, 690 + ease * 70, 1.3, deaf ? 'panic' : 'normal');
  if (t > 1.5 && t < 4) {
    bubble(deaf ? "Why is it so quiet? …It's 9:47! I'm LATE!" : "The
alarm! I've got to get to work!", 760, 400);
  }
  if (deaf && t > 4) {
    bubble("I can't hear anything…", 1060, 600);
  }
}

function drawRoom() {
  ctx.fillStyle = '#c48a5c';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#a8703f';
  for (let i = 0; i < 12; i++) {
    ctx.fillRect(200, 200 + i * 60, 1520, 3);
  }
  ctx.strokeStyle = '#5a3a20';
  ctx.lineWidth = 40;
  ctx.strokeRect(200, 200, 1520, 720);
  if (roomBedImage.complete && roomBedImage.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(roomBedImage, 210, 205, 360, 360);
  } else {
    ctx.fillStyle = '#5a8dee';
    ctx.fillRect(240, 240, 260, 340);
    ctx.fillStyle = '#fff';
    ctx.fillRect(260, 250, 220, 70);
  }
  ctx.fillStyle = '#7a4a22';
  ctx.fillRect(1700, 440, 40, 200);
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.arc(1708, 545, 8, 0, Math.PI * 2);
  ctx.fill();
  drawDuck(room.x, room.y, 0.9, deaf ? 'panic' : 'normal');
  if (room.x > 1500 && Math.abs(room.y - 540) < 140) {
    text('Press E to open the door', 1500, 400, 40, '#ffe680');
  } else {
    text('Walk to the door → (WASD / Arrows)', W / 2, 120, 40);
  }
}

function project(dz) {
  const d = Math.max(0.15, dz);
  return 420 + 420 / d;
}

function drawRoad() {
  if (pondImage.complete && pondImage.naturalWidth > 0) {
    // Use the pond artwork as the full approach backdrop; highway
rows layer over it.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pondImage, 0, 0, W, H);
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1e3c8c');
    sky.addColorStop(1, '#8ec5ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
  }
  // rows far to near
  const startRow = Math.floor(player.z) - 1;
  for (let r = 11; r >= startRow; r--) {
    const yTop = project(r + 1 - player.z + 0.3);
    const yBot = project(r - player.z + 0.3);
    if (yBot < 420) {
      continue;
    }
    const type = rowType(r + 0.5);
    // The pond artwork already includes the destination lawn; don't
cover it with a flat green band.
    if (type === 'grass' && r >= 9) {
      continue;
    }
    ctx.fillStyle = type === 'lane' ? (r % 2 ? '#3d3d44' : '#45454d')
: type === 'walk' ? '#b9b0a2' : '#4bb04a';
    ctx.fillRect(0, yTop, W, Math.min(H, yBot) - yTop);
    if (type === 'lane') {
      ctx.fillStyle = '#ffd34d';
      ctx.fillRect(0, yTop, W, Math.max(1, (yBot - yTop) * 0.03));
    }
  }
  // visible cars (only those directly in front)
  const visible = cars.filter((c) => c.lane.z + 0.5 - player.z >
-0.2).sort((a, b) => b.lane.z - a.lane.z);
  for (const c of visible) {
    const d = c.lane.z + 0.5 - player.z + 0.3;
    const y = project(d);
    const s = 1 / Math.max(0.2, d);
    const sx = W / 2 + (c.x - player.x) * 300 * s;
    if (sx < -400 * s || sx > W + 400 * s) {
      continue;
    }
    drawCarSide(sx, y, s * 0.9, c.lane.dir, c.color);
  }
  // first-person beak at bottom
  ctx.fillStyle = '#ff9a1f';
  ctx.beginPath();
  ctx.ellipse(W / 2, H + 40, 160, 90, 0, 0, Math.PI * 2);
  ctx.fill();
  // side flashes
  for (const side of ['left', 'right']) {
    const a = flashes[side];
    if (a > 0.02) {
      const x0 = side === 'left' ? 0 : W - 200;
      const g = ctx.createLinearGradient(side === 'left' ? 0 : W, 0,
side === 'left' ? 200 : W - 200, 0);
      g.addColorStop(0, `rgba(255,240,170,${a * 0.75})`);
      g.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x0, 0, 200, H);
    }
  }
  const zone = rowType(player.z);
  text(deaf ? 'Silence… watch the edges of your vision' : 'Listen for
engines & horns', W / 2, 60, 36, deaf ? '#ff9' : '#fff', 'Nunito');
  text(`Highway ${Math.min(3, Math.floor(player.z / 3) + 1)} of 3 ·
${zone === 'lane' ? 'ON THE ROAD' : 'safe'}`, W / 2, 110, 30, zone ===
'lane' ? '#f66' : '#9f9', 'Nunito');
}

function drawCarSide(x, y, s, dir, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * dir, s);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 260, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillRect(-240, -150, 480, 110);
  ctx.beginPath();
  ctx.roundRect(-140, -240, 260, 100, 30);
  ctx.fill();
  ctx.fillStyle = '#bde';
  ctx.fillRect(-120, -225, 100, 70);
  ctx.fillRect(0, -225, 100, 70);
  ctx.fillStyle = '#ffef8a';
  ctx.fillRect(220, -130, 30, 30);
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(-150, -35, 45, 0, Math.PI * 2);
  ctx.arc(150, -35, 45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStreetScene() {
  if (pondImage.complete && pondImage.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pondImage, 0, 0, W, H);
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#2c4fa8');
    sky.addColorStop(1, '#9fd0ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#5fcf5a';
    ctx.fillRect(0, 800, W, 280);
  }
}

function drawCrash() {
  const shake = t > 1.8 && t < 3 ? (Math.random() - 0.5) * 40 : 0;
  ctx.save();
  ctx.translate(shake, shake);
  drawStreetScene();
  if (t < 1.8) {
    drawDuck(1000 + t * 80, 740, 1, 'normal');
    const p = t / 1.8;
    drawCarSide(-300 + p * 1350, 800 - Math.sin(p * Math.PI) * 60,
0.8, 1, '#c22');
    if (t > 0.8) {
      bubble('SCREEEECH!', 600, 400);
    }
  } else {
    drawCarSide(1000, 800, 0.8, 1, '#311');
  }
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life);
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (t > 1.8 && t < 2.2) {
    ctx.fillStyle = `rgba(255,255,220,${1 - (t - 1.8) / 0.4})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
  if (t > 3.5) {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (t - 3.5) / 1.5)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (t > 5) {
    text('Ringing… then nothing.', W / 2, H / 2, 60, '#aaa');
  }
}

function drawEnding() {
  drawStreetScene();
  const p = Math.min(1, t / 3);
  const shake = Math.sin(t * 40) * 4;
  drawDuck(300 + p * 1150 + shake, 740, 1, 'panic');
  if (t > 1) {
    bubble("I'm so late! I'm so late!", 900, 450);
  }
  text('10:15 AM', 1450, 150, 60, '#f55');
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  if (state === 'title' || state === 'death') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a2a6c');
    g.addColorStop(1, '#3a7bd5');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    drawDuck(W / 2, 880, 1.2, state === 'death' ? 'panic' : 'normal');
  } else if (state === 'wake') {
    drawWake();
  } else if (state === 'room') {
    drawRoom();
  } else if (state === 'road') {
    drawRoad();
  } else if (state === 'crash') {
    drawCrash();
  } else if (state === 'ending') {
    drawEnding();
  }
  if (fade > 0) {
    ctx.fillStyle = `rgba(0,0,0,${fade})`;
    ctx.fillRect(0, 0, W, H);
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

showTitle();
requestAnimationFrame(loop);
