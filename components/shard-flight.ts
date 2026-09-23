export type Point = {
  x: number;
  y: number;
};

export type ShardFlight = {
  from: Point;
  target: Point;
  startedAt: number;
};

export type ShardFlightSettings = {
  travelTime: number;
  stagger: number;
  easing: "easeInOutCubic";
};

function easeInOutCubic(amount: number) {
  return amount < 0.5
    ? 4 * amount * amount * amount
    : 1 - Math.pow(-2 * amount + 2, 3) / 2;
}

export function createShardFlights(
  starts: Point[],
  targets: Point[],
  startedAt: number,
  settings: ShardFlightSettings,
): ShardFlight[] {
  if (targets.length === 0) {
    return [];
  }

  return starts.map((from, index) => {
    const order = starts.length <= 1 ? 0 : index / (starts.length - 1);
    return {
      from,
      target: targets[index % targets.length],
      startedAt: startedAt + order * settings.stagger,
    };
  });
}

export function shardFlightPoint(
  flight: ShardFlight,
  now: number,
  settings: ShardFlightSettings,
): Point {
  const amount = Math.max(
    0,
    Math.min(1, (now - flight.startedAt) / Math.max(1, settings.travelTime)),
  );
  const eased =
    settings.easing === "easeInOutCubic" ? easeInOutCubic(amount) : amount;
  return {
    x: flight.from.x + (flight.target.x - flight.from.x) * eased,
    y: flight.from.y + (flight.target.y - flight.from.y) * eased,
  };
}

export function shardFlightsDone(
  flights: ShardFlight[],
  now: number,
  settings: ShardFlightSettings,
) {
  return flights.every(
    (flight) => now >= flight.startedAt + settings.travelTime,
  );
}
