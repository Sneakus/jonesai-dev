import { Matrix4, Quaternion, Vector3, type Line, type Mesh, type Object3D } from "three";
import { driverFrame, LEAD_TOE, TRAIL_TOE, type SwingPose } from "./swing-pose";
import { Vec } from "./swing-vec";

const up = new Vector3(0, 1, 0);
const a = new Vector3();
const b = new Vector3();
const dir = new Vector3();
const basis = new Matrix4();
const quat = new Quaternion();

function put(out: Vector3, v: Vec) {
  out.set(v.x, v.y, v.z);
}

export function setBone(mesh: Object3D, from: Vec, to: Vec) {
  put(a, from);
  put(b, to);
  dir.subVectors(b, a);
  const len = dir.length();
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.scale.set(1, Math.max(len, 0.0001), 1);
  if (len > 1e-8) mesh.quaternion.setFromUnitVectors(up, dir.normalize());
}

export function setJoint(mesh: Object3D, point: Vec) {
  put(mesh.position, point);
}

export function drawDriver(grip: Object3D, shaft: Object3D, head: Mesh, face: Mesh, pose: SwingPose) {
  const club = driverFrame(pose);
  setBone(grip, club.gripEnd, club.gripLow);
  setBone(shaft, club.gripLow, club.hosel);
  basis.makeBasis(
    a.set(club.toe.x, club.toe.y, club.toe.z),
    b.set(club.crown.x, club.crown.y, club.crown.z),
    dir.set(-club.faceN.x, -club.faceN.y, -club.faceN.z),
  );
  quat.setFromRotationMatrix(basis);
  head.quaternion.copy(quat);
  face.quaternion.copy(quat);
  put(head.position, club.headCentre);
  put(face.position, club.face);
}

export function showTrail(line: Line, positions: Float32Array, points: Vec[], fallback: Vec) {
  const count = Math.min(points.length, positions.length / 3);
  for (let i = 0; i < count; i += 1) {
    const point = points[i] ?? fallback;
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;
  }
  line.geometry.setDrawRange(0, count);
  line.geometry.attributes.position.needsUpdate = true;
}

export { LEAD_TOE, TRAIL_TOE };
