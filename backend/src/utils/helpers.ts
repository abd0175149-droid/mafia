// ══════════════════════════════════════════════════════
// 🔧 أدوات مساعدة (Utilities)
// ══════════════════════════════════════════════════════

/**
 * توليد كود غرفة عشوائي (6 أحرف)
 */
export function generateCode(length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // بدون أحرف مشابهة (0/O, 1/I/L)
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * تنسيق اللاعب حسب القاعدة البصرية الموحدة
 * #الرقم - الاسم
 */
export function formatPlayer(physicalId: number, name: string): string {
  return `#${physicalId} - ${name}`;
}

/**
 * تأخير (للأنيميشنات والتوقيت)
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
