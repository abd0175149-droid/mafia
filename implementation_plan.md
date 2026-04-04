# 🎭 خطة تنفيذ مشروع Phygital Mafia Engine

## الهدف النهائي
بناء نظام كامل لإدارة ألعاب المافيا الهجينة يتكون من: واجهة ليدر (Leader Dashboard)، شاشة عرض سينمائية (Display Screen)، وصفحة هاتف اللاعب (Player Mobile) - جميعها متصلة عبر Socket.IO بحالة حية في Redis.

## ناتج التسليم
- مشروع Next.js للـ Frontend (3 واجهات)
- سيرفر Node.js + Socket.IO للـ Backend
- تهيئة Redis + PostgreSQL
- ملف Docker Compose للنشر

---

## 📂 هيكل المجلدات المستهدف

```
c:\Projects\mafia\
├── README.md
├── docs/                          # ← التوثيق (جاهز ✅)
├── docker-compose.yml
├── deploy.sh
│
├── backend/
│   ├── package.json
│   ├── Dockerfile
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts               # نقطة الدخول (Express + Socket.IO)
│   │   ├── config/
│   │   │   ├── redis.ts            # اتصال Redis
│   │   │   ├── db.ts               # اتصال PostgreSQL + Drizzle
│   │   │   └── env.ts              # متغيرات البيئة
│   │   ├── schemas/
│   │   │   └── drizzle.ts          # جداول Users, Matches, Surveys
│   │   ├── game/
│   │   │   ├── state.ts            # GameState manager (CRUD on Redis)
│   │   │   ├── roles.ts            # Roles enum + Role Generation algorithm
│   │   │   ├── night-resolver.ts   # معالج التقاطعات الليلية
│   │   │   ├── vote-engine.ts      # محرك التصويت + كسر التعادل
│   │   │   ├── deal-engine.ts      # محرك الاتفاقيات
│   │   │   └── win-checker.ts      # فحص شروط الفوز
│   │   ├── sockets/
│   │   │   ├── lobby.socket.ts     # أحداث اللوبي
│   │   │   ├── game.socket.ts      # أحداث اللعبة العامة
│   │   │   ├── day.socket.ts       # أحداث النهار
│   │   │   └── night.socket.ts     # أحداث الليل
│   │   ├── routes/
│   │   │   ├── auth.routes.ts      # Google OAuth
│   │   │   └── stats.routes.ts     # Leaderboard + إحصائيات
│   │   └── utils/
│   │       └── helpers.ts
│   └── drizzle/
│       └── migrations/
│
├── frontend/
│   ├── package.json
│   ├── Dockerfile
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── public/
│   │   ├── sounds/                 # مؤثرات صوتية
│   │   └── assets/                 # صور وأيقونات
│   └── src/
│       ├── app/
│       │   ├── layout.tsx          # Root layout + خطوط
│       │   ├── page.tsx            # الصفحة الرئيسية (اختيار الدور)
│       │   ├── leader/
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx        # لوحة الليدر الرئيسية
│       │   │   ├── lobby/page.tsx  # شاشة اللوبي لليدر
│       │   │   ├── setup/page.tsx  # توليد الأدوار + Drag & Drop
│       │   │   ├── day/page.tsx    # محرك النهار
│       │   │   └── night/page.tsx  # محرك الليل
│       │   ├── display/
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx        # شاشة العرض الرئيسية
│       │   │   ├── lobby/page.tsx  # عرض QR + عداد اللاعبين
│       │   │   ├── day/page.tsx    # عرض التصويت السينمائي
│       │   │   └── night/page.tsx  # عرض أنيميشن الليل
│       │   └── player/
│       │       ├── page.tsx        # مسح QR + تسجيل
│       │       └── join/page.tsx   # إدخال الرقم والاسم
│       ├── components/
│       │   ├── ui/                 # مكونات عامة (Button, Card, Modal...)
│       │   ├── leader/             # مكونات خاصة بالليدر
│       │   │   ├── PlayerCard.tsx
│       │   │   ├── RoleChip.tsx
│       │   │   ├── DealCard.tsx
│       │   │   ├── VoteCounter.tsx
│       │   │   ├── NightQueue.tsx
│       │   │   └── MorningRecap.tsx
│       │   └── display/            # مكونات شاشة العرض
│       │       ├── CinematicCard.tsx
│       │       ├── VoteBar.tsx
│       │       ├── NightAnimation.tsx
│       │       └── WinScreen.tsx
│       ├── hooks/
│       │   ├── useSocket.ts        # Socket.IO hook
│       │   └── useGameState.ts     # حالة اللعبة المحلية
│       ├── lib/
│       │   ├── socket.ts           # Socket.IO client setup
│       │   └── constants.ts        # Roles, Phases enums
│       └── styles/
│           └── globals.css         # Tailwind base + تخصيصات
```

