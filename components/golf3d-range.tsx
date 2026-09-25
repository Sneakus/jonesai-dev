"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { Canvas } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import Link from "next/link";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { BackSide, BufferAttribute, BufferGeometry, Color, DoubleSide, LineBasicMaterial, Mesh, MeshBasicMaterial, Line as ThreeLine, PerspectiveCamera, type Group } from "three";
import { fitSwingCamera, SWING_FOV } from "@/src/games/golf/camera-fit";
import { fly, type FlightResult } from "@/src/games/golf/flight";
import { curveYards, shotKey } from "@/src/games/golf/outcomes";
import { stepCamera, stepShot } from "@/src/games/golf/range-play";
import { rangeSettings as range } from "@/src/games/golf/settings";
import { shotToFlight } from "@/src/games/golf/shot-flight";
import type { ShotReading } from "@/src/games/golf/shot-rules";
import { gentleStrike } from "@/src/games/golf/strike";
import { drawDriver, setBone, setJoint, showTrail } from "@/src/games/golf/swing-draw";
import { IMPACT_TIME, LEAD_TOE, swingPose, SWING_END, TRAIL_TOE } from "@/src/games/golf/swing-pose";
import { Vec } from "@/src/games/golf/swing-vec";
import { golfTheme as theme, type ShotCopy } from "@/src/games/golf/theme";

export type { ShotCopy };

export type PlayClock = {
  time: number;
  trail: boolean;
  token: number;
  shot: ShotReading | null;
  reduce: boolean;
};

type Panel = {
  name: string;
  line: string;
  total: number;
  offline: number;
};

type FlightHold = {
  shot: FlightResult;
  input: ReturnType<typeof gentleStrike>;
  born: number;
  reported: boolean;
};

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const boneNames = ["spine", "neck", "shoulders", "hips", "lUp", "lLo", "tUp", "tLo", "lTh", "lSh", "tTh", "tSh", "lFoot", "tFoot"] as const;
const jointNames = ["leadSh", "trailSh", "leadElbow", "trailElbow", "leadWrist", "trailWrist", "leadHip", "trailHip", "leadKnee", "trailKnee", "leadAnkle", "trailAnkle", "P", "S"] as const;

