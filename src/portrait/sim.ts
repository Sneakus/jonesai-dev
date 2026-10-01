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
  idleEnd: number[];
  eyesEnd: PortraitEye[][];
  pieces?: number;
};

export type PackedPortrait = {
  fps: number;
  cols: number;
  nr: number;
  sc: number;
  n: number;
  full: number;
  frameCount: number;
  ramp: string;
  idle: number[];
  eyes: PortraitEye[][];
  idleEnd: number[];
  eyesEnd: PortraitEye[][];
  headCol: number;
  vmax: Float32Array;
  shape: Float32Array;
  jx: Float32Array;
  jy: Float32Array;
  depth: Float32Array;
  rnd1: Float32Array;
  rnd2: Float32Array;
  order: Uint16Array;
  frames: Uint8Array[];
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
  fxDpr?: number;
  tray: PortraitRect;
  leverLeft: number;
  crusher: PortraitRect;
  portrait: PortraitRect;
  looks: PortraitRect[];
};

export type PortraitView = {
  fx: CanvasRenderingContext2D | null;
  face: CanvasRenderingContext2D | null;
  heap?: CanvasRenderingContext2D | null;
};

export type FallingPiece = {
  id: number;
  x: number;
  y: number;
  rot: number;
  color: string;
  clip: string;
  box: number;
};

type LivePiece = {
  id: number;
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
  clip: string;
  box: number;
};

type Body = {
  x: number;
  y: number;
  px: number;
  py: number;
  r: number;
  rot: number;
  vr: number;
  size: number;
  shape: number[][];
  color: string;
  cell: number;
  still: number;
  asleep: boolean;
  flow: number;
};

type Flight = {
  i: number;
  t: number;
  started: boolean;
  sx: number;
  sy: number;
  fs: { size: number; shape: number[][]; color: string };
  rot0: number;
  dur: number;
  ang: number;
  lift: number;
  tEmit: number;
};

type IntakeBit = {
  x: number;
  y: number;
  shape: number[][];
  color: string;
  rot: number;
  t: number;
};

type BurstBit = {
  fs: { size: number; shape: number[][]; color: string };
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  t: number;
  rot: number;
  vr: number;
};

type EffectName = "decode" | "swarm" | "balloon";

