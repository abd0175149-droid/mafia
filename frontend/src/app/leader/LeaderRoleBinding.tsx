'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Role, ROLE_NAMES, ROLE_ICONS } from '@/lib/constants';
import MafiaCard from '@/components/MafiaCard';

interface LeaderRoleBindingProps {
  gameState: any;
  emit: (event: string, payload: any) => Promise<any>;
  setError: (err: string) => void;
}

// ══════════════════════════════════════════════════════
// حالات الاختيار (Selection State Machine)
// ══════════════════════════════════════════════════════
// لا شيء مختار → الضغط على تشبس → تشبس مختار (selectedChipId)
// لا شيء مختار → الضغط على كارد فيه دور → كارد مختار (selectedPlayerId)
// تشبس مختار → الضغط على كارد فارغ → نقل التشبس للكارد
// تشبس مختار → الضغط على كارد فيه دور → دور الكارد يعود للقائمة + التشبس ينتقل
// تشبس مختار → الضغط على نفس التشبس → إلغاء الاختيار
// تشبس مختار → الضغط على تشبس آخر → تبديل الاختيار
// كارد مختار → الضغط على كارد فارغ → نقل الدور من الكارد المختار للكارد الفارغ
// كارد مختار → الضغط على كارد فيه دور → تبديل الأدوار بين الكارتين
// كارد مختار → الضغط على نفس الكارد → إلغاء الاختيار
// كارد مختار → الضغط على تشبس → إلغاء اختيار الكارد + اختيار التشبس

type SelectionState =
  | { type: 'none' }
  | { type: 'chip'; chipId: string }
  | { type: 'card'; playerId: number };

// ── Role Chip (Clickable) ──
function RoleChip({
  role,
  isSelected,
  onClick,
}: {
  role: Role;
  isSelected: boolean;
  onClick: () => void;
}) {
  const isMafia = [Role.GODFATHER, Role.SILENCER, Role.CHAMELEON, Role.MAFIA_REGULAR].includes(role);

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className={`relative inline-flex items-center gap-2 px-4 py-2 border cursor-pointer select-none shadow-lg transition-all ${
        isMafia ? 'bg-[#0f0505] border-[#8A0303] text-white' : 'bg-[#050505] border-[#555] text-white'
      } ${isSelected
        ? 'ring-2 ring-[#C5A059] shadow-[0_0_15px_rgba(197,160,89,0.4)] scale-105'
        : 'hover:brightness-125'
      }`}
    >
      <span className="grayscale">{ROLE_ICONS[role]}</span>
      <span className="font-mono text-xs uppercase tracking-widest leading-none">{ROLE_NAMES[role]}</span>
      {isSelected && (
        <motion.div
          layoutId="chip-indicator"
          className="absolute -top-1 -right-1 w-3 h-3 bg-[#C5A059] rounded-full"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        />
      )}
    </motion.button>
  );
}

