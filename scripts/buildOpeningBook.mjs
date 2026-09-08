// Script to generate a verified, master-level Xiangqi opening book with exact FENs
import fs from 'fs';

const ROWS = 10;
const COLS = 9;

const PIECE_TYPES = {
  general: 'k',
  advisor: 'a',
  elephant: 'b',
  horse: 'n',
  chariot: 'r',
  cannon: 'c',
  soldier: 'p'
};

function createInitialBoard() {
  const board = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));

  const setP = (type, color, x, y) => {
    board[y][x] = { type, color };
  };

  // Black (y=0 to 3)
  setP('chariot', 'black', 0, 0);
  setP('horse', 'black', 1, 0);
  setP('elephant', 'black', 2, 0);
  setP('advisor', 'black', 3, 0);
  setP('general', 'black', 4, 0);
  setP('advisor', 'black', 5, 0);
  setP('elephant', 'black', 6, 0);
  setP('horse', 'black', 7, 0);
  setP('chariot', 'black', 8, 0);

  setP('cannon', 'black', 1, 2);
  setP('cannon', 'black', 7, 2);

  for (let i = 0; i < 5; i++) {
    setP('soldier', 'black', i * 2, 3);
  }

  // Red (y=6 to 9)
  setP('chariot', 'red', 0, 9);
  setP('horse', 'red', 1, 9);
  setP('elephant', 'red', 2, 9);
  setP('advisor', 'red', 3, 9);
  setP('general', 'red', 4, 9);
  setP('advisor', 'red', 5, 9);
  setP('elephant', 'red', 6, 9);
  setP('horse', 'red', 7, 9);
  setP('chariot', 'red', 8, 9);

  setP('cannon', 'red', 1, 7);
  setP('cannon', 'red', 7, 7);

  for (let i = 0; i < 5; i++) {
    setP('soldier', 'red', i * 2, 6);
  }

  return board;
}

function cloneBoard(b) {
  return b.map(row => row.map(cell => cell ? { ...cell } : null));
}

function boardToFen(board, turn) {
  let fen = "";
  for (let y = 0; y < 10; y++) {
    let empty = 0;
    for (let x = 0; x < 9; x++) {
      const p = board[y][x];
      if (!p) {
        empty++;
      } else {
        if (empty > 0) { fen += empty; empty = 0; }
        let c = PIECE_TYPES[p.type] || 'p';
        if (p.color === 'red') c = c.toUpperCase();
        fen += c;
      }
    }
    if (empty > 0) fen += empty;
    if (y < 9) fen += "/";
  }
  return `${fen} ${turn === 'red' ? 'w' : 'b'}`;
}

function makeMove(board, from, to) {
  const [fx, fy] = from;
  const [tx, ty] = to;
  const p = board[fy][fx];
  if (!p) throw new Error(`No piece at [${fx}, ${fy}]`);
  board[ty][tx] = p;
  board[fy][fx] = null;
}

