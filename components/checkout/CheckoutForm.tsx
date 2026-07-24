"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSWRConfig } from "swr";
import { notify } from "@/lib/toast";
import {
  CHECKOUT_FORM_DEFAULT_VALUES,
  CHECKOUT_ORDER_SNAPSHOT_KEY,
  SHIPPING_FEES_VND,
} from "@/features/checkout/constants";
import {
  checkoutFormSchema,
  type CheckoutFormValues,
} from "@/features/checkout/schemas/checkout.schema";
import {
  getFirstCheckoutErrorPath,
  scrollToCheckoutField,
} from "@/features/checkout/scroll-to-error";
import { resolveCheckoutShippingFee } from "@/features/cart/pricing";
import { CheckoutContactSection } from "@/components/checkout/CheckoutContactSection";
import { CheckoutDeliverySection } from "@/components/checkout/CheckoutDeliverySection";
import { CheckoutOrderSummary } from "@/components/checkout/CheckoutOrderSummary";
import { CheckoutPaymentSection } from "@/components/checkout/CheckoutPaymentSection";
import { CheckoutShippingSection } from "@/components/checkout/CheckoutShippingSection";
import {
  CheckoutSubmitBlock,
  CheckoutSubmittingOverlay,
} from "@/components/checkout/CheckoutSubmitBlock";
import { isCheckoutContactComplete } from "@/features/checkout/contact-complete";
import { openAuthModal } from "@/lib/openAuthModal";
import { useAccountProfile } from "@/lib/useAccountProfile";
import { useAddresses } from "@/lib/useAddresses";
import { useAuthStore } from "@/lib/useAuthStore";
import { useCartStore } from "@/lib/useCartStore";
import { useCheckoutSubmit } from "@/lib/useCheckoutSubmit";

/**
 * Form checkout — compose sections (soft limit ~300 dòng).
 * Guest: ẩn field Liên hệ (giữ heading + Đăng nhập); vẫn điền giao hàng /
 * vận chuyển / thanh toán. Submit guest → Auth trước validate Liên hệ.
 */
