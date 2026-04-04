# 🗄️ المعمارية وهياكل البيانات (System Architecture)

## 1. بنية الحالة الحية (Redis JSON Schema)
يُخزن السيرفر حالة اللعبة كـ JSON Object يتحدث باستمرار. هذا الهيكل هو "المصدر الوحيد للحقيقة" ويدعم الإخفاء الآلي للاتفاقيات المتعددة:

```json
{
  "roomId": "GAME_01",
  "phase": "DAY_VOTING",
  "config": { "maxJustifications": 2, "currentJustification": 0 },
  "players": [
    { "physicalId": 4, "name": "عمر", "googleId": "user_123", "role": "CITIZEN", "isAlive": true, "isSilenced": false },
    { "physicalId": 9, "name": "خالد", "googleId": "user_456", "role": "MAFIA", "isAlive": true, "isSilenced": false },
    { "physicalId": 5, "name": "سيف", "googleId": "user_789", "role": "CITIZEN", "isAlive": true, "isSilenced": false }
  ],
  "votingState": {
    "totalVotesCast": 0,
    "candidates": [
      { "type": "PLAYER", "targetPhysicalId": 4, "votes": 0 },
      { "type": "DEAL", "initiatorPhysicalId": 4, "targetPhysicalId": 9, "votes": 0 },
      { "type": "DEAL", "initiatorPhysicalId": 9, "targetPhysicalId": 5, "votes": 0 }
    ],
    "hiddenPlayersFromVoting": [9, 5],
    "tieBreakerLevel": 0
  }
}
```

> **ملاحظة:** واجهة المستخدم (Frontend) تستخدم مصفوفة `hiddenPlayersFromVoting` لإخفاء كروت اللاعبين الأصليين المستهدفين باتفاقيات.

## 2. جمع البيانات وقاعدة البيانات الدائمة (PostgreSQL)
فور إعلان الفوز، يُعرض QR Code جديد للاعبين (أو إشعار). يفتحونه بهواتفهم لتقييم الجلسة (أفضل لاعب، تقييم الليدر). تُحفظ البيانات في `PostgreSQL` بجداول:
- **`Users`**: بيانات جوجل.
- **`Matches`**: سجل الجلسات.
- **`Surveys`**: التقييمات.

لبناء نظام (Leaderboard) وإحصائيات متقدمة.
