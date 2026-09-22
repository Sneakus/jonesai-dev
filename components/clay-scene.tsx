type ClaySceneProps = {
  label: string;
  hint: string;
};

function Clay({
  x,
  y,
  rotate,
  scale = 1,
}: {
  x: number;
  y: number;
  rotate: number;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <ellipse cx="0" cy="4" rx="78" ry="24" className="fill-clay" />
      <path
        d="M-72 0 C-42 -30 42 -30 72 0"
        className="fill-none stroke-clay-dark"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </g>
  );
}

export function ClayScene({ label, hint }: ClaySceneProps) {
  return (
    <div className="relative h-[300px] overflow-hidden rounded-[1.75rem] bg-field min-[900px]:h-full min-[900px]:min-h-[440px]">
      <svg
        viewBox="0 0 640 420"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-labelledby="clay-scene-title"
      >
        <title id="clay-scene-title">{label}</title>
        <path
          d="M80 250C130 210 150 150 188 128"
          className="fill-none stroke-muted"
          strokeOpacity="0.4"
          strokeWidth="1.6"
          strokeDasharray="1.4 8"
          strokeLinecap="round"
        />
        <path
          d="M250 300C320 250 380 200 430 168"
          className="fill-none stroke-muted"
          strokeOpacity="0.4"
          strokeWidth="1.6"
          strokeDasharray="1.4 8"
          strokeLinecap="round"
        />
        <path
          d="M210 330C270 300 310 280 348 268"
          className="fill-none stroke-muted"
          strokeOpacity="0.4"
          strokeWidth="1.6"
          strokeDasharray="1.4 8"
          strokeLinecap="round"
        />
        <Clay x={200} y={118} rotate={-24} />
        <Clay x={470} y={156} rotate={16} scale={0.9} />
        <g className="fill-clay">
          <polygon points="356,250 372,242 366,262" />
          <polygon points="384,238 402,246 390,258" />
          <polygon points="368,272 386,264 380,286" />
          <polygon points="404,262 422,274 400,280" />
          <polygon points="342,274 356,266 350,290" />
          <polygon points="392,286 408,278 412,298" />
        </g>
      </svg>
      <p className="absolute bottom-4 left-4 max-w-[70%] text-[13px] leading-snug text-muted">
        {hint}
      </p>
    </div>
  );
}
