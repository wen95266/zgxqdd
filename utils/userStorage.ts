import { User } from '../types';

const STORAGE_KEY = 'gemini_xiangqi_user_v1';

export const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const loadLocalUser = (telegram_id: string = 'dev_user_123', defaultName: string = '弈林高手'): User => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.points === 'number') {
        return {
          id: parsed.id || 1,
          telegram_id: parsed.telegram_id || telegram_id,
          username: parsed.username || defaultName,
          points: parsed.points,
          wins: parsed.wins ?? 0,
          losses: parsed.losses ?? 0,
          draws: parsed.draws ?? 0,
          streak: parsed.streak ?? 0,
          maxStreak: parsed.maxStreak ?? 0,
          lastSigninDate: parsed.lastSigninDate || ''
        };
      }
    }
  } catch (_) {}

  const initialUser: User = {
    id: 1,
    telegram_id,
    username: defaultName,
    points: 1500,
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    maxStreak: 0,
    lastSigninDate: ''
  };
  saveLocalUser(initialUser);
  return initialUser;
};

export const saveLocalUser = (user: User): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch (_) {}
};

export const performLocalSignIn = (user: User): { success: boolean; message: string; user: User } => {
  const today = getTodayDateString();
  if (user.lastSigninDate === today) {
    return {
      success: false,
      message: '今日已签到，明日再来领取俸禄吧！',
      user
    };
  }

  const updated: User = {
    ...user,
    points: user.points + 100,
    lastSigninDate: today
  };
  saveLocalUser(updated);
  return {
    success: true,
    message: '每日俸禄已领！获得 100 积分奖励。',
    user: updated
  };
};

export const deductLocalPoints = (user: User, amount: number): User => {
  const updated: User = {
    ...user,
    points: Math.max(0, user.points - amount)
  };
  saveLocalUser(updated);
  return updated;
};

export const addLocalPoints = (user: User, amount: number): User => {
  const updated: User = {
    ...user,
    points: user.points + amount
  };
  saveLocalUser(updated);
  return updated;
};

export const recordMatchOutcome = (user: User, outcome: 'win' | 'loss' | 'draw', pointsDelta: number): User => {
  const wins = outcome === 'win' ? (user.wins || 0) + 1 : (user.wins || 0);
  const losses = outcome === 'loss' ? (user.losses || 0) + 1 : (user.losses || 0);
  const draws = outcome === 'draw' ? (user.draws || 0) + 1 : (user.draws || 0);
  const currentStreak = outcome === 'win' ? (user.streak || 0) + 1 : 0;
  const maxStreak = Math.max(user.maxStreak || 0, currentStreak);

  const updated: User = {
    ...user,
    points: Math.max(0, user.points + pointsDelta),
    wins,
    losses,
    draws,
    streak: currentStreak,
    maxStreak
  };
  saveLocalUser(updated);
  return updated;
};
