'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSocket } from '@/lib/socket';

const playAudioBeep = (type: 'tick' | 'buzzer') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    if (type === 'tick') {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } else {
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(150, audioCtx.currentTime); 
      oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.8);
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.8);
    }
  } catch(e) {}
};

const playVoteSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  } catch(e) {}
};

const playShiftSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3);
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch(e) {}
};


interface DisplayDayViewProps {
  roomId: string;
  players: any[]; // Roster to get names
  initialDiscussionState?: any;
}

export default function DisplayDayView({ roomId, players, initialDiscussionState }: DisplayDayViewProps) {
  const [phase, setPhase] = useState<'DISCUSSION' | 'VOTING' | 'JUSTIFICATION' | 'PENDING' | 'REVEALED' | 'TIE'>('DISCUSSION');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [totalVotesCast, setTotalVotesCast] = useState(0);

  // Resolution UI States
  const [eliminatedIds, setEliminatedIds] = useState<number[]>([]);
  const [revealedRoles, setRevealedRoles] = useState<any[]>([]);
  const [revealType, setRevealType] = useState<string>('');

  // Justification UI States
  const [justificationData, setJustificationData] = useState<any>(null);
  const [justTimer, setJustTimer] = useState<{physicalId: number; timeLimitSeconds: number; startTime: number} | null>(null);
  const [justTimeRemaining, setJustTimeRemaining] = useState(0);

  // Discussion UI States
  const [discussionState, setDiscussionState] = useState<any>(initialDiscussionState || null);
  const [silencedPlayerId, setSilencedPlayerId] = useState<number | null>(null);
  const [localTimeRemaining, setLocalTimeRemaining] = useState<number>(initialDiscussionState?.timeRemaining || 0);
  const prevTimeRef = useRef<number>(initialDiscussionState?.timeRemaining || 0);

  // Timer Tick Effect
  useEffect(() => {
    if (!discussionState || discussionState.status !== 'SPEAKING' || discussionState.startTime === null) {
      return;
    }
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - discussionState.startTime) / 1000);
      const remaining = Math.max(0, discussionState.timeRemaining - elapsed);
      setLocalTimeRemaining(remaining);
      
      if (remaining !== prevTimeRef.current) {
        if (remaining <= 10 && remaining > 0) {
          playAudioBeep('tick');
        } else if (remaining === 0 && prevTimeRef.current > 0) {
          playAudioBeep('buzzer');
        }
        prevTimeRef.current = remaining;
      }
    }, 100); // 100ms for smoother updates if needed, though seconds suffice
    return () => clearInterval(interval);
  }, [discussionState]);

  // Justification Timer Tick Effect
  useEffect(() => {
    if (!justTimer) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - justTimer.startTime) / 1000);
      const remaining = Math.max(0, justTimer.timeLimitSeconds - elapsed);
      setJustTimeRemaining(remaining);
      if (remaining <= 10 && remaining > 0) playAudioBeep('tick');
      if (remaining === 0) { playAudioBeep('buzzer'); clearInterval(interval); }
    }, 200);
    return () => clearInterval(interval);
  }, [justTimer]);

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

    const onDiscussionUpdated = (data: { discussionState: any }) => {
      setDiscussionState(data.discussionState);
      setLocalTimeRemaining(data.discussionState.timeRemaining);
    };

    const onShowSilenced = (data: { physicalId: number }) => {
      setSilencedPlayerId(data.physicalId);
      setTimeout(() => {
        setSilencedPlayerId(null);
      }, 4000); // Show animation for 4 seconds
    };

    const onJustificationStarted = (data: any) => {
      setJustificationData(data);
      setJustTimer(null);
      setPhase('JUSTIFICATION');
    };

    const onJustificationTimerStarted = (data: any) => {
      setJustTimer(data);
      setJustTimeRemaining(data.timeLimitSeconds);
    };

    const onPardoned = () => {
      // العفو - سيُنتقل لليل عبر phase-changed
      setPhase('DISCUSSION');
    };

    socket.on('day:voting-started', onVotingStarted);
    socket.on('day:vote-update', onVoteUpdate);
    socket.on('day:elimination-pending', onPending);
    socket.on('day:elimination-revealed', onRevealed);
    socket.on('day:tie', onTie);
    socket.on('game:phase-changed', onPhaseChanged);
    socket.on('day:discussion-updated', onDiscussionUpdated);
    socket.on('day:show-silenced', onShowSilenced);
    socket.on('day:justification-started', onJustificationStarted);
    socket.on('day:justification-timer-started', onJustificationTimerStarted);
    socket.on('day:pardoned', onPardoned);

    return () => {
      socket.off('day:voting-started', onVotingStarted);
      socket.off('day:vote-update', onVoteUpdate);
      socket.off('day:elimination-pending', onPending);
      socket.off('day:elimination-revealed', onRevealed);
      socket.off('day:tie', onTie);
      socket.off('game:phase-changed', onPhaseChanged);
      socket.off('day:discussion-updated', onDiscussionUpdated);
      socket.off('day:show-silenced', onShowSilenced);
      socket.off('day:justification-started', onJustificationStarted);
      socket.off('day:justification-timer-started', onJustificationTimerStarted);
      socket.off('day:pardoned', onPardoned);
    };
  }, [roomId]);

  const aliveCount = players.filter((p: any) => p.isAlive).length;

  const prevVotesRef = useRef(totalVotesCast);
  const sortedCandidates = [...candidates].sort((a,b) => b.votes - a.votes);
  const currentOrderStr = sortedCandidates.map(c => c.targetPhysicalId).join(',');
  const prevOrderRef = useRef(currentOrderStr);

  useEffect(() => {
    if (phase === 'VOTING') {
      if (totalVotesCast > prevVotesRef.current) {
        playVoteSound();
      }
      prevVotesRef.current = totalVotesCast;

      if (currentOrderStr !== prevOrderRef.current) {
        if (prevOrderRef.current) {
           playShiftSound();
        }
        prevOrderRef.current = currentOrderStr;
      }
    }
  }, [totalVotesCast, currentOrderStr, phase]);

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
            className="text-center w-full"
          >
            {/* Silenced Animation Block */}
            <AnimatePresence>
              {silencedPlayerId && (
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-[#050505]/90 backdrop-blur-sm"
                >
                  <motion.div 
                    animate={{ rotate: [-2, 2, -2, 2, 0] }}
                    transition={{ duration: 0.4, repeat: Infinity }}
                    className="w-48 h-48 bg-[#111] border-4 border-[#8A0303] text-[#8A0303] rounded-full flex flex-col items-center justify-center shadow-[0_0_50px_rgba(138,3,3,0.5)] mb-8"
                  >
                    <span className="text-6xl mb-2">🔇</span>
                    <span className="text-4xl font-black font-mono">{silencedPlayerId}</span>
                  </motion.div>
                  <h2 className="text-5xl font-black text-[#8A0303] uppercase tracking-[0.2em] bg-black px-8 py-3 border-y-2 border-[#8A0303]">
                    SILENCED BY SYNDICATE
                  </h2>
                  <p className="mt-6 text-[#ffccd5] font-mono text-xl tracking-widest uppercase">
                    {players.find(p => p.physicalId === silencedPlayerId)?.name || 'UNKNOWN'} IS MUZZLED
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {!silencedPlayerId && (
              <>
                {!discussionState || discussionState.isFinished ? (
                  <>
                    <div className="text-8xl mb-8 grayscale opacity-70">⚖️</div>
                    <h1 className="text-6xl font-black text-white mb-6 uppercase tracking-widest" style={{ fontFamily: 'Amiri, serif' }}>ساحة النقاش</h1>
                    <p className="text-[#808080] font-mono tracking-[0.4em] uppercase text-xl">
                      {!discussionState ? 'AWAITING DIRECTOR INITIALIZATION...' : 'ALL REGULAR DISCUSSIONS COMPLETE. AWAITING DEALS...'}
                    </p>
                  </>
                ) : (
                  <div className="flex flex-col items-center">
                    <h2 className="text-3xl font-mono text-[#555] uppercase tracking-widest mb-12">ACTIVE SPEAKER</h2>
                    
                    <div className={`relative flex items-center justify-center rounded-full p-2 mb-12 transition-all duration-1000 ${
                      discussionState.status === 'SPEAKING' 
                        ? 'bg-gradient-to-tr from-[#C5A059] to-transparent shadow-[0_0_100px_rgba(197,160,89,0.2)]' 
                        : discussionState.status === 'PAUSED' 
                        ? 'bg-gradient-to-tr from-[#8A0303] to-transparent shadow-[0_0_50px_rgba(138,3,3,0.3)]'
                        : 'bg-[#2a2a2a]'
                    }`}>
                      <div className="bg-[#050505] rounded-full w-[400px] h-[400px] flex flex-col items-center justify-center p-8 z-10 border border-[#111]">
                        <span className="text-[120px] font-black text-white font-mono leading-none">{discussionState.currentSpeakerId}</span>
                        <span className="text-3xl text-[#C5A059] uppercase tracking-widest mt-4 truncate max-w-[300px]">
                          {players.find(p => p.physicalId === discussionState.currentSpeakerId)?.name}
                        </span>
                      </div>
                    </div>

                    <div className="w-full max-w-2xl bg-[#111] p-6 border-b-4 border-[#2a2a2a] relative overflow-hidden">
                      {discussionState.status === 'SPEAKING' && (
                        <motion.div 
                           initial={{ width: 0 }}
                           animate={{ width: `${((discussionState.timeLimitSeconds - localTimeRemaining) / discussionState.timeLimitSeconds) * 100}%` }}
                           transition={{ ease: "linear" }}
                           className="absolute top-0 left-0 h-full bg-[#C5A059]/10"
                        />
                      )}
                      {discussionState.status === 'PAUSED' && (
                        <div className="absolute inset-0 bg-[#8A0303]/20 animate-pulse" />
                      )}
                      
                      <div className="relative z-10 flex items-end justify-center gap-4">
                        <span className={`text-8xl font-black font-mono transition-colors duration-300 ${
                          localTimeRemaining <= 10 && discussionState.status === 'SPEAKING' ? 'text-[#8A0303] animate-pulse' : 'text-white'
                        }`}>
                          {localTimeRemaining}
                        </span>
                        <span className="text-2xl text-[#808080] font-mono tracking-widest uppercase mb-3">SEC</span>
                      </div>
                    </div>
                    
                    <div className="mt-8 text-xl font-mono tracking-[0.3em] font-bold">
                      {discussionState.status === 'WAITING' && <span className="text-yellow-500 animate-pulse">AWAITING COMMENCEMENT...</span>}
                      {discussionState.status === 'SPEAKING' && <span className="text-[#C5A059]">FLOOR IS OPEN</span>}
                      {discussionState.status === 'PAUSED' && <span className="text-[#8A0303] animate-pulse">FLOOR SUSPENDED</span>}
                    </div>
                  </div>
                )}
              </>
            )}
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
              {sortedCandidates.map((candidate, idx) => {
                const isDeal = candidate.type === 'DEAL';
                const targetPlayer = players.find(p => p.physicalId === candidate.targetPhysicalId);
                const targetName = targetPlayer?.name;
                const targetGender = targetPlayer?.gender;
                const initiatorName = isDeal ? players.find(p => p.physicalId === candidate.initiatorPhysicalId)?.name : null;

                const isFemale = targetGender === 'FEMALE';
                const baseBg = isFemale ? 'bg-[#1a0b36]' : 'bg-[#111]';
                const borderColor = isFemale ? 'border-[#4C1D95]' : 'border-[#C5A059]';
                const textColor = isFemale ? 'text-purple-300' : 'text-[#C5A059]';
                const shadow = isFemale ? 'shadow-[0_0_20px_rgba(76,29,149,0.3)]' : 'shadow-[0_0_20px_rgba(197,160,89,0.15)]';
                const rankColor = idx === 0 && candidate.votes > 0 ? (isFemale ? 'bg-[#4C1D95] text-white' : 'bg-[#C5A059] text-black') : 'bg-[#050505] text-[#808080] border border-[#2a2a2a]';
                const fillBarColor = isDeal ? 'bg-[#8A0303]' : (isFemale ? 'bg-[#4C1D95]' : 'bg-[#C5A059]');
                const voteNumberColor = isDeal ? '#ff0000' : (isFemale ? '#e9d5ff' : '#C5A059');

                return (
                  <motion.div
                    layout
                    key={isDeal ? `deal-${candidate.id}` : `player-${candidate.targetPhysicalId}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`relative w-72 overflow-hidden rounded-xl border ${isDeal ? 'border-[#8A0303] shadow-[0_0_30px_rgba(138,3,3,0.4)] bg-[#0f0505]' : `${borderColor} ${shadow} ${baseBg}`}`}
                  >
                     <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-white/5 pointer-events-none" />
                     
                     <div className={`absolute top-0 right-0 px-4 py-2 text-xl font-black font-mono rounded-bl-xl z-20 transition-all duration-300 ${rankColor}`}>
                        #{idx + 1}
                     </div>

                    {isDeal && (
                      <div className="absolute top-0 left-0 bg-[#8A0303] text-white text-[10px] font-mono px-3 py-1 font-bold tracking-widest rounded-br-lg z-10">
                        DEAL
                      </div>
                    )}

                    <div className="p-8 relative z-10 mt-2">
                      <div className={`w-28 h-28 mx-auto mb-6 border-4 rounded-full flex items-center justify-center font-mono text-6xl font-black transition-all duration-300 ${isDeal ? 'border-[#8A0303] text-[#8A0303] bg-[#8A0303]/10' : `${borderColor} ${textColor} bg-black/50`}`}>
                        {candidate.targetPhysicalId}
                      </div>
                      
                      <h3 className="text-2xl font-bold text-white mb-2 truncate text-center leading-tight" style={{ fontFamily: 'Amiri, serif' }}>{targetName}</h3>
                      <p className={`text-[10px] font-mono tracking-[0.3em] text-center uppercase opacity-70 ${textColor}`}>{isFemale ? 'FEMALE AGENT' : 'MALE AGENT'}</p>

                      {isDeal && <p className="text-[#ffccd5] text-[10px] font-mono text-center mt-3 bg-[#8A0303]/20 py-2 px-1 rounded border border-[#8A0303]/30 tracking-widest uppercase">By #{candidate.initiatorPhysicalId} {initiatorName}</p>}
                    </div>

                    <div className={`mt-auto border-t relative overflow-hidden flex flex-col items-center justify-center p-6 min-h-[110px] ${isDeal ? 'border-[#8A0303]/40 bg-[#8A0303]/10' : `${borderColor} border-opacity-30 bg-black/40`}`}>
                      {candidate.votes > 0 && (
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${(candidate.votes / Math.max(1, totalVotesCast)) * 100}%` }} 
                          className={`absolute bottom-0 left-0 h-1 ${fillBarColor}`} 
                        />
                      )}
                      {candidate.votes > 0 && (
                         <div className={`absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-48 opacity-20 blur-3xl rounded-full ${fillBarColor}`} />
                      )}
                      
                      <p className="text-[#808080] text-[11px] font-mono tracking-[0.4em] uppercase mb-1 z-10">ACQUIRED VOTES</p>
                      <motion.p 
                         key={candidate.votes}
                         initial={{ scale: 1.5, color: '#fff' }}
                         animate={{ scale: 1, color: voteNumberColor }}
                         className="text-6xl font-black font-mono leading-none z-10"
                      >
                         {candidate.votes}
                      </motion.p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* JUSTIFICATION PHASE - كلمة الدفاع الأخيرة */}
        {phase === 'JUSTIFICATION' && justificationData && (
          <motion.div
            key="justification"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="w-full text-center"
          >
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-12"
            >
              <div className="text-8xl mb-6 opacity-80">⚖️</div>
              <h1 className="text-6xl font-black text-white mb-4 uppercase tracking-widest" style={{ fontFamily: 'Amiri, serif' }}>
                {justificationData.resultType === 'TIE' ? 'تعادل - كلمة الدفاع' : 'كلمة الدفاع الأخيرة'}
              </h1>
              <p className="text-[#808080] font-mono tracking-[0.4em] uppercase text-xl">
                {justificationData.resultType === 'TIE' ? 'TIED DEFENDANTS HAVE THE FLOOR' : 'THE ACCUSED HAS THE FLOOR'}
              </p>
            </motion.div>

            {/* Accused Cards */}
            <div className="flex flex-wrap justify-center gap-8 mb-12">
              {justificationData.accused.map((acc: any, i: number) => {
                const p = players.find(pl => pl.physicalId === acc.targetPhysicalId);
                const isFemale = p?.gender === 'FEMALE';
                const isActiveJust = justTimer?.physicalId === acc.targetPhysicalId;
                const borderC = isActiveJust ? 'border-[#C5A059] shadow-[0_0_40px_rgba(197,160,89,0.4)]' : (isFemale ? 'border-[#4C1D95]' : 'border-[#555]');

                return (
                  <motion.div
                    key={acc.targetPhysicalId}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + i * 0.3 }}
                    className={`relative w-80 rounded-2xl border-2 overflow-hidden transition-all duration-500 ${borderC} ${isActiveJust ? 'bg-gradient-to-b from-[#C5A059]/10 to-black' : 'bg-[#0c0c0c]'}`}
                  >
                    {isActiveJust && (
                      <div className="absolute inset-0 bg-gradient-to-tr from-[#C5A059]/5 to-transparent pointer-events-none" />
                    )}
                    <div className="p-10 relative z-10">
                      <div className={`w-36 h-36 mx-auto mb-6 border-4 rounded-full flex items-center justify-center font-mono text-7xl font-black transition-all duration-500 ${isActiveJust ? 'border-[#C5A059] text-[#C5A059] bg-[#C5A059]/10' : (isFemale ? 'border-[#4C1D95] text-purple-300 bg-black/50' : 'border-[#555] text-white bg-black/50')}`}>
                        {acc.targetPhysicalId}
                      </div>
                      <h2 className="text-4xl font-black text-white mb-2" style={{ fontFamily: 'Amiri, serif' }}>{p?.name || 'Unknown'}</h2>
                      <p className="text-[#808080] text-sm font-mono tracking-[0.3em] uppercase">{justificationData.topVotes} VOTES AGAINST</p>
                      {acc.type === 'DEAL' && (
                        <p className="text-[#8A0303] text-xs font-mono mt-2 uppercase tracking-widest">DEAL CANDIDATE</p>
                      )}
                    </div>

                    {/* Active Speaker Indicator */}
                    {isActiveJust && (
                      <div className="border-t border-[#C5A059]/40 p-6 bg-[#C5A059]/10">
                        <p className="text-[#C5A059] text-sm font-mono tracking-[0.4em] uppercase animate-pulse">🎙 DEFENDING NOW</p>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Timer */}
            {justTimer && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl mx-auto bg-[#111] p-6 border-b-4 border-[#2a2a2a] relative overflow-hidden"
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${((justTimer.timeLimitSeconds - justTimeRemaining) / justTimer.timeLimitSeconds) * 100}%` }}
                  className="absolute top-0 left-0 h-full bg-[#C5A059]/10"
                />
                <div className="relative z-10 flex items-end justify-center gap-4">
                  <span className={`text-8xl font-black font-mono transition-colors duration-300 ${justTimeRemaining <= 10 ? 'text-[#8A0303] animate-pulse' : 'text-white'}`}>
                    {justTimeRemaining}
                  </span>
                  <span className="text-2xl text-[#808080] font-mono tracking-widest uppercase mb-3">SEC</span>
                </div>
              </motion.div>
            )}

            {!justTimer && (
              <div className="mt-8 text-xl font-mono tracking-[0.3em] font-bold">
                <span className="text-yellow-500 animate-pulse">AWAITING DIRECTOR TO START DEFENSE TIMER...</span>
              </div>
            )}

            {justTimer && justTimeRemaining === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-8 text-xl font-mono tracking-[0.3em] font-bold"
              >
                <span className="text-[#8A0303] animate-pulse">TIME EXPIRED. AWAITING VERDICT...</span>
              </motion.div>
            )}
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
