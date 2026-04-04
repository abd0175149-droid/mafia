'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameState } from '@/hooks/useGameState';

export default function PlayerPage() {
  const { joinRoom, isConnected, error, loading } = useGameState();
  const [step, setStep] = useState<'scan' | 'register' | 'done'>('scan');
  const [roomId, setRoomId] = useState('');
  const [physicalId, setPhysicalId] = useState('');
  const [name, setName] = useState('');

  const handleJoin = async () => {
    if (!roomId || !physicalId || !name) return;
    try {
      await joinRoom(roomId, parseInt(physicalId), name);
      setStep('done');
    } catch (err) {
      console.error('Failed to join:', err);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 max-w-sm w-full"
      >
        {step === 'scan' && (
          <div className="text-center">
            <div className="text-6xl mb-6">📱</div>
            <h1 className="text-2xl font-bold mb-6">الانضمام للعبة</h1>

            <div className="mb-4">
              <label className="block text-sm text-dark-400 mb-2 text-right">كود الغرفة</label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                placeholder="أدخل كود الغرفة"
                className="w-full p-3 rounded-xl bg-dark-800 border border-dark-600 text-white text-center font-mono text-xl tracking-widest focus:border-gold-500 focus:outline-none transition-colors"
                maxLength={8}
              />
            </div>

            <button
              onClick={() => roomId && setStep('register')}
              disabled={!roomId || !isConnected}
              className="btn-secondary w-full mt-4"
            >
              التالي ←
            </button>
          </div>
        )}

        {step === 'register' && (
          <div>
            <h2 className="text-xl font-bold mb-6 text-center">بيانات التسجيل</h2>

            <div className="mb-4">
              <label className="block text-sm text-dark-400 mb-2">رقم الكارت الفيزيائي</label>
              <input
                type="number"
                value={physicalId}
                onChange={(e) => setPhysicalId(e.target.value)}
                placeholder="مثال: 4"
                className="w-full p-3 rounded-xl bg-dark-800 border border-dark-600 text-white text-center text-2xl font-bold focus:border-gold-500 focus:outline-none transition-colors"
                min={1}
                max={30}
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm text-dark-400 mb-2">الاسم المستعار</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: محمود"
                className="w-full p-3 rounded-xl bg-dark-800 border border-dark-600 text-white text-center text-xl focus:border-gold-500 focus:outline-none transition-colors"
                maxLength={20}
              />
            </div>

            {physicalId && name && (
              <div className="glass-card p-3 mb-6 text-center">
                <p className="text-dark-400 text-xs mb-1">ستظهر كـ</p>
                <p className="text-xl font-bold text-gold-400">
                  #{physicalId} - {name}
                </p>
              </div>
            )}

            <button
              onClick={handleJoin}
              disabled={!physicalId || !name || loading}
              className="btn-primary w-full"
            >
              {loading ? '⏳ جاري التسجيل...' : '✓ تأكيد التسجيل'}
            </button>

            {error && <p className="text-mafia-400 text-sm mt-4 text-center">{error}</p>}
          </div>
        )}

        {step === 'done' && (
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="text-center"
          >
            <motion.div
              className="text-7xl mb-6"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: 2 }}
            >
              ✅
            </motion.div>
            <h2 className="text-2xl font-bold mb-2 text-emerald-400">تم التسجيل بنجاح!</h2>
            <p className="text-xl font-bold text-gold-400 mb-4">
              #{physicalId} - {name}
            </p>
            <div className="glass-card p-4">
              <p className="text-dark-400">
                يمكنك الآن إغلاق الهاتف والانتظار حتى يبدأ الليدر اللعبة 🎭
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