function Golfer({
  swingId,
  scrub,
  slow,
  reduce,
  play,
  onImpact,
  onReady,
}: {
  swingId: number;
  scrub: number | null;
  slow: boolean;
  reduce: boolean;
  play: MutableRefObject<PlayClock> | null;
  onImpact: (clock: number) => void;
  onReady: () => void;
}) {
  const impact = useRef(onImpact);
  const sent = useRef(0);
  const swingTime = useRef(0);
  const trail = useRef<Vec[]>([]);
  const bones = useRef<Partial<Record<(typeof boneNames)[number], Mesh>>>({});
  const joints = useRef<Partial<Record<(typeof jointNames)[number], Mesh>>>({});
  const headRing = useRef<Mesh>(null);
  const grip = useRef<Mesh>(null);
  const shaft = useRef<Mesh>(null);
  const clubHead = useRef<Mesh>(null);
  const clubFace = useRef<Mesh>(null);
  const trailPositions = useMemo(() => new Float32Array(16 * 3), []);
  const trailLine = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(trailPositions, 3));
    geometry.setDrawRange(0, 0);
    const material = new LineBasicMaterial({ color: theme.clay, transparent: true, opacity: 0.7 });
    const line = new ThreeLine(geometry, material);
    line.frustumCulled = false;
    return line;
  }, [trailPositions]);

  useEffect(() => {
    impact.current = onImpact;
  }, [onImpact]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  useEffect(() => {
    swingTime.current = 0;
    sent.current = 0;
    trail.current = [];
  }, [swingId]);

  useFrame((state, delta) => {
    if (play) {
      const clock = play.current;
      const pose = swingPose(clock.time);
      const parts: [Mesh | null, Vec, Vec][] = [
        [bones.current.spine ?? null, pose.P, pose.S],
        [bones.current.neck ?? null, pose.S, pose.neck],
        [bones.current.shoulders ?? null, pose.leadSh, pose.trailSh],
        [bones.current.hips ?? null, pose.leadHip, pose.trailHip],
        [bones.current.lUp ?? null, pose.leadSh, pose.leadElbow],
        [bones.current.lLo ?? null, pose.leadElbow, pose.leadWrist],
        [bones.current.tUp ?? null, pose.trailSh, pose.trailElbow],
        [bones.current.tLo ?? null, pose.trailElbow, pose.trailWrist],
        [bones.current.lTh ?? null, pose.leadHip, pose.leadKnee],
        [bones.current.lSh ?? null, pose.leadKnee, pose.leadAnkle],
        [bones.current.tTh ?? null, pose.trailHip, pose.trailKnee],
        [bones.current.tSh ?? null, pose.trailKnee, pose.trailAnkle],
        [bones.current.lFoot ?? null, pose.leadAnkle, LEAD_TOE],
        [bones.current.tFoot ?? null, pose.trailAnkle, TRAIL_TOE],
      ];
      for (const [mesh, from, to] of parts) if (mesh) setBone(mesh, from, to);
      for (const name of jointNames) {
        const mesh = joints.current[name];
        if (mesh) setJoint(mesh, pose[name]);
      }
      if (headRing.current) {
        headRing.current.position.set(pose.headPos.x, pose.headPos.y, pose.headPos.z);
        headRing.current.lookAt(state.camera.position);
      }
      if (grip.current && shaft.current && clubHead.current && clubFace.current) {
        drawDriver(grip.current, shaft.current, clubHead.current, clubFace.current, pose);
      }
      if (clock.trail) {
        trail.current.push(pose.head.clone());
        if (trail.current.length > 16) trail.current.shift();
      } else if (trail.current.length) trail.current.shift();
      showTrail(trailLine, trailPositions, trail.current, pose.head);
      if (sent.current !== clock.token && clock.time >= IMPACT_TIME) {
        sent.current = clock.token;
        impact.current(state.clock.elapsedTime);
      }
      return;
    }
    const scrubbing = scrub !== null;
    if (!scrubbing && !reduce && swingId > 0 && swingTime.current < SWING_END) {
      swingTime.current = Math.min(SWING_END, swingTime.current + delta * (slow ? 0.25 : 1));
    }
    const time = scrubbing ? scrub * SWING_END : reduce ? 0 : swingTime.current;
    const pose = swingPose(time);
    const parts: [Mesh | null, Vec, Vec][] = [
      [bones.current.spine ?? null, pose.P, pose.S],
      [bones.current.neck ?? null, pose.S, pose.neck],
      [bones.current.shoulders ?? null, pose.leadSh, pose.trailSh],
      [bones.current.hips ?? null, pose.leadHip, pose.trailHip],
      [bones.current.lUp ?? null, pose.leadSh, pose.leadElbow],
      [bones.current.lLo ?? null, pose.leadElbow, pose.leadWrist],
      [bones.current.tUp ?? null, pose.trailSh, pose.trailElbow],
      [bones.current.tLo ?? null, pose.trailElbow, pose.trailWrist],
      [bones.current.lTh ?? null, pose.leadHip, pose.leadKnee],
      [bones.current.lSh ?? null, pose.leadKnee, pose.leadAnkle],
      [bones.current.tTh ?? null, pose.trailHip, pose.trailKnee],
      [bones.current.tSh ?? null, pose.trailKnee, pose.trailAnkle],
      [bones.current.lFoot ?? null, pose.leadAnkle, LEAD_TOE],
      [bones.current.tFoot ?? null, pose.trailAnkle, TRAIL_TOE],
    ];
    for (const [mesh, from, to] of parts) if (mesh) setBone(mesh, from, to);
    for (const name of jointNames) {
      const mesh = joints.current[name];
      if (mesh) setJoint(mesh, pose[name]);
    }
    if (headRing.current) {
      headRing.current.position.set(pose.headPos.x, pose.headPos.y, pose.headPos.z);
      headRing.current.lookAt(state.camera.position);
    }
    if (grip.current && shaft.current && clubHead.current && clubFace.current) {
      drawDriver(grip.current, shaft.current, clubHead.current, clubFace.current, pose);
    }
    if (scrubbing) trail.current = [];
    else if (!reduce && swingId > 0) {
      trail.current.push(pose.head.clone());
      if (trail.current.length > 16) trail.current.shift();
    } else if (trail.current.length) trail.current.shift();
    showTrail(trailLine, trailPositions, trail.current, pose.head);
    if (reduce && swingId > 0 && sent.current !== swingId) {
      sent.current = swingId;
      impact.current(state.clock.elapsedTime);
    }
    if (scrubbing || reduce || swingId === 0 || sent.current === swingId) return;
    if (time >= IMPACT_TIME) {
      sent.current = swingId;
      impact.current(state.clock.elapsedTime);
    }
  });

  const boneMaterial = useMemo(() => new MeshBasicMaterial({ color: theme.bone }), []);
  const jointMaterial = useMemo(() => new MeshBasicMaterial({ color: theme.joint }), []);

  return (
    <group>
      {boneNames.map((name) => (
        <mesh
          key={name}
          ref={(node) => {
            bones.current[name] = node ?? undefined;
          }}
          material={boneMaterial}
          frustumCulled={false}
        >
          <cylinderGeometry args={[0.012, 0.012, 1, 6]} />
        </mesh>
      ))}
      {jointNames.map((name) => (
        <mesh
          key={name}
          ref={(node) => {
            joints.current[name] = node ?? undefined;
          }}
          material={jointMaterial}
          frustumCulled={false}
        >
          <sphereGeometry args={[0.022, 10, 8]} />
        </mesh>
      ))}
      <mesh ref={headRing} material={jointMaterial} frustumCulled={false}>
        <torusGeometry args={[0.09, 0.013, 8, 28]} />
      </mesh>
      <mesh ref={grip} frustumCulled={false}>
        <cylinderGeometry args={[0.0115, 0.0095, 1, 10]} />
        <meshLambertMaterial color={theme.grip} />
      </mesh>
      <mesh ref={shaft} frustumCulled={false}>
        <cylinderGeometry args={[0.0055, 0.0045, 1, 8]} />
        <meshBasicMaterial color={theme.shaft} />
      </mesh>
      <mesh ref={clubHead} scale={[0.058, 0.031, 0.053]} frustumCulled={false}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color={theme.ink} roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh ref={clubFace} scale={[0.045, 0.024, 1]} frustumCulled={false}>
        <circleGeometry args={[1, 24]} />
        <meshStandardMaterial color={theme.muted} roughness={0.6} metalness={0.3} side={DoubleSide} />
      </mesh>
      <primitive object={trailLine} />
    </group>
  );
}