// ── Player Card Slot ──
function PlayerCardSlot({
  player,
  boundRole,
  isSelected,
  isTarget,
  onClick,
}: {
  player: any;
  boundRole: { id: string; role: Role } | null;
  isSelected: boolean;
  isTarget: boolean; // true when another thing is selected and this card can receive
  onClick: () => void;
}) {
  const isFemale = player.gender === 'FEMALE';
  const isMafia = boundRole
    ? [Role.GODFATHER, Role.SILENCER, Role.CHAMELEON, Role.MAFIA_REGULAR].includes(boundRole.role)
    : false;

  return (
    <motion.div
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={`p-3 flex flex-col items-center gap-3 relative transition-all rounded-xl border cursor-pointer ${
        isSelected
          ? 'border-[#C5A059] bg-[#C5A059]/10 shadow-[0_0_20px_rgba(197,160,89,0.4)]'
          : isTarget
            ? 'border-[#C5A059]/30 hover:border-[#C5A059]/60 hover:bg-[#C5A059]/5'
            : 'border-transparent hover:border-[#2a2a2a]/50'
      }`}
    >
      <MafiaCard
        playerNumber={player.physicalId}
        playerName={player.name}
        role={null}
        gender={isFemale ? 'FEMALE' : 'MALE'}
        isFlipped={false}
        flippable={false}
        showVoting={false}
        isAlive={true}
        size="sm"
      />

      {/* Role Placement Area */}
      <div className={`w-full max-w-[140px] h-10 mt-1 border border-dashed rounded-md flex items-center justify-center z-10 relative overflow-hidden transition-colors ${
        isSelected
          ? 'border-[#C5A059] bg-[#C5A059]/10'
          : isTarget
            ? 'border-[#C5A059]/40 bg-black/60'
            : boundRole
              ? 'border-transparent bg-[#050505]'
              : 'border-[#555]/60 bg-[#050505]'
      }`}>
        <AnimatePresence mode="wait">
          {boundRole ? (
            <motion.div
              key={boundRole.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 border text-xs font-mono uppercase tracking-widest ${
                isMafia ? 'bg-[#0f0505] border-[#8A0303] text-white' : 'bg-[#050505] border-[#555] text-white'
              }`}
            >
              <span className="grayscale text-sm">{ROLE_ICONS[boundRole.role]}</span>
              <span className="leading-none">{ROLE_NAMES[boundRole.role]}</span>
            </motion.div>
          ) : (
            <motion.span
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`text-[9px] font-mono tracking-widest uppercase ${
                isTarget ? 'text-[#C5A059]/70' : 'text-[#555]'
              }`}
            >
              {isTarget ? '⬆ TAP TO ASSIGN' : 'EMPTY SLOT'}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <motion.div
          className="absolute -top-1 -right-1 w-5 h-5 bg-[#C5A059] rounded-full flex items-center justify-center z-30"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          <span className="text-black text-[10px] font-black">✓</span>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function LeaderRoleBinding({ gameState, emit, setError }: LeaderRoleBindingProps) {
  const [unboundRoles, setUnboundRoles] = useState<{ id: string; role: Role }[]>([]);
  const [boundPlayers, setBoundPlayers] = useState<Record<number, { id: string; role: Role }>>({});
  const [selection, setSelection] = useState<SelectionState>({ type: 'none' });
  const [loading, setLoading] = useState(false);

  // ── Initialize State from GameState ──
  useEffect(() => {
    if (!gameState) return;
    const pool = [...(gameState.rolesPool || [])];
    const initialBounds: Record<number, { id: string; role: Role }> = {};
    let roleIdCounter = 0;

    gameState.players.forEach((p: any) => {
      if (p.role) {
        initialBounds[p.physicalId] = { id: `role-${roleIdCounter++}`, role: p.role };
        const idx = pool.indexOf(p.role);
        if (idx !== -1) pool.splice(idx, 1);
      }
    });

    const initialUnbounds = pool.map(role => ({ id: `role-${roleIdCounter++}`, role }));
    setBoundPlayers(initialBounds);
    setUnboundRoles(initialUnbounds);
  }, [gameState.rolesPool, gameState.players]);

  // ══════════════════════════════════════════════════════
  // ── Tap Handlers (State Machine) ──
  // ══════════════════════════════════════════════════════

  const handleChipTap = (chipId: string) => {
    if (selection.type === 'chip' && selection.chipId === chipId) {
      // نفس التشبس → إلغاء الاختيار
      setSelection({ type: 'none' });
    } else {
      // اختيار تشبس (سواء مباشرة أو تبديل من تشبس/كارد آخر)
      setSelection({ type: 'chip', chipId });
    }
  };

  const handleCardTap = async (playerId: number) => {
    // ── حالة 1: لا شيء مختار ──
    if (selection.type === 'none') {
      if (boundPlayers[playerId]) {
        // الكارد فيه دور → اختياره
        setSelection({ type: 'card', playerId });
      }
      // الكارد فارغ → لا شيء يحصل
      return;
    }

    // ── حالة 2: تشبس مختار → الضغط على كارد ──
    if (selection.type === 'chip') {
      const chipData = unboundRoles.find(r => r.id === selection.chipId);
      if (!chipData) {
        setSelection({ type: 'none' });
        return;
      }

      const existingRole = boundPlayers[playerId];

      // تحديث محلي فوري
      setBoundPlayers(prev => ({ ...prev, [playerId]: chipData }));
      setUnboundRoles(prev => {
        let updated = prev.filter(r => r.id !== chipData.id);
        if (existingRole) updated = [...updated, existingRole]; // دور الكارد يعود للقائمة
        return updated;
      });
      setSelection({ type: 'none' });

      // إرسال للباك اند
      try {
        await emit('setup:bind-role', {
          roomId: gameState.roomId,
          physicalId: playerId,
          role: chipData.role,
        });
      } catch (err: any) {
        setError(err.message);
      }
      return;
    }

    // ── حالة 3: كارد مختار → الضغط على كارد آخر ──
    if (selection.type === 'card') {
      const fromPlayerId = selection.playerId;

      // نفس الكارد → إلغاء الاختيار
      if (fromPlayerId === playerId) {
        setSelection({ type: 'none' });
        return;
      }

      const fromRole = boundPlayers[fromPlayerId];
      if (!fromRole) {
        setSelection({ type: 'none' });
        return;
      }

      const toRole = boundPlayers[playerId]; // قد يكون null (كارد فارغ)

      // تحديث محلي فوري
      setBoundPlayers(prev => {
        const updated = { ...prev };
        // نقل الدور من الكارد المصدر للكارد الهدف
        updated[playerId] = fromRole;
        if (toRole) {
          // تبديل: دور الهدف يذهب للمصدر
          updated[fromPlayerId] = toRole;
        } else {
          // نقل فقط: المصدر يصبح فارغ
          delete updated[fromPlayerId];
        }
        return updated;
      });
      setSelection({ type: 'none' });

      // إرسال للباك اند
      try {
        await emit('setup:bind-role', {
          roomId: gameState.roomId,
          physicalId: playerId,
          role: fromRole.role,
        });
        if (toRole) {
          // تبديل: ربط دور الهدف بالمصدر
          await emit('setup:bind-role', {
            roomId: gameState.roomId,
            physicalId: fromPlayerId,
            role: toRole.role,
          });
        } else {
          // نقل: إلغاء ربط المصدر
          await emit('setup:unbind-role', {
            roomId: gameState.roomId,
            physicalId: fromPlayerId,
          });
        }
      } catch (err: any) {
        setError(err.message);
      }
      return;
    }
  };

  // ── إلغاء الاختيار بالضغط على الخلفية ──
  const handleBackgroundTap = (e: React.MouseEvent) => {
    // فقط إذا الضغط على الخلفية نفسها وليس على عنصر داخلي
    if (e.target === e.currentTarget) {
      setSelection({ type: 'none' });
    }
  };

  const handleStartGame = async () => {
    const essentialUnbound = unboundRoles.filter(r => r.role !== Role.CITIZEN);
    if (essentialUnbound.length > 0) {
      setError('يجب توزيع جميع الأدوار الخاصة قبل البدء (تم استثناء دور المواطن)');
      return;
    }
    setLoading(true);
    try {
      await emit('setup:binding-complete', { roomId: gameState.roomId });
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  // ── إلغاء ربط دور (إعادته للقائمة) ──
  const handleUnbindRole = async (playerId: number) => {
    const roleData = boundPlayers[playerId];
    if (!roleData) return;

    setBoundPlayers(prev => {
      const updated = { ...prev };
      delete updated[playerId];
      return updated;
    });
    setUnboundRoles(prev => [...prev, roleData]);
    setSelection({ type: 'none' });

    // إرسال للباك اند
    try {
      await emit('setup:unbind-role', {
        roomId: gameState.roomId,
        physicalId: playerId,
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const specialUnbound = unboundRoles.filter(r => r.role !== Role.CITIZEN);
  const hasSelection = selection.type !== 'none';

  return (
    <div className="mb-10 w-full max-w-6xl mx-auto" onClick={handleBackgroundTap}>

      {/* ═══ Header ═══ */}
      <div className="bg-black/30 border border-[#2a2a2a] rounded-xl p-6 mb-4 backdrop-blur-sm relative overflow-hidden text-center">
        <div className="absolute left-0 top-0 w-1 h-full bg-[#C5A059]/40" />
        <h2 className="text-2xl font-black text-white" style={{ fontFamily: 'Amiri, serif' }}>توزيع الأدوار والسِّريّة</h2>
        <p className="text-[#808080] font-mono tracking-[0.3em] mt-2 uppercase text-[10px]">
          TAP A CHIP → THEN TAP A CARD TO ASSIGN
        </p>
      </div>

      {/* ═══ Chips Pool ═══ */}
      <div className="bg-black/40 border border-[#8A0303]/30 rounded-xl p-4 mb-6 backdrop-blur-sm min-h-[80px] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-l from-transparent via-[#8A0303]/50 to-transparent" />
        <div className="flex items-center justify-between mb-3 border-b border-[#2a2a2a] pb-2">
          <h3 className="text-[10px] font-mono text-[#C5A059] uppercase tracking-[0.2em] font-bold">
            Unassigned Chips ({specialUnbound.length})
          </h3>
          {selection.type !== 'none' && (
            <button
              onClick={() => setSelection({ type: 'none' })}
              className="text-[10px] font-mono text-[#808080] hover:text-white uppercase tracking-widest transition-colors"
            >
              ✕ CANCEL
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <AnimatePresence>
            {specialUnbound.map(r => (
              <motion.div
                key={r.id}
                layout
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <RoleChip
                  role={r.role}
                  isSelected={selection.type === 'chip' && selection.chipId === r.id}
                  onClick={() => handleChipTap(r.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          {specialUnbound.length === 0 && (
            <p className="text-[#808080] font-mono text-xs w-full text-center">ALL ACTION CHIPS ASSIGNED ✅</p>
          )}
        </div>
      </div>

      {/* ═══ Player Cards Grid ═══ */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-6 mb-8" onClick={handleBackgroundTap}>
        {gameState.players.filter((p: any) => p.isAlive !== false).map((player: any) => {
          const boundRole = boundPlayers[player.physicalId] || null;
          const isSelected = selection.type === 'card' && selection.playerId === player.physicalId;
          const isTarget = hasSelection && !isSelected; // أي كارد غير المختار يمكن أن يكون هدف

          return (
            <div key={player.physicalId} className="relative">
              <PlayerCardSlot
                player={player}
                boundRole={boundRole}
                isSelected={isSelected}
                isTarget={isTarget}
                onClick={() => handleCardTap(player.physicalId)}
              />

              {/* زر إلغاء الربط — يظهر فقط عند اختيار الكارد */}
              {isSelected && boundRole && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  onClick={(e) => { e.stopPropagation(); handleUnbindRole(player.physicalId); }}
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-30 bg-[#1a0505] border border-[#8A0303]/60 text-[#ff4444] text-[9px] font-mono px-3 py-1 tracking-widest uppercase hover:bg-[#8A0303]/20 transition-colors rounded-full"
                >
                  ✕ UNBIND
                </motion.button>
              )}
            </div>
          );
        })}
      </div>

      {/* ═══ Start Button ═══ */}
      <div className="text-center mb-10">
        <button
          onClick={handleStartGame}
          disabled={specialUnbound.length > 0 || loading}
          className="btn-premium px-12 py-4 disabled:opacity-50 disabled:grayscale transition-all"
        >
          <span className="text-white">{loading ? 'INITIALIZING...' : 'LOCK IDENTITIES & COMMENCE DAY'}</span>
        </button>
        {specialUnbound.length > 0 && (
          <p className="text-[#8A0303] text-[10px] font-mono mt-3 uppercase tracking-[0.2em] animate-pulse">
            WARNING: {specialUnbound.length} ACTION CHIPS UNASSIGNED
          </p>
        )}
      </div>
    </div>
  );
}
