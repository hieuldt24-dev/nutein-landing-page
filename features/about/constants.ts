/**
 * Copy trang Về Nutein — map 1–1 PROJECT_REQUIREMENTS §3.6.
 * Layout theo Joy Rush About (hero → marquee → statement 2-cột →
 * functionals cards nghiêng → goals split) — không Reviews.
 */

export const ABOUT_META = {
  title: "Về Nutein – Câu chuyện protein thực vật",
  description:
    "Khám phá câu chuyện thương hiệu Nutein: triết lý nguyên liệu thật, quy trình sạch, cam kết chất lượng và sứ mệnh nâng tầm lối sống lành mạnh.",
};

export const ABOUT_USP_TICKER = [
  "100% Protein Thực Vật",
  "Non-GMO",
  "Organic",
  "Không Chất Bảo Quản",
  "Chuẩn Hữu Cơ",
  "Nguyên Liệu Thật",
];

/** Hero manifesto — full-bleed `about.png`. */
export const ABOUT_HERO = {
  /** nbsp giữ cụm “bận rộn” / “đủ sạch” không bị tách dòng. */
  titleLine1: "Khi cuộc sống bận\u00A0rộn,",
  titleLine2: "dinh dưỡng phải đủ\u00A0sạch.",
  lead: "Đó là động lực của chúng tôi: mang nguồn đạm thực vật thật, dễ dùng vào những khoảnh khắc cần năng lượng mỗi ngày.",
  image: "/media/hero-about.png",
  imageAlt: "Nutein — lối sống lành mạnh với protein thực vật",
};

export const ABOUT_STORY = {
  storyTitle: "Câu chuyện thương hiệu",
  storyBody:
    "Nutein bắt đầu từ nhu cầu thật của người ăn sạch, tập luyện và dân văn phòng: muốn bổ sung protein mà không phụ thuộc đạm động vật, không chấp nhận chất độn hay hương liệu hóa học. Chúng tôi chọn hướng Organic Grocery — nguyên liệu truy xuất được, công thức tối giản, hương vị từ hạt và thiên nhiên.",
  philosophyTitle: "Triết lý sản phẩm",
  philosophyBody:
    "Healthy Lifestyle không phải khẩu hiệu. Mỗi hộp Nutein hướng tới ba điều rõ ràng: nguyên liệu thật, hấp thu nhẹ bụng, và thói quen dùng bền vững — ít phụ gia hơn, nhiều dinh dưỡng có thể cảm nhận sau vài tuần duy trì.",
  mainImage: "/media/product1.jpg",
  mainImageAlt: "Nutein — năng lượng sạch mỗi ngày",
};

export const ABOUT_PROCESS = {
  titleLine1: "Làm từ",
  titleLine2: "nguyên liệu thật",
  /** Card scroll qua heading cố định — pattern JR FUNCTIONALS (pin + translate). */
  panels: [
    {
      headline: "Nguồn gốc sạch",
      name: "Tuyển chọn nông trại",
      desc: "Hạt đậu nành, đậu Hà Lan, óc chó và rau củ từ nông trại hữu cơ — Non-GMO, truy xuất rõ ràng.",
      tone: "primary" as const,
      /** Joy Rush: ±2deg xen kẽ */
      rotate: -2,
    },
    {
      headline: "Không chất độn",
      name: "Công thức tối giản",
      desc: "Không bột sữa động vật, không hương liệu hóa học. Vị ngọt thanh từ Stevia và hương hạt tự nhiên.",
      tone: "sky" as const,
      rotate: 2,
    },
    {
      headline: "Kiểm soát lô",
      name: "Trước khi phối trộn",
      desc: "Mỗi lô nguyên liệu được rà soát tiêu chuẩn sạch trước khi đưa vào công thức.",
      tone: "forest" as const,
      rotate: -2,
    },
    {
      headline: "Hấp thu nhanh",
      name: "Enzyme thực vật",
      desc: "Thủy phân chuỗi đạm thành peptide nhỏ — hỗ trợ hấp thu, hạn chế nóng trong hay đầy bụng.",
      tone: "lime" as const,
      rotate: 2,
    },
    {
      headline: "An toàn thực phẩm",
      name: "Sản xuất kiểm soát",
      desc: "Môi trường sản xuất ưu tiên vệ sinh và độ ổn định công thức giữa các lô.",
      tone: "sage" as const,
      rotate: -2,
    },
    {
      headline: "Giữ trọn chất lượng",
      name: "Đóng gói bảo toàn",
      desc: "Bao bì và bảo quản giữ độ tươi của bột — sẵn sàng pha nhanh trong 2 phút.",
      tone: "ink" as const,
      rotate: 2,
    },
  ],
};

export const ABOUT_COMMITMENT = {
  eyebrow: "Cam kết",
  /** Heading ngắn — tránh wrap 3 dòng. */
  title: "Chất lượng kiểm chứng được",
  intro:
    "Minh bạch thành phần và tiêu chuẩn — không dùng logo chứng nhận giả để tạo niềm tin ảo.",
  points: [
    {
      title: "Protein thực vật",
      desc: "Đạm từ hạt cho eat clean, ăn chay hiện đại và người tập luyện.",
      tone: "primary" as const,
    },
    {
      title: "Non-GMO & hữu cơ",
      desc: "Nguyên liệu hướng Non-GMO, canh tác hữu cơ, giảm tồn dư hóa chất.",
      tone: "sky" as const,
    },
    {
      title: "Không bảo quản",
      desc: "Công thức sạch, duy trì dài hạn — không phụ gia “giữ vị” nhân tạo.",
      tone: "lime" as const,
    },
    {
      title: "Nhẹ bụng",
      desc: "Hấp thu êm — phù hợp người nhạy cảm whey động vật hoặc lactose.",
      tone: "sage" as const,
    },
  ],
  certificationsNote:
    "Giấy tờ chứng nhận chính thức sẽ công bố tại đây khi hoàn tất thủ tục.",
};

export const ABOUT_MISSION = {
  /** Hai dòng gần bằng độ dài (~16–17 ký tự). */
  titleLine1: "Năng lượng sạch",
  titleLine2: "cho ngày bận rộn",
  body: "Tầm nhìn: trở thành lựa chọn protein thực vật quen thuộc cho lối sống lành mạnh tại Việt Nam. Sứ mệnh: đưa đạm thực vật thật, dễ dùng vào thói quen mỗi ngày — bền vững hơn với môi trường.",
  image: "/media/task 6-3.png",
  imageAlt: "Nutein — tầm nhìn lối sống lành mạnh",
};
