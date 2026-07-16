"use client";

import React, { useEffect, useState, useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { X, Eye, EyeOff, Loader2, User, Mail, Lock } from "lucide-react";

// 1. Zod Validation Schemas
const loginSchema = z.object({
  email: z.string().min(1, "Vui lòng nhập email").email("Email không đúng định dạng"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
  rememberMe: z.boolean().optional(),
});

const registerSchema = z.object({
  fullName: z.string().min(1, "Vui lòng nhập họ và tên"),
  email: z.string().min(1, "Vui lòng nhập email").email("Email không đúng định dạng"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
  confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu"),
  agreeTerms: z.boolean().refine(val => val === true, {
    message: "Bạn cần đồng ý với Điều khoản dịch vụ & Chính sách bảo mật",
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Mật khẩu xác nhận không khớp",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthModal() {
  const { mutate } = useSWRConfig();
  const { data: isOpen } = useSWR("auth-modal", () => false, { fallbackData: false });
  
  const setIsOpen = useCallback(
    (val: boolean) => mutate("auth-modal", val, { revalidate: false }),
    [mutate]
  );

  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  // React Hook Form for Login
  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors },
    reset: resetLoginForm,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  // React Hook Form for Register
  const {
    register: registerSignUp,
    handleSubmit: handleSignUpSubmit,
    formState: { errors: signUpErrors },
    reset: resetSignUpForm,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "", agreeTerms: false },
  });

  // 2. Control Body Scroll when Modal is Open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // 3. Close on Escape Key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  // 4. Mock Submit Handlers
  const onLogin = async (_data: LoginFormValues) => {
    setIsSubmittingForm(true);
    console.log("Mock Login Data:", _data.email);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSubmittingForm(false);
    
    toast.success("Đăng nhập thành công! Chào mừng bạn quay trở lại.");
    resetLoginForm();
    setIsOpen(false);
  };

  const onRegister = async (_data: RegisterFormValues) => {
    setIsSubmittingForm(true);
    console.log("Mock Register Data:", _data.email);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSubmittingForm(false);

    toast.success("Đăng ký thành công! Vui lòng đăng nhập với tài khoản mới.");
    resetSignUpForm();
    setActiveTab("login"); // Auto-switch to login tab
  };

  return (
    <div
      id="auth-modal-root"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      {/* CSS-in-JS Styles for rich animations & focus effects */}
      <style>{`
        @keyframes modalScaleEntrance {
          0% {
            opacity: 0;
            transform: scale(0.92) translateY(30px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes glowFloating {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(20px, -20px) scale(1.1);
          }
        }
        @keyframes glowFloatingReverse {
          0%, 100% {
            transform: translate(0, 0) scale(1.1);
          }
          50% {
            transform: translate(-20px, 20px) scale(1);
          }
        }
        
        .input-group:focus-within .input-icon {
          color: #E2A550 !important;
        }
        .input-group:focus-within input {
          border-color: #E2A550 !important;
          box-shadow: 0 0 0 4px rgba(226, 165, 80, 0.16) !important;
        }
        
        /* Custom scrollbar inside modal card */
        .modal-scroll-pane::-webkit-scrollbar {
          width: 5px;
        }
        .modal-scroll-pane::-webkit-scrollbar-track {
          background: transparent;
        }
        .modal-scroll-pane::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.08);
          border-radius: 99px;
        }
      `}</style>

      {/* 5. Backdrop overlay with dark blur */}
      <div
        id="auth-modal-backdrop"
        onClick={() => setIsOpen(false)}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(5, 12, 22, 0.55)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          transition: "opacity 0.3s ease",
        }}
      />

      {/* Ambient glowing blobs behind the card for a premium UI look */}
      <div
        style={{
          position: "absolute",
          width: 320,
          height: 320,
          borderRadius: 999,
          backgroundColor: "rgba(226, 165, 80, 0.28)",
          filter: "blur(70px)",
          top: "15%",
          left: "20%",
          zIndex: 1,
          pointerEvents: "none",
          animation: "glowFloating 8s infinite ease-in-out",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 320,
          height: 320,
          borderRadius: 999,
          backgroundColor: "rgba(196, 226, 147, 0.22)",
          filter: "blur(70px)",
          bottom: "15%",
          right: "20%",
          zIndex: 1,
          pointerEvents: "none",
          animation: "glowFloatingReverse 8s infinite ease-in-out",
        }}
      />

      {/* 6. Modal Card */}
      <div
        id="auth-modal-card"
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          maxWidth: 440,
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: 28,
          boxShadow: "0 25px 50px -12px rgba(53, 30, 41, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.6) inset, 0 0 0 1px rgba(226, 165, 80, 0.12)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          fontFamily: "var(--font-mulish), sans-serif",
          animation: "modalScaleEntrance 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        {/* Decorative Top Bar Pattern */}
        <div
          style={{
            height: 6,
            background: "linear-gradient(90deg, #E2A550 0%, #C4E293 50%, #D8EFFF 100%)",
            width: "100%",
          }}
        />

        {/* Close Button */}
        <button
          onClick={() => setIsOpen(false)}
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            background: "rgba(53, 30, 41, 0.05)",
            border: "none",
            borderRadius: 999,
            padding: 8,
            cursor: "pointer",
            color: "#5A4550",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
            zIndex: 50,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = "rgba(53, 30, 41, 0.09)";
            e.currentTarget.style.color = "#351E29";
            e.currentTarget.style.transform = "rotate(90deg)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = "rgba(53, 30, 41, 0.05)";
            e.currentTarget.style.color = "#5A4550";
            e.currentTarget.style.transform = "rotate(0deg)";
          }}
          aria-label="Đóng popup"
        >
          <X size={16} strokeWidth={2.5} />
        </button>

        {/* Welcome Branding & Title */}
        <div style={{ padding: "32px 24px 20px", textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "linear-gradient(135deg, #E2A550 0%, #C08635 100%)",
              color: "#ffffff",
              fontSize: 20,
              fontWeight: 900,
              marginBottom: 12,
              boxShadow: "0 8px 16px rgba(226, 165, 80, 0.32)",
              fontFamily: "var(--font-quicksand), sans-serif",
            }}
          >
            N
          </div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 800,
              fontFamily: "var(--font-quicksand), sans-serif",
              color: "#351E29",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            {activeTab === "login" ? "Chào mừng bạn trở lại" : "Khởi đầu sống lành mạnh"}
          </h2>
          {activeTab === "login" && (
            <p style={{ fontSize: 13, color: "#8B7680", marginTop: 4, marginBottom: 0 }}>
              Đăng nhập để tích điểm và theo dõi đơn hàng
            </p>
          )}
        </div>

        {/* Segmented Control Switcher (Apple Style) */}
        <div
          style={{
            position: "relative",
            display: "flex",
            backgroundColor: "#F3F4F6",
            borderRadius: 14,
            padding: 4,
            margin: "0 24px 12px",
            border: "1px solid rgba(0, 0, 0, 0.02)",
          }}
        >
          {/* Active sliding indicator pill */}
          <div
            style={{
              position: "absolute",
              top: 4,
              bottom: 4,
              left: activeTab === "login" ? 4 : "calc(50% + 2px)",
              width: "calc(50% - 6px)",
              backgroundColor: "#ffffff",
              borderRadius: 11,
              boxShadow: "0 3px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)",
              transition: "left 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
              zIndex: 0,
            }}
          />
          <button
            onClick={() => {
              if (!isSubmittingForm) setActiveTab("login");
            }}
            style={{
              zIndex: 1,
              flex: 1,
              padding: "10px 0",
              border: "none",
              background: "none",
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "var(--font-quicksand), sans-serif",
              color: activeTab === "login" ? "#C08635" : "#8B7680",
              cursor: isSubmittingForm ? "not-allowed" : "pointer",
              transition: "color 0.2s ease",
            }}
          >
            Đăng nhập
          </button>
          <button
            onClick={() => {
              if (!isSubmittingForm) setActiveTab("register");
            }}
            style={{
              zIndex: 1,
              flex: 1,
              padding: "10px 0",
              border: "none",
              background: "none",
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "var(--font-quicksand), sans-serif",
              color: activeTab === "register" ? "#C08635" : "#8B7680",
              cursor: isSubmittingForm ? "not-allowed" : "pointer",
              transition: "color 0.2s ease",
            }}
          >
            Đăng ký
          </button>
        </div>

        {/* Sliding Pane Container */}
        <div
          className="modal-scroll-pane"
          style={{
            position: "relative",
            overflow: "hidden",
            width: "100%",
            maxHeight: "calc(100vh - 280px)",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "200%",
              transform: activeTab === "login" ? "translateX(0%)" : "translateX(-50%)",
              transition: "transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* ======================= LOGIN PANE ======================= */}
            <div style={{ width: "50%", padding: "16px 24px 28px", boxSizing: "border-box" }}>
              <form onSubmit={handleLoginSubmit(onLogin)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                
                {/* Email */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "#5A4550" }}>Email</label>
                  <div className="input-group" style={{ position: "relative" }}>
                    <Mail
                      className="input-icon"
                      size={16}
                      style={{
                        position: "absolute",
                        left: 14,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#B7A8AC",
                        transition: "color 0.2s ease",
                      }}
                    />
                    <input
                      type="email"
                      placeholder="tenban@example.com"
                      disabled={isSubmittingForm}
                      {...registerLogin("email")}
                      style={{
                        width: "100%",
                        padding: "12px 14px 12px 42px",
                        borderRadius: 12,
                        border: loginErrors.email ? "1px solid #EF4444" : "1px solid #E5E7EB",
                        backgroundColor: "#FAFAFA",
                        fontSize: 14,
                        outline: "none",
                        boxSizing: "border-box",
                        transition: "all 0.2s ease",
                      }}
                    />
                  </div>
                  {loginErrors.email && (
                    <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 600 }}>{loginErrors.email.message}</span>
                  )}
                </div>

                {/* Mật khẩu */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "#5A4550" }}>Mật khẩu</label>
                  <div className="input-group" style={{ position: "relative" }}>
                    <Lock
                      className="input-icon"
                      size={16}
                      style={{
                        position: "absolute",
                        left: 14,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#B7A8AC",
                        transition: "color 0.2s ease",
                      }}
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      disabled={isSubmittingForm}
                      {...registerLogin("password")}
                      style={{
                        width: "100%",
                        padding: "12px 42px 12px 42px",
                        borderRadius: 12,
                        border: loginErrors.password ? "1px solid #EF4444" : "1px solid #E5E7EB",
                        backgroundColor: "#FAFAFA",
                        fontSize: 14,
                        outline: "none",
                        boxSizing: "border-box",
                        transition: "all 0.2s ease",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: 14,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        color: "#B7A8AC",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {loginErrors.password && (
                    <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 600 }}>{loginErrors.password.message}</span>
                  )}
                </div>

                {/* Extra Options */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#5A4550", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      disabled={isSubmittingForm}
                      {...registerLogin("rememberMe")}
                      style={{
                        accentColor: "#E2A550",
                        width: 15,
                        height: 15,
                        cursor: "pointer",
                      }}
                    />
                    Ghi nhớ đăng nhập
                  </label>
                  <button
                    type="button"
                    onClick={() => toast.info("Tính năng khôi phục mật khẩu đang được phát triển.")}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "#C08635",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Quên mật khẩu?
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmittingForm}
                  style={{
                    width: "100%",
                    padding: 13,
                    borderRadius: 12,
                    background: isSubmittingForm
                      ? "#B7A8AC"
                      : "linear-gradient(135deg, #E2A550 0%, #C08635 100%)",
                    color: "#ffffff",
                    fontSize: 14,
                    fontWeight: 700,
                    border: "none",
                    cursor: isSubmittingForm ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: "0 8px 20px rgba(226, 165, 80, 0.28)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={e => {
                    if (!isSubmittingForm) {
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = "0 10px 24px rgba(226, 165, 80, 0.42)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSubmittingForm) {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 8px 20px rgba(226, 165, 80, 0.28)";
                    }
                  }}
                >
                  {isSubmittingForm ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    "Đăng nhập"
                  )}
                </button>

                {/* Social Login Section */}
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 16px" }}>
                    <div style={{ flex: 1, height: 1, backgroundColor: "#E5E7EB" }} />
                    <span style={{ fontSize: 11, color: "#B7A8AC", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Hoặc tiếp tục với
                    </span>
                    <div style={{ flex: 1, height: 1, backgroundColor: "#E5E7EB" }} />
                  </div>

                  <div style={{ display: "flex", gap: 12 }}>
                    {/* Google */}
                    <button
                      type="button"
                      onClick={() => toast.info("Đăng nhập bằng Google đang được tích hợp.")}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        padding: "10px 16px",
                        border: "1px solid #E5E7EB",
                        borderRadius: 12,
                        backgroundColor: "#ffffff",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#5A4550",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = "#F9FAFB";
                        e.currentTarget.style.borderColor = "#D1D5DB";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = "#ffffff";
                        e.currentTarget.style.borderColor = "#E5E7EB";
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24">
                        <path
                          fill="#EA4335"
                          d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.62 5.62 0 0 1 8.35 12.9a5.62 5.62 0 0 1 5.641-5.614c2.25 0 4.093 1.258 4.981 3.102l3.65-2.127C20.89 4.984 17.525 3 13.99 3c-4.978 0-9 4.029-9 9s4.022 9 9 9c4.8 0 8.01-3.238 8.01-7.854 0-.482-.047-.949-.13-1.396l-9.63.035z"
                        />
                      </svg>
                      Google
                    </button>
                    {/* Facebook */}
                    <button
                      type="button"
                      onClick={() => toast.info("Đăng nhập bằng Facebook đang được tích hợp.")}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        padding: "10px 16px",
                        border: "1px solid #E5E7EB",
                        borderRadius: 12,
                        backgroundColor: "#ffffff",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#5A4550",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = "#F9FAFB";
                        e.currentTarget.style.borderColor = "#D1D5DB";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = "#ffffff";
                        e.currentTarget.style.borderColor = "#E5E7EB";
                      }}
                    >
                      <svg width="18" height="18" fill="#1877F2" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                      Facebook
                    </button>
                  </div>
                </div>

              </form>
            </div>

            {/* ======================= REGISTER PANE ======================= */}
            <div style={{ width: "50%", padding: "16px 24px 28px", boxSizing: "border-box" }}>
              <form onSubmit={handleSignUpSubmit(onRegister)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                
                {/* Họ tên */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "#5A4550" }}>Họ và tên</label>
                  <div className="input-group" style={{ position: "relative" }}>
                    <User
                      className="input-icon"
                      size={16}
                      style={{
                        position: "absolute",
                        left: 14,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#B7A8AC",
                        transition: "color 0.2s ease",
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Nguyễn Văn A"
                      disabled={isSubmittingForm}
                      {...registerSignUp("fullName")}
                      style={{
                        width: "100%",
                        padding: "12px 14px 12px 42px",
                        borderRadius: 12,
                        border: signUpErrors.fullName ? "1px solid #EF4444" : "1px solid #E5E7EB",
                        backgroundColor: "#FAFAFA",
                        fontSize: 14,
                        outline: "none",
                        boxSizing: "border-box",
                        transition: "all 0.2s ease",
                      }}
                    />
                  </div>
                  {signUpErrors.fullName && (
                    <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 600 }}>{signUpErrors.fullName.message}</span>
                  )}
                </div>

                {/* Email */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "#5A4550" }}>Email</label>
                  <div className="input-group" style={{ position: "relative" }}>
                    <Mail
                      className="input-icon"
                      size={16}
                      style={{
                        position: "absolute",
                        left: 14,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#B7A8AC",
                        transition: "color 0.2s ease",
                      }}
                    />
                    <input
                      type="email"
                      placeholder="tenban@example.com"
                      disabled={isSubmittingForm}
                      {...registerSignUp("email")}
                      style={{
                        width: "100%",
                        padding: "12px 14px 12px 42px",
                        borderRadius: 12,
                        border: signUpErrors.email ? "1px solid #EF4444" : "1px solid #E5E7EB",
                        backgroundColor: "#FAFAFA",
                        fontSize: 14,
                        outline: "none",
                        boxSizing: "border-box",
                        transition: "all 0.2s ease",
                      }}
                    />
                  </div>
                  {signUpErrors.email && (
                    <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 600 }}>{signUpErrors.email.message}</span>
                  )}
                </div>

                {/* Mật khẩu */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "#5A4550" }}>Mật khẩu</label>
                  <div className="input-group" style={{ position: "relative" }}>
                    <Lock
                      className="input-icon"
                      size={16}
                      style={{
                        position: "absolute",
                        left: 14,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#B7A8AC",
                        transition: "color 0.2s ease",
                      }}
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      disabled={isSubmittingForm}
                      {...registerSignUp("password")}
                      style={{
                        width: "100%",
                        padding: "12px 42px 12px 42px",
                        borderRadius: 12,
                        border: signUpErrors.password ? "1px solid #EF4444" : "1px solid #E5E7EB",
                        backgroundColor: "#FAFAFA",
                        fontSize: 14,
                        outline: "none",
                        boxSizing: "border-box",
                        transition: "all 0.2s ease",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: 14,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        color: "#B7A8AC",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {signUpErrors.password && (
                    <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 600 }}>{signUpErrors.password.message}</span>
                  )}
                </div>

                {/* Xác nhận mật khẩu */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "#5A4550" }}>Xác nhận mật khẩu</label>
                  <div className="input-group" style={{ position: "relative" }}>
                    <Lock
                      className="input-icon"
                      size={16}
                      style={{
                        position: "absolute",
                        left: 14,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#B7A8AC",
                        transition: "color 0.2s ease",
                      }}
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      disabled={isSubmittingForm}
                      {...registerSignUp("confirmPassword")}
                      style={{
                        width: "100%",
                        padding: "12px 14px 12px 42px",
                        borderRadius: 12,
                        border: signUpErrors.confirmPassword ? "1px solid #EF4444" : "1px solid #E5E7EB",
                        backgroundColor: "#FAFAFA",
                        fontSize: 14,
                        outline: "none",
                        boxSizing: "border-box",
                        transition: "all 0.2s ease",
                      }}
                    />
                  </div>
                  {signUpErrors.confirmPassword && (
                    <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 600 }}>{signUpErrors.confirmPassword.message}</span>
                  )}
                </div>

                {/* Checkbox điều khoản */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      fontSize: 12,
                      color: "#5A4550",
                      cursor: "pointer",
                      lineHeight: "1.4",
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={isSubmittingForm}
                      {...registerSignUp("agreeTerms")}
                      style={{
                        accentColor: "#E2A550",
                        width: 16,
                        height: 16,
                        cursor: "pointer",
                        marginTop: 2,
                      }}
                    />
                    <span>
                      Tôi đồng ý với{" "}
                      <a
                        href="#terms"
                        onClick={e => {
                          e.preventDefault();
                          toast.info("Điều khoản dịch vụ đang được cập nhật.");
                        }}
                        style={{ color: "#C08635", fontWeight: 700, textDecoration: "none" }}
                      >
                        Điều khoản dịch vụ
                      </a>{" "}
                      &{" "}
                      <a
                        href="#privacy"
                        onClick={e => {
                          e.preventDefault();
                          toast.info("Chính sách bảo mật đang được cập nhật.");
                        }}
                        style={{ color: "#C08635", fontWeight: 700, textDecoration: "none" }}
                      >
                        Chính sách bảo mật
                      </a>
                    </span>
                  </label>
                  {signUpErrors.agreeTerms && (
                    <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 600, marginTop: 2 }}>
                      {signUpErrors.agreeTerms.message}
                    </span>
                  )}
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmittingForm}
                  style={{
                    width: "100%",
                    padding: 13,
                    borderRadius: 12,
                    background: isSubmittingForm
                      ? "#B7A8AC"
                      : "linear-gradient(135deg, #E2A550 0%, #C08635 100%)",
                    color: "#ffffff",
                    fontSize: 14,
                    fontWeight: 700,
                    border: "none",
                    cursor: isSubmittingForm ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: "0 8px 20px rgba(226, 165, 80, 0.28)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={e => {
                    if (!isSubmittingForm) {
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = "0 10px 24px rgba(226, 165, 80, 0.42)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSubmittingForm) {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 8px 20px rgba(226, 165, 80, 0.28)";
                    }
                  }}
                >
                  {isSubmittingForm ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    "Đăng ký tài khoản"
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
