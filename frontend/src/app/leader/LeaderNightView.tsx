'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MafiaCard from '@/components/MafiaCard';

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
  SILENCED:             { icon: '🤐', title: 'تم إسكات لاعب',     color: 'text-[#888]',    displayable: true },
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
  // كشف مؤقت للكارد (ضغط مطول)
  const [peekedCard, setPeekedCard] = useState<number | null>(null);
  const peekTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // بدء الضغط المطول — إذا استمر 500ms → كشف الكارد
  const handleCardPressStart = useCallback((physicalId: number) => {
    longPressTimerRef.current = setTimeout(() => {
      setPeekedCard(physicalId);
      // إعادة الكارد بعد ثانيتين
      peekTimerRef.current = setTimeout(() => {
        setPeekedCard(null);
      }, 2000);
    }, 500);
  }, []);

  // إنهاء الضغط — إذا لم يكتمل 500ms → اختيار الهدف فقط
  const handleCardPressEnd = useCallback((physicalId: number) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // إذا لم يكن الكارد مكشوفاً = ضغطة قصيرة → اختيار
    if (peekedCard !== physicalId) {
      setSelectedTarget(physicalId);
    }
  }, [peekedCard]);

  // تصفير الاختيار عند تغير الخطوة
  useEffect(() => {
    setSelectedTarget(null);
    setPeekedCard(null);
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  }, [gameState.nightStep?.role]);

  // تصفير الأحداث المكشوفة عند دخول morning recap
  useEffect(() => {
    if (gameState.phase === 'MORNING_RECAP') {
      setRevealedEvents(new Set());
      setSheriffOverlay(null);
    }
  }, [gameState.phase]);

  // عند وصول نتيجة الشريف → فتح الـ overlay الكبير (فقط في مرحلة الليل)
  useEffect(() => {
    if (gameState.sheriffResult && gameState.phase === 'NIGHT') {
      setSheriffOverlay(gameState.sheriffResult);
    }
  }, [gameState.sheriffResult, gameState.phase]);

  // مسح overlay الشريف عند دخول ليل جديد
  useEffect(() => {
    if (gameState.phase === 'NIGHT') {
      setSheriffOverlay(null);
    }
  }, [gameState.round]);

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

  // ── تأكيد إنهاء اللعبة (عند فوز ليلي) ──
  const handleConfirmEnd = async () => {
    setLoading(true);
    try {
      await emit('game:confirm-end', { roomId: gameState.roomId });
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
            className={`p-8 border-2 max-w-sm w-full mx-4 text-center bg-[#0a0a0a] rounded-xl ${
              isMafia ? 'border-[#ff4444]/60' : 'border-[#44ff44]/60'
            }`}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-[10px] font-mono text-[#555] mb-4 tracking-widest">🔒 LEADER EYES ONLY — INVESTIGATION RESULT</p>

            {/* النتيجة فوق الكارد */}
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className={`text-4xl font-black mb-5 ${isMafia ? 'text-[#ff4444]' : 'text-[#44ff44]'}`}
              style={{ fontFamily: 'Amiri, serif' }}
            >
              {isMafia ? '🎭 مافيا' : '🏛 مواطن'}
            </motion.div>

            {/* كرت اللاعب */}
            <div className="flex justify-center mb-6">
              <MafiaCard
                playerNumber={sheriffOverlay.targetPhysicalId}
                playerName={targetPlayer?.name || sheriffOverlay.targetName || 'Unknown'}
                role={null}
                isFlipped={false}
                flippable={false}
                gender={targetPlayer?.gender === 'FEMALE' ? 'FEMALE' : 'MALE'}
                size="md"
                isAlive={true}
              />
            </div>

            <button
              onClick={() => setSheriffOverlay(null)}
              className="px-8 py-3 border border-[#555] text-[#808080] font-mono text-xs uppercase tracking-widest hover:text-white hover:border-white transition-all rounded-lg"
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

                      {/* الإسكات */}
                      {event.type === 'SILENCED' && (
                        <p className="text-[#888] text-xs font-mono mt-1">#{event.targetPhysicalId} — {event.targetName}</p>
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
          <div className="grid grid-cols-4 gap-2">
            {alivePlayers.map((p: any) => (
              <MafiaCard
                key={p.physicalId}
                playerNumber={p.physicalId}
                playerName={p.name}
                role={null}
                isFlipped={false}
                flippable={false}
                gender={p.gender === 'FEMALE' ? 'FEMALE' : 'MALE'}
                size="sm"
                className="!w-full !h-[7.5rem]"
                isAlive={true}
              />
            ))}
          </div>
        </div>

        {/* زر بدء النهار أو إنهاء اللعبة */}
        <div className="text-center mt-8">
          {gameState.pendingWinner ? (
            /* ── شاشة فوز معلقة ── */
            <div className="noir-card p-8 border-[#C5A059]/40 max-w-md mx-auto">
              <div className="text-6xl mb-4">{gameState.pendingWinner === 'MAFIA' ? '🩸' : '⚖️'}</div>
              <h3 className="text-2xl font-black text-white mb-2" style={{ fontFamily: 'Amiri, serif' }}>
                {gameState.pendingWinner === 'MAFIA' ? 'المافيا انتصرت!' : 'المدينة انتصرت!'}
              </h3>
              <p className="text-[#808080] font-mono text-xs tracking-widest uppercase mb-6">
                {gameState.pendingWinner === 'MAFIA' ? 'THE SYNDICATE HAS PREVAILED' : 'THE CITY HAS BEEN CLEANSED'}
              </p>
              <button
                onClick={handleConfirmEnd}
                disabled={loading || (!allRevealed && displayableEvents.length > 0)}
                className="btn-premium px-10 py-4 !text-base w-full !border-[#C5A059]"
              >
                <span>🏁 عرض النتائج وإنهاء اللعبة</span>
              </button>
              {!allRevealed && displayableEvents.length > 0 && (
                <p className="text-[#555] font-mono text-[9px] mt-3 tracking-widest">اعرض جميع الأحداث أولاً</p>
              )}
            </div>
          ) : (
            /* ── زر بدء النهار العادي ── */
            <>
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
            </>
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
      <div className="p-4 pb-8">
        {renderSheriffOverlay()}

        {/* ── الهيدر: عنوان + شريط تقدم ── */}
        <div className="flex items-center justify-between mb-4 border-b border-[#2a2a2a] pb-3">
          <div className="flex items-center gap-2">
            <motion.div
              className="text-2xl"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }}
            >🌑</motion.div>
            <div>
              <h2 className="text-base font-black text-white" style={{ fontFamily: 'Amiri, serif' }}>مرحلة الليل</h2>
              <p className="text-[#808080] font-mono uppercase text-[7px] tracking-widest">ROUND {gameState.round || '?'}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {['GODFATHER', 'SILENCER', 'SHERIFF', 'DOCTOR', 'SNIPER'].map((role) => {
              const roleMeta = ACTION_META[role];
              const isCurrent = nightStep.role === role;
              const isPast = ['GODFATHER', 'SILENCER', 'SHERIFF', 'DOCTOR', 'SNIPER'].indexOf(role) <
                             ['GODFATHER', 'SILENCER', 'SHERIFF', 'DOCTOR', 'SNIPER'].indexOf(nightStep.role);
              return (
                <div key={role} className="flex flex-col items-center gap-0.5">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs transition-all ${
                    isCurrent ? 'bg-[#1a1a1a] border border-[#C5A059]/50 shadow-[0_0_10px_rgba(197,160,89,0.2)]' :
                    isPast ? 'bg-[#111] border border-[#333]' : 'bg-[#0a0a0a] border border-[#1a1a1a]'
                  }`}>
                    <span className={isCurrent ? '' : isPast ? 'grayscale opacity-40' : 'grayscale opacity-20'}>{roleMeta?.icon || '?'}</span>
                  </div>
                  {isCurrent && <div className="w-1 h-1 rounded-full bg-[#C5A059]" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── شريط المؤدي: أيقونة + اسم الدور + رقم واسم اللاعب ── */}
        <motion.div
          key={nightStep.role}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-3 p-3 rounded-xl border border-[#2a2a2a] bg-black/40 mb-5 ${meta.bgGlow}`}
        >
          <motion.span
            className="text-3xl shrink-0"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >{meta.icon}</motion.span>
          <div className="flex-1 min-w-0">
            <h3 className={`text-lg font-black ${meta.color}`} style={{ fontFamily: 'Amiri, serif' }}>
              {nightStep.roleName}
            </h3>
          </div>
          <div className="shrink-0 flex items-center gap-2 bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-1.5">
            <span className={`text-xl font-mono font-black ${meta.color}`}>#{nightStep.performerPhysicalId}</span>
            <span className="text-white text-sm font-bold" style={{ fontFamily: 'Amiri, serif' }}>{nightStep.performerName}</span>
          </div>
        </motion.div>

        {/* ── اختيار الهدف ── */}
        <label className="block text-[9px] font-mono text-[#808080] mb-3 tracking-widest uppercase text-center">
          🎯 اختر الهدف — SELECT TARGET
          <span className="block text-[7px] text-[#555] mt-1">اضغط مطولاً على الكارد لكشف الدور</span>
        </label>
        <div className="flex flex-wrap justify-center gap-3 mb-5">
          {nightStep.availableTargets.map((target: any) => {
            const isSelected = selectedTarget === target.physicalId;
            const targetPlayer = gameState.players?.find((p: any) => p.physicalId === target.physicalId);
            const isPeeked = peekedCard === target.physicalId;
            return (
              <div
                key={target.physicalId}
                onPointerDown={() => handleCardPressStart(target.physicalId)}
                onPointerUp={() => handleCardPressEnd(target.physicalId)}
                onPointerLeave={() => {
                  if (longPressTimerRef.current) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                }}
                className="cursor-pointer select-none"
              >
                <MafiaCard
                  playerNumber={target.physicalId}
                  playerName={target.name}
                  role={targetPlayer?.role || null}
                  isFlipped={isPeeked}
                  flippable={false}
                  gender={targetPlayer?.gender === 'FEMALE' ? 'FEMALE' : 'MALE'}
                  size={nightStep.availableTargets.length <= 12 ? 'md' : 'sm'}
                  isAlive={true}
                  className={`transition-all duration-300 ${
                    isSelected
                      ? `ring-2 ${meta.color.replace('text-', 'ring-')} shadow-lg scale-[1.03]`
                      : ''
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* أزرار الإجراء */}
        <div className={`grid ${nightStep.canSkip ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
          <button
            onClick={handleSubmitAction}
            disabled={selectedTarget === null || loading}
            className={`py-4 border font-mono text-sm uppercase tracking-widest transition-all rounded-lg ${
              selectedTarget !== null
                ? `${meta.color.replace('text-', 'border-')} text-white hover:bg-white/5`
                : 'border-[#1a1a1a] text-[#333] cursor-not-allowed'
            }`}
          >
            {loading ? '...' : '✅ تأكيد'}
          </button>

          {nightStep.canSkip && (
            <button
              onClick={handleSkipAction}
              disabled={loading}
              className="py-4 border border-[#333] text-[#555] font-mono text-sm uppercase tracking-widest hover:border-[#555] hover:text-[#808080] transition-all rounded-lg"
            >
              ⏭ تخطي
            </button>
          )}
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
