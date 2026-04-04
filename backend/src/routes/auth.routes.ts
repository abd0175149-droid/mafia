// ══════════════════════════════════════════════════════
// 🔐 مسارات المصادقة (Auth Routes)
// Google OAuth 2.0
// ══════════════════════════════════════════════════════

import { Router } from 'express';
import passport from 'passport';
import { env } from '../config/env.js';

const router = Router();

// بدء تدفق Google OAuth
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

// استقبال الـ callback
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${env.FRONTEND_URL}?error=auth_failed`,
  }),
  (req, res) => {
    // نجاح المصادقة → إعادة التوجيه للفرونت إند
    res.redirect(`${env.FRONTEND_URL}/player/join?authenticated=true`);
  }
);

// الحصول على بيانات المستخدم الحالي
router.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// تسجيل الخروج
router.post('/logout', (req, res) => {
  req.logout?.(() => {
    res.json({ success: true });
  });
});

export default router;
