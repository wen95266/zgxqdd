import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { DEFAULT_TELEGRAM_GROUP_URL, DEFAULT_TELEGRAM_BOT_APP_URL } from '../constants';
import { calculatePlayerLevel } from '../utils/gameLogic';
import { PaymentModal } from './PaymentModal';
import { PvPSetupModal } from './PvPSetupModal';
import { RulesModal } from './RulesModal';
import { 
  Bot, Swords, Coins, Award, Sparkles, BookOpen, 
  Users, Gift, HelpCircle, RefreshCw, Trophy, ShieldCheck
} from 'lucide-react';

interface Props {
  onStartGame: (mode: 'pve' | 'pvp', invitedId?: string) => void;
  user: User | null;
  onRefreshUser: () => void;
}

export const Lobby: React.FC<Props> = ({ onStartGame, user, onRefreshUser }) => {
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

  const handleSignIn = async () => {
    if (!user || isSigningIn) return;
    setIsSigningIn(true);
    try {
      const res = await fetch('/api/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_id: user.telegram_id })
      });
      const data = await res.json();
      if (data.success) {
        safeAlert(`🎉 ${data.message || '签到成功，获得积分奖励！'}`);
        onRefreshUser();
      } else {
        safeAlert(data.message || '今日已签到，明日再来吧！');
      }
    } catch (e) {
      safeAlert("签到服务暂时不可用");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleStartPve = async () => {
    if (!user) {
      onStartGame('pve');
      return;
    }

    if (user.points < 10) {
      safeAlert("积分不足 (人机对弈需 10 积分)，请先每日签到或充值星星。");
      return;
    }

    try {
      await fetch('/api/deduct_points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_id: user.telegram_id, amount: 10 })
      });
      onRefreshUser();
    } catch (_) {}

    onStartGame('pve');
  };

  const points = user?.points ?? 0;
  const level = calculatePlayerLevel(points);

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
    <div className="min-h-screen flex flex-col items-center bg-[#f0dbb0] text-[#4a3b2a] font-sans pb-10 wood-texture px-4 select-none">
      {/* Header */}
      <header className="w-full max-w-md py-4 flex justify-between items-center border-b-2 border-[#5c4033]/30 mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 rounded-full bg-[#8B0000] border-2 border-amber-300 flex items-center justify-center font-black text-amber-100 text-lg shadow-md">
            帥
          </div>
          <div>
            <h1 className="text-xl font-black text-[#5c4033] tracking-wider">楚河汉界</h1>
            <p className="text-[10px] text-[#5c4033]/70 font-serif">中国象棋 · Telegram 竞技</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRulesModal(true)}
            className="p-2 bg-[#fcf5e5] hover:bg-[#e3c08d] text-[#5c4033] rounded-full border border-[#5c4033]/30 shadow-sm transition"
            title="查看棋规"
          >
            <BookOpen className="w-4 h-4 text-[#8B0000]" />
          </button>
        </div>
      </header>

      {/* User Status Card */}
      <div className="w-full max-w-md bg-[#e3c08d] border-2 border-[#5c4033]/40 rounded-3xl p-4 shadow-lg mb-5 relative overflow-hidden">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-black text-base text-[#5c4033]">
                {user?.username || '执红棋士'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#8B0000] text-amber-100 text-[10px] font-bold tracking-wide">
                Lv.{level} {getRankTitle(level)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#5c4033]/80">
              <Coins className="w-4 h-4 text-amber-700" />
              <span>当前积分: <strong className="text-[#8B0000] font-black text-sm">{points.toLocaleString()}</strong></span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 items-end">
            <button
              onClick={() => setShowPaymentModal(true)}
              className="px-3 py-1.5 bg-[#8B0000] hover:bg-[#6b0000] text-amber-100 font-bold rounded-xl text-xs shadow transition flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>充值 Stars</span>
            </button>

            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="px-3 py-1 bg-[#fcf5e5] hover:bg-[#ebd4a9] text-[#5c4033] font-bold rounded-xl text-[11px] border border-[#5c4033]/30 shadow-sm transition flex items-center gap-1 disabled:opacity-50"
            >
              <Gift className="w-3.5 h-3.5 text-amber-700" />
              <span>{isSigningIn ? '领取中...' : '每日签到 +100'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Game Mode Options */}
      <div className="w-full max-w-md space-y-3.5">
        {/* PVE Mode Card */}
        <button
          onClick={handleStartPve}
          className="w-full p-4 bg-[#fcf5e5] hover:bg-[#ebd4a9] border-2 border-[#5c4033] rounded-3xl shadow-lg transition transform active:scale-95 flex items-center justify-between text-left group"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-13 h-13 rounded-2xl bg-[#8B0000] border-2 border-amber-300 flex items-center justify-center text-amber-100 shadow-md">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-[#5c4033] tracking-wide">人机弈算 (PVE)</h3>
                <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                  门票 10 积分
                </span>
              </div>
              <p className="text-xs text-[#5c4033]/80 mt-0.5">
                特级大师引擎 · 军师锦囊 · 实时妙手推荐
              </p>
            </div>
          </div>
          <span className="text-2xl text-[#8B0000] font-black group-hover:translate-x-1 transition">›</span>
        </button>

        {/* PVP Mode Card */}
        <button
          onClick={() => setShowPvPModal(true)}
          className="w-full p-4 bg-[#fcf5e5] hover:bg-[#ebd4a9] border-2 border-[#5c4033] rounded-3xl shadow-lg transition transform active:scale-95 flex items-center justify-between text-left group"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-13 h-13 rounded-2xl bg-[#5c4033] border-2 border-amber-300 flex items-center justify-center text-amber-100 shadow-md">
              <Swords className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-[#5c4033] tracking-wide">摆下棋局 / 好友对弈</h3>
                <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-bold">
                  擂台挑战
                </span>
              </div>
              <p className="text-xs text-[#5c4033]/80 mt-0.5">
                创建专属对局 · 转发 Telegram 群聊邀战
              </p>
            </div>
          </div>
          <span className="text-2xl text-[#8B0000] font-black group-hover:translate-x-1 transition">›</span>
        </button>

        {/* Community & Tournament */}
        <a
          href={config.groupUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full p-3.5 bg-[#e3c08d]/90 hover:bg-[#d4b483] border border-[#5c4033]/40 rounded-2xl shadow transition flex items-center justify-between"
        >
          <div className="flex items-center space-x-3">
            <Users className="w-5 h-5 text-[#8B0000]" />
            <div className="text-xs text-[#5c4033]">
              <span className="font-black">加入 Telegram 象棋研习社群</span>
              <p className="text-[10px] opacity-75">棋局切磋、残局解密与棋友排行榜</p>
            </div>
          </div>
          <span className="text-xs text-[#8B0000] font-bold">前往交流 ›</span>
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
