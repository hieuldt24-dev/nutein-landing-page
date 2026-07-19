import HeroSection from "@/components/shared/HeroSection";
import IntroSection from "@/components/shared/IntroSection";
import DifferentiatorsSection from "@/components/shared/DifferentiatorsSection";
import TargetAudienceSection from "@/components/shared/TargetAudienceSection";
import BenefitsSection from "@/components/shared/BenefitsSection";
import TestimonialsSection from "@/components/shared/TestimonialsSection";
import BottomCtaSection from "@/components/shared/BottomCtaSection";
import { MarqueeTicker } from "@/components/ui/MarqueeTicker";

const USP_TICKER = [
  "100% Protein Thực Vật",
  "Non-GMO",
  "Organic",
  "Không Chất Bảo Quản",
  "Chuẩn Hữu Cơ",
  "50,000+ Khách Hàng Tin Dùng",
];

export default function Home() {
  return (
    <>
      <div className="relative">
        <HeroSection />
      </div>
      <div className="bg-primary-deep py-3.5 md:py-4">
        <MarqueeTicker items={USP_TICKER} />
      </div>
      <main>
        <IntroSection />
        <DifferentiatorsSection />
        <TargetAudienceSection />
        <BenefitsSection />
        <TestimonialsSection />
        <BottomCtaSection />
      </main>
    </>
  );
}
