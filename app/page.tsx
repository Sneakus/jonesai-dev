import { BuildsSection } from "@/components/builds-section";
import { ContactSection } from "@/components/contact-section";
import { ClayGameHost } from "@/components/clay-game-host";
import { PageFrame } from "@/components/site-header";
import {
  readBuilds,
  readContact,
  readGame,
  readHome,
  readSite,
} from "@/lib/content";

export default function Home() {
  const home = readHome();
  const site = readSite();
  const builds = readBuilds();
  const contact = readContact();
  const game = readGame();

  return (
    <PageFrame>
      <main>
        <div className="pt-6 min-[900px]:pt-8">
          <h1 className="headline">{home.title}</h1>
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
      </main>
    </PageFrame>
  );
}
