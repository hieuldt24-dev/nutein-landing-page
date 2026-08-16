"use client";

import Image from "next/image";
import { BounceChars, FadeInOnView } from "@/components/ui/BounceChars";
import postSurgeryAudienceCard from "@/public/media/4 card task 5 tách riêng/size 3_4/ng sau phẫu thuật.png";
import olderAdultAudienceCard from "@/public/media/4 card task 5 tách riêng/size 3_4/ng lớn tuổi.png";
import postIllnessAudienceCard from "@/public/media/4 card task 5 tách riêng/size 3_4/ng sau ốm.png";
import proteinSupplementAudienceCard from "@/public/media/4 card task 5 tách riêng/size 3_4/ng bổ sung protein.png";

const AUDIENCE_CARDS = [
  {
    id: "post-surgery",
    src: postSurgeryAudienceCard,
    alt: "Người sau phẫu thuật",
  },
  {
    id: "older-adult",
    src: olderAdultAudienceCard,
    alt: "Người lớn tuổi",
  },
  {
    id: "post-illness",
    src: postIllnessAudienceCard,
    alt: "Người sau ốm",
  },
  {
    id: "protein-supplement",
    src: proteinSupplementAudienceCard,
    alt: "Người cần bổ sung thêm protein",
  },
];

export default function TargetAudienceSection() {
  return (
    <section id="target-audience" className="audience-section">
      <div className="audience-section__content">
        <div className="audience-section__heading">
          <FadeInOnView className="audience-section__eyebrow">
            Phân nhóm đối tượng
          </FadeInOnView>
          <h2 className="audience-section__title">
            <BounceChars>Protein Nutein dành cho ai?</BounceChars>
          </h2>
          <p className="audience-section__description">
            Nutein cung cấp nguồn đạm thực vật sạch, lành và dễ tiêu hóa, đáp ứng nhu cầu dinh dưỡng đa dạng của mọi thành viên.
          </p>
        </div>

        <div className="audience-section__grid">
          {AUDIENCE_CARDS.map((item, index) => (
            <div key={item.id} className={`audience-section__card audience-section__card--${index + 1}`}>
              <Image
                fill
                src={item.src}
                alt={item.alt}
                sizes="(min-width: 1024px) 282px, (min-width: 640px) 45vw, 100vw"
                className="audience-section__image"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
