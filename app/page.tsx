import { ClayScene } from "@/components/clay-scene";
import { readHome } from "@/lib/content";

export default function Home() {
  const home = readHome();

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 min-[900px]:px-8">
      <header className="pt-5">
        <p className="text-base font-bold">{home.name}</p>
      </header>
      <main className="grid grid-cols-1 gap-8 pt-6 pb-16 min-[900px]:grid-cols-2 min-[900px]:gap-x-16 min-[900px]:pt-8">
        <h1 className="headline min-[900px]:col-start-1 min-[900px]:row-start-1">
          {home.title}
        </h1>
        <p className="text-base text-muted min-[900px]:col-start-1 min-[900px]:row-start-2">
          {home.intro}
        </p>
        <div className="min-[900px]:col-start-2 min-[900px]:row-start-1 min-[900px]:row-span-3">
          <ClayScene label={home.gameLabel} hint={home.gameHint} />
        </div>
        <div className="border-t border-line pt-6 min-[900px]:col-start-1 min-[900px]:row-start-3 min-[900px]:self-end">
          <div className="flex items-baseline gap-4">
            <p className="headline text-clay">{home.receiptsValue}</p>
            <p className="max-w-[11rem] text-sm text-muted">{home.receiptsLabel}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
