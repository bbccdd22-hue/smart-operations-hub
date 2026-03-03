/**
 * Onboarding Wizard — /signup
 *
 * Step 1: Company info  (اسم الشركة، slug، نوع العلامة التجارية)
 * Step 2: Admin account (username, email, password)
 * Step 3: Plan selection
 * Step 4: Confirm + submit → show success with subdomain URL
 */
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../lib/api";

// ── Plan cards data ──────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "trial",
    label: "تجريبي",
    sublabel: "14 يوم مجاناً",
    price: "0 ر.س",
    branches: 1,
    color: "#6366f1",
    features: ["فرع واحد", "شجرة حسابات افتراضية", "POS + مخزون"],
  },
  {
    id: "starter",
    label: "Starter",
    sublabel: "للمشاريع الصغيرة",
    price: "299 ر.س/شهر",
    branches: 1,
    color: "#22c55e",
    features: ["فرع واحد", "تقارير أساسية", "دعم عبر البريد"],
  },
  {
    id: "growth",
    label: "Growth",
    sublabel: "للتوسع",
    price: "699 ر.س/شهر",
    branches: 5,
    color: "#f59e0b",
    features: ["حتى 5 فروع", "تقارير متقدمة", "دعم أولوية"],
  },
  {
    id: "pro",
    label: "Pro",
    sublabel: "للمطاعم المتعددة",
    price: "1499 ر.س/شهر",
    branches: 20,
    color: "#ef4444",
    features: ["حتى 20 فرع", "BI + تحليلات", "مدير حساب مخصص"],
  },
];

type Step = 1 | 2 | 3 | 4;

interface FormData {
  company_name: string;
  company_name_ar: string;
  tenant_slug: string;
  brand_name: string;
  admin_username: string;
  admin_email: string;
  admin_password: string;
  admin_password_confirm: string;
  plan: string;
}

interface SignupResult {
  tenant: {
    slug: string;
    name: string;
    plan: string;
    subdomain_url: string;
    trial_ends_at: string | null;
  };
  admin_user: { username: string; email: string };
  setup_summary: {
    chart_of_accounts_created: number;
    brand: string;
    main_branch: string;
  };
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 63);
}

