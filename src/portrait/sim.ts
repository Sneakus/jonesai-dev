// The clay portrait, ported from reference/portrait-prototype.html.
// Every timing, size and count below is the number from that file.

export type PortraitEye = {
  r0: number;
  r1: number;
  c0: number;
  c1: number;
  iris: number[][];
};

export type PortraitData = {
  fps: number;
  rows: string[];
  deltas: string[];
  ramp: string;
  cols: number;
  idle: number[];
  eyes: PortraitEye[][];
  pieces?: number;
};

export type PortraitRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PortraitLayout = {
  vw: number;
  vh: number;
  scrollX: number;
  scrollY: number;
  dpr: number;
  tray: PortraitRect;
  leverLeft: number;
  portrait: PortraitRect;
  looks: PortraitRect[];
};

export type PortraitView = {
  fx: CanvasRenderingContext2D | null;
  face: CanvasRenderingContext2D | null;
};

type LivePiece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  shape: number[][];
  color: string;
  flutter: number;
  cell: number;
};

type SettledPiece = {
  x: number;
  hy: number;
  sy: number;
  cell: number;
  size: number;
  shape: number[][];
  rot: number;
  color: string;
  _lift: number;
  _land: number;
};

type Flight = {
  i: number;
  src: SettledPiece;
  started: boolean;
  rot0: number;
  shape: number[][];
  color: string;
  tLift: number;
  tLand: number;
  t: number;
  hx: number;
  hy: number;
  ph: number;
  wob: number;
  sx: number;
  sy: number;
  lx: number;
  ly: number;
};

type EffectName = "words" | "decode" | "swarm" | "balloon";

