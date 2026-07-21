import { ABOUT_HERO, ABOUT_STORY } from "@/features/about/constants";
import type { AdminStaticPage } from "../types";

export const MOCK_ADMIN_STATIC_PAGES: AdminStaticPage[] = [
  {
    slug: "privacy",
    title: "Chính sách bảo mật",
    content:
      "Nutein cam kết bảo vệ thông tin cá nhân khách hàng. Chúng tôi chỉ thu thập dữ liệu cần thiết để xử lý đơn hàng và hỗ trợ.",
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
  {
    slug: "terms",
    title: "Điều khoản sử dụng",
    content:
      "Khi sử dụng website Nutein, bạn đồng ý với các điều khoản mua hàng, thanh toán và sử dụng nội dung trên site.",
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
  {
    slug: "shipping",
    title: "Chính sách giao hàng",
    content:
      "Giao hàng tiêu chuẩn 3–5 ngày làm việc trên toàn quốc. Đơn đủ điều kiện có thể được miễn phí vận chuyển theo chương trình.",
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
  {
    slug: "return",
    title: "Chính sách đổi trả",
    content:
      "Sản phẩm lỗi do vận chuyển hoặc sản xuất được hỗ trợ đổi trong 7 ngày kể từ khi nhận hàng, còn nguyên seal.",
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
  {
    slug: "payment",
    title: "Phương thức thanh toán",
    content:
      "Hỗ trợ COD và chuyển khoản. Thanh toán online sẽ bổ sung theo đối tác cổng thanh toán.",
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
  {
    slug: "about",
    title: "Về Nutein",
    content: `${ABOUT_HERO.titleLine1} ${ABOUT_HERO.titleLine2}\n\n${ABOUT_HERO.lead}\n\n## ${ABOUT_STORY.storyTitle}\n\n${ABOUT_STORY.storyBody}\n\n## ${ABOUT_STORY.philosophyTitle}\n\n${ABOUT_STORY.philosophyBody}`,
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
];
