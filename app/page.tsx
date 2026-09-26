import { BuildsSection } from "@/components/builds-section";
import { ContactSection } from "@/components/contact-section";
import { ClayGameHost } from "@/components/clay-game-host";
import { PortraitSlot } from "@/components/portrait-slot";
import { PageFrame } from "@/components/site-header";
import {
  readBuilds,
  readContact,
  readGame,
  readHome,
  readPortrait,
  readSite,
} from "@/lib/content";

export default function Home() {
  const home = readHome();
  const site = readSite();
  const builds = readBuilds();
  const contact = readContact();
  const game = readGame();
  const portrait = readPortrait();

  return (
    <PageFrame>
      <main>
        <div className="pt-6 min-[900px]:pt-8">
          <h1 id="top" className="headline">
            {home.title}
          </h1>
          <p className="mt-4 text-base text-muted">{home.intro}</p>
          <div className="mx-auto mt-8 w-full max-w-[1100px]">
            <ClayGameHost
              label={home.gameLabel}
              startLabel={home.startLabel}
              replayLabel={game.replayButton}
              liveLabel={home.gameLiveLabel}
              hitMark={home.hitMark}
              scoreMessages={game.scoreMessages}
            />
          </div>
        </div>
        <BuildsSection heading={site.buildsHeading} builds={builds} />
        <ContactSection contact={contact} />
        <PortraitSlot copy={portrait} />
      </main>
    </PageFrame>
  );
}