---

## المرحلة 1️⃣: البنية التحتية والتهيئة (Foundation)

> **المرجع:** [README.md](file:///c:/Projects/mafia/README.md) + [06_DEPLOYMENT_GUIDE.md](file:///c:/Projects/mafia/docs/06_DEPLOYMENT_GUIDE.md)

### 1.1 تهيئة المشروع الجذري

| الملف | الوصف |
|---|---|
| `docker-compose.yml` | تعريف 4 خدمات: frontend, backend, redis, postgres مع الشبكة والـ volumes |
| `.env.example` | متغيرات البيئة: `REDIS_URL`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| `.gitignore` | استثناء node_modules, .env, dist, .next |
| `deploy.sh` | سكربت النشر الآلي (جاهز في التوثيق) |

### 1.2 تهيئة Backend (Node.js + TypeScript)

| الخطوة | التفاصيل |
|---|---|
| إنشاء `backend/package.json` | Dependencies: `express`, `socket.io`, `redis`, `drizzle-orm`, `pg`, `passport-google-oauth20`, `cors`, `dotenv` |
| إنشاء `backend/tsconfig.json` | Target: ES2022, Module: NodeNext |
| إنشاء `backend/Dockerfile` | Node 20 Alpine, multi-stage build |
| إنشاء `backend/src/config/env.ts` | تحميل متغيرات البيئة مع validation |
| إنشاء `backend/src/config/redis.ts` | اتصال Redis client + helper functions (`getGameState`, `setGameState`) |
| إنشاء `backend/src/config/db.ts` | اتصال PostgreSQL عبر Drizzle ORM |
| إنشاء `backend/src/index.ts` | Express server + Socket.IO initialization على Port 4000 |

### 1.3 تهيئة Frontend (Next.js + Tailwind + Framer Motion)

| الخطوة | التفاصيل |
|---|---|
| إنشاء مشروع Next.js | `npx -y create-next-app@latest ./frontend` مع TypeScript + Tailwind |
| إضافة Framer Motion | `framer-motion` للأنيميشن السينمائية |
| إنشاء `frontend/Dockerfile` | Node 20 Alpine, build + serve |
| تهيئة `globals.css` | نظام ألوان داكن (Dark Theme)، خطوط عربية، متغيرات CSS |
| إنشاء `frontend/src/lib/socket.ts` | Socket.IO client يتصل بالـ backend |
| إنشاء `frontend/src/lib/constants.ts` | TypeScript enums: `Role`, `Phase`, `CandidateType` |

### ✅ معيار القبول للمرحلة 1
- `docker-compose up` يرفع جميع الخدمات بدون أخطاء
- Frontend يفتح على `localhost:3000`
- Backend يستجيب على `localhost:4000`
- Redis و PostgreSQL متصلان

---

## المرحلة 2️⃣: نواة محرك اللعبة (Game Engine Core)

> **المرجع:** [01_GAME_RULES_AND_ROLES.md](file:///c:/Projects/mafia/docs/01_GAME_RULES_AND_ROLES.md) + [05_SYSTEM_ARCHITECTURE.md](file:///c:/Projects/mafia/docs/05_SYSTEM_ARCHITECTURE.md)

### 2.1 تعريف الأدوار والأنواع (Types & Enums)

#### [NEW] `backend/src/game/roles.ts`
```typescript
// الأدوار حسب التوثيق - الترتيب مهم لخوارزمية التوليد
enum MafiaRole { GODFATHER, SILENCER, CHAMELEON, MAFIA_REGULAR }
enum CitizenRole { SHERIFF, DOCTOR, SNIPER, POLICEWOMAN, NURSE, CITIZEN }

// خوارزمية التوليد: Math.ceil(N / 4) مافيا
function generateRoles(playerCount: number): Role[]
```

### 2.2 إدارة الحالة الحية (Game State Manager)

#### [NEW] `backend/src/game/state.ts`
- `createRoom(roomId, hostId)` → إنشاء غرفة جديدة في Redis بالـ Schema المحدد في التوثيق
- `getRoom(roomId)` → قراءة الحالة الحالية
- `updateRoom(roomId, updates)` → تحديث جزئي
- `addPlayer(roomId, player)` → إضافة لاعب
- `removePlayer(roomId, physicalId)` → إزالة لاعب
- `setPhase(roomId, phase)` → تغيير المرحلة
- `eliminatePlayer(roomId, physicalId)` → إقصاء لاعب (`isAlive = false`)

### 2.3 فاحص شروط الفوز

#### [NEW] `backend/src/game/win-checker.ts`
```
checkWinCondition(gameState):
  - إذا (aliveMafia >= aliveCitizens) → MAFIA_WIN
  - إذا (aliveMafia === 0) → CITIZEN_WIN
  - غير ذلك → GAME_CONTINUES
```

> [!IMPORTANT]
> يتم استدعاء `checkWinCondition` بعد **كل** عملية إقصاء (نهارية أو ليلية) كما هو محدد في التوثيق.

### 2.4 جداول PostgreSQL (Drizzle Schema)

#### [NEW] `backend/src/schemas/drizzle.ts`

| الجدول | الأعمدة الرئيسية |
|---|---|
| `users` | `id`, `googleId`, `email`, `displayName`, `avatarUrl`, `createdAt` |
| `matches` | `id`, `roomId`, `playerCount`, `winner` (MAFIA/CITIZEN), `duration`, `createdAt` |
| `match_players` | `matchId`, `userId`, `physicalId`, `role`, `survivedToEnd` |
| `surveys` | `id`, `matchId`, `voterId`, `bestPlayerId`, `leaderRating`, `createdAt` |

### ✅ معيار القبول للمرحلة 2
- خوارزمية التوليد تُنتج توزيعاً صحيحاً لكل عدد لاعبين (6-20)
- حالة اللعبة تُحفظ وتُقرأ من Redis بنجاح
- فاحص الفوز يعمل بشكل صحيح لجميع الحالات

---

## المرحلة 3️⃣: اللوبي والتجهيز (Lobby & Setup)

> **المرجع:** [02_LOBBY_AND_SETUP.md](file:///c:/Projects/mafia/docs/02_LOBBY_AND_SETUP.md)

### 3.1 Backend - أحداث Socket.IO لللوبي

#### [NEW] `backend/src/sockets/lobby.socket.ts`

| الحدث | الاتجاه | الوصف |
|---|---|---|
| `room:create` | Leader → Server | إنشاء غرفة جديدة، إرجاع `roomId` + `roomCode` |
| `room:join` | Player → Server | انضمام لاعب (بعد Google Auth) مع `physicalId` + `name` |
| `room:player-joined` | Server → All | بث معلومات اللاعب الجديد لجميع المتصلين |
| `room:override-player` | Leader → Server | صلاحية الليدر لإضافة/تعديل لاعب يدوياً |
| `room:player-count` | Server → Display | تحديث عداد اللاعبين المسجلين `X / N` |
| `room:start-generation` | Leader → Server | بدء توليد الأدوار (يظهر فقط عند اكتمال التسجيل) |

### 3.2 Backend - توليد الأدوار وربط الكروت

| الحدث | الاتجاه | الوصف |
|---|---|---|
| `setup:roles-generated` | Server → Leader | إرسال قائمة الأدوار المُولَّدة لليدر لتعديلها |
| `setup:roles-confirmed` | Leader → Server | اعتماد القائمة النهائية |
| `setup:bind-role` | Leader → Server | ربط Chip (دور) بكارت لاعب محدد (Drag & Drop) |
| `setup:binding-complete` | Leader → Server | إنهاء الربط وبدء اللعبة |

### 3.3 Frontend - واجهة الليدر (Lobby)

#### [NEW] `frontend/src/app/leader/lobby/page.tsx`
- **شبكة كروت** (Grid): كارت لكل رقم فيزيائي (1-N)، يضيء أخضر عند تسجيل اللاعب
- **صلاحيات Override**: نقر على كارت فارغ → Modal لإدخال بيانات لاعب أوفلاين
- **زر `[بدء التوليد]`**: مخفي حتى اكتمال جميع الكروت

#### [NEW] `frontend/src/app/leader/setup/page.tsx`
- **قائمة الأدوار المُولَّدة**: قابلة للتعديل (حذف/تبديل/إضافة) قبل الاعتماد
- **واجهة Drag & Drop**: رقاقات (Chips) الأدوار في الأعلى + كروت اللاعبين في الأسفل
- استخدام `@dnd-kit/core` لعملية السحب والإسقاط

#### مكونات مطلوبة:

| المكون | الوصف |
|---|---|
| `PlayerCard.tsx` | كارت اللاعب: `#الرقم - الاسم`، حالة خضراء/رمادية، القاعدة البصرية الموحدة |
| `RoleChip.tsx` | رقاقة الدور: اسم الدور + أيقونة، قابلة للسحب |

### 3.4 Frontend - شاشة العرض (Display Lobby)

#### [NEW] `frontend/src/app/display/lobby/page.tsx`
- **QR Code عملاق** (مكتبة `qrcode.react`)
- **كود الغرفة** بخط كبير
- **عداد حي**: "اللاعبون المسجلون: X / N" يتحدث لحظياً عبر Socket

### 3.5 Frontend - صفحة اللاعب (Player Mobile)

#### [NEW] `frontend/src/app/player/page.tsx`
- مسح QR Code (مكتبة `html5-qrcode`)
- تسجيل دخول Google
- إدخال الرقم الفيزيائي + الاسم
- شاشة "تم التسجيل بنجاح - أغلق الهاتف"

### 3.6 Backend - Google OAuth

#### [NEW] `backend/src/routes/auth.routes.ts`
- `/auth/google` → بدء OAuth flow
- `/auth/google/callback` → استقبال الـ token، حفظ/تحديث المستخدم في PostgreSQL

### ✅ معيار القبول للمرحلة 3
- لاعب يمسح QR → يسجل دخول → يُدخل بياناته → يظهر كارته عند الليدر بالأخضر
- الليدر يولّد الأدوار → يعدّلها → يسحب ويُسقط كل دور على اللاعب المناسب
- شاشة العرض تعرض العداد بشكل حيّ

---

## المرحلة 4️⃣: محرك النهار (Day Phase Engine)

> **المرجع:** [03_DAY_PHASE_ENGINE.md](file:///c:/Projects/mafia/docs/03_DAY_PHASE_ENGINE.md)

### 4.1 Backend - محرك الاتفاقيات

#### [NEW] `backend/src/game/deal-engine.ts`

```
createDeal(roomId, initiatorId, targetId):
  - التحقق: المستهدف ليس مستهدفاً في اتفاقية أخرى
  - إنشاء candidate من نوع DEAL في votingState
  - إضافة targetId إلى hiddenPlayersFromVoting
  - بث التحديث لجميع المتصلين

removeDeal(roomId, dealIndex):
  - إزالة الاتفاقية
  - إعادة اللاعب المستهدف إلى ساحة التصويت
```

### 4.2 Backend - محرك التصويت

#### [NEW] `backend/src/game/vote-engine.ts`

```
castVote(roomId, candidateIndex, delta: +1|-1):
  - تحديث votes للمرشح
  - تحديث totalVotesCast
  - بث التحديث لحظياً

checkVotingComplete(roomId):
  - إذا (totalVotesCast === alivePlayersCount) → إقفال تلقائي

resolveVoting(roomId):
  - ترتيب المرشحين حسب الأصوات
  - فحص التعادل
  - إذا فاز PLAYER → إقصاء عادي + كشف الهوية
  - إذا فاز DEAL:
    - المستهدف مافيا → إقصاء المستهدف فقط
    - المستهدف مواطن → إقصاء المستهدف + المبادر
  - استدعاء checkWinCondition()
```

### 4.3 Backend - كسر التعادل

```
handleTieBreaker(roomId, action):
  - REVOTE: تصفير العدادات، إعادة نفس الكروت
  - NARROW: إخفاء الكل، إبقاء المتعادلين فقط
  - CANCEL: إلغاء التصويت بدون إقصاء
  - ELIMINATE_ALL: إقصاء جميع المتعادلين
```

### 4.4 Backend - أحداث Socket.IO للنهار

#### [NEW] `backend/src/sockets/day.socket.ts`

| الحدث | الاتجاه | الوصف |
|---|---|---|
| `day:create-deal` | Leader → Server | إنشاء اتفاقية جديدة |
| `day:remove-deal` | Leader → Server | إلغاء اتفاقية |
| `day:cast-vote` | Leader → Server | تسجيل صوت (+1 أو -1) |
| `day:vote-update` | Server → All | بث تحديث الأصوات لحظياً |
| `day:voting-locked` | Server → All | إشعار إقفال التصويت |
| `day:resolve` | Leader → Server | طلب حسم النتيجة |
| `day:result` | Server → All | بث نتيجة التصويت (إقصاء/تعادل) |
| `day:tie-action` | Leader → Server | اختيار إجراء كسر التعادل |
| `day:elimination` | Server → All | بث تفاصيل الإقصاء + الهوية المكشوفة |

### 4.5 Frontend - واجهة الليدر (Day)

#### [NEW] `frontend/src/app/leader/day/page.tsx`
- **زر `[إدراج اتفاقية]`** → Modal لاختيار المبادر والمستهدف
- **شبكة كروت التصويت**: كروت عادية + كروت اتفاقيات (بتصميم مميز)
- **زرا `[+]` و `[-]`** أسفل كل كارت
- **شريط العدّ**: `الأصوات المسجلة: X / الأحياء`
- **أزرار كسر التعادل**: تظهر عند التعادل فقط

#### مكونات مطلوبة:

| المكون | الوصف |
|---|---|
| `DealCard.tsx` | كارت اتفاقية: يعرض المبادر ← المستهدف، تصميم مختلف عن الكارت العادي |
| `VoteCounter.tsx` | عدّاد أصوات مع أزرار +/- وأنيميشن |

### 4.6 Frontend - شاشة العرض (Day Display)

#### [NEW] `frontend/src/app/display/day/page.tsx`
- **كروت سينمائية** متزامنة مع الليدر
- **أنيميشن العدّادات** (Framer Motion: counter spring animation)
- **كروت المقصيين**: رمادية مع أيقونة جمجمة/قبر
- **إبراز أعلى 3 مرشحين** عند إقفال التصويت
- **مؤثر إقصاء**: أنيميشن سينمائية عند الإقصاء

### ✅ معيار القبول للمرحلة 4
- الليدر ينشئ اتفاقيات متعددة → كروت المستهدفين تختفي ويظهر كارت الاتفاقية بدلها
- التصويت يتزامن لحظياً بين الليدر وشاشة العرض
- الإقفال الآلي يعمل عند اكتمال الأصوات
- كسر التعادل (3 مستويات) يعمل بسلاسة
- نتائج الاتفاقيات (مافيا/مواطن) تُطبق بشكل صحيح

---

## المرحلة 5️⃣: محرك الليل (Night Phase Engine)

> **المرجع:** [04_NIGHT_PHASE_ENGINE.md](file:///c:/Projects/mafia/docs/04_NIGHT_PHASE_ENGINE.md)

### 5.1 Backend - معالج التقاطعات الليلية

#### [NEW] `backend/src/game/night-resolver.ts`

```
resolveNight(nightActions):
  // 1. معالجة القنص أولاً
  إذا (sniper.target !== null):
    - إذا (target.role ∈ MAFIA_ROLES) → target.isAlive = false
    - إذا (target.role ∈ CITIZEN_ROLES) → target.isAlive = false + sniper.isAlive = false

  // 2. معالجة الاغتيال
  إذا (godfather.target === doctor.target):
    → الحماية نجحت (الهدف يبقى حياً)
  غير ذلك:
    → godfather.target.isAlive = false

  // 3. معالجة الإسكات
  silencer.target.isSilenced = true

  // 4. معالجة الاستعلام
  إذا (sheriff.target.role === CHAMELEON):
    → إرجاع "CITIZEN" لليدر (زوراً)
  غير ذلك:
    → إرجاع الفريق الحقيقي

  // 5. فحص شرط الفوز
  checkWinCondition()
```

> [!WARNING]
> **قيد الطبيب المبرمج**: يجب تتبع `lastProtected` في حالة الغرفة واستبعاد الهدف المحمي في الليلة السابقة من قائمة الطبيب.

### 5.2 Backend - أحداث Socket.IO لليل

#### [NEW] `backend/src/sockets/night.socket.ts`

| الحدث | الاتجاه | الوصف |
|---|---|---|
| `night:start` | Leader → Server | بدء مرحلة الليل |
| `night:queue-step` | Server → Leader | إرسال الخطوة التالية في الطابور (الدور + قائمة الأهداف المتاحة) |
| `night:submit-action` | Leader → Server | تسجيل اختيار الليدر لهدف الدور الحالي |
| `night:skip-action` | Leader → Server | تخطي (للقناص) |
| `night:activate-nurse` | Leader → Server | تفعيل الممرضة يدوياً |
| `night:resolve` | Server → Leader | إرسال نتائج الليلة (كروت ملخص) |
| `night:display-event` | Leader → Server | طلب عرض حدث معين على شاشة العرض |
| `night:animation` | Server → Display | بث الأنيميشن المناسبة لشاشة العرض |

### 5.3 Frontend - واجهة الليدر (Night)

#### [NEW] `frontend/src/app/leader/night/page.tsx`
- **طابور صارم**: خطوة بخطوة، قائمة منسدلة (DDL) للأحياء فقط
- **ترتيب ثابت**: شيخ → قص → شريف → طبيب → قناص → (ممرضة اختيارية)
- **علامة واضحة** للدور الحالي مع قائمة الأهداف المتاحة
- **زر `[تخطي]`** للقناص فقط
- **زر `[تفعيل الممرضة]`** يظهر فقط إذا مات الطبيب

#### مكونات مطلوبة:

| المكون | الوصف |
|---|---|
| `NightQueue.tsx` | الطابور المرئي: خطوات مرقمة، الخطوة الحالية مبرزة |
| `MorningRecap.tsx` | كروت ملخص الليلة مع زر `[عرض]` لكل حدث |

### 5.4 Frontend - شاشة العرض (Night Display)

#### [NEW] `frontend/src/app/display/night/page.tsx`

الأنيميشنات السينمائية المطلوبة (Framer Motion):

| الحدث | المؤثر البصري |
|---|---|
| اغتيال ناجح | 🔪 أنيميشن دموية + كارت اللاعب يتحول للأحمر |
| حماية ناجحة | 🛡️ درع يصد الاغتيال مع تأثير توهج |
| حماية فاشلة | 💔 درع ينكسر |
| إسكات (القص) | 🤐 شريط لاصق يظهر على الفم |
| استعلام الشريف | 💓 نبض قلب + كلمة "مواطن" أو "مافيا" |
| قنص ناجح | 🎯 تصويب + سقوط المافيا |
| قنص فاشل | 💀 القناص والمواطن يسقطان معاً |

#### مكونات مطلوبة:

| المكون | الوصف |
|---|---|
| `NightAnimation.tsx` | مكون مركزي يُشغّل الأنيميشن حسب نوع الحدث |

### ✅ معيار القبول للمرحلة 5
- الطابور يعمل بالترتيب الصحيح ويُظهر فقط الأدوار الحية
- قيد الطبيب (عدم تكرار الهدف) يعمل
- الحرباية تظهر كمواطن للشريف
- القنص الناجح/الفاشل ينتج النتائج الصحيحة
- الأنيميشنات السينمائية تعمل على شاشة العرض

---

## المرحلة 6️⃣: التلميع والنشر (Polish & Deploy)

> **المرجع:** [06_DEPLOYMENT_GUIDE.md](file:///c:/Projects/mafia/docs/06_DEPLOYMENT_GUIDE.md) + [05_SYSTEM_ARCHITECTURE.md](file:///c:/Projects/mafia/docs/05_SYSTEM_ARCHITECTURE.md)

### 6.1 شاشة نهاية اللعبة + التقييم

- **شاشة الفوز**: أنيميشن سينمائية (فوز مافيا / فوز مواطنين)
- **QR Code تقييم**: يظهر بعد إعلان الفائز
- **صفحة التقييم** (Player Mobile): اختيار أفضل لاعب + تقييم الليدر (1-5 نجوم)
- حفظ النتائج في `matches` + `match_players` + `surveys` في PostgreSQL

### 6.2 الإحصائيات وقائمة المتصدرين

#### [NEW] `backend/src/routes/stats.routes.ts`
- `GET /api/stats/leaderboard` → أفضل اللاعبين
- `GET /api/stats/player/:id` → إحصائيات لاعب (نسبة الفوز، الأدوار الأكثر لعباً)

### 6.3 مؤثرات صوتية

| الحدث | الصوت |
|---|---|
| بدء الليل | موسيقى تشويقية |
| اغتيال | صوت سكين |
| حماية | صوت درع |
| إقصاء نهاري | صوت مطرقة |
| فوز | موسيقى انتصار |

### 6.4 النشر النهائي
- مراجعة `docker-compose.yml` الكامل
- إعداد Cloudflare Tunnel للـ HTTPS + WSS
- اختبار شامل End-to-End على الشبكة المحلية
- تشغيل `deploy.sh`

### ✅ معيار القبول للمرحلة 6
- لعبة كاملة من اللوبي إلى إعلان الفائز بدون أخطاء
- شاشة العرض تعمل بسلاسة مع الأنيميشنات
- التقييمات تُحفظ في PostgreSQL
- النظام يعمل عبر Cloudflare Tunnel

---

## ⚠️ قرارات تحتاج مراجعة المستخدم

> [!IMPORTANT]
> ### 1. ترتيب التنفيذ
> الخطة مبنية على مبدأ **"Backend أولاً ثم Frontend"** لكل مرحلة. هل تفضل هذا الترتيب أم البدء بالـ Frontend أولاً لكل مرحلة؟

> [!IMPORTANT]
> ### 2. Google OAuth
> هل لديك `GOOGLE_CLIENT_ID` و `GOOGLE_CLIENT_SECRET` جاهزة؟ أم نبدأ بدون Google Auth (بنظام تسجيل بسيط مؤقت) ونضيفه لاحقاً؟

> [!IMPORTANT]
> ### 3. أولوية التنفيذ
> هل تريد البدء بالمرحلة 1 (البنية التحتية) فوراً؟ أم هناك مرحلة محددة تريد التركيز عليها أولاً؟

> [!IMPORTANT]
> ### 4. Tailwind CSS
> التوثيق يذكر Tailwind CSS. هل تفضل Tailwind v3 أم v4؟

> [!IMPORTANT]
> ### 5. البيئة المحلية
> هل Docker مثبت على جهازك؟ أم تفضل تشغيل الخدمات محلياً أثناء التطوير (node مباشرة + Redis/Postgres خارجي)؟

---

## 📊 تقدير الجهد

| المرحلة | الوصف | التقدير |
|---|---|---|
| 1️⃣ | البنية التحتية والتهيئة | 🟢 مرحلة تأسيسية |
| 2️⃣ | نواة محرك اللعبة | 🟢 منطق أساسي |
| 3️⃣ | اللوبي والتجهيز | 🟡 واجهات + Socket + OAuth |
| 4️⃣ | محرك النهار | 🔴 أعقد مرحلة (اتفاقيات + تصويت + تعادل) |
| 5️⃣ | محرك الليل | 🟡 تقاطعات + أنيميشنات |
| 6️⃣ | التلميع والنشر | 🟡 تقييمات + إحصائيات + Docker |
