'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import { Role, ROLE_NAMES, ROLE_ICONS } from '@/lib/constants';
import MafiaCard from '@/components/MafiaCard';

interface LeaderRoleBindingProps {
  gameState: any;
  emit: (event: string, payload: any) => Promise<any>;
  setError: (err: string) => void;
}

// ── Draggable Chip ──
function DraggableRoleChip({ role, id, isDragOverlay }: { role: Role; id: string; isDragOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { role },
  });

  const isMafia = [Role.GODFATHER, Role.SILENCER, Role.CHAMELEON, Role.MAFIA_REGULAR].includes(role);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`relative inline-flex items-center gap-2 px-4 py-2 border cursor-grab select-none shadow-lg transition-transform ${
        isMafia ? 'bg-[#0f0505] border-[#8A0303] text-white' : 'bg-[#050505] border-[#555] text-white'
      } ${isDragging && !isDragOverlay ? 'opacity-0' : 'opacity-100'}`}
      style={{
        transform: isDragOverlay ? 'scale(1.1) rotate(-3deg)' : 'none',
        zIndex: isDragOverlay ? 999 : 'auto',
      }}
    >
      <span className="grayscale">{ROLE_ICONS[role]}</span>
      <span className="font-mono text-xs uppercase tracking-widest leading-none">{ROLE_NAMES[role]}</span>
    </div>
  );
}

