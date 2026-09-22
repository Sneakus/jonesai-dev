import { readHomeHeading } from "@/lib/content";

export default function Home() {
  const heading = readHomeHeading();

  return (
    <main>
      <h1>{heading}</h1>
    </main>
  );
}
