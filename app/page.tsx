import { BuildsSection } from "@/components/builds-section";
import { ContactSection } from "@/components/contact-section";
import { ClayGameHost } from "@/components/clay-game-host";
import { PageFrame } from "@/components/site-header";
import { readBuilds, readContact, readHome, readSite } from "@/lib/content";

export default function Home() {
  const home = readHome();
  const site = readSite();
  const builds = readBuilds();
  const contact = readContact();

  return (
    <PageFrame>
      <main>
        <div className="pt-6 min-[900px]:pt-8">
          <h1 className="headline">{home.title}</h1>
          <p className="mt-4 text-base text-muted">{home.intro}</p>
          <div className="mx-auto mt-8 w-full max-w-[1100px]">
            <ClayGameHost
              label={home.gameLabel}
              hint={home.gameHint}
              startLabel={home.startLabel}
              replayLabel={home.replayLabel}
              liveLabel={home.gameLiveLabel}
              hitMark={home.hitMark}
            />
          </div>
          <div className="mt-8 border-t border-line pt-6">
            <div className="flex items-baseline gap-4">
              <p className="headline text-clay">{home.receiptsValue}</p>
              <p className="max-w-[11rem] text-sm text-muted">
                {home.receiptsLabel}
              </p>
            </div>
          </div>
        </div>
        <BuildsSection heading={site.buildsHeading} builds={builds} />
        <ContactSection contact={contact} />
      </main>
    </PageFrame>
  );
}
