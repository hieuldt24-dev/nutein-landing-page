/** Họ tên + SĐT đủ để khóa field Liên hệ khi đã đăng nhập. */
export function isCheckoutContactComplete(input: {
  fullName?: string | null;
  phone?: string | null;
}): boolean {
  const name = (input.fullName ?? "").trim();
  const phone = (input.phone ?? "").trim();
  return name.length >= 2 && /^(0|\+84)[0-9]{9}$/.test(phone);
}
