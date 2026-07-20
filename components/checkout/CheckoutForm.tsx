"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
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
import { accountService } from "@/features/account/services/account.service";
import { isCheckoutContactComplete } from "@/features/checkout/contact-complete";
import { useAccountProfile } from "@/lib/useAccountProfile";
import { useAuthStore } from "@/lib/useAuthStore";
import { useCartStore } from "@/lib/useCartStore";
import { useCheckoutSubmit } from "@/lib/useCheckoutSubmit";

/**
 * Form checkout — compose sections (soft limit ~300 dòng).
 * Logic submit / prefill / guard giữ tại đây.
 */
export default function CheckoutForm() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { user, isLoggedIn, signOut } = useAuthStore();
  const { syncFromCheckout, updateProfile, profile } = useAccountProfile();
  const { quantity, summary, isEmpty, removeFromCart } = useCartStore();
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
  }, [isLoggedIn, profile?.fullName, profile?.phone, user?.fullName, user?.phone]);

  const shippingPreview = useMemo(() => {
    if (!addressReady) {
      return { shippingFee: null as number | null, shippingNote: "Nhập địa chỉ giao hàng" };
    }
    return resolveCheckoutShippingFee(
      shippingMethod ?? "standard",
      summary.voucherProgress,
      SHIPPING_FEES_VND
    );
  }, [addressReady, shippingMethod, summary.voucherProgress]);

  useEffect(() => {
    if (isEmpty) {
      toast.info("Giỏ hàng trống — hãy thêm sản phẩm trước khi thanh toán.");
      router.replace("/");
    }
  }, [isEmpty, router]);

  useEffect(() => {
    if (!user) return;
    setValue("buyer.email", user.email, { shouldValidate: true, shouldDirty: true });

    const fullName = (profile?.fullName || user.fullName || "").trim();
    const phone = (profile?.phone || user.phone || "").trim();
    if (fullName) {
      setValue("buyer.fullName", fullName, { shouldValidate: true, shouldDirty: true });
    }
    if (phone) {
      setValue("buyer.phone", phone, { shouldValidate: true, shouldDirty: true });
    }

    let cancelled = false;
    void accountService.getDefaultAddress(user.email).then((addr) => {
      if (cancelled || !addr) return;
      setValue("address.provinceCode", addr.provinceCode, { shouldValidate: true });
      setValue("address.province", addr.province, { shouldValidate: true });
      setValue("address.wardCode", addr.wardCode, { shouldValidate: true });
      setValue("address.ward", addr.ward, { shouldValidate: true });
      setValue("address.street", addr.street, { shouldValidate: true });
    });

    return () => {
      cancelled = true;
    };
  }, [user, profile?.fullName, profile?.phone, setValue]);

  const openAuth = () => mutate("auth-modal", true, { revalidate: false });

  const handleLogout = async () => {
    if (isSubmitting) return;
    const current = getValues();
    await signOut();
    reset({
      ...current,
      buyer: { fullName: "", phone: "", email: "" },
    });
  };

  const onSubmit = handleSubmit(
    async (values) => {
      try {
        const result = await submitOrder({
          quantity,
          buyer: values.buyer,
          address: values.address,
          note: values.note || undefined,
          shippingMethod: values.shippingMethod,
          paymentMethod: values.paymentMethod,
          saveInfo: values.saveInfo,
        });

        try {
          sessionStorage.setItem(CHECKOUT_ORDER_SNAPSHOT_KEY, JSON.stringify(result));
        } catch {
          /* private mode */
        }

        if (isLoggedIn && user?.email) {
          try {
            if (values.saveInfo) {
              await syncFromCheckout({
                buyer: values.buyer,
                address: values.address,
              });
            } else {
              // Luôn đồng bộ họ tên/SĐT về hồ sơ (kể cả không tick lưu địa chỉ).
              await updateProfile({
                fullName: values.buyer.fullName,
                phone: values.buyer.phone,
              });
            }
          } catch {
            /* không chặn success flow nếu sync thất bại */
          }
        }

        await removeFromCart();
        toast.success("Đặt hàng thành công!");
        router.push(`/checkout/success?orderCode=${encodeURIComponent(result.orderCode)}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Đặt hàng thất bại — vui lòng thử lại");
      }
    },
    (formErrors) => {
      const path = getFirstCheckoutErrorPath(formErrors);
      if (path) scrollToCheckoutField(path);
    }
  );

  if (isEmpty) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6">
        <p className="text-sm font-semibold text-text-muted">Đang chuyển hướng…</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="relative">
      <div className="mx-auto grid max-w-[1100px] gap-10 px-5 py-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12 lg:py-12">
        <div className="flex flex-col gap-10">
          <CheckoutContactSection
            register={register}
            errors={errors}
            isSubmitting={isSubmitting}
            isLoggedIn={isLoggedIn}
            contactLocked={contactLocked}
            user={user}
            onOpenAuth={openAuth}
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

        <div className="lg:sticky lg:top-8 lg:self-start">
          <CheckoutOrderSummary
            summary={summary}
            shippingFee={shippingPreview.shippingFee}
            shippingNote={shippingPreview.shippingNote}
          />
        </div>
      </div>

      {isSubmitting ? <CheckoutSubmittingOverlay /> : null}
    </form>
  );
}
