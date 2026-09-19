import React from 'react';
import { X, BookOpen, ShieldCheck, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const rules = [
    { name: '帅 / 将', desc: '九宫格内直行一步，双方老将不可隔空照面（飞将对脸者杀）。' },
    { name: '仕 / 士', desc: '九宫格内沿对角线斜走一步，专职护卫中宫帅帐。' },
    { name: '相 / 象', desc: '走田字格，不能过河；若田字中心有子阻碍，即为“塞象眼”，不可通行。' },
    { name: '傌 / 马', desc: '走日字格（一直一斜）；若前进方向紧邻格有子阻挡，即为“别马腿”，不可通行。' },
    { name: '俥 / 车', desc: '横冲直撞，直线上任意格数无子阻挡皆可自由行进与吃子，攻守兼备之首。' },
    { name: '砲 / 炮', desc: '不吃子时如车直行；吃子时必须隔一个子（不论敌我，俗称“炮架”）方能发起攻击。' },
    { name: '兵 / 卒', desc: '过楚河汉界前只能向前一步；过河后可向前或左右横行一步，不可后退。' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-[#FAF7F0] border border-[#D5C7B4] w-full max-w-md rounded-3xl p-6 relative shadow-2xl max-h-[85vh] flex flex-col">
            <button 
              onClick={onClose} 
              className="absolute top-4 right-4 p-1.5 hover:bg-black/5 text-[#5C493A] rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-center space-x-2 border-b border-[#3D281C]/15 pb-3 mb-3">
                <BookOpen className="w-5 h-5 text-[#B93829]" />
                <h2 className="text-2xl font-black font-serif text-[#2B231C] tracking-wide">中国象棋对弈准则</h2>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 text-[#423428]">
                <div className="bg-white p-3.5 rounded-2xl border border-[#DCD1C0] shadow-2xs">
                    <h3 className="font-bold font-serif text-sm text-[#B93829] mb-2.5 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" /> 棋子走法要诀
                    </h3>
                    <div className="space-y-2 text-xs leading-relaxed">
                        {rules.map((r, i) => (
                            <div key={i} className="flex gap-2">
                                <span className="font-serif font-bold text-[#B93829] whitespace-nowrap">{r.name}:</span>
                                <span className="text-[#5C493A]">{r.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-[#DCD1C0] space-y-1.5 text-xs text-[#5C493A] leading-relaxed shadow-2xs">
                    <h3 className="font-bold font-serif text-[#B93829] flex items-center gap-1.5 mb-2">
                        <AlertCircle className="w-4 h-4" /> 胜负与判和准则
                    </h3>
                    <p>• <strong className="text-[#2B231C]">将死绝杀</strong>：一方被将军且无任何合法解将招法，直接判负。</p>
                    <p>• <strong className="text-[#2B231C]">困毙判负</strong>：轮到走棋一方未被将军但已无任何合法棋步可走，判为困毙负。</p>
                    <p>• <strong className="text-[#2B231C]">长将禁例</strong>：单方面连续将军同一棋子超过规定限制，长将方判负。</p>
                    <p>• <strong className="text-[#2B231C]">60步自然限着</strong>：连续60回合双方均无吃子，自动判和局。</p>
                </div>
            </div>

            <button
                onClick={onClose}
                className="mt-4 w-full py-2.5 bg-[#B93829] hover:bg-[#A0281A] active:scale-95 text-white font-bold rounded-2xl shadow-sm transition cursor-pointer"
            >
                研读完毕，返回棋局
            </button>
        </div>
    </div>
  );
};
