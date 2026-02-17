import { motion } from "framer-motion";

/** iOS 17-style liquid glassmorphism background. Light: soft translucent; Dark: deep vibrant blobs. */
export default function AnimatedBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-0 overflow-hidden transition-colors duration-[400ms] ease-out"
      style={{ background: "var(--page-bg-animated)" }}
    >
      {/* Light mode: subtle ambient orbs */}
      <motion.div
        className="absolute -left-[20%] -top-[20%] h-[60vmax] w-[60vmax] rounded-full opacity-20 dark:opacity-30"
        style={{
          background:
            "radial-gradient(circle, rgba(124, 58, 237, 0.25) 0%, transparent 70%)",
        }}
        animate={{ x: [0, 80, 0], y: [0, 60, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-[15%] top-[20%] h-[50vmax] w-[50vmax] rounded-full opacity-15 dark:opacity-25"
        style={{
          background:
            "radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)",
        }}
        animate={{ x: [0, -60, 0], y: [0, -40, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[10%] left-[30%] h-[40vmax] w-[40vmax] rounded-full opacity-12 dark:opacity-20"
        style={{
          background:
            "radial-gradient(circle, rgba(34, 197, 94, 0.2) 0%, transparent 70%)",
        }}
        animate={{ x: [0, 50, 0], y: [0, -30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[25%] -bottom-[10%] h-[45vmax] w-[45vmax] rounded-full opacity-15 dark:opacity-20"
        style={{
          background:
            "radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%)",
        }}
        animate={{ x: [0, -40, 0], y: [0, 50, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
