import { pgTable, serial, text, timestamp, integer, boolean, varchar, pgEnum } from 'drizzle-orm/pg-core';

// ── Enums ─────────────────────────────────────────

export const winnerEnum = pgEnum('winner_type', ['MAFIA', 'CITIZEN']);

// ── Users (بيانات Google) ─────────────────────────

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  googleId: varchar('google_id', { length: 255 }).unique().notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Matches (سجل الجلسات) ─────────────────────────

export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  roomId: varchar('room_id', { length: 50 }).notNull(),
  playerCount: integer('player_count').notNull(),
  winner: winnerEnum('winner'),
  totalRounds: integer('total_rounds').default(0),
  durationSeconds: integer('duration_seconds'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
});

// ── Match Players (لاعبو كل جلسة) ────────────────

export const matchPlayers = pgTable('match_players', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id').references(() => matches.id).notNull(),
  userId: integer('user_id').references(() => users.id),
  physicalId: integer('physical_id').notNull(),
  playerName: varchar('player_name', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  survivedToEnd: boolean('survived_to_end').default(false),
  eliminatedAtRound: integer('eliminated_at_round'),
  eliminatedDuring: varchar('eliminated_during', { length: 20 }), // 'DAY' | 'NIGHT'
});

// ── Surveys (التقييمات) ───────────────────────────

export const surveys = pgTable('surveys', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id').references(() => matches.id).notNull(),
  voterId: integer('voter_id').references(() => users.id).notNull(),
  bestPlayerId: integer('best_player_id').references(() => users.id),
  leaderRating: integer('leader_rating').notNull(), // 1-5
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
