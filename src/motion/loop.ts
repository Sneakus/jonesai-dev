type Job = (now: number) => boolean;

type PerfSample = { t: number; ms: number };

type PerfState = {
  samples: PerfSample[];
  asleep: boolean;
  shared: true;
};

const jobs = new Set<Job>();
let raf = 0;
let running = false;

function state(): PerfState {
  const host = window as Window & { __jonesPerf?: PerfState };
  if (!host.__jonesPerf) {
    host.__jonesPerf = { samples: [], asleep: true, shared: true };
  }
  return host.__jonesPerf;
}

function tick(now: number) {
  const started = performance.now();
  let need = false;
  for (const job of jobs) {
    if (job(now)) {
      need = true;
    }
  }
  const perf = state();
  if (perf.samples.length < 4000) {
    perf.samples.push({ t: now, ms: performance.now() - started });
  }
  if (need && jobs.size > 0) {
    raf = window.requestAnimationFrame(tick);
    return;
  }
  running = false;
  raf = 0;
  perf.asleep = true;
}

export function wake() {
  const perf = state();
  perf.asleep = false;
  if (running || jobs.size === 0) {
    return;
  }
  running = true;
  raf = window.requestAnimationFrame(tick);
}

export function attach(job: Job) {
  jobs.add(job);
  wake();
  return () => {
    jobs.delete(job);
    if (jobs.size === 0) {
      if (raf) {
        window.cancelAnimationFrame(raf);
      }
      running = false;
      raf = 0;
      state().asleep = true;
    }
  };
}
