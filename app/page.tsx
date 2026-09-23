import { BuildsSection } from "@/components/builds-section";
import { ClayGameHost } from "@/components/clay-game-host";
import { PageFrame } from "@/components/site-header";
import { readBuilds, readHome, readSite } from "@/lib/content";

export default function Home() {
  const home = readHome();
  const site = readSite();
  const builds = readBuilds();

  return (
    <PageFrame>
      <main>
        <div className="grid grid-cols-1 gap-8 pt-6 min-[900px]:grid-cols-2 min-[900px]:gap-x-16 min-[900px]:pt-8">
          <h1 className="headline min-[900px]:col-start-1 min-[900px]:row-start-1">
            {home.title}
          </h1>
          <p className="text-base text-muted min-[900px]:col-start-1 min-[900px]:row-start-2">
            {home.intro}
          </p>
          <div className="min-[900px]:col-start-2 min-[900px]:row-start-1 min-[900px]:row-span-3">
            <ClayGameHost
              label={home.gameLabel}
              hint={home.gameHint}
              startLabel={home.startLabel}
              replayLabel={home.replayLabel}
              liveLabel={home.gameLiveLabel}
            />
          </div>
          <div className="border-t border-line pt-6 min-[900px]:col-start-1 min-[900px]:row-start-3 min-[900px]:self-end">
            <div className="flex items-baseline gap-4">
              <p className="headline text-clay">{home.receiptsValue}</p>
              <p className="max-w-[11rem] text-sm text-muted">
                {home.receiptsLabel}
              </p>
            </div>
          </div>
        </div>
        <BuildsSection heading={site.buildsHeading} builds={builds} />
      </main>
    </PageFrame>
  );
}
