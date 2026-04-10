// ══════════════════════════════════════════════════════
// 📦 خدمة الغرف (Session Service)
// إنشاء وإدارة غرف الألعاب (Session) في PostgreSQL
// ══════════════════════════════════════════════════════

import { eq, desc } from 'drizzle-orm';
import { getDB } from '../config/db.js';
import { sessions, sessionPlayers } from '../schemas/drizzle.js';

// ── إنشاء غرفة جديدة ────────────────────────────────
export async function createSession(
  sessionName: string,
  sessionCode: string,
  displayPin: string,
  maxPlayers: number,
): Promise<number | null> {
  const db = getDB();
  if (!db) {
    console.warn('⚠️ PostgreSQL unavailable — session not saved');
    return null;
  }

  try {
    const result = await db.insert(sessions).values({
      sessionCode,
      displayPin,
      sessionName,
      maxPlayers,
      isActive: true,
    }).returning({ id: sessions.id });

    const sessionId = result[0]?.id;
    console.log(`📦 Session #${sessionId} created: ${sessionName}`);
    return sessionId;
  } catch (err: any) {
    console.error('❌ Failed to create session:', err.message);
    return null;
  }
}

// ── إضافة لاعب للغرفة ──────────────────────────────
export async function addPlayerToSession(
  sessionId: number,
  physicalId: number,
  playerName: string,
  phone?: string,
  gender?: string,
  dateOfBirth?: string,
): Promise<void> {
  const db = getDB();
  if (!db) return;

  try {
    // تحقق إذا اللاعب موجود بنفس الـ physicalId
    const existing = await db.select()
      .from(sessionPlayers)
      .where(eq(sessionPlayers.sessionId, sessionId))
      .then(rows => rows.find(r => r.physicalId === physicalId));

    if (existing) {
      // تحديث البيانات
      await db.update(sessionPlayers)
        .set({
          playerName,
          phone: phone || existing.phone,
          gender: gender || existing.gender,
          dateOfBirth: dateOfBirth || existing.dateOfBirth,
        })
        .where(eq(sessionPlayers.id, existing.id));
    } else {
      // إضافة جديد
      await db.insert(sessionPlayers).values({
        sessionId,
        physicalId,
        playerName,
        phone: phone || null,
        gender: gender || 'MALE',
        dateOfBirth: dateOfBirth || null,
      });
    }
  } catch (err: any) {
    console.error('❌ Failed to add player to session:', err.message);
  }
}

// ── جلب لاعبي الغرفة ──────────────────────────────
export async function getSessionPlayers(sessionId: number) {
  const db = getDB();
  if (!db) return [];

  try {
    return await db.select()
      .from(sessionPlayers)
      .where(eq(sessionPlayers.sessionId, sessionId));
  } catch (err: any) {
    console.error('❌ Failed to fetch session players:', err.message);
    return [];
  }
}

// ── حذف لاعب من الغرفة ─────────────────────────────
export async function removePlayerFromSession(sessionId: number, physicalId: number): Promise<void> {
  const db = getDB();
  if (!db) return;

  try {
    const rows = await db.select()
      .from(sessionPlayers)
      .where(eq(sessionPlayers.sessionId, sessionId));
    
    const target = rows.find(r => r.physicalId === physicalId);
    if (target) {
      await db.delete(sessionPlayers).where(eq(sessionPlayers.id, target.id));
    }
  } catch (err: any) {
    console.error('❌ Failed to remove player from session:', err.message);
  }
}

// ── إغلاق الغرفة ───────────────────────────────────
export async function closeSession(sessionId: number): Promise<void> {
  const db = getDB();
  if (!db) return;

  try {
    await db.update(sessions)
      .set({ isActive: false })
      .where(eq(sessions.id, sessionId));
  } catch (err: any) {
    console.error('❌ Failed to close session:', err.message);
  }
}