function Ground() {
  const uniforms = useMemo(
    () => ({
      uA: { value: new Color(theme.grass) },
      uB: { value: new Color(theme.grassStripe) },
    }),
    [],
  );
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -140]} receiveShadow>
      <planeGeometry args={[90, 640]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          uniform vec3 uA;
          uniform vec3 uB;
          void main() {
            float stripe = step(0.5, fract(vUv.y * 90.0));
            gl_FragColor = vec4(mix(uA, uB, stripe * 0.45), 1.0);
          }
        `}
      />
    </mesh>
  );
}

function Sky() {
  const uniforms = useMemo(
    () => ({
      uTop: { value: new Color(theme.sun) },
      uHorizon: { value: new Color(theme.paper) },
    }),
    [],
  );
  return (
    <mesh frustumCulled={false}>
      <sphereGeometry args={[280, 24, 16]} />
      <shaderMaterial
        side={BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
          varying float vH;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vH = normalize(world.xyz).y;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `}
        fragmentShader={`
          varying float vH;
          uniform vec3 uTop;
          uniform vec3 uHorizon;
          void main() {
            float t = smoothstep(-0.02, 0.45, vH);
            gl_FragColor = vec4(mix(uHorizon, uTop, t), 1.0);
          }
        `}
      />
    </mesh>
  );
}

