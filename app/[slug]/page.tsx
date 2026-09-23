import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BuildArticle } from "@/components/build-article";
import { PageFrame } from "@/components/site-header";
import { readBuild, readBuilds, readHome, readSite } from "@/lib/content";
import { DEFAULT_SHARE_IMAGE } from "@/lib/site-config";

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

  const title = `${build.title} - ${home.name}`;

  return {
    title,
    description: build.summary,
    openGraph: {
      type: "article",
      url: `/${build.slug}`,
      title,
      description: build.summary,
      images: [DEFAULT_SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: build.summary,
      images: [DEFAULT_SHARE_IMAGE.url],
    },
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
