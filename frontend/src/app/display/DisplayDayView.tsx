'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSocket } from '@/lib/socket';
import MafiaCard from '@/components/MafiaCard';
import CircularTimer from '@/components/CircularTimer';

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
  teamCounts?: {citizenAlive: number; mafiaAlive: number};
}

export default function DisplayDayView({ roomId, players, initialDiscussionState, teamCounts }: DisplayDayViewProps) {
  const [phase, setPhase] = useState<'DISCUSSION' | 'VOTING' | 'JUSTIFICATION' | 'PENDING' | 'REVEALED' | 'TIE'>('DISCUSSION');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [totalVotesCast, setTotalVotesCast] = useState(0);
  const [tieBreakerLevel, setTieBreakerLevel] = useState(0);

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

  // Cinematic Panning States
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardPan, setBoardPan] = useState({ x: 0, y: 0 });
  const [timerPos, setTimerPos] = useState<'left' | 'right'>('right');

  useEffect(() => {
    if (discussionState && discussionState.currentSpeakerId) {
      setTimeout(() => {
        const el = document.getElementById(`speaker-card-${discussionState.currentSpeakerId}`);
        const parent = containerRef.current;
        if (el && parent) {
          const S = 3; // Final scale factor (Zooooooom!)
          const elCx = el.offsetLeft + el.offsetWidth / 2;
          const elCy = el.offsetTop + el.offsetHeight / 2;
          const pCx = parent.offsetWidth / 2;
          const pCy = parent.offsetHeight / 2;

          // Determine native side logically
          const isNativeLeft = elCx < pCx;
          setTimerPos(isNativeLeft ? 'right' : 'left');

          // Desired final visual positions (35% left or 65% right)
          const desiredX = isNativeLeft ? parent.offsetWidth * 0.35 : parent.offsetWidth * 0.65;
          const desiredY = pCy; 

          // Inverse formula to find target pre-scale coordinates
          const targetX = pCx + (desiredX - pCx) / S;
          const targetY = pCy + (desiredY - pCy) / S;

          setBoardPan({ x: targetX - elCx, y: targetY - elCy });
        }
      }, 100); 
    } else {
      setBoardPan({ x: 0, y: 0 });
    }
  }, [discussionState?.currentSpeakerId, phase]);

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
      setTieBreakerLevel(data.tieBreakerLevel || 0);
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

    const onJustificationTimerStopped = () => {
      setJustTimer(null);
      setJustTimeRemaining(0);
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
    socket.on('day:justification-timer-stopped', onJustificationTimerStopped);


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
      socket.off('day:justification-timer-stopped', onJustificationTimerStopped);

    };
  }, [roomId]);

  // المسكت يمكنه التصويت — لذا الحد = كل الأحياء
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
                  <h2 className="text-5xl font-black text-[#8A0303] uppercase tracking-[0.2em] bg-black px-8 py-3 border-y-2 border-[#8A0303] glitch-text" data-text="SILENCED BY SYNDICATE">
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
                <div className="w-full flex justify-center items-center h-full mb-10 overflow-visible">
                  {/* Cinematic Virtual Camera Wrapper */}
                  <motion.div 
                    ref={containerRef}
                    animate={{
                      scale: discussionState?.currentSpeakerId ? 3 : 1,
                      x: discussionState?.currentSpeakerId ? boardPan.x : 0,
                      y: discussionState?.currentSpeakerId ? boardPan.y : 0,
                    }}
                    transition={{ duration: 1.2, type: 'spring', damping: 25, stiffness: 100 }}
                    style={{ transformOrigin: 'center center' }}
                    className="flex flex-wrap justify-center items-center gap-10 md:gap-14 w-full max-w-[1600px] mx-auto px-10 relative"
                  >
                    {players.map((p) => {
                      if (!p.isAlive) return null;
                      
                      const isSpeaker = p.physicalId === discussionState?.currentSpeakerId;
                      const isSomeoneSpeaking = !!discussionState?.currentSpeakerId;
                      
                      return (
                        <motion.div
                          key={p.physicalId}
                          id={`speaker-card-${p.physicalId}`}
                          animate={{ 
                            opacity: isSpeaker ? 1 : isSomeoneSpeaking ? 0.2 : 1,
                            scale: isSpeaker ? 1.05 : isSomeoneSpeaking ? 0.95 : 1,
                            filter: isSpeaker ? 'blur(0px) grayscale(0%)' : isSomeoneSpeaking ? 'blur(4px) grayscale(70%)' : 'blur(0px) grayscale(0%)',
                            zIndex: isSpeaker ? 50 : 10
                          }}
                          transition={{ duration: 0.8, ease: "easeInOut" }}
                          className="flex flex-col items-center relative"
                        >
                          {/* Spotlight Effect for Active Speaker */}
                          {isSpeaker && (
                            <div 
                              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[350px] bg-[#C5A059]/30 blur-[50px] rounded-full pointer-events-none -z-10"
                            />
                          )}

                          <MafiaCard
                            playerNumber={p.physicalId}
                            playerName={p.name}
                            role={null}
                            gender={p.gender === 'FEMALE' ? 'FEMALE' : 'MALE'}
                            isFlipped={false}
                            flippable={false}
                            size="sm"
                            isAlive={p.isAlive}
                            className={isSpeaker ? 'shadow-[0_0_50px_rgba(197,160,89,0.4)] border-2 border-[#C5A059]' : ''}
                          />
                          
                          {/* Dynamic Timer Placement */}
                          {isSpeaker && discussionState && (
                              <motion.div 
                                initial={{ opacity: 0, x: timerPos === 'right' ? -40 : 40 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5, duration: 0.5 }}
                                className={`absolute top-1/2 -translate-y-1/2 flex flex-col items-center justify-center ${timerPos === 'right' ? 'left-[130%]' : 'right-[130%]'}`}
                              >
                                <CircularTimer
                                  timeRemaining={localTimeRemaining}
                                  totalTime={discussionState.timeLimitSeconds}
                                  size={100}
                                  enableHeartbeat={discussionState.status === 'SPEAKING'}
                                  enableShake={discussionState.status === 'SPEAKING'}
                                />
                                <div className="mt-4 text-[7px] text-center whitespace-nowrap font-mono tracking-[0.3em] font-bold">
                                  {discussionState.status === 'WAITING' && <span className="text-yellow-500 animate-pulse">AWAITING COMMENCEMENT...</span>}
                                  {discussionState.status === 'SPEAKING' && <span className="text-[#C5A059]">FLOOR IS OPEN</span>}
                                  {discussionState.status === 'PAUSED' && <span className="text-[#8A0303] animate-pulse">FLOOR SUSPENDED</span>}
                                </div>
                              </motion.div>
                          )}
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </div>
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
              {tieBreakerLevel >= 2 ? (
                <>
                  <div className="inline-block px-6 py-2 bg-[#8A0303]/20 border border-[#8A0303] mb-4">
                    <span className="text-[#ff4444] font-mono text-sm tracking-[0.4em] uppercase animate-pulse">⚡ NARROWED VOTE — TIED CANDIDATES ONLY ⚡</span>
                  </div>
                  <h1 className="text-5xl font-black text-[#8A0303] mb-4" style={{ fontFamily: 'Amiri, serif' }}>تصويت الحسم</h1>
                </>
              ) : tieBreakerLevel === 1 ? (
                <>
                  <div className="inline-block px-6 py-2 bg-[#C5A059]/10 border border-[#C5A059]/50 mb-4">
                    <span className="text-[#C5A059] font-mono text-sm tracking-[0.4em] uppercase">🔁 REVOTE — ALL CANDIDATES</span>
                  </div>
                  <h1 className="text-5xl font-black text-[#C5A059] mb-4" style={{ fontFamily: 'Amiri, serif' }}>إعادة التصويت</h1>
                </>
              ) : (
                <h1 className="text-5xl font-black text-[#C5A059] mb-4" style={{ fontFamily: 'Amiri, serif' }}>التصويت اللحظي</h1>
              )}
              <p className="text-white font-mono text-xl tracking-[0.3em] uppercase">VOTES: <span className="text-[#C5A059]">{totalVotesCast}</span> / {aliveCount}</p>
              <div className="flex justify-center gap-8 mt-3">
                <span className="font-mono text-sm tracking-widest">
                  <span className="text-[#44ff44]">🏛</span> <span className="text-white">مواطنون:</span>{' '}
                  <span className="text-[#44ff44] font-bold">{teamCounts?.citizenAlive ?? '?'}</span>
                </span>
                <span className="text-[#2a2a2a]">|</span>
                <span className="font-mono text-sm tracking-widest">
                  <span className="text-[#ff4444]">🎭</span> <span className="text-white">مافيا:</span>{' '}
                  <span className="text-[#ff4444] font-bold">{teamCounts?.mafiaAlive ?? '?'}</span>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-4 w-full">
              {sortedCandidates.map((candidate, idx) => {
                const isDeal = candidate.type === 'DEAL';
                const targetPlayer = players.find(p => p.physicalId === candidate.targetPhysicalId);
                const targetName = targetPlayer?.name || 'Unknown';
                const targetGender = targetPlayer?.gender;
                const maxVotes = sortedCandidates[0]?.votes || 1;
                const barWidth = candidate.votes > 0 ? (candidate.votes / maxVotes) * 100 : 0;
                const isFirst = idx === 0 && candidate.votes > 0;
                const fillBarColor = isDeal ? 'bg-[#8A0303]' : (isFirst ? 'bg-[#8A0303]' : 'bg-[#C5A059]');

                return (
                  <motion.div
                    layout
                    key={isDeal ? `deal-${candidate.id}` : `player-${candidate.targetPhysicalId}`}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex flex-col items-center gap-2"
                  >
                    {/* ترتيب */}
                    <span className={`text-xs font-mono font-black tracking-widest ${isFirst ? 'text-[#8A0303] animate-pulse' : 'text-[#808080]'}`}>
                      #{idx + 1}
                    </span>

                    {/* الكارد */}
                    <div className={`relative ${isFirst ? 'ring-2 ring-[#8A0303] ring-offset-2 ring-offset-black rounded-2xl shadow-[0_0_30px_rgba(138,3,3,0.4)] animate-pulse' : ''}`}>
                      {isDeal && (
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#8A0303] text-white text-[8px] font-mono px-3 py-0.5 font-bold tracking-widest rounded-full z-30 border border-[#ff4444]/50">
                          DEAL
                        </div>
                      )}
                      <MafiaCard
                        playerNumber={candidate.targetPhysicalId}
                        playerName={targetName}
                        role={null}
                        isFlipped={false}
                        flippable={false}
                        showVoting={true}
                        votes={candidate.votes}
                        gender={targetGender === 'FEMALE' ? 'FEMALE' : 'MALE'}
                        size="sm"
                        isAlive={true}
                      />
                    </div>

                    {/* شريط تقدم بارز تحت الكارد */}
                    <div className="w-full h-3 bg-[#0a0a0a] rounded-full overflow-hidden border border-[#1a1a1a]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ type: 'spring', damping: 15 }}
                        className={`h-full rounded-full ${fillBarColor} ${isFirst ? 'animate-pulse' : ''}`}
                        style={{
                          boxShadow: isFirst ? '0 0 10px rgba(138, 3, 3, 0.6)' : '0 0 6px rgba(197, 160, 89, 0.3)',
                        }}
                      />
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

            {/* Accused — MafiaCard */}
            <div className="flex flex-wrap justify-center gap-8 mb-12">
              {justificationData.accused.map((acc: any, i: number) => {
                const p = players.find(pl => pl.physicalId === acc.targetPhysicalId);
                const isActiveJust = justTimer?.physicalId === acc.targetPhysicalId;

                return (
                  <motion.div
                    key={acc.targetPhysicalId}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + i * 0.3 }}
                    className="flex flex-col items-center gap-4"
                  >
                    {/* الكارد مع ring ذهبي للمتكلم */}
                    <div className={`relative transition-all duration-500 ${
                      isActiveJust 
                        ? 'ring-4 ring-[#C5A059] ring-offset-4 ring-offset-black rounded-2xl shadow-[0_0_50px_rgba(197,160,89,0.4)]' 
                        : ''
                    }`}>
                      <MafiaCard
                        playerNumber={acc.targetPhysicalId}
                        playerName={p?.name || 'Unknown'}
                        role={null}
                        isFlipped={false}
                        flippable={false}
                        gender={p?.gender === 'FEMALE' ? 'FEMALE' : 'MALE'}
                        size="md"
                        isAlive={true}
                      />
                    </div>

                    <p className="text-[#808080] text-sm font-mono tracking-[0.3em] uppercase">
                      {justificationData.topVotes} VOTES AGAINST
                    </p>

                    {acc.type === 'DEAL' && (
                      <span className="bg-[#8A0303] text-white text-xs font-mono px-4 py-1 tracking-widest rounded-full">DEAL</span>
                    )}

                    {isActiveJust && (
                      <motion.p
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="text-[#C5A059] text-sm font-mono tracking-[0.4em] uppercase"
                      >
                        🎙 DEFENDING NOW
                      </motion.p>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* CircularTimer */}
            {justTimer && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center"
              >
                <CircularTimer
                  timeRemaining={justTimeRemaining}
                  totalTime={justTimer.timeLimitSeconds}
                  size={240}
                  enableHeartbeat={true}
                  enableShake={true}
                />
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

        {/* PENDING RESOLUTION — ⏳ سينمائي */}
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
              className="text-[#C5A059] text-9xl mb-8"
            >⏳</motion.div>
            <h2 className="text-6xl font-black text-white mb-6 uppercase" style={{ fontFamily: 'Amiri, serif' }}>بانتظار القرار</h2>
            <p className="text-[#808080] font-mono text-2xl tracking-[0.4em] uppercase">AWAITING DECLASSIFICATION ORDER...</p>
          </motion.div>
        )}

        {/* REVEALED */}
        {phase === 'REVEALED' && (
          <motion.div
            key="revealed"
            initial={{ opacity: 0, scale: 0.5, rotateX: 90 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            transition={{ type: 'spring', damping: 15 }}
            className="text-center w-full max-w-5xl revealed-vignette"
          >
            <div className="bg-[#8A0303]/10 border-2 border-[#8A0303] p-8 md:p-12 relative overflow-hidden z-50">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#8A0303]/20 mix-blend-screen blur-3xl rounded-full" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#C5A059]/20 mix-blend-screen blur-3xl rounded-full" />
              
              <h2 className="text-4xl md:text-6xl font-black text-white mb-10 tracking-tighter" style={{ fontFamily: 'Amiri, serif' }}>تم الإقصاء</h2>
              
              <div className="flex flex-wrap justify-center gap-8 md:gap-12 relative z-10">
                {revealedRoles.map((roleInfo: any, i: number) => {
                  const p = players.find((p: any) => p.physicalId === roleInfo.physicalId);
                  const isMafia = roleInfo.role?.includes('MAFIA') || roleInfo.role === 'GODFATHER' || roleInfo.role === 'SILENCER' || roleInfo.role === 'CHAMELEON';
                  return (
                    <motion.div
                      key={roleInfo.physicalId}
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 + (i * 0.6) }}
                      className="flex items-center gap-4 md:gap-6"
                    >
                      {/* الكارد — بشكل عادي */}
                      <MafiaCard
                        playerNumber={roleInfo.physicalId}
                        playerName={p?.name || 'Unknown'}
                        role={roleInfo.role}
                        isFlipped={true}
                        flippable={false}
                        isAlive={true}
                        size="fluid"
                        className="w-52 h-[18rem] md:w-60 md:h-[20rem] lg:w-72 lg:h-[24rem]"
                      />

                      {/* أيقونة الفريق بجانب الكارد */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 1.5 + (i * 0.6), type: 'spring', damping: 10 }}
                        className="flex flex-col items-center gap-3"
                      >
                        {/* أيقونة كبيرة */}
                        <motion.div
                          animate={{ 
                            scale: [1, 1.15, 1],
                            opacity: [0.7, 1, 0.7],
                          }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className={`text-6xl md:text-7xl lg:text-8xl ${
                            isMafia 
                              ? 'drop-shadow-[0_0_20px_rgba(220,38,38,0.5)]' 
                              : 'drop-shadow-[0_0_20px_rgba(161,161,170,0.4)]'
                          }`}
                        >
                          {isMafia ? '💀' : '⚰️'}
                        </motion.div>

                        {/* نص الفريق */}
                        <span className={`text-xs md:text-sm font-mono font-bold tracking-widest uppercase ${
                          isMafia ? 'text-red-500' : 'text-zinc-400'
                        }`}>
                          {isMafia ? 'MAFIA' : 'CITIZEN'}
                        </span>
                      </motion.div>
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
