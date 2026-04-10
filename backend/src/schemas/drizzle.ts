import { pgTable, serial, text, timestamp, integer, boolean, varchar, pgEnum, date } from 'drizzle-orm/pg-core';

// ── Enums ─────────────────────────────────────────

export const winnerEnum = pgEnum('winner_type', ['MAFIA', 'CITIZEN']);
export const genderEnum = pgEnum('gender_type', ['male', 'female']);

// ── Leaders (حسابات الليدر/الأدمن) ────────────────

export const leaders = pgTable('leaders', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Users / Players (بيانات اللاعبين عبر الهاتف) ──

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  phone: varchar('phone', { length: 20 }).unique().notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  dateOfBirth: date('date_of_birth'),
  gender: varchar('gender', { length: 10 }),
  totalGamesPlayed: integer('total_games_played').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Sessions (غرفة الألعاب — الحاوي الأكبر) ──────

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  sessionCode: varchar('session_code', { length: 6 }).notNull(),
  displayPin: varchar('display_pin', { length: 6 }),
  sessionName: varchar('session_name', { length: 100 }).notNull(),
  maxPlayers: integer('max_players').default(10),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Session Players (لاعبو الغرفة) ────────────────

export const sessionPlayers = pgTable('session_players', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').references(() => sessions.id).notNull(),
  physicalId: integer('physical_id').notNull(),
  playerName: varchar('player_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  gender: varchar('gender', { length: 10 }).default('MALE'),
  dateOfBirth: date('date_of_birth'),
  userId: integer('user_id').references(() => users.id),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

// ── Matches (سجل الألعاب) ─────────────────────────

export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').references(() => sessions.id),
  roomId: varchar('room_id', { length: 50 }).notNull(),
  roomCode: varchar('room_code', { length: 6 }).notNull(),
  gameName: varchar('game_name', { length: 100 }).notNull(),
  leaderId: integer('leader_id').references(() => leaders.id),
  displayPin: varchar('display_pin', { length: 6 }),
  playerCount: integer('player_count').notNull(),
  maxPlayers: integer('max_players').default(10),
  isActive: boolean('is_active').default(true),
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
  eliminatedDuring: varchar('eliminated_during', { length: 20 }),
});

// ── Surveys (التقييمات) ───────────────────────────

export const surveys = pgTable('surveys', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id').references(() => matches.id).notNull(),
  voterId: integer('voter_id').references(() => users.id).notNull(),
  bestPlayerId: integer('best_player_id').references(() => users.id),
  leaderRating: integer('leader_rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
