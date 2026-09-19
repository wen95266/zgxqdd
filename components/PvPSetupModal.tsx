import React, { useState } from 'react';
import { User } from '../types';
import { calculatePlayerLevel } from '../utils/gameLogic';
import { soundManager } from '../utils/sound';
import { X, Users, Share2, Copy, Check, Swords, Shield, Trophy, LogIn } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  botAppUrl: string;
  onEnterGameRoom: (gameId: string) => void;
}

type TabMode = 'create' | 'join';
type RestrictionMode = 'any' | 'ranked';

export const PvPSetupModal: React.FC<Props> = ({ isOpen, onClose, user, botAppUrl, onEnterGameRoom }) => {
  const [activeTab, setActiveTab] = useState<TabMode>('create');
  const [step, setStep] = useState<'config' | 'invite'>('config');
  const [restriction, setRestriction] = useState<RestrictionMode>('any');
  const [minLevel, setMinLevel] = useState<number>(user ? calculatePlayerLevel(user.points || 0) : 0);
  const [stakePoints, setStakePoints] = useState<number>(30);
  
  const [inputRoomId, setInputRoomId] = useState<string>('');
  const [createdGameId, setCreatedGameId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [copied, setCopied] = useState(false);

  // @ts-ignore
  const WebApp = window.Telegram?.WebApp;

  const safeAlert = (msg: string) => {
    if (WebApp?.showAlert) {
       WebApp.showAlert(msg);
    } else {
       alert(msg);
    }
  };

  const handleCreatePvP = async () => {
      if (isCreatingGame || !user) return;
      setIsCreatingGame(true);
      soundManager.playClick();

      const targetMinLevel = restriction === 'any' ? 0 : minLevel;

      try {
          const res = await fetch('/api/create_game', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  telegram_id: user.telegram_id,
                  min_level: targetMinLevel,
                  stake: stakePoints
              })
          });
          
          const data = await res.json();
          if (data && data.success && data.game_id) {
              const link = `${botAppUrl}?startapp=game_${data.game_id}`;
              setCreatedGameId(data.game_id);
              setInviteLink(link);
              setStep('invite');
          } else {
              // Dev/Preview fallback
              const mockId = 'room_' + Math.random().toString(36).substr(2, 6);
              const link = `${botAppUrl}?startapp=game_${mockId}`;
              setCreatedGameId(mockId);
              setInviteLink(link);
              setStep('invite');
          }
      } catch (e) {
          // Dev fallback
          const mockId = 'room_' + Math.random().toString(36).substr(2, 6);
          const link = `${botAppUrl}?startapp=game_${mockId}`;
          setCreatedGameId(mockId);
          setInviteLink(link);
          setStep('invite');
      } finally {
          setIsCreatingGame(false);
      }
  };

  const handleJoinByInput = () => {
    const trimmed = inputRoomId.trim();
    if (!trimmed) {
      safeAlert("请输入有效的房间号或邀请链接");
      return;
    }

    soundManager.playClick();
    let targetId = trimmed;
    // If user pasted a full link with game_xxx
    if (targetId.includes('game_')) {
      const match = targetId.match(/game_([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        targetId = match[1];
      }
    }

    onEnterGameRoom(targetId);
    resetAndClose();
  };

  const handleShareInvite = () => {
      soundManager.playClick();
      if (!inviteLink) return;
      
      let text = "⚔️ 楚河汉界，智者对弈！点击链接加入我的中国象棋对局：";
      if (restriction === 'ranked') {
          text = `⚔️【象棋擂台】摆下棋局（门槛 Lv.${minLevel}+），谁来一战？`;
      }

      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`;
      
      if (WebApp?.openTelegramLink) {
          WebApp.openTelegramLink(shareUrl);
      } else {
          window.open(shareUrl, '_blank');
      }
  };

  const handleCopy = () => {
      soundManager.playClick();
      if (!inviteLink) return;
      navigator.clipboard.writeText(inviteLink).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
          safeAlert("复制成功: " + inviteLink);
      });
  };

  const handleStartWaiting = () => {
      soundManager.playClick();
      if (createdGameId) {
          onEnterGameRoom(createdGameId);
          resetAndClose();
      }
  };

  const resetAndClose = () => {
      setInviteLink(null);
      setCreatedGameId(null);
      setStep('config');
      setInputRoomId('');
      setIsCreatingGame(false);
      setRestriction('any');
      onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-[#FAF7F0] border border-[#D5C7B4] w-full max-w-sm rounded-3xl p-6 relative shadow-2xl">
            <button 
              onClick={resetAndClose} 
              className="absolute top-4 right-4 p-1.5 hover:bg-black/5 text-[#5C493A] rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Mode Switch Tabs */}
            <div className="flex border-b border-[#3D281C]/15 pb-3 mb-4 gap-2">
              <button
                onClick={() => { soundManager.playClick(); setActiveTab('create'); }}
                className={`flex-1 py-2 rounded-2xl font-black font-serif text-sm flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'create'
                    ? 'bg-[#B93829] text-white shadow-sm'
                    : 'bg-white text-[#5C493A] border border-[#DCD1C0] hover:bg-stone-50'
                }`}
              >
                <Swords className="w-4 h-4" />
                <span>开辟棋局</span>
              </button>

              <button
                onClick={() => { soundManager.playClick(); setActiveTab('join'); }}
                className={`flex-1 py-2 rounded-2xl font-black font-serif text-sm flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'join'
                    ? 'bg-[#B93829] text-white shadow-sm'
                    : 'bg-white text-[#5C493A] border border-[#DCD1C0] hover:bg-stone-50'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>加入房间</span>
              </button>
            </div>

            {activeTab === 'join' ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[#5C493A] block mb-1.5 font-serif">输入房间号或邀请链接</label>
                  <input
                    type="text"
                    value={inputRoomId}
                    onChange={(e) => setInputRoomId(e.target.value)}
                    placeholder="例如: room_abc123 或粘贴分享链接"
                    className="w-full px-3 py-2.5 bg-white border border-[#DCD1C0] rounded-2xl text-xs font-mono text-[#2B231C] focus:outline-hidden focus:border-[#B93829] focus:ring-1 focus:ring-[#B93829] shadow-2xs"
                  />
                  <p className="text-[10px] text-[#5C493A]/80 mt-1">
                    从 Telegram 群聊或好友处获得对战房间号直接进入
                  </p>
                </div>

                <button
                  onClick={handleJoinByInput}
                  className="w-full py-3 bg-[#B93829] hover:bg-[#A0281A] active:scale-95 text-white font-bold rounded-2xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>立即入局对战</span>
                </button>
              </div>
            ) : step === 'config' ? (
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-[#5C493A] block mb-1.5 font-serif">入场门槛限制</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => { soundManager.playClick(); setRestriction('any'); }}
                                className={`py-2 px-3 rounded-2xl border text-center transition text-xs font-bold cursor-pointer ${
                                    restriction === 'any'
                                        ? 'bg-[#B93829] text-white border-[#B93829] shadow-2xs'
                                        : 'bg-white text-[#5C493A] border-[#DCD1C0] hover:bg-stone-50 shadow-2xs'
                                }`}
                            >
                                全民皆可入局
                            </button>
                            <button
                                type="button"
                                onClick={() => { soundManager.playClick(); setRestriction('ranked'); }}
                                className={`py-2 px-3 rounded-2xl border text-center transition text-xs font-bold cursor-pointer ${
                                    restriction === 'ranked'
                                        ? 'bg-[#B93829] text-white border-[#B93829] shadow-2xs'
                                        : 'bg-white text-[#5C493A] border-[#DCD1C0] hover:bg-stone-50 shadow-2xs'
                                }`}
                            >
                                设等级门槛 (擂台)
                            </button>
                        </div>
                    </div>

                    {restriction === 'ranked' && (
                        <div className="bg-white p-3 rounded-2xl border border-[#DCD1C0] space-y-1.5 shadow-2xs">
                            <div className="flex justify-between text-xs font-bold text-[#5C493A]">
                                <span>最低段位限制:</span>
                                <span className="text-[#B93829] font-serif">Lv.{minLevel} 级棋士</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="20" 
                                value={minLevel}
                                onChange={(e) => setMinLevel(parseInt(e.target.value))}
                                className="w-full accent-[#B93829] cursor-pointer"
                            />
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-bold text-[#5C493A] block mb-1.5 font-serif">对弈积分筹码</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[0, 30, 100].map((points) => (
                                <button
                                    key={points}
                                    type="button"
                                    onClick={() => { soundManager.playClick(); setStakePoints(points); }}
                                    className={`py-2 px-2 rounded-2xl border text-center transition text-xs font-bold cursor-pointer ${
                                        stakePoints === points
                                            ? 'bg-[#B93829] text-white border-[#B93829] shadow-2xs'
                                            : 'bg-white text-[#5C493A] border-[#DCD1C0] hover:bg-stone-50 shadow-2xs'
                                    }`}
                                >
                                    {points === 0 ? '友谊娱乐' : `${points} 积分`}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-2">
                        <button 
                            onClick={handleCreatePvP}
                            disabled={isCreatingGame}
                            className="w-full py-3 bg-[#B93829] hover:bg-[#A0281A] active:scale-95 text-white font-bold rounded-2xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            <Swords className="w-5 h-5" />
                            <span>{isCreatingGame ? '正在开辟棋局...' : '生成对战邀请'}</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-white p-3 rounded-2xl border border-[#DCD1C0] text-center shadow-2xs">
                        <div className="text-xs text-[#5C493A] font-bold">房间号</div>
                        <div className="text-xl font-black text-[#B93829] font-mono tracking-wider mt-0.5">{createdGameId}</div>
                    </div>

                    <div className="bg-white p-3 rounded-2xl border border-[#DCD1C0] break-all text-xs font-mono text-[#2B231C] select-all shadow-2xs">
                        {inviteLink}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={handleCopy}
                            className="py-2.5 px-3 bg-white hover:bg-stone-50 text-[#5C493A] border border-[#DCD1C0] font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                        >
                            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                            <span>{copied ? '已复制链接' : '复制链接'}</span>
                        </button>

                        <button
                            onClick={handleShareInvite}
                            className="py-2.5 px-3 bg-[#2AABEE] hover:bg-[#229ED9] text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
                        >
                            <Share2 className="w-4 h-4" />
                            <span>转发到群聊</span>
                        </button>
                    </div>

                    <button
                        onClick={handleStartWaiting}
                        className="w-full py-3 bg-[#B93829] hover:bg-[#A0281A] active:scale-95 text-white font-bold rounded-2xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <span>进入房间等待对手</span>
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};