// ── Droppable Player Card ──
function DroppablePlayerCard({ player, children }: { player: any; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `player-${player.physicalId}`,
    data: { physicalId: player.physicalId },
  });

  const isFemale = player.gender === 'FEMALE';

  return (
    <div
      ref={setNodeRef}
      className={`p-3 flex flex-col items-center gap-3 relative transition-all rounded-xl border ${
        isOver 
          ? 'border-[#C5A059] bg-[#C5A059]/10 shadow-[0_0_20px_rgba(197,160,89,0.3)]' 
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
      <div className={`w-full max-w-[140px] h-10 mt-1 border border-dashed rounded-md flex items-center justify-center z-10 relative overflow-hidden transition-colors ${isOver ? 'border-[#C5A059] bg-black/80' : 'border-[#555]/60 bg-[#050505]'}`}>
        {children || <span className="text-[9px] text-[#555] font-mono tracking-widest uppercase relative z-0">DROP ROLE</span>}
      </div>
    </div>
  );
}

export default function LeaderRoleBinding({ gameState, emit, setError }: LeaderRoleBindingProps) {
  const [unboundRoles, setUnboundRoles] = useState<{ id: string; role: Role }[]>([]);
  const [boundPlayers, setBoundPlayers] = useState<Record<number, { id: string; role: Role }>>({});
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // ── Initialize State from GameState ──
  useEffect(() => {
    if (!gameState) return;

    // Build the initial pool from the raw config (rolesPool)
    const pool = [...(gameState.rolesPool || [])];
    
    // Check which roles are already bound to players and subtract them
    const initialBounds: Record<number, { id: string; role: Role }> = {};
    let roleIdCounter = 0;

    gameState.players.forEach((p: any) => {
      if (p.role) {
        initialBounds[p.physicalId] = { id: `role-${roleIdCounter++}`, role: p.role };
        // Remove one instance from pool
        const idx = pool.indexOf(p.role);
        if (idx !== -1) pool.splice(idx, 1);
      }
    });

    const initialUnbounds = pool.map(role => ({ id: `role-${roleIdCounter++}`, role }));

    setBoundPlayers(initialBounds);
    setUnboundRoles(initialUnbounds);
  }, [gameState.rolesPool, gameState.players]);

  // ── Drag & Drop Handlers ──
  const handleDragStart = (event: any) => {
    setActiveDragId(event.active.id);
  };

  const handleDragEnd = async (event: any) => {
    setActiveDragId(null);
    const { active, over } = event;

    if (!over) {
      // Dropped on empty space
      // If it came from a player, we unbind it
      const fromPlayerId = Object.keys(boundPlayers).find(pid => boundPlayers[Number(pid)].id === active.id);
      if (fromPlayerId) {
        const roleData = boundPlayers[Number(fromPlayerId)];
        
        try {
          // Emit unbind if backend supports it, but backend mostly overwrites. 
          // Not critical unless we prevent starting, but we can set it to normal citizen or just leave it.
          // Better yet, prevent unbinding! Only swap or bind.
          // For now, let's allow unbinding locally. In actual production we might want to ensure they rebind it.
          const newBounds = { ...boundPlayers };
          delete newBounds[Number(fromPlayerId)];
          setBoundPlayers(newBounds);
          setUnboundRoles(prev => [...prev, roleData]);
        } catch (err: any) {
          setError(err.message);
        }
      }
      return;
    }

    const targetPhysicalId = over.data.current?.physicalId;
    if (!targetPhysicalId) return;

    // Find the dragged role
    let draggedRoleData = unboundRoles.find(r => r.id === active.id);
    let fromPlayerId: number | null = null;
    
    if (!draggedRoleData) {
      // Must be dragging from another player
      const pidStr = Object.keys(boundPlayers).find(pid => boundPlayers[Number(pid)].id === active.id);
      if (pidStr) {
        fromPlayerId = Number(pidStr);
        draggedRoleData = boundPlayers[fromPlayerId];
      }
    }

    if (!draggedRoleData) return;

    // Target might already have a role (Swap)
    const existingTargetRole = boundPlayers[targetPhysicalId];

    try {
      // Bind to backend
      await emit('setup:bind-role', { roomId: gameState.roomId, physicalId: targetPhysicalId, role: draggedRoleData.role });

      // Update Local State
      setBoundPlayers(prev => ({
        ...prev,
        [targetPhysicalId]: draggedRoleData,
        ...(fromPlayerId ? { [fromPlayerId]: existingTargetRole } : {}) // Swap if needed
      }));

      if (!fromPlayerId) {
        setUnboundRoles(prev => prev.filter(r => r.id !== active.id));
        if (existingTargetRole) {
          setUnboundRoles(prev => [...prev, existingTargetRole]);
        }
      }

      // If Swap, theoretically we need to update the backend for the fromPlayerId too
      if (fromPlayerId && existingTargetRole) {
        await emit('setup:bind-role', { roomId: gameState.roomId, physicalId: fromPlayerId, role: existingTargetRole.role });
      }

    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStartGame = async () => {
    // Cannot start if there are essential roles left unbound
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

  // Find dragged item for Overlay
  const draggedItem = activeDragId 
    ? [...unboundRoles, ...Object.values(boundPlayers)].find(r => r.id === activeDragId) 
    : null;

  return (
    <div className="mb-10 w-full max-w-6xl mx-auto">
      {/* Header Container */}
      <div className="bg-black/30 border border-[#2a2a2a] rounded-xl p-8 mb-8 backdrop-blur-sm relative overflow-hidden text-center">
        <div className="absolute left-0 top-0 w-1 h-full bg-[#C5A059]/40" />
        <h2 className="text-3xl font-black text-white" style={{ fontFamily: 'Amiri, serif' }}>توزيع الأدوار والسِّريّة</h2>
        <p className="text-[#808080] font-mono tracking-[0.3em] mt-3 uppercase text-xs">ROLE SYNC AUTHORIZATION & CLASSIFICATION</p>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Unbound Roles Pool */}
        <div className="bg-black/40 border border-[#8A0303]/30 rounded-xl p-6 mb-8 backdrop-blur-sm min-h-[140px] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-l from-transparent via-[#8A0303]/50 to-transparent" />
          <h3 className="text-xs font-mono text-[#C5A059] uppercase tracking-[0.2em] mb-4 font-bold border-b border-[#2a2a2a] pb-3">
            Unassigned Action Chips ({unboundRoles.filter(r => r.role !== Role.CITIZEN).length})
          </h3>
          <div className="flex flex-wrap gap-3 items-center">
            {unboundRoles.filter(r => r.role !== Role.CITIZEN).map(r => (
              <DraggableRoleChip key={r.id} id={r.id} role={r.role} />
            ))}
            {unboundRoles.filter(r => r.role !== Role.CITIZEN).length === 0 && (
              <p className="text-[#808080] font-mono text-xs w-full text-center">ALL ACTION CHIPS ASSIGNED</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-6 mb-12">
          {gameState.players.map((player: any) => {
            const boundRoleData = boundPlayers[player.physicalId];
            return (
              <DroppablePlayerCard key={player.physicalId} player={player}>
                <AnimatePresence>
                  {boundRoleData && (
                    <motion.div
                      key={boundRoleData.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center w-full h-full bg-[#050505] z-20"
                    >
                      <DraggableRoleChip id={boundRoleData.id} role={boundRoleData.role} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </DroppablePlayerCard>
            );
          })}
        </div>

        {/* Drag Overlay for smooth animation */}
        <DragOverlay zIndex={1000}>
          {draggedItem ? <DraggableRoleChip id={draggedItem.id} role={draggedItem.role} isDragOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {/* Start Button */}
      <div className="text-center">
        <button
          onClick={handleStartGame}
          disabled={unboundRoles.filter(r => r.role !== Role.CITIZEN).length > 0 || loading}
          className="btn-premium px-12 py-4 disabled:opacity-50 disabled:grayscale transition-all"
        >
          <span className="text-white">{loading ? 'INITIALIZING...' : 'LOCK IDENTITIES & COMMENCE DAY'}</span>
        </button>
        {unboundRoles.filter(r => r.role !== Role.CITIZEN).length > 0 && (
          <p className="text-[#8A0303] text-[10px] font-mono mt-4 uppercase tracking-[0.2em] animate-pulse">
            WARNING: {unboundRoles.filter(r => r.role !== Role.CITIZEN).length} ACTION CHIPS UNASSIGNED
          </p>
        )}
      </div>
    </div>
  );
}