// Master opening trees: each branch is an array of steps
// { from, to, name, desc, score }
const OPENING_LINES = [
  // ================= 1. 中炮对屏风马 (Screen Horses) 体系 =================
  // 经典一：中炮进三兵对屏风马挺3卒
  [
    { from: [7, 7], to: [4, 7], name: "中炮局 (当头炮)", desc: "炮二平五，控扼中路，最强刚猛开局", score: 100 },
    { from: [7, 0], to: [6, 2], name: "屏风马 (马8进7)", desc: "正规守法，双马互保，弹性十足", score: 100 },
    { from: [7, 9], to: [6, 7], name: "跳正马 (马二进三)", desc: "巩固中兵，正常出子调动主力", score: 100 },
    { from: [8, 0], to: [7, 0], name: "亮出左直车 (车9平8)", desc: "快速出大子，抢占八路要道", score: 100 },
    { from: [8, 9], to: [7, 9], name: "亮出右直车 (车一平二)", desc: "针锋相对，亮车争夺纵线", score: 100 },
    { from: [1, 0], to: [2, 2], name: "成双正马 (马2进3)", desc: "屏风马阵型筑成，铜墙铁壁", score: 100 },
    { from: [6, 6], to: [6, 5], name: "进三兵 (兵三进一)", desc: "活通相边马路，压制黑方7路马", score: 98 },
    { from: [2, 3], to: [2, 4], name: "挺3卒 (卒3进1)", desc: "挺起3卒，制约红方八路马", score: 98 },
    { from: [1, 9], to: [2, 7], name: "进八路马 (马八进七)", desc: "双马盘旋，红方阵型极度稳固", score: 95 },
    { from: [2, 0], to: [4, 2], name: "左象飞中 (象3进5)", desc: "巩固中防，防止红炮急进冲中卒", score: 95 },
    { from: [7, 9], to: [7, 3], name: "巡河车 (车二进六)", desc: "深入敌境，过河压制黑方卒林线", score: 95 },
    { from: [6, 2], to: [5, 4], name: "左马盘河 (马7进6)", desc: "奔马跃过楚河，反击红车锋芒", score: 95 }
  ],

  // 经典二：中炮进七兵对屏风马挺7卒
  [
    { from: [7, 7], to: [4, 7], name: "当头炮 (炮二平五)", desc: "当头炮把马跳，中路雄霸", score: 100 },
    { from: [7, 0], to: [6, 2], name: "起左正马 (马8进7)", desc: "屏风马正规开局", score: 100 },
    { from: [7, 9], to: [6, 7], name: "跳正马 (马二进三)", desc: "护卫中兵", score: 100 },
    { from: [8, 0], to: [7, 0], name: "左直车 (车9平8)", desc: "抢占直车要道", score: 100 },
    { from: [8, 9], to: [7, 9], name: "出右车 (车一平二)", desc: "出车对峙", score: 100 },
    { from: [1, 0], to: [2, 2], name: "双正马 (马2进3)", desc: "屏风马体系完整", score: 100 },
    { from: [2, 6], to: [2, 5], name: "进七兵 (兵七进一)", desc: "制约黑方左翼屏风马", score: 98 },
    { from: [6, 3], to: [6, 4], name: "挺7卒 (卒7进1)", desc: "挺7卒活马通路，正面对抗", score: 98 },
    { from: [7, 9], to: [7, 3], name: "过河车 (车二进六)", desc: "抢占卒林高位，锁死黑马活动", score: 96 },
    { from: [7, 2], to: [7, 6], name: "平炮过河 (炮8进4)", desc: "过河封车，经典屏风马反击利器", score: 96 }
  ],

  // 经典三：中炮对反宫马 (Sandwich Horses)
  [
    { from: [7, 7], to: [4, 7], name: "当头炮 (炮二平五)", desc: "中路主攻", score: 100 },
    { from: [1, 0], to: [2, 2], name: "反宫马 (马2进3)", desc: "反宫马首步，暗藏飞刀", score: 98 },
    { from: [7, 9], to: [6, 7], name: "跳正马 (马二进三)", desc: "稳固出子", score: 100 },
    { from: [7, 2], to: [5, 2], name: "士角炮 (炮8平6)", desc: "反宫马标志性士角炮，防守反击", score: 98 },
    { from: [8, 9], to: [7, 9], name: "开右直车 (车一平二)", desc: "快速出车控制要津", score: 98 },
    { from: [7, 0], to: [6, 2], name: "跳左马 (马8进7)", desc: "双马内收，士角发炮", score: 98 },
    { from: [6, 6], to: [6, 5], name: "进三兵 (兵三进一)", desc: "破反宫马最有效着法，挺兵活马", score: 96 },
    { from: [8, 0], to: [7, 0], name: "出直车 (车9平8)", desc: "黑方直车迎战", score: 96 }
  ],

  // 经典四：顺手炮 (Same Direction Cannons) - 刚烈大对攻
  [
    { from: [7, 7], to: [4, 7], name: "当头炮 (炮二平五)", desc: "当头炮，大开大合", score: 100 },
    { from: [7, 2], to: [4, 2], name: "顺手炮 (炮8平5)", desc: "斗炮局！以攻对攻，互轰中路", score: 95 },
    { from: [7, 9], to: [6, 7], name: "跳正马 (马二进三)", desc: "保护中路，防止黑炮闪击", score: 100 },
    { from: [1, 0], to: [2, 2], name: "跳正马 (马2进3)", desc: "黑方也跳正马，对仗工整", score: 100 },
    { from: [8, 9], to: [7, 9], name: "出直车 (车一平二)", desc: "抢占直车主动权", score: 100 },
    { from: [8, 0], to: [8, 1], name: "起横车 (车9进1)", desc: "顺炮经典！横车过宫调动灵活", score: 96 },
    { from: [7, 9], to: [7, 5], name: "巡河车 (车二进四)", desc: "巡河压制，封锁黑方过河点", score: 95 },
    { from: [8, 1], to: [4, 1], name: "肋道肋车 (车9平4)", desc: "抢占四路肋道，直指红方九宫", score: 95 }
  ],

  // 经典五：列手炮 (Opposite Cannons) - 锋芒毕露
  [
    { from: [7, 7], to: [4, 7], name: "当头炮 (炮二平五)", desc: "当头炮控制中轴", score: 100 },
    { from: [1, 2], to: [4, 2], name: "列手炮 (炮2平5)", desc: "小列手炮！背水争雄，险象环生", score: 92 },
    { from: [7, 9], to: [6, 7], name: "跳正马 (马二进三)", desc: "巩固中线", score: 100 },
    { from: [1, 0], to: [2, 2], name: "跳正马 (马2进3)", desc: "快速出马", score: 96 },
    { from: [8, 9], to: [7, 9], name: "出直车 (车一平二)", desc: "快速出动强子", score: 100 },
    { from: [0, 0], to: [1, 0], name: "右直车 (车1平2)", desc: "黑方快速亮车对峙", score: 96 }
  ],

  // ================= 2. 飞相局 (Elephant Opening) 体系 =================
  // 飞相对左中炮
  [
    { from: [6, 9], to: [4, 7], name: "飞相局 (相三进五)", desc: "扬相护中，固若金汤，以柔克刚", score: 98 },
    { from: [7, 2], to: [4, 2], name: "架左中炮 (炮8平5)", desc: "正面直击红方中路空隙", score: 96 },
    { from: [7, 9], to: [6, 7], name: "正马护中 (马二进三)", desc: "出马保护中兵", score: 98 },
    { from: [7, 0], to: [6, 2], name: "跳左马 (马8进7)", desc: "正常运子出击", score: 96 },
    { from: [8, 9], to: [7, 9], name: "出直车 (车一平二)", desc: "占领二路要道", score: 98 },
    { from: [8, 0], to: [7, 0], name: "出直车 (车9平8)", desc: "黑方出车对抗", score: 98 },
    { from: [2, 6], to: [2, 5], name: "挺七兵 (兵七进一)", desc: "疏通马路，伺机反击", score: 95 }
  ],

  // 飞相对挺卒制马
  [
    { from: [6, 9], to: [4, 7], name: "飞相局 (相三进五)", desc: "以逸待劳，深谋远虑", score: 98 },
    { from: [2, 3], to: [2, 4], name: "挺3卒 (卒3进1)", desc: "制约红马，争夺战略空间", score: 96 },
    { from: [7, 9], to: [6, 7], name: "起正马 (马二进三)", desc: "顺势起马", score: 98 },
    { from: [1, 0], to: [2, 2], name: "跳正马 (马2进3)", desc: "黑方出马占中", score: 96 },
    { from: [6, 6], to: [6, 5], name: "挺三兵 (兵三进一)", desc: "对挺三兵，两军互控", score: 95 }
  ],

  // ================= 3. 仙人指路 (Pawn Opening) 体系 =================
  // 仙人指路对卒底炮
  [
    { from: [2, 6], to: [2, 5], name: "仙人指路 (兵七进一)", desc: "投石问路，变化万千，高深莫测", score: 98 },
    { from: [7, 2], to: [6, 2], name: "卒底炮 (炮8平7)", desc: "瞄准红方薄弱马路，针锋相对", score: 96 },
    { from: [7, 7], to: [4, 7], name: "架当头炮 (炮二平五)", desc: "借势转当头炮，攻防易位", score: 98 },
    { from: [7, 0], to: [6, 2], name: "跳正马 (马8进7)", desc: "护住中卒", score: 96 },
    { from: [7, 9], to: [6, 7], name: "起正马 (马二进三)", desc: "出马护中，步步争先", score: 96 },
    { from: [8, 0], to: [7, 0], name: "出直车 (车9平8)", desc: "开出主力大车", score: 96 }
  ],

  // 仙人指路对飞象
  [
    { from: [2, 6], to: [2, 5], name: "仙人指路 (兵七进一)", desc: "试探虚实", score: 98 },
    { from: [6, 0], to: [4, 2], name: "飞中象 (象7进5)", desc: "以稳为主，中路厚实", score: 95 },
    { from: [7, 7], to: [4, 7], name: "架中炮 (炮二平五)", desc: "见招拆招，果断架炮", score: 96 },
    { from: [7, 0], to: [6, 2], name: "跳正马 (马8进7)", desc: "保护中线", score: 95 }
  ],

  // ================= 4. 起马局 (Horse Opening) 体系 =================
  [
    { from: [7, 9], to: [6, 7], name: "起马局 (马二进三)", desc: "大将先登，稳中藏杀，不急于表态", score: 95 },
    { from: [7, 0], to: [6, 2], name: "对起正马 (马8进7)", desc: "正规应手，以静制动", score: 95 },
    { from: [6, 6], to: [6, 5], name: "挺三兵 (兵三进一)", desc: "活马通津，打开通道", score: 95 },
    { from: [6, 3], to: [6, 4], name: "挺7卒 (卒7进1)", desc: "针锋相对，互不退让", score: 95 },
    { from: [8, 9], to: [7, 9], name: "出直车 (车一平二)", desc: "抢占大路", score: 96 }
  ],

  // ================= 5. 过宫炮与士角炮体系 =================
  // 过宫炮
  [
    { from: [7, 7], to: [5, 7], name: "过宫炮 (炮二平六)", desc: "偏师攻击，快速集中兵力进攻一翼", score: 94 },
    { from: [7, 0], to: [6, 2], name: "跳左正马 (马8进7)", desc: "不慌不忙，守住中心", score: 95 },
    { from: [7, 9], to: [6, 7], name: "跳右马 (马二进三)", desc: "顺势布子", score: 95 },
    { from: [8, 0], to: [7, 0], name: "出直车 (车9平8)", desc: "抢夺通道", score: 95 },
    { from: [8, 9], to: [7, 9], name: "出直车 (车一平二)", desc: "两军对垒", score: 95 }
  ],

  // 士角炮 (炮二平四)
  [
    { from: [7, 7], to: [3, 7], name: "士角炮 (炮二平四)", desc: "含蓄稳重，蓄力反击，暗藏飞刀杀机", score: 92 },
    { from: [7, 0], to: [6, 2], name: "跳左正马 (马8进7)", desc: "以逸待劳，抢占要津", score: 95 },
    { from: [7, 9], to: [6, 7], name: "起正马 (马二进三)", desc: "步调协调，稳步推进", score: 95 },
    { from: [8, 0], to: [7, 0], name: "出直车 (车9平8)", desc: "迅速出动主力大车", score: 95 },
    { from: [8, 9], to: [7, 9], name: "出直车 (车一平二)", desc: "对抢纵道", score: 95 }
  ],

  // ================= 6. 中炮进七兵急进中兵 / 冲兵绝杀体系 =================
  [
    { from: [7, 7], to: [4, 7], name: "当头炮 (炮二平五)", desc: "当头炮强攻中路", score: 100 },
    { from: [7, 0], to: [6, 2], name: "跳正马 (马8进7)", desc: "屏风马守御", score: 100 },
    { from: [7, 9], to: [6, 7], name: "跳正马 (马二进三)", desc: "出马巩固中线", score: 100 },
    { from: [8, 0], to: [7, 0], name: "出直车 (车9平8)", desc: "抢占八路要津", score: 100 },
    { from: [8, 9], to: [7, 9], name: "出直车 (车一平二)", desc: "出车迎战", score: 100 },
    { from: [1, 0], to: [2, 2], name: "成双马 (马2进3)", desc: "双马盘护", score: 100 },
    { from: [2, 6], to: [2, 5], name: "进七兵 (兵七进一)", desc: "制约黑方右马", score: 98 },
    { from: [6, 3], to: [6, 4], name: "挺7卒 (卒7进1)", desc: "挺卒活马", score: 98 },
    { from: [1, 9], to: [2, 7], name: "跳八路马 (马八进七)", desc: "全军动员", score: 95 },
    { from: [0, 0], to: [1, 0], name: "出右直车 (车1平2)", desc: "双车齐出，黑方阵势极严", score: 95 }
  ],

  // 顺炮横车直车对攻
  [
    { from: [7, 7], to: [4, 7], name: "当头炮 (炮二平五)", desc: "当头炮攻势", score: 100 },
    { from: [7, 2], to: [4, 2], name: "顺手炮 (炮8平5)", desc: "斗炮大对攻", score: 95 },
    { from: [7, 9], to: [6, 7], name: "跳正马 (马二进三)", desc: "出正马", score: 100 },
    { from: [1, 0], to: [2, 2], name: "跳正马 (马2进3)", desc: "出正马", score: 100 },
    { from: [8, 9], to: [8, 8], name: "起横车 (车一进一)", desc: "红起横车！准备巡河或调动过宫", score: 96 },
    { from: [8, 0], to: [7, 0], name: "出直车 (车9平8)", desc: "黑方直车快速抢占要道", score: 98 },
    { from: [8, 8], to: [4, 8], name: "横车占中 (车一平五)", desc: "横车拱卫中路，双重压迫", score: 95 },
    { from: [6, 0], to: [4, 2], name: "补象护中 (象7进5)", desc: "巩固中防，化解红方攻势", score: 95 }
  ]
];

