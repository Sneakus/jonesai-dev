import type { Metadata } from "next";
import { BuildArticle } from "@/components/build-article";
import { PageFrame } from "@/components/site-header";
import { readBuild, readHome, readSite } from "@/lib/content";
import { DEFAULT_SHARE_IMAGE } from "@/lib/site-config";
import { notFound } from "next/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const build = readBuild("builds/knowledge-base-assistant");
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
      url: "/builds/knowledge-base-assistant",
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

export default function KnowledgeBasePage() {
  const build = readBuild("builds/knowledge-base-assistant");
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
