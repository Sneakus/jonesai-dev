"use client";

import { useFrame } from "@react-three/fiber";
import { Canvas } from "@react-three/fiber";
import { Text, useAnimations, useGLTF } from "@react-three/drei";
import Link from "next/link";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { BackSide, BufferAttribute, BufferGeometry, LineBasicMaterial, Line as ThreeLine, Color, PerspectiveCamera, SkeletonHelper, Vector3, type Group, type Mesh, type Object3D } from "three";
import { fly, type FlightResult } from "@/src/games/golf/flight";
import { curveYards, shotKey } from "@/src/games/golf/outcomes";
import { aimClub, armClip, clubheadPosition, placeRig, scrubFrame, stepCamera, stepShot } from "@/src/games/golf/range-play";
import { rangeSettings as range } from "@/src/games/golf/settings";
import { gentleStrike } from "@/src/games/golf/strike";
import { golfTheme as theme, type ShotCopy } from "@/src/games/golf/theme";

export type { ShotCopy };

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

function SkeletonDebug({ root }: { root: Object3D }) {
  const helper = useMemo(() => new SkeletonHelper(root), [root]);
  return <primitive object={helper} />;
}

function findBone(root: Object3D, end: string): Object3D | undefined {
  let found: Object3D | undefined;
  root.traverse((node) => {
    if (node.name.replace(/[:|]/g, "").endsWith(end)) found = node;
  });
  return found;
}

function Club() {
  const grip = range.gripLength;
  const shaft = range.shaftLength;
  return (
    <group>
      <mesh position={[0, grip / 2, 0]} castShadow>
        <cylinderGeometry args={[0.015, 0.017, grip, 10]} />
        <meshStandardMaterial color={theme.grip} roughness={0.7} />
      </mesh>
      <mesh position={[0, grip + shaft / 2, 0]} castShadow>
        <cylinderGeometry args={[0.004, 0.006, shaft, 8]} />
        <meshStandardMaterial color={theme.shaft} metalness={0.45} roughness={0.35} />
      </mesh>
      <mesh position={[0, grip + shaft + 0.02, 0.03]} rotation={[0.5, 0, 0]} castShadow>
        <boxGeometry args={[0.1, 0.045, 0.055]} />
        <meshStandardMaterial color={theme.ink} metalness={0.55} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Golfer({
  swingId,
  scrub,
  debug,
  onImpact,
  onReady,
}: {
  swingId: number;
  scrub: number | null;
  debug: boolean;
  onImpact: (clock: number) => void;
  onReady: () => void;
}) {
  const { scene, animations } = useGLTF(range.model, false, true);
  const { actions } = useAnimations(animations, scene);
  const rig = useRef<Group>(null);
  const club = useRef<Group>(null);
  const headMark = useRef<Mesh>(null);
  const impact = useRef(onImpact);
  const sent = useRef(0);
  const placed = useRef(false);
  const head = useMemo(() => new Vector3(), []);
  useEffect(() => {
    impact.current = onImpact;
  }, [onImpact]);

  useEffect(() => {
    if (!placed.current || swingId === 0) return;
    const action = actions[range.clip] ?? Object.values(actions)[0];
    if (!action) return;
    armClip(action, true);
  }, [actions, swingId]);

  useLayoutEffect(() => {
    scene.traverse((node) => {
      const mesh = node as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
      }
    });
    const action = actions[range.clip] ?? Object.values(actions)[0];
    if (action && rig.current && !placed.current) {
      placeRig(rig.current, scene, action);
      placed.current = true;
      onReady();
    }
  }, [actions, onReady, scene]);

  useFrame((state) => {
    const action = actions[range.clip] ?? Object.values(actions)[0];
    if (action && scrub !== null) scrubFrame(action, scrub);
    const leftBone = findBone(scene, "LeftHand");
    const rightBone = findBone(scene, "RightHand");
    if (leftBone && rightBone && club.current) {
      scene.updateMatrixWorld(true);
      aimClub(club.current, leftBone, rightBone);
      if (headMark.current) {
        clubheadPosition(leftBone, rightBone, head);
        headMark.current.position.copy(head);
      }
    }
    if (!action || scrub !== null || swingId === 0 || sent.current === swingId) return;
    if (action.time >= range.impactTime) {
      sent.current = swingId;
      impact.current(state.clock.elapsedTime);
    }
  });

  return (
    <>
      <group ref={rig}>
        <primitive object={scene} />
        {debug ? <SkeletonDebug root={scene} /> : null}
      </group>
      <group ref={club}>
        <Club />
      </group>
      {debug ? (
        <mesh ref={headMark}>
          <sphereGeometry args={[0.015, 10, 8]} />
          <meshBasicMaterial color={theme.clay} />
        </mesh>
      ) : null}
    </>
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
  const look = useRef({ x: range.cameraLook[0], y: range.cameraLook[1], z: range.cameraLook[2] });
  useFrame((state, delta) => {
    const current = hold.current;
    const age = current ? state.clock.elapsedTime - current.born : 0;
    stepCamera(state.camera as PerspectiveCamera, look.current, current, age, delta, reduce);
  });
  return null;
}

function World({
  swingId,
  scrub,
  debug,
  reduce,
  outcomes,
  onPanel,
  onReady,
}: {
  swingId: number;
  scrub: number | null;
  debug: boolean;
  reduce: boolean;
  outcomes: { [key: string]: ShotCopy };
  onPanel: (panel: Panel) => void;
  onReady: () => void;
}) {
  const hold = useRef<FlightHold | null>(null);
  const tee = useRef<Group>(null);

  useEffect(() => {
    hold.current = null;
    if (tee.current) tee.current.visible = true;
  }, [swingId]);

  const launch = (clock: number) => {
    const input = gentleStrike();
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[1.5, 1.8]} />
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
        <Golfer swingId={swingId} scrub={scrub} debug={debug} onImpact={launch} onReady={onReady} />
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

export function Golf3dRange({ outcomes }: { outcomes: { [key: string]: ShotCopy } }) {
  const [webgl] = useState(supportsWebGL);
  const [swingId, setSwingId] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
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

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-semibold">{theme.copy.title}</h1>
      <div ref={box} className="relative mt-4 h-[70vh] min-h-80 overflow-hidden rounded-md border border-line bg-paper">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          frameloop={frameloop}
          camera={{ position: range.cameraHome, fov: 42, near: 0.1, far: 400 }}
          onCreated={({ gl }) => {
            gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
          }}
        >
          <World
            swingId={swingId}
            scrub={scrub}
            debug={debug}
            reduce={reduce}
            outcomes={outcomes}
            onPanel={setPanel}
            onReady={() => setReady(true)}
          />
        </Canvas>
        {!ready ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">{theme.copy.loading}</p>
        ) : null}
        {panel ? (
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
      {debug ? (
        <label className="mt-4 block text-sm">
          <span>{theme.copy.scrub}</span>
          <input
            className="mt-2 w-full accent-clay"
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={scrub ?? 0}
            onChange={(event) => setScrub(Number(event.target.value))}
          />
        </label>
      ) : null}
    </main>
  );
}

useGLTF.preload(range.model, false, true);
