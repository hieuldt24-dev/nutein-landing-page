import Image from "next/image";
import { CONTACT_INFO } from "@/features/contact/constants";
import { ContactForm } from "@/components/contact/ContactForm";
import { BounceChars } from "@/components/ui/BounceChars";

/**
 * Contact body — Joy Rush 2 cột:
 * trái: thông tin liên hệ + ảnh lifestyle
 * phải: heading + form
 */
export function ContactPanel() {
  return (
    <section className="border-t border-ink/10">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-12 md:px-10 md:py-16 lg:grid-cols-2 lg:gap-14 lg:py-20">
        <div className="flex flex-col">
          <p className="text-[12px] font-extrabold tracking-[0.12em] text-ink uppercase">
            Thông tin liên hệ
          </p>
          <div className="mt-5 flex flex-col items-start gap-3">
            <a
              href={CONTACT_INFO.emailHref}
              className="inline-block w-fit font-display text-[clamp(22px,2.5vw,32px)] font-black tracking-[-0.03em] text-ink transition-colors hover:text-primary-deep"
            >
              {CONTACT_INFO.email}
            </a>
            <a
              href={CONTACT_INFO.hotlineHref}
              className="inline-block w-fit font-display text-[clamp(22px,2.5vw,32px)] font-black tracking-[-0.03em] text-ink transition-colors hover:text-primary-deep"
            >
              {CONTACT_INFO.hotline}
            </a>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2">
            {CONTACT_INFO.socials.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  className="text-[13px] font-bold tracking-[0.04em] text-ink/70 uppercase transition-colors hover:text-primary-deep"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="relative mt-10 hidden min-h-[280px] flex-1 overflow-hidden rounded-[var(--radius-xl)] border border-ink/10 lg:block">
            <Image
              src="/media/product3.png"
              alt="Hộp Protein Nutein cùng nguyên liệu thực vật"
              fill
              sizes="(max-width: 1024px) 0px, 40vw"
              className="scale-[1.22] object-cover object-[center_64%]"
            />
          </div>
        </div>

        <div>
          <h2 className="max-w-[16ch] font-display text-[clamp(32px,4vw,48px)] font-black uppercase leading-[0.95] tracking-[-0.04em] text-ink">
            <BounceChars staggerMs={22}>
              Chúng tôi luôn sẵn sàng lắng nghe.
            </BounceChars>
          </h2>
          <p className="mt-3 text-[13px] font-bold tracking-[0.06em] text-ink/65 uppercase">
            Chia sẻ điều bạn đang cần — đội ngũ Nutein sẽ phản hồi sớm.
          </p>
          <div className="mt-8">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}
