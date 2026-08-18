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
  "11g Protein trong mỗi gói 30g",
  "Bổ sung xơ hòa tan Inulin & FOS",
  "Đầy đủ vitamin B, E & khoáng chất",
  "Nguồn dinh dưỡng lành tính mỗi ngày",
  "Đạm thực vật từ hạt & đậu tự nhiên",
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
    "Nutein khởi đầu từ mong muốn mang đến nguồn đạm thực vật thanh lành cho nhịp sống hiện đại. Kết hợp từ đạm đậu Hà Lan, các loại hạt dinh dưỡng cùng hệ vitamin & khoáng chất, Nutein là bữa ăn phụ cân bằng, tiện lợi giúp bạn phục hồi năng lượng và chăm sóc sức khỏe mỗi ngày.",
  philosophyTitle: "Triết lý sản phẩm",
  philosophyBody:
    "Lối sống lành bắt đầu từ những lựa chọn thực tế. Mỗi gói Nutein hướng tới ba giá trị cốt lõi: nguyên liệu hạt tự nhiên, hệ tiêu hóa nhẹ nhàng và thói quen dùng bền vững. Không cầu kỳ, Nutein mang đến nguồn đạm thực vật thanh lành cùng hệ vi chất cân bằng, giúp bạn chủ động chăm sóc sức khỏe mỗi ngày.",
  mainImage: "/media/product1.jpg",
  mainImageAlt: "Nutein — năng lượng sạch mỗi ngày",
};

export const ABOUT_PROCESS = {
  titleLine1: "Làm từ",
  titleLine2: "nguyên liệu thật",
  /** Card scroll qua heading cố định — pattern JR FUNCTIONALS (pin + translate). */
  panels: [
    {
      headline: "Nguồn gốc chọn lọc",
      name: "Hạt & Đậu tự nhiên",
      desc: "Đạm đậu Hà Lan, hạnh nhân, óc chó, macca cùng các loại hạt dinh dưỡng lành tính — Quy trình sản xuất đạt chuẩn, kiểm nghiệm an toàn khắt khe.",
      tone: "primary" as const,
      /** Joy Rush: ±2deg xen kẽ */
      rotate: -2,
    },
    {
      headline: "Công thức tinh gọn",
      name: "Nhẹ bụng & Dễ hấp thu",
      desc: "Nguồn đạm thực vật thuần khiết, không phụ thuộc vào nguồn sữa động vật. Hương vị thơm ngon nguyên bản từ hạt dinh dưỡng tự nhiên, phù hợp cho hệ tiêu hóa.",
      tone: "sky" as const,
      rotate: 2,
    },
    {
      headline: "Kiểm soát từng lô",
      name: "Quy trình nghiêm ngặt",
      desc: "Mỗi lô nguyên liệu đều được rà soát chỉ tiêu an toàn và chất lượng khắt khe trước khi đưa vào sản xuất.",
      tone: "forest" as const,
      rotate: -2,
    },
    {
      headline: "Dễ hấp thu",
      name: "Nhẹ bụng & Dễ tiêu hóa",
      desc: "Đạm thực vật lành tính kết hợp cùng hệ chất xơ hòa tan (Inulin/FOS) — Giúp tiêu hóa nhẹ nhàng, không lo đầy bụng hay nặng bụng.",
      tone: "lime" as const,
      rotate: 2,
    },
    {
      headline: "An toàn thực phẩm",
      name: "Quy trình khép kín",
      desc: "Môi trường sản xuất khép kín đảm bảo an toàn vệ sinh tối đa và duy trì chất lượng đồng nhất giữa các lô hàng.",
      tone: "sage" as const,
      rotate: -2,
    },
    {
      headline: "Tiện lợi mỗi ngày",
      name: "Đóng gói bảo toàn",
      desc: "Quy cách đóng gói giúp bảo toàn hương vị và chất lượng bột — sẵn sàng pha nhanh bữa ăn phụ tiện lợi trong 2 phút.",
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
  body: "Tầm nhìn: trở thành lựa chọn protein thực vật quen thuộc cho lối sống lành mạnh tại Việt Nam.\nSứ mệnh: đưa đạm thực vật thật, dễ dùng vào thói quen mỗi ngày — bền vững hơn với môi trường.",
  image: "/media/task 6-3.png",
  imageAlt: "Nutein — tầm nhìn lối sống lành mạnh",
};
