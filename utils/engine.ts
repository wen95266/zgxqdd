import { BoardState, Color, Move, Piece, PieceType, Position, ROWS, COLS } from '../types';
import { getValidMoves, willBeChecked, PIECE_VALUES, isKingInDanger, isSquareAttacked } from './gameLogic';
import { PIECE_CHARS } from '../constants';
import { getBookMove, getBookSuggestions } from './openingBook';

export type AIDifficulty = 'beginner' | 'intermediate' | 'master' | 'grandmaster';

// ================= 引擎深度与搜索配置 =================
export const DEPTH_MAP: Record<AIDifficulty, number> = {
  beginner: 2,
  intermediate: 4,
  master: 6,
  grandmaster: 7,
};

const SUGGESTION_DEPTH = 3; 
const INFINITY = 999999;
const MATE_SCORE = 50000;
const MAX_PLY = 36;

// ================= Zobrist Hashing (增量哈希) =================
const ZOBRIST_TABLE: number[][][] = [];
let ZOBRIST_SIDE: number = 0;

const initZobrist = () => {
    if (ZOBRIST_TABLE.length > 0) return;
    const rand32 = () => Math.floor(Math.random() * 0xFFFFFFFF);

    for (let y = 0; y < ROWS; y++) {
        const row: number[][] = [];
        for (let x = 0; x < COLS; x++) {
            const pieces: number[] = [];
            for (let i = 0; i < 14; i++) {
                pieces.push(rand32());
            }
            row.push(pieces);
        }
        ZOBRIST_TABLE.push(row);
    }
    ZOBRIST_SIDE = rand32();
};

initZobrist();

const getPieceIndex = (p: { type: PieceType, color: Color }): number => {
    let idx = 0;
    switch (p.type) {
        case PieceType.GENERAL: idx = 0; break;
        case PieceType.ADVISOR: idx = 1; break;
        case PieceType.ELEPHANT: idx = 2; break;
        case PieceType.HORSE: idx = 3; break;
        case PieceType.CHARIOT: idx = 4; break;
        case PieceType.CANNON: idx = 5; break;
        case PieceType.SOLDIER: idx = 6; break;
    }
    if (p.color === Color.BLACK) idx += 7;
    return idx;
};

export const computeHash = (board: BoardState, turn: Color): number => {
    let h = 0;
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const p = board[y][x];
            if (p) {
                h ^= ZOBRIST_TABLE[y][x][getPieceIndex(p)];
            }
        }
    }
    if (turn === Color.BLACK) h ^= ZOBRIST_SIDE;
    return h;
};

// O(1) 极速增量哈希更新
const updateHash = (
    currentHash: number,
    from: Position,
    to: Position,
    piece: { type: PieceType, color: Color },
    capturedPiece: { type: PieceType, color: Color } | null
): number => {
    const pIdx = getPieceIndex(piece);
    let h = currentHash ^ ZOBRIST_TABLE[from.y][from.x][pIdx] ^ ZOBRIST_TABLE[to.y][to.x][pIdx];
    if (capturedPiece) {
        h ^= ZOBRIST_TABLE[to.y][to.x][getPieceIndex(capturedPiece)];
    }
    h ^= ZOBRIST_SIDE;
    return h;
};

// ================= 置换表 (Transposition Table) =================
interface TTEntry {
    depth: number;
    score: number;
    flag: 0 | 1 | 2; // 0: EXACT, 1: LOWERBOUND (BETA CUTOFF), 2: UPPERBOUND (ALPHA)
    bestMove?: Move;
}
const TT = new Map<number, TTEntry>();

const cleanTT = () => {
    if (TT.size > 300000) TT.clear();
};

// ================= 杀手着法、对策着法与历史启发表 =================
const killerMoves: (Move | null)[][] = Array(MAX_PLY).fill(null).map(() => [null, null]);

// counterMoves[fromY][fromX][toY][toX]: 存储对上一手着法的最佳针对反击
const counterMoves: (Move | null)[][][][] = Array(ROWS).fill(null).map(() =>
    Array(COLS).fill(null).map(() =>
        Array(ROWS).fill(null).map(() => Array(COLS).fill(null))
    )
);

const historyTable: number[][][][] = Array(ROWS).fill(0).map(() => 
    Array(COLS).fill(0).map(() => 
        Array(ROWS).fill(0).map(() => Array(COLS).fill(0))
    )
);

const resetSearchTables = () => {
    for (let i = 0; i < MAX_PLY; i++) {
        killerMoves[i][0] = null;
        killerMoves[i][1] = null;
    }
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            for (let ty = 0; ty < ROWS; ty++) {
                historyTable[y][x][ty].fill(0);
                for (let tx = 0; tx < COLS; tx++) {
                    counterMoves[y][x][ty][tx] = null;
                }
            }
        }
    }
};

// ================= 精准位置价值表 (Piece-Square Tables) =================
// 坐标系统：r=0 敌方底线 (最深处)，r=9 我方底线 (出生点)
const PAWN_PST = [
    [  0,   5,  10,  20,  25,  20,  10,   5,   0], // r=0 敌底线 (老卒无功，比宫顶线低)
    [ 30,  45,  75,  95, 110,  95,  75,  45,  30], // r=1 宫顶线 (直封将门，最致命)
    [ 25,  40,  65,  85,  90,  85,  65,  40,  25], // r=2 敌方下二路 (威胁极大)
    [ 20,  30,  45,  60,  65,  60,  45,  30,  20], // r=3 敌方卒林
    [ 15,  20,  35,  50,  55,  50,  35,  20,  15], // r=4 渡河前线
    [  0,   0,   5,   0,  15,   0,   5,   0,   0], // r=5 我方河沿
    [  0,   0,   5,   0,  10,   0,   5,   0,   0], // r=6 我方兵林 (中兵+三七兵挺起)
    [  0,   0,   0,   0,   0,   0,   0,   0,   0], // r=7
    [  0,   0,   0,   0,   0,   0,   0,   0,   0], // r=8
    [  0,   0,   0,   0,   0,   0,   0,   0,   0], // r=9
];

