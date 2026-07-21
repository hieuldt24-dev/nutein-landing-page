"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { notify } from "@/lib/toast";
import {
  CONTACT_SUBJECTS,
  MAX_MESSAGE_LENGTH,
} from "@/features/contact/constants";
import {
  contactFormSchema,
  type ContactFormData,
} from "@/features/contact/schemas/contact.schema";
import type { ContactSubmissionResult } from "@/features/contact/types";
import {
  CheckoutField,
  CheckoutSelect,
  CheckoutTextArea,
  CheckoutTextInput,
} from "@/components/checkout/CheckoutField";
import { FillButton } from "@/components/ui/FillButton";
import { useAccountProfile } from "@/lib/useAccountProfile";
import type { ApiResponse } from "@/src/api/response";
import type { FetchError } from "@/lib/swr-fetcher";

const EMPTY_CONTACT_FORM: ContactFormData = {
  name: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
};

async function postContact(body: ContactFormData): Promise<ContactSubmissionResult> {
  const res = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      phone: body.phone?.trim() ? body.phone.trim() : undefined,
    }),
  });

  const json: ApiResponse<ContactSubmissionResult> = await res.json().catch(() => ({
    success: false,
    data: null,
    error: { message: "Không đọc được phản hồi máy chủ", code: "PARSE_ERROR" },
  }));

  if (!res.ok || !json.success || !json.data) {
    const error = new Error(
      json.error?.message || "Gửi liên hệ thất bại — vui lòng thử lại",
    ) as FetchError;
    error.status = res.status;
    error.code = json.error?.code || "CONTACT_ERROR";
    throw error;
  }

  return json.data;
}

/**
 * Form liên hệ — Joy Rush: name/email · subject · message · submit.
 * Logged-in: prefill từ `/api/account/profile`, vẫn chỉnh sửa được trước khi gửi.
 */
export function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { profile, isLoggedIn } = useAccountProfile();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: EMPTY_CONTACT_FORM,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    if (!isLoggedIn || !profile) return;

    const current = getValues();
    const fullName = (profile.fullName || "").trim();
    const email = (profile.email || "").trim();
    const phone = (profile.phone || "").trim();

    // Chỉ điền field còn trống — không đè khi user đang sửa.
    if (fullName && !current.name?.trim()) {
      setValue("name", fullName, { shouldDirty: false });
    }
    if (email && !current.email?.trim()) {
      setValue("email", email, { shouldDirty: false });
    }
    if (phone && !current.phone?.trim()) {
      setValue("phone", phone, { shouldDirty: false });
    }
  }, [
    isLoggedIn,
    profile?.fullName,
    profile?.email,
    profile?.phone,
    setValue,
    getValues,
  ]);

  const onSubmit = handleSubmit(async (values) => {
    setIsSubmitting(true);
    try {
      const result = await postContact(values);
      notify.success(result.message);
      reset({
        ...EMPTY_CONTACT_FORM,
        name: (profile?.fullName || "").trim(),
        email: (profile?.email || "").trim(),
        phone: (profile?.phone || "").trim(),
      });
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Gửi liên hệ thất bại");
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <CheckoutField label="Họ và tên" error={errors.name?.message}>
          <CheckoutTextInput
            autoComplete="name"
            placeholder="Nguyễn Văn A"
            disabled={isSubmitting}
            error={Boolean(errors.name)}
            {...register("name")}
          />
        </CheckoutField>
        <CheckoutField label="Email" error={errors.email?.message}>
          <CheckoutTextInput
            type="email"
            autoComplete="email"
            placeholder="tenban@example.com"
            disabled={isSubmitting}
            error={Boolean(errors.email)}
            {...register("email")}
          />
        </CheckoutField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CheckoutField label="Số điện thoại (tuỳ chọn)" error={errors.phone?.message}>
          <CheckoutTextInput
            type="tel"
            autoComplete="tel"
            placeholder="0901234567"
            disabled={isSubmitting}
            error={Boolean(errors.phone)}
            {...register("phone")}
          />
        </CheckoutField>
        <CheckoutField label="Chủ đề" error={errors.subject?.message}>
          <CheckoutSelect
            disabled={isSubmitting}
            error={Boolean(errors.subject)}
            defaultValue=""
            {...register("subject")}
          >
            <option value="" disabled>
              Chọn chủ đề
            </option>
            {CONTACT_SUBJECTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </CheckoutSelect>
        </CheckoutField>
      </div>

      <CheckoutField label="Nội dung" error={errors.message?.message}>
        <CheckoutTextArea
          placeholder="Bạn muốn chúng tôi hỗ trợ điều gì?"
          disabled={isSubmitting}
          error={Boolean(errors.message)}
          maxLength={MAX_MESSAGE_LENGTH}
          {...register("message")}
        />
      </CheckoutField>

      <FillButton
        type="submit"
        variant="ink-solid"
        disabled={isSubmitting}
        className="mt-1 h-[48px] w-full justify-center px-8 text-[14px] font-bold uppercase sm:w-auto"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" size={18} />
            Đang gửi…
          </>
        ) : (
          "Gửi tin nhắn"
        )}
      </FillButton>
    </form>
  );
}