export default function CheckoutForm() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { user, isLoggedIn, signOut } = useAuthStore();
  const { updateProfile, profile } = useAccountProfile();
  const { addresses, defaultAddress, isLoading: addressesLoading, saveAsDefaultFromCheckout } =
    useAddresses();
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState("");
  const { lines, summary, isEmpty, isReady: cartReady, removeFromCart } = useCartStore();
  const { submitOrder, isSubmitting } = useCheckoutSubmit();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: CHECKOUT_FORM_DEFAULT_VALUES,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const address = useWatch({ control, name: "address" });
  const shippingMethod = useWatch({ control, name: "shippingMethod" });
  const paymentMethod = useWatch({ control, name: "paymentMethod" });
  const provinceCode = address?.provinceCode ?? "";
  const wardCode = address?.wardCode ?? "";
  const addressReady = Boolean(provinceCode.trim() && wardCode.trim());

  /** Khóa Liên hệ chỉ khi session/profile đã đủ — không khóa giữa chừng khi đang bổ sung. */
  const contactLocked = useMemo(() => {
    if (!isLoggedIn) return false;
    return isCheckoutContactComplete({
      fullName: profile?.fullName || user?.fullName,
      phone: profile?.phone || user?.phone,
    });
  }, [
    isLoggedIn,
    profile?.fullName,
    profile?.phone,
    user?.fullName,
    user?.phone,
  ]);

  const shippingPreview = useMemo(() => {
    if (!addressReady) {
      return {
        shippingFee: null as number | null,
        shippingNote: "Nhập địa chỉ giao hàng",
      };
    }
    return resolveCheckoutShippingFee(
      shippingMethod ?? "standard",
      summary.voucherProgress,
      SHIPPING_FEES_VND,
    );
  }, [addressReady, shippingMethod, summary.voucherProgress]);

  const placingOrderRef = useRef(false);

  useEffect(() => {
    // Đợi cart đọc xong localStorage (cartReady) trước khi kết luận "trống"
    // — tránh đá nhầm về home khi hard-refresh/mở thẳng /checkout lúc giỏ
    // vẫn còn hàng (isEmpty=true giả ở lần render đầu trước khi hydrate).
    if (!cartReady) return;
    // Giỏ trống → về home im lặng (single-SKU: không cần toast “thêm sản phẩm”).
    // Bỏ qua khi vừa đặt hàng xong (cart clear trước khi push /success).
    if (isEmpty && !placingOrderRef.current) {
      router.replace("/");
    }
  }, [cartReady, isEmpty, router]);

  useEffect(() => {
    // Prefill từ session/profile — chỉ khi field còn trống, không
    // shouldValidate (tránh loop với reValidateMode + object `user` đổi identity).
    if (!user?.email) return;

    const current = getValues();
    if (!current.buyer.email?.trim()) {
      setValue("buyer.email", user.email, { shouldDirty: false });
    }

    const fullName = (profile?.fullName || user.fullName || "").trim();
    const phone = (profile?.phone || user.phone || "").trim();
    if (fullName && !current.buyer.fullName?.trim()) {
      setValue("buyer.fullName", fullName, { shouldDirty: false });
    }
    if (phone && !current.buyer.phone?.trim()) {
      setValue("buyer.phone", phone, { shouldDirty: false });
    }
  }, [
    user?.email,
    user?.fullName,
    user?.phone,
    profile?.fullName,
    profile?.phone,
    setValue,
    getValues,
  ]);

  useEffect(() => {
    if (!defaultAddress) return;
    const current = getValues("address");
    // Chỉ prefill lần đầu (form địa chỉ còn trống) — không đè khi user đang sửa / test validate.
    const addressEmpty =
      !current.provinceCode?.trim() &&
      !current.wardCode?.trim() &&
      !current.street?.trim();
    if (!addressEmpty) return;

    setValue("address.provinceCode", defaultAddress.provinceCode, {
      shouldDirty: false,
    });
    setValue("address.province", defaultAddress.province, { shouldDirty: false });
    setValue("address.wardCode", defaultAddress.wardCode, { shouldDirty: false });
    setValue("address.ward", defaultAddress.ward, { shouldDirty: false });
    setValue("address.street", defaultAddress.street, { shouldDirty: false });
    setSelectedSavedAddressId(defaultAddress.id);
  }, [defaultAddress, setValue, getValues]);

  const openCheckoutAuth = () =>
    openAuthModal(mutate, { tab: "login", returnTo: "/checkout" });

  const handleLogout = async () => {
    if (isSubmitting) return;
    const current = getValues();
    await signOut();
    setSelectedSavedAddressId("");
    reset({
      ...current,
      buyer: { fullName: "", phone: "", email: "" },
    });
    notify.success("Đã đăng xuất.");
  };

  const placeOrder = handleSubmit(
    async (values) => {
      try {
        const result = await submitOrder({
          lines,
          buyer: values.buyer,
          address: values.address,
          note: values.note || undefined,
          shippingMethod: values.shippingMethod,
          paymentMethod: values.paymentMethod,
          saveInfo: values.saveInfo,
        });

        try {
          sessionStorage.setItem(
            CHECKOUT_ORDER_SNAPSHOT_KEY,
            JSON.stringify(result),
          );
        } catch {
          /* private mode */
        }

        if (user?.email) {
          try {
            // Luôn đồng bộ họ tên/SĐT về hồ sơ (kể cả không tick lưu địa chỉ).
            await updateProfile({
              fullName: values.buyer.fullName,
              phone: values.buyer.phone,
            });
            if (values.saveInfo) {
              await saveAsDefaultFromCheckout(values.address);
            }
          } catch {
            /* không chặn success flow nếu sync thất bại */
          }
        }

        placingOrderRef.current = true;
        await removeFromCart();

        if (result.paymentUrl) {
          window.location.replace(result.paymentUrl);
          return;
        }

        notify.success("Đặt hàng thành công!");
        router.push(
          `/checkout/success?orderCode=${encodeURIComponent(result.orderCode)}`,
        );
      } catch (err) {
        notify.error(
          err instanceof Error
            ? err.message
            : "Đặt hàng thất bại — vui lòng thử lại",
        );
      }
    },
    (formErrors) => {
      const path = getFirstCheckoutErrorPath(formErrors);
      if (path) scrollToCheckoutField(path);
    },
  );

  const onFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isLoggedIn) {
      openCheckoutAuth();
      notify.error("Vui lòng đăng nhập hoặc đăng ký để đặt hàng.");
      return;
    }
    void placeOrder();
  };

  if (!cartReady || isEmpty) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6">
        <p className="text-sm font-semibold text-text-muted">
          {cartReady ? "Đang chuyển hướng…" : "Đang tải giỏ hàng…"}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onFormSubmit} className="relative">
      <div className="mx-auto grid max-w-[1100px] gap-10 px-5 py-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12 lg:py-12">
        {/* Mobile: summary trên đầu; desktop: cột phải sticky */}
        <div className="order-1 lg:order-2 lg:sticky lg:top-8 lg:self-start">
          <CheckoutOrderSummary
            summary={summary}
            shippingFee={shippingPreview.shippingFee}
            shippingNote={shippingPreview.shippingNote}
          />
        </div>

        <div className="order-2 flex flex-col gap-10 lg:order-1">
          <CheckoutContactSection
            register={register}
            errors={errors}
            isSubmitting={isSubmitting}
            isLoggedIn={isLoggedIn}
            contactLocked={contactLocked}
            user={user}
            onOpenAuth={openCheckoutAuth}
            onLogout={() => {
              void handleLogout();
            }}
          />
          <CheckoutDeliverySection
            register={register}
            setValue={setValue}
            errors={errors}
            isSubmitting={isSubmitting}
            provinceCode={provinceCode}
            wardCode={wardCode}
            isLoggedIn={isLoggedIn}
            savedAddresses={isLoggedIn ? addresses : []}
            savedAddressesLoading={isLoggedIn && addressesLoading}
            selectedSavedAddressId={selectedSavedAddressId}
            onSelectedSavedAddressIdChange={setSelectedSavedAddressId}
          />
          <CheckoutShippingSection
            addressReady={addressReady}
            shippingMethod={shippingMethod ?? "standard"}
            setValue={setValue}
            errors={errors}
            isSubmitting={isSubmitting}
            voucherProgress={summary.voucherProgress}
          />
          <CheckoutPaymentSection
            paymentMethod={paymentMethod ?? "cod"}
            setValue={setValue}
            isSubmitting={isSubmitting}
          />
          <CheckoutSubmitBlock isSubmitting={isSubmitting} />
        </div>
      </div>

      {isSubmitting ? <CheckoutSubmittingOverlay /> : null}
    </form>
  );
}
