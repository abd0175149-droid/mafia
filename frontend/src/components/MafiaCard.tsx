'use client';

import React, { useState } from 'react';
import { Role, ROLE_NAMES, isMafiaRole } from '@/lib/constants';

// ══════════════════════════════════════════════════════
// 🎴 MafiaCard — كارد اللاعب الموحد (Unified Player Card)
// حالتين: السرية (الوجه) والكشف (الخلف)
// يُستخدم في كل مكان يظهر فيه كارد لاعب
// ══════════════════════════════════════════════════════

// ── أنماط الأدوار (Theme per Role) ────────────────

interface RoleTheme {
  gradient: string;
  border: string;
  text: string;
  glow: string;
  icon: React.ReactNode;
  teamBadge: string;
  teamColor: string;
}

const ROLE_SVG_ICONS: Record<string, React.ReactNode> = {
  // ── المواطنون (Cool Tones) ──
  USER: (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  HEART_PULSE: (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>
    </svg>
  ),
  SHIELD: (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  ),
  SYRINGE: (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/>
      <path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/>
    </svg>
  ),
  CROSSHAIR: (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/>
      <line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>
    </svg>
  ),
  BADGE: (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
      <line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
    </svg>
  ),
  // ── المافيا (Warm/Danger Tones) ──
  SKULL: (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>
      <path d="M8 20v2h8v-2"/><path d="m12.5 17-.5-1-.5 1h1z"/>
      <path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/>
    </svg>
  ),
  CROWN: (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/>
      <path d="M5 21h14"/>
    </svg>
  ),
  VENETIAN_MASK: (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12a5 5 0 0 0 5 5 8 8 0 0 1 5 2 8 8 0 0 1 5-2 5 5 0 0 0 5-5V7h-5a8 8 0 0 0-5 2 8 8 0 0 0-5-2H2Z"/>
      <path d="M6 11c1.5 0 3 .5 3 2-2 0-3 0-3-2Z"/><path d="M18 11c-1.5 0-3 .5-3 2 2 0 3 0 3-2Z"/>
    </svg>
  ),
  SCISSORS: (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/>
      <path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/>
      <path d="M14.8 14.8 20 20"/>
    </svg>
  ),
};

function getRoleTheme(role: Role | string | null): RoleTheme {
  const r = role as Role;
  switch (r) {
    // ── المواطنون ──
    case Role.CITIZEN:
      return {
        gradient: 'from-zinc-700 via-zinc-800 to-zinc-900',
        border: 'border-zinc-500/60',
        text: 'text-zinc-300',
        glow: 'shadow-[0_0_30px_rgba(161,161,170,0.15)]',
        icon: ROLE_SVG_ICONS.USER,
        teamBadge: 'فريق المدينة 🔵',
        teamColor: 'bg-blue-900/60 text-blue-300 border-blue-500/30',
      };
    case Role.DOCTOR:
      return {
        gradient: 'from-emerald-800 via-emerald-900 to-green-950',
        border: 'border-emerald-500/60',
        text: 'text-emerald-300',
        glow: 'shadow-[0_0_30px_rgba(52,211,153,0.2)]',
        icon: ROLE_SVG_ICONS.HEART_PULSE,
        teamBadge: 'فريق المدينة 🔵',
        teamColor: 'bg-blue-900/60 text-blue-300 border-blue-500/30',
      };
    case Role.SHERIFF:
      return {
        gradient: 'from-blue-800 via-blue-900 to-blue-950',
        border: 'border-blue-500/60',
        text: 'text-blue-300',
        glow: 'shadow-[0_0_30px_rgba(96,165,250,0.2)]',
        icon: ROLE_SVG_ICONS.SHIELD,
        teamBadge: 'فريق المدينة 🔵',
        teamColor: 'bg-blue-900/60 text-blue-300 border-blue-500/30',
      };
    case Role.NURSE:
      return {
        gradient: 'from-teal-800 via-teal-900 to-teal-950',
        border: 'border-teal-500/60',
        text: 'text-teal-300',
        glow: 'shadow-[0_0_30px_rgba(94,234,212,0.2)]',
        icon: ROLE_SVG_ICONS.SYRINGE,
        teamBadge: 'فريق المدينة 🔵',
        teamColor: 'bg-blue-900/60 text-blue-300 border-blue-500/30',
      };
    case Role.SNIPER:
      return {
        gradient: 'from-cyan-800 via-cyan-900 to-cyan-950',
        border: 'border-cyan-500/60',
        text: 'text-cyan-300',
        glow: 'shadow-[0_0_30px_rgba(103,232,249,0.2)]',
        icon: ROLE_SVG_ICONS.CROSSHAIR,
        teamBadge: 'فريق المدينة 🔵',
        teamColor: 'bg-blue-900/60 text-blue-300 border-blue-500/30',
      };
    case Role.POLICEWOMAN:
      return {
        gradient: 'from-indigo-800 via-indigo-900 to-indigo-950',
        border: 'border-indigo-500/60',
        text: 'text-indigo-300',
        glow: 'shadow-[0_0_30px_rgba(129,140,248,0.2)]',
        icon: ROLE_SVG_ICONS.BADGE,
        teamBadge: 'فريق المدينة 🔵',
        teamColor: 'bg-blue-900/60 text-blue-300 border-blue-500/30',
      };

    // ── المافيا ──
    case Role.MAFIA_REGULAR:
      return {
        gradient: 'from-red-800 via-red-900 to-red-950',
        border: 'border-red-500/60',
        text: 'text-red-300',
        glow: 'shadow-[0_0_30px_rgba(248,113,113,0.25)]',
        icon: ROLE_SVG_ICONS.SKULL,
        teamBadge: 'فريق المافيا 🔴',
        teamColor: 'bg-red-900/60 text-red-300 border-red-500/30',
      };
    case Role.GODFATHER:
      return {
        gradient: 'from-amber-800 via-amber-900 to-yellow-950',
        border: 'border-amber-400/60',
        text: 'text-amber-300',
        glow: 'shadow-[0_0_40px_rgba(251,191,36,0.25)]',
        icon: ROLE_SVG_ICONS.CROWN,
        teamBadge: 'فريق المافيا 🔴',
        teamColor: 'bg-red-900/60 text-red-300 border-red-500/30',
      };
    case Role.CHAMELEON:
      return {
        gradient: 'from-fuchsia-800 via-fuchsia-900 to-fuchsia-950',
        border: 'border-fuchsia-500/60',
        text: 'text-fuchsia-300',
        glow: 'shadow-[0_0_30px_rgba(232,121,249,0.2)]',
        icon: ROLE_SVG_ICONS.VENETIAN_MASK,
        teamBadge: 'فريق المافيا 🔴',
        teamColor: 'bg-red-900/60 text-red-300 border-red-500/30',
      };
    case Role.SILENCER:
      return {
        gradient: 'from-rose-800 via-rose-900 to-rose-950',
        border: 'border-rose-500/60',
        text: 'text-rose-300',
        glow: 'shadow-[0_0_30px_rgba(251,113,133,0.2)]',
        icon: ROLE_SVG_ICONS.SCISSORS,
        teamBadge: 'فريق المافيا 🔴',
        teamColor: 'bg-red-900/60 text-red-300 border-red-500/30',
      };

    default:
      return {
        gradient: 'from-zinc-700 via-zinc-800 to-zinc-900',
        border: 'border-zinc-500/40',
        text: 'text-zinc-400',
        glow: '',
        icon: ROLE_SVG_ICONS.USER,
        teamBadge: 'غير معروف',
        teamColor: 'bg-zinc-800 text-zinc-400 border-zinc-600/30',
      };
  }
}

// ── Props Interface ────────────────────────────

export interface MafiaCardProps {
  /** رقم اللاعب الفيزيائي */
  playerNumber: number;
  /** اسم اللاعب */
  playerName: string;
  /** دور اللاعب (null = مجهول) */
  role: Role | string | null;
  /** هل الكارد مقلوب (الدور ظاهر) — controlled mode */
  isFlipped?: boolean;
  /** callback عند الضغط على الكارد */
  onFlip?: () => void;
  /** عدد الأصوات */
  votes?: number;
  /** callback عند الضغط على منطقة التصويت */
  onVote?: (e: React.MouseEvent) => void;
  /** هل يظهر منطقة التصويت */
  showVoting?: boolean;
  /** هل اللاعب حي */
  isAlive?: boolean;
  /** هل اللاعب مسكت */
  isSilenced?: boolean;
  /** الجنس لتمييز الكارد بصرياً */
  gender?: 'MALE' | 'FEMALE';
  /** حجم الكارد */
  size?: 'sm' | 'md' | 'lg';
  /** هل الكارد قابل للقلب */
  flippable?: boolean;
}

// ── Component ────────────────────────────────

export default function MafiaCard({
  playerNumber,
  playerName,
  role,
  isFlipped: controlledFlip,
  onFlip,
  votes = 0,
  onVote,
  showVoting = false,
  isAlive = true,
  isSilenced = false,
  gender = 'MALE',
  size = 'md',
  flippable = true,
}: MafiaCardProps) {
  const [internalFlip, setInternalFlip] = useState(false);
  const isFlipped = controlledFlip !== undefined ? controlledFlip : internalFlip;

  const theme = getRoleTheme(role);
  const roleName = role ? (ROLE_NAMES[role as Role] || role) : 'مجهول';
  const isMafia = role ? isMafiaRole(role as Role) : false;
  const isFemale = gender === 'FEMALE';

  // حجم الكارد
  const sizeClasses = {
    sm: 'w-44 h-[15rem]',
    md: 'w-56 h-[20rem]',
    lg: 'w-64 h-[22rem]',
  }[size];

  const handleCardClick = () => {
    if (!flippable) return;
    if (onFlip) {
      onFlip();
    } else {
      setInternalFlip(prev => !prev);
    }
  };

  const handleVoteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onVote) onVote(e);
  };

  return (
    <div
      className={`${sizeClasses} select-none ${!isAlive ? 'opacity-30 grayscale pointer-events-none' : ''}`}
      style={{ perspective: '1000px' }}
    >
      <div
        onClick={handleCardClick}
        className={`relative w-full h-full transition-transform duration-700 cursor-pointer`}
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* ══════════════════════════════════ */}
        {/* 🂠 الوجه الأمامي (السرية)        */}
        {/* ══════════════════════════════════ */}
        <div
          className={`absolute inset-0 rounded-2xl overflow-hidden border-2 ${
            isFemale ? 'border-purple-500/40' : 'border-[#C5A059]/40'
          } ${isSilenced ? 'border-rose-600/60' : ''}`}
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* خلفية متدرجة */}
          <div className={`absolute inset-0 bg-gradient-to-b ${
            isFemale
              ? 'from-purple-950/80 via-[#0c0c0c] to-black'
              : 'from-zinc-800/50 via-[#0c0c0c] to-black'
          }`} />

          {/* نمط الضوضاء */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* المحتوى */}
          <div className="relative z-10 flex flex-col h-full p-4">

            {/* ── الصف العلوي: الرقم + الشعار ── */}
            <div className="flex items-center justify-between mb-4">
              {/* رقم اللاعب */}
              <div className={`w-12 h-12 border-2 ${
                isFemale ? 'border-purple-400/70 text-purple-300' : 'border-[#C5A059]/70 text-[#C5A059]'
              } flex items-center justify-center font-mono text-xl font-black rounded-lg bg-black/60`}>
                {playerNumber}
              </div>

              {/* شعار النادي */}
              <div className="flex flex-col items-end">
                <span className={`text-[9px] tracking-[0.3em] uppercase font-mono ${
                  isFemale ? 'text-purple-400/60' : 'text-[#C5A059]/60'
                }`}>
                  MAFIA
                </span>
                <span className={`text-[8px] tracking-[0.2em] uppercase font-mono ${
                  isFemale ? 'text-purple-500/40' : 'text-[#C5A059]/40'
                }`}>
                  CLUB
                </span>
              </div>
            </div>

            {/* أيقونة الإسكات */}
            {isSilenced && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-rose-900/80 border border-rose-500/40 px-2 py-0.5 rounded-full">
                <span className="text-[10px] text-rose-300 font-mono tracking-widest">🔇 MUTED</span>
              </div>
            )}

            {/* ── المنتصف: اسم اللاعب ── */}
            <div className="flex-1 flex flex-col items-center justify-center">
              <h2 className={`text-2xl font-black text-white text-center leading-tight mb-3 ${
                size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : ''
              }`} style={{ fontFamily: 'Amiri, serif' }}>
                {playerName}
              </h2>
              <div className={`w-16 h-[2px] ${
                isFemale ? 'bg-purple-400/40' : 'bg-[#C5A059]/40'
              }`} />
              <p className={`mt-2 text-[10px] font-mono tracking-[0.3em] uppercase ${
                isFemale ? 'text-purple-400/50' : 'text-[#C5A059]/50'
              }`}>
                {isFemale ? '♀ OPERATIVE' : '♂ OPERATIVE'}
              </p>
            </div>

            {/* ── القسم السفلي: التصويت ── */}
            {showVoting && (
              <div
                onClick={handleVoteClick}
                className={`relative mt-auto border-t ${
                  isFemale ? 'border-purple-800/40' : 'border-[#2a2a2a]'
                } pt-3 pb-1 cursor-pointer group transition-all duration-300`}
              >
                {/* تأثير الخطر عند وجود أصوات */}
                {votes > 0 && (
                  <div className="absolute inset-0 bg-red-900/20 animate-pulse rounded-b-xl" />
                )}

                <div className="relative z-10 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase group-hover:text-zinc-300 transition-colors">
                    التصويت نهاراً
                  </span>
                  <span className={`font-mono font-black text-2xl transition-all duration-300 ${
                    votes > 0
                      ? 'text-red-500 scale-110 drop-shadow-[0_0_10px_rgba(239,68,68,0.6)]'
                      : 'text-zinc-600 group-hover:text-zinc-400'
                  }`}>
                    {votes}
                  </span>
                </div>
              </div>
            )}

            {/* قاع الكارد إذا لا تصويت */}
            {!showVoting && flippable && (
              <div className="mt-auto text-center">
                <span className="text-[9px] text-zinc-600 font-mono tracking-widest uppercase">
                  اضغط للكشف
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════ */}
        {/* 🂡 الوجه الخلفي (الكشف)          */}
        {/* ══════════════════════════════════ */}
        <div
          className={`absolute inset-0 rounded-2xl overflow-hidden border-2 ${theme.border} ${theme.glow}`}
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {/* خلفية متدرجة حسب الدور */}
          <div className={`absolute inset-0 bg-gradient-to-b ${theme.gradient}`} />

          {/* Shimmer overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent" />

          {/* شارة الفريق */}
          <div className={`absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full border text-[10px] font-mono tracking-widest ${theme.teamColor}`}>
            {theme.teamBadge}
          </div>

          {/* المحتوى */}
          <div className="relative z-10 flex flex-col items-center justify-center h-full p-4 pt-12">
            {/* رقم اللاعب صغير */}
            <div className={`absolute top-3 right-3 w-8 h-8 border ${theme.border} flex items-center justify-center font-mono text-sm font-bold rounded-md bg-black/40 ${theme.text}`}>
              {playerNumber}
            </div>

            {/* دائرة الأيقونة — Glassmorphic */}
            <div className={`w-24 h-24 rounded-full border-2 ${theme.border} flex items-center justify-center mb-5 ${theme.text}`}
              style={{
                background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(12px)',
                boxShadow: isMafia
                  ? '0 0 40px rgba(220, 38, 38, 0.15), inset 0 0 20px rgba(0,0,0,0.3)'
                  : '0 0 40px rgba(100, 200, 255, 0.1), inset 0 0 20px rgba(0,0,0,0.3)',
              }}
            >
              {theme.icon}
            </div>

            {/* اسم الدور */}
            <h3 className={`text-2xl font-black mb-2 ${theme.text} ${
              size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : ''
            }`} style={{ fontFamily: 'Amiri, serif' }}>
              {roleName}
            </h3>

            {/* اسم اللاعب */}
            <p className="text-white/40 text-sm font-mono tracking-widest">
              {playerName}
            </p>

            {/* الخط الفاصل */}
            <div className={`w-20 h-[1px] my-4 ${
              isMafia ? 'bg-red-500/30' : 'bg-blue-500/30'
            }`} />

            {/* نص أسفل */}
            {flippable && (
              <span className="text-[9px] text-zinc-600 font-mono tracking-widest uppercase mt-auto">
                اضغط للإخفاء
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
