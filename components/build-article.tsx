import type { Build, SiteContent } from "@/lib/content";

function Tag({
  children,
  tone,
}: {
  children: string;
  tone: "quoted" | "gap" | "judgement";
}) {
  const toneClass = {
    quoted: "border-line text-muted",
    gap: "border-line bg-field text-muted",
    judgement: "border-clay/50 text-clay",
  }[tone];

  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs leading-none ${toneClass}`}
    >
      {children}
    </span>
  );
}

function ExcerptPanel({
  build,
  site,
}: {
  build: Build;
  site: SiteContent;
}) {
  if (!build.excerpt) {
    return null;
  }

  const excerpt = build.excerpt;

  return (
    <aside className="my-8 rounded-2xl border border-line bg-card px-4 py-5 min-[900px]:px-6 min-[900px]:py-6">
      <p className="text-sm text-muted">{build.excerptLabel}</p>
      <div className="mt-5 flex flex-col gap-6">
        {excerpt.findings.map((finding) => (
          <div key={finding.claim}>
            <Tag tone="quoted">{site.quotedTag}</Tag>
            <p className="mt-2 text-[17px] leading-[1.6]">{finding.claim}</p>
            <blockquote className="mt-2 border-l-2 border-clay pl-3 text-[17px] leading-[1.6] whitespace-pre-line">
              {finding.quote}
            </blockquote>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <Tag tone="gap">{site.gapTag}</Tag>
        <p className="mt-2 text-[17px] leading-[1.6] whitespace-pre-line">
          {excerpt.gap}
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[17px] leading-[1.6] marker:text-muted">
          {excerpt.questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </div>
      <div className="mt-6">
        <Tag tone="judgement">{site.judgementTag}</Tag>
        <p className="mt-2 text-sm text-muted italic">{excerpt.judgementLabel}</p>
        <p className="mt-2 text-[17px] leading-[1.6] whitespace-pre-line">
          {excerpt.judgement}
        </p>
      </div>
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
  const links = [
    { href: build.transcript, label: site.transcriptLink },
    { href: build.plan, label: site.planLink },
    { href: build.repo, label: site.repoLink },
  ].filter((link) => link.href);

  return (
    <article className="max-w-[640px] pt-8 pb-20">
      <h1 className="build-title">{build.title}</h1>
      <p className="mt-4 text-base text-muted">{build.summary}</p>
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
          if (block.type === "excerpt") {
            return <ExcerptPanel key={`excerpt-${index}`} build={build} site={site} />;
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