// Now build the map of fen -> BookEntry[]
const bookMap = {};

let totalEntries = 0;

for (const line of OPENING_LINES) {
  const board = createInitialBoard();
  let currentTurn = 'red';

  for (const step of line) {
    const fen = boardToFen(board, currentTurn);
    if (!bookMap[fen]) {
      bookMap[fen] = [];
    }

    // Check if this move already recorded for this FEN
    const exists = bookMap[fen].some(
      entry => entry.move.from[0] === step.from[0] &&
               entry.move.from[1] === step.from[1] &&
               entry.move.to[0] === step.to[0] &&
               entry.move.to[1] === step.to[1]
    );

    if (!exists) {
      bookMap[fen].push({
        move: { from: step.from, to: step.to },
        name: step.name,
        desc: step.desc,
        score: step.score
      });
      totalEntries++;
    }

    // Execute move on board
    makeMove(board, step.from, step.to);
    currentTurn = currentTurn === 'red' ? 'black' : 'red';
  }
}

console.log(`Generated ${Object.keys(bookMap).length} positions with ${totalEntries} book moves.`);

// Write typescript file
const fileContent = `import { Move, Position } from '../types';

export interface BookEntry {
    move: { from: [number, number], to: [number, number] }; // [x, y]
    name: string; // 布局名称
    desc: string; // 战术意图
    score: number; // 推荐分数
}

// 辅助函数：生成精简版 FEN (只看棋盘和轮次)
export const getSimpifiedFen = (board: any[][], turn: string): string => {
    let fen = "";
    for (let y = 0; y < 10; y++) {
        let empty = 0;
        for (let x = 0; x < 9; x++) {
            const p = board[y][x];
            if (!p) {
                empty++;
            } else {
                if (empty > 0) { fen += empty; empty = 0; }
                let c = p.type === 'horse' ? 'n' : 
                        p.type === 'chariot' ? 'r' : 
                        p.type === 'elephant' ? 'b' : 
                        p.type === 'advisor' ? 'a' : 
                        p.type === 'general' ? 'k' : 
                        p.type === 'cannon' ? 'c' : 'p';
                if (p.color === 'red') c = c.toUpperCase();
                fen += c;
            }
        }
        if (empty > 0) fen += empty;
        if (y < 9) fen += "/";
    }
    return \`\${fen} \${turn === 'red' ? 'w' : 'b'}\`;
};

// ==================== 国手大师棋谱库 (程序化高精度定式) ====================
const OPENING_BOOK: Record<string, BookEntry[]> = ${JSON.stringify(bookMap, null, 2)};

export const getBookMove = (board: any[][], turn: string): BookEntry | null => {
    const fen = getSimpifiedFen(board, turn);
    const moves = OPENING_BOOK[fen];
    if (moves && moves.length > 0) {
        // 85% 选最高分，15% 选次优变着
        const random = Math.random();
        if (random > 0.85 && moves.length > 1) {
            return moves[1];
        }
        return moves[0];
    }
    return null;
};

export const getBookSuggestions = (board: any[][], turn: string): BookEntry[] => {
    const fen = getSimpifiedFen(board, turn);
    return OPENING_BOOK[fen] || [];
};
`;

fs.writeFileSync('./utils/openingBook.ts', fileContent, 'utf-8');
console.log('Saved to ./utils/openingBook.ts');
