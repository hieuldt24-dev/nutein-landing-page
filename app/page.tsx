import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/shared/HeroSection";
import IntroSection from "@/components/shared/IntroSection";
import DifferentiatorsSection from "@/components/shared/DifferentiatorsSection";
import TargetAudienceSection from "@/components/shared/TargetAudienceSection";
import BenefitsSection from "@/components/shared/BenefitsSection";
import TestimonialsSection from "@/components/shared/TestimonialsSection";
import BottomCtaSection from "@/components/shared/BottomCtaSection";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <IntroSection />
        <DifferentiatorsSection />
        <TargetAudienceSection />
        <BenefitsSection />
        <TestimonialsSection />
        <BottomCtaSection />
      </main>
      <Footer />
    </>
  );
}
