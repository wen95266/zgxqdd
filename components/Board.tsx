import React from 'react';
import { BoardState, Position, Move, Color } from '../types';
import { XiangqiPiece } from './XiangqiPiece';

interface Props {
  board: BoardState;
  selectedPos: Position | null;
  validMoves: Position[];
  onSelect: (pos: Position) => void;
  onMove: (move: Move) => void;
  turn: Color;
  lastMove?: Move | null;
  checkedGeneralPos?: Position | null;
  isFlipped?: boolean;
}

// Helper to draw Chinese Chess star corner bracket marks
const StarMark: React.FC<{ cx: number; cy: number; left?: boolean; right?: boolean }> = ({ 
  cx, 
  cy, 
  left = true, 
  right = true 
}) => {
  const d = 1.1;
  const len = 1.5;
  return (
    <g stroke="#452E1E" strokeWidth="0.4" fill="none" opacity="0.85">
      {left && (
        <>
          {/* Top-Left */}
          <path d={`M ${cx - d - len} ${cy - d} L ${cx - d} ${cy - d} L ${cx - d} ${cy - d - len}`} />
          {/* Bottom-Left */}
          <path d={`M ${cx - d - len} ${cy + d} L ${cx - d} ${cy + d} L ${cx - d} ${cy + d + len}`} />
        </>
      )}
      {right && (
        <>
          {/* Top-Right */}
          <path d={`M ${cx + d + len} ${cy - d} L ${cx + d} ${cy - d} L ${cx + d} ${cy - d - len}`} />
          {/* Bottom-Right */}
          <path d={`M ${cx + d + len} ${cy + d} L ${cx + d} ${cy + d} L ${cx + d} ${cy + d + len}`} />
        </>
      )}
    </g>
  );
};

