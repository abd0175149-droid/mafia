// ══════════════════════════════════════════════════════
// 🎭 Phygital Mafia Engine - الأدوار وخوارزمية التوليد
// المرجع: docs/01_GAME_RULES_AND_ROLES.md
// ══════════════════════════════════════════════════════

// ── الأدوار ────────────────────────────────────────

export enum Role {
  // فريق المافيا
  GODFATHER = 'GODFATHER',           // شيخ المافيا
  SILENCER = 'SILENCER',             // قص المافيا
  CHAMELEON = 'CHAMELEON',           // حرباية المافيا
  MAFIA_REGULAR = 'MAFIA_REGULAR',   // مافيا عادي

  // فريق المواطنين
  SHERIFF = 'SHERIFF',               // الشريف
  DOCTOR = 'DOCTOR',                 // الطبيب
  SNIPER = 'SNIPER',                 // القناص
  POLICEWOMAN = 'POLICEWOMAN',       // الشرطية
  NURSE = 'NURSE',                   // الممرضة
  CITIZEN = 'CITIZEN',               // مواطن صالح
}

// ── تصنيف الفرق ────────────────────────────────────

export const MAFIA_ROLES: Role[] = [
  Role.GODFATHER,
  Role.SILENCER,
  Role.CHAMELEON,
  Role.MAFIA_REGULAR,
];

export const CITIZEN_ROLES: Role[] = [
  Role.SHERIFF,
  Role.DOCTOR,
  Role.SNIPER,
  Role.POLICEWOMAN,
  Role.NURSE,
  Role.CITIZEN,
];

// الأدوار التي لها قدرات ليلية (تظهر في طابور الليل)
export const NIGHT_ACTIVE_ROLES: Role[] = [
  Role.GODFATHER,
  Role.SILENCER,
  Role.SHERIFF,
  Role.DOCTOR,
  Role.SNIPER,
];

export function isMafiaRole(role: Role): boolean {
  return MAFIA_ROLES.includes(role);
}

export function isCitizenRole(role: Role): boolean {
  return CITIZEN_ROLES.includes(role);
}

// ── أسماء الأدوار بالعربي ────────────────────────

export const ROLE_NAMES_AR: Record<Role, string> = {
  [Role.GODFATHER]: 'شيخ المافيا',
  [Role.SILENCER]: 'قص المافيا',
  [Role.CHAMELEON]: 'حرباية المافيا',
  [Role.MAFIA_REGULAR]: 'مافيا عادي',
  [Role.SHERIFF]: 'الشريف',
  [Role.DOCTOR]: 'الطبيب',
  [Role.SNIPER]: 'القناص',
  [Role.POLICEWOMAN]: 'الشرطية',
  [Role.NURSE]: 'الممرضة',
  [Role.CITIZEN]: 'مواطن صالح',
};

// ── خوارزمية التوليد ────────────────────────────────
// المرجع: docs/02_LOBBY_AND_SETUP.md - القسم 2
// المافيا: Math.ceil(N / 4)
// ترتيب المافيا الإجباري: شيخ ➔ قص ➔ حرباية ➔ مافيا عادي
// ترتيب المواطنين الإجباري: شريف ➔ طبيب ➔ قناص ➔ شرطية ➔ ممرضة ➔ مواطن صالح

export interface GeneratedRoles {
  mafiaRoles: Role[];
  citizenRoles: Role[];
  totalMafia: number;
  totalCitizens: number;
}

export function generateRoles(playerCount: number): GeneratedRoles {
  if (playerCount < 6) {
    throw new Error('يجب أن يكون عدد اللاعبين 6 على الأقل');
  }

  const totalMafia = Math.ceil(playerCount / 4);
  const totalCitizens = playerCount - totalMafia;

  // ── توليد أدوار المافيا بالترتيب الإجباري ──
  const mafiaOrder: Role[] = [
    Role.GODFATHER,
    Role.SILENCER,
    Role.CHAMELEON,
    Role.MAFIA_REGULAR,
  ];

  const mafiaRoles: Role[] = [];
  for (let i = 0; i < totalMafia; i++) {
    if (i < mafiaOrder.length - 1) {
      // الأدوار الخاصة أولاً (شيخ، قص، حرباية)
      mafiaRoles.push(mafiaOrder[i]);
    } else {
      // الباقي مافيا عادي
      mafiaRoles.push(Role.MAFIA_REGULAR);
    }
  }

  // ── توليد أدوار المواطنين بالترتيب الإجباري ──
  const citizenOrder: Role[] = [
    Role.SHERIFF,
    Role.DOCTOR,
    Role.SNIPER,
    Role.POLICEWOMAN,
    Role.NURSE,
    Role.CITIZEN,
  ];

  const citizenRoles: Role[] = [];
  for (let i = 0; i < totalCitizens; i++) {
    if (i < citizenOrder.length - 1) {
      // الأدوار الخاصة أولاً
      citizenRoles.push(citizenOrder[i]);
    } else {
      // الباقي مواطن صالح
      citizenRoles.push(Role.CITIZEN);
    }
  }

  return {
    mafiaRoles,
    citizenRoles,
    totalMafia,
    totalCitizens,
  };
}

// ── التحقق من صحة التوزيع ────────────────────────

export function validateRoleDistribution(roles: Role[], playerCount: number): { valid: boolean; error?: string } {
  if (roles.length !== playerCount) {
    return { valid: false, error: `عدد الأدوار (${roles.length}) لا يتطابق مع عدد اللاعبين (${playerCount})` };
  }

  const mafiaCount = roles.filter(r => isMafiaRole(r)).length;
  const citizenCount = roles.filter(r => isCitizenRole(r)).length;

  // يجب أن يكون هناك شيخ مافيا واحد على الأقل
  if (!roles.includes(Role.GODFATHER)) {
    return { valid: false, error: 'يجب أن يكون هناك شيخ مافيا واحد على الأقل' };
  }

  // يجب أن يكون عدد المافيا أقل من المواطنين لبدء اللعبة
  if (mafiaCount >= citizenCount) {
    return { valid: false, error: 'عدد المافيا يجب أن يكون أقل من عدد المواطنين عند بدء اللعبة' };
  }

  return { valid: true };
}
