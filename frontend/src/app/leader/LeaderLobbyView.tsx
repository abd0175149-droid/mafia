'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LeaderLobbyViewProps {
  gameState: any;
  emit: (event: string, payload: any) => Promise<any>;
  setError: (err: string) => void;
}

export default function LeaderLobbyView({ gameState, emit, setError }: LeaderLobbyViewProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', physicalId: '', phone: '', dob: '', gender: 'MALE' });
  const [kickingId, setKickingId] = useState<number | null>(null);
  const [localError, setLocalError] = useState('');

  const handleForceAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.physicalId || !addForm.name) {
      setLocalError("الرجاء إدخال المعرف واسم اللاعب بالكامل!");
      return;
    }
    setLocalError('');
    try {
      await emit('room:force-add-player', {
        roomId: gameState.roomId,
        physicalId: Number(addForm.physicalId),
        name: addForm.name,
        phone: addForm.phone || '0700000000',
        dob: addForm.dob,
        gender: addForm.gender,
      });
      setShowAddForm(false);
      setAddForm({ name: '', physicalId: '', phone: '', dob: '', gender: 'MALE' });
    } catch (err: any) {
      setLocalError(err.message);
    }
  };

  const handleKick = async (physicalId: number) => {
    try {
      await emit('room:kick-player', { roomId: gameState.roomId, physicalId });
      setKickingId(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="mb-10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-sm font-mono tracking-[0.3em] uppercase text-[#555]">
          AGENT ROSTER: <span className="text-[#C5A059]">{gameState.players.length}</span>
          <span className="text-[#333]"> / {gameState.config.maxPlayers}</span>
        </h2>
        {gameState.players.length < gameState.config.maxPlayers && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="border border-[#2a2a2a] text-[#C5A059] px-4 py-2 hover:bg-[#111] transition-colors font-mono uppercase text-xs tracking-widest"
          >
            + ADD OFFLINE AGENT
          </button>
        )}
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleForceAdd}
            className="noir-card p-6 mb-8 border-[#2a2a2a] overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-[10px] font-mono text-[#555] uppercase tracking-widest mb-1">Physical ID (*)</label>
                <input type="number" value={addForm.physicalId} onChange={(e) => setAddForm({...addForm, physicalId: e.target.value})} className="w-full bg-[#050505] border border-[#2a2a2a] p-2 text-white font-mono outline-none focus:border-[#C5A059]" autoComplete="off" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[#555] uppercase tracking-widest mb-1">Agent Name (*)</label>
                <input type="text" value={addForm.name} onChange={(e) => setAddForm({...addForm, name: e.target.value})} className="w-full bg-[#050505] border border-[#2a2a2a] p-2 text-white font-mono outline-none focus:border-[#C5A059]" autoComplete="off" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[#555] uppercase tracking-widest mb-1">Phone Number</label>
                <input type="text" value={addForm.phone} onChange={(e) => setAddForm({...addForm, phone: e.target.value})} placeholder="0700000000" className="w-full bg-[#050505] border border-[#2a2a2a] p-2 text-white font-mono outline-none focus:border-[#C5A059]" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[#555] uppercase tracking-widest mb-1">Date of Birth</label>
                <input type="date" value={addForm.dob} onChange={(e) => setAddForm({...addForm, dob: e.target.value})} className="w-full bg-[#050505] border border-[#2a2a2a] p-2 text-[#808080] focus:text-white font-mono outline-none focus:border-[#C5A059] block" style={{ colorScheme: 'dark' }} />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[#555] uppercase tracking-widest mb-1">Gender</label>
                <select value={addForm.gender} onChange={(e) => setAddForm({...addForm, gender: e.target.value})} className="w-full bg-[#050505] border border-[#2a2a2a] p-2 text-[#808080] font-mono outline-none focus:border-[#C5A059] focus:text-white block">
                  <option value="MALE">MALE (ذكر)</option>
                  <option value="FEMALE">FEMALE (أنثى)</option>
                </select>
              </div>
            </div>
            {localError && <p className="text-[#8A0303] text-xs font-mono tracking-widest text-center mb-4 uppercase">{localError}</p>}
            <button type="submit" className="bg-[#111] border border-[#C5A059]/50 text-[#C5A059] px-6 py-2 hover:bg-[#C5A059]/10 transition-colors font-mono uppercase text-xs tracking-widest w-full">REGISTER AGENT</button>
          </motion.form>
        )}
      </AnimatePresence>

      {gameState.players.length === 0 ? (
        <div className="noir-card p-12 text-center border-[#2a2a2a]">
          <p className="text-[#808080] text-sm font-mono tracking-[0.2em] uppercase">AWAITING AGENT CONNECTIONS...</p>
          <p className="text-[#555] text-xs mt-4 font-mono tracking-widest uppercase">
            DISTRIBUTE OP_CODE: <span className="text-[#C5A059] font-bold">{gameState.roomCode}</span>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {gameState.players.map((player: any, i: number) => (
            <motion.div
              key={player.physicalId}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              className="bg-[#0c0c0c] border border-[#2a2a2a] p-4 flex flex-col items-center gap-3 relative overflow-hidden group"
            >
              <div className="absolute top-0 left-0 w-full h-[2px] bg-[#C5A059] opacity-30 group-hover:opacity-100 transition-opacity" />
              
              {/* Kick button */}
              <button 
                onClick={() => setKickingId(player.physicalId)}
                className="absolute top-2 right-2 text-[#555] hover:text-[#8A0303] text-lg leading-none"
              >
                &times;
              </button>

              <div className="w-12 h-12 rounded-none bg-[#111] border border-[#2a2a2a] flex items-center justify-center text-[#808080] font-mono text-xl">
                {player.physicalId}
              </div>
              <div className="text-center w-full">
                <p className="font-bold text-sm text-white truncate">{player.name}</p>
                <p className="text-[#C5A059] text-[10px] font-mono tracking-widest uppercase mt-1">VERIFIED</p>
              </div>

              {/* Kick Confirmation Overlay */}
              {kickingId === player.physicalId && (
                <div className="absolute inset-0 bg-[#050505]/95 flex flex-col items-center justify-center p-2 z-10">
                  <span className="text-[#8A0303] text-[10px] font-mono uppercase tracking-widest mb-2 font-bold focus:outline-none">CONFIRM KICK?</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleKick(player.physicalId)} className="bg-[#8A0303] text-white px-3 py-1 text-xs font-mono">YES</button>
                    <button onClick={() => setKickingId(null)} className="bg-[#2a2a2a] text-white px-3 py-1 text-xs font-mono">NO</button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Start Game Button */}
      {gameState.players.length === gameState.config.maxPlayers && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mt-12">
          <button
            onClick={async () => {
              try {
                await emit('room:start-generation', { roomId: gameState.roomId });
              } catch (err: any) {
                setError(err.message);
              }
            }}
            className="btn-premium px-16 py-5 !text-lg !border-[#C5A059]/50"
          >
            <span>START ROLE GENERATION</span>
          </button>
        </motion.div>
      )}
    </div>
  );
}
