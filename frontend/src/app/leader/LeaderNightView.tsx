'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LeaderNightViewProps {
  gameState: any;
  emit: (event: string, payload: any) => Promise<any>;
  setError: (err: string) => void;
}

// أيقونة + لون كل إجراء ليلي
const ACTION_META: Record<string, { icon: string; color: string; bgGlow: string }> = {
  GODFATHER:  { icon: '🔪', color: 'text-[#8A0303]', bgGlow: 'shadow-[0_0_40px_rgba(138,3,3,0.2)]' },
  SILENCER:   { icon: '🤐', color: 'text-[#555]',    bgGlow: 'shadow-[0_0_40px_rgba(85,85,85,0.2)]' },
  SHERIFF:    { icon: '🔍', color: 'text-[#C5A059]', bgGlow: 'shadow-[0_0_40px_rgba(197,160,89,0.2)]' },
  DOCTOR:     { icon: '💉', color: 'text-[#2E5C31]', bgGlow: 'shadow-[0_0_40px_rgba(46,92,49,0.2)]' },
  SNIPER:     { icon: '🎯', color: 'text-[#8A0303]', bgGlow: 'shadow-[0_0_40px_rgba(138,3,3,0.2)]' },
  NURSE:      { icon: '⚕️', color: 'text-[#2E5C31]', bgGlow: 'shadow-[0_0_40px_rgba(46,92,49,0.2)]' },
};

// أيقونة أحداث الصباح
const EVENT_META: Record<string, { icon: string; title: string; color: string; displayable: boolean }> = {
  ASSASSINATION:        { icon: '🩸', title: 'اغتيال ناجح',       color: 'text-[#8A0303]', displayable: true },
  ASSASSINATION_BLOCKED:{ icon: '🛡️', title: 'حماية ناجحة',       color: 'text-[#2E5C31]', displayable: true },
  SNIPE_MAFIA:          { icon: '🎯', title: 'القناص نجح',        color: 'text-[#C5A059]', displayable: true },
  SNIPE_CITIZEN:        { icon: '💀', title: 'القناص فشل',        color: 'text-[#8A0303]', displayable: true },
  SHERIFF_RESULT:       { icon: '🔍', title: 'نتيجة التحقيق',     color: 'text-[#C5A059]', displayable: false },
};