const CLAY = ["#E8480C", "#E8480C", "#E8480C", "#C93F0B", "#F06A33"];
const TIERS = ["#E8480C", "#B8390A", "#782608"];
export const PILE_H = 300;
const CHUNKS_PER_CLAY = 22;
const CHUNKS_FULL = 18 * CHUNKS_PER_CLAY;
const HEAP_G = 1500;
const HEAP_CELL = 14;
const HEAP_H = 1 / 120;
const EFFECTS: EffectName[] = ["swarm", "decode", "balloon"];
const DUR: Record<EffectName, number> = {
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
  private fxDpr = 1;
  scrollX = 0;
  scrollY = 0;
  wallX = 1e9;
  floorY = 0;
  trayTop = 0;
  trayHeight = 240;
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
  onRumble: ((on: boolean) => void) | null = null;
  crusherUp = false;
  crusherSinking = false;
  crusherOn = false;

  private readonly random: () => number;
  private readonly ramp: string;
  private readonly topv: number;
  private frames: Uint8Array[] = [];
  private packedOrder: Uint16Array | null = null;
  private readonly idle: number[];
  private readonly eyes: PortraitEye[][];
  private readonly idleEnd: number[];
  private readonly eyesEnd: PortraitEye[][];
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
  private builtCount = 0;
  private settled: Body[] = [];
  private live: LivePiece[] = [];
  private flights: Flight[] = [];
  private intake: IntakeBit[] = [];
  private burst: BurstBit[] = [];
  private portrait: PortraitRect = { left: 0, top: 0, width: 1, height: 1 };
  private looks: PortraitRect[] = [];
  private crusherRect: PortraitRect = { left: 0, top: 0, width: 86, height: 92 };
  private grabTarget = 0;
  private dragStart = 0;
  private posStart = 0;
  private lastNotch = 0;
  private autoPull = false;
  private snapping = false;
  private pendingSpeak = false;
  private speakReady = false;
  private trayLeftX = 0;
  private trayScreenLeft = 0;
  private heapDirty = false;
  private nextPieceId = 1;
  private leverLine = 1e9;
  private crusherLine = 1e9;
  private crOpen = 0;
  private feeding = false;
  private fedCount = 0;
  private feedTotal = 1;
  private feedStart = 0;
  private heapClock = 0;
  private emitTotal = 0;
  private emitted = 0;
  private emitBudget = 0;
  private todoFace: { i: number; key: number }[] = [];
  private grinding = false;
  private armAt = 0;
  private windAt = 0;
  private sinkAt = 0;
  private lastTick = 0;
  private pointer = { x: -9999, y: -9999, inside: false, vx: 0, vy: 0 };
  private par = { x: 0, y: 0 };
  private parT = { x: 0, y: 0 };
  private gaze = { x: 0, y: 0 };
  private gazeT = { x: 0, y: 0 };
  private gazeSlowUntil = 0;
  private hasSpoken = false;
  private wasSpeaking = false;
  private justEnded = false;
  private blendFrom: Uint8Array | null = null;
  private blendStart = 0;
  private blendDur = 700;
  private blendBuf: Uint8Array | null = null;
  private lastGrid: Uint8Array | null = null;
  private restingNow = true;
  private faceReadyAt = 0;
  private clickedFace = false;
  private nextWiggle = 0;
  private nudging = false;
  handover = -1;
  private lastPointer = 0;
  private glanceUntil = 0;
  private lookAround = 0;
  private blinkUntil = 0;
  private nextBlink = 2000;
  private dozing = false;
  private dozeLevel = 0;
  private lastScroll = 0;
  private lastClient = { x: 0, y: 0, t: 0 };
  private crossEyes = false;
  private effIdx = 0;
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
  private heapPast = 0;
  private heapLeft = 0;
  private heapAwake = 0;

  constructor(
    data: PortraitData | PackedPortrait,
    options?: { reduce?: boolean; random?: () => number },
  ) {
    this.reduce = options?.reduce ?? false;
    this.random = options?.random ?? Math.random;
    if ("order" in data && data.order instanceof Uint16Array) {
      const packed = data;
      this.fps = packed.fps;
      this.cols = packed.cols;
      this.nr = packed.nr;
      this.sc = packed.sc;
      this.n = packed.n;
      this.full = packed.full;
      this.perClay = Math.ceil(this.full / 25);
      this.idle = packed.idle;
      this.eyes = packed.eyes;
      this.idleEnd = packed.idleEnd;
      this.eyesEnd = packed.eyesEnd;
      this.ramp = packed.ramp;
      this.topv = this.ramp.length - 1;
      this.frames = packed.frames;
      this.packedOrder = packed.order;
      this.shape = packed.shape;
      this.jx = packed.jx;
      this.jy = packed.jy;
      this.depth = packed.depth;
      this.vmax = packed.vmax;
      this.rnd1 = packed.rnd1;
      this.rnd2 = packed.rnd2;
      this.headCol = packed.headCol;
      this.ox = new Float32Array(this.n);
      this.oy = new Float32Array(this.n);
      this.springX = new Float32Array(this.n);
      this.springY = new Float32Array(this.n);
      this.here = new Uint8Array(this.n);
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
      return;
    }
    const json = data as PortraitData;
    this.fps = json.fps;
    this.cols = json.cols;
    this.idle = json.idle;
    this.eyes = json.eyes;
    this.idleEnd = json.idleEnd;
    this.eyesEnd = json.eyesEnd;
    this.ramp = ` ${json.ramp}`;
    this.topv = this.ramp.length - 1;
    this.sc = Math.floor(this.cols / 2);

    const grid = json.rows.map((row) =>
      row.split("").map((ch) => (ch === " " ? 0 : this.ramp.indexOf(ch))),
    );
    this.nr = grid.length;
    const grids: number[][][] = [grid.map((row) => row.slice())];
    for (const delta of json.deltas) {
      const bin = atob(delta);
      for (let k = 0; k < bin.length; k += 3) {
        const p = bin.charCodeAt(k) | (bin.charCodeAt(k + 1) << 8);
        const v = bin.charCodeAt(k + 2);
        grid[Math.floor(p / this.cols)][p % this.cols] = v;
      }
      grids.push(grid.map((row) => row.slice()));
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
      for (let f = 0; f < grids.length; f += 1) {
        const vv =
          (grids[f][r][s * 2] + grids[f][r][s * 2 + 1]) / (2 * this.topv);
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
    const order = list.map((item) => item.i);
    for (let q = order.length - 1; q > 0; q -= 1) {
      const j = Math.floor(this.random() * (q + 1));
      const held = order[q];
      order[q] = order[j];
      order[j] = held;
    }
    void order.length;

    const xs: number[] = [];
    const f0 = grids[0];
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
    this.frames = grids.map((rows) => {
      const flat = new Uint8Array(this.nr * this.cols);
      for (let r = 0; r < this.nr; r += 1) {
        flat.set(rows[r], r * this.cols);
      }
      return flat;
    });
  }

  sync(layout: PortraitLayout) {
    const nextVw = layout.vw;
    this.vh = layout.vh;
    this.scrollX = layout.scrollX;
    this.scrollY = layout.scrollY;
    this.dpr = Math.min(layout.dpr || 1, 2);
    this.fxDpr = layout.fxDpr ?? this.dpr;
    this.vw = nextVw;
    this.trayTop = layout.tray.top;
    this.trayHeight = layout.tray.height;
    this.trayScreenLeft = layout.tray.left;
    this.floorY = layout.tray.top + layout.scrollY + layout.tray.height - 8;
    this.trayLeftX = layout.tray.left + layout.scrollX + 4;
    this.leverLine = layout.leverLeft + layout.scrollX - 4;
    this.crusherLine = layout.crusher.left + layout.scrollX - 4;
    this.crusherRect = layout.crusher;
    this.wallX = this.leverLine + (this.crusherLine - this.leverLine) * this.crOpen;
    this.portrait = layout.portrait;
    this.looks = layout.looks;
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
    return this.settled.length;
  }

  private chunksNeeded() {
    return Math.max(1, Math.ceil((CHUNKS_FULL * this.remaining()) / this.full));
  }

  isFull() {
    return this.remaining() > 0 && this.piecesIn() >= this.chunksNeeded();
  }

  reservoir() {
    const n = this.piecesIn();
    const total = this.chunksNeeded();
    const share = this.remaining() ? Math.min(1, n / total) : 0;
    const pct = Math.floor(share * 100);
    return { n, total, share, pct, full: this.isFull() };
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
    let unsupported = 0;
    for (const body of this.settled) {
      if (!this.bodySupported(body)) {
        unsupported += 1;
      }
    }
    return {
      pieces: this.settled.length,
      falling: this.live.length,
      furthestRight: this.furthestRight,
      wall: this.wallX,
      crossed: this.heapPast > 0,
      past: this.heapPast,
      left: this.heapLeft,
      awake: this.heapAwake,
      unsupported,
      deepOverlaps: this.deepOverlaps(),
    };
  }

  deepOverlaps() {
    let deep = 0;
    const bodies = this.settled;
    for (let a = 0; a < bodies.length; a += 1) {
      const body = bodies[a];
      for (let c = a + 1; c < bodies.length; c += 1) {
        const other = bodies[c];
        const dx = body.x - other.x;
        const dy = body.y - other.y;
        if (Math.hypot(dx, dy) < (body.r + other.r) * 0.5) {
          deep += 1;
        }
      }
    }
    return deep;
  }

  smash(px: number, py: number) {
    const n = CHUNKS_PER_CLAY - 3 + Math.floor(this.random() * 7);
    for (let k = 0; k < n; k += 1) {
      const sz = 4 + this.random() * 6;
      const a = this.random() * Math.PI * 2;
      const hard = this.random() < 0.3;
      const sp = hard ? 200 + this.random() * 240 : 50 + this.random() * 170;
      this.spawnFragment(
        px + (this.random() - 0.5) * 24,
        py + (this.random() - 0.5) * 8,
        Math.cos(a) * sp,
        Math.sin(a) * sp - (hard ? 220 : 120),
        sz,
      );
    }
    this.smashed += 1;
    if (this.reduce) {
      for (const piece of this.live) {
        piece.vx = 0;
        piece.vy = 0;
        piece.y = this.floorY - 20 - this.random() * 40;
        this.land(piece);
      }
      this.live = [];
      for (let s = 0; s < 240; s += 1) {
        this.stepHeap(1 / 30);
      }
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
    this.clickedFace = true;
    const type = this.reduce
      ? "decode"
      : EFFECTS[this.effIdx % EFFECTS.length];
    if (!this.reduce) {
      this.effIdx += 1;
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
    faceOnScreen = true,
  ) {
    this.now = now;
    const fx = view?.fx ?? null;
    const face = view?.face ?? null;

    if (this.armAt && now >= this.armAt) {
      this.armAt = 0;
      this.onThunk?.(false);
      this.launch();
    }
    if (this.windAt && now >= this.windAt) {
      this.windAt = 0;
      this.crusherOn = false;
      this.onRumble?.(false);
      this.sinkAt = now + 700;
    }
    if (this.sinkAt && now >= this.sinkAt) {
      this.sinkAt = 0;
      this.crusherUp = false;
      this.crusherSinking = true;
    }

    this.crOpen += ((this.crusherUp ? 1 : 0) - this.crOpen) * Math.min(1, dt * 5);
    this.wallX = this.leverLine + (this.crusherLine - this.leverLine) * this.crOpen;

    for (let i = this.live.length - 1; i >= 0; i -= 1) {
      const p = this.live[i];
      p.vy += 900 * dt;
      if (!(p.x < this.trayLeftX + 16 || p.x > this.wallX - 16)) {
        p.vx *= 0.35 ** dt;
      }
      const term = 700 + p.size * 30;
      if (p.vy > term) {
        p.vy += (term - p.vy) * Math.min(1, 3 * dt);
      }
      p.flutter += dt * (3 + p.size * 0.2);
      p.x += (p.vx + Math.sin(p.flutter) * 10) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const tL = this.trayLeftX + 16;
      const tR = this.wallX - 16;
      const toGo = this.floorY - 220 - p.y;
      if (toGo > 0 && (p.x < tL || p.x > tR)) {
        const tgt = p.x < tL ? tL + this.random() * 30 : tR - this.random() * 30;
        const tLeft = Math.max(0.35, toGo / Math.max(250, p.vy));
        const want = (tgt - p.x) / tLeft;
        p.vx += (want - p.vx) * Math.min(1, dt * 2.5);
      }
      if (p.y > this.floorY - 240 && p.x > this.wallX - p.size) {
        p.x = this.wallX - p.size;
        p.vx = -Math.abs(p.vx) * 0.3;
      }
      p.x = clamp(p.x, 8, this.vw - 8);
      if (p.y >= this.floorY - 220) {
        this.live.splice(i, 1);
        this.land(p);
      }
    }

    const overlay = this.overlayActive();
    const page = overlay ? fx : null;
    if (page) {
      page.setTransform(this.fxDpr, 0, 0, this.fxDpr, 0, 0);
      page.clearRect(0, 0, this.vw, this.vh);
    }
    const flyBy: Record<string, Path2D> = {};
    const floorScreen = this.trayTop + this.trayHeight - 8;
    let topRow = this.nr;
    const nozX = this.crusherRect.left + 43;
    const nozY = this.crusherRect.top + 4;
    const inX = this.crusherRect.left + 4;
    const inY = this.crusherRect.top + this.crusherRect.height - 16;
    if (this.feeding || this.heapMoving()) {
      this.stepHeap(dt);
    }
    for (let k = this.intake.length - 1; k >= 0; k -= 1) {
      const bit = this.intake[k];
      bit.t += dt;
      if (bit.t > 0.18) {
        this.intake.splice(k, 1);
        continue;
      }
      const ku = bit.t / 0.18;
      const kx = bit.x - this.scrollX + (inX + 8 - (bit.x - this.scrollX)) * ku;
      const ky = floorScreen - bit.y + (inY - (floorScreen - bit.y)) * ku;
      this.paintShard(
        page,
        flyBy,
        bit.color,
        bit.shape,
        kx,
        ky,
        bit.rot + ku * 4,
        1 - ku * 0.7,
      );
    }
    if (this.feeding) {
      const allowed = Math.min(
        this.emitTotal,
        Math.floor((this.emitTotal * this.fedCount) / this.feedTotal),
      );
      this.emitBudget += dt * 1400;
      while (this.emitted < allowed && this.emitBudget >= 1) {
        this.emitBudget -= 1;
        const next = this.todoFace[this.emitted];
        this.emitted += 1;
        this.flights.push({
          i: next.i,
          t: 0,
          started: true,
          sx: nozX,
          sy: nozY,
          fs: this.faceShard(next.i),
          rot0: this.random() * 6.28,
          dur: this.reduce ? 0.001 : 0.75 + this.random() * 0.3,
          ang: (this.random() - 0.5) * 0.9,
          lift: 110 + this.random() * 90,
          tEmit: 0,
        });
      }
      if (this.emitted >= allowed) {
        this.emitBudget = Math.min(this.emitBudget, 2);
      }
      if (!this.settled.length && this.emitted >= this.emitTotal) {
        this.feeding = false;
      }
      if (now - this.feedStart > 9000) {
        for (const body of this.settled) {
          body.x = this.wallX - body.r;
          body.px = body.x;
          body.y = body.r;
          body.py = body.y;
        }
      }
    }
    for (let f = this.flights.length - 1; f >= 0; f -= 1) {
      const fl = this.flights[f];
      fl.t += dt;
      const r5 = Math.floor(fl.i / this.sc);
      const s5 = fl.i % this.sc;
      const tx = this.portrait.left + (s5 + 0.5 + this.jx[fl.i]) * this.cw;
      const ty = this.portrait.top + (r5 + 0.5 + this.jy[fl.i]) * this.ch;
      const u2 = Math.min(1, (fl.t - fl.tEmit) / fl.dur);
      const e2 = ease(u2);
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
      const c1x = fl.sx + Math.sin(fl.ang) * 50;
      const c1y = Math.min(fl.sy, ty) - fl.lift;
      const m = 1 - e2;
      const x = m * m * fl.sx + 2 * m * e2 * c1x + e2 * e2 * tx;
      const y = m * m * fl.sy + 2 * m * e2 * c1y + e2 * e2 * ty;
      if (y < -30 || y > this.vh + 30) {
        continue;
      }
      this.paintShard(
        page,
        flyBy,
        fl.fs.color,
        fl.fs.shape,
        x,
        y,
        fl.rot0 * (1 - e2),
        0.35 + 0.65 * e2,
      );
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
    this.fillGroups(page, flyBy);
    if (this.burst.length) {
      const burstBy: Record<string, Path2D> = {};
      for (let b = this.burst.length - 1; b >= 0; b -= 1) {
        const bit = this.burst[b];
        bit.t += dt;
        if (bit.t > bit.life) {
          this.burst.splice(b, 1);
          continue;
        }
        bit.vy += 700 * dt;
        bit.x += bit.vx * dt;
        bit.y += bit.vy * dt;
        bit.rot += bit.vr * dt;
        const fade = 1 - bit.t / bit.life;
        this.paintShard(
          page,
          burstBy,
          bit.fs.color,
          bit.fs.shape,
          bit.x,
          bit.y,
          bit.rot,
          fade,
        );
      }
      this.fillGroups(page, burstBy);
    }
    this.drawHeap(view?.heap ?? null);
    if (
      this.grinding &&
      !this.feeding &&
      this.emitted >= this.emitTotal &&
      !this.windAt &&
      !this.sinkAt
    ) {
      this.grinding = false;
      this.windAt = now + 500;
    }
    if (this.pendingSpeak && !this.feeding && this.flights.length === 0) {
      this.pendingSpeak = false;
      this.speakReady = false;
      this.onSpeak?.();
    }
    this.stepLever(dt);
    if (!faceOnScreen) {
      return;
    }
    const speaking = Boolean(audio?.speaking);
    this.nudging =
      this.built >= 1 &&
      !speaking &&
      !this.clickedFace &&
      this.faceReadyAt > 0 &&
      now - this.faceReadyAt > 8000;
    if (this.nudging && !this.reduce && now > this.nextWiggle) {
      this.nextWiggle = now + 2600;
      for (let i = 0; i < this.n; i += 1) {
        if (!this.here[i]) {
          continue;
        }
        this.springX[i] += (this.random() - 0.5) * 70;
        this.springY[i] += (this.random() - 0.5) * 70;
      }
    }
    this.updateAttention(dt, now, speaking);
    if (this.built === 0 && !speaking) {
      return;
    }
    if (speaking !== this.wasSpeaking) {
      if (!speaking) {
        this.hasSpoken = true;
        this.gaze.x = 0;
        this.gaze.y = 0;
        this.gazeT.x = 0;
        this.gazeT.y = 0;
        this.gazeSlowUntil = now + 1200;
        this.nextBlink = Math.max(this.nextBlink, now + 1800);
        this.blendFrom = null;
        this.faceReadyAt = now;
      } else {
        this.blendFrom = this.lastGrid ? this.lastGrid.slice() : null;
        this.blendStart = now;
        this.blendDur = 250;
      }
      this.wasSpeaking = speaking;
    }
    let grid = speaking
      ? this.frames[
          Math.min(this.frames.length - 1, Math.floor((audio?.time ?? 0) * this.fps))
        ]
      : this.idleGrid(now);
    if (this.blendFrom && now - this.blendStart < this.blendDur) {
      const bu = (now - this.blendStart) / this.blendDur;
      const be = bu * bu * (3 - 2 * bu);
      const from = this.blendFrom;
      if (!this.blendBuf || this.blendBuf.length !== grid.length) {
        this.blendBuf = new Uint8Array(grid.length);
      }
      const out = this.blendBuf;
      for (let i = 0; i < from.length; i += 1) {
        out[i] = from[i] + (grid[i] - from[i]) * be;
      }
      grid = out;
    } else {
      this.blendFrom = null;
    }
    if (this.lastGrid && this.wasSpeaking === false && this.justEnded) {
      let diff = 0;
      for (let i = 0; i < grid.length; i += 1) {
        diff += Math.abs(grid[i] - this.lastGrid[i]);
      }
      this.handover = diff / grid.length;
    }
    this.justEnded = speaking;
    this.lastGrid = grid === this.blendBuf ? grid.slice() : grid;
    this.restingNow = !speaking;
    this.drawFace(grid, dt, now, face, page);
  }

  wantsNudge() {
    return this.nudging;
  }

  handoverChange() {
    return this.handover;
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

  overlayActive() {
    return Boolean(
      this.feeding ||
        this.flights.length ||
        this.intake.length ||
        this.burst.length ||
        this.grinding ||
        this.effect?.type === "swarm",
    );
  }

  fallingViews(): FallingPiece[] {
    const views: FallingPiece[] = [];
    for (const piece of this.live) {
      views.push({
        id: piece.id,
        x: piece.x - this.scrollX,
        y: piece.y - this.scrollY,
        rot: piece.rot,
        color: piece.color,
        clip: piece.clip,
        box: piece.box,
      });
    }
    return views;
  }

  private spawnFragment(x: number, y: number, vx: number, vy: number, size: number) {
    const rot = this.random() * 6.28;
    const vr = (this.random() - 0.5) * 14;
    const shape = this.makeShape(size);
    const color = CLAY[Math.floor(this.random() * CLAY.length)];
    const flutter = this.random() * 6.28;
    let reach = 1;
    for (let i = 0; i < shape.length; i += 1) {
      reach = Math.max(reach, Math.abs(shape[i][0]), Math.abs(shape[i][1]));
    }
    const box = Math.ceil(reach * 2 + 2);
    const half = box / 2;
    const clip = `polygon(${shape
      .map((point) => `${(point[0] + half).toFixed(2)}px ${(point[1] + half).toFixed(2)}px`)
      .join(",")})`;
    this.live.push({
      id: this.nextPieceId,
      x,
      y,
      vx,
      vy,
      rot,
      vr,
      size,
      shape,
      color,
      flutter,
      cell: -1,
      clip,
      box,
    });
    this.nextPieceId += 1;
  }

  private drawHeap(ctx: CanvasRenderingContext2D | null) {
    if (!ctx || !this.heapDirty) {
      return;
    }
    const scale = this.dpr || 1;
    const width = ctx.canvas.width / scale;
    const height = ctx.canvas.height / scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const groups: Record<string, Path2D> = {};
    const floorLocal = height - 8;
    for (const body of this.settled) {
      this.paintShard(
        ctx,
        groups,
        body.color,
        body.shape,
        body.x - this.scrollX - this.trayScreenLeft,
        floorLocal - body.y,
        body.rot,
      );
    }
    this.fillGroups(ctx, groups);
    this.heapDirty = this.heapMoving();
  }

  seedWarmHeap(count: number) {
    const left = this.trayLeftX + 8;
    const right = Math.max(left + 40, this.wallX - 8);
    const span = right - left;
    for (let i = 0; i < count; i += 1) {
      const size = 4 + (i % 6);
      this.land({
        id: 0,
        x: left + (i % 17) * (span / 17),
        y: this.floorY - 20 - (i % 8) * 12,
        vx: ((i % 5) - 2) * 30,
        vy: 60,
        rot: i * 0.2,
        vr: 1,
        size,
        shape: this.makeShape(size),
        color: CLAY[i % CLAY.length],
        flutter: 0,
        cell: -1,
        clip: "",
        box: 1,
      });
    }
  }

  pumpWarmHeap() {
    this.stepHeap(1 / 60);
  }

  clearWarmHeap() {
    this.settled = [];
    this.heapDirty = false;
  }

  faceFilled() {
    let arrived = 0;
    for (let i = 0; i < this.n; i += 1) {
      if (this.vmax[i] > 0.04 && this.here[i]) {
        arrived += 1;
      }
    }
    return this.full ? arrived / this.full : 0;
  }

  awake() {
    if (
      this.live.length ||
      this.flights.length ||
      this.intake.length ||
      this.burst.length ||
      this.feeding ||
      this.dragging ||
      this.snapping ||
      this.effect ||
      this.armAt ||
      this.windAt ||
      this.sinkAt ||
      this.crusherOn
    ) {
      return true;
    }
    if (this.crusherUp ? this.crOpen < 0.999 : this.crOpen > 0.001) {
      return true;
    }
    if (Math.abs(this.winH - this.winTarget) > 0.5) {
      return true;
    }
    return this.heapMoving();
  }

  private heapMoving() {
    for (let i = 0; i < this.settled.length; i += 1) {
      if (!this.settled[i].asleep) {
        return true;
      }
    }
    return false;
  }

  private stepHeap(dt: number) {
    if (!this.settled.length) {
      this.heapPast = 0;
      this.heapLeft = 0;
      this.furthestRight = 0;
      this.heapAwake = 0;
      return;
    }
    this.heapClock += Math.min(dt, 0.05);
    let guard = 0;
    while (this.heapClock >= HEAP_H && guard < 12) {
      guard += 1;
      this.heapClock -= HEAP_H;
      for (const body of this.settled) {
        if (body.asleep) {
          continue;
        }
        const gapX = body.x - body.px;
        const gapY = body.y - body.py;
        const speed = Math.abs(gapX) + Math.abs(gapY);
        // Soft-damp only on the floor; stacked pieces use normal damping so floaters fall.
        const onFloor = body.y <= body.r + 2.5;
        const damp = !this.feeding && speed < 1.5 && onFloor ? 0.9 : 0.985;
        const vx = gapX * damp;
        const vy = gapY * damp;
        body.flow = Math.abs(vx) + Math.abs(vy);
        body.px = body.x;
        body.py = body.y;
        body.x +=
          vx +
          (this.feeding ? 900 + 9 * Math.max(0, this.wallX - body.x) : 0) *
            HEAP_H *
            HEAP_H;
        body.y += vy - HEAP_G * HEAP_H * HEAP_H;
        body.rot += body.vr * HEAP_H;
        body.vr *= 0.995;
      }
      const grid = new Map<number, number[]>();
      for (let i = 0; i < this.settled.length; i += 1) {
        const body = this.settled[i];
        const key =
          Math.floor(body.x / HEAP_CELL) * 8192 +
          Math.floor(body.y / HEAP_CELL);
        const list = grid.get(key);
        if (list) {
          list.push(i);
        } else {
          grid.set(key, [i]);
        }
      }
      const iterations = this.feeding ? 2 : 3;
      for (let it = 0; it < iterations; it += 1) {
        for (let i = 0; i < this.settled.length; i += 1) {
          const body = this.settled[i];
          const cx0 = Math.floor(body.x / HEAP_CELL);
          const cy0 = Math.floor(body.y / HEAP_CELL);
          for (let gx = cx0 - 1; gx <= cx0 + 1; gx += 1) {
            for (let gy = cy0 - 1; gy <= cy0 + 1; gy += 1) {
              const list = grid.get(gx * 8192 + gy);
              if (!list) {
                continue;
              }
              for (const j of list) {
                if (j <= i) {
                  continue;
                }
                const other = this.settled[j];
                if (body.asleep && other.asleep) {
                  continue;
                }
                const dx = other.x - body.x;
                const dy = other.y - body.y;
                const rr = body.r + other.r;
                const d2 = dx * dx + dy * dy;
                if (d2 >= rr * rr || d2 < 1e-8) {
                  continue;
                }
                const d = Math.sqrt(d2);
                const nx = dx / d;
                const ny = dy / d;
                const over = rr - d;
                const hit =
                  (!body.asleep &&
                    Math.abs(body.x - body.px) + Math.abs(body.y - body.py) >
                      1) ||
                  (!other.asleep &&
                    Math.abs(other.x - other.px) + Math.abs(other.y - other.py) >
                      1);
                // A firm landing or shove wakes the sleeper it hits.
                if (over > 3 && hit && (body.asleep || other.asleep)) {
                  body.asleep = false;
                  other.asleep = false;
                  body.still = 0;
                  other.still = 0;
                }
                const wb = body.asleep ? 0 : other.asleep ? 1 : 0.5;
                const wo = other.asleep ? 0 : body.asleep ? 1 : 0.5;
                body.x -= nx * over * wb;
                body.y -= ny * over * wb;
                other.x += nx * over * wo;
                other.y += ny * over * wo;
                const tx = -ny;
                const ty = nx;
                const rel =
                  ((other.x - other.px) - (body.x - body.px)) * tx +
                  ((other.y - other.py) - (body.y - body.py)) * ty;
                const friction = rel * 0.4;
                body.px -= tx * friction * wb;
                body.py -= ty * friction * wb;
                other.px += tx * friction * wo;
                other.py += ty * friction * wo;
              }
            }
          }
        }
        for (const body of this.settled) {
          if (!body.asleep && body.y < body.r) {
            body.y = body.r;
            if (!this.feeding) {
              body.px = body.x - (body.x - body.px) * 0.6;
            }
            body.py = body.y;
          }
          if (body.x < this.trayLeftX + body.r) {
            const overlap = this.trayLeftX + body.r - body.x;
            body.x = this.trayLeftX + body.r;
            body.px = body.x;
            if (body.asleep && overlap > 0.5) {
              body.asleep = false;
              body.still = 0;
            }
          }
          if (body.x > this.wallX - body.r) {
            const overlap = body.x - (this.wallX - body.r);
            body.x = this.wallX - body.r;
            body.px = body.x;
            // The sliding wall still shoves a piece that has already gone to sleep.
            if (body.asleep && overlap > 0.5) {
              body.asleep = false;
              body.still = 0;
            }
          }
        }
      }
      for (const body of this.settled) {
        if (body.asleep) {
          continue;
        }
        const mv = body.flow;
        // Falling or floating pieces never sleep; only resting, supported ones do.
        if (!this.feeding && this.bodySupported(body)) {
          if (mv < 0.35) {
            body.still += HEAP_H;
            if (body.still > 0.12) {
              body.asleep = true;
              body.px = body.x;
              body.py = body.y;
              body.flow = 0;
            }
          } else if (mv < 0.85) {
            body.still += HEAP_H * 0.45;
            if (body.still > 0.45) {
              body.asleep = true;
              body.px = body.x;
              body.py = body.y;
              body.flow = 0;
            }
          } else {
            body.still = 0;
          }
        } else {
          body.still = 0;
        }
      }
    }
    if (this.feeding) {
      let took = 0;
      for (let i = this.settled.length - 1; i >= 0 && took < 6; i -= 1) {
        const body = this.settled[i];
        if (body.x > this.wallX - body.r - 3 && body.y < 60) {
          this.settled.splice(i, 1);
          this.heapDirty = true;
          this.fedCount += 1;
          took += 1;
          this.intake.push({
            x: body.x,
            y: body.y,
            shape: body.shape,
            color: body.color,
            rot: body.rot,
            t: 0,
          });
          this.wakeNear(body.x, body.y, 40);
        }
      }
    }
    this.noteWall();
  }

  /** True when the piece sits on the tray floor or on another piece beneath it. */
  private bodySupported(body: { x: number; y: number; r: number }) {
    const bottom = body.y - body.r;
    if (bottom <= 2.5) {
      return true;
    }
    let bestGap = Number.POSITIVE_INFINITY;
    for (const other of this.settled) {
      if (other === body) {
        continue;
      }
      if (other.y >= body.y) {
        continue;
      }
      const dx = body.x - other.x;
      if (Math.abs(dx) > body.r + other.r + 1.5) {
        continue;
      }
      const gap = bottom - (other.y + other.r);
      if (gap < bestGap) {
        bestGap = gap;
      }
    }
    // Supported when sitting on (or slightly into) a piece below.
    return bestGap <= 4;
  }

  private wakeNear(x: number, y: number, rad: number) {
    for (const body of this.settled) {
      if (Math.abs(body.x - x) < rad && body.y > y - 4 && body.y < y + rad * 3) {
        body.asleep = false;
        body.still = 0;
      }
    }
  }

  private noteWall() {
    let past = 0;
    let left = 0;
    let furthest = 0;
    let awake = 0;
    for (const body of this.settled) {
      if (body.x > furthest) {
        furthest = body.x;
      }
      if (!body.asleep) {
        awake += 1;
      }
      if (body.x + body.r > this.wallX + 0.05) {
        past += 1;
      }
      if (body.x - body.r < this.trayLeftX - 0.05) {
        left += 1;
      }
    }
    this.furthestRight = furthest;
    this.heapPast = past;
    this.heapLeft = left;
    this.heapAwake = awake;
  }

  private land(p: LivePiece) {
    const r = Math.max(2.2, p.size * 0.55);
    const x = Math.min(p.x, this.wallX - r);
    const y = Math.max(r, this.floorY - p.y);
    const vx = p.vx * 0.5;
    const vy = -p.vy * 0.5;
    this.settled.push({
      x,
      y,
      px: x - vx * HEAP_H,
      py: y - vy * HEAP_H,
      r,
      rot: p.rot,
      vr: p.vr * 0.2,
      size: p.size,
      shape: p.shape,
      color: p.color,
      cell: p.cell,
      still: 0,
      asleep: false,
      flow: Math.abs(vx) + Math.abs(vy),
    });
    this.heapDirty = true;
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
      for (let i = 0; i < this.n; i += 1) {
        if (this.vmax[i] > 0.04 && !this.here[i]) {
          this.here[i] = 1;
          this.regArrive[i] = this.now;
        }
      }
      this.settled = [];
      this.heapDirty = true;
      this.feeding = false;
      this.grinding = false;
      this.pendingSpeak = true;
      this.speakReady = true;
      this.winTarget = this.ph;
      this.setWindow(this.ph);
      this.noteWall();
      return;
    }
    this.todoFace = [];
    if (this.packedOrder) {
      for (let k = 0; k < this.packedOrder.length; k += 1) {
        const i = this.packedOrder[k];
        if (this.vmax[i] > 0.04 && !this.here[i]) {
          this.todoFace.push({ i, key: 0 });
        }
      }
    } else {
      for (let i = 0; i < this.n; i += 1) {
        if (this.vmax[i] > 0.04 && !this.here[i]) {
          this.todoFace.push({
            i,
            key: Math.floor(i / this.sc) + this.random() * 6,
          });
        }
      }
      this.todoFace.sort((a, b) => b.key - a.key);
    }
    this.emitTotal = this.todoFace.length;
    this.emitted = 0;
    this.fedCount = 0;
    this.feedTotal = Math.max(1, this.settled.length);
    for (const body of this.settled) {
      body.asleep = false;
      body.still = 0;
      body.px = body.x;
      body.py = body.y;
    }
    this.feeding = true;
    this.feedStart = this.now;
    this.crusherOn = true;
    this.onRumble?.(true);
    this.grinding = true;
    this.pendingSpeak = true;
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
    for (const body of this.settled) {
      body.asleep = false;
      body.still = 0;
    }
    if (this.reduce) {
      this.launch();
      return;
    }
    this.crusherUp = true;
    this.crusherSinking = false;
    this.armAt = this.now + 800;
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
    scale = 1,
  ) {
    const ca = Math.cos(rot) * scale;
    const sa = Math.sin(rot) * scale;
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
    for (let q = 0; q < shape.length; q += 1) {
      const qx = shape[q][0];
      const qy = shape[q][1];
      const px = x + qx * ca - qy * sa;
      const py = y + qx * sa + qy * ca;
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
    this.gaze.x += (this.gazeT.x - this.gaze.x) * Math.min(1, dt * (now < this.gazeSlowUntil ? 2.5 : 12));
    this.gaze.y += (this.gazeT.y - this.gaze.y) * Math.min(1, dt * (now < this.gazeSlowUntil ? 2.5 : 12));
    this.par.x += (this.parT.x - this.par.x) * Math.min(1, dt * 5);
    this.par.y += (this.parT.y - this.par.y) * Math.min(1, dt * 5);
    this.dozeLevel += ((this.dozing ? 1 : 0) - this.dozeLevel) * Math.min(1, dt * 1.5);
  }

  private idleGrid(now: number) {
    if (!this.dozing && now > this.nextBlink) {
      this.blinkUntil = now + 140;
      this.nextBlink = now + 2500 + this.random() * 3500;
    }
    const k = this.hasSpoken ? this.idleEnd[this.idleEnd.length - 1] : 0;
    const base = this.frames[k];
    const g = new Uint8Array(base);
    const at = (r: number, c: number) => base[r * this.cols + c];
    const put = (r: number, c: number, v: number) => {
      if (r >= 0 && c >= 0 && r < this.nr && c < this.cols) {
        g[r * this.cols + c] = v;
      }
    };
    const sxAll = Math.round(this.gaze.x * 2);
    const sy = Math.round(this.gaze.y * 1);
    const closed = now < this.blinkUntil || this.dozing;
    const pair = this.hasSpoken
      ? (this.eyesEnd[this.eyesEnd.length - 1] ?? [])
      : (this.eyes[0] ?? []);
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
            put(r, c, at(Math.min(this.nr - 1, eye.r1 + 1), c));
          }
        }
        for (let c = minC - 1; c <= maxC + 1; c += 1) {
          put(mid, c, Math.round(this.topv * 0.75));
        }
        return;
      }
      for (const p of eye.iris) {
        put(p[0], p[1], Math.round(this.topv * 0.45));
      }
      for (const p of eye.iris) {
        const r = p[0] + sy;
        const c = p[1] + sx;
        if (r >= eye.r0 && r < eye.r1 && c >= eye.c0 && c < eye.c1) {
          put(r, c, p[2]);
        }
      }
    });
    return g;
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
    if (this.effect.type === "decode") {
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
      if (this.random() < 0.35) {
        const x = (s + 0.5) * this.cw;
        const y = (r + 0.5) * this.ch;
        const dx = x - hcx;
        const dy = y - hcy;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const sp = 300 + this.random() * 500;
        this.burst.push({
          fs: this.faceShard(i),
          x: this.portrait.left + hcx + dx * 1.7,
          y: this.portrait.top + hcy + dy * 1.7,
          vx: (dx / d) * sp,
          vy: (dy / d) * sp - 150,
          life: 0.7 + this.random() * 0.4,
          t: 0,
          rot: 0,
          vr: (this.random() - 0.5) * 20,
        });
      }
    }
    const n = Math.ceil((CHUNKS_FULL * popped) / this.full);
    const pageX = this.portrait.left + this.scrollX + hcx;
    const pageY = this.portrait.top + this.scrollY + hcy;
    for (let k = 0; k < n; k += 1) {
      const sz = 4 + this.random() * 6;
      const a = this.random() * 6.283;
      const sp2 = 80 + this.random() * 320;
      this.spawnFragment(
        pageX + Math.cos(a) * 30,
        pageY + Math.sin(a) * 30,
        Math.cos(a) * sp2,
        Math.sin(a) * sp2 - 180,
        sz,
      );
    }
    this.builtCount -= popped;
    this.built = this.builtCount / this.full;
    this.onThunk?.(true);
    return popped;
  }

  private drawFace(
    grid: Uint8Array,
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
    const breathe =
      this.reduce || !this.restingNow ? 0 : Math.sin(now / 1000 * 1.5) * this.pw * 0.0022;
    const pxs = this.reduce ? 0 : this.par.x * this.pw * 0.018;
    const pys = this.reduce ? 0 : this.par.y * this.pw * 0.012;
    const touching = this.pointer.inside && !this.reduce;
    const reach = this.pw * 0.09;
    const reach2 = reach * reach;
    const push = this.pw * 9;
    const paths: Array<Path2D | null> = [null, null, null];
    const chars: string[][] = [[], [], []];
    for (let r = 0; r < this.nr; r += 1) {
      const rowAt = r * this.cols;
      for (let s = 0; s < this.sc; s += 1) {
        const i = r * this.sc + s;
        if (!this.here[i] || (swarming && this.away[i])) {
          continue;
        }
        const since = now - this.regArrive[i];
        const pulse = since < 200 ? 1 + 0.25 * Math.sin((since / 200) * Math.PI) : 1;
        const v = (grid[rowAt + s * 2] + grid[rowAt + s * 2 + 1]) / (2 * this.topv);
        const ef = this.effectAt(
          i,
          r,
          s,
          (s + 0.5 + this.jx[i]) * this.cw + pxs * this.depth[i],
          (r + 0.5 + this.jy[i]) * this.ch + pys * this.depth[i] + breathe * (1 - r / this.nr),
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

export function startHeapWarmup() {
  const sim = new PortraitSim(
    {
      fps: 20,
      cols: 2,
      nr: 1,
      sc: 1,
      n: 1,
      full: 1,
      frameCount: 1,
      ramp: " #",
      idle: [0],
      eyes: [],
      idleEnd: [0],
      eyesEnd: [[]],
      headCol: 0.5,
      vmax: new Float32Array([0.5]),
      shape: new Float32Array(6).fill(0.2),
      jx: new Float32Array(1),
      jy: new Float32Array(1),
      depth: new Float32Array(1),
      rnd1: new Float32Array(1),
      rnd2: new Float32Array(1),
      order: new Uint16Array([0]),
      frames: [new Uint8Array(2)],
    },
    { reduce: false },
  );
  sim.sync({
    vw: 900,
    vh: 800,
    scrollX: 0,
    scrollY: 0,
    dpr: 1,
    tray: { left: 10, top: 400, width: 700, height: 240 },
    leverLeft: 560,
    crusher: { left: 470, top: 540, width: 86, height: 92 },
    portrait: { left: 10, top: 10, width: 80, height: 80 },
    looks: [],
  });
  sim.seedWarmHeap(160);
  let left = 480;
  const pump = () => {
    const start = performance.now();
    while (left > 0 && performance.now() - start < 6) {
      sim.pumpWarmHeap();
      left -= 1;
    }
    if (left > 0) {
      setTimeout(pump, 0);
      return;
    }
    sim.clearWarmHeap();
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(pump, { timeout: 100 });
  } else {
    setTimeout(pump, 50);
  }
}
