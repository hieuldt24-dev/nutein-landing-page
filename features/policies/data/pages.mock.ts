import type { StaticPage } from "../types";

/**
 * Mock public/admin — cùng shape DB `static_pages`.
 * Nội dung dùng `##` để tách section trên trang Joy Rush-style.
 */
export const MOCK_POLICY_PAGES: StaticPage[] = [
  {
    slug: "bao-mat",
    title: "Chính sách bảo mật",
    updatedAt: "2026-06-01T00:00:00.000Z",
    content: `Nutein cam kết bảo vệ thông tin cá nhân của khách hàng. Chúng tôi chỉ thu thập và xử lý dữ liệu cần thiết để vận hành cửa hàng, giao hàng và hỗ trợ bạn tốt hơn.

## 01. Thông tin chúng tôi thu thập
Họ tên, số điện thoại, email, địa chỉ nhận hàng và nội dung bạn gửi qua form liên hệ hoặc tài khoản. Dữ liệu thanh toán (nếu có) được xử lý qua đối tác cổng thanh toán — Nutein không lưu đầy đủ thông tin thẻ.

## 02. Mục đích sử dụng
Xử lý đơn hàng, giao nhận, chăm sóc khách hàng, cải thiện trải nghiệm website và gửi thông tin liên quan đơn hàng (khi bạn đồng ý nhận thông báo marketing).

## 03. Chia sẻ với bên thứ ba
Chỉ chia sẻ khi cần thiết để hoàn tất đơn (đơn vị vận chuyển, cổng thanh toán) hoặc khi pháp luật yêu cầu. Chúng tôi không bán dữ liệu cá nhân.

## 04. Bảo mật & lưu trữ
Áp dụng biện pháp kỹ thuật và tổ chức phù hợp để hạn chế truy cập trái phép. Dữ liệu được lưu trong thời gian cần thiết cho mục đích nêu trên hoặc theo quy định pháp luật.

## 05. Quyền của bạn
Bạn có thể yêu cầu xem, cập nhật hoặc xoá thông tin tài khoản qua trang Tài khoản / Liên hệ. Mọi thắc mắc về bảo mật gửi về hello@nutein.vn.`,
  },
  {
    slug: "dieu-khoan",
    title: "Điều khoản sử dụng",
    updatedAt: "2026-06-01T00:00:00.000Z",
    content: `Khi truy cập và sử dụng website Nutein, bạn đồng ý với các điều khoản dưới đây. Nếu không đồng ý, vui lòng ngừng sử dụng dịch vụ.

## 01. Tài khoản
Bạn chịu trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động phát sinh từ tài khoản của mình. Thông tin cung cấp phải chính xác, đầy đủ.

## 02. Đặt hàng & giá
Đơn hàng chỉ được xác nhận sau khi Nutein tiếp nhận và xử lý thành công. Giá, khuyến mãi và tồn kho có thể thay đổi mà không cần báo trước, trừ đơn đã xác nhận.

## 03. Nội dung trên website
Hình ảnh, bài viết và tài liệu thuộc quyền của Nutein hoặc bên cấp phép. Không sao chép, phân phối cho mục đích thương mại khi chưa được đồng ý bằng văn bản.

## 04. Giới hạn trách nhiệm
Nutein nỗ lực duy trì thông tin chính xác nhưng không cam kết website không gián đoạn hoặc không lỗi. Trách nhiệm pháp lý được giới hạn trong phạm vi pháp luật cho phép.

## 05. Thay đổi điều khoản
Chúng tôi có thể cập nhật điều khoản theo thời gian. Phiên bản mới có hiệu lực kể từ ngày đăng trên trang này.`,
  },
  {
    slug: "giao-hang",
    title: "Chính sách giao hàng",
    updatedAt: "2026-06-01T00:00:00.000Z",
    content: `Nutein giao hàng toàn quốc qua đối tác vận chuyển uy tín. Thời gian và phí ship phụ thuộc khu vực và phương thức bạn chọn khi thanh toán.

## 01. Phạm vi giao hàng
Hỗ trợ giao trên toàn Việt Nam. Một số khu vực xa / hải đảo có thể cần thêm thời gian hoặc phụ phí theo bảng giá đơn vị vận chuyển.

## 02. Thời gian dự kiến
Giao tiêu chuẩn thường 3–5 ngày làm việc sau khi đơn được xác nhận. Giao nhanh (nếu có) rút ngắn theo khu vực — thời gian hiển thị tại checkout là ước tính.

## 03. Phí vận chuyển
Phí được tính theo địa chỉ và phương thức. Đơn đủ điều kiện chương trình khuyến mãi có thể được miễn phí ship theo tiến độ voucher trên giỏ hàng.

## 04. Kiểm tra khi nhận
Vui lòng kiểm tra ngoại quan kiện hàng trước khi ký nhận. Nếu hộp móp méo / seal hỏng, từ chối nhận hoặc ghi chú với shipper và liên hệ Nutein trong 48 giờ.

## 05. Thất lạc / chậm trễ
Chúng tôi hỗ trợ tra cứu vận đơn với đơn vị giao hàng. Chậm do thời tiết, lễ tết hoặc sự cố carrier ngoài tầm kiểm soát sẽ được cập nhật sớm nhất có thể.`,
  },
  {
    slug: "doi-tra",
    title: "Chính sách đổi trả",
    updatedAt: "2026-06-01T00:00:00.000Z",
    content: `Cảm ơn bạn đã chọn Nutein. Vì sản phẩm thực phẩm / dinh dưỡng, chúng tôi áp dụng đổi trả trong các trường hợp cụ thể dưới đây để đảm bảo an toàn chất lượng.

## 01. Điều kiện được hỗ trợ
Sản phẩm lỗi do sản xuất hoặc hư hỏng trong vận chuyển; giao sai hàng so với đơn đã xác nhận. Sản phẩm còn nguyên seal (trừ khi lỗi nằm trong seal và được Nutein xác nhận).

## 02. Thời hạn yêu cầu
Liên hệ trong 7 ngày kể từ khi nhận hàng (hoặc 48 giờ với hàng hư do vận chuyển). Gửi kèm mã đơn, mô tả sự cố và ảnh minh chứng rõ.

## 03. Cách thức xử lý
Sau khi xác minh, Nutein có thể đổi sản phẩm tương đương hoặc hoàn tiền theo phương thức thanh toán gốc. Phí ship liên quan đơn lỗi (nếu có) được xem xét hoàn theo từng trường hợp.

## 04. Không áp dụng đổi trả
Đổi ý / không thích hương vị; đã mở seal khi không thuộc lỗi được xác nhận; hư hỏng do bảo quản sai hướng dẫn; đơn giao thành công nhưng thất lạc sau khi ký nhận.

## 05. Liên hệ hỗ trợ
Gửi yêu cầu qua form Liên hệ hoặc email hello@nutein.vn với tiêu đề nêu mã đơn để được phản hồi nhanh.`,
  },
  {
    slug: "thanh-toan",
    title: "Phương thức thanh toán",
    updatedAt: "2026-06-01T00:00:00.000Z",
    content: `Nutein hỗ trợ các hình thức thanh toán phổ biến để bạn hoàn tất đơn hàng thuận tiện và an toàn.

## 01. Thanh toán khi nhận hàng (COD)
Thanh toán bằng tiền mặt cho nhân viên giao hàng khi nhận kiện. Vui lòng chuẩn bị đúng số tiền trên đơn.

## 02. Chuyển khoản ngân hàng
Chuyển khoản theo thông tin Nutein cung cấp sau khi đặt hàng. Đơn được xử lý sau khi xác nhận đã nhận chuyển khoản (có thể cần bạn gửi biên lai nếu được yêu cầu).

## 03. Ví điện tử / cổng online
Sẽ bổ sung theo đối tác thanh toán. Khi kích hoạt, giao dịch được mã hoá và xử lý bởi bên thứ ba — Nutein không lưu đầy đủ dữ liệu thẻ.

## 04. Hoá đơn & chứng từ
Thông tin xuất hoá đơn (nếu cần) vui lòng ghi chú khi đặt hàng hoặc liên hệ sớm sau khi đặt. Chúng tôi hỗ trợ trong phạm vi quy định kế toán hiện hành.

## 05. Sự cố thanh toán
Nếu giao dịch lỗi hoặc bị trừ tiền nhưng đơn chưa xác nhận, liên hệ ngay kèm mã giao dịch / ảnh biên lai để được kiểm tra và hỗ trợ.`,
  },
];
