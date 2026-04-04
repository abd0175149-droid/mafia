'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function HomePage() {
  const [isLeaderLoggedIn, setIsLeaderLoggedIn] = useState(false);
  const [leaderName, setLeaderName] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('leader_token');
    if (token) {
      fetch('/api/leader/verify', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(data => {
          if (data.valid) {
            setIsLeaderLoggedIn(true);
            setLeaderName(data.displayName);
          } else {
            localStorage.removeItem('leader_token');
          }
        })
        .catch(() => {
          localStorage.removeItem('leader_token');
        });
    }
  }, []);

  const handleLogout = () => {
    const token = localStorage.getItem('leader_token');
    if (token) {
      fetch('/api/leader/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    localStorage.removeItem('leader_token');
    localStorage.removeItem('leader_name');
    setIsLeaderLoggedIn(false);
    setLeaderName('');
  };

  return (
    <div className="display-bg min-h-screen flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden font-arabic">
      
      {/* ── Cinematic Ambient Lighting ── */}
      <div className="ambient-sphere w-[600px] h-[600px] bg-mafia-600/20 top-[-20%] left-[-10%] animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="ambient-sphere w-[800px] h-[800px] bg-citizen-600/10 bottom-[-30%] right-[-10%] animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
      <div className="ambient-sphere w-[400px] h-[400px] bg-gold-500/10 top-[20%] left-[50%] -translate-x-1/2" />

      {/* ── Logo & Title ── */}
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className="text-center mb-16 relative z-10"
      >
        <motion.div
          className="text-9xl mb-6 drop-shadow-2xl"
          animate={{ y: [-10, 10, -10] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          🎭
        </motion.div>
        <h1 className="text-6xl md:text-8xl font-black mb-4 tracking-tight drop-shadow-2xl">
          <span className="text-gradient-mafia">محرك</span>{' '}
          <span className="text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">المافيا</span>{' '}
          <span className="text-gradient-citizen">الهجين</span>
        </h1>
        <p className="text-dark-300 text-xl font-light max-w-2xl mx-auto tracking-wide">
          نظام متطور لإدارة ألعاب المافيا • يدمج بين الواقع والرقمي
        </p>
      </motion.div>

      {/* ── Core Navigation Cards ── */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
        className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl relative z-10 mb-12"
      >
        {/* Display Card */}
        <Link href="/display" className="group block h-full">
          <motion.div
            className="glass-card-hover h-full p-10 text-center flex flex-col items-center justify-center border-mafia-500/10 group-hover:bg-mafia-950/40"
          >
            <div className="text-7xl mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 drop-shadow-2xl">🖥️</div>
            <h2 className="text-3xl font-black mb-3 text-gradient-mafia tracking-wide">شاشة العرض</h2>
            <p className="text-dark-400 text-base">
              العرض السينمائي للجمهور
            </p>
          </motion.div>
        </Link>

        {/* Player Card */}
        <Link href="/player" className="group block h-full">
          <motion.div
            className="glass-card-hover h-full p-10 text-center flex flex-col items-center justify-center border-citizen-500/10 group-hover:bg-citizen-950/40"
          >
            <div className="text-7xl mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3 drop-shadow-2xl">📱</div>
            <h2 className="text-3xl font-black mb-3 text-gradient-citizen tracking-wide">اللاعب</h2>
            <p className="text-dark-400 text-base">
              انضم للعبة عبر رقم هاتفك
            </p>
          </motion.div>
        </Link>
      </motion.div>

      {/* ── Leader Section ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.6 }}
        className="relative z-10 w-full max-w-xl"
      >
        <AnimatePresence mode="wait">
          {isLeaderLoggedIn ? (
            <motion.div
              key="leader-card"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <div className="flex items-center justify-between mb-4 px-2">
                <p className="text-dark-300 text-sm">
                  مرحباً <span className="text-gold-400 font-bold">{leaderName}</span> 👑
                </p>
                <button
                  onClick={handleLogout}
                  className="text-dark-500 text-xs hover:text-mafia-400 transition-colors uppercase tracking-wider font-bold"
                >
                  تسجيل خروج
                </button>
              </div>
              <Link href="/leader" className="group block">
                <motion.div
                  className="glass-card-hover p-8 py-10 text-center border-gold-500/20 group-hover:border-gold-500/40 bg-gradient-to-br from-gold-500/10 to-transparent"
                >
                  <div className="text-6xl mb-4 transition-transform duration-500 group-hover:scale-110 drop-shadow-2xl">👑</div>
                  <h2 className="text-3xl font-black mb-2 text-gradient-gold tracking-wide">لوحة الليدر</h2>
                  <p className="text-dark-300 text-sm">
                    إنشاء وإدارة الألعاب
                  </p>
                </motion.div>
              </Link>
            </motion.div>
          ) : (
            <motion.div
              key="login-btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <Link href="/leader/login">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 rounded-2xl bg-dark-800/50 backdrop-blur-md border border-white/5 text-dark-400 hover:text-gold-400 hover:bg-dark-800 hover:border-gold-500/30 transition-all duration-300 text-sm font-bold tracking-wider"
                >
                  🔐 تسجيل دخول الليدر
                </motion.button>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Footer ── */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1 }}
        className="absolute bottom-6 text-dark-600 text-xs tracking-widest font-mono uppercase z-10"
      >
        Phygital Mafia Engine v2.0 • Built with ❤️
      </motion.p>
    </div>
  );
}