export const Board: React.FC<Props> = ({ 
  board, 
  selectedPos, 
  validMoves, 
  onSelect, 
  onMove, 
  turn,
  lastMove,
  checkedGeneralPos,
  isFlipped = false
}) => {
  
  const handleCellClick = (boardX: number, boardY: number) => {
    const isTarget = validMoves.some(m => m.x === boardX && m.y === boardY);
    
    if (selectedPos && isTarget) {
      onMove({ from: selectedPos, to: { x: boardX, y: boardY } });
      return;
    }

    const piece = board[boardY][boardX];
    if (piece && piece.color === turn) {
      onSelect({ x: boardX, y: boardY });
    } else if (selectedPos) {
      // 点击空白处或非己方棋子取消选择
      onSelect({ x: -1, y: -1 });
    }
  };

  // 棋盘路数刻度 (正常红方视角：黑方顶端1-9，红方底端九-一)
  const redCols = isFlipped ? ['一', '二', '三', '四', '五', '六', '七', '八', '九'] : ['九', '八', '七', '六', '五', '四', '三', '二', '一'];
  const blackCols = isFlipped ? ['9', '8', '7', '6', '5', '4', '3', '2', '1'] : ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="relative w-full aspect-[9/10] max-w-[480px] mx-auto board-wood rounded-2xl sm:rounded-3xl border-[6px] sm:border-[8px] border-[#362216] shadow-[0_16px_36px_-6px_rgba(45,26,14,0.35),0_4px_12px_rgba(0,0,0,0.12)] p-1 select-none touch-manipulation ring-1 ring-[#855D40]/50">
       {/* Background Grid Lines & Authentic Ornaments via SVG */}
       <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 90 100">
          {/* 外边框双线 */}
          <rect x="5" y="5" width="80" height="90" fill="none" stroke="#452E1E" strokeWidth="1.1" />
          <rect x="4.1" y="4.1" width="81.8" height="91.8" fill="none" stroke="#452E1E" strokeWidth="0.4" opacity="0.65" />

          {/* 横线 (Horizontal Lines) */}
          {Array.from({ length: 8 }).map((_, i) => (
             <line key={`h-${i}`} x1="5" y1={15 + i * 10} x2="85" y2={15 + i * 10} stroke="#452E1E" strokeWidth="0.45" />
          ))}

          {/* 竖线 (Vertical Lines，楚河汉界处断开) */}
          {Array.from({ length: 7 }).map((_, i) => (
             <React.Fragment key={`v-${i}`}>
                <line x1={15 + i * 10} y1="5" x2={15 + i * 10} y2="45" stroke="#452E1E" strokeWidth="0.45" />
                <line x1={15 + i * 10} y1="55" x2={15 + i * 10} y2="95" stroke="#452E1E" strokeWidth="0.45" />
             </React.Fragment>
          ))}

          {/* 九宫斜线 (Palace Diagonal X lines) */}
          <line x1="35" y1="5" x2="55" y2="25" stroke="#452E1E" strokeWidth="0.45" />
          <line x1="55" y1="5" x2="35" y2="25" stroke="#452E1E" strokeWidth="0.45" />
          <line x1="35" y1="75" x2="55" y2="95" stroke="#452E1E" strokeWidth="0.45" />
          <line x1="55" y1="75" x2="35" y2="95" stroke="#452E1E" strokeWidth="0.45" />

          {/* 传统炮位与兵位十字星折角标 (Star Corner Marks) */}
          {/* 黑方炮位 */}
          <StarMark cx={15} cy={25} />
          <StarMark cx={75} cy={25} />
          {/* 黑方卒位 */}
          <StarMark cx={5} cy={35} left={false} right={true} />
          <StarMark cx={25} cy={35} />
          <StarMark cx={45} cy={35} />
          <StarMark cx={65} cy={35} />
          <StarMark cx={85} cy={35} left={true} right={false} />

          {/* 红方兵位 */}
          <StarMark cx={5} cy={65} left={false} right={true} />
          <StarMark cx={25} cy={65} />
          <StarMark cx={45} cy={65} />
          <StarMark cx={65} cy={65} />
          <StarMark cx={85} cy={65} left={true} right={false} />
          {/* 红方炮位 */}
          <StarMark cx={15} cy={75} />
          <StarMark cx={75} cy={75} />

          {/* 楚河汉界传统端庄书法 */}
          <text 
            x={isFlipped ? "65" : "25"} 
            y="51.8" 
            fontSize="4.4" 
            fontWeight="bold"
            fontFamily="serif"
            fill="#452E1E" 
            opacity="0.8"
            textAnchor="middle" 
            letterSpacing="3"
          >
            楚 河
          </text>
          <text 
            x={isFlipped ? "25" : "65"} 
            y="51.8" 
            fontSize="4.4" 
            fontWeight="bold"
            fontFamily="serif"
            fill="#452E1E" 
            opacity="0.8"
            textAnchor="middle" 
            letterSpacing="3"
          >
            漢 界
          </text>

          {/* 顶端路数刻度 (1-9) */}
          {blackCols.map((c, idx) => (
            <text
              key={`top-col-${idx}`}
              x={5 + idx * 10}
              y="3.0"
              fontSize="2.4"
              fontWeight="bold"
              fontFamily="sans-serif"
              fill="#503723"
              opacity="0.6"
              textAnchor="middle"
            >
              {c}
            </text>
          ))}

          {/* 底端路数刻度 (九-一) */}
          {redCols.map((c, idx) => (
            <text
              key={`bot-col-${idx}`}
              x={5 + idx * 10}
              y="98.5"
              fontSize="2.4"
              fontWeight="bold"
              fontFamily="serif"
              fill="#503723"
              opacity="0.65"
              textAnchor="middle"
            >
              {c}
            </text>
          ))}
       </svg>

       {/* Pieces & Interaction Layer */}
       <div className="absolute inset-0 grid grid-rows-10 grid-cols-9 z-10 w-full h-full p-[2%]">
          {Array.from({ length: 10 }).map((_, vy) => (
            Array.from({ length: 9 }).map((_, vx) => {
              const x = isFlipped ? 8 - vx : vx;
              const y = isFlipped ? 9 - vy : vy;
              const piece = board[y][x];

              const isSelected = selectedPos?.x === x && selectedPos?.y === y;
              const isValidMoveTarget = validMoves.some(p => p.x === x && p.y === y);
              const isLastMoveFrom = lastMove && lastMove.from.x === x && lastMove.from.y === y;
              const isLastMoveTo = lastMove && lastMove.to.x === x && lastMove.to.y === y;
              const isGeneralInCheck = checkedGeneralPos && checkedGeneralPos.x === x && checkedGeneralPos.y === y;

              return (
                <div 
                  key={`${x}-${y}`} 
                  className="relative w-full h-full flex items-center justify-center cursor-pointer"
                  onClick={() => handleCellClick(x, y)}
                >
                  {/* Last Move Indicator: subtle warm gold bracket / glow */}
                  {(isLastMoveFrom || isLastMoveTo) && (
                    <div className="absolute inset-[6%] bg-amber-500/15 border-2 border-amber-600/70 rounded-full animate-pulse pointer-events-none" />
                  )}

                  {/* General in Check Alert Pulse */}
                  {isGeneralInCheck && (
                    <div className="absolute inset-[2%] bg-red-600/35 rounded-full animate-ping pointer-events-none" />
                  )}

                  {/* Valid Move Indicator */}
                  {isValidMoveTarget && (
                    <div className="absolute z-30 pointer-events-none flex items-center justify-center">
                      {piece ? (
                        <div className="w-8 h-8 rounded-full border-2 border-red-600 ring-2 ring-red-400/50 bg-red-500/20 animate-pulse scale-105" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full bg-[#B93829]/80 ring-2 ring-amber-100/90 shadow-sm animate-pulse" />
                      )}
                    </div>
                  )}
                  
                  {piece && (
                    <XiangqiPiece 
                      piece={piece} 
                      selected={isSelected}
                      onClick={() => handleCellClick(x, y)}
                    />
                  )}
                </div>
              );
            })
          ))}
       </div>
    </div>
  );
};
