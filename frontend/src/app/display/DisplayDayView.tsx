'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSocket } from '@/lib/socket';

interface DisplayDayViewProps {
  roomId: string;
  players: any[]; // Roster to get names
}

export default function DisplayDayView({ roomId, players }: DisplayDayViewProps) {
  const [phase, setPhase] = useState<'DISCUSSION' | 'VOTING' | 'PENDING' | 'REVEALED' | 'TIE'>('DISCUSSION');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [totalVotesCast, setTotalVotesCast] = useState(0);

  // Resolution UI States
  const [eliminatedIds, setEliminatedIds] = useState<number[]>([]);
  const [revealedRoles, setRevealedRoles] = useState<any[]>([]);
  const [revealType, setRevealType] = useState<string>('');

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !roomId) return;

    const onVotingStarted = (data: any) => {
      setCandidates(data.candidates);
      setTotalVotesCast(0);
      setPhase('VOTING');
    };

    const onVoteUpdate = (data: any) => {
      setCandidates(data.candidates);
      setTotalVotesCast(data.totalVotesCast);
    };

    const onPending = (data: any) => {
      setEliminatedIds(data.eliminated);
      setRevealType(data.type);
      setPhase('PENDING');
    };

    const onRevealed = (data: any) => {
      setEliminatedIds(data.eliminated);
      setRevealedRoles(data.revealedRoles);
      setRevealType(data.type);
      setPhase('REVEALED');
    };

    const onTie = () => {
      setPhase('TIE');
    };

    const onPhaseChanged = (data: any) => {
      if (data.phase === 'DAY_DISCUSSION') {
        setPhase('DISCUSSION');
        setCandidates([]);
      }
    };

    socket.on('day:voting-started', onVotingStarted);
    socket.on('day:vote-update', onVoteUpdate);
    socket.on('day:elimination-pending', onPending);
    socket.on('day:elimination-revealed', onRevealed);
    socket.on('day:tie', onTie);
    socket.on('game:phase-changed', onPhaseChanged);

    // Prompt server for current day state on mount?
    // Not strictly necessary since we transition smoothly, but good practice.

    return () => {
      socket.off('day:voting-started', onVotingStarted);
      socket.off('day:vote-update', onVoteUpdate);
      socket.off('day:elimination-pending', onPending);
      socket.off('day:elimination-revealed', onRevealed);
      socket.off('day:tie', onTie);
      socket.off('game:phase-changed', onPhaseChanged);
    };
  }, [roomId]);

  const aliveCount = players.filter((p: any) => p.isAlive).length;

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-center justify-center p-8">
      <AnimatePresence mode="wait">
        
        {/* DISCUSSION AREA */}
        {phase === 'DISCUSSION' && (
          <motion.div
            key="discussion"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="text-center"
          >
            <div className="text-8xl mb-8 grayscale opacity-70">⚖️</div>
            <h1 className="text-6xl font-black text-white mb-6 uppercase tracking-widest" style={{ fontFamily: 'Amiri, serif' }}>ساحة النقاش</h1>
            <p className="text-[#808080] font-mono tracking-[0.4em] uppercase text-xl">AWAITING DIRECTOR DEALS...</p>
          </motion.div>
        )}

        {/* VOTING ARENA */}
        {phase === 'VOTING' && (
          <motion.div
            key="voting"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="w-full"
          >
            <div className="text-center mb-12 border-b border-[#2a2a2a] pb-8">
              <h1 className="text-5xl font-black text-[#C5A059] mb-4" style={{ fontFamily: 'Amiri, serif' }}>التصويت اللحظي</h1>
              <p className="text-white font-mono text-xl tracking-[0.3em] uppercase">VOTES: <span className="text-[#C5A059]">{totalVotesCast}</span> / {aliveCount}</p>
            </div>

            <div className="flex flex-wrap justify-center gap-6">
              {/* Sort candidates by votes internally */}
              {[...candidates].sort((a,b) => b.votes - a.votes).map((candidate, idx) => {
                const isDeal = candidate.type === 'DEAL';
                const targetName = players.find(p => p.physicalId === candidate.targetPhysicalId)?.name;
                const initiatorName = isDeal ? players.find(p => p.physicalId === candidate.initiatorPhysicalId)?.name : null;

                return (
                  <motion.div
                    layout
                    key={isDeal ? `deal-${candidate.id}` : `player-${candidate.targetPhysicalId}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`relative w-64 p-6 border ${isDeal ? 'bg-[#0f0505] border-[#8A0303]/60 shadow-[0_0_20px_rgba(138,3,3,0.2)]' : 'bg-[#0c0c0c] border-[#555]'}`}
                  >
                    {isDeal && (
                      <div className="absolute top-0 right-0 bg-[#8A0303] text-white text-xs font-mono px-3 py-1 font-bold tracking-widest">
                        DEAL
                      </div>
                    )}
                    <div className="text-center">
                      <div className={`w-20 h-20 mx-auto mb-4 border flex items-center justify-center font-mono text-4xl ${isDeal ? 'border-[#8A0303] text-[#8A0303]' : 'border-[#C5A059] text-white'}`}>
                        {candidate.targetPhysicalId}
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2 truncate">{targetName}</h3>
                      {isDeal && <p className="text-[#8A0303] text-xs font-mono mb-4">By #{candidate.initiatorPhysicalId} {initiatorName}</p>}
                    </div>
                    <div className="mt-6 pt-4 border-t border-[#2a2a2a] text-center bg-black py-3">
                      <p className="text-[#808080] text-xs font-mono tracking-widest mb-1">AGREEMENT</p>
                      <p className="text-4xl font-black font-mono text-[#C5A059]">{candidate.votes}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* PENDING RESOLUTION (Cinematic Suspense) */}
        {phase === 'PENDING' && (
          <motion.div
            key="pending"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="text-center noir-card p-16 border-[#8A0303]"
          >
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-[#8A0303] text-8xl mb-8"
            >⚠️</motion.div>
            <h2 className="text-6xl font-black text-white mb-6 uppercase" style={{ fontFamily: 'Amiri, serif' }}>اكتمل التصويت</h2>
            <p className="text-[#808080] font-mono text-2xl tracking-[0.4em] uppercase">SYSTEM LOCKED. AWAITING DIRECTOR DECLASSIFICATION...</p>
          </motion.div>
        )}

        {/* REVEALED */}
        {phase === 'REVEALED' && (
          <motion.div
            key="revealed"
            initial={{ opacity: 0, scale: 0.5, rotateX: 90 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            transition={{ type: 'spring', damping: 15 }}
            className="text-center w-full max-w-4xl"
          >
            <div className="bg-[#8A0303]/10 border-2 border-[#8A0303] p-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#8A0303]/20 mix-blend-screen blur-3xl rounded-full" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#C5A059]/20 mix-blend-screen blur-3xl rounded-full" />
              
              <h2 className="text-6xl font-black text-white mb-10 tracking-tighter" style={{ fontFamily: 'Amiri, serif' }}>تم الإقصاء</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10 justify-center">
                {revealedRoles.map((roleInfo, i) => {
                  const p = players.find(p => p.physicalId === roleInfo.physicalId);
                  const isMafia = roleInfo.role.includes('MAFIA') || roleInfo.role === 'GODFATHER' || roleInfo.role === 'SILENCER';
                  return (
                    <motion.div 
                      key={roleInfo.physicalId}
                      initial={{ opacity: 0, x: i % 2 === 0 ? -50 : 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1 + (i * 0.5) }}
                      className={`p-6 border-l-4 ${isMafia ? 'border-[#8A0303] bg-gradient-to-r from-[#8A0303]/20 to-transparent' : 'border-white bg-[#111]'}`}
                    >
                      <p className="text-3xl font-bold text-white mb-2">{p?.name}</p>
                      <p className="text-[#808080] font-mono text-sm tracking-widest mb-4">AGENT_0{roleInfo.physicalId}</p>
                      <div className={`text-2xl font-black uppercase tracking-[0.2em] font-mono ${isMafia ? 'text-[#8A0303]' : 'text-white'}`}>
                        [ {roleInfo.role} ]
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* TIE */}
        {phase === 'TIE' && (
          <motion.div
            key="tie"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="text-9xl mb-8 grayscale text-[#C5A059]">⚖️</div>
            <h2 className="text-7xl font-black text-white mb-6 uppercase" style={{ fontFamily: 'Amiri, serif' }}>تعادل تام</h2>
            <p className="text-[#C5A059] font-mono text-2xl tracking-[0.5em] uppercase">SYSTEM OVERRIDE REQUIRED</p>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
