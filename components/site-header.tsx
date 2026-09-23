import Link from "next/link";
import { readHome } from "@/lib/content";

export function SiteHeader() {
  const home = readHome();

  return (
    <header className="pt-5">
      <Link href="/" className="text-base font-bold">
        {home.name}
      </Link>
    </header>
  );
}

export function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 min-[900px]:px-8">
      <SiteHeader />
      {children}
    </div>
  );
}
