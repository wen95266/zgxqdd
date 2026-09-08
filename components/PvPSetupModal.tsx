import React, { useState } from 'react';
import { User } from '../types';
import { calculatePlayerLevel } from '../utils/gameLogic';
import { X, Users, Share2, Copy, Check, Swords, Shield, Trophy } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  botAppUrl: string;
  onEnterGameRoom: (gameId: string) => void;
}

type RestrictionMode = 'any' | 'ranked';

export const PvPSetupModal: React.FC<Props> = ({ isOpen, onClose, user, botAppUrl, onEnterGameRoom }) => {
  const [step, setStep] = useState<'config' | 'invite'>('config');
  const [restriction, setRestriction] = useState<RestrictionMode>('any');
  const [minLevel, setMinLevel] = useState<number>(user ? calculatePlayerLevel(user.points || 0) : 0);
  const [stakePoints, setStakePoints] = useState<number>(30);
  
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
          if (data.success && data.game_id) {
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

  const handleShareInvite = () => {
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
      if (!inviteLink) return;
      navigator.clipboard.writeText(inviteLink).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
          safeAlert("复制成功: " + inviteLink);
      });
  };

  const handleStartWaiting = () => {
      if (createdGameId) {
          onEnterGameRoom(createdGameId);
          resetAndClose();
      }
  };

  const resetAndClose = () => {
      setInviteLink(null);
      setCreatedGameId(null);
      setStep('config');
      setIsCreatingGame(false);
      setRestriction('any');
      onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-[#f0dbb0] border-4 border-[#5c4033] w-full max-w-sm rounded-3xl p-6 relative shadow-2xl">
            <button 
              onClick={resetAndClose} 
              className="absolute top-4 right-4 p-1.5 hover:bg-[#5c4033]/10 text-[#5c4033] rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-center space-x-2 border-b-2 border-[#5c4033]/30 pb-3 mb-4">
                <Swords className="w-6 h-6 text-[#8B0000]" />
                <h2 className="text-2xl font-black text-[#5c4033] tracking-wide">
                  {step === 'config' ? '摆设棋局' : '邀请好友入局'}
                </h2>
            </div>

            {step === 'config' ? (
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-[#5c4033] block mb-1.5">入场门槛限制</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setRestriction('any')}
                                className={`py-2 px-3 rounded-xl border text-center transition text-xs font-bold ${
                                    restriction === 'any'
                                        ? 'bg-[#8B0000] text-[#f0dbb0] border-[#8B0000] shadow'
                                        : 'bg-[#fcf5e5] text-[#5c4033] border-[#5c4033]/40 hover:bg-[#e3c08d]'
                                }`}
                            >
                                全民皆可入局
                            </button>
                            <button
                                type="button"
                                onClick={() => setRestriction('ranked')}
                                className={`py-2 px-3 rounded-xl border text-center transition text-xs font-bold ${
                                    restriction === 'ranked'
                                        ? 'bg-[#8B0000] text-[#f0dbb0] border-[#8B0000] shadow'
                                        : 'bg-[#fcf5e5] text-[#5c4033] border-[#5c4033]/40 hover:bg-[#e3c08d]'
                                }`}
                            >
                                设等级门槛 (擂台)
                            </button>
                        </div>
                    </div>

                    {restriction === 'ranked' && (
                        <div className="bg-[#e3c08d] p-3 rounded-xl border border-[#5c4033]/30 space-y-1.5">
                            <div className="flex justify-between text-xs font-bold text-[#5c4033]">
                                <span>最低段位限制:</span>
                                <span className="text-[#8B0000]">Lv.{minLevel} 级棋士</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="20" 
                                value={minLevel}
                                onChange={(e) => setMinLevel(parseInt(e.target.value))}
                                className="w-full accent-[#8B0000] cursor-pointer"
                            />
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-bold text-[#5c4033] block mb-1.5">对弈积分筹码</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[0, 30, 100].map((points) => (
                                <button
                                    key={points}
                                    type="button"
                                    onClick={() => setStakePoints(points)}
                                    className={`py-2 px-2 rounded-xl border text-center transition text-xs font-bold ${
                                        stakePoints === points
                                            ? 'bg-[#8B0000] text-[#f0dbb0] border-[#8B0000] shadow'
                                            : 'bg-[#fcf5e5] text-[#5c4033] border-[#5c4033]/40 hover:bg-[#e3c08d]'
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
                            className="w-full py-3 bg-[#8B0000] hover:bg-[#6b0000] text-[#f0dbb0] font-black rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                        >
                            <Swords className="w-5 h-5" />
                            <span>{isCreatingGame ? '正在开辟棋局...' : '生成对战邀请'}</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-[#e3c08d] p-3 rounded-xl border border-[#5c4033]/30 text-center">
                        <div className="text-xs text-[#5c4033] font-bold">房间号</div>
                        <div className="text-xl font-black text-[#8B0000] tracking-wider mt-0.5">{createdGameId}</div>
                    </div>

                    <div className="bg-[#fcf5e5] p-3 rounded-xl border border-[#5c4033]/40 break-all text-xs font-mono text-[#5c4033] select-all">
                        {inviteLink}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={handleCopy}
                            className="py-2.5 px-3 bg-[#fcf5e5] hover:bg-[#e3c08d] text-[#5c4033] border border-[#5c4033] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                        >
                            {copied ? <Check className="w-4 h-4 text-green-700" /> : <Copy className="w-4 h-4" />}
                            <span>{copied ? '已复制链接' : '复制链接'}</span>
                        </button>

                        <button
                            onClick={handleShareInvite}
                            className="py-2.5 px-3 bg-[#0088cc] hover:bg-[#0077b5] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow"
                        >
                            <Share2 className="w-4 h-4" />
                            <span>转发到群聊</span>
                        </button>
                    </div>

                    <button
                        onClick={handleStartWaiting}
                        className="w-full py-3 bg-[#8B0000] hover:bg-[#6b0000] text-[#f0dbb0] font-black rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                    >
                        <span>进入房间等待对手</span>
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};
