import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import {
  fetchAdminNotifications,
  markNotificationsRead,
  type AdminNotificationItem,
} from "../lib/api";

type NotificationContextValue = {
  notifications: AdminNotificationItem[];
  unreadCount: number;
  refresh: () => Promise<void>;
  markAsRead: (ids: number[]) => Promise<void>;
  addToast: (title: string, message?: string) => void;
  toasts: Array<{ id: number; title: string; message?: string }>;
  dismissToast: (id: number) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

let toastId = 0;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [toasts, setToasts] = useState<Array<{ id: number; title: string; message?: string }>>([]);
  const isSAIF = user?.username === "SAIF";
  const isOwner = user?.role === "owner";
  const shouldPoll = isSAIF && isOwner;

  const toastedIdsRef = useRef<Set<number>>(new Set());

  const addToast = useCallback((title: string, message?: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const refresh = useCallback(async () => {
    if (!shouldPoll) return;
    try {
      const list = await fetchAdminNotifications(20);
      const newOnes = list.filter((n) => !toastedIdsRef.current.has(n.id));
      newOnes.forEach((n) => {
        toastedIdsRef.current.add(n.id);
        addToast(n.title, n.message);
      });
      setNotifications(list);
    } catch {
      setNotifications([]);
    }
  }, [shouldPoll, addToast]);

  const markAsRead = useCallback(async (ids: number[]) => {
    if (!ids.length) return;
    try {
      await markNotificationsRead(ids);
      setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)));
    } catch (err) {
      addToast(err instanceof Error ? err.message : "فشل في تعليم التنبيهات كمقروءة");
    }
  }, [addToast]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (!shouldPoll) return;
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [shouldPoll, refresh]);

  const value: NotificationContextValue = {
    notifications,
    unreadCount: notifications.length,
    refresh,
    markAsRead,
    addToast,
    toasts,
    dismissToast,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  return ctx;
}
