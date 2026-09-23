/**
 * A flat finger-gun hand. The fingertip points to the right and the
 * wrist sits on the left. Swap this file for a drawing of a real hand
 * later, and keep the fingertip pointing right so aiming still lines up.
 *
 * thumbDown is 0 when the thumb is up, and 1 when it has snapped down.
 */
export function drawFingerGun(
  ctx: CanvasRenderingContext2D,
  color: string,
  thumbDown: number,
) {
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.ellipse(-58, 14, 56, 44, 0.05, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(-40, 48, 24, 18, 0.4, 0, Math.PI * 2);
  ctx.ellipse(-68, 44, 20, 15, 0.85, 0, Math.PI * 2);
  ctx.ellipse(-86, 22, 16, 13, 1.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(-8, -18);
  ctx.rotate(-1.15 + thumbDown * 1.5);
  ctx.beginPath();
  ctx.ellipse(36, 0, 38, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(8, -18);
  ctx.lineTo(168, -16);
  ctx.quadraticCurveTo(196, 0, 168, 16);
  ctx.lineTo(8, 18);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(24, 0, 24, 22, 0, 0, Math.PI * 2);
  ctx.fill();
}
