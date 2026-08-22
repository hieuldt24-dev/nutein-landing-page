import type { Metadata } from "next";
import { ContactPanel } from "@/components/contact/ContactPanel";
import { BounceChars } from "@/components/ui/BounceChars";
import { CONTACT_PAGE_META } from "@/features/contact/constants";

export const metadata: Metadata = {
  title: CONTACT_PAGE_META.title,
  description: CONTACT_PAGE_META.description,
  openGraph: {
    title: CONTACT_PAGE_META.title,
    description: CONTACT_PAGE_META.description,
    locale: "vi_VN",
    type: "website",
  },
};

/**
 * Contact — Joy Rush layout:
 * Hero headline → divider → info + form
 */
export default function ContactPage() {
  return (
    <main className="bg-bg pt-32 md:pt-40">
      <header className="mx-auto max-w-[1200px] px-6 pb-10 md:px-10 md:pb-14">
        <h1 className="max-w-[12ch] font-display text-[clamp(48px,9vw,96px)] font-black uppercase leading-tight tracking-[-0.045em] text-ink">
          <BounceChars staggerMs={22}>Kết nối cùng Nutein.</BounceChars>
        </h1>
      </header>

      <ContactPanel />
    </main>
  );
}