const ROOK_PST = [
    [ 25,  35,  30,  45,  40,  45,  30,  35,  25], // r=0 锁底线 (控九宫底线)
    [ 35,  50,  45,  60,  55,  60,  45,  50,  35], // r=1 敌方咽喉线 (下二道，极强；尤其占肋c=3,5)
    [ 20,  30,  25,  45,  40,  45,  25,  30,  20], // r=2 敌方宫顶 (肋车压制)
    [ 25,  35,  30,  45,  40,  45,  30,  35,  25], // r=3 敌方卒林 (巡河抓子压马)
    [ 20,  25,  25,  35,  35,  35,  25,  25,  20], // r=4 楚河汉界 (骑河车)
    [ 15,  20,  20,  30,  30,  30,  20,  20,  15], // r=5 我方巡河线
    [  5,  15,  15,  25,  25,  25,  15,  15,   5], // r=6
    [  0,  10,  10,  15,  15,  15,  10,  10,   0], // r=7
    [ -5,  10,   5,  15,  15,  15,   5,  10,  -5], // r=8
    [-20,   5,   0,  10,   5,  10,   0,   5, -20], // r=9 初始底角车 (未出动惩罚)
];

const HORSE_PST = [
    [-10,   0,   5,  15,  15,  15,   5,   0, -10], // r=0
    [  5,  35,  45,  55,  40,  55,  45,  35,   5], // r=1 卧槽马 (c=2,6)、挂角位 (c=3,5)
    [ 10,  30,  45,  60,  50,  60,  45,  30,  10], // r=2 钓鱼马前沿
    [ 15,  25,  35,  45,  45,  45,  35,  25,  15], // r=3 敌方卒林跃进
    [ 10,  20,  30,  35,  35,  35,  30,  20,  10], // r=4 跃马过河
    [  5,  15,  25,  30,  30,  30,  25,  15,   5], // r=5 巡河马
    [  0,  10,  20,  25,  20,  25,  20,  10,   0], // r=6 正马盘头
    [ -5,   5,  15,  10,   0,  10,  15,   5,  -5], // r=7
    [-15,   0,   5,   0,-130,   0,   5,   0, -15], // r=8 (窝心马 r=8, c=4 极重惩罚 -130)
    [-25, -10,  -5,  -5, -30,  -5,  -5, -10, -25], // r=9 初始位
];

const CANNON_PST = [
    [ 20,  20,  20,  25,  35,  25,  20,  20,  20], // r=0 沉底炮 (威胁将门底线)
    [ 15,  20,  20,  25,  40,  25,  20,  20,  15], // r=1
    [ 25,  30,  30,  45,  55,  45,  30,  30,  25], // r=2 炮火主攻线 (夹车炮/肋炮/当头)
    [ 15,  20,  20,  30,  45,  30,  20,  20,  15], // r=3 压制卒林
    [ 10,  15,  15,  25,  35,  25,  15,  15,  10], // r=4
    [  5,  10,  10,  20,  30,  20,  10,  10,   5], // r=5
    [  0,   5,   5,  15,  25,  15,   5,   5,   0], // r=6
    [  5,   0,  15,  10,  45,  10,  15,   0,   5], // r=7 初始炮台 / 当头炮 (c=4)
    [  0,   0,   0,   5,  15,   5,   0,   0,   0], // r=8
    [ -5,   0,   0,   0,   5,   0,   0,   0,  -5], // r=9
];

const ADVISOR_PST = [
    [0, 0, 0,  0,  0,  0, 0, 0, 0],
    [0, 0, 0,  0,  0,  0, 0, 0, 0],
    [0, 0, 0,  0,  0,  0, 0, 0, 0],
    [0, 0, 0,  0,  0,  0, 0, 0, 0],
    [0, 0, 0,  0,  0,  0, 0, 0, 0],
    [0, 0, 0,  0,  0,  0, 0, 0, 0],
    [0, 0, 0,  0,  0,  0, 0, 0, 0],
    [0, 0, 0,  5,  0,  5, 0, 0, 0], // r=7
    [0, 0, 0,  0, 20,  0, 0, 0, 0], // r=8 羊角士/士中
    [0, 0, 0,  5,  0,  5, 0, 0, 0], // r=9 初始士位
];

const ELEPHANT_PST = [
    [0, 0, 0, 0,  0, 0, 0, 0, 0],
    [0, 0, 0, 0,  0, 0, 0, 0, 0],
    [0, 0, 0, 0,  0, 0, 0, 0, 0],
    [0, 0, 0, 0,  0, 0, 0, 0, 0],
    [0, 0, 0, 0,  0, 0, 0, 0, 0],
    [0, 0, 8, 0,  0, 0, 8, 0, 0], // r=5
    [0, 0, 0, 0,  0, 0, 0, 0, 0],
    [0, 0, 0, 0, 25, 0, 0, 0, 0], // r=7 中相连环
    [0, 0, 0, 0,  0, 0, 0, 0, 0],
    [0, 0, 5, 0,  0, 0, 5, 0, 0], // r=9 初始底相
];

