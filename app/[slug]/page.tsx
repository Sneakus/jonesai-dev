import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BuildArticle } from "@/components/build-article";
import { PageFrame } from "@/components/site-header";
import { readBuild, readBuilds, readHome, readSite } from "@/lib/content";

export function generateStaticParams() {
  return readBuilds().map((build) => ({ slug: build.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const build = readBuild(slug);
  const home = readHome();

  if (!build) {
    return {};
  }

  return {
    title: `${build.title} - ${home.name}`,
    description: build.summary,
  };
}

export default async function BuildPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const build = readBuild(slug);

  if (!build) {
    notFound();
  }

  return (
    <PageFrame>
      <main>
        <BuildArticle build={build} site={readSite()} />
      </main>
    </PageFrame>
  );
}