function Markers() {
  return (
    <>
      {range.yards.map((yards) => {
        const z = -yards * range.yardToMetre;
        return (
          <group key={yards} position={[4.2, 0, z]}>
            <mesh position={[0, 0.7, 0]} castShadow>
              <boxGeometry args={[0.06, 1.4, 0.06]} />
              <meshStandardMaterial color={theme.ink} />
            </mesh>
            <mesh position={[0.22, 1.35, 0]} castShadow>
              <boxGeometry args={[0.34, 0.22, 0.02]} />
              <meshStandardMaterial color={theme.clay} />
            </mesh>
            <Text
              position={[0.55, 1.32, 0]}
              font={theme.fontUrl}
              color={theme.ink}
              fontSize={0.42}
              anchorX="left"
              anchorY="middle"
            >
              {String(yards)}
            </Text>
          </group>
        );
      })}
    </>
  );
}

function Shot({
  hold,
  reduce,
  onLanded,
}: {
  hold: MutableRefObject<FlightHold | null>;
  reduce: boolean;
  onLanded: (hold: FlightHold) => void;
}) {
  const ball = useRef<Mesh>(null);
  const positions = useMemo(() => new Float32Array(600 * 3), []);
  const tracer = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setDrawRange(0, 0);
    const material = new LineBasicMaterial({ color: theme.clay, transparent: true, opacity: 1 });
    return new ThreeLine(geometry, material);
  }, [positions]);

  useFrame((state) => {
    const current = hold.current;
    if (!current) return;
    const landed = stepShot(current, ball.current, tracer, positions, state.clock.elapsedTime - current.born, reduce);
    if (landed) onLanded(current);
  });

  return (
    <group>
      <mesh ref={ball} visible={false} castShadow>
        <sphereGeometry args={[0.021, 16, 12]} />
        <meshStandardMaterial color={theme.card} />
      </mesh>
      <primitive object={tracer} />
    </group>
  );
}

function FollowCamera({
  hold,
  reduce,
}: {
  hold: MutableRefObject<FlightHold | null>;
  reduce: boolean;
}) {
  const size = useThree((state) => state.size);
  const camera = useThree((state) => state.camera);
  const aspect = size.width / Math.max(size.height, 1);
  const home = useMemo(() => fitSwingCamera(aspect), [aspect]);
  const look = useRef({ x: home.look[0], y: home.look[1], z: home.look[2] });
  useLayoutEffect(() => {
    look.current = { x: home.look[0], y: home.look[1], z: home.look[2] };
    if (!hold.current) {
      camera.position.set(home.position[0], home.position[1], home.position[2]);
      camera.lookAt(home.look[0], home.look[1], home.look[2]);
    }
  }, [camera, hold, home]);
  useFrame((state, delta) => {
    const current = hold.current;
    const age = current ? state.clock.elapsedTime - current.born : 0;
    stepCamera(state.camera as PerspectiveCamera, look.current, current, age, delta, reduce, home);
  });
  return null;
}