const CLAY = ["#E8480C", "#E8480C", "#E8480C", "#C93F0B", "#F06A33"];
const TIERS = ["#E8480C", "#B8390A", "#782608"];
const COLW = 3;
const PILE_H = 300;
const EFFECTS: EffectName[] = ["words", "decode", "swarm", "balloon"];
const DUR: Record<EffectName, number> = {
  words: 3.6,
  decode: 2.6,
  balloon: 1.7,
  swarm: 9,
};
const NECK = 80;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function ease(t: number) {
  t = clamp(t, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export class PortraitSim {
  readonly full: number;
  readonly perClay: number;
  readonly fps: number;
  readonly nr: number;
  readonly cols: number;
  readonly sc: number;

  reduce: boolean;
  accountDraw = false;
  vw = 1;
  vh = 1;
  dpr = 1;
  scrollX = 0;
  scrollY = 0;
  wallX = 1e9;
  floorY = 0;
  trayTop = 0;
  trayHeight = 340;
  pw = 0;
  ph = 0;
  cw = 0;
  ch = 0;
  winH = 0;
  winTarget = 0;
  pendingScroll = 0;
  built = 0;
  pos = 0;
  vel = 0;
  dragging = false;
  latched = false;
  warns = 0;
  slam = 0;
  smashed = 0;
  now = 0;
  muted = false;
  lastEffect: EffectName | null = null;
  effect: { type: EffectName; t: number } | null = null;
  onSpeak: (() => void) | null = null;
  onThunk: ((big: boolean) => void) | null = null;
  onTick: (() => void) | null = null;

  private readonly random: () => number;
  private readonly ramp: string;
  private readonly topv: number;
  private readonly frames: number[][][];
  private readonly idle: number[];
  private readonly eyes: PortraitEye[][];
  private readonly n: number;
  private readonly shape: Float32Array;
  private readonly jx: Float32Array;
  private readonly jy: Float32Array;
  private readonly depth: Float32Array;
  private readonly ox: Float32Array;
  private readonly oy: Float32Array;
  private readonly springX: Float32Array;
  private readonly springY: Float32Array;
  private readonly here: Uint8Array;
  private readonly vmax: Float32Array;
  private readonly rnd1: Float32Array;
  private readonly rnd2: Float32Array;
  private readonly regArrive: Float64Array;
  private queue: number[] = [];
  private queuePos = 0;
  private builtCount = 0;
  private heights: number[] = [];
  private settled: SettledPiece[] = [];
  private live: LivePiece[] = [];
  private flights: Flight[] = [];
  private portrait: PortraitRect = { left: 0, top: 0, width: 1, height: 1 };
  private looks: PortraitRect[] = [];
  private pile: HTMLCanvasElement | null = null;
  private pctx: CanvasRenderingContext2D | null = null;
  private grabTarget = 0;
  private dragStart = 0;
  private posStart = 0;
  private lastNotch = 0;
  private autoPull = false;
  private snapping = false;
  private pendingSpeak = false;
  private speakReady = false;
  private dropLeftovers = false;
  private pileDirty = false;
  private pileRedrawAt = 0;
  private lastTick = 0;
  private pointer = { x: -9999, y: -9999, inside: false, vx: 0, vy: 0 };
  private par = { x: 0, y: 0 };
  private parT = { x: 0, y: 0 };
  private gaze = { x: 0, y: 0 };
  private gazeT = { x: 0, y: 0 };
  private lastPointer = 0;
  private glanceUntil = 0;
  private lookAround = 0;
  private blinkUntil = 0;
  private nextBlink = 2000;
  private idlePos = 0;
  private idleDir = 1;
  private idleClock = 0;
  private dozing = false;
  private dozeLevel = 0;
  private lastScroll = 0;
  private lastClient = { x: 0, y: 0, t: 0 };
  private crossEyes = false;
  private trayLeft = 0;
  private effIdx = 0;
  private wordPts: number[][] = [];
  private headCol: number;
  private headRow = 45;
  private swarmX: Float32Array;
  private swarmY: Float32Array;
  private swarmVx: Float32Array;
  private swarmVy: Float32Array;
  private away: Uint8Array;
  private retT0: Float32Array;
  private retD: Float32Array;
  private retX: Float32Array;
  private retY: Float32Array;
  private retVx: Float32Array;
  private retVy: Float32Array;
  private swarmHome = false;
  private swarmHomeT = 0;
  private flockT = 0;
  private furthestRight = 0;
  private heapCrossed = false;

  constructor(
    data: PortraitData,
    options?: { reduce?: boolean; random?: () => number },
  ) {
    this.reduce = options?.reduce ?? false;
    this.random = options?.random ?? Math.random;
    this.fps = data.fps;
    this.cols = data.cols;
    this.idle = data.idle;
    this.eyes = data.eyes;
    this.ramp = ` ${data.ramp}`;
    this.topv = this.ramp.length - 1;
    this.sc = Math.floor(this.cols / 2);

    const grid = data.rows.map((row) =>
      row.split("").map((ch) => (ch === " " ? 0 : this.ramp.indexOf(ch))),
    );
    this.nr = grid.length;
    this.frames = [grid.map((row) => row.slice())];
    for (const delta of data.deltas) {
      const bin = atob(delta);
      for (let k = 0; k < bin.length; k += 3) {
        const p = bin.charCodeAt(k) | (bin.charCodeAt(k + 1) << 8);
        const v = bin.charCodeAt(k + 2);
        grid[Math.floor(p / this.cols)][p % this.cols] = v;
      }
      this.frames.push(grid.map((row) => row.slice()));
    }

    this.n = this.sc * this.nr;
    this.headCol = this.sc / 2;
    this.shape = new Float32Array(this.n * 6);
    this.jx = new Float32Array(this.n);
    this.jy = new Float32Array(this.n);
    this.depth = new Float32Array(this.n);
    this.ox = new Float32Array(this.n);
    this.oy = new Float32Array(this.n);
    this.springX = new Float32Array(this.n);
    this.springY = new Float32Array(this.n);
    this.here = new Uint8Array(this.n);
    this.vmax = new Float32Array(this.n);
    this.rnd1 = new Float32Array(this.n);
    this.rnd2 = new Float32Array(this.n);
    this.regArrive = new Float64Array(this.n).fill(-1e9);
    this.swarmX = new Float32Array(this.n);
    this.swarmY = new Float32Array(this.n);
    this.swarmVx = new Float32Array(this.n);
    this.swarmVy = new Float32Array(this.n);
    this.away = new Uint8Array(this.n);
    this.retT0 = new Float32Array(this.n);
    this.retD = new Float32Array(this.n);
    this.retX = new Float32Array(this.n);
    this.retY = new Float32Array(this.n);
    this.retVx = new Float32Array(this.n);
    this.retVy = new Float32Array(this.n);

    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < this.n; i += 1) {
      const a = rnd() * 6.283;
      for (let k = 0; k < 3; k += 1) {
        const ang = a + k * 2.09 + (rnd() - 0.5) * 0.8;
        const rr = 0.6 + rnd() * 0.4;
        this.shape[i * 6 + k * 2] = Math.cos(ang) * rr;
        this.shape[i * 6 + k * 2 + 1] = Math.sin(ang) * rr;
      }
      this.jx[i] = (rnd() - 0.5) * 0.35;
      this.jy[i] = (rnd() - 0.5) * 0.35;
      const r = Math.floor(i / this.sc);
      const s = i % this.sc;
      const dxn = (s - this.sc * 0.5) / (this.sc * 0.5);
      const dyn = (r - this.nr * 0.46) / (this.nr * 0.5);
      this.depth[i] =
        Math.max(0, 1 - Math.sqrt(dxn * dxn * 1.4 + dyn * dyn)) + rnd() * 0.15;
      this.rnd1[i] = this.random();
      this.rnd2[i] = this.random();
    }

    const list: { i: number; key: number }[] = [];
    for (let i = 0; i < this.n; i += 1) {
      const r = Math.floor(i / this.sc);
      const s = i % this.sc;
      let m = 0;
      for (let f = 0; f < this.frames.length; f += 1) {
        const vv =
          (this.frames[f][r][s * 2] + this.frames[f][r][s * 2 + 1]) /
          (2 * this.topv);
        if (vv > m) {
          m = vv;
        }
      }
      this.vmax[i] = m;
      if (m > 0.04) {
        list.push({ i, key: r + this.random() * 10 });
      }
    }
    this.full = list.length;
    this.perClay = Math.ceil(this.full / 25);
    list.sort((a, b) => b.key - a.key);
    this.queue = list.map((item) => item.i);
    for (let q = this.queue.length - 1; q > 0; q -= 1) {
      const j = Math.floor(this.random() * (q + 1));
      const t = this.queue[q];
      this.queue[q] = this.queue[j];
      this.queue[j] = t;
    }

    const xs: number[] = [];
    const f0 = this.frames[0];
    for (let r = 0; r < NECK - 5; r += 1) {
      for (let s = 0; s < this.sc; s += 1) {
        if ((f0[r][s * 2] + f0[r][s * 2 + 1]) / (2 * this.topv) > 0.04) {
          xs.push(s);
        }
      }
    }
    xs.sort((a, b) => a - b);
    if (xs.length) {
      this.headCol =
        (xs[Math.floor(xs.length * 0.05)] + xs[Math.floor(xs.length * 0.95)]) /
        2;
    }
  }

  sync(layout: PortraitLayout) {
    const nextVw = layout.vw;
    this.vh = layout.vh;
    this.scrollX = layout.scrollX;
    this.scrollY = layout.scrollY;
    this.dpr = Math.min(layout.dpr || 1, 2);
    this.trayTop = layout.tray.top;
    this.trayLeft = layout.tray.left;
    this.trayHeight = layout.tray.height;
    this.floorY = layout.tray.top + layout.scrollY + layout.tray.height - 8;
    this.wallX = layout.leverLeft + layout.scrollX - 4;
    this.portrait = layout.portrait;
    this.looks = layout.looks;
    if (nextVw !== this.vw || this.heights.length === 0) {
      this.vw = nextVw;
      this.rebuildPile();
    }
  }

  sizePortrait(pw: number) {
    this.pw = pw;
    this.ph = (pw * (this.nr * 1.07)) / (this.cols * 0.6);
    this.cw = this.pw / this.sc;
    this.ch = this.ph / this.nr;
    if (this.built >= 1 && this.flights.length === 0) {
      this.setWindow(this.ph);
    }
  }

  headPieces() {
    let count = 0;
    for (let i = 0; i < this.n; i += 1) {
      if (this.vmax[i] > 0.04 && Math.floor(i / this.sc) < NECK) {
        count += 1;
      }
    }
    return count;
  }

  remaining() {
    return this.full - this.builtCount;
  }

  piecesIn() {
    let count = 0;
    for (const piece of this.settled) {
      if (piece.cell >= 0) {
        count += 1;
      }
    }
    return count;
  }

  isFull() {
    const left = this.remaining();
    return left > 0 && this.piecesIn() >= left;
  }

  reservoir() {
    const total = this.remaining();
    const n = Math.min(this.piecesIn(), total);
    const share = total ? Math.min(1, n / total) : 0;
    return { n, total, share, full: this.isFull() };
  }

  hintMode(): "needs" | "progress" | "full" | "clear" {
    if (this.built >= 1) {
      return "clear";
    }
    const { n } = this.reservoir();
    if (n === 0) {
      return "needs";
    }
    if (!this.isFull()) {
      return "progress";
    }
    return "full";
  }

  faceAudit() {
    let missing = 0;
    let strays = 0;
    for (let i = 0; i < this.n; i += 1) {
      if (this.vmax[i] > 0.04 && !this.here[i]) {
        missing += 1;
      }
      if (this.vmax[i] <= 0.04 && this.here[i]) {
        strays += 1;
      }
    }
    return { pieces: this.full, missing, strays };
  }

  pileAudit() {
    return {
      pieces: this.settled.length,
      tallest: this.heights.length ? Math.max(...this.heights) : 0,
      falling: this.live.length,
      furthestRight: Math.round(this.furthestRight),
      wall: Math.round(this.wallX),
      crossed: this.heapCrossed,
    };
  }

  smash(px: number, py: number) {
    for (let n = 0; n < this.perClay; n += 1) {
      let cell = -1;
      let shard: { size: number; shape: number[][]; color: string };
      if (this.queuePos < this.queue.length) {
        cell = this.queue[this.queuePos];
        this.queuePos += 1;
        shard = this.faceShard(cell);
      } else {
        const sz = 3 + this.random() * 4;
        shard = {
          size: sz,
          shape: this.makeShape(sz),
          color: CLAY[Math.floor(this.random() * CLAY.length)],
        };
      }
      const a = this.random() * Math.PI * 2;
      const hard = this.random() < 0.25;
      const sp = hard ? 220 + this.random() * 260 : 40 + this.random() * 180;
      this.live.push({
        x: px + (this.random() - 0.5) * 24,
        y: py + (this.random() - 0.5) * 8,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (hard ? 220 : 120),
        rot: this.random() * 6.28,
        vr: (this.random() - 0.5) * 16,
        size: shard.size,
        shape: shard.shape,
        color: shard.color,
        flutter: this.random() * 6.28,
        cell,
      });
    }
    this.smashed += 1;
    if (this.reduce) {
      for (const piece of this.live) {
        this.land(piece, false);
      }
      this.live = [];
    }
  }

  leverDown(clientY: number) {
    if (this.latched) {
      return;
    }
    this.dragging = true;
    this.dragStart = clientY;
    this.posStart = this.pos;
    this.grabTarget = this.pos;
  }

  leverMove(clientY: number) {
    if (!this.dragging) {
      return;
    }
    this.grabTarget = clamp(
      this.posStart + (clientY - this.dragStart) / 150,
      0,
      this.stuckLimit(),
    );
  }

  leverUp() {
    if (!this.dragging) {
      return;
    }
    this.dragging = false;
    if (!this.latched && !this.isFull() && this.pos > 0.03) {
      this.warn();
    }
  }

  leverKey() {
    if (this.latched) {
      return;
    }
    if (!this.isFull()) {
      this.vel = 2.5;
      this.warn();
      return;
    }
    this.autoPull = true;
  }

  movePointer(clientX: number, clientY: number, now: number) {
    this.active(now);
    this.lastPointer = now;
    this.lastClient = { x: clientX, y: clientY, t: now };
    const rect = this.portrait;
    const nx = clientX - rect.left;
    const ny = clientY - rect.top;
    this.pointer.vx = this.pointer.inside ? (nx - this.pointer.x) * 30 : 0;
    this.pointer.vy = this.pointer.inside ? (ny - this.pointer.y) * 30 : 0;
    this.pointer.x = nx;
    this.pointer.y = ny;
    this.pointer.inside =
      nx >= -20 && nx <= rect.width + 20 && ny >= -20 && ny <= rect.height + 20;
    const eye = this.eyeScreen();
    this.gazeT.x = clamp((clientX - eye.x) / (eye.w * 0.45), -1, 1);
    this.gazeT.y = clamp(
      (clientY - eye.y) / (Math.max(1, eye.h) * 0.45),
      -1,
      1,
    );
    this.parT.x = clamp((clientX - eye.x) / (this.vw * 0.5), -1, 1);
    this.parT.y = clamp((clientY - eye.y) / (this.vh * 0.5), -1, 1);
  }

  leavePortrait() {
    this.pointer.inside = false;
  }

  noteScroll(scrollY: number, now: number) {
    this.active(now);
    const dir = scrollY > this.lastScroll ? 1 : -1;
    this.lastScroll = scrollY;
    this.gazeT.y = dir;
    this.glanceUntil = now + 700;
  }

  noteKey(now: number) {
    this.active(now);
  }

  pressFace() {
    if (this.effect?.type === "swarm" && this.effect.t > 0.4) {
      this.sendHome();
    }
  }

  tryClick(moved: number, elapsed: number) {
    if (moved < 10 && elapsed < 350) {
      this.startEffect();
    }
  }

  startEffect() {
    if (this.effect || this.flights.length || this.built < 1) {
      return;
    }
    const type = this.reduce
      ? "decode"
      : EFFECTS[this.effIdx % EFFECTS.length];
    if (!this.reduce) {
      this.effIdx += 1;
    }
    if (type === "words") {
      this.makeWords();
    }
    this.effect = { type, t: 0 };
    if (type === "swarm") {
      this.startSwarm();
    }
  }

  step(
    dt: number,
    now: number,
    view?: PortraitView | null,
    audio?: { speaking: boolean; time: number },
  ) {
    this.now = now;
    const fx = view?.fx ?? null;
    const face = view?.face ?? null;

    if (this.reduce && this.live.length) {
      for (const piece of this.live) {
        this.land(piece, false);
      }
      this.live = [];
    }

    for (let i = this.live.length - 1; i >= 0; i -= 1) {
      const p = this.live[i];
      p.vy += 900 * dt;
      p.vx *= 0.35 ** dt;
      const term = 700 + p.size * 30;
      if (p.vy > term) {
        p.vy += (term - p.vy) * Math.min(1, 3 * dt);
      }
      p.flutter += dt * (3 + p.size * 0.2);
      p.x += (p.vx + Math.sin(p.flutter) * 10) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.y > this.floorY - 340 && p.x > this.wallX - p.size) {
        p.x = this.wallX - p.size;
        p.vx = -Math.abs(p.vx) * 0.3;
      }
      p.x = clamp(p.x, 8, this.vw - 8);
      const column = this.colOf(p.x);
      if (p.y >= this.floorY - (this.heights[column] ?? 0)) {
        this.live.splice(i, 1);
        this.land(p, false);
      }
    }

    let arrivedAll = this.flights.length > 0;
    if (fx) {
      fx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      fx.clearRect(0, 0, this.vw, this.vh);
    }
    const flyBy: Record<string, Path2D> = {};
    let removed = false;
    const floorScreen = this.trayTop + this.trayHeight - 8;
    let topRow = this.nr;
    for (let f = this.flights.length - 1; f >= 0; f -= 1) {
      const fl = this.flights[f];
      fl.t += dt;
      if (fl.t < fl.tLift) {
        arrivedAll = false;
        continue;
      }
      if (!fl.started) {
        fl.started = true;
        fl.sx = fl.src.x - this.scrollX;
        fl.sy = floorScreen - fl.src.hy;
        const at = this.settled.indexOf(fl.src);
        if (at >= 0) {
          this.settled.splice(at, 1);
          removed = true;
        }
      }
      const r5 = Math.floor(fl.i / this.sc);
      const s5 = fl.i % this.sc;
      const tx =
        this.portrait.left + (s5 + 0.5 + this.jx[fl.i]) * this.cw;
      const ty =
        this.portrait.top + (r5 + 0.5 + this.jy[fl.i]) * this.ch;
      const hx5 = fl.hx + Math.sin(fl.t * 1.7 + fl.ph) * fl.wob;
      const hy5 =
        this.trayTop +
        fl.hy +
        Math.cos(fl.t * 1.3 + fl.ph) * fl.wob * 0.6;
      let x = 0;
      let y = 0;
      let a3 = 0;
      if (fl.t < fl.tLift + 0.6) {
        const u1 = ease((fl.t - fl.tLift) / 0.6);
        x = fl.sx + (hx5 - fl.sx) * u1;
        y = fl.sy + (hy5 - fl.sy) * u1 - Math.sin(u1 * Math.PI) * 30;
        a3 = fl.rot0 + u1 * 2;
      } else if (fl.t < fl.tLand) {
        x = hx5;
        y = hy5;
        a3 = fl.rot0 + 2 + Math.sin(fl.t * 2 + fl.ph) * 0.6;
        fl.lx = x;
        fl.ly = y;
      } else {
        const u2 = Math.min(1, (fl.t - fl.tLand) / 0.7);
        const e2 = ease(u2);
        if (!fl.lx) {
          fl.lx = hx5;
          fl.ly = hy5;
        }
        if (u2 >= 1) {
          this.here[fl.i] = 1;
          this.regArrive[fl.i] = now;
          if (now - this.lastTick > 45) {
            this.onTick?.();
            this.lastTick = now;
          }
          this.flights.splice(f, 1);
          if (r5 < topRow) {
            topRow = r5;
          }
          continue;
        }
        x = fl.lx + (tx - fl.lx) * e2;
        y = fl.ly + (ty - fl.ly) * e2 - Math.sin(u2 * Math.PI) * 40;
        a3 = (fl.rot0 + 2) * (1 - e2);
      }
      arrivedAll = false;
      if (y < -30 || y > this.vh + 30) {
        continue;
      }
      this.paintShard(fx, flyBy, fl.color, fl.shape, x, y, a3);
    }

    if (topRow < this.nr) {
      this.winTarget = Math.max(
        this.winTarget,
        Math.min(this.ph, this.ph - topRow * this.ch + 18),
      );
    }
    if (this.built >= 1 && !this.flights.length) {
      this.winTarget = this.ph;
    }
    if (this.winH < this.winTarget - 0.3) {
      this.setWindow(
        this.winH + (this.winTarget - this.winH) * Math.min(1, dt * 7),
      );
    } else if (
      this.winH !== this.winTarget &&
      Math.abs(this.winTarget - this.winH) <= 0.3
    ) {
      this.setWindow(this.winTarget);
    }
    this.fillGroups(fx, flyBy);
    if (removed) {
      this.pileDirty = true;
    }

    if (
      this.dropLeftovers &&
      this.flights.every((fl) => fl.started)
    ) {
      this.dropLeftovers = false;
      const left = this.settled;
      this.settled = [];
      this.heights.fill(0);
      this.pileDirty = true;
      for (const s of left) {
        this.live.push({
          x: s.x,
          y: this.floorY - s.hy,
          vx: 0,
          vy: 0,
          rot: s.rot,
          vr: 0,
          size: s.size,
          shape: s.shape,
          color: s.color,
          flutter: 0,
          cell: s.cell,
        });
      }
    }
    if (this.pileDirty && now > this.pileRedrawAt) {
      this.redrawPile();
      this.pileDirty = false;
      this.pileRedrawAt = now + 90;
    }

    const byCol: Record<string, Path2D> = {};
    for (const piece of this.live) {
      const ly = piece.y - this.scrollY;
      if (ly < -30 || ly > this.vh + 30) {
        continue;
      }
      this.paintShard(
        fx,
        byCol,
        piece.color,
        piece.shape,
        piece.x - this.scrollX,
        ly,
        piece.rot,
      );
    }
    this.fillGroups(fx, byCol);
    const pileTop = this.floorY - PILE_H - this.scrollY;
    if (
      fx &&
      this.pile &&
      pileTop < this.vh &&
      pileTop + PILE_H > 0
    ) {
      fx.drawImage(
        this.pile,
        0,
        0,
        this.pile.width,
        this.pile.height,
        -this.scrollX,
        pileTop,
        this.vw,
        PILE_H,
      );
    }
    if (this.pendingSpeak && arrivedAll && this.flights.length === 0) {
      this.pendingSpeak = false;
      this.onSpeak?.();
    } else if (this.pendingSpeak && this.speakReady) {
      this.pendingSpeak = false;
      this.speakReady = false;
      this.onSpeak?.();
    }
    this.stepLever(dt);
    this.updateAttention(dt, now, Boolean(audio?.speaking));
    const grid = audio?.speaking
      ? this.frames[
          Math.min(this.frames.length - 1, Math.floor(audio.time * this.fps))
        ]
      : this.idleGrid(dt, now);
    this.drawFace(grid, dt, now, face, fx);
  }

  flightsLength() {
    return this.flights.length;
  }

  popHeadPieces() {
    return this.popHead();
  }

  private stuckLimit() {
    return this.isFull() ? 1 : 0.1;
  }

  private warn() {
    this.warns += 1;
  }

  private active(now: number) {
    const was = this.dozing;
    if (was) {
      this.dozing = false;
      this.blinkUntil = now + 140;
    }
  }

  private eyeScreen() {
    const rect = this.portrait;
    return {
      x: rect.left + rect.width * 0.5,
      y: rect.top + rect.height * (46 / this.nr),
      w: rect.width,
      h: rect.height,
    };
  }

  private colOf(x: number) {
    const wallCol = Math.floor((this.wallX - 6) / COLW);
    return Math.max(
      0,
      Math.min(Math.min(this.heights.length - 1, wallCol), Math.round(x / COLW)),
    );
  }

  private faceShard(i: number) {
    const v = this.vmax[i];
    const size = this.cw * 0.95 * Math.sqrt(v);
    const b = i * 6;
    return {
      size,
      shape: [
        [this.shape[b] * size, this.shape[b + 1] * size],
        [this.shape[b + 2] * size, this.shape[b + 3] * size],
        [this.shape[b + 4] * size, this.shape[b + 5] * size],
      ],
      color: TIERS[v < 0.6 ? 0 : v < 0.85 ? 1 : 2],
    };
  }

  private makeShape(size: number) {
    const pts: number[][] = [];
    const n = 3 + Math.floor(this.random() * 2);
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2 + (this.random() - 0.5) * 0.9;
      const r = size * (0.45 + this.random() * 0.55);
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  }

  private land(p: LivePiece, replay: boolean) {
    let c = this.colOf(p.x);
    const span = Math.max(1, Math.round(p.size / COLW / 2));
    c = Math.min(c, Math.floor((this.wallX - 6) / COLW) - span);
    for (let t = 0; t < 60; t += 1) {
      const here = this.heights[c] ?? 0;
      let dir = this.random() < 0.5 ? -1 : 1;
      let moved = false;
      const wallCol = Math.min(
        this.heights.length - 1,
        Math.floor((this.wallX - 6) / COLW) - span,
      );
      for (let k = 0; k < 2; k += 1) {
        const n = c + dir * (1 + span);
        if (
          n >= 0 &&
          n <= wallCol &&
          (this.heights[n] ?? 0) <
            here - Math.max(0.25, p.size * (0.06 + this.random() * 0.06))
        ) {
          c = n;
          moved = true;
          break;
        }
        dir = -dir;
      }
      if (!moved) {
        break;
      }
    }
    let top = 0;
    for (let i = c - span; i <= c + span; i += 1) {
      if (i >= 0 && i < this.heights.length) {
        top = Math.max(top, this.heights[i]);
      }
    }
    const y = Math.min(250, top + p.size * 0.13);
    for (let j = c - span; j <= c + span; j += 1) {
      if (j >= 0 && j < this.heights.length) {
        this.heights[j] = Math.max(this.heights[j], y);
      }
    }
    const sx = c * COLW + (this.random() - 0.5) * COLW * 1.6;
    const sy =
      PILE_H - y + p.size * 0.45 + (this.random() - 0.5) * 1.5;
    if (sx > this.furthestRight) {
      this.furthestRight = sx;
    }
    if (sx > this.wallX) {
      this.heapCrossed = true;
    }
    this.drawPileShard(sx, sy, p.shape, p.rot, p.color);
    this.settled.push({
      x: sx,
      hy: y,
      sy,
      cell: p.cell,
      size: p.size,
      shape: p.shape,
      rot: p.rot,
      color: p.color,
      _lift: 0,
      _land: 0,
    });
    if (!replay) {
      this.pileDirty = false;
    }
  }

  private rebuildPile() {
    this.heights = new Array(Math.ceil(this.vw / COLW) + 2).fill(0);
    this.ensurePile();
    const keep = this.settled;
    this.settled = [];
    this.furthestRight = 0;
    for (const piece of keep) {
      this.land(this.asLive(piece), true);
    }
  }

  private redrawPile() {
    this.heights.fill(0);
    for (const s of this.settled) {
      const c = this.colOf(s.x);
      const span = Math.max(1, Math.round(s.size / COLW / 2));
      for (let j = c - span; j <= c + span; j += 1) {
        if (j >= 0 && j < this.heights.length) {
          this.heights[j] = Math.max(this.heights[j], s.hy);
        }
      }
    }
    if (!this.pctx || !this.pile) {
      return;
    }
    this.pctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.pctx.clearRect(0, 0, this.vw, PILE_H);
    for (const s of this.settled) {
      this.drawPileShard(s.x, s.sy, s.shape, s.rot, s.color);
    }
  }

  private ensurePile() {
    if (typeof document === "undefined") {
      return;
    }
    if (!this.pile) {
      this.pile = document.createElement("canvas");
      this.pctx = this.pile.getContext("2d");
    }
    this.pile.width = Math.max(1, Math.round(this.vw * this.dpr));
    this.pile.height = Math.max(1, Math.round(PILE_H * this.dpr));
    this.pctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.pctx?.clearRect(0, 0, this.vw, PILE_H);
  }

  private drawPileShard(
    x: number,
    y: number,
    shape: number[][],
    rot: number,
    color: string,
  ) {
    const ctx = this.pctx;
    if (!ctx) {
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.beginPath();
    shape.forEach((pt, i) => {
      if (i) {
        ctx.lineTo(pt[0], pt[1]);
      } else {
        ctx.moveTo(pt[0], pt[1]);
      }
    });
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private asLive(piece: SettledPiece): LivePiece {
    return {
      x: piece.x,
      y: this.floorY - piece.hy,
      vx: 0,
      vy: 0,
      rot: piece.rot,
      vr: 0,
      size: piece.size,
      shape: piece.shape,
      color: piece.color,
      flutter: 0,
      cell: piece.cell,
    };
  }

  private setWindow(hgt: number) {
    const delta = hgt - this.winH;
    if (Math.abs(delta) < 0.01) {
      return;
    }
    const trTop = this.trayTop;
    this.winH = hgt;
    if (trTop < this.vh && trTop > -this.trayHeight) {
      this.pendingScroll += delta;
    }
  }

  private launch() {
    if (this.reduce) {
      for (const src of this.settled) {
        if (src.cell >= 0) {
          this.here[src.cell] = 1;
          this.regArrive[src.cell] = this.now;
        }
      }
      this.settled = this.settled.filter((piece) => piece.cell < 0);
      this.heights.fill(0);
      for (const piece of this.settled) {
        const c = this.colOf(piece.x);
        const span = Math.max(1, Math.round(piece.size / COLW / 2));
        for (let j = c - span; j <= c + span; j += 1) {
          if (j >= 0 && j < this.heights.length) {
            this.heights[j] = Math.max(this.heights[j], piece.hy);
          }
        }
      }
      this.winTarget = this.ph;
      this.setWindow(this.ph);
      this.pendingSpeak = true;
      this.speakReady = true;
      return;
    }

    const mine = this.settled.filter((piece) => piece.cell >= 0);
    const byHeap = mine.slice().sort((a, b) => b.hy - a.hy);
    const byRow = mine
      .slice()
      .sort(
        (a, b) =>
          Math.floor(b.cell / this.sc) -
          Math.floor(a.cell / this.sc) +
          (this.random() - 0.5) * 6,
      );
    const n = Math.max(1, mine.length);
    const lift = 2.0;
    const land = 4.8;
    const left = this.trayLeft + 20;
    const right = Math.max(left + 40, this.wallX - this.scrollX - 30);
    byHeap.forEach((src, k) => {
      src._lift = (k / n) * lift + this.random() * 0.05;
    });
    byRow.forEach((src, k) => {
      src._land = 0.9 + (k / n) * land + this.random() * 0.05;
    });
    for (const src of mine) {
      const liftEnd = src._lift + 0.6;
      this.flights.push({
        i: src.cell,
        src,
        started: false,
        rot0: src.rot,
        shape: src.shape,
        color: src.color,
        tLift: src._lift,
        tLand: Math.max(src._land, liftEnd + 0.1),
        t: 0,
        hx: left + this.random() * (right - left),
        hy: 22 + this.random() * 60,
        ph: this.random() * 6.28,
        wob: 6 + this.random() * 14,
        sx: 0,
        sy: 0,
        lx: 0,
        ly: 0,
      });
    }
    this.pendingSpeak = true;
    this.dropLeftovers = true;
    this.winTarget = this.winH;
  }

  private latch() {
    this.latched = true;
    this.dragging = false;
    this.snapping = false;
    this.pos = 1;
    this.slam += 1;
    this.onThunk?.(true);
    const count = this.remaining();
    this.builtCount += count;
    this.built = this.builtCount / this.full;
    this.launch();
  }

  private stepLever(dt: number) {
    if (this.dragging && !this.latched) {
      const rate = 22 - 17 * Math.min(1, this.pos / 0.85);
      this.pos += (this.grabTarget - this.pos) * Math.min(1, dt * rate);
      this.vel = 0;
      const notch = Math.floor(this.pos * 5);
      if (notch !== this.lastNotch && notch > 0) {
        this.onThunk?.(false);
      }
      this.lastNotch = notch;
      if (this.pos >= 0.8 && this.isFull()) {
        this.snapping = true;
        this.dragging = false;
      }
    }
    if (this.snapping && !this.latched) {
      this.pos = Math.min(1, this.pos + dt * 6);
      if (this.pos >= 1) {
        this.latch();
      }
    } else if (this.autoPull && !this.latched) {
      this.pos = Math.min(1, this.pos + dt * 1.6);
      if (this.pos >= 0.8) {
        this.autoPull = false;
        this.snapping = true;
      }
    } else if (!this.dragging && !this.latched && !this.snapping) {
      this.vel += (-90 * this.pos - 10 * this.vel) * dt;
      this.pos += this.vel * dt;
      if (this.pos < 0) {
        this.pos = 0;
        this.vel = -this.vel * 0.3;
      }
    } else if (this.latched && this.flights.length === 0 && !this.pendingSpeak) {
      this.pos = Math.max(0, this.pos - dt * 0.8);
      if (this.pos === 0) {
        this.latched = false;
      }
    }
  }

  private paintShard(
    ctx: CanvasRenderingContext2D | null,
    groups: Record<string, Path2D>,
    color: string,
    shape: number[][],
    x: number,
    y: number,
    rot: number,
  ) {
    const ca = Math.cos(rot);
    const sa = Math.sin(rot);
    if (this.accountDraw || ctx) {
      let ax = 0;
      let ay = 0;
      for (let q = 0; q < shape.length; q += 1) {
        const qx = shape[q][0];
        const qy = shape[q][1];
        ax = x + qx * ca - qy * sa;
        ay = y + qx * sa + qy * ca;
      }
      if (!ctx || ax + ay === Number.NaN) {
        return;
      }
    }
    if (!ctx || typeof Path2D === "undefined") {
      return;
    }
    const path = groups[color] || (groups[color] = new Path2D());
    const ca2 = Math.cos(rot);
    const sa2 = Math.sin(rot);
    for (let q = 0; q < shape.length; q += 1) {
      const qx = shape[q][0];
      const qy = shape[q][1];
      const px = x + qx * ca2 - qy * sa2;
      const py = y + qx * sa2 + qy * ca2;
      if (q) {
        path.lineTo(px, py);
      } else {
        path.moveTo(px, py);
      }
    }
    path.closePath();
  }

  private fillGroups(
    ctx: CanvasRenderingContext2D | null,
    groups: Record<string, Path2D>,
  ) {
    if (!ctx) {
      return;
    }
    for (const color of Object.keys(groups)) {
      ctx.fillStyle = color;
      ctx.fill(groups[color]);
    }
  }

  private updateAttention(dt: number, now: number, speaking: boolean) {
    const idleFor = now - this.lastPointer;
    if (!speaking && now > this.glanceUntil && idleFor > 1500) {
      const vis = this.looks.filter(
        (link) => link.top < this.vh && link.top + link.height > 0,
      );
      if (vis.length) {
        const link = vis[Math.floor(now / 1600) % vis.length];
        const eye = this.eyeScreen();
        this.gazeT.x = clamp(
          (link.left + link.width / 2 - eye.x) / (eye.w * 0.45),
          -1,
          1,
        );
        this.gazeT.y = clamp(
          (link.top + link.height / 2 - eye.y) / (Math.max(1, eye.h) * 0.45),
          -1,
          1,
        );
      } else if (idleFor > 4000 && now > this.lookAround) {
        this.lookAround = now + 1500 + this.random() * 2000;
        this.gazeT.x = (this.random() - 0.5) * 1.6;
        this.gazeT.y = (this.random() - 0.5) * 0.8;
      }
    }
    this.gaze.x += (this.gazeT.x - this.gaze.x) * Math.min(1, dt * 12);
    this.gaze.y += (this.gazeT.y - this.gaze.y) * Math.min(1, dt * 12);
    this.par.x += (this.parT.x - this.par.x) * Math.min(1, dt * 5);
    this.par.y += (this.parT.y - this.par.y) * Math.min(1, dt * 5);
    this.dozeLevel += ((this.dozing ? 1 : 0) - this.dozeLevel) * Math.min(1, dt * 1.5);
  }

  private idleGrid(dt: number, now: number) {
    this.idleClock += dt * (this.dozing ? 0.5 : 1);
    if (this.idleClock > 0.16) {
      this.idleClock = 0;
      this.idlePos += this.idleDir;
      if (this.idlePos >= this.idle.length - 1 || this.idlePos <= 0) {
        this.idleDir = -this.idleDir;
      }
    }
    if (!this.dozing && now > this.nextBlink) {
      this.blinkUntil = now + 140;
      this.nextBlink = now + 2500 + this.random() * 3500;
    }
    const base = this.frames[this.idle[this.idlePos]];
    const g = base.map((row) => row.slice());
    const sxAll = Math.round(this.gaze.x * 2);
    const sy = Math.round(this.gaze.y * 1);
    const closed = now < this.blinkUntil || this.dozing;
    const pair = this.eyes[this.idlePos] ?? [];
    pair.forEach((eye, ei) => {
      const sx = this.crossEyes ? (ei === 0 ? 2 : -2) : sxAll;
      let minC = 999;
      let maxC = 0;
      const rows: Record<number, boolean> = {};
      for (const p of eye.iris) {
        minC = Math.min(minC, p[1]);
        maxC = Math.max(maxC, p[1]);
        rows[p[0]] = true;
      }
      const rs = Object.keys(rows)
        .map(Number)
        .sort((a, b) => a - b);
      if (!rs.length) {
        return;
      }
      const mid = rs[Math.floor(rs.length / 2)];
      if (closed) {
        for (const r of rs) {
          for (let c = minC - 1; c <= maxC + 1; c += 1) {
            g[r][c] = base[Math.min(this.nr - 1, eye.r1 + 1)][c];
          }
        }
        for (let c = minC - 1; c <= maxC + 1; c += 1) {
          g[mid][c] = Math.round(this.topv * 0.75);
        }
        return;
      }
      for (const p of eye.iris) {
        g[p[0]][p[1]] = Math.round(this.topv * 0.45);
      }
      for (const p of eye.iris) {
        const r = p[0] + sy;
        const c = p[1] + sx;
        if (r >= eye.r0 && r < eye.r1 && c >= eye.c0 && c < eye.c1) {
          g[r][c] = p[2];
        }
      }
    });
    return g;
  }

  private makeWords() {
    if (this.wordPts.length) {
      return;
    }
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      const w = 400;
      const h = 120;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx?.getImageData) {
        ctx.fillStyle = "#000";
        ctx.font = "700 64px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("I can't code", w / 2, h / 2);
        const img = ctx.getImageData(0, 0, w, h);
        const d = img.data;
        for (let yy = 0; yy < h; yy += 2) {
          for (let xx = 0; xx < w; xx += 2) {
            if (d[(yy * w + xx) * 4 + 3] > 128) {
              this.wordPts.push([xx / w, yy / h]);
            }
          }
        }
      }
    }
    if (this.wordPts.length) {
      return;
    }
    for (let i = 0; i < 48; i += 1) {
      this.wordPts.push([(i % 12) / 12, Math.floor(i / 12) / 4]);
    }
  }

  private sendHome() {
    if (this.swarmHome) {
      return;
    }
    this.swarmHome = true;
    this.swarmHomeT = 0;
    for (let i = 0; i < this.n; i += 1) {
      if (!this.away[i]) {
        continue;
      }
      this.retT0[i] = this.random() * 0.5;
      this.retD[i] = 1.0 + this.random() * 0.7;
      this.retX[i] = this.swarmX[i];
      this.retY[i] = this.swarmY[i];
      this.retVx[i] = this.swarmVx[i];
      this.retVy[i] = this.swarmVy[i];
    }
  }

  private startSwarm() {
    const rect = this.portrait;
    const hcX = rect.left + (this.headCol + 0.5) * this.cw;
    const hcY = rect.top + this.headRow * this.ch;
    for (let i = 0; i < this.n; i += 1) {
      this.away[i] = 0;
      if (!this.here[i] || this.vmax[i] <= 0.04) {
        continue;
      }
      const home = this.homeOf(i);
      this.swarmX[i] = home[0];
      this.swarmY[i] = home[1];
      this.away[i] = 1;
      const dx = this.swarmX[i] - hcX;
      const dy = this.swarmY[i] - hcY;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      this.swarmVx[i] = (dx / d) * (80 + this.random() * 120);
      this.swarmVy[i] = (dy / d) * 60 - 160 - this.random() * 140;
    }
    this.swarmHome = false;
    this.flockT = 0;
  }

  private homeOf(i: number) {
    const r = Math.floor(i / this.sc);
    const s = i % this.sc;
    return [
      this.portrait.left + (s + 0.5 + this.jx[i]) * this.cw,
      this.portrait.top + (r + 0.5 + this.jy[i]) * this.ch,
    ];
  }

  private flow(x: number, y: number, t: number) {
    return (
      Math.sin(x * 0.0105 + t * 0.7) +
      Math.sin(y * 0.0127 - t * 0.55) +
      0.8 * Math.sin((x + y) * 0.0071 + t * 0.9)
    );
  }

  private updateSwarm(dt: number, now: number, fx: CanvasRenderingContext2D | null) {
    if (!this.effect) {
      return;
    }
    this.flockT += dt;
    if (!this.swarmHome && this.effect.t > DUR.swarm) {
      this.sendHome();
    }
    if (this.swarmHome) {
      this.swarmHomeT += dt;
    }
    let lx: number;
    let ly: number;
    if (now - this.lastClient.t < 2500) {
      lx = this.lastClient.x;
      ly = this.lastClient.y;
    } else {
      lx =
        this.portrait.left +
        this.portrait.width * (0.5 + 0.38 * Math.sin(this.flockT * 0.45));
      ly =
        this.portrait.top +
        this.portrait.height * (0.3 + 0.18 * Math.sin(this.flockT * 0.8));
    }
    const bins = new Map<number, number[]>();
    const bin = 36;
    if (!this.swarmHome) {
      for (let i = 0; i < this.n; i += 1) {
        if (!this.away[i]) {
          continue;
        }
        const key =
          Math.floor(this.swarmX[i] / bin) * 4096 +
          Math.floor(this.swarmY[i] / bin);
        let cell = bins.get(key);
        if (!cell) {
          cell = [0, 0, 0, 0, 0];
          bins.set(key, cell);
        }
        cell[0] += this.swarmX[i];
        cell[1] += this.swarmY[i];
        cell[2] += this.swarmVx[i];
        cell[3] += this.swarmVy[i];
        cell[4] += 1;
      }
    }
    const groups: Record<string, Path2D> = {};
    let stillAway = 0;
    for (let j = 0; j < this.n; j += 1) {
      if (!this.away[j]) {
        continue;
      }
      let x: number;
      let y: number;
      let vx: number;
      let vy: number;
      if (!this.swarmHome) {
        const cb = bins.get(
          Math.floor(this.swarmX[j] / bin) * 4096 +
            Math.floor(this.swarmY[j] / bin),
        );
        const n = cb ? cb[4] : 1;
        let ax = 0;
        let ay = 0;
        if (cb && n > 1) {
          const mx = cb[0] / n;
          const my = cb[1] / n;
          const mvx = cb[2] / n;
          const mvy = cb[3] / n;
          ax += (mvx - this.swarmVx[j]) * 1.6 + (mx - this.swarmX[j]) * 0.9;
          ay += (mvy - this.swarmVy[j]) * 1.6 + (my - this.swarmY[j]) * 0.9;
          if (n > 14) {
            ax += (this.swarmX[j] - mx) * n * 0.06;
            ay += (this.swarmY[j] - my) * n * 0.06;
          }
        }
        const dxl = lx - this.swarmX[j];
        const dyl = ly - this.swarmY[j];
        const dl = Math.sqrt(dxl * dxl + dyl * dyl) || 1;
        const pull = Math.min(1, dl / 260) * (220 + this.rnd1[j] * 140);
        ax += (dxl / dl) * pull;
        ay += (dyl / dl) * pull;
        const ang = this.flow(this.swarmX[j], this.swarmY[j], this.flockT) * 1.4;
        ax += Math.cos(ang) * 150;
        ay += Math.sin(ang) * 150;
        if (this.swarmY[j] < 30) {
          ay += 400;
        }
        if (this.swarmY[j] > this.vh - 30) {
          ay -= 400;
        }
        if (this.swarmX[j] < 30) {
          ax += 400;
        }
        if (this.swarmX[j] > this.vw - 30) {
          ax -= 400;
        }
        this.swarmVx[j] += ax * dt;
        this.swarmVy[j] += ay * dt;
        const sp = Math.sqrt(
          this.swarmVx[j] * this.swarmVx[j] + this.swarmVy[j] * this.swarmVy[j],
        );
        const mn = 110;
        const mxs = 430;
        if (sp > mxs) {
          this.swarmVx[j] *= mxs / sp;
          this.swarmVy[j] *= mxs / sp;
        } else if (sp < mn && sp > 0) {
          this.swarmVx[j] *= mn / sp;
          this.swarmVy[j] *= mn / sp;
        }
        this.swarmX[j] += this.swarmVx[j] * dt;
        this.swarmY[j] += this.swarmVy[j] * dt;
        x = this.swarmX[j];
        y = this.swarmY[j];
        vx = this.swarmVx[j];
        vy = this.swarmVy[j];
      } else {
        const u = (this.swarmHomeT - this.retT0[j]) / this.retD[j];
        const hp = this.homeOf(j);
        if (u <= 0) {
          this.swarmX[j] += this.swarmVx[j] * dt;
          this.swarmY[j] += this.swarmVy[j] * dt;
          this.retX[j] = this.swarmX[j];
          this.retY[j] = this.swarmY[j];
          this.retVx[j] = this.swarmVx[j];
          this.retVy[j] = this.swarmVy[j];
          x = this.swarmX[j];
          y = this.swarmY[j];
          vx = this.swarmVx[j];
          vy = this.swarmVy[j];
        } else if (u >= 1) {
          this.away[j] = 0;
          this.regArrive[j] = now;
          continue;
        } else {
          const u2 = u * u;
          const u3 = u2 * u;
          const h00 = 2 * u3 - 3 * u2 + 1;
          const h10 = u3 - 2 * u2 + u;
          const h01 = -2 * u3 + 3 * u2;
          const d = this.retD[j] * 0.6;
          x = h00 * this.retX[j] + h10 * d * this.retVx[j] + h01 * hp[0];
          y = h00 * this.retY[j] + h10 * d * this.retVy[j] + h01 * hp[1];
          vx = (x - this.swarmX[j]) / Math.max(dt, 0.001);
          vy = (y - this.swarmY[j]) / Math.max(dt, 0.001);
          this.swarmX[j] = x;
          this.swarmY[j] = y;
          vx *= 1 - u;
          vy *= 1 - u;
        }
      }
      stillAway += 1;
      if (!fx && !this.accountDraw) {
        continue;
      }
      const v = this.vmax[j];
      const spd = Math.sqrt(vx * vx + vy * vy);
      const a2 = spd > 25 ? Math.atan2(vy, vx) : 0;
      const size = this.cw * 0.95 * Math.sqrt(v);
      const color = TIERS[v < 0.6 ? 0 : v < 0.85 ? 1 : 2];
      const b = j * 6;
      const shape = [
        [this.shape[b] * size, this.shape[b + 1] * size],
        [this.shape[b + 2] * size, this.shape[b + 3] * size],
        [this.shape[b + 4] * size, this.shape[b + 5] * size],
      ];
      this.paintShard(fx, groups, color, shape, x, y, a2);
    }
    this.fillGroups(fx, groups);
    if (this.swarmHome && stillAway === 0) {
      this.lastEffect = "swarm";
      this.effect = null;
    }
  }

  private effectAt(i: number, r: number, s: number, x: number, y: number) {
    const out = [x, y, 1, -1, 0];
    if (!this.effect) {
      return out;
    }
    const t = this.effect.t;
    const hcx = (this.headCol + 0.5) * this.cw;
    const hcy = this.headRow * this.ch;
    if (this.effect.type === "words") {
      if (!this.wordPts.length) {
        return out;
      }
      const p =
        t < 1.1 ? ease(t / 1.1) : t < 2.3 ? 1 : 1 - ease((t - 2.3) / 1.3);
      const wp = this.wordPts[Math.floor(this.rnd1[i] * this.wordPts.length)];
      const tx = this.pw * 0.05 + wp[0] * this.pw * 0.9;
      const ty = this.ph * 0.3 + wp[1] * this.ph * 0.3;
      out[0] = x + (tx - x) * p + Math.sin(p * Math.PI) * (this.rnd2[i] - 0.5) * 60;
      out[1] = y + (ty - y) * p - Math.sin(p * Math.PI) * 40 * this.rnd2[i];
      out[2] = 1 - 0.35 * p;
    } else if (this.effect.type === "decode") {
      const on = 0.05 + this.rnd1[i] * 0.5;
      const off = DUR.decode - 0.6 + this.rnd2[i] * 0.5;
      if (t > on && t < off) {
        out[4] = 1;
      }
    } else if (this.effect.type === "balloon") {
      const wh = Math.max(0, Math.min(1, (NECK - r) / 8));
      const infl =
        1 +
        0.75 * ease(t / DUR.balloon) * wh +
        Math.sin(t * 26) * 0.035 * wh * Math.min(1, t);
      out[0] = hcx + (x - hcx) * infl;
      out[1] = hcy + (y - hcy) * infl;
      out[2] = 1 + (infl - 1) * 0.8;
    }
    void s;
    return out;
  }

  private popHead() {
    const prx = this.portrait.left + this.scrollX;
    const pry = this.portrait.top + this.scrollY;
    const hcx = (this.headCol + 0.5) * this.cw;
    const hcy = this.headRow * this.ch;
    let popped = 0;
    for (let i = 0; i < this.n; i += 1) {
      if (!this.here[i] || this.vmax[i] <= 0.04 || Math.floor(i / this.sc) >= NECK) {
        continue;
      }
      const r = Math.floor(i / this.sc);
      const s = i % this.sc;
      this.here[i] = 0;
      popped += 1;
      const x = (s + 0.5) * this.cw;
      const y = (r + 0.5) * this.ch;
      const dx = x - hcx;
      const dy = y - hcy;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const sp = 250 + this.random() * 450;
      const fs = this.faceShard(i);
      this.live.push({
        x: prx + hcx + dx * 1.7,
        y: pry + hcy + dy * 1.7,
        vx: (dx / d) * sp,
        vy: (dy / d) * sp - 200,
        rot: 0,
        vr: (this.random() - 0.5) * 20,
        size: fs.size,
        shape: fs.shape,
        color: fs.color,
        flutter: this.random() * 6.28,
        cell: i,
      });
    }
    this.builtCount -= popped;
    this.built = this.builtCount / this.full;
    this.onThunk?.(true);
    return popped;
  }

  private drawFace(
    grid: number[][],
    dt: number,
    now: number,
    face: CanvasRenderingContext2D | null,
    fx: CanvasRenderingContext2D | null,
  ) {
    if (face) {
      face.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      face.clearRect(0, 0, this.pw, this.ph);
    }
    if (this.built === 0) {
      return;
    }
    let swarming = this.effect?.type === "swarm";
    if (swarming && this.effect) {
      this.effect.t += dt;
      this.updateSwarm(dt, now, fx);
      swarming = this.effect?.type === "swarm";
    }
    if (this.effect && !swarming) {
      this.effect.t += dt;
      if (this.effect.type === "balloon" && this.effect.t >= DUR.balloon) {
        this.lastEffect = "balloon";
        this.effect = null;
        this.popHead();
      } else if (this.effect.t >= DUR[this.effect.type]) {
        this.lastEffect = this.effect.type;
        this.effect = null;
      }
    }
    const pxs = this.reduce ? 0 : this.par.x * this.pw * 0.018;
    const pys = this.reduce ? 0 : this.par.y * this.pw * 0.012;
    const touching = this.pointer.inside && !this.reduce;
    const reach = this.pw * 0.09;
    const reach2 = reach * reach;
    const push = this.pw * 9;
    const paths: Array<Path2D | null> = [null, null, null];
    const chars: string[][] = [[], [], []];
    for (let r = 0; r < this.nr; r += 1) {
      const row = grid[r];
      for (let s = 0; s < this.sc; s += 1) {
        const i = r * this.sc + s;
        if (!this.here[i] || (swarming && this.away[i])) {
          continue;
        }
        const since = now - this.regArrive[i];
        const pulse = since < 200 ? 1 + 0.25 * Math.sin((since / 200) * Math.PI) : 1;
        const v = (row[s * 2] + row[s * 2 + 1]) / (2 * this.topv);
        const ef = this.effectAt(
          i,
          r,
          s,
          (s + 0.5 + this.jx[i]) * this.cw + pxs * this.depth[i],
          (r + 0.5 + this.jy[i]) * this.ch + pys * this.depth[i],
        );
        let ax = -60 * this.ox[i] - 9 * this.springX[i];
        let ay = -60 * this.oy[i] - 9 * this.springY[i];
        if (touching) {
          const dx = ef[0] + this.ox[i] - this.pointer.x;
          const dy = ef[1] + this.oy[i] - this.pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < reach2 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            let f = 1 - d / reach;
            f = (f * f * push) / d;
            ax += dx * f;
            ay += dy * f;
          }
        }
        if (this.ox[i] || this.oy[i] || ax || ay) {
          this.springX[i] += ax * dt;
          this.springY[i] += ay * dt;
          this.ox[i] += this.springX[i] * dt;
          this.oy[i] += this.springY[i] * dt;
          if (
            Math.abs(this.ox[i]) < 0.05 &&
            Math.abs(this.oy[i]) < 0.05 &&
            Math.abs(this.springX[i]) < 0.5 &&
            Math.abs(this.springY[i]) < 0.5
          ) {
            this.ox[i] = 0;
            this.oy[i] = 0;
            this.springX[i] = 0;
            this.springY[i] = 0;
          }
        }
        if (v <= 0.04) {
          continue;
        }
        const tier = ef[3] >= 0 ? ef[3] : v < 0.6 ? 0 : v < 0.85 ? 1 : 2;
        const cx = ef[0] + this.ox[i];
        const cy = ef[1] + this.oy[i];
        if (ef[4]) {
          chars[tier].push(
            this.ramp[Math.max(1, Math.min(this.topv, Math.round(v * this.topv)))],
            String(cx),
            String(cy),
          );
          continue;
        }
        if (!face && !this.accountDraw) {
          continue;
        }
        const size = this.cw * 0.95 * Math.sqrt(v) * pulse * ef[2];
        const b = i * 6;
        if (face && typeof Path2D !== "undefined") {
          const path = paths[tier] || (paths[tier] = new Path2D());
          path.moveTo(cx + this.shape[b] * size, cy + this.shape[b + 1] * size);
          path.lineTo(
            cx + this.shape[b + 2] * size,
            cy + this.shape[b + 3] * size,
          );
          path.lineTo(
            cx + this.shape[b + 4] * size,
            cy + this.shape[b + 5] * size,
          );
          path.closePath();
        } else if (this.accountDraw) {
          void (cx + this.shape[b] * size + cy);
        }
      }
    }
    if (face) {
      for (let t = 0; t < 3; t += 1) {
        const path = paths[t];
        if (!path) {
          continue;
        }
        face.fillStyle = TIERS[t];
        face.fill(path);
      }
      const charCount = chars[0].length + chars[1].length + chars[2].length;
      if (charCount) {
        face.font = `600 ${(this.ch * 1.25).toFixed(1)}px ui-monospace, Menlo, Consolas, monospace`;
        face.textAlign = "center";
        face.textBaseline = "middle";
        for (let t = 0; t < 3; t += 1) {
          face.fillStyle = TIERS[t];
          const list = chars[t];
          for (let k = 0; k < list.length; k += 3) {
            face.fillText(list[k], Number(list[k + 1]), Number(list[k + 2]));
          }
        }
      }
    }
  }
}