// ================= 象棋高阶战略评估体系 =================
export const evaluateBoard = (board: BoardState, turn: Color): number => {
    let redScore = 0;
    let blackScore = 0;

    let redAdvisors = 0;
    let blackAdvisors = 0;
    let redElephants = 0;
    let blackElephants = 0;
    let redMajors = 0; // 车马炮大子总数
    let blackMajors = 0;

    let redKingPos = { x: 4, y: 9 };
    let blackKingPos = { x: 4, y: 0 };

    const redHorses: { x: number, y: number }[] = [];
    const blackHorses: { x: number, y: number }[] = [];
    const redChariots: { x: number, y: number }[] = [];
    const blackChariots: { x: number, y: number }[] = [];
    const redCannons: { x: number, y: number }[] = [];
    const blackCannons: { x: number, y: number }[] = [];

    // 第一遍扫描：统计基础分、大子数量、位置矩阵
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const p = board[y][x];
            if (!p) continue;
            
            let val = PIECE_VALUES[p.type];
            const isRed = p.color === Color.RED;

            if (p.type === PieceType.CHARIOT || p.type === PieceType.HORSE || p.type === PieceType.CANNON) {
                if (isRed) redMajors++;
                else blackMajors++;
            }

            if (p.type === PieceType.HORSE) {
                if (isRed) redHorses.push({ x, y });
                else blackHorses.push({ x, y });
            } else if (p.type === PieceType.CHARIOT) {
                if (isRed) redChariots.push({ x, y });
                else blackChariots.push({ x, y });
            } else if (p.type === PieceType.CANNON) {
                if (isRed) redCannons.push({ x, y });
                else blackCannons.push({ x, y });
            }

            // PST 偏移
            const r = isRed ? y : (9 - y);
            const c = x;
            let pstVal = 0;
            switch (p.type) {
                case PieceType.SOLDIER: pstVal = PAWN_PST[r][c]; break;
                case PieceType.CHARIOT: pstVal = ROOK_PST[r][c]; break;
                case PieceType.HORSE: pstVal = HORSE_PST[r][c]; break;
                case PieceType.CANNON: pstVal = CANNON_PST[r][c]; break;
                case PieceType.ADVISOR: pstVal = ADVISOR_PST[r][c]; break;
                case PieceType.ELEPHANT: pstVal = ELEPHANT_PST[r][c]; break;
                case PieceType.GENERAL:
                    if (isRed) redKingPos = { x, y };
                    else blackKingPos = { x, y };
                    if (c === 4) pstVal = 10;
                    break;
            }

            const totalPieceVal = val + pstVal;
            if (isRed) {
                redScore += totalPieceVal;
                if (p.type === PieceType.ADVISOR) redAdvisors++;
                if (p.type === PieceType.ELEPHANT) redElephants++;
            } else {
                blackScore += totalPieceVal;
                if (p.type === PieceType.ADVISOR) blackAdvisors++;
                if (p.type === PieceType.ELEPHANT) blackElephants++;
            }
        }
    }

    // 残局阶段判断 (双方大子合计 <= 4 时进入深残局，马优于炮，过河兵价值暴涨)
    const isEndgame = (redMajors + blackMajors) <= 4;
    if (isEndgame) {
        // 残局马胜炮，炮由于缺少炮架价值轻微下降
        redScore += redHorses.length * 30 - redCannons.length * 25;
        blackScore += blackHorses.length * 30 - blackCannons.length * 25;
    }

    // 第二遍扫描：动态残局过河兵升值与深层战术特征
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const p = board[y][x];
            if (!p) continue;

            const isRed = p.color === Color.RED;
            let tacticalBonus = 0;

            if (p.type === PieceType.SOLDIER) {
                const crossed = isRed ? y <= 4 : y >= 5;
                if (crossed) {
                    tacticalBonus += 120; // 基础过河红利
                    // 逼近敌方九宫肋道或中路 (x: 3~5)
                    if (x >= 3 && x <= 5) {
                        tacticalBonus += 45;
                    }
                    // 深入敌腹宫顶线 (最强进攻位)
                    if (isRed) {
                        if (y <= 2) tacticalBonus += 70;
                        if (y <= 1 && x >= 3 && x <= 5) tacticalBonus += 100;
                        if (y === 0) tacticalBonus -= 45; // 老兵坐底无功惩罚
                    } else {
                        if (y >= 7) tacticalBonus += 70;
                        if (y >= 8 && x >= 3 && x <= 5) tacticalBonus += 100;
                        if (y === 9) tacticalBonus -= 45; // 老卒坐底无功惩罚
                    }
                    // 残局"卒子顶大车"价值暴增机制
                    if (isEndgame) {
                        const distToPalace = isRed ? y : (9 - y);
                        if (distToPalace <= 3) {
                            tacticalBonus += (4 - distToPalace) * 85; // 越贴近九宫，价值逼近大子
                        }
                    }
                }
            }
            else if (p.type === PieceType.CHARIOT) {
                // 巡河车 (红车y=5, 黑车y=4) 与 骑河车 (红车y=4, 黑车y=5)
                if ((isRed && y === 5) || (!isRed && y === 4)) tacticalBonus += 30;
                if ((isRed && y === 4) || (!isRed && y === 5)) tacticalBonus += 35;
                
                // 占肋线 (x=3 或 x=5，肋道锁喉，直逼将门要害)
                if (x === 3 || x === 5) {
                    tacticalBonus += 45;
                }

                // 下二道锁将 (红车控y=1, 黑车控y=8，兵家极重杀势)
                if ((isRed && y === 1) || (!isRed && y === 8)) {
                    tacticalBonus += 50;
                }

                // 锁底线 (红车控y=0, 黑车控y=9)
                if ((isRed && y === 0) || (!isRed && y === 9)) {
                    tacticalBonus += 40;
                }

                // 车占通头路/半通头路检查
                let hasFriendlyPawn = false;
                let hasEnemyPawn = false;
                for (let ty = 0; ty < ROWS; ty++) {
                    const tp = board[ty][x];
                    if (tp && tp.type === PieceType.SOLDIER) {
                        if (tp.color === p.color) hasFriendlyPawn = true;
                        else hasEnemyPawn = true;
                    }
                }
                if (!hasFriendlyPawn && !hasEnemyPawn) tacticalBonus += 35; // 全通畅大道
                else if (!hasFriendlyPawn) tacticalBonus += 20; // 半通畅要道
            } 
            else if (p.type === PieceType.HORSE) {
                // 别马腿检测 (别马腿严重制约自由度)
                let blockedLegs = 0;
                const horseDirs = [
                    { leg: [0, -1] },
                    { leg: [0, 1] },
                    { leg: [-1, 0] },
                    { leg: [1, 0] }
                ];
                for (const d of horseDirs) {
                    const lx = x + d.leg[0];
                    const ly = y + d.leg[1];
                    if (lx >= 0 && lx < COLS && ly >= 0 && ly < ROWS && board[ly][lx]) {
                        blockedLegs++;
                    }
                }
                tacticalBonus -= blockedLegs * 18;
                if (blockedLegs >= 3) tacticalBonus -= 35; // 濒临死马重罚
                
                // 卧槽马、挂角马与钓鱼马 (象棋核心破城战术)
                if (isRed) {
                    if (y === 1 && (x === 2 || x === 6)) tacticalBonus += 75; // 卧槽马
                    if (y === 2 && (x === 3 || x === 5)) tacticalBonus += 65; // 挂角马
                    if (y === 2 && (x === 2 || x === 6)) tacticalBonus += 60; // 钓鱼马
                    if (y === 3 && (x === 3 || x === 5)) tacticalBonus += 50; // 高钓马
                } else {
                    if (y === 8 && (x === 2 || x === 6)) tacticalBonus += 75;
                    if (y === 7 && (x === 3 || x === 5)) tacticalBonus += 65;
                    if (y === 7 && (x === 2 || x === 6)) tacticalBonus += 60;
                    if (y === 6 && (x === 3 || x === 5)) tacticalBonus += 50;
                }
            } 
            else if (p.type === PieceType.CANNON) {
                // 镇中路当头炮
                if (x === 4) {
                    tacticalBonus += 40;
                }
                // 沉底炮 (红炮 y=0, 黑炮 y=9)
                if ((isRed && y === 0) || (!isRed && y === 9)) {
                    tacticalBonus += 45;
                }
                // 检测对准敌方老将的空头炮或沉底炮 (直逼将门)
                const enemyKing = isRed ? blackKingPos : redKingPos;
                if (x === enemyKing.x) {
                    let screenCount = 0;
                    const startY = Math.min(y, enemyKing.y) + 1;
                    const endY = Math.max(y, enemyKing.y);
                    for (let cy = startY; cy < endY; cy++) {
                        if (board[cy][x]) screenCount++;
                    }
                    if (screenCount === 0) {
                        tacticalBonus += 300; // 致命空头炮，将门完全敞开！
                    } else if (screenCount === 1) {
                        tacticalBonus += 55; // 隔单子瞄将
                    }
                }
            }

            if (isRed) redScore += tacticalBonus;
            else blackScore += tacticalBonus;
        }
    }

    // 第三部分：大师子力协同与杀法组合拳
    // 1. 连环马 (相互防守)
    if (redHorses.length === 2) {
        const h1 = redHorses[0];
        const h2 = redHorses[1];
        const dx = Math.abs(h1.x - h2.x);
        const dy = Math.abs(h1.y - h2.y);
        if ((dx === 1 && dy === 2) || (dx === 2 && dy === 1)) {
            redScore += 45; // 红方连环马，固若金汤
        }
    }
    if (blackHorses.length === 2) {
        const h1 = blackHorses[0];
        const h2 = blackHorses[1];
        const dx = Math.abs(h1.x - h2.x);
        const dy = Math.abs(h1.y - h2.y);
        if ((dx === 1 && dy === 2) || (dx === 2 && dy === 1)) {
            blackScore += 45; // 黑方连环马
        }
    }

    // 2. 双车错 (双车深入敌方底线两道杀势)
    if (redChariots.length === 2) {
        const inEnemyTerritory = redChariots.filter(c => c.y <= 2).length;
        if (inEnemyTerritory === 2) redScore += 160; // 双车错杀势
    }
    if (blackChariots.length === 2) {
        const inEnemyTerritory = blackChariots.filter(c => c.y >= 7).length;
        if (inEnemyTerritory === 2) blackScore += 160;
    }

    // 3. 重炮杀势 (两门炮同列重叠攻将)
    if (redCannons.length === 2 && redCannons[0].x === redCannons[1].x && redCannons[0].x === blackKingPos.x) {
        redScore += 160;
    }
    if (blackCannons.length === 2 && blackCannons[0].x === blackCannons[1].x && blackCannons[0].x === redKingPos.x) {
        blackScore += 160;
    }

    // 4. 马后炮战术协同 (炮在己方马身后瞄准敌宫)
    for (const h of redHorses) {
        if (h.y <= 3) {
            for (const c of redCannons) {
                if (c.x === h.x && c.y > h.y && c.y <= 5) {
                    redScore += 130; // 红方马后炮成型
                }
            }
        }
    }
    for (const h of blackHorses) {
        if (h.y >= 6) {
            for (const c of blackCannons) {
                if (c.x === h.x && c.y < h.y && c.y >= 4) {
                    blackScore += 130; // 黑方马后炮成型
                }
            }
        }
    }

    // 5. 防守体系健全度与破阵危机
    // 士象全
    if (redAdvisors === 2 && redElephants === 2) redScore += 55;
    if (blackAdvisors === 2 && blackElephants === 2) blackScore += 55;

    // 缺象怕炮，缺士怕车马
    if (redAdvisors === 0) {
        redScore -= 140;
        if (blackChariots.length > 0 || blackHorses.length > 0) redScore -= 60;
    }
    if (blackAdvisors === 0) {
        blackScore -= 140;
        if (redChariots.length > 0 || redHorses.length > 0) blackScore -= 60;
    }
    if (redElephants === 0) {
        redScore -= 100;
        if (blackCannons.length > 0) redScore -= 50;
    }
    if (blackElephants === 0) {
        blackScore -= 100;
        if (redCannons.length > 0) blackScore -= 50;
    }

    // 老将偏居九宫边缘且无士护卫
    if (redKingPos.x !== 4 && redAdvisors <= 1) redScore -= 60;
    if (blackKingPos.x !== 4 && blackAdvisors <= 1) blackScore -= 60;

    // 将军状态评估
    if (isKingInDanger(board, Color.RED)) redScore -= 80;
    if (isKingInDanger(board, Color.BLACK)) blackScore -= 80;

    const turnBonus = 12;
    return turn === Color.RED 
        ? (redScore - blackScore + turnBonus) 
        : (blackScore - redScore + turnBonus);
};

