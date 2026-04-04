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
    <div className="display-bg min-h-screen flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden font-arabic selection:bg-[#8A0303] selection:text-white">
      
      {/* ── Logo & Title (Noir Style) ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-16 relative z-10 w-full max-w-4xl"
      >
        <div className="absolute top-[-50%] left-1/2 -translate-x-1/2 w-64 h-64 bg-[#8A0303] rounded-full blur-[150px] opacity-20 pointer-events-none" />
        
        <h1 className="text-7xl md:text-9xl font-black mb-6 tracking-tighter mix-blend-screen" style={{ fontFamily: 'Amiri, serif' }}>
          <span className="text-[#8A0303] tracking-normal drop-shadow-[0_5px_15px_rgba(138,3,3,0.5)]">المافيا</span>
        </h1>
        <div className="h-[1px] w-32 bg-gradient-to-r from-transparent via-[#C5A059] to-transparent mx-auto mb-6 opacity-60" />
        <p className="text-[#a0a0a0] text-xl font-light uppercase tracking-[0.3em] font-mono">
          Phygital Engine
        </p>
      </motion.div>

      {/* ── Core Navigation Cards ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl relative z-10 mb-16"
      >
        {/* Display Card */}
        <Link href="/display" className="group block h-full">
          <motion.div
            className="noir-card-hover h-full p-12 text-center flex flex-col items-center justify-center border-b-4 border-b-[#2a2a2a] group-hover:border-b-[#8A0303]"
          >
            <div className="text-6xl mb-6 grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500">👁️</div>
            <h2 className="text-3xl font-black mb-3 text-white tracking-widest uppercase" style={{ fontFamily: 'Amiri, serif' }}>شاشة العرض</h2>
            <p className="text-[#808080] text-sm tracking-wide">
              واجهة المراقبة والاستجواب
            </p>
          </motion.div>
        </Link>

        {/* Player Card */}
        <Link href="/player" className="group block h-full">
          <motion.div
            className="noir-card-hover h-full p-12 text-center flex flex-col items-center justify-center border-b-4 border-b-[#2a2a2a] group-hover:border-b-[#C5A059]"
          >
            <div className="text-6xl mb-6 grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500">🎭</div>
            <h2 className="text-3xl font-black mb-3 text-white tracking-widest uppercase" style={{ fontFamily: 'Amiri, serif' }}>بطاقة اللاعب</h2>
            <p className="text-[#808080] text-sm tracking-wide">
              تسجيل الدخول للهوية السرية
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex items-center justify-between mb-4 px-2 border-b border-[#2a2a2a] pb-3">
                <p className="text-[#808080] text-sm font-mono uppercase tracking-widest">
                  Agent: <span className="text-[#C5A059] font-bold">{leaderName}</span>
                </p>
                <button
                  onClick={handleLogout}
                  className="text-[#555] text-xs hover:text-[#8A0303] transition-colors uppercase tracking-widest font-bold"
                >
                  (تسجيل الخروج)
                </button>
              </div>
              <Link href="/leader" className="group block">
                <motion.div
                  className="noir-card-hover py-8 text-center border-[#C5A059]/20"
                >
                  <h2 className="text-2xl font-bold mb-2 text-[#C5A059] tracking-widest uppercase" style={{ fontFamily: 'Amiri, serif' }}>
                    غرفة العمليات (الليدر)
                  </h2>
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
                <button
                  className="btn-ghost px-10 py-5 text-sm uppercase tracking-[0.2em]"
                >
                  وصول الإدارة (Restricted)
                </button>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Footer ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1 }}
        className="absolute bottom-8 left-0 w-full text-center z-10 pointer-events-none"
      >
        <div className="h-[1px] w-24 bg-[#2a2a2a] mx-auto mb-4" />
        <p className="text-[#444] text-[10px] tracking-[0.4em] font-mono uppercase">
          Classified • Mafia Engine v2.0
        </p>
      </motion.div>
    </div>
  );
}
