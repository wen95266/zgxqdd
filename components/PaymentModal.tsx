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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-[#FAF7F0] border border-[#D5C7B4] w-full max-w-sm rounded-3xl p-6 relative shadow-2xl">
            <button 
              onClick={onClose} 
              className="absolute top-4 right-4 p-1.5 hover:bg-black/5 text-[#5C493A] rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center justify-center space-x-2 border-b border-[#3D281C]/15 pb-3 mb-5">
                <Coins className="w-6 h-6 text-[#B93829]" />
                <h2 className="text-2xl font-black font-serif text-[#2B231C] tracking-wide">积分星标充值</h2>
            </div>

            <div className="space-y-4">
                <div className="bg-white p-3 rounded-2xl border border-[#DCD1C0] flex justify-between items-center text-sm font-bold text-[#5C493A] shadow-2xs">
                  <span>当前账户余额</span>
                  <span className="text-[#B93829] font-mono text-base font-black">{user?.points ?? 0} 积分</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#5C493A] block mb-2 font-serif">选择快捷充值包</label>
                  <div className="grid grid-cols-3 gap-2">
                    {quickPackages.map(pkg => (
                      <button
                        key={pkg.stars}
                        type="button"
                        onClick={() => setBuyAmount(pkg.stars.toString())}
                        className={`p-2.5 rounded-2xl border text-center transition cursor-pointer ${
                          buyAmount === pkg.stars.toString()
                            ? 'bg-[#B93829] text-white border-[#B93829] shadow-sm scale-102 font-bold'
                            : 'bg-white text-[#5C493A] border-[#DCD1C0] hover:border-[#B93829]/50 shadow-2xs'
                        }`}
                      >
                        <div className="text-sm font-black flex items-center justify-center gap-0.5">
                          <span>{pkg.stars}</span>
                          <span className="text-amber-500">⭐</span>
                        </div>
                        <div className="text-[11px] font-bold mt-0.5">{pkg.points.toLocaleString()} 积分</div>
                        <div className="text-[9px] opacity-75">{pkg.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#5C493A] font-serif">或输入自定义 Stars 数量 (1⭐ = 500积分)</label>
                    <div className="relative">
                      <input 
                          type="number" 
                          min="1"
                          value={buyAmount}
                          onChange={(e) => setBuyAmount(e.target.value)}
                          className="w-full bg-white border border-[#DCD1C0] rounded-2xl px-4 py-2.5 font-bold text-[#2B231C] text-base focus:outline-hidden focus:border-[#B93829] focus:ring-1 focus:ring-[#B93829] shadow-2xs"
                          placeholder="输入星星数量"
                      />
                      <span className="absolute right-3.5 top-3 text-xs font-bold text-amber-600">⭐ Stars</span>
                    </div>
                </div>

                <div className="bg-white/80 border border-[#DCD1C0] p-3 rounded-2xl text-xs text-[#5C493A] space-y-1 shadow-2xs">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="w-4 h-4 text-[#B93829]" />
                    <span>预计到账：<strong className="text-[#B93829] font-mono">{(parseInt(buyAmount) || 0) * 500}</strong> 积分</span>
                  </div>
                  <div className="text-[11px] text-[#5C493A]/80">使用 Telegram Stars 官方安全支付，即充即到。</div>
                </div>

                {statusMsg && (
                  <p className="text-center text-xs font-bold text-[#B93829] animate-pulse">{statusMsg}</p>
                )}

                <div className="pt-2 flex gap-2">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-2.5 bg-white hover:bg-stone-100 text-[#5C493A] border border-[#DCD1C0] font-bold rounded-2xl transition cursor-pointer"
                    >
                        取消
                    </button>
                    <button 
                        onClick={handleConfirmBuy}
                        disabled={isBuying}
                        className="flex-[2] py-2.5 bg-[#B93829] hover:bg-[#A0281A] active:scale-95 text-white font-bold rounded-2xl shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
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
