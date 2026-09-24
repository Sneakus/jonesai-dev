import Image from "next/image";
import { JobFunnel } from "@/components/job-funnel";
import type { Build, SiteContent } from "@/lib/content";

function CallPlanPanel({ build }: { build: Build }) {
  if (!build.callPlan) {
    return null;
  }

  const plan = build.callPlan;

  return (
    <aside className="my-8 w-[calc(100vw-2.5rem)] max-w-[calc(1200px-2.5rem)] rounded-2xl border border-line bg-card px-4 py-6 min-[900px]:w-[calc(100vw-4rem)] min-[900px]:max-w-[calc(1200px-4rem)] min-[900px]:px-8 min-[900px]:py-8">
      <div className="grid gap-10 min-[900px]:grid-cols-2 min-[900px]:gap-12">
        <div>
          <p className="text-sm text-muted">{plan.callLabel}</p>
          <div className="mt-5 flex flex-col gap-5">
            {plan.call.map((line, index) => (
              <div
                key={`${line.who}-${index}`}
                className={line.who === "Rosie" ? "pl-4" : undefined}
              >
                <p className="text-[17px] leading-[1.6]">
                  <span className="font-semibold">{line.who}</span>
                </p>
                <p className="text-[17px] leading-[1.6]">{line.said}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm text-muted">{plan.planLabel}</p>
          <div className="mt-5 flex flex-col gap-6">
            {plan.groups.map((group) => (
              <div key={group.label}>
                <p className="text-[17px] font-semibold leading-[1.6]">{group.label}</p>
                <div className="mt-3 flex flex-col gap-4">
                  {group.items.map((item) => (
                    <div key={item.text}>
                      <p className="text-[17px] leading-[1.6]">{item.text}</p>
                      {item.quote ? (
                        <blockquote className="mt-2 border-l-2 border-clay pl-3 text-[17px] leading-[1.6]">
                          {item.quote}
                        </blockquote>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function ExamplePanel({ build }: { build: Build }) {
  if (!build.example) {
    return null;
  }

  const example = build.example;
  const answers: { line: string; bullets: string[] }[] = [];
  for (const line of example.answer) {
    if (line.startsWith("- ") && answers.length > 0) {
      answers[answers.length - 1].bullets.push(line.slice(2));
    } else {
      answers.push({ line, bullets: [] });
    }
  }

  return (
    <aside className="my-8 rounded-2xl border border-line bg-card px-4 py-5 min-[900px]:px-6 min-[900px]:py-6">
      <p className="text-sm text-muted">{example.label}</p>
      <blockquote className="mt-4 border-l-2 border-clay pl-3 text-[17px] leading-[1.6]">
        {example.question}
      </blockquote>
      <p className="mt-6 text-sm text-muted">{example.answerLabel}</p>
      {answers.map((answer, index) => {
        const colon = answer.line.indexOf(":");
        return (
          <div key={`${answer.line}-${index}`} className="mt-2">
            <p className="text-[17px] leading-[1.6]">
              {colon > 0 ? (
                <>
                  <span className="font-semibold">
                    {answer.line.slice(0, colon)}
                  </span>
                  {answer.line.slice(colon)}
                </>
              ) : (
                answer.line
              )}
            </p>
            {answer.bullets.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[17px] leading-[1.6] marker:text-muted">
                {answer.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </aside>
  );
}

export function BuildArticle({
  build,
  site,
}: {
  build: Build;
  site: SiteContent;
}) {
  const links =
    build.links.length > 0
      ? build.links.map((link) => ({ href: link.url, label: link.label }))
      : [
          { href: build.transcript, label: site.transcriptLink },
          { href: build.plan, label: site.planLink },
          { href: build.repo, label: site.repoLink },
        ].filter((link) => link.href);

  return (
    <article className="max-w-[640px] pt-8 pb-20">
      <h1 className="build-title">{build.title}</h1>
      <p className="mt-4 text-base text-muted">{build.summary}</p>
      {build.funnel ? (
        <JobFunnel funnel={build.funnel} />
      ) : build.image ? (
        <Image
          src={build.image.src}
          alt={build.image.alt}
          width={build.image.width}
          height={build.image.height}
          quality={90}
          sizes="(max-width: 679px) calc(100vw - 40px), 640px"
          unoptimized
          className="mt-8 h-auto w-full rounded-2xl"
        />
      ) : null}
      <div className="mt-10">
        {build.blocks.map((block, index) => {
          if (block.type === "heading") {
            return (
              <h2
                key={`${block.text}-${index}`}
                className="mt-10 text-[22px] font-semibold tracking-[-0.035em] first:mt-0"
              >
                {block.text}
              </h2>
            );
          }
          if (block.type === "list") {
            return (
              <ul
                key={`list-${index}`}
                className="mt-4 list-disc space-y-2 pl-5 text-[17px] leading-[1.6]"
              >
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          }
          if (block.type === "callPlan") {
            return <CallPlanPanel key={`call-plan-${index}`} build={build} />;
          }
          if (block.type === "example") {
            return <ExamplePanel key={`example-${index}`} build={build} />;
          }
          return (
            <p key={`p-${index}`} className="mt-4 text-[17px] leading-[1.6]">
              {block.text}
            </p>
          );
        })}
      </div>
      {links.length > 0 ? (
        <ul className="mt-12 flex flex-wrap gap-x-6 gap-y-2">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
