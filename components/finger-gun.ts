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
  ctx.ellipse(-30, 6, 28, 22, 0.05, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(-22, 20, 10, 8, 0.4, 0, Math.PI * 2);
  ctx.ellipse(-34, 22, 9, 7, 0.8, 0, Math.PI * 2);
  ctx.ellipse(-42, 12, 8, 6, 1.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(-6, -8);
  ctx.rotate(-1.2 + thumbDown * 1.45);
  ctx.beginPath();
  ctx.ellipse(16, 0, 18, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(4, -7);
  ctx.lineTo(84, -5.5);
  ctx.quadraticCurveTo(96, 0, 84, 6);
  ctx.lineTo(4, 8);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(12, 0, 11, 10, 0, 0, Math.PI * 2);
  ctx.fill();
}
