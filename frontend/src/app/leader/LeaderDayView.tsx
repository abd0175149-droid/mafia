'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface LeaderDayViewProps {
  gameState: any;
  emit: (event: string, payload: any) => Promise<any>;
  setError: (err: string) => void;
}

export default function LeaderDayView({ gameState, emit, setError }: LeaderDayViewProps) {
  const [loading, setLoading] = useState(false);
  const [dealInitiator, setDealInitiator] = useState<number | ''>('');
  const [dealTarget, setDealTarget] = useState<number | ''>('');

  const alivePlayers = gameState.players.filter((p: any) => p.isAlive);
  const deals = gameState.votingState?.deals || [];
  const candidates = gameState.votingState?.candidates || [];
  const tiedCandidates = gameState.tiedCandidates || []; // Assuming stored here if TIE

  // ── 1. Deals Proposition ──
  const handleAddDeal = async () => {
    if (dealInitiator === '' || dealTarget === '') return;
    if (dealInitiator === dealTarget) {
      setError('لا يمكن للاعب إنشاء اتفاقية مع نفسه');
      return;
    }
    setLoading(true);
    try {
      await emit('day:create-deal', {
        roomId: gameState.roomId,
        initiatorPhysicalId: Number(dealInitiator),
        targetPhysicalId: Number(dealTarget),
      });
      setDealInitiator('');
      setDealTarget('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDeal = async (dealId: string) => {
    try {
      await emit('day:remove-deal', { roomId: gameState.roomId, dealId });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStartVoting = async () => {
    if (!confirm('هل أنت متأكد من بدء التصويت؟ لن تتمكن من تعديل الاتفاقيات.')) return;
    try {
      await emit('day:start-voting', { roomId: gameState.roomId });
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ── 2. Live Voting ──
  const handleVote = async (candidateIndex: number, delta: 1 | -1) => {
    const candidate = candidates[candidateIndex];
    if (candidate.votes + delta < 0) return;
    try {
      await emit('day:cast-vote', { roomId: gameState.roomId, candidateIndex, delta });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleResolveVoting = async () => {
    try {
      await emit('day:resolve', { roomId: gameState.roomId });
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ── 3. Reveal ──
  const handleTriggerReveal = async () => {
    if (!gameState.pendingResolution) return;
    try {
      await emit('day:trigger-reveal', { roomId: gameState.roomId, result: gameState.pendingResolution });
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ── 4. Tie-Breaker ──
  const handleTieBreaker = async (action: string) => {
    try {
      await emit('day:tie-action', { roomId: gameState.roomId, action, tiedCandidates });
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ==========================================
  // RENDER PENDING REVEAL
  // ==========================================
  if (gameState.phase === 'DAY_RESOLUTION_PENDING') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[50vh]">
        <h2 className="text-3xl font-black text-[#8A0303] mb-6" style={{ fontFamily: 'Amiri, serif' }}>اكتمل التصويت وجاهز للحسم</h2>
        <p className="text-[#808080] font-mono uppercase tracking-widest text-sm mb-12">
          TARGET ELIMINATED. AWAITING DIRECTOR ORDER TO DECLASSIFY IDENTITIES...
        </p>
        <button
          onClick={handleTriggerReveal}
          className="btn-premium px-16 py-6 !text-2xl !border-[#8A0303] animate-pulse"
        >
          <span className="text-white">DECLASSIFY AND REVEAL IDENTITY 💀</span>
        </button>
      </div>
    );
  }

  // ==========================================
  // RENDER TIE-BREAKER
  // ==========================================
  if (gameState.phase === 'DAY_TIEBREAKER') {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-black text-[#C5A059] mb-4 text-center">حالة تعادل!</h2>
        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
          <button onClick={() => handleTieBreaker('REVOTE')} className="noir-card p-4 text-white hover:border-[#C5A059]">إعادة تصويت</button>
          <button onClick={() => handleTieBreaker('NARROW')} className="noir-card p-4 text-white hover:border-[#C5A059]">حصر التصويت بالمتعادلين</button>
          <button onClick={() => handleTieBreaker('CANCEL')} className="noir-card p-4 text-[#8A0303] hover:border-[#8A0303]">إلغاء التصويت (الانتقال لليل)</button>
          <button onClick={() => handleTieBreaker('ELIMINATE_ALL')} className="bg-[#8A0303]/20 border border-[#8A0303] p-4 text-[#8A0303] font-bold">إقصاء جميع المتعادلين</button>
        </div>
      </div>
    );
  }

  const [showDealsUI, setShowDealsUI] = useState(false);

  // ==========================================
  // RENDER DAY_DISCUSSION (Deals Proposition)
  // ==========================================
  if (gameState.phase === 'DAY_DISCUSSION') {
    if (!showDealsUI) {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-center h-[50vh]">
          <h2 className="text-3xl font-black text-white mb-6" style={{ fontFamily: 'Amiri, serif' }}>انتهت جولة النقاش</h2>
          <p className="text-[#808080] font-mono uppercase tracking-widest text-sm mb-12">
            ANY DEALS ESTABLISHED DURING DISCUSSION?
          </p>
          <div className="flex gap-6">
            <button
              onClick={() => setShowDealsUI(true)}
              className="btn-premium px-12 py-4"
            >
              <span className="text-white">YES - REGISTER DEALS</span>
            </button>
            <button
              onClick={async () => {
                try {
                  await emit('day:start-voting', { roomId: gameState.roomId });
                } catch (err: any) {
                  setError(err.message);
                }
              }}
              className="px-12 py-4 border border-[#8A0303] text-[#8A0303] hover:bg-[#8A0303]/10 font-mono tracking-widest uppercase transition-colors"
            >
              NO - SKIP TO VOTING
            </button>
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-mono text-[#555] uppercase tracking-widest">DEAL REGISTRATION</h2>
          <button onClick={() => setShowDealsUI(false)} className="text-[#808080] text-xs font-mono uppercase hover:text-white pb-1 border-b border-[#2a2a2a]">&lt; CANCEL</button>
        </div>
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          
          {/* Create Deal Panel */}
          <div className="noir-card p-6 border-[#2a2a2a]">
            <h3 className="text-lg font-mono text-[#555] uppercase tracking-widest mb-4 border-b border-[#2a2a2a] pb-2">Establish Deal</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-[#808080] mb-2 uppercase">Initiator (المُبادر)</label>
                <select
                  value={dealInitiator}
                  onChange={(e) => setDealInitiator(e.target.value ? Number(e.target.value) : '')}
                  className="w-full p-3 bg-[#050505] border border-[#2a2a2a] text-white focus:border-[#C5A059] outline-none"
                >
                  <option value="">-- اختر اللاعب --</option>
                  {alivePlayers.map((p: any) => (
                    <option key={p.physicalId} value={p.physicalId}>#{p.physicalId} {p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-[#808080] mb-2 uppercase">Target (المُستهدف)</label>
                <select
                  value={dealTarget}
                  onChange={(e) => setDealTarget(e.target.value ? Number(e.target.value) : '')}
                  className="w-full p-3 bg-[#050505] border border-[#2a2a2a] text-white focus:border-[#C5A059] outline-none"
                >
                  <option value="">-- اختر المستهدف --</option>
                  {alivePlayers.filter((p: any) => p.physicalId !== Number(dealInitiator)).map((p: any) => (
                    <option key={p.physicalId} value={p.physicalId}>#{p.physicalId} {p.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddDeal}
                disabled={loading || !dealInitiator || !dealTarget}
                className="w-full bg-[#111] border border-[#C5A059]/50 text-[#C5A059] py-3 mt-2 hover:bg-[#C5A059]/10 disabled:opacity-50 transition-colors font-mono tracking-widest uppercase text-sm"
              >
                + Register Deal
              </button>
            </div>
          </div>

          {/* Active Deals List */}
          <div className="noir-card p-6 border-[#2a2a2a]">
            <h3 className="text-lg font-mono text-[#555] uppercase tracking-widest mb-4 border-b border-[#2a2a2a] pb-2">Active Deals</h3>
            {deals.length === 0 ? (
              <p className="text-[#555] text-sm font-mono p-4 text-center">NO DEALS REGISTERED.</p>
            ) : (
              <div className="space-y-3">
                {deals.map((deal: any) => {
                  const initiator = alivePlayers.find((p: any) => p.physicalId === deal.initiatorPhysicalId);
                  const target = alivePlayers.find((p: any) => p.physicalId === deal.targetPhysicalId);
                  return (
                    <div key={deal.id} className="bg-[#050505] border border-[#2a2a2a] p-3 flex justify-between items-center group hover:border-[#8A0303]/40 transition-colors">
                      <div className="font-mono text-sm">
                        <span className="text-white">#{deal.initiatorPhysicalId} {initiator?.name}</span>
                        <span className="text-[#555] mx-2">TIES TO</span>
                        <span className="text-[#8A0303]">#{deal.targetPhysicalId} {target?.name}</span>
                      </div>
                      <button onClick={() => handleRemoveDeal(deal.id)} className="text-[#555] hover:text-[#8A0303] text-lg leading-none">&times;</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-12">
          <button onClick={handleStartVoting} className="btn-premium px-12 py-4">
            <span className="text-white">LOCK DEALS & COMMENCE VOTING</span>
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER DAY_VOTING (Live Vote Collection)
  // ==========================================
  if (gameState.phase === 'DAY_VOTING') {
    const totalVotes = gameState.votingState?.totalVotesCast || 0;
    const isComplete = totalVotes >= alivePlayers.length;

    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-mono text-[#555] uppercase tracking-widest">Live Voting Arena</h2>
          <div className="text-right">
            <p className="text-[#808080] text-xs font-mono uppercase">VOTES CAST</p>
            <p className={`text-2xl font-black font-mono ${isComplete ? 'text-[#C5A059]' : 'text-white'}`}>
              {totalVotes} / {alivePlayers.length}
            </p>
          </div>
        </div>

        {/* CSS Grid for Candidates */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-12">
          {candidates.map((candidate: any, index: number) => {
            const isDeal = candidate.type === 'DEAL';
            const targetDetails = alivePlayers.find((p: any) => p.physicalId === candidate.targetPhysicalId);
            const initiatorDetails = isDeal ? alivePlayers.find((p: any) => p.physicalId === candidate.initiatorPhysicalId) : null;

            return (
              <motion.div
                key={index}
                layout
                className={`flex flex-col relative ${isDeal ? 'bg-[#110505] border-[#8A0303]/40' : 'bg-[#0c0c0c] border-[#2a2a2a]'} border p-4 group`}
              >
                {isDeal && (
                  <div className="absolute top-0 right-0 bg-[#8A0303] text-white text-[9px] font-mono px-2 py-1 uppercase tracking-widest font-bold">
                    DEAL
                  </div>
                )}
                
                {/* Candidate Info */}
                <div className="text-center mt-2 mb-4">
                  <div className={`w-14 h-14 mx-auto mb-2 flex items-center justify-center font-mono text-2xl border ${isDeal ? 'border-[#8A0303]/50 text-[#8A0303] bg-black' : 'border-[#555] text-white bg-black'}`}>
                    {candidate.targetPhysicalId}
                  </div>
                  <p className="text-white font-bold text-sm truncate">{targetDetails?.name}</p>
                  {isDeal && (
                    <p className="text-[#8A0303] text-[10px] mt-1 font-mono">LINKED TO #{initiatorDetails?.physicalId}</p>
                  )}
                </div>

                {/* Vote Controls */}
                <div className="mt-auto">
                  <div className="flex items-center justify-between bg-[#050505] border border-[#2a2a2a] rounded overflow-hidden">
                    <button
                      onClick={() => handleVote(index, -1)}
                      disabled={candidate.votes <= 0}
                      className="w-10 h-10 text-[#555] hover:text-white hover:bg-[#2a2a2a] disabled:opacity-30 disabled:hover:bg-transparent font-mono text-xl focus:outline-none"
                    >
                      -
                    </button>
                    <div className="text-xl font-mono font-bold text-[#C5A059] flex-1 text-center border-x border-[#2a2a2a] py-1">
                      {candidate.votes}
                    </div>
                    <button
                      onClick={() => handleVote(index, 1)}
                      className="w-10 h-10 text-[#555] hover:text-white hover:bg-[#2a2a2a] font-mono text-xl focus:outline-none"
                    >
                      +
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="text-center">
          <button
            onClick={handleResolveVoting}
            disabled={!isComplete}
            className={`btn-premium px-16 py-5 ${isComplete ? '!border-[#C5A059]' : '!border-[#2a2a2a] grayscale opacity-50'}`}
          >
            <span className="text-white">RESOLVE SELECTION</span>
          </button>
        </div>
      </div>
    );
  }

  return <div className="text-[#555] font-mono p-4">UNKNOWN SUB-PHASE: {gameState.phase}</div>;
}