function World({
  swingId,
  scrub,
  slow,
  debug,
  reduce,
  play,
  outcomes,
  onPanel,
  onFlight,
  onReady,
}: {
  swingId: number;
  scrub: number | null;
  slow: boolean;
  debug: boolean;
  reduce: boolean;
  play: MutableRefObject<PlayClock> | null;
  outcomes: { [key: string]: ShotCopy };
  onPanel: (panel: Panel) => void;
  onFlight: ((shot: FlightResult) => void) | null;
  onReady: () => void;
}) {
  const hold = useRef<FlightHold | null>(null);
  const tee = useRef<Group>(null);

  useEffect(() => {
    hold.current = null;
    if (tee.current) tee.current.visible = true;
  }, [swingId]);

  useEffect(() => {
    if (scrub !== null && scrub * SWING_END < IMPACT_TIME) {
      hold.current = null;
      if (tee.current) tee.current.visible = true;
    }
  }, [scrub]);

  const launch = (clock: number) => {
    const input = play?.current.shot ? shotToFlight(play.current.shot) : gentleStrike();
    const shot = fly(input);
    hold.current = { shot, input, born: clock, reported: false };
    if (tee.current) tee.current.visible = false;
  };

  const landed = (current: FlightHold) => {
    const key = shotKey({
      strikeOffset: current.input.strikeOffset,
      strikeHeight: current.input.strikeHeight,
      startDirection: current.shot.startDirection,
      curve: curveYards(current.shot.offline, current.shot.total, current.shot.startDirection),
    });
    const copy = outcomes[key];
    const lines = copy?.lines ?? [];
    if (onFlight) {
      onFlight(current.shot);
      return;
    }
    onPanel({
      name: copy?.name ?? key,
      line: lines[Math.floor(Math.random() * lines.length)] ?? "",
      total: current.shot.total,
      offline: current.shot.offline,
    });
  };

  return (
    <>
      <color attach="background" args={[theme.paper]} />
      <fog attach="fog" args={[theme.paper, 28, 210]} />
      <ambientLight intensity={0.55} color={theme.paper} />
      <directionalLight
        color={theme.sun}
        position={[-14, 7, -10]}
        intensity={2.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={2}
        shadow-camera-far={24}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-bias={-0.0008}
      />
      <Sky />
      <Ground />
      <mesh position={[-0.55, 0.01, 0.2]} receiveShadow>
        <boxGeometry args={[1.7, 0.02, 1.3]} />
        <meshStandardMaterial color={theme.field} />
      </mesh>
      <group ref={tee} position={range.ball}>
        <mesh position={[0, 0, 0]} castShadow>
          <sphereGeometry args={[0.021, 16, 12]} />
          <meshStandardMaterial color={theme.card} />
        </mesh>
        <mesh position={[0, -0.02, 0]}>
          <cylinderGeometry args={[0.004, 0.008, 0.04, 6]} />
          <meshStandardMaterial color={theme.line} />
        </mesh>
      </group>
      <Suspense fallback={null}>
        <Golfer swingId={swingId} scrub={scrub} slow={slow} reduce={reduce} play={play} onImpact={launch} onReady={onReady} />
        <Markers />
      </Suspense>
      <Shot hold={hold} reduce={reduce} onLanded={landed} />
      {debug ? (
        <>
          <mesh position={range.ball}>
            <sphereGeometry args={[0.021, 12, 10]} />
            <meshBasicMaterial color={theme.ink} />
          </mesh>
          <mesh position={[range.ball[0], 0.02, range.ball[2] - 12]}>
            <boxGeometry args={[0.02, 0.02, 24]} />
            <meshBasicMaterial color={theme.ink} />
          </mesh>
        </>
      ) : null}
      <FollowCamera hold={hold} reduce={reduce} />
    </>
  );
}

export function Golf3dRange({
  outcomes,
  play = null,
  embedded = false,
  resets = 0,
  onFlight,
  onBox,
}: {
  outcomes: { [key: string]: ShotCopy };
  play?: MutableRefObject<PlayClock> | null;
  embedded?: boolean;
  resets?: number;
  onFlight?: (shot: FlightResult) => void;
  onBox?: (node: HTMLDivElement | null) => void;
}) {
  const [webgl] = useState(supportsWebGL);
  const [swingId, setSwingId] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const [slow, setSlow] = useState(false);
  const debug = useMemo(() => typeof window !== "undefined" && window.location.search === "?debug", []);
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");
  const box = useRef<HTMLDivElement>(null);
  const reduce = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const update = (visible: boolean) => {
      setFrameloop(!document.hidden && visible ? "always" : "never");
    };
    const observer = new IntersectionObserver(([entry]) => update(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(node);
    const onHide = () => update(node.getBoundingClientRect().bottom > 0 && node.getBoundingClientRect().top < window.innerHeight);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  if (!webgl) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold">{theme.copy.title}</h1>
        <p className="mt-3 text-sm text-muted">{theme.copy.noWebgl}</p>
        <Link className="mt-4 inline-block text-sm underline" href="/lab/golf">
          {theme.copy.flatLink}
        </Link>
      </main>
    );
  }

  const side = panel && panel.offline < -0.5 ? theme.copy.left : panel && panel.offline > 0.5 ? theme.copy.right : "";

  const picture = (
      <div ref={(node) => { box.current = node; onBox?.(node); }} className={`relative overflow-hidden rounded-md border border-line bg-paper ${embedded ? "h-[70vh] min-h-80" : "mt-4 h-[70vh] min-h-80"}`}>
        <Canvas
          shadows
          dpr={[1, 1.5]}
          frameloop={frameloop}
          camera={{ position: fitSwingCamera(1.2).position, fov: SWING_FOV, near: 0.1, far: 400 }}
          onCreated={({ gl }) => {
            gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
          }}
        >
          <World
            swingId={play ? resets : swingId}
            scrub={play ? null : scrub}
            slow={slow}
            debug={debug}
            reduce={play ? play.current.reduce : reduce}
            play={play}
            outcomes={outcomes}
            onPanel={setPanel}
            onFlight={onFlight ?? null}
            onReady={() => setReady(true)}
          />
        </Canvas>
        {!ready ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">{theme.copy.loading}</p>
        ) : null}
        {panel && !embedded ? (
          <button
            type="button"
            className="absolute inset-0 flex items-end bg-transparent p-4 text-left"
            onClick={() => setPanel(null)}
          >
            <span className="w-full rounded-md border border-line bg-card p-4">
              <span className="block text-xl font-semibold">{panel.name}</span>
              {panel.line ? <span className="mt-1 block text-sm text-muted">{panel.line}</span> : null}
              <span className="mt-3 block text-sm">
                {theme.copy.distance}: {panel.total.toFixed(0)} {theme.copy.yards}
              </span>
              <span className="block text-sm">
                {theme.copy.offline}: {Math.abs(panel.offline).toFixed(0)} {theme.copy.yards} {side}
              </span>
            </span>
          </button>
        ) : null}
      </div>
  );

  if (embedded) return picture;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-semibold">{theme.copy.title}</h1>
      {picture}
      <button
        type="button"
        className="mt-4 rounded-full border border-line bg-card px-4 py-2 text-sm"
        onClick={() => {
          setPanel(null);
          setScrub(null);
          setSwingId((value) => value + 1);
        }}
      >
        {theme.copy.swing}
      </button>
      <button
        type="button"
        className="ml-2 mt-4 rounded-full border border-line bg-card px-4 py-2 text-sm"
        aria-pressed={slow}
        onClick={() => setSlow((value) => !value)}
      >
        {theme.copy.slow}
      </button>
      <label className="mt-4 block text-sm">
        <span>{theme.copy.scrub}</span>
        <input
          className="mt-2 w-full accent-clay"
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={scrub ?? 0}
          onChange={(event) => {
            const next = Number(event.target.value);
            setScrub(next);
            if (next * SWING_END < IMPACT_TIME) setPanel(null);
          }}
        />
      </label>
    </main>
  );
}