// ================= 走法生成与启发式排序 (MVV-LVA + Checks + Killers + Counter + History) =================
export interface ScoredMove {
    move: Move;
    score: number;
}

// 静态交换评估 (SEE) 快速近似：判断吃子是否为有利/等价吃子，还是冒进送吃
const isWinningOrEqualCapture = (
    board: BoardState,
    move: Move,
    attacker: Piece,
    victim: Piece
): boolean => {
    const attackerVal = PIECE_VALUES[attacker.type];
    const victimVal = PIECE_VALUES[victim.type];
    
    // 如果目标价值大于等于攻击者（如小卒吃大车、车吃车），绝对合算
    if (victimVal >= attackerVal) return true;

    // 如果目标价值低于攻击者（如大车吃小卒/马），检查目标落子点是否有敌方保护
    const enemyColor = victim.color;
    board[move.to.y][move.to.x] = attacker;
    board[move.from.y][move.from.x] = null;
    const isDefended = isSquareAttacked(board, move.to.x, move.to.y, enemyColor);
    board[move.from.y][move.from.x] = attacker;
    board[move.to.y][move.to.x] = victim;

    if (!isDefended) return true; // 无保护纯免费吃子

    // 如果有保护且价值损失较大，归类为不利吃子 (SEE < 0)
    return victimVal >= attackerVal - 50;
};