export default function LeaderNightView({ gameState, emit, setError }: LeaderNightViewProps) {
  const [loading, setLoading] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [revealedEvents, setRevealedEvents] = useState<Set<number>>(new Set());
  // Overlay مستقل لنتيجة الشريف — يبقى حتى يُغلق يدوياً
  const [sheriffOverlay, setSheriffOverlay] = useState<any>(null);

  // تصفير الاختيار عند تغير الخطوة
  useEffect(() => {
    setSelectedTarget(null);
  }, [gameState.nightStep?.role]);

  // تصفير الأحداث المكشوفة عند دخول morning recap
  useEffect(() => {
    if (gameState.phase === 'MORNING_RECAP') {
      setRevealedEvents(new Set());
      setSheriffOverlay(null);
    }
  }, [gameState.phase]);

  // عند وصول نتيجة الشريف → فتح الـ overlay الكبير
  useEffect(() => {
    if (gameState.sheriffResult) {
      setSheriffOverlay(gameState.sheriffResult);
    }
  }, [gameState.sheriffResult]);

  const nightStep = gameState.nightStep;
  const nightComplete = gameState.nightComplete;
  const morningEvents = gameState.morningEvents || [];
  const meta = nightStep ? (ACTION_META[nightStep.role] || ACTION_META.GODFATHER) : null;

  // اللاعبين الأحياء
  const alivePlayers = (gameState.players || []).filter((p: any) => p.isAlive);

  // ── تأكيد الاختيار ──
  const handleSubmitAction = async () => {
    if (!nightStep || selectedTarget === null) return;
    setLoading(true);
    try {
      await emit('night:submit-action', {
        roomId: gameState.roomId,
        role: nightStep.role,
        targetPhysicalId: selectedTarget,
      });
      setSelectedTarget(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── تخطي الإجراء ──
  const handleSkipAction = async () => {
    if (!nightStep) return;
    setLoading(true);
    try {
      await emit('night:skip-action', {
        roomId: gameState.roomId,
        role: nightStep.role,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── معالجة التقاطعات ──
  const handleResolve = async () => {
    setLoading(true);
    try {
      await emit('night:resolve', { roomId: gameState.roomId });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── عرض حدث على شاشة العرض ──
  const handleDisplayEvent = async (index: number) => {
    try {
      await emit('night:display-event', {
        roomId: gameState.roomId,
        eventIndex: index,
      });
      setRevealedEvents(prev => new Set(prev).add(index));
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ── بدء النهار ──
  const handleStartDay = async () => {
    setLoading(true);
    try {
      await emit('night:end-recap', { roomId: gameState.roomId });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── تفعيل الممرضة ──
  const handleActivateNurse = async () => {
    try {
      await emit('night:activate-nurse', { roomId: gameState.roomId });
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ══════════════════════════════════════════════════
  // OVERLAY: نتيجة الشريف — كارد كبير مستقل
  // ══════════════════════════════════════════════════
  const renderSheriffOverlay = () => {
    if (!sheriffOverlay) return null;
    const isMafia = sheriffOverlay.result === 'MAFIA';
    const targetPlayer = gameState.players?.find((p: any) => p.physicalId === sheriffOverlay.targetPhysicalId);

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setSheriffOverlay(null)}
        >
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            className={`p-10 border-2 max-w-sm w-full mx-4 text-center bg-[#0a0a0a] ${
              isMafia ? 'border-[#ff4444]/60' : 'border-[#44ff44]/60'
            }`}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-[10px] font-mono text-[#555] mb-4 tracking-widest">🔒 LEADER EYES ONLY — INVESTIGATION RESULT</p>

            {/* كرت اللاعب */}
            <div className={`border-2 p-6 mb-6 ${isMafia ? 'border-[#ff4444]/40 bg-[#ff4444]/5' : 'border-[#44ff44]/40 bg-[#44ff44]/5'}`}>
              <div className={`w-16 h-16 mx-auto border-2 rounded-full flex items-center justify-center font-mono text-2xl font-black mb-3 ${
                isMafia ? 'border-[#ff4444] text-[#ff4444]' : 'border-[#44ff44] text-[#44ff44]'
              }`}>
                {sheriffOverlay.targetPhysicalId}
              </div>
              <p className="text-white text-lg font-bold mb-1" style={{ fontFamily: 'Amiri, serif' }}>
                {targetPlayer?.name || sheriffOverlay.targetName || 'Unknown'}
              </p>
            </div>

            {/* النتيجة الكبيرة */}
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className={`text-5xl font-black mb-4 ${isMafia ? 'text-[#ff4444]' : 'text-[#44ff44]'}`}
              style={{ fontFamily: 'Amiri, serif' }}
            >
              {isMafia ? '🎭 مافيا' : '🏛 مواطن'}
            </motion.div>

            <button
              onClick={() => setSheriffOverlay(null)}
              className="mt-4 px-8 py-3 border border-[#555] text-[#808080] font-mono text-xs uppercase tracking-widest hover:text-white hover:border-white transition-all"
            >
              ✓ فهمت
            </button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  // ══════════════════════════════════════════════════
  // RENDER: MORNING_RECAP — ملخص الصباح المرحلي
  // ══════════════════════════════════════════════════
  if (gameState.phase === 'MORNING_RECAP') {
    const displayableEvents = morningEvents.filter((_: any, i: number) => {
      const e = morningEvents[i];
      const m = EVENT_META[e.type];
      return m?.displayable !== false;
    });

    const allRevealed = displayableEvents.every((_: any, i: number) => {
      const originalIndex = morningEvents.findIndex((e: any) => e === displayableEvents[i]);
      return revealedEvents.has(originalIndex);
    });

    return (
      <div className="p-6">
        {renderSheriffOverlay()}

        {/* Header */}
        <div className="text-center mb-8 border-b border-[#2a2a2a] pb-6">
          <motion.div
            className="text-6xl mb-3 grayscale opacity-70"
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            ☀️
          </motion.div>
          <h2 className="text-3xl font-black text-white mb-2" style={{ fontFamily: 'Amiri, serif' }}>ملخص الليلة</h2>
          <p className="text-[#808080] font-mono uppercase text-xs tracking-widest">MORNING INTELLIGENCE BRIEFING</p>
        </div>

        {morningEvents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#555] font-mono text-sm tracking-widest uppercase">لا أحداث هذه الليلة</p>
            <p className="text-[#333] font-mono text-xs mt-2">NO CASUALTIES REPORTED</p>
          </div>
        ) : (
          <div className="space-y-4 max-w-xl mx-auto mb-8">
            {morningEvents.map((event: any, index: number) => {
              const evMeta = EVENT_META[event.type] || { icon: '❓', title: event.type, color: 'text-[#808080]', displayable: true };
              const isRevealed = revealedEvents.has(index);
              const isSheriff = event.type === 'SHERIFF_RESULT';
              const isBlocked = event.type === 'ASSASSINATION_BLOCKED';

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.15 }}
                  className={`border p-5 bg-black/60 relative overflow-hidden ${
                    isRevealed ? 'border-[#333] opacity-60' :
                    isSheriff ? 'border-[#C5A059]/40' : 'border-[#2a2a2a]'
                  }`}
                >
                  <div className={`absolute top-0 left-0 w-1 h-full ${evMeta.color.replace('text-', 'bg-')}`} />

                  <div className="flex items-center gap-4 pl-3">
                    <div className="text-3xl shrink-0">{evMeta.icon}</div>
                    <div className="flex-1">
                      <h3 className={`font-bold text-sm ${evMeta.color}`} style={{ fontFamily: 'Amiri, serif' }}>
                        {evMeta.title}
                      </h3>

                      {/* الاغتيال + القنص — يعرض الاسم */}
                      {event.type === 'ASSASSINATION' && (
                        <p className="text-white text-xs font-mono mt-1">#{event.targetPhysicalId} — {event.targetName}</p>
                      )}

                      {/* الحماية الناجحة — لا يعرض اسم المحمي */}
                      {isBlocked && (
                        <p className="text-[#2E5C31] text-xs font-mono mt-1">تم إنقاذ أحد اللاعبين من الاغتيال</p>
                      )}

                      {/* قنص مافيا — نجح */}
                      {event.type === 'SNIPE_MAFIA' && (
                        <p className="text-[#C5A059] text-xs font-mono mt-1">خرج عضو مافيا من اللعبة</p>
                      )}

                      {/* قنص مواطن — فشل */}
                      {event.type === 'SNIPE_CITIZEN' && (
                        <p className="text-[#8A0303] text-xs font-mono mt-1">خرج لاعبان من اللعبة (القناص + الهدف)</p>
                      )}

                      {/* نتيجة الشريف */}
                      {isSheriff && event.extra && (
                        <div className={`mt-3 p-3 border rounded text-center ${
                          event.extra.result === 'MAFIA'
                            ? 'border-[#ff4444]/50 bg-[#ff4444]/10'
                            : 'border-[#44ff44]/50 bg-[#44ff44]/10'
                        }`}>
                          <p className="text-[10px] font-mono text-[#555] mb-1 tracking-widest">🔒 LEADER EYES ONLY</p>
                          <p className={`text-2xl font-black ${
                            event.extra.result === 'MAFIA' ? 'text-[#ff4444]' : 'text-[#44ff44]'
                          }`} style={{ fontFamily: 'Amiri, serif' }}>
                            {event.extra.result === 'MAFIA' ? '🎭 مافيا' : '🏛 مواطن'}
                          </p>
                          <p className="text-[#808080] text-[10px] font-mono mt-1">
                            #{event.targetPhysicalId} — {event.targetName}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* زر العرض */}
                    {evMeta.displayable && (
                      <button
                        onClick={() => handleDisplayEvent(index)}
                        disabled={isRevealed}
                        className={`shrink-0 px-4 py-2 border font-mono text-xs uppercase tracking-widest transition-all ${
                          isRevealed
                            ? 'border-[#333] text-[#333] cursor-not-allowed'
                            : 'border-[#C5A059]/50 text-[#C5A059] hover:bg-[#C5A059]/10 hover:border-[#C5A059]'
                        }`}
                      >
                        {isRevealed ? '✓' : '👁 عرض'}
                      </button>
                    )}

                    {isSheriff && (
                      <div className="shrink-0 px-3 py-2 border border-[#C5A059]/30 text-[#C5A059] font-mono text-[9px] tracking-widest">
                        سري
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* كروت اللاعبين الأحياء بعد أحداث الليل */}
        <div className="max-w-xl mx-auto mb-8 border-t border-[#2a2a2a] pt-6">
          <p className="text-[#555] font-mono text-[10px] tracking-widest uppercase mb-3 text-center">
            SURVIVING AGENTS — {alivePlayers.length} REMAINING
          </p>
          <div className="grid grid-cols-5 gap-2">
            {alivePlayers.map((p: any) => (
              <div key={p.physicalId} className="border border-[#2a2a2a] p-2 text-center bg-black/40">
                <div className="w-8 h-8 mx-auto border border-[#555] flex items-center justify-center font-mono text-sm text-white mb-1">
                  {p.physicalId}
                </div>
                <p className="text-[#808080] text-[9px] font-mono truncate">{p.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* زر بدء النهار */}
        <div className="text-center mt-8">
          <button
            onClick={handleStartDay}
            disabled={loading || (!allRevealed && displayableEvents.length > 0)}
            className={`btn-premium px-12 py-5 !text-lg group ${
              allRevealed || displayableEvents.length === 0
                ? '!border-[#C5A059]'
                : '!border-[#2a2a2a] grayscale opacity-50'
            }`}
          >
            <span className="text-white group-hover:tracking-[0.2em] transition-all">
              ☀️ بدء نقاش اليوم الجديد
            </span>
          </button>
          {!allRevealed && displayableEvents.length > 0 && (
            <p className="text-[#555] font-mono text-[9px] mt-3 tracking-widest">اعرض جميع الأحداث أولاً</p>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  // RENDER: NIGHT — Queue Complete — انتهى الطابور
  // ══════════════════════════════════════════════════
  if (nightComplete) {
    const doctor = gameState.players?.find((p: any) => p.role === 'DOCTOR');
    const nurse = gameState.players?.find((p: any) => p.role === 'NURSE' && p.isAlive);
    const showNurseButton = doctor && !doctor.isAlive && nurse;

    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        {renderSheriffOverlay()}
        <motion.div
          className="text-7xl mb-6 grayscale opacity-60"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          ⚙️
        </motion.div>
        <h2 className="text-2xl font-black text-white mb-3" style={{ fontFamily: 'Amiri, serif' }}>
          اكتمل طابور الليل
        </h2>
        <p className="text-[#808080] font-mono uppercase text-xs tracking-widest mb-8">
          ALL NIGHT ACTIONS REGISTERED • READY FOR RESOLUTION
        </p>

        {showNurseButton && (
          <button onClick={handleActivateNurse} className="btn-premium px-8 py-4 !border-[#2E5C31]/50 mb-6">
            <span className="text-[#2E5C31]">⚕️ تفعيل الممرضة (بدل الطبيب)</span>
          </button>
        )}

        <button
          onClick={handleResolve}
          disabled={loading}
          className="btn-premium px-16 py-6 !text-xl !border-[#C5A059] animate-pulse"
        >
          <span className="text-white">{loading ? 'جارٍ المعالجة...' : '⚡ معالجة تقاطعات الليل'}</span>
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  // RENDER: NIGHT — Queue Step — خطوة في الطابور
  // ══════════════════════════════════════════════════
  if (nightStep && meta) {
    return (
      <div className="p-6">
        {renderSheriffOverlay()}

        {/* Night Header */}
        <div className="text-center mb-8 border-b border-[#2a2a2a] pb-6">
          <motion.div
            className="text-5xl mb-3 grayscale opacity-60"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            🌑
          </motion.div>
          <h2 className="text-2xl font-black text-white mb-1" style={{ fontFamily: 'Amiri, serif' }}>مرحلة الليل</h2>
          <p className="text-[#808080] font-mono uppercase text-[10px] tracking-widest">
            ROUND {gameState.round || '?'} • NIGHTFALL OPERATIONS
          </p>
        </div>

        {/* كرت الدور الحالي */}
        <motion.div
          key={nightStep.role}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`noir-card p-8 max-w-md mx-auto ${meta.bgGlow}`}
        >
          <div className="text-center mb-6">
            <motion.div
              className="text-6xl mb-3"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {meta.icon}
            </motion.div>
            <h3 className={`text-2xl font-black ${meta.color}`} style={{ fontFamily: 'Amiri, serif' }}>
              {nightStep.roleName}
            </h3>
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="w-8 h-8 border border-[#555] flex items-center justify-center font-mono text-sm text-white bg-black">
                {nightStep.performerPhysicalId}
              </div>
              <span className="text-[#808080] text-sm font-mono">{nightStep.performerName}</span>
            </div>
          </div>

          {/* DDL اختيار الهدف */}
          <div className="mb-6">
            <label className="block text-[10px] font-mono text-[#808080] mb-2 tracking-widest uppercase text-center">
              SELECT TARGET
            </label>
            <div className="grid grid-cols-2 gap-2">
              {nightStep.availableTargets.map((target: any) => (
                <button
                  key={target.physicalId}
                  onClick={() => setSelectedTarget(target.physicalId)}
                  className={`p-3 border font-mono text-sm transition-all flex items-center gap-2 ${
                    selectedTarget === target.physicalId
                      ? `${meta.color.replace('text-', 'border-')} text-white bg-white/5`
                      : 'border-[#2a2a2a] text-[#808080] hover:border-[#555] hover:text-white'
                  }`}
                >
                  <span className={`w-7 h-7 flex items-center justify-center text-xs border shrink-0 ${
                    selectedTarget === target.physicalId ? meta.color.replace('text-', 'border-') : 'border-[#333]'
                  }`}>
                    {target.physicalId}
                  </span>
                  <span className="truncate text-xs">{target.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* أزرار الإجراء */}
          <div className={`grid ${nightStep.canSkip ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
            <button
              onClick={handleSubmitAction}
              disabled={selectedTarget === null || loading}
              className={`py-4 border font-mono text-sm uppercase tracking-widest transition-all ${
                selectedTarget !== null
                  ? `${meta.color.replace('text-', 'border-')} text-white hover:bg-white/5`
                  : 'border-[#2a2a2a] text-[#333] cursor-not-allowed'
              }`}
            >
              {loading ? '...' : '✅ تأكيد'}
            </button>

            {nightStep.canSkip && (
              <button
                onClick={handleSkipAction}
                disabled={loading}
                className="py-4 border border-[#333] text-[#555] font-mono text-sm uppercase tracking-widest hover:border-[#555] hover:text-[#808080] transition-all"
              >
                ⏭ تخطي
              </button>
            )}
          </div>
        </motion.div>

        {/* شريط التقدم */}
        <div className="flex items-center justify-center gap-3 mt-8">
          {['GODFATHER', 'SILENCER', 'SHERIFF', 'DOCTOR', 'SNIPER'].map((role) => {
            const isCurrent = nightStep.role === role;
            const isPast = ['GODFATHER', 'SILENCER', 'SHERIFF', 'DOCTOR', 'SNIPER'].indexOf(role) <
                           ['GODFATHER', 'SILENCER', 'SHERIFF', 'DOCTOR', 'SNIPER'].indexOf(nightStep.role);
            return (
              <div key={role} className="flex flex-col items-center gap-1">
                <div className={`w-3 h-3 rounded-full transition-all ${
                  isCurrent ? 'bg-[#C5A059] shadow-[0_0_10px_#C5A059]' :
                  isPast ? 'bg-[#555]' : 'bg-[#222]'
                }`} />
                <span className={`text-[8px] font-mono tracking-widest ${
                  isCurrent ? 'text-[#C5A059]' : 'text-[#333]'
                }`}>
                  {role === 'GODFATHER' ? 'اغتيال' :
                   role === 'SILENCER' ? 'إسكات' :
                   role === 'SHERIFF' ? 'تحقيق' :
                   role === 'DOCTOR' ? 'حماية' : 'قنص'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  // RENDER: NIGHT — انتظار بيانات الليل
  // ══════════════════════════════════════════════════
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      {renderSheriffOverlay()}
      <motion.div
        className="text-7xl mb-6 grayscale opacity-40"
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        🌑
      </motion.div>
      <p className="text-[#555] font-mono text-sm tracking-widest uppercase">AWAITING NIGHT DATA...</p>
    </div>
  );
}
