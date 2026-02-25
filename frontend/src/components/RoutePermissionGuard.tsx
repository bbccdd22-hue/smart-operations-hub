/**
 * منع الوصول للروابط المباشرة عند عدم وجود الصلاحية
 */
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import type { UserPermissions } from "../contexts/AuthContext";

const PATH_PERM: Record<string, string> = {
  "/shift-closing": "perm_shift_closing",
  "/finance": "perm_financial_reports",
  "/finance/auditor": "perm_financial_auditor",
  "/admin-hub": "perm_full_system_access",
  "/forecast": "perm_order_forecasting",
  "/prep-list": "perm_order_forecasting",
  "/": "perm_management_reports",
  "/dashboard": "perm_management_reports",
  "/dashboard/heartbeat": "perm_management_reports",
  "/finance/cost-audit": "perm_financial_auditor",
  "/finance/manual-adjustments": "perm_financial_auditor",
  "/stock-transfers": "perm_management_reports",
};

function getPathPermission(path: string): string | null {
  if (PATH_PERM[path]) return PATH_PERM[path];
  if (path.startsWith("/finance/")) return "perm_financial_reports";
  if (path.startsWith("/admin-hub")) return "perm_full_system_access";
  if (path.startsWith("/dashboard")) return "perm_management_reports";
  return null;
}

type Props = {
  children: ReactNode;
  permissions?: UserPermissions | null;
  isSAIF: boolean;
};

export default function RoutePermissionGuard({ children, permissions, isSAIF }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  useEffect(() => {
    if (isSAIF || !permissions) return;
    const permKey = getPathPermission(path);
    if (permKey && !permissions[permKey as keyof UserPermissions]) {
      navigate("/", { replace: true });
    }
  }, [path, permissions, isSAIF, navigate]);

  return <>{children}</>;
}
