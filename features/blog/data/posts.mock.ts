import type { BlogPost } from "../types";

function article(...paragraphs: string[]): string {
  return paragraphs.map((p) => `<p>${p}</p>`).join("\n");
}

/**
 * Mock posts — phủ topic §3.5; khi có CMS: service đổi nguồn, giữ shape.
 * Chỉ blog.service được import file này — UI không import mock trực tiếp.
 */
export const MOCK_BLOG_POSTS: BlogPost[] = [
  // ── Công thức ─────────────────────────────────────────────
  {
    id: "post-smoothie-protein",
    slug: "smoothie-protein-buoi-sang-5-phut",
    title: "Smoothie Protein",
    excerpt:
      "Công thức smoothie đạm thực vật nhanh gọn — đủ no, dễ pha, phù hợp bữa sáng bận rộn.",
    category: "recipes",
    coverImage: "/images/yogurt.jpg",
    coverAlt: "Smoothie protein trong ly",
    publishedAt: "2026-06-12",
    readingMinutes: 4,
    featured: true,
    favorite: true,
    recipeFilters: ["breakfast", "post_workout", "vegan"],
    tags: ["smoothie", "5 phút"],
    bodyHtml: article(
      "Buổi sáng không cần phức tạp để vẫn đủ đạm. Chỉ cần sữa thực vật, chuối chín, một thìa Nutein và đá — xay 30 giây là xong.",
      "Gợi ý: thêm nửa quả bơ nếu muốn độ béo nhẹ và no lâu hơn."
    ),
  },
  {
    id: "post-overnight-oats",
    slug: "overnight-oats-protein",
    title: "Overnight Oats",
    excerpt:
      "Meal prep tối giản: yến mạch ngâm sữa + Nutein, sáng dậy chỉ việc lấy ra ăn.",
    category: "recipes",
    coverImage: "/images/apples.jpg",
    coverAlt: "Overnight oats với táo",
    publishedAt: "2026-05-28",
    readingMinutes: 5,
    favorite: true,
    recipeFilters: ["breakfast", "eat_clean", "vegan"],
    tags: ["meal prep"],
    bodyHtml: article(
      "Overnight oats giúp bạn có bữa sáng sẵn sàng mà không tốn thời gian sáng sớm.",
      "Trộn yến mạch, sữa thực vật và Nutein trong hũ kính, để tủ lạnh ít nhất 6 giờ."
    ),
  },
  {
    id: "post-protein-bowl",
    slug: "protein-bowl",
    title: "Protein Bowl",
    excerpt:
      "Bát cơm/quinoa đầy màu sắc với đậu, rau và bột protein khuấy nhẹ — no bền, đẹp mắt.",
    category: "recipes",
    coverImage: "/images/vegetables.jpg",
    coverAlt: "Protein bowl rau củ",
    publishedAt: "2026-06-05",
    readingMinutes: 6,
    favorite: true,
    recipeFilters: ["post_workout", "eat_clean", "vegan"],
    tags: ["bowl"],
    bodyHtml: article(
      "Protein Bowl là cách kết hợp tinh bột nguyên hạt, rau và đạm thực vật trong một đĩa.",
      "Thêm ½–1 muỗng Nutein vào nước sốt yogurt thực vật để tăng đạm mà vẫn mềm miệng."
    ),
  },
  {
    id: "post-pancake-protein",
    slug: "pancake-protein",
    title: "Pancake Protein",
    excerpt:
      "Bánh pancake mềm với bột protein Nutein — bữa sáng hoặc snack cuối tuần.",
    category: "recipes",
    coverImage: "/images/yogurt.jpg",
    coverAlt: "Pancake protein",
    publishedAt: "2026-04-20",
    readingMinutes: 5,
    recipeFilters: ["breakfast", "snack", "vegan"],
    tags: ["pancake"],
    bodyHtml: article(
      "Pancake protein giữ cảm giác “treat” nhưng vẫn có đạm.",
      "Trộn bột mì nguyên cám, Nutein, sữa thực vật và chuối nghiền — chiên cháy cạnh là xong."
    ),
  },
  {
    id: "post-granola-bowl",
    slug: "granola-bowl",
    title: "Granola Bowl",
    excerpt:
      "Granola giòn, sữa chua thực vật và trái cây — ăn nhẹ lành mạnh trong vài phút.",
    category: "recipes",
    coverImage: "/images/apples.jpg",
    coverAlt: "Granola bowl",
    publishedAt: "2026-03-15",
    readingMinutes: 3,
    recipeFilters: ["breakfast", "snack", "eat_clean"],
    tags: ["granola"],
    bodyHtml: article(
      "Granola Bowl phù hợp khi bạn muốn ăn nhanh mà vẫn có chất xơ và đạm.",
      "Rắc granola lên sữa chua, thêm trái cây và một thìa Nutein khuấy nhẹ nếu cần thêm protein."
    ),
  },
  {
    id: "post-latte-ngu-coc",
    slug: "latte-ngu-coc",
    title: "Latte ngũ cốc",
    excerpt:
      "Latte ấm với sữa thực vật và Nutein — thay cà phê khi cần năng lượng sạch.",
    category: "recipes",
    coverImage: "/images/beans.jpg",
    coverAlt: "Latte ngũ cốc",
    publishedAt: "2026-02-28",
    readingMinutes: 3,
    recipeFilters: ["breakfast", "post_workout", "snack", "vegan"],
    tags: ["latte"],
    bodyHtml: article(
      "Latte ngũ cốc là lựa chọn ấm áp cho sáng sớm hoặc sau tập nhẹ.",
      "Khuấy Nutein với sữa hạnh nhân nóng và một chút quế — uống ngay khi còn ấm."
    ),
  },
  {
    id: "post-bua-sang-5-phut",
    slug: "bua-sang-5-phut",
    title: "Bữa sáng 5 phút",
    excerpt:
      "Ba combo bữa sáng dưới 5 phút với đạm thực vật — dành cho ngày bận rộn.",
    category: "recipes",
    coverImage: "/images/brand_design.jpg",
    coverAlt: "Bữa sáng nhanh",
    publishedAt: "2026-06-15",
    readingMinutes: 4,
    featured: true,
    recipeFilters: ["breakfast", "eat_clean", "vegan"],
    tags: ["5 phút"],
    bodyHtml: article(
      "Không phải sáng nào cũng có thời gian nấu. Ba combo: smoothie, oats sẵn, và bánh mì nguyên cám + Nutein shake.",
      "Chuẩn bị nguyên liệu tối hôm trước để sáng chỉ việc lắp ráp."
    ),
  },

  // ── Protein ────────────────────────────────────────────────
  {
    id: "post-protein-la-gi",
    slug: "protein-thuc-vat-la-gi",
    title: "Protein thực vật là gì?",
    excerpt:
      "Đạm từ thực vật khác đạm động vật thế nào, và vì sao ngày càng được chọn cho lối sống lành mạnh.",
    category: "protein",
    coverImage: "/images/beans.jpg",
    coverAlt: "Đậu giàu protein thực vật",
    publishedAt: "2026-06-01",
    readingMinutes: 6,
    featured: true,
    tags: ["cơ bản"],
    bodyHtml: article(
      "Protein thực vật đến từ đậu, hạt, ngũ cốc và bột protein như Nutein.",
      "Nhiều người chọn vì đạo đức, môi trường hoặc dễ dung nạp hơn trong khẩu phần hàng ngày."
    ),
  },
  {
    id: "post-thuc-vat-vs-dong-vat",
    slug: "so-sanh-protein-thuc-vat-va-dong-vat",
    title: "So sánh Protein thực vật vs động vật",
    excerpt:
      "Không có “một bên thắng tất cả” — hiểu ưu nhược để chọn nguồn đạm phù hợp.",
    category: "protein",
    coverImage: "/images/vegetables.jpg",
    coverAlt: "Rau củ tươi",
    publishedAt: "2026-04-18",
    readingMinutes: 7,
    tags: ["so sánh"],
    bodyHtml: article(
      "Cả hai nguồn đều cung cấp amino acid. Khác biệt nằm ở chất béo, chất xơ và cách kết hợp thực đơn.",
      "Bột protein thực vật hoàn chỉnh giúp đơn giản hóa việc đủ amino khi ăn chay."
    ),
  },
  {
    id: "post-khi-nao-bo-sung",
    slug: "khi-nao-nen-bo-sung-protein",
    title: "Khi nào nên bổ sung protein?",
    excerpt:
      "Dấu hiệu khẩu phần thiếu đạm và thời điểm bổ sung hợp lý trong ngày.",
    category: "protein",
    coverImage: "/images/yogurt.jpg",
    coverAlt: "Bổ sung protein",
    publishedAt: "2026-05-20",
    readingMinutes: 5,
    tags: ["bổ sung"],
    bodyHtml: article(
      "Nên cân nhắc bổ sung khi tập luyện tăng cường, ăn chay, hoặc các ngày bận không đủ bữa cân bằng.",
      "Một serving sau tập hoặc trong bữa sáng nhanh thường dễ duy trì thói quen nhất."
    ),
  },
  {
    id: "post-vai-tro-protein",
    slug: "vai-tro-protein-trong-che-do-an",
    title: "Vai trò protein trong chế độ ăn",
    excerpt:
      "Protein hỗ trợ no lâu, phục hồi và duy trì khối cơ — nền tảng của thực đơn lành mạnh.",
    category: "protein",
    coverImage: "/images/beans.jpg",
    coverAlt: "Vai trò protein",
    publishedAt: "2026-03-08",
    readingMinutes: 5,
    tags: ["dinh dưỡng"],
    bodyHtml: article(
      "Protein là thành phần cấu trúc của cơ thể và giúp ổn định cảm giác đói giữa các bữa.",
      "Kết hợp nguồn thực vật đa dạng trong ngày là cách bền vững để đủ nhu cầu."
    ),
  },

  // ── Healthy Lifestyle ──────────────────────────────────────
  {
    id: "post-bua-phu",
    slug: "bua-phu-lanh-manh",
    title: "Bữa phụ lành mạnh",
    excerpt:
      "Gợi ý snack no vừa phải — trái cây, hạt, hoặc shake protein nhẹ thay bánh ngọt.",
    category: "lifestyle",
    coverImage: "/images/apples.jpg",
    coverAlt: "Snack lành mạnh",
    publishedAt: "2026-03-22",
    readingMinutes: 4,
    tags: ["ăn nhẹ"],
    bodyHtml: article(
      "Bữa phụ giúp ổn định năng lượng và tránh đói quá mức trước bữa chính.",
      "Thử táo + hạt, hoặc sữa chua thực vật khuấy Nutein khi cần thêm đạm."
    ),
  },
  {
    id: "post-eat-clean",
    slug: "eat-clean-la-gi",
    title: "Eat Clean",
    excerpt:
      "Eat Clean không phải chế độ khắc nghiệt — mà là ưu tiên nguyên liệu thật, ít chế biến.",
    category: "lifestyle",
    coverImage: "/images/vegetables.jpg",
    coverAlt: "Eat Clean",
    publishedAt: "2026-05-02",
    readingMinutes: 5,
    featured: true,
    tags: ["eat clean"],
    bodyHtml: article(
      "Eat Clean tập trung vào rau, trái cây, ngũ cốc nguyên hạt và nguồn đạm sạch.",
      "Protein thực vật Nutein phù hợp như lớp đạm nhanh trong khung Eat Clean hàng ngày."
    ),
  },
  {
    id: "post-meal-prep",
    slug: "meal-prep-loi-song-lanh-manh",
    title: "Meal Prep",
    excerpt:
      "Chuẩn bị sẵn vài phần ăn trong tuần giúp bạn không phụ thuộc đồ ăn nhanh khi bận.",
    category: "lifestyle",
    coverImage: "/images/brand_design.jpg",
    coverAlt: "Meal prep",
    publishedAt: "2026-05-10",
    readingMinutes: 5,
    tags: ["meal prep"],
    bodyHtml: article(
      "Lối sống lành mạnh là hệ thống giúp bạn dễ chọn đúng khi mệt — meal prep là một trụ cột.",
      "Chọn 2–3 công thức lặp lại và giữ sẵn bột protein để bổ sung đạm nhanh."
    ),
  },
  {
    id: "post-loi-song-lanh-manh",
    slug: "xay-dung-loi-song-lanh-manh",
    title: "Xây dựng lối sống lành mạnh",
    excerpt:
      "Thói quen nhỏ mỗi ngày: ngủ đủ, vận động nhẹ, ăn đủ đạm và uống nước.",
    category: "lifestyle",
    coverImage: "/images/about.png",
    coverAlt: "Lối sống lành mạnh",
    publishedAt: "2026-04-05",
    readingMinutes: 6,
    tags: ["lifestyle"],
    bodyHtml: article(
      "Không cần hoàn hảo — cần nhất quán. Bắt đầu với một thói quen ăn sáng đủ đạm.",
      "Kết hợp vận động nhẹ 20 phút và chuẩn bị snack lành mạnh sẽ tạo đà bền vững."
    ),
  },

  // ── Dinh dưỡng ─────────────────────────────────────────────
  {
    id: "post-dam-an-chay",
    slug: "bo-sung-dam-cho-nguoi-an-chay",
    title: "Bổ sung đạm cho người ăn chay",
    excerpt:
      "Kết hợp đậu, ngũ cốc, hạt và bột protein thực vật để đủ nhu cầu hàng ngày.",
    category: "nutrition",
    coverImage: "/images/beans.jpg",
    coverAlt: "Đạm cho người ăn chay",
    publishedAt: "2026-06-08",
    readingMinutes: 6,
    tags: ["ăn chay"],
    bodyHtml: article(
      "Người ăn chay hoàn toàn có thể đủ protein nếu chú ý đa dạng nguồn.",
      "Một serving bột protein thực vật giúp bù nhanh những ngày khẩu phần mỏng."
    ),
  },
  {
    id: "post-dinh-duong-tap-luyen",
    slug: "dinh-duong-cho-nguoi-tap-luyen",
    title: "Dinh dưỡng cho người tập luyện",
    excerpt:
      "Trước và sau buổi tập: carb nhẹ + đạm thực vật để phục hồi hiệu quả hơn.",
    category: "nutrition",
    coverImage: "/images/yogurt.jpg",
    coverAlt: "Dinh dưỡng tập luyện",
    publishedAt: "2026-05-25",
    readingMinutes: 6,
    tags: ["tập luyện"],
    bodyHtml: article(
      "Sau tập, cơ thể cần đạm để phục hồi. Smoothie hoặc latte Nutein là lựa chọn nhanh.",
      "Đừng bỏ quên nước và giấc ngủ — chúng quyết định chất lượng phục hồi không kém dinh dưỡng."
    ),
  },
  {
    id: "post-chat-xo",
    slug: "vai-tro-chat-xo-trong-che-do-an",
    title: "Vai trò chất xơ",
    excerpt:
      "Chất xơ hỗ trợ tiêu hóa và no lâu — thường đi kèm nguồn protein thực vật nguyên hạt.",
    category: "nutrition",
    coverImage: "/images/vegetables.jpg",
    coverAlt: "Chất xơ",
    publishedAt: "2026-04-02",
    readingMinutes: 5,
    tags: ["chất xơ"],
    bodyHtml: article(
      "Chất xơ giúp hệ tiêu hóa ổn định và hỗ trợ cảm giác no.",
      "Kết hợp rau, trái cây, ngũ cốc nguyên hạt với đạm thực vật là cách tự nhiên để cân bằng."
    ),
  },
  {
    id: "post-vitamin-khoang-chat",
    slug: "vitamin-va-khoang-chat",
    title: "Vitamin & khoáng chất",
    excerpt:
      "Sắt, canxi, B12 và vitamin D — những điểm cần lưu ý trong thực đơn thực vật.",
    category: "nutrition",
    coverImage: "/images/apples.jpg",
    coverAlt: "Vitamin khoáng chất",
    publishedAt: "2026-03-30",
    readingMinutes: 7,
    tags: ["vitamin"],
    bodyHtml: article(
      "Chế độ thực vật phong phú thường giàu nhiều vi chất, nhưng một số nhóm cần chủ động hơn.",
      "Đa dạng màu sắc trên đĩa và theo dõi xét nghiệm định kỳ nếu bạn ăn chay lâu dài."
    ),
  },
  {
    id: "post-can-bang-dinh-duong",
    slug: "can-bang-dinh-duong",
    title: "Cân bằng dinh dưỡng",
    excerpt:
      "Đĩa ăn cân bằng: nửa rau, phần tinh bột nguyên hạt, phần đạm thực vật.",
    category: "nutrition",
    coverImage: "/images/vegetables.jpg",
    coverAlt: "Cân bằng dinh dưỡng",
    publishedAt: "2026-02-14",
    readingMinutes: 5,
    featured: true,
    tags: ["cân bằng"],
    bodyHtml: article(
      "Cân bằng không có nghĩa mọi bữa giống nhau — mà là trung bình cả ngày/tuần đủ nhóm chất.",
      "Dùng Nutein như “lớp đạm” linh hoạt khi bữa chính thiếu protein."
    ),
  },
];
