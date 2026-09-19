import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { DEFAULT_TELEGRAM_GROUP_URL, DEFAULT_TELEGRAM_BOT_APP_URL } from '../constants';
import { calculatePlayerLevel } from '../utils/gameLogic';
import { getTodayDateString, performLocalSignIn, deductLocalPoints } from '../utils/userStorage';
import { soundManager } from '../utils/sound';
import { PaymentModal } from './PaymentModal';
import { PvPSetupModal } from './PvPSetupModal';
import { RulesModal } from './RulesModal';
import { 
  Bot, Swords, Coins, Sparkles, BookOpen, 
  Users, Gift, Flame, CheckCircle2, ChevronRight, Award
} from 'lucide-react';

interface Props {
  onStartGame: (mode: 'pve' | 'pvp', invitedId?: string) => void;
  user: User | null;
  onRefreshUser: () => void;
  onUpdateUser?: (u: User) => void;
}

export const Lobby: React.FC<Props> = ({ onStartGame, user, onRefreshUser, onUpdateUser }) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showPvPModal, setShowPvPModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const [config, setConfig] = useState({
    groupUrl: DEFAULT_TELEGRAM_GROUP_URL,
    botAppUrl: DEFAULT_TELEGRAM_BOT_APP_URL
  });

  // @ts-ignore
  const WebApp = window.Telegram?.WebApp;

  const safeAlert = (msg: string) => {
    if (WebApp?.showAlert) {
      WebApp.showAlert(msg);
    } else {
      alert(msg);
    }
  };

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(d => {
        if (d) {
          setConfig({
            groupUrl: d.group_url || DEFAULT_TELEGRAM_GROUP_URL,
            botAppUrl: d.bot_app_url || DEFAULT_TELEGRAM_BOT_APP_URL
          });
        }
      })
      .catch(() => {});
  }, []);

  const todayStr = getTodayDateString();
  const isAlreadySignedInToday = user?.lastSigninDate === todayStr;

  const handleSignIn = async () => {
    if (!user || isSigningIn) return;
    if (isAlreadySignedInToday) {
      safeAlert("今日已领取过俸禄，明日再来吧！");
      return;
    }

    setIsSigningIn(true);
    soundManager.playClick();

    try {
      const res = await fetch('/api/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_id: user.telegram_id })
      });
      const data = await res.json();
      if (data && data.success) {
        soundManager.playCoin();
        safeAlert(`🎉 ${data.message || '签到成功，获得 100 积分奖励！'}`);
        onRefreshUser();
        return;
      }
    } catch (_) {}

    // Resilient offline fallback
    const result = performLocalSignIn(user);
    if (result.success) {
      soundManager.playCoin();
      safeAlert(`🎉 ${result.message}`);
      if (onUpdateUser) onUpdateUser(result.user);
      else onRefreshUser();
    } else {
      safeAlert(result.message);
    }
    setIsSigningIn(false);
  };

  const handleStartPve = async () => {
    soundManager.playClick();
    if (!user) {
      onStartGame('pve');
      return;
    }

    if (user.points < 10) {
      safeAlert("积分不足 (人机对弈需 10 积分)，请先每日签到或充值星星。");
      return;
    }

    try {
      fetch('/api/deduct_points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_id: user.telegram_id, amount: 10 })
      }).catch(() => {});
    } catch (_) {}

    const updated = deductLocalPoints(user, 10);
    if (onUpdateUser) onUpdateUser(updated);

    onStartGame('pve');
  };

  const points = user?.points ?? 0;
  const level = calculatePlayerLevel(points);
  const wins = user?.wins ?? 0;
  const losses = user?.losses ?? 0;
  const draws = user?.draws ?? 0;
  const totalMatches = wins + losses + draws;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
  const streak = user?.streak ?? 0;

  const getRankTitle = (lvl: number): string => {
    if (lvl >= 30) return '棋圣九段';
    if (lvl >= 20) return '特级国手';
    if (lvl >= 15) return '棋坛大师';
    if (lvl >= 10) return '六段豪杰';
    if (lvl >= 5) return '业余四段';
    if (lvl >= 2) return '入段棋士';
    return '棋坛新秀';
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-5 flex flex-col items-center select-none">
      {/* Grand Atmospheric Header */}
      <header className="w-full flex items-center justify-between pb-4 mb-4 border-b border-[#3D281C]/15">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#B93829] to-[#8E2417] border-2 border-amber-300/80 flex items-center justify-center text-amber-100 font-serif font-black text-xl shadow-md">
            帥
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black font-serif text-[#2B231C] tracking-wide">楚河汉界</h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2B231C]/10 text-[#503723] font-bold font-sans">
                国风弈境
              </span>
            </div>
            <p className="text-[11px] text-[#6B5848] font-serif tracking-wider">
              中国象棋 · 智弈乾坤 · 棋道至臻
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { soundManager.playClick(); setShowRulesModal(true); }}
            className="p-2.5 bg-white/80 hover:bg-white text-[#503723] rounded-xl border border-[#D5C7B4] shadow-xs hover:shadow transition flex items-center gap-1 text-xs font-bold"
            title="查看棋规"
          >
            <BookOpen className="w-4 h-4 text-[#B93829]" />
            <span className="hidden sm:inline">棋规</span>
          </button>
        </div>
      </header>

      {/* User Profile & Rank Card */}
      <div className="w-full bg-gradient-to-br from-[#FCFAF6] to-[#F5EFE4] border border-[#DCD1C0] rounded-3xl p-4 sm:p-5 shadow-sm mb-4 relative overflow-hidden">
        {/* Subtle decorative background watermark */}
        <div className="absolute -right-3 -bottom-4 text-[#3D281C]/5 font-serif font-black text-8xl pointer-events-none select-none">
          弈
        </div>

        <div className="flex justify-between items-start relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-lg text-[#2B231C]">
                {user?.username || '执红棋士'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#B93829] to-[#9B2B1E] text-amber-100 text-[11px] font-bold tracking-wide shadow-xs flex items-center gap-1">
                <Award className="w-3 h-3 text-amber-200" />
                Lv.{level} {getRankTitle(level)}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5 text-xs text-[#5C493A]">
              <Coins className="w-4 h-4 text-amber-600" />
              <span>可用积分:</span>
              <span className="text-[#B93829] font-black text-base font-mono">
                {points.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 items-end relative z-10">
            <button
              onClick={() => { soundManager.playClick(); setShowPaymentModal(true); }}
              className="px-3.5 py-1.5 bg-gradient-to-r from-[#B93829] to-[#A0281A] hover:brightness-110 active:scale-95 text-amber-100 font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-200" />
              <span>充值 Stars</span>
            </button>

            <button
              onClick={handleSignIn}
              disabled={isSigningIn || isAlreadySignedInToday}
              className={`px-3 py-1.5 font-bold rounded-xl text-xs border transition flex items-center gap-1.5 ${
                isAlreadySignedInToday
                  ? 'bg-stone-200/90 text-stone-600 border-stone-300 opacity-80 cursor-default'
                  : 'bg-white hover:bg-[#FDF9F2] text-[#5C493A] border-[#D5C7B4] shadow-xs active:scale-95 cursor-pointer'
              }`}
            >
              {isAlreadySignedInToday ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>今日已领俸禄</span>
                </>
              ) : (
                <>
                  <Gift className="w-3.5 h-3.5 text-amber-600" />
                  <span>{isSigningIn ? '领取中...' : '每日俸禄 +100'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Combat Stats Grid */}
        <div className="mt-4 pt-3 border-t border-[#3D281C]/10 grid grid-cols-4 gap-2 text-center text-xs relative z-10">
          <div className="bg-white/80 py-2 px-1 rounded-2xl border border-[#E2D8C9]/80 shadow-2xs">
            <span className="text-[10px] text-[#7A6755] block mb-0.5">总局数</span>
            <strong className="font-mono font-bold text-sm text-[#2B231C]">{totalMatches}</strong>
          </div>
          <div className="bg-white/80 py-2 px-1 rounded-2xl border border-[#E2D8C9]/80 shadow-2xs">
            <span className="text-[10px] text-[#7A6755] block mb-0.5">胜率</span>
            <strong className="font-mono font-bold text-sm text-[#B93829]">{winRate}%</strong>
          </div>
          <div className="bg-white/80 py-2 px-1 rounded-2xl border border-[#E2D8C9]/80 shadow-2xs">
            <span className="text-[10px] text-[#7A6755] block mb-0.5">胜/平/负</span>
            <span className="font-mono text-xs font-bold text-[#2B231C]">{wins}/{draws}/{losses}</span>
          </div>
          <div className="bg-white/80 py-2 px-1 rounded-2xl border border-[#E2D8C9]/80 shadow-2xs">
            <span className="text-[10px] text-[#7A6755] block mb-0.5 flex items-center justify-center gap-0.5">
              <Flame className="w-3 h-3 text-amber-600 inline" /> 连胜
            </span>
            <strong className="font-mono font-bold text-sm text-amber-800">{streak} 连胜</strong>
          </div>
        </div>
      </div>

      {/* Main Mode Options */}
      <div className="w-full space-y-3.5">
        {/* PVE Mode Card */}
        <button
          onClick={handleStartPve}
          className="w-full p-4.5 bg-gradient-to-r from-[#FCFAF6] to-[#FAF5EB] hover:to-[#F4ECDC] border border-[#D5C7B4] hover:border-[#B93829]/60 rounded-3xl shadow-xs hover:shadow-md transition-all duration-200 transform active:scale-[0.98] flex items-center justify-between text-left group cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#B93829] to-[#902418] border-2 border-amber-300/80 flex items-center justify-center text-amber-100 shadow-md group-hover:scale-105 transition">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black font-serif text-[#2B231C] tracking-wide">
                  人机弈算 · 极智对决
                </h3>
                <span className="text-[10px] bg-amber-100/90 text-amber-900 border border-amber-300/60 px-2 py-0.5 rounded-full font-bold">
                  门票 10 积分
                </span>
              </div>
              <p className="text-xs text-[#6B5848] mt-1 leading-relaxed">
                特级大师引擎 · 军师锦囊推演 · 胜局奖 30~50 积分
              </p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-white border border-[#D5C7B4] flex items-center justify-center text-[#B93829] group-hover:translate-x-1 group-hover:bg-[#B93829] group-hover:text-white transition shadow-2xs">
            <ChevronRight className="w-4 h-4" />
          </div>
        </button>

        {/* PVP Mode Card */}
        <button
          onClick={() => { soundManager.playClick(); setShowPvPModal(true); }}
          className="w-full p-4.5 bg-gradient-to-r from-[#FCFAF6] to-[#FAF5EB] hover:to-[#F4ECDC] border border-[#D5C7B4] hover:border-[#2B231C]/60 rounded-3xl shadow-xs hover:shadow-md transition-all duration-200 transform active:scale-[0.98] flex items-center justify-between text-left group cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#2B231C] to-[#17130F] border-2 border-amber-300/80 flex items-center justify-center text-amber-100 shadow-md group-hover:scale-105 transition">
              <Swords className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black font-serif text-[#2B231C] tracking-wide">
                  擂台论剑 · 好友对弈
                </h3>
                <span className="text-[10px] bg-rose-100/90 text-rose-900 border border-rose-300/60 px-2 py-0.5 rounded-full font-bold">
                  实时联机
                </span>
              </div>
              <p className="text-xs text-[#6B5848] mt-1 leading-relaxed">
                创建专属棋局 · 转发 Telegram 邀请棋友同台博弈
              </p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-white border border-[#D5C7B4] flex items-center justify-center text-[#2B231C] group-hover:translate-x-1 group-hover:bg-[#2B231C] group-hover:text-white transition shadow-2xs">
            <ChevronRight className="w-4 h-4" />
          </div>
        </button>

        {/* Telegram Community */}
        <a
          href={config.groupUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => soundManager.playClick()}
          className="w-full p-3.5 bg-white/75 hover:bg-white border border-[#DCD1C0] rounded-2xl shadow-2xs hover:shadow transition flex items-center justify-between group"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#B93829]">
              <Users className="w-4 h-4" />
            </div>
            <div className="text-xs text-[#4A3D31]">
              <span className="font-black text-[#2B231C]">加入 Telegram 象棋研习社群</span>
              <p className="text-[10px] text-[#7A6755]">棋局切磋、残局解密与棋友风云榜</p>
            </div>
          </div>
          <span className="text-xs text-[#B93829] font-bold group-hover:translate-x-0.5 transition">前往交流 ›</span>
        </a>
      </div>

      {/* Rules Modal */}
      <RulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />

      {/* Payment Stars Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        user={user}
        onSuccess={onRefreshUser}
      />

      {/* PvP Setup & Invite Modal */}
      <PvPSetupModal
        isOpen={showPvPModal}
        onClose={() => setShowPvPModal(false)}
        user={user}
        botAppUrl={config.botAppUrl}
        onEnterGameRoom={(gameId) => onStartGame('pvp', gameId)}
      />
    </div>
  );
};
