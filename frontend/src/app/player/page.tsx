'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameState } from '@/hooks/useGameState';

type Step = 'code' | 'phone' | 'register' | 'number' | 'done';

export default function PlayerPage() {
  return <PlayerFlow />;
}

function PlayerFlow({ initialRoomCode = '' }: { initialRoomCode?: string }) {
  const { joinRoom, isConnected, error, loading, emit } = useGameState();
  const [step, setStep] = useState<Step>(initialRoomCode ? 'phone' : 'code');
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [roomId, setRoomId] = useState('');
  const [gameName, setGameName] = useState('');
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [physicalId, setPhysicalId] = useState('');
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [apiError, setApiError] = useState('');

  // ── الخطوة 1: إدخال كود اللعبة ──
  const handleFindRoom = async () => {
    setApiError('');
    try {
      const res = await emit('room:find-by-code', { roomCode: roomCode.trim() });
      setRoomId(res.roomId);
      setGameName(res.gameName);
      setStep('phone');
    } catch (err: any) {
      setApiError(err.message);
    }
  };

  // ── الخطوة 2: البحث بالهاتف ──
  const handlePhoneLookup = async () => {
    setApiError('');
    const normalized = phone.startsWith('0') ? phone : '0' + phone;
    try {
      const res = await fetch('/api/player/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized }),
      });
      const data = await res.json();

      if (data.found && data.player) {
        setDisplayName(data.player.displayName);
        setPlayerId(data.player.id);
        setStep('number'); // لاعب سابق → مباشرة لرقم اللعبة
      } else {
        setStep('register'); // لاعب جديد → تسجيل البيانات
      }
    } catch (err) {
      setApiError('خطأ في الاتصال');
    }
  };

  // ── الخطوة 3: تسجيل لاعب جديد ──
  const handleRegister = async () => {
    setApiError('');
    const normalized = phone.startsWith('0') ? phone : '0' + phone;
    const dateOfBirth = dobYear && dobMonth && dobDay
      ? `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`
      : null;

    try {
      const res = await fetch('/api/player/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: normalized,
          displayName,
          dateOfBirth,
          gender: gender || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPlayerId(data.player.id);
        setStep('number');
      } else {
        setApiError(data.error);
      }
    } catch (err) {
      setApiError('خطأ في الاتصال');
    }
  };

  // ── الخطوة 4: الانضمام للعبة ──
  const handleJoinGame = async () => {
    if (!physicalId || !displayName) return;
    setApiError('');
    try {
      await joinRoom(roomId, parseInt(physicalId), displayName, phone, playerId || undefined);
      setStep('done');
    } catch (err: any) {
      setApiError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 max-w-sm w-full"
      >
        <AnimatePresence mode="wait">

          {/* ── خطوة 1: كود اللعبة ── */}
          {step === 'code' && (
            <motion.div key="code" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-6">
                <div className="text-5xl mb-4">🎮</div>
                <h1 className="text-2xl font-bold mb-2">الانضمام للعبة</h1>
                <p className="text-dark-400 text-sm">أدخل كود اللعبة المكون من 6 أرقام</p>
              </div>

              <input
                type="text"
                inputMode="numeric"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full p-4 rounded-xl bg-dark-800 border border-dark-600 text-white text-center font-mono text-3xl tracking-[0.5em] focus:border-gold-500 focus:outline-none transition-colors"
                maxLength={6}
                autoFocus
              />

              {apiError && <p className="text-mafia-400 text-sm text-center mt-3">{apiError}</p>}

              <button
                onClick={handleFindRoom}
                disabled={roomCode.length !== 6 || !isConnected}
                className="btn-primary w-full mt-6 disabled:opacity-50"
              >
                {isConnected ? 'التالي ←' : '⏳ جاري الاتصال...'}
              </button>
            </motion.div>
          )}

          {/* ── خطوة 2: رقم الهاتف ── */}
          {step === 'phone' && (
            <motion.div key="phone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-6">
                <div className="text-5xl mb-4">📱</div>
                <h1 className="text-2xl font-bold mb-2">{gameName || 'لعبة مافيا'}</h1>
                <p className="text-dark-400 text-sm">أدخل رقم هاتفك للتسجيل</p>
              </div>

              <div className="flex items-center gap-2 mb-6">
                <span className="bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 text-dark-300 font-mono text-lg shrink-0">
                  +962
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="7XXXXXXXX"
                  className="w-full p-3 rounded-xl bg-dark-800 border border-dark-600 text-white font-mono text-lg focus:border-gold-500 focus:outline-none transition-colors"
                  maxLength={10}
                  autoFocus
                />
              </div>

              {apiError && <p className="text-mafia-400 text-sm text-center mb-3">{apiError}</p>}

              <button
                onClick={handlePhoneLookup}
                disabled={phone.length < 9}
                className="btn-primary w-full disabled:opacity-50"
              >
                التالي ←
              </button>
            </motion.div>
          )}

          {/* ── خطوة 3: التسجيل (للجدد) ── */}
          {step === 'register' && (
            <motion.div key="register" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-5">
                <h2 className="text-xl font-bold mb-1">مرحباً بك! 🎉</h2>
                <p className="text-dark-400 text-sm">أكمل بياناتك للتسجيل</p>
              </div>

              {/* الاسم */}
              <div className="mb-4">
                <label className="block text-sm text-dark-400 mb-1">الاسم المستعار</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="مثال: محمود"
                  className="w-full p-3 rounded-xl bg-dark-800 border border-dark-600 text-white text-center text-lg focus:border-gold-500 focus:outline-none transition-colors"
                  maxLength={20}
                  autoFocus
                />
              </div>

              {/* تاريخ الميلاد */}
              <div className="mb-4">
                <label className="block text-sm text-dark-400 mb-1">تاريخ الميلاد</label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={dobDay}
                    onChange={(e) => setDobDay(e.target.value)}
                    className="p-3 rounded-xl bg-dark-800 border border-dark-600 text-white text-center focus:border-gold-500 focus:outline-none"
                  >
                    <option value="">يوم</option>
                    {Array.from({ length: 31 }, (_, i) => (
                      <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                    ))}
                  </select>
                  <select
                    value={dobMonth}
                    onChange={(e) => setDobMonth(e.target.value)}
                    className="p-3 rounded-xl bg-dark-800 border border-dark-600 text-white text-center focus:border-gold-500 focus:outline-none"
                  >
                    <option value="">شهر</option>
                    {['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
                      .map((m, i) => (
                        <option key={i + 1} value={String(i + 1)}>{m}</option>
                      ))}
                  </select>
                  <select
                    value={dobYear}
                    onChange={(e) => setDobYear(e.target.value)}
                    className="p-3 rounded-xl bg-dark-800 border border-dark-600 text-white text-center focus:border-gold-500 focus:outline-none"
                  >
                    <option value="">سنة</option>
                    {Array.from({ length: 50 }, (_, i) => {
                      const year = new Date().getFullYear() - 8 - i;
                      return <option key={year} value={String(year)}>{year}</option>;
                    })}
                  </select>
                </div>
              </div>

              {/* الجنس */}
              <div className="mb-6">
                <label className="block text-sm text-dark-400 mb-2">الجنس</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setGender('male')}
                    className={`p-3 rounded-xl border text-center font-bold transition-all ${
                      gender === 'male'
                        ? 'bg-citizen-600/30 border-citizen-500 text-citizen-400'
                        : 'bg-dark-800 border-dark-600 text-dark-400 hover:border-dark-500'
                    }`}
                  >
                    ♂ ذكر
                  </button>
                  <button
                    onClick={() => setGender('female')}
                    className={`p-3 rounded-xl border text-center font-bold transition-all ${
                      gender === 'female'
                        ? 'bg-mafia-600/30 border-mafia-500 text-mafia-400'
                        : 'bg-dark-800 border-dark-600 text-dark-400 hover:border-dark-500'
                    }`}
                  >
                    ♀ أنثى
                  </button>
                </div>
              </div>

              {apiError && <p className="text-mafia-400 text-sm text-center mb-3">{apiError}</p>}

              <button
                onClick={handleRegister}
                disabled={!displayName}
                className="btn-primary w-full disabled:opacity-50"
              >
                التالي ←
              </button>
            </motion.div>
          )}

          {/* ── خطوة 4: رقم اللاعب ── */}
          {step === 'number' && (
            <motion.div key="number" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">👋</div>
                <h2 className="text-xl font-bold mb-1">أهلاً {displayName}!</h2>
                <p className="text-dark-400 text-sm">اختر رقمك في اللعبة</p>
              </div>

              <input
                type="number"
                inputMode="numeric"
                value={physicalId}
                onChange={(e) => setPhysicalId(e.target.value)}
                placeholder="رقمك"
                className="w-full p-4 rounded-xl bg-dark-800 border border-dark-600 text-white text-center text-4xl font-black focus:border-gold-500 focus:outline-none transition-colors"
                min={1}
                max={27}
                autoFocus
              />

              {physicalId && (
                <div className="glass-card p-3 mt-4 text-center">
                  <p className="text-dark-400 text-xs mb-1">ستظهر كـ</p>
                  <p className="text-xl font-bold text-gold-400">
                    #{physicalId} - {displayName}
                  </p>
                </div>
              )}

              {apiError && <p className="text-mafia-400 text-sm text-center mt-3">{apiError}</p>}

              <button
                onClick={handleJoinGame}
                disabled={!physicalId || loading}
                className="btn-primary w-full mt-6 disabled:opacity-50"
              >
                {loading ? '⏳ جاري الدخول...' : '🎮 دخول اللعبة'}
              </button>
            </motion.div>
          )}

          {/* ── خطوة 5: تم ── */}
          {step === 'done' && (
            <motion.div key="done" initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center">
              <motion.div
                className="text-7xl mb-6"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: 2 }}
              >
                ✅
              </motion.div>
              <h2 className="text-2xl font-bold mb-2 text-emerald-400">تم التسجيل بنجاح!</h2>
              <p className="text-xl font-bold text-gold-400 mb-4">
                #{physicalId} - {displayName}
              </p>
              <div className="glass-card p-4">
                <p className="text-dark-400">
                  يمكنك الآن إغلاق الهاتف والانتظار حتى يبدأ الليدر اللعبة 🎭
                </p>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
