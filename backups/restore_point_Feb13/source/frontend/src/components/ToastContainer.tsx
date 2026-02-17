import { useNotifications } from "../contexts/NotificationContext";
import { motion, AnimatePresence } from "framer-motion";

export default function ToastContainer() {
  const ctx = useNotifications();
  if (!ctx || !ctx.toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2" dir="ltr">
      <AnimatePresence>
        {ctx.toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100 }}
            onClick={() => ctx.dismissToast(t.id)}
            className="glass-card cursor-pointer rounded-xl px-4 py-3 shadow-lg"
          >
            <div className="font-medium text-white/95">{t.title}</div>
            {t.message && <div className="mt-1 text-sm text-white/70">{t.message}</div>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
