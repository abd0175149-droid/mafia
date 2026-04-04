'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="display-bg min-h-screen flex flex-col items-center justify-center p-8">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-mafia-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-citizen-600/10 rounded-full blur-3xl" />

      {/* Logo & Title */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center mb-16 relative z-10"
      >
        <motion.div
          className="text-8xl mb-6"
          animate={{ rotate: [0, -5, 5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          🎭
        </motion.div>
        <h1 className="text-5xl md:text-7xl font-black mb-4">
          <span className="text-gradient-mafia">محرك</span>{' '}
          <span className="text-white">المافيا</span>{' '}
          <span className="text-gradient-citizen">الهجين</span>
        </h1>
        <p className="text-dark-400 text-xl font-light max-w-xl mx-auto">
          نظام متطور لإدارة ألعاب المافيا • يدمج بين الواقع والرقمي
        </p>
      </motion.div>

      {/* Role Selection Cards */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl relative z-10"
      >
        {/* Leader Card */}
        <Link href="/leader" className="group">
          <motion.div
            whileHover={{ scale: 1.03, y: -5 }}
            whileTap={{ scale: 0.98 }}
            className="glass-card p-8 text-center cursor-pointer group-hover:border-gold-500/40 transition-all duration-300"
          >
            <div className="text-5xl mb-4">👑</div>
            <h2 className="text-2xl font-bold mb-2 text-gradient-gold">الليدر</h2>
            <p className="text-dark-400 text-sm">
              إدارة اللعبة والتحكم بالمراحل
            </p>
          </motion.div>
        </Link>

        {/* Display Card */}
        <Link href="/display" className="group">
          <motion.div
            whileHover={{ scale: 1.03, y: -5 }}
            whileTap={{ scale: 0.98 }}
            className="glass-card p-8 text-center cursor-pointer group-hover:border-mafia-500/40 transition-all duration-300"
          >
            <div className="text-5xl mb-4">🖥️</div>
            <h2 className="text-2xl font-bold mb-2 text-gradient-mafia">شاشة العرض</h2>
            <p className="text-dark-400 text-sm">
              العرض السينمائي للجمهور
            </p>
          </motion.div>
        </Link>

        {/* Player Card */}
        <Link href="/player" className="group">
          <motion.div
            whileHover={{ scale: 1.03, y: -5 }}
            whileTap={{ scale: 0.98 }}
            className="glass-card p-8 text-center cursor-pointer group-hover:border-citizen-500/40 transition-all duration-300"
          >
            <div className="text-5xl mb-4">📱</div>
            <h2 className="text-2xl font-bold mb-2 text-gradient-citizen">اللاعب</h2>
            <p className="text-dark-400 text-sm">
              مسح QR والتسجيل
            </p>
          </motion.div>
        </Link>
      </motion.div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-16 text-dark-600 text-sm relative z-10"
      >
        Phygital Mafia Engine v1.0 • Built with ❤️
      </motion.p>
    </div>
  );
}
