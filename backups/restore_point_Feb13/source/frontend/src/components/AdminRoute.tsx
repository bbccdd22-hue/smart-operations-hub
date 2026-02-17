import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

type Props = {
  children: React.ReactNode;
};

/** Admin Hub is for SAIF only. Redirect non-SAIF or non-owner to Shift Closing. */
export default function AdminRoute({ children }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const isSAIF = user?.username?.toLowerCase() === "saif";
  const isOwner = user?.role === "owner";

  if (!user || !isSAIF || !isOwner) {
    return <Navigate to="/shift-closing" replace />;
  }

  return <>{children}</>;
}
