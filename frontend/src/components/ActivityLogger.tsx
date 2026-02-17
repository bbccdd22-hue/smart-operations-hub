import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { logActivity } from "../lib/api";

/** سجل الرقابة – تسجيل عرض الصفحات تلقائياً */
export default function ActivityLogger() {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (!user || location.pathname === "/login") return;
    logActivity({ action_type: "page_view", page_path: location.pathname });
  }, [location.pathname, user?.id]);

  return null;
}
