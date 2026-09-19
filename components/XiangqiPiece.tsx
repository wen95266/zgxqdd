import React from 'react';
import { Color, Piece } from '../types';
import { PIECE_CHARS } from '../constants';

interface Props {
  piece: Piece;
  selected: boolean;
  onClick: () => void;
}

export const XiangqiPiece: React.FC<Props> = ({ piece, selected, onClick }) => {
  const isRed = piece.color === Color.RED;
  const chars = PIECE_CHARS[piece.type];
  const char = isRed ? chars[0] : chars[1];

  return (
    <div 
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`
        absolute z-10 
        w-[90%] h-[90%] 
        top-[5%] left-[5%]
        rounded-full 
        flex items-center justify-center 
        cursor-pointer
        transition-all duration-200 ease-out
        ${selected 
          ? 'scale-110 -translate-y-1 z-30 ring-3 ring-amber-400 shadow-[0_8px_18px_rgba(245,158,11,0.4),0_3px_6px_rgba(0,0,0,0.25)]' 
          : 'hover:scale-[1.04] shadow-[0_3px_6px_rgba(40,25,15,0.25),0_1px_2px_rgba(0,0,0,0.18)]'
        }
        ${isRed 
          ? 'bg-gradient-to-br from-[#FFFDF8] via-[#FAF4E6] to-[#EDE2CF] border-2 sm:border-[2.5px] border-[#8A2417]' 
          : 'bg-gradient-to-br from-[#FFFDF8] via-[#F6F1E6] to-[#EBE2D3] border-2 sm:border-[2.5px] border-[#22252A]'
        }
      `}
    >
      {/* Outer concentric engraved ring */}
      <div className={`
        w-[87%] h-[87%] rounded-full border border-solid
        ${isRed ? 'border-[#8A2417]/40' : 'border-[#22252A]/35'}
        flex items-center justify-center
      `}>
        {/* Inner thin decorative ring */}
        <div className={`
          w-[90%] h-[90%] rounded-full border border-dotted
          ${isRed ? 'border-[#8A2417]/25' : 'border-[#22252A]/20'}
          flex items-center justify-center
        `}>
          <span 
            className={`
              text-xl sm:text-2xl md:text-[26px] font-black font-serif select-none leading-none tracking-tighter
              ${isRed 
                ? 'text-[#B93829] drop-shadow-[0_1px_0_rgba(255,255,255,0.7)]' 
                : 'text-[#1C1E22] drop-shadow-[0_1px_0_rgba(255,255,255,0.7)]'
              }
            `}
          >
            {char}
          </span>
        </div>
      </div>
    </div>
  );
};
