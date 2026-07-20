import type { Metadata } from "next";
import AboutHero from "@/components/about/AboutHero";
import AboutStory from "@/components/about/AboutStory";
import AboutProcess from "@/components/about/AboutProcess";
import AboutCommitment from "@/components/about/AboutCommitment";
import AboutMission from "@/components/about/AboutMission";
import { MarqueeTicker } from "@/components/ui/MarqueeTicker";
import { ABOUT_META, ABOUT_USP_TICKER } from "@/features/about/constants";

export const metadata: Metadata = {
  title: ABOUT_META.title,
  description: ABOUT_META.description,
  openGraph: {
    title: ABOUT_META.title,
    description: ABOUT_META.description,
    locale: "vi_VN",
    type: "website",
  },
};

/**
 * About — cấu trúc Joy Rush About (không Reviews):
 * Hero → Marquee → Story → Process → Mission (Goals) → Commitment → Footer CTA
 */
export default function AboutPage() {
  return (
    <>
      <AboutHero />
      <div className="bg-primary-deep py-3.5 md:py-4">
        <MarqueeTicker items={ABOUT_USP_TICKER} />
      </div>
      <main>
        <AboutStory />
        <AboutProcess />
        <AboutMission />
        <AboutCommitment />
      </main>
    </>
  );
}
