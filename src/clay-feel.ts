// Phone-only tuning for the clay game. A PC (pointer: fine) ignores this.
// Change these three together when the touch game should feel different.
export const touchClay = {
  draw: 0.85, // drawn about 15% smaller
  hit: 0.8, // width and height of the area that counts as a hit, about 20% smaller
  speed: 1.15, // about 15% faster. Fast clays keep the same gap over normal ones.
};

const desktopClay = { draw: 1, hit: 1, speed: 1 };

export type ClayFeel = {
  draw: number;
  hit: number;
  speed: number;
};

export function clayFeel(coarse: boolean): ClayFeel {
  return coarse ? touchClay : desktopClay;
}

let feel: ClayFeel = desktopClay;

export function setClayFeel(coarse: boolean) {
  feel = clayFeel(coarse);
}

export function activeClayFeel(): ClayFeel {
  return feel;
}

// Desktop clay numbers the touch multipliers scale from. Kept here so a test
// can prove the PC game still uses these values.
export const desktopClaySettings = {
  claySize: 51,
  hitAreaSize: 8,
  speedMin: 0.64,
  speedMax: 0.96,
};