export const getAllLegalMoves = (
    board: BoardState, 
    color: Color, 
    ttMove?: Move, 
    prevMove?: Move,
    ply: number = 0
): ScoredMove[] => {
    const moves: ScoredMove[] = [];
    const enemyColor = color === Color.RED ? Color.BLACK : Color.RED;

    // 对策着法查询
    const counter = prevMove 
        ? counterMoves[prevMove.from.y][prevMove.from.x][prevMove.to.y][prevMove.to.x]
        : null;

    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const p = board[y][x];
            if (p && p.color === color) {
                const dests = getValidMoves(board, { x, y });
                for (const to of dests) {
                    if (!willBeChecked(board, { from: { x, y }, to }, color)) {
                        const target = board[to.y][to.x];
                        let sortScore = 0;

                        // 1. TT 最佳着法 (置换表顶格命中)
                        if (ttMove && ttMove.from.x === x && ttMove.from.y === y && ttMove.to.x === to.x && ttMove.to.y === to.y) {
                            sortScore += 2000000;
                        } else {
                            // 检查是否将军
                            board[to.y][to.x] = p;
                            board[y][x] = null;
                            const givesCheck = isKingInDanger(board, enemyColor);
                            board[y][x] = p;
                            board[to.y][to.x] = target;

                            // 2. 吃子排序 (结合 MVV-LVA 与 SEE 快速预筛)
                            if (target) {
                                const isGoodCap = isWinningOrEqualCapture(board, { from: { x, y }, to }, p, target);
                                if (isGoodCap) {
                                    sortScore += 100000 + PIECE_VALUES[target.type] * 10 - PIECE_VALUES[p.type];
                                } else {
                                    // 冒进送吃着法，排在杀手与安步之后
                                    sortScore += 1000 - (PIECE_VALUES[p.type] - PIECE_VALUES[target.type]);
                                }
                            } 
                            // 3. 杀手着法 (Killer Heuristic)
                            else if (ply < MAX_PLY) {
                                const k1 = killerMoves[ply][0];
                                const k2 = killerMoves[ply][1];
                                if (k1 && k1.from.x === x && k1.from.y === y && k1.to.x === to.x && k1.to.y === to.y) {
                                    sortScore += 50000;
                                } else if (k2 && k2.from.x === x && k2.from.y === y && k2.to.x === to.x && k2.to.y === to.y) {
                                    sortScore += 40000;
                                }
                            }

                            // 4. 对策着法 (Countermove Heuristic)
                            if (counter && counter.from.x === x && counter.from.y === y && counter.to.x === to.x && counter.to.y === to.y) {
                                sortScore += 30000;
                            }

                            // 5. 将军迫着
                            if (givesCheck) {
                                sortScore += 15000;
                            }

                            // 6. 历史启发表累加
                            sortScore += Math.min(historyTable[y][x][to.y][to.x], 12000);
                        }

                        moves.push({ move: { from: { x, y }, to }, score: sortScore });
                    }
                }
            }
        }
    }
    return moves.sort((a, b) => b.score - a.score);
};

// 仅生成吃子合法着法 (专门用于静态搜索极速剪枝)
const getCaptureMoves = (board: BoardState, color: Color): ScoredMove[] => {
    const moves: ScoredMove[] = [];
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const p = board[y][x];
            if (p && p.color === color) {
                const dests = getValidMoves(board, { x, y });
                for (const to of dests) {
                    const target = board[to.y][to.x];
                    if (target && target.color !== color) {
                        if (!willBeChecked(board, { from: { x, y }, to }, color)) {
                            const sortScore = 50000 + PIECE_VALUES[target.type] * 10 - PIECE_VALUES[p.type];
                            moves.push({ move: { from: { x, y }, to }, score: sortScore });
                        }
                    }
                }
            }
        }
    }
    return moves.sort((a, b) => b.score - a.score);
};