export default function SignupPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isRTL = i18n.language === "ar";

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SignupResult | null>(null);

  const [form, setForm] = useState<FormData>({
    company_name: "",
    company_name_ar: "",
    tenant_slug: "",
    brand_name: "",
    admin_username: "",
    admin_email: "",
    admin_password: "",
    admin_password_confirm: "",
    plan: "trial",
  });

  const set = (field: keyof FormData, value: string) =>
    setForm((f) => ({
      ...f,
      [field]: value,
      ...(field === "company_name" && !f.tenant_slug
        ? { tenant_slug: slugify(value) }
        : {}),
    }));

  const validateStep = (): string | null => {
    if (step === 1) {
      if (!form.company_name.trim()) return "أدخل اسم الشركة";
      if (!form.tenant_slug.trim()) return "أدخل subdomain للشركة";
      if (!/^[a-z0-9-]+$/.test(form.tenant_slug))
        return "الـ subdomain يجب أن يحتوي فقط على أحرف إنجليزية صغيرة وأرقام وشرطات";
    }
    if (step === 2) {
      if (!form.admin_username.trim()) return "أدخل اسم المستخدم";
      if (!form.admin_email.trim()) return "أدخل البريد الإلكتروني";
      if (form.admin_password.length < 8) return "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
      if (form.admin_password !== form.admin_password_confirm)
        return "كلمتا المرور غير متطابقتين";
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => (s + 1) as Step);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        company_name: form.company_name,
        company_name_ar: form.company_name_ar || form.company_name,
        tenant_slug: form.tenant_slug,
        brand_name: form.brand_name || form.company_name,
        admin_username: form.admin_username,
        admin_email: form.admin_email,
        admin_password: form.admin_password,
        plan: form.plan,
      };
      const res = await api.post("/onboarding/signup/", payload);
      setResult(res.data);
      setStep(4);
    } catch (e: unknown) {
      const axErr = e as { response?: { data?: Record<string, unknown> } };
      const data = axErr?.response?.data;
      if (data && typeof data === "object") {
        const msgs = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
          .join(" | ");
        setError(msgs);
      } else {
        setError("حدث خطأ أثناء إنشاء الحساب. حاول مرة أخرى.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1rem",
    direction: isRTL ? "rtl" : "ltr",
    fontFamily: "'Segoe UI', Tahoma, sans-serif",
  };

  const cardStyle: React.CSSProperties = {
    background: "#1e293b",
    borderRadius: "1.5rem",
    boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
    width: "100%",
    maxWidth: 580,
    overflow: "hidden",
  };

  const headerStyle: React.CSSProperties = {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    padding: "2rem 2.5rem 1.5rem",
    color: "white",
  };

  const bodyStyle: React.CSSProperties = {
    padding: "2rem 2.5rem",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.75rem 1rem",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "0.75rem",
    color: "#f1f5f9",
    fontSize: "0.95rem",
    outline: "none",
    boxSizing: "border-box",
    marginBottom: "0.25rem",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    color: "#94a3b8",
    fontSize: "0.8rem",
    marginBottom: "0.4rem",
    marginTop: "1rem",
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  const btnPrimary: React.CSSProperties = {
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "white",
    border: "none",
    borderRadius: "0.75rem",
    padding: "0.85rem 2rem",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: loading ? "not-allowed" : "pointer",
    opacity: loading ? 0.7 : 1,
    width: "100%",
    marginTop: "1.5rem",
  };

  const btnSecondary: React.CSSProperties = {
    background: "transparent",
    color: "#94a3b8",
    border: "1px solid #334155",
    borderRadius: "0.75rem",
    padding: "0.75rem 1.5rem",
    fontSize: "0.9rem",
    cursor: "pointer",
    marginTop: "0.75rem",
    width: "100%",
  };

  const STEP_LABELS = ["معلومات الشركة", "حساب المدير", "خطة الاشتراك", "تأكيد"];

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <span style={{ fontSize: "1.8rem" }}>⚡</span>
            <span style={{ fontSize: "1.3rem", fontWeight: 700 }}>Smart Operations Hub</span>
          </div>
          <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>
            {step === 4 ? "🎉 تم إنشاء حسابك!" : "إنشاء حساب جديد"}
          </h2>
          {step !== 4 && (
            <p style={{ margin: "0.5rem 0 0", opacity: 0.8, fontSize: "0.9rem" }}>
              الخطوة {step} من 3 — {STEP_LABELS[step - 1]}
            </p>
          )}
        </div>

        {/* Progress bar */}
        {step !== 4 && (
          <div style={{ background: "#0f172a", height: 4 }}>
            <div
              style={{
                background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
                height: "100%",
                width: `${(step / 3) * 100}%`,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        )}

        <div style={bodyStyle}>
          {/* Error banner */}
          {error && (
            <div
              style={{
                background: "#7f1d1d",
                border: "1px solid #ef4444",
                borderRadius: "0.75rem",
                padding: "0.75rem 1rem",
                color: "#fca5a5",
                fontSize: "0.88rem",
                marginBottom: "1rem",
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* ── Step 1: Company info ──────────────────────────────────────── */}
          {step === 1 && (
            <>
              <label style={labelStyle}>اسم الشركة (إنجليزي) *</label>
              <input
                style={inputStyle}
                placeholder="My Restaurant Group"
                value={form.company_name}
                onChange={(e) => set("company_name", e.target.value)}
              />

              <label style={labelStyle}>اسم الشركة (عربي)</label>
              <input
                style={inputStyle}
                placeholder="مجموعة مطاعمي"
                value={form.company_name_ar}
                onChange={(e) => set("company_name_ar", e.target.value)}
              />

              <label style={labelStyle}>Subdomain (رابطك الخاص) *</label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                  placeholder="my-restaurant"
                  value={form.tenant_slug}
                  onChange={(e) => set("tenant_slug", slugify(e.target.value))}
                />
                <span style={{ color: "#64748b", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                  .smartops.com
                </span>
              </div>
              <p style={{ color: "#64748b", fontSize: "0.78rem", margin: "0.25rem 0 0" }}>
                رابطك: {form.tenant_slug || "…"}.smartops.com
              </p>

              <label style={labelStyle}>اسم العلامة التجارية (اختياري)</label>
              <input
                style={inputStyle}
                placeholder="مثل: بيت البرجر"
                value={form.brand_name}
                onChange={(e) => set("brand_name", e.target.value)}
              />

              <button style={btnPrimary} onClick={handleNext}>
                التالي ←
              </button>
            </>
          )}

          {/* ── Step 2: Admin account ─────────────────────────────────────── */}
          {step === 2 && (
            <>
              <label style={labelStyle}>اسم المستخدم *</label>
              <input
                style={inputStyle}
                placeholder="admin"
                value={form.admin_username}
                onChange={(e) => set("admin_username", e.target.value)}
                autoComplete="username"
              />

              <label style={labelStyle}>البريد الإلكتروني *</label>
              <input
                style={inputStyle}
                type="email"
                placeholder="owner@company.com"
                value={form.admin_email}
                onChange={(e) => set("admin_email", e.target.value)}
                autoComplete="email"
              />

              <label style={labelStyle}>كلمة المرور * (8 أحرف على الأقل)</label>
              <input
                style={inputStyle}
                type="password"
                placeholder="••••••••"
                value={form.admin_password}
                onChange={(e) => set("admin_password", e.target.value)}
                autoComplete="new-password"
              />

              <label style={labelStyle}>تأكيد كلمة المرور *</label>
              <input
                style={inputStyle}
                type="password"
                placeholder="••••••••"
                value={form.admin_password_confirm}
                onChange={(e) => set("admin_password_confirm", e.target.value)}
                autoComplete="new-password"
              />

              <button style={btnPrimary} onClick={handleNext}>
                التالي ←
              </button>
              <button style={btnSecondary} onClick={() => { setError(null); setStep(1); }}>
                → السابق
              </button>
            </>
          )}

          {/* ── Step 3: Plan selection ────────────────────────────────────── */}
          {step === 3 && (
            <>
              <p style={{ color: "#94a3b8", margin: "0 0 1.25rem", fontSize: "0.9rem" }}>
                اختر خطة الاشتراك المناسبة. يمكنك الترقية في أي وقت.
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.75rem",
                }}
              >
                {PLANS.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => set("plan", plan.id)}
                    style={{
                      border: `2px solid ${form.plan === plan.id ? plan.color : "#334155"}`,
                      borderRadius: "1rem",
                      padding: "1rem",
                      cursor: "pointer",
                      background: form.plan === plan.id ? `${plan.color}1a` : "transparent",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: plan.color, fontSize: "1rem" }}>
                      {plan.label}
                    </div>
                    <div style={{ color: "#64748b", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
                      {plan.sublabel}
                    </div>
                    <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: "1.1rem" }}>
                      {plan.price}
                    </div>
                    <ul style={{ margin: "0.5rem 0 0", padding: "0 1rem", color: "#94a3b8", fontSize: "0.78rem" }}>
                      {plan.features.map((f) => (
                        <li key={f} style={{ marginBottom: "0.2rem" }}>
                          ✓ {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <button style={btnPrimary} onClick={handleSubmit} disabled={loading}>
                {loading ? "جارٍ الإنشاء..." : "🚀 إنشاء حسابي الآن"}
              </button>
              <button style={btnSecondary} onClick={() => { setError(null); setStep(2); }}>
                → السابق
              </button>
            </>
          )}

          {/* ── Step 4: Success ───────────────────────────────────────────── */}
          {step === 4 && result && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🎉</div>
              <h3 style={{ color: "#f1f5f9", marginBottom: "0.5rem" }}>
                مرحباً بك في Smart Operations Hub!
              </h3>
              <p style={{ color: "#94a3b8", marginBottom: "1.5rem" }}>
                تم إنشاء حسابك بنجاح. إليك ملخص الإعداد:
              </p>

              <div
                style={{
                  background: "#0f172a",
                  borderRadius: "1rem",
                  padding: "1.25rem",
                  textAlign: "start",
                  marginBottom: "1.5rem",
                }}
              >
                <Row label="الشركة" value={result.tenant.name} />
                <Row
                  label="رابطك الخاص"
                  value={result.tenant.subdomain_url}
                  highlight
                />
                <Row label="الخطة" value={result.tenant.plan} />
                <Row
                  label="شجرة الحسابات"
                  value={`${result.setup_summary.chart_of_accounts_created} حساب محاسبي`}
                />
                <Row label="العلامة التجارية" value={result.setup_summary.brand} />
                <Row label="الفرع الأول" value={result.setup_summary.main_branch} />
                <Row label="المستخدم" value={result.admin_user.username} />
                {result.tenant.trial_ends_at && (
                  <Row
                    label="تنتهي التجربة"
                    value={new Date(result.tenant.trial_ends_at).toLocaleDateString("ar")}
                  />
                )}
              </div>

              <button
                style={btnPrimary}
                onClick={() => navigate("/login")}
              >
                تسجيل الدخول الآن →
              </button>
            </div>
          )}

          {/* Footer link */}
          {step !== 4 && (
            <p style={{ textAlign: "center", color: "#64748b", fontSize: "0.85rem", marginTop: "1.5rem" }}>
              لديك حساب بالفعل؟{" "}
              <Link to="/login" style={{ color: "#6366f1", textDecoration: "none" }}>
                تسجيل الدخول
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "0.5rem 0",
        borderBottom: "1px solid #1e293b",
      }}
    >
      <span style={{ color: "#64748b", fontSize: "0.85rem" }}>{label}</span>
      <span
        style={{
          color: highlight ? "#6366f1" : "#f1f5f9",
          fontSize: "0.85rem",
          fontWeight: highlight ? 700 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}
