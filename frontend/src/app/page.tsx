'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function HomePage() {
  const [isLeaderLoggedIn, setIsLeaderLoggedIn] = useState(false);
  const [leaderName, setLeaderName] = useState('');

  useEffect(() => {
    // التحقق من تسجيل دخول الليدر
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
    <div className="display-bg min-h-screen flex flex-col items-center justify-center p-8">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-mafia-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-citizen-600/10 rounded-full blur-3xl" />

      {/* Logo & Title */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center mb-12 relative z-10"
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
        className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl relative z-10 mb-8"
      >
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
              انضم للعبة عبر رقم هاتفك
            </p>
          </motion.div>
        </Link>
      </motion.div>

      {/* Leader Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="relative z-10 w-full max-w-2xl"
      >
        <AnimatePresence mode="wait">
          {isLeaderLoggedIn ? (
            <motion.div
              key="leader-card"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.4 }}
            >
              {/* Logged in: Show leader card */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-dark-400 text-sm">
                  مرحباً <span className="text-gold-400 font-bold">{leaderName}</span> 👑
                </p>
                <button
                  onClick={handleLogout}
                  className="text-dark-500 text-xs hover:text-mafia-400 transition-colors"
                >
                  تسجيل خروج
                </button>
              </div>
              <Link href="/leader" className="group block">
                <motion.div
                  whileHover={{ scale: 1.02, y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  className="glass-card p-8 text-center cursor-pointer border-gold-500/30 group-hover:border-gold-500/60 transition-all duration-300 bg-gradient-to-br from-gold-500/5 to-transparent"
                >
                  <div className="text-5xl mb-4">👑</div>
                  <h2 className="text-2xl font-bold mb-2 text-gradient-gold">لوحة الليدر</h2>
                  <p className="text-dark-400 text-sm">
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
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="glass-card px-8 py-3 text-dark-400 hover:text-gold-400 hover:border-gold-500/30 transition-all duration-300 text-sm"
                >
                  🔐 تسجيل دخول الليدر
                </motion.button>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-12 text-dark-600 text-sm relative z-10"
      >
        Phygital Mafia Engine v2.0 • Built with ❤️
      </motion.p>
    </div>
  );
}
