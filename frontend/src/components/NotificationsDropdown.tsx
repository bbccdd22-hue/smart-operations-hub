import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { AdminNotificationItem } from "../lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  notifications: AdminNotificationItem[];
  unreadCount: number;
  markAsRead: (ids: number[]) => Promise<void>;
};

function formatTimeAgo(iso: string, isRTL: boolean): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (isRTL) {
      if (diffMins < 1) return "الآن";
      if (diffMins < 60) return `${diffMins} د`;
      if (diffHours < 24) return `${diffHours} س`;
      if (diffDays < 7) return `${diffDays} يوم`;
    } else {
      if (diffMins < 1) return "Now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
    }
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

export default function NotificationsDropdown({
  open,
  onClose,
  anchorRef,
  notifications,
  unreadCount,
  markAsRead,
}: Props) {
  const { t, i18n } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const isRTL = i18n.language === "ar";
  const latest = notifications.slice(0, 5);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (
        panel &&
        !panel.contains(e.target as Node) &&
        anchor &&
        !anchor.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  const [marking, setMarking] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, right: 0 });

  useLayoutEffect(() => {
    if (!open || !anchorRef?.current) return;
    const anchor = anchorRef.current;
    const rect = anchor.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 8,
      left: rect.left,
      right: rect.right,
    });
  }, [open, anchorRef]);

  const handleMarkAll = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (notifications.length === 0 || marking) return;
    setMarking(true);
    try {
      await markAsRead(notifications.map((n) => n.id));
    } finally {
      setMarking(false);
    }
  };

  if (!open) return null;

  const panelContent = (
    <div
      ref={panelRef}
      className="fixed w-80 max-w-[calc(100vw-2rem)] overflow-hidden shadow-xl"
      style={{
        zIndex: 10050,
        top: position.top,
        left: isRTL ? "auto" : position.left,
        right: isRTL ? window.innerWidth - position.right : "auto",
        borderRadius: 12,
        backdropFilter: "blur(15px)",
        WebkitBackdropFilter: "blur(15px)",
        backgroundColor: "rgba(18, 18, 24, 0.95)",
        border: "1px solid rgba(255,255,255,0.15)",
      }}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">
          {isRTL ? "التنبيهات" : t("notifications")}
        </h3>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAll}
            className="min-h-[44px] min-w-[44px] touch-manipulation px-3 py-2 text-xs font-medium text-emerald-400 transition hover:text-emerald-300 active:text-emerald-200 disabled:opacity-50"
            style={{ touchAction: "manipulation" }}
            disabled={marking}
            aria-label={t("markAllAsRead")}
          >
            {marking ? (isRTL ? "جاري..." : "Marking...") : t("markAllAsRead")}
          </button>
        )}
      </div>
      <div className="max-h-64 overflow-y-auto">
        {latest.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-white/50">
            {isRTL ? "لا توجد تنبيهات" : "No notifications"}
          </div>
        ) : (
          latest.map((n) => (
            <div
              key={n.id}
              className="flex gap-3 border-b border-white/5 px-4 py-3 transition hover:bg-white/5"
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538.214 1.055.595 1.43L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white">{n.title}</div>
                {n.message && (
                  <div className="mt-0.5 line-clamp-2 text-xs text-white/60">{n.message}</div>
                )}
                <div className="mt-1 text-[10px] text-white/40">{formatTimeAgo(n.created_at, isRTL)}</div>
              </div>
            </div>
          ))
        )}
      </div>
      <Link
        to="/admin-hub/notifications"
        onClick={onClose}
        className="block border-t border-white/10 px-4 py-3 text-center text-sm font-medium text-emerald-400 transition hover:bg-white/5 hover:text-emerald-300"
      >
        {isRTL ? "عرض الكل" : t("viewAll")}
      </Link>
    </div>
  );

  return createPortal(panelContent, document.body);
}