// 静态搜索 (Quiescence Search) - 结合 SEE 与 Delta Pruning，彻底避免地平线效应与冒进弃子
const quiescenceSearch = (
    board: BoardState, 
    alpha: number, 
    beta: number, 
    turn: Color, 
    hash: number,
    qDepth: number = 0
): number => {
    const inCheck = isKingInDanger(board, turn);

    // 如果处于将军状态，绝不能 stand-pat 逃避！必须搜索应将解法
    if (!inCheck) {
        const standPat = evaluateBoard(board, turn);
        if (standPat >= beta) return beta;
        if (standPat > alpha) alpha = standPat;

        // Delta 剪枝：如果加上吃大车(900分)+安全裕度(150分)依然小于 alpha，则提前剪枝
        if (standPat + 1050 < alpha) return alpha;
    }

    if (qDepth >= 6) {
        return evaluateBoard(board, turn);
    }

    // 未被将军时，仅搜索吃子着法
    const moves = inCheck 
        ? getAllLegalMoves(board, turn, undefined, undefined, 0) 
        : getCaptureMoves(board, turn);

    if (moves.length === 0) {
        return inCheck ? (-MATE_SCORE + qDepth) : alpha;
    }

    for (const { move } of moves) {
        const fromP = board[move.from.y][move.from.x];
        const toP = board[move.to.y][move.to.x];
        if (!fromP) continue;

        // 未被将军时，跳过明显亏损的吃子 (SEE < 0)
        if (!inCheck && toP && !isWinningOrEqualCapture(board, move, fromP, toP)) {
            continue;
        }

        board[move.to.y][move.to.x] = fromP;
        board[move.from.y][move.from.x] = null;
        
        const nextTurn = turn === Color.RED ? Color.BLACK : Color.RED;
        const nextHash = updateHash(hash, move.from, move.to, fromP, toP);
        const score = -quiescenceSearch(board, -beta, -alpha, nextTurn, nextHash, qDepth + 1);
        
        board[move.from.y][move.from.x] = fromP;
        board[move.to.y][move.to.x] = toP;
        
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
};

// ================= 主 Alpha-Beta 搜索 (支持 PVS、LMR、增量哈希与对策启发) =================
const alphaBeta = (
    board: BoardState, 
    depth: number, 
    alpha: number, 
    beta: number, 
    turn: Color,
    hash: number,
    ply: number = 0,
    allowNull: boolean = true,
    prevMove?: Move
): number => {
    const ttEntry = TT.get(hash);
    if (ttEntry && ttEntry.depth >= depth) {
        if (ttEntry.flag === 0) return ttEntry.score;
        if (ttEntry.flag === 1 && ttEntry.score >= beta) return ttEntry.score;
        if (ttEntry.flag === 2 && ttEntry.score <= alpha) return ttEntry.score;
    }

    const inCheck = isKingInDanger(board, turn);
    // 搜索延伸：将军延伸 (使杀局与绝杀组合拳推演更深)
    if (inCheck && ply < 8) {
        depth++;
    }

    if (depth <= 0) {
        return quiescenceSearch(board, alpha, beta, turn, hash, 0);
    }

    // 空步剪枝 (Null-Move Pruning, R=2)
    if (allowNull && !inCheck && depth >= 3) {
        const nextTurn = turn === Color.RED ? Color.BLACK : Color.RED;
        const nullHash = hash ^ ZOBRIST_SIDE;
        const nullScore = -alphaBeta(board, depth - 1 - 2, -beta, -beta + 1, nextTurn, nullHash, ply + 1, false, undefined);
        if (nullScore >= beta) {
            return beta;
        }
    }

    const moves = getAllLegalMoves(board, turn, ttEntry?.bestMove, prevMove, ply);
    if (moves.length === 0) {
        // 中国象棋规则：无合法走步即为困毙或绝杀，走棋方直接判负
        return -MATE_SCORE + ply;
    }

    // 唯一应手延伸：当被将军且仅有 1 步合法着法时，分支因子为 1，直接深化 1 层
    if (inCheck && moves.length === 1 && ply < 10) {
        depth++;
    }

    let flag: 0 | 1 | 2 = 2; // 默认 UPPERBOUND
    let bestMove: Move | undefined = undefined;
    let bSearchPv = true;

    for (let i = 0; i < moves.length; i++) {
        const { move } = moves[i];
        const fromP = board[move.from.y][move.from.x];
        const toP = board[move.to.y][move.to.x];
        if (!fromP) continue;

        board[move.to.y][move.to.x] = fromP;
        board[move.from.y][move.from.x] = null;
        
        const nextTurn = turn === Color.RED ? Color.BLACK : Color.RED;
        const nextHash = updateHash(hash, move.from, move.to, fromP, toP);
        let val: number;

        if (bSearchPv) {
            // 主变分支 (PV Move): 全窗口搜索
            val = -alphaBeta(board, depth - 1, -beta, -alpha, nextTurn, nextHash, ply + 1, true, move);
        } else {
            // 非主要变例：Late Move Reduction (LMR) 静步深度削减
            let reduction = 0;
            if (depth >= 3 && i >= 4 && !inCheck && !toP && ply < MAX_PLY) {
                reduction = 1;
                if (depth >= 5 && i >= 8) reduction = 2;
            }

            // 零窗口试探侦测 (Null-Window Scout Search)
            val = -alphaBeta(board, depth - 1 - reduction, -alpha - 1, -alpha, nextTurn, nextHash, ply + 1, true, move);

            // 若试探失败并超越 alpha，以全窗口重新深搜
            if (val > alpha && (reduction > 0 || val < beta)) {
                val = -alphaBeta(board, depth - 1, -beta, -alpha, nextTurn, nextHash, ply + 1, true, move);
            }
        }
        
        board[move.from.y][move.from.x] = fromP;
        board[move.to.y][move.to.x] = toP;
        
        if (val >= beta) {
            // 产生 Beta 截断，记录杀手着法、对策着法与历史分
            if (!toP && ply < MAX_PLY) {
                killerMoves[ply][1] = killerMoves[ply][0];
                killerMoves[ply][0] = move;
                if (prevMove) {
                    counterMoves[prevMove.from.y][prevMove.from.x][prevMove.to.y][prevMove.to.x] = move;
                }
            }
            historyTable[move.from.y][move.from.x][move.to.y][move.to.x] += depth * depth;
            TT.set(hash, { depth, score: beta, flag: 1, bestMove: move });
            return beta;
        }
        if (val > alpha) {
            alpha = val;
            bSearchPv = false;
            flag = 0; // EXACT
            bestMove = move;
        }
    }

    TT.set(hash, { depth, score: alpha, flag, bestMove });
    return alpha;
};

// ================= 分析功能与战术说明 =================
const analyzeTactic = (board: BoardState, move: Move, score: number): string => {
    const fromP = board[move.from.y][move.from.x];
    const toP = board[move.to.y][move.to.x];
    if (!fromP) return "战略调度";

    if (toP) {
        return `吃${PIECE_CHARS[toP.type][toP.color === Color.RED ? 0 : 1]}夺子，占领关键枢纽`;
    }
    if (fromP.type === PieceType.CHARIOT) {
        if (move.to.y === 1 || move.to.y === 8) return "车占下二道咽喉要道，直锁敌将";
        if (move.to.x === 3 || move.to.x === 5) return "车占肋道锁喉，威震敌宫";
        if (move.to.y === 4 || move.to.y === 5) return "巡河车扼守要津，压制敌兵马";
        return "抢占大路，车控通津要道";
    }
    if (fromP.type === PieceType.HORSE) {
        if (move.to.y === 1 || move.to.y === 8) return "跃进卧槽马杀势，形成将门杀绝";
        if (move.to.y === 2 || move.to.y === 7) return "跃马挂角，控扼敌将门肋线";
        return "跃马抢占中央战术要点";
    }
    if (fromP.type === PieceType.CANNON) {
        if (move.to.x === 4) return "架中炮威震中路，直逼将帅";
        if (move.to.y === 0 || move.to.y === 9) return "沉底炮配合车马，暗伏杀势";
        return "炮打冷着，暗藏牵制之机";
    }
    if (fromP.type === PieceType.SOLDIER) {
        return "挺兵制马，开通大子进攻通途";
    }
    return score > 200 ? "特大优势推进，步步紧逼" : "沉稳布阵，防守固若金汤";
};

// ================= 中文标准记谱法 (如 "炮二平五", "前炮平五", "马8进7") =================
export const getMoveName = (board: BoardState, move: Move): string => {
    const p = board[move.from.y][move.from.x];
    if (!p) return "";
    const isRed = p.color === Color.RED;
    const colName = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
    const numName = ["", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    
    const getCol = (x: number, c: Color) => c === Color.RED ? (9 - x) : (x + 1);

    const fromColIdx = getCol(move.from.x, p.color);
    const toColIdx = getCol(move.to.x, p.color);
    const pieceChar = isRed ? PIECE_CHARS[p.type][0] : PIECE_CHARS[p.type][1];
    
    // 检查同列是否有两个相同的棋子 (如双车、双炮、双兵/卒同列)
    let hasSamePieceInCol = false;
    let isFrontPiece = false;
    for (let checkY = 0; checkY < ROWS; checkY++) {
        if (checkY !== move.from.y) {
            const otherP = board[checkY][move.from.x];
            if (otherP && otherP.type === p.type && otherP.color === p.color) {
                hasSamePieceInCol = true;
                // 红棋 y 较小为前，黑棋 y 较大为前
                isFrontPiece = isRed ? (move.from.y < checkY) : (move.from.y > checkY);
                break;
            }
        }
    }

    let fromStr = "";
    if (hasSamePieceInCol) {
        fromStr = isFrontPiece ? "前" : "后";
    } else {
        fromStr = isRed ? colName[fromColIdx] : numName[fromColIdx];
    }

    let dirStr = "";
    let destStr = "";
    const dy = isRed ? (move.from.y - move.to.y) : (move.to.y - move.from.y);
    const absDy = Math.abs(move.from.y - move.to.y);
    if (dy > 0) dirStr = "进";
    else if (dy < 0) dirStr = "退";
    else dirStr = "平";

    if ([PieceType.HORSE, PieceType.ELEPHANT, PieceType.ADVISOR].includes(p.type) || dirStr === "平") {
         destStr = isRed ? colName[toColIdx] : numName[toColIdx];
    } else {
         destStr = isRed ? colName[absDy] : numName[absDy];
    }

    if (hasSamePieceInCol) {
        return `${fromStr}${pieceChar}${dirStr}${destStr}`;
    }
    return `${pieceChar}${fromStr}${dirStr}${destStr}`;
};

// ================= API: AI 军师锦囊 (获取 Top N 走法推荐) =================
export const getTopMoves = (board: BoardState, turn: Color, limit: number = 3): { move: Move, score: number, desc: string, notation: string }[] => {
    const tempBoard = board.map(row => row.map(p => p ? {...p} : null));
    const candidates: { move: Move, score: number, desc: string, notation: string }[] = [];
    
    // 1. 优先开局库推荐
    const bookSuggestions = getBookSuggestions(board, turn);
    for (const bookEntry of bookSuggestions) {
        const move: Move = { 
            from: { x: bookEntry.move.from[0], y: bookEntry.move.from[1] }, 
            to: { x: bookEntry.move.to[0], y: bookEntry.move.to[1] } 
        };
        const notation = getMoveName(board, move);
        candidates.push({ 
            move, 
            score: 99999,
            desc: `【大师开局】${bookEntry.desc} (${bookEntry.name})`, 
            notation 
        });
    }

    // 2. 深度搜索推演补充
    if (candidates.length < limit) {
        const moves = getAllLegalMoves(tempBoard, turn);
        if (moves.length > 0) {
            const rootHash = computeHash(tempBoard, turn);
            const searchCount = Math.min(moves.length, 14);
            for (let i = 0; i < searchCount; i++) {
                const { move } = moves[i];
                const isBookMove = candidates.some(c => c.move.from.x === move.from.x && c.move.from.y === move.from.y && c.move.to.x === move.to.x && c.move.to.y === move.to.y);
                if (isBookMove) continue;

                const fromP = tempBoard[move.from.y][move.from.x];
                const toP = tempBoard[move.to.y][move.to.x];
                if (!fromP) continue;

                tempBoard[move.to.y][move.to.x] = fromP;
                tempBoard[move.from.y][move.from.x] = null;
                
                const nextTurn = turn === Color.RED ? Color.BLACK : Color.RED;
                const nextHash = updateHash(rootHash, move.from, move.to, fromP, toP);
                const score = -alphaBeta(tempBoard, SUGGESTION_DEPTH - 1, -INFINITY, INFINITY, nextTurn, nextHash, 1, true, move);
                
                tempBoard[move.from.y][move.from.x] = fromP;
                tempBoard[move.to.y][move.to.x] = toP;
                
                const notation = getMoveName(board, move);
                const desc = analyzeTactic(board, move, score);
                candidates.push({ move, score, desc, notation });
            }
        }
    }
    
    return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
};

// ================= API: PVE 最佳着法 (特级大师迭代加深与动态抱负窗口搜索) =================
export const searchBestMove = (board: BoardState, turn: Color, difficulty: AIDifficulty = 'master'): Move | null => {
    // 1. 查阅大师开局库 (菜鸟模式小概率查，中高难度必查)
    if (difficulty !== 'beginner' || Math.random() < 0.4) {
        const bookMove = getBookMove(board, turn);
        if (bookMove) {
            return { 
                from: { x: bookMove.move.from[0], y: bookMove.move.from[1] }, 
                to: { x: bookMove.move.to[0], y: bookMove.move.to[1] } 
            };
        }
    }

    cleanTT();
    resetSearchTables();
    
    const maxDepth = DEPTH_MAP[difficulty] || 6;
    const tempBoard = board.map(row => row.map(p => p ? {...p} : null));
    let overallBestMove: Move | null = null;
    let overallBestScore = -INFINITY;

    const rootMoves = getAllLegalMoves(tempBoard, turn);
    if (rootMoves.length === 0) return null;

    // 菜鸟模式：在候选走法中加入亲民随机性
    if (difficulty === 'beginner' && rootMoves.length > 2 && Math.random() < 0.35) {
        const randomIdx = Math.floor(Math.random() * Math.min(3, rootMoves.length));
        return rootMoves[randomIdx].move;
    }

    // 迭代加深搜索 (Iterative Deepening Search with Time Budget)
    const startTime = Date.now();
    const timeLimitMs = difficulty === 'grandmaster' ? 2800 
                      : (difficulty === 'master' ? 1600 
                      : (difficulty === 'intermediate' ? 700 : 300));

    const rootHash = computeHash(tempBoard, turn);

    for (let depth = 2; depth <= maxDepth; depth++) {
        let currentBestScore = -INFINITY;
        let currentBestMove: Move | null = null;

        // 抱负窗口 (Aspiration Windows): 利用浅层估值缩小搜索窗口以倍增修剪效率
        let alpha = -INFINITY;
        let beta = INFINITY;
        if (depth >= 4 && overallBestScore > -MATE_SCORE + 1000 && overallBestScore < MATE_SCORE - 1000) {
            alpha = overallBestScore - 55;
            beta = overallBestScore + 55;
        }

        const ttEntry = TT.get(rootHash);
        const sortedMoves = getAllLegalMoves(tempBoard, turn, overallBestMove || ttEntry?.bestMove, undefined, 0);

        let searchSuccess = false;
        let retryCount = 0;

        while (!searchSuccess && retryCount < 2) {
            currentBestScore = -INFINITY;
            currentBestMove = null;

            for (let i = 0; i < sortedMoves.length; i++) {
                const { move } = sortedMoves[i];
                // 超时检查
                if (Date.now() - startTime > timeLimitMs && overallBestMove !== null) {
                    return overallBestMove;
                }

                const fromP = tempBoard[move.from.y][move.from.x];
                const toP = tempBoard[move.to.y][move.to.x];
                if (!fromP) continue;

                tempBoard[move.to.y][move.to.x] = fromP;
                tempBoard[move.from.y][move.from.x] = null;

                const nextTurn = turn === Color.RED ? Color.BLACK : Color.RED;
                const nextHash = updateHash(rootHash, move.from, move.to, fromP, toP);
                let val: number;

                if (i === 0) {
                    val = -alphaBeta(tempBoard, depth - 1, -beta, -alpha, nextTurn, nextHash, 1, true, move);
                } else {
                    val = -alphaBeta(tempBoard, depth - 1, -alpha - 1, -alpha, nextTurn, nextHash, 1, true, move);
                    if (val > alpha && val < beta) {
                        val = -alphaBeta(tempBoard, depth - 1, -beta, -alpha, nextTurn, nextHash, 1, true, move);
                    }
                }

                tempBoard[move.from.y][move.from.x] = fromP;
                tempBoard[move.to.y][move.to.x] = toP;

                if (val > currentBestScore) {
                    currentBestScore = val;
                    currentBestMove = move;
                }
                if (val > alpha) alpha = val;
            }

            // 检查抱负窗口是否失败
            if (currentBestScore <= alpha && alpha !== -INFINITY) {
                // Fail-low: 估值暴跌，放大向下窗口重搜
                alpha = -INFINITY;
                retryCount++;
            } else if (currentBestScore >= beta && beta !== INFINITY) {
                // Fail-high: 估值暴涨，放大向上窗口重搜
                beta = INFINITY;
                retryCount++;
            } else {
                searchSuccess = true;
            }
        }

        if (currentBestMove) {
            overallBestMove = currentBestMove;
            overallBestScore = currentBestScore;
        }

        // 如果已经找到必胜将死或已过时限，直接退出
        if (currentBestScore >= MATE_SCORE - 100 || Date.now() - startTime > timeLimitMs) {
            break;
        }
    }

    return overallBestMove || rootMoves[0].move;
};

// ================= API: 后台思考预热 TT =================
export const ponder = async (board: BoardState, turn: Color) => {
    const tempBoard = board.map(row => row.map(p => p ? {...p} : null));
    const hash = computeHash(tempBoard, turn);
    alphaBeta(tempBoard, 3, -INFINITY, INFINITY, turn, hash);
};
