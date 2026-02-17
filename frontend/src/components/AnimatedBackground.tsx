import { motion } from "framer-motion";

/** Dark navy/charcoal background – Aqua Emerald glow for financial terminal */
export default function AnimatedBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-0 overflow-hidden transition-colors duration-500 ease-out"
      style={{ background: "var(--page-bg-animated)" }}
    >
      <motion.div
        className="absolute -left-[15%] -top-[15%] h-[55vmax] w-[55vmax] rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, rgba(0, 255, 204, 0.15) 0%, transparent 70%)",
        }}
        animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-[10%] top-[25%] h-[45vmax] w-[45vmax] rounded-full opacity-15"
        style={{
          background: "radial-gradient(circle, rgba(0, 255, 204, 0.2) 0%, transparent 70%)",
        }}
        animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[15%] left-[20%] h-[35vmax] w-[35vmax] rounded-full opacity-12"
        style={{
          background: "radial-gradient(circle, rgba(0, 255, 204, 0.15) 0%, transparent 70%)",
        }}
        animate={{ x: [0, 40, 0], y: [0, -25, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
