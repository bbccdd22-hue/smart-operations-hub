/**
 * Error Boundary – يمنع انهيار الصفحة عند حدوث خطأ (مثل Failed to fetch).
 * يعرض واجهة بديلة مع زر إعادة المحاولة.
 */
import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  onRetry?: () => void;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isNetwork =
        this.state.error?.message === "Failed to fetch" ||
        this.state.error?.message?.toLowerCase().includes("network") ||
        this.state.error?.name === "TypeError";

      const isRTL = typeof document !== "undefined" && document.documentElement.dir === "rtl";
      const title = isNetwork
        ? (isRTL ? "فشل الاتصال" : "Connection Failed")
        : (isRTL ? "حدث خطأ" : "Something went wrong");
      const message = isNetwork
        ? (isRTL ? "تحقق من الاتصال بالشبكة وحاول مرة أخرى." : "Check your network connection and try again.")
        : (this.state.error?.message ?? (isRTL ? "حدث خطأ غير متوقع." : "An unexpected error occurred."));
      const retryLabel = isRTL ? "إعادة المحاولة" : "Retry";

      return (
        <div
          className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-8 dark:border-amber-800 dark:bg-slate-900/80"
          role="alert"
        >
          <div className="text-4xl">⚠️</div>
          <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200">{title}</h3>
          <p className="max-w-md text-center text-sm text-amber-700 dark:text-amber-300">{message}</p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700"
          >
            {retryLabel}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
