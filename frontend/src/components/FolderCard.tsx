import { motion } from "framer-motion";
import { Link } from "react-router-dom";

type Props = {
  to: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  count?: number;
};

export default function FolderCard({ to, title, subtitle, icon, count }: Props) {
  return (
    <Link to={to}>
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="folder-card flex cursor-pointer items-center gap-4 overflow-hidden rounded-[24px] p-5"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
          {icon ?? (
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-800 dark:text-white">{title}</div>
          {subtitle && (
            <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</div>
          )}
        </div>
        {count != null && (
          <div className="flex h-8 min-w-[2rem] items-center justify-center rounded-xl bg-slate-100 px-2 text-sm font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {count}
          </div>
        )}
        <svg className="h-5 w-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </motion.div>
    </Link>
  );
}
