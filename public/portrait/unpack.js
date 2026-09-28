self.onmessage = async () => {
  const response = await fetch("/portrait/portrait.bin");
  if (!response.ok) {
    throw new Error("portrait data");
  }
  const buffer = await response.arrayBuffer();
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== "AJPT") {
    throw new Error("portrait data");
  }
  const fps = view.getUint16(4, true);
  const cols = view.getUint16(6, true);
  const nr = view.getUint16(8, true);
  const sc = view.getUint16(10, true);
  const frameCount = view.getUint16(12, true);
  const n = view.getUint32(14, true);
  const full = view.getUint32(18, true);
  const orderCount = view.getUint32(22, true);
  const rampLen = view.getUint16(26, true);
  const idleCount = view.getUint16(28, true);
  const eyesLen = view.getUint32(30, true);
  const headCol = view.getFloat32(34, true);
  let cursor = 38;
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder();
  const ramp = text.decode(bytes.subarray(cursor, cursor + rampLen));
  cursor += rampLen;
  const eyes = JSON.parse(text.decode(bytes.subarray(cursor, cursor + eyesLen)));
  cursor += eyesLen;
  const idle = [];
  for (let i = 0; i < idleCount; i += 1) {
    idle.push(view.getUint16(cursor, true));
    cursor += 2;
  }
  const extraLen = view.getUint32(cursor, true);
  cursor += 4;
  const extra = JSON.parse(text.decode(bytes.subarray(cursor, cursor + extraLen)));
  cursor += extraLen;
  const align = (value) => (value + 3) & ~3;
  cursor = align(cursor);
  const floats = (count) => {
    const start = cursor;
    cursor += count * 4;
    return start;
  };
  const vmax = floats(n);
  const shape = floats(n * 6);
  const jx = floats(n);
  const jy = floats(n);
  const depth = floats(n);
  const rnd1 = floats(n);
  const rnd2 = floats(n);
  const order = cursor;
  cursor += orderCount * 2;
  cursor = align(cursor);
  const frames = cursor;
  self.postMessage(
    {
      fps,
      cols,
      nr,
      sc,
      frameCount,
      n,
      full,
      orderCount,
      ramp,
      eyes,
      idle,
      idleEnd: extra.idleEnd,
      eyesEnd: extra.eyesEnd,
      headCol,
      vmax,
      shape,
      jx,
      jy,
      depth,
      rnd1,
      rnd2,
      order,
      frames,
      buffer,
    },
    [buffer],
  );
};
