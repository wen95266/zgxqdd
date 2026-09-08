import React, { useState } from 'react';
import { User } from '../types';
import { X, Sparkles, Coins, CheckCircle, ShieldCheck } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSuccess: () => void;
}

export const PaymentModal: React.FC<Props> = ({ isOpen, onClose, user, onSuccess }) => {
  const [buyAmount, setBuyAmount] = useState<string>('50');
  const [isBuying, setIsBuying] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>('');

  // @ts-ignore
  const WebApp = window.Telegram?.WebApp;

  const safeAlert = (msg: string) => {
    if (WebApp?.showAlert) {
       WebApp.showAlert(msg);
    } else {
       alert(msg);
    }
  };

  const handleConfirmBuy = async () => {
    const starsToBuy = parseInt(buyAmount);
    if (!starsToBuy || starsToBuy <= 0) {
        safeAlert("请输入有效的星星数量（正整数）。");
        return;
    }
    
    if (isBuying || !user) return;
    setIsBuying(true);
    setStatusMsg('正在创建充值订单...');

    try {
        const invoiceRes = await fetch('/api/create_invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegram_id: user.telegram_id, stars: starsToBuy })
        });
        
        const invoiceData = await invoiceRes.json();
        
        if (!invoiceData.success) {
            // If in preview or test mode without Telegram Bot token, offer quick test top-up
            if (invoiceData.error && invoiceData.error.includes("BOT_TOKEN")) {
                const testRes = await fetch('/api/buy_points', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ telegram_id: user.telegram_id, stars: starsToBuy })
                });
                const testData = await testRes.json();
                if (testData.success) {
                    safeAlert(`[测试模式] 充值成功！获得 ${starsToBuy * 500} 积分。`);
                    onSuccess();
                    onClose();
                    return;
                }
            }

            safeAlert(`订单创建失败: ${invoiceData.error || "机器人配置错误"}`);
            setIsBuying(false);
            setStatusMsg('');
            return;
        }

        const invoiceLink = invoiceData.invoice_link;
        
        if (WebApp?.openInvoice) {
            WebApp.openInvoice(invoiceLink, async (status: string) => {
                setIsBuying(false);
                if (status === 'paid') {
                    safeAlert("✅ 支付成功！游戏积分已到账。");
                    setTimeout(onSuccess, 1000);
                    onClose();
                } else if (status === 'failed' || status === 'error') {
                    safeAlert("⚠️ 支付未完成或已被取消。");
                }
            });
        } else {
            if (WebApp?.openTelegramLink) {
                WebApp.openTelegramLink(invoiceLink);
            } else {
                window.open(invoiceLink, '_blank');
            }
            setIsBuying(false);
        }
    } catch (e) {
        // Fallback for offline / dev mock
        safeAlert("网络异常，无法连接支付服务器。");
        setIsBuying(false);
    } finally {
        setStatusMsg('');
    }
  };

  if (!isOpen) return null;

  const quickPackages = [
    { stars: 20, points: 10000, desc: '试水包' },
    { stars: 50, points: 25000, desc: '热门推举' },
    { stars: 100, points: 55000, desc: '棋圣豪礼' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-[#f0dbb0] border-4 border-[#5c4033] w-full max-w-sm rounded-3xl p-6 relative shadow-2xl">
            <button 
              onClick={onClose} 
              className="absolute top-4 right-4 p-1.5 hover:bg-[#5c4033]/10 text-[#5c4033] rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center justify-center space-x-2 border-b-2 border-[#5c4033]/30 pb-3 mb-5">
                <Coins className="w-7 h-7 text-[#8B0000]" />
                <h2 className="text-2xl font-black text-[#5c4033] tracking-wide">积分星标充值</h2>
            </div>

            <div className="space-y-4">
                <div className="bg-[#e3c08d] p-3 rounded-xl border border-[#5c4033]/30 flex justify-between items-center text-sm font-bold text-[#5c4033]">
                  <span>当前账户余额</span>
                  <span className="text-[#8B0000] text-base">{user?.points ?? 0} 积分</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#5c4033] block mb-2">选择快捷充值包</label>
                  <div className="grid grid-cols-3 gap-2">
                    {quickPackages.map(pkg => (
                      <button
                        key={pkg.stars}
                        type="button"
                        onClick={() => setBuyAmount(pkg.stars.toString())}
                        className={`p-2.5 rounded-xl border text-center transition ${
                          buyAmount === pkg.stars.toString()
                            ? 'bg-[#8B0000] text-[#f0dbb0] border-[#8B0000] shadow-md scale-105'
                            : 'bg-[#fcf5e5] text-[#5c4033] border-[#5c4033]/40 hover:bg-[#e3c08d]'
                        }`}
                      >
                        <div className="text-sm font-black flex items-center justify-center gap-0.5">
                          <span>{pkg.stars}</span>
                          <span className="text-yellow-500">⭐</span>
                        </div>
                        <div className="text-[11px] font-bold mt-0.5">{pkg.points.toLocaleString()} 积分</div>
                        <div className="text-[9px] opacity-75">{pkg.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#5c4033]">或输入自定义 Stars 数量 (1⭐ = 500积分)</label>
                    <div className="relative">
                      <input 
                          type="number" 
                          min="1"
                          value={buyAmount}
                          onChange={(e) => setBuyAmount(e.target.value)}
                          className="w-full bg-[#fcf5e5] border-2 border-[#5c4033] rounded-xl px-4 py-2.5 font-bold text-[#5c4033] text-lg focus:outline-none focus:ring-2 focus:ring-[#8B0000]"
                          placeholder="输入星星数量"
                      />
                      <span className="absolute right-3 top-3 text-sm font-bold text-yellow-600">⭐ Stars</span>
                    </div>
                </div>

                <div className="bg-[#5c4033]/10 p-2.5 rounded-xl text-xs text-[#5c4033] space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="w-4 h-4 text-[#8B0000]" />
                    <span>预计到账：<strong className="text-[#8B0000]">{(parseInt(buyAmount) || 0) * 500}</strong> 积分</span>
                  </div>
                  <div className="text-[11px] text-[#5c4033]/80">使用 Telegram Stars 官方安全支付，即充即到。</div>
                </div>

                {statusMsg && (
                  <p className="text-center text-xs font-bold text-[#8B0000] animate-pulse">{statusMsg}</p>
                )}

                <div className="pt-2 flex gap-2">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-2.5 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold rounded-xl transition"
                    >
                        取消
                    </button>
                    <button 
                        onClick={handleConfirmBuy}
                        disabled={isBuying}
                        className="flex-[2] py-2.5 bg-[#8B0000] hover:bg-[#6b0000] text-[#f0dbb0] font-black rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Sparkles className="w-4 h-4" />
                        <span>{isBuying ? "正在处理..." : `确认支付 ${buyAmount || 0} ⭐`}</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};
