import { BoardState, Color, Move, PieceType, ROWS, COLS } from '../types';
import { getValidMoves, willBeChecked, PIECE_VALUES, isKingInDanger } from './gameLogic';
import { PIECE_CHARS } from '../constants';
import { getBookMove, getBookSuggestions } from './openingBook';

export type AIDifficulty = 'beginner' | 'intermediate' | 'master';

// ================= 引擎深度与搜索配置 =================
export const DEPTH_MAP: Record<AIDifficulty, number> = {
  beginner: 2,
  intermediate: 3,
  master: 4,
};

const SUGGESTION_DEPTH = 3; 
const INFINITY = 999999;
const MATE_SCORE = 50000;
const MAX_PLY = 32;

// ================= Zobrist Hashing =================
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

const computeHash = (board: BoardState, turn: Color): number => {
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

// ================= 杀手着法与历史启发表 =================
const killerMoves: (Move | null)[][] = Array(MAX_PLY).fill(null).map(() => [null, null]);

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
            }
        }
    }
};

// ================= 精准位置价值表 (Piece-Square Tables) =================
// 坐标系统：r=0 敌方底线 (最深处)，r=9 我方底线 (出生点)
const PAWN_PST = [
    [  0,   5,  15,  25,  30,  25,  15,   5,   0], // r=0 逼近九宫将门
    [ 25,  35,  55,  75,  85,  75,  55,  35,  25], // r=1 宫顶线
    [ 25,  35,  50,  65,  70,  65,  50,  35,  25], // r=2 敌方下二路
    [ 20,  30,  40,  55,  60,  55,  40,  30,  20], // r=3 敌方卒林
    [ 15,  20,  30,  45,  50,  45,  30,  20,  15], // r=4 渡河前线
    [  0,   0,   5,   0,  15,   0,   5,   0,   0], // r=5 我方河沿
    [  0,   0,   0,   0,   5,   0,   0,   0,   0], // r=6 我方兵林
    [  0,   0,   0,   0,   0,   0,   0,   0,   0], // r=7
    [  0,   0,   0,   0,   0,   0,   0,   0,   0], // r=8
    [  0,   0,   0,   0,   0,   0,   0,   0,   0], // r=9
];

const ROOK_PST = [
    [ 25,  30,  25,  35,  35,  35,  25,  30,  25], // r=0 敌方底线 (锁底)
    [ 30,  45,  40,  50,  50,  50,  40,  45,  30], // r=1 敌方咽喉线 (下二道，极强)
    [ 15,  25,  20,  30,  30,  30,  20,  25,  15], // r=2 敌方宫顶
    [ 20,  30,  25,  35,  35,  35,  25,  30,  20], // r=3 敌方卒林 (巡河抓子)
    [ 15,  20,  20,  25,  25,  25,  20,  20,  15], // r=4 楚河汉界
    [ 10,  15,  15,  20,  20,  20,  15,  15,  10], // r=5
    [  5,  10,  10,  15,  15,  15,  10,  10,   5], // r=6
    [  0,   5,   5,  10,  10,  10,   5,   5,   0], // r=7
    [ -5,  10,   5,  15,  15,  15,   5,  10,  -5], // r=8
    [-10,   5,   0,  10,   5,  10,   0,   5, -10], // r=9 初始底线
];

const HORSE_PST = [
    [ -5,   0,   5,  10,  10,  10,   5,   0,  -5], // r=0
    [  5,  25,  35,  45,  30,  45,  35,  25,   5], // r=1 挂角/卧槽攻击点！
    [ 10,  25,  40,  50,  40,  50,  40,  25,  10], // r=2 卧槽马前置
    [ 15,  20,  30,  40,  40,  40,  30,  20,  15], // r=3 敌方卒林
    [ 10,  15,  25,  30,  30,  30,  25,  15,  10], // r=4 跃马过河
    [  5,  10,  20,  25,  25,  25,  20,  10,   5], // r=5 巡河马
    [  0,   5,  15,  20,  15,  20,  15,   5,   0], // r=6
    [ -5,   0,  10,   5,  -5,   5,  10,   0,  -5], // r=7
    [-10,   0,   5,   0, -25,   0,   5,   0, -10], // r=8 (窝心马极度惩罚)
    [-15,  -5,  -5,  -5, -30,  -5,  -5,  -5, -15], // r=9
];

const CANNON_PST = [
    [ 15,  15,  15,  20,  25,  20,  15,  15,  15], // r=0 沉底炮
    [ 10,  15,  15,  20,  30,  20,  15,  15,  10], // r=1
    [ 20,  25,  25,  35,  45,  35,  25,  25,  20], // r=2 炮火主攻线
    [ 10,  15,  15,  25,  35,  25,  15,  15,  10], // r=3 压制卒林
    [  5,  10,  10,  20,  30,  20,  10,  10,   5], // r=4
    [  0,   5,   5,  15,  25,  15,   5,   5,   0], // r=5
    [  0,   5,   5,  10,  20,  10,   5,   5,   0], // r=6
    [  5,   0,  15,  10,  35,  10,  15,   0,   5], // r=7 初始炮台 / 中炮
    [  0,   0,   0,   5,  10,   5,   0,   0,   0], // r=8
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
    [0, 0, 0,  0, 15,  0, 0, 0, 0], // r=8 羊角士/士中
    [0, 0, 0,  5,  0,  5, 0, 0, 0], // r=9 初始士位
];

const ELEPHANT_PST = [
    [0, 0, 0, 0,  0, 0, 0, 0, 0],
    [0, 0, 0, 0,  0, 0, 0, 0, 0],
    [0, 0, 0, 0,  0, 0, 0, 0, 0],
    [0, 0, 0, 0,  0, 0, 0, 0, 0],
    [0, 0, 0, 0,  0, 0, 0, 0, 0],
    [0, 0, 5, 0,  0, 0, 5, 0, 0], // r=5
    [0, 0, 0, 0,  0, 0, 0, 0, 0],
    [0, 0, 0, 0, 20, 0, 0, 0, 0], // r=7 中相连环
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

    let redKingPos = { x: 4, y: 9 };
    let blackKingPos = { x: 4, y: 0 };

    // 第一遍扫描：基础分、PST与防守体系统计
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const p = board[y][x];
            if (!p) continue;
            
            let val = PIECE_VALUES[p.type];
            // 兵卒过河升值
            if (p.type === PieceType.SOLDIER) {
                const crossed = p.color === Color.RED ? y <= 4 : y >= 5;
                if (crossed) {
                    val = 220;
                    // 逼近敌宫加成
                    if (x >= 3 && x <= 5) val += 30;
                    if (p.color === Color.RED && y <= 2) val += 60;
                    if (p.color === Color.BLACK && y >= 7) val += 60;
                }
            }

            // PST 偏移
            const r = p.color === Color.RED ? y : (9 - y);
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
                    if (p.color === Color.RED) redKingPos = { x, y };
                    else blackKingPos = { x, y };
                    if (c === 4) pstVal = 10;
                    break;
            }

            const totalPieceVal = val + pstVal;
            if (p.color === Color.RED) {
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

    // 第二遍扫描：战术特性评估 (马腿通畅度、车通路控制、空头炮、挂角马)
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const p = board[y][x];
            if (!p) continue;

            const isRed = p.color === Color.RED;
            let tacticalBonus = 0;

            if (p.type === PieceType.CHARIOT) {
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
                if (!hasFriendlyPawn && !hasEnemyPawn) tacticalBonus += 30; // 全通畅通大道
                else if (!hasFriendlyPawn) tacticalBonus += 18; // 半通畅要道
            } 
            else if (p.type === PieceType.HORSE) {
                // 马腿检测 (别马腿严重制约)
                let freeLegs = 0;
                const horseDirs = [
                    { leg: [0, -1], jumps: [[-1, -2], [1, -2]] },
                    { leg: [0, 1], jumps: [[-1, 2], [1, 2]] },
                    { leg: [-1, 0], jumps: [[-2, -1], [-2, 1]] },
                    { leg: [1, 0], jumps: [[2, -1], [2, 1]] }
                ];
                for (const d of horseDirs) {
                    const lx = x + d.leg[0];
                    const ly = y + d.leg[1];
                    if (lx >= 0 && lx < COLS && ly >= 0 && ly < ROWS && !board[ly][lx]) {
                        freeLegs += 2;
                    }
                }
                tacticalBonus += freeLegs * 4;
                if (freeLegs <= 2) tacticalBonus -= 30; // 蹩脚死马
                
                // 卧槽马与挂角马
                if (isRed) {
                    if (y === 1 && (x === 2 || x === 6)) tacticalBonus += 60; // 卧槽马
                    if (y === 2 && (x === 3 || x === 5)) tacticalBonus += 50; // 挂角马
                } else {
                    if (y === 8 && (x === 2 || x === 6)) tacticalBonus += 60;
                    if (y === 7 && (x === 3 || x === 5)) tacticalBonus += 50;
                }
            } 
            else if (p.type === PieceType.CANNON) {
                // 中炮
                if (x === 4) {
                    tacticalBonus += 35;
                    // 检测空头炮 (中路炮前无子直接照准九宫将门)
                    let screenCount = 0;
                    const enemyKingY = isRed ? blackKingPos.y : redKingPos.y;
                    const startY = Math.min(y, enemyKingY) + 1;
                    const endY = Math.max(y, enemyKingY);
                    for (let cy = startY; cy < endY; cy++) {
                        if (board[cy][4]) screenCount++;
                    }
                    if (screenCount === 0) {
                        tacticalBonus += 220; // 致命空头炮！
                    }
                }
            }

            if (isRed) redScore += tacticalBonus;
            else blackScore += tacticalBonus;
        }
    }

    // 士象全与残象破阵评估
    if (redAdvisors === 2 && redElephants === 2) redScore += 50;
    if (blackAdvisors === 2 && blackElephants === 2) blackScore += 50;
    if (redAdvisors === 0) redScore -= 100; // 破双士，极危
    if (blackAdvisors === 0) blackScore -= 100;
    if (redElephants === 0) redScore -= 70; // 破双相，怕炮
    if (blackElephants === 0) blackScore -= 70;

    // 将军状态评估
    if (isKingInDanger(board, Color.RED)) redScore -= 70;
    if (isKingInDanger(board, Color.BLACK)) blackScore -= 70;

    const turnBonus = 12;
    return turn === Color.RED 
        ? (redScore - blackScore + turnBonus) 
        : (blackScore - redScore + turnBonus);
};

// ================= 走法生成与启发式排序 (MVV-LVA + Killers + History) =================
interface ScoredMove {
    move: Move;
    score: number;
}

const getAllLegalMoves = (board: BoardState, color: Color, ttMove?: Move, ply: number = 0): ScoredMove[] => {
    const moves: ScoredMove[] = [];

    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const p = board[y][x];
            if (p && p.color === color) {
                const dests = getValidMoves(board, { x, y });
                for (const to of dests) {
                    if (!willBeChecked(board, { from: { x, y }, to }, color)) {
                        const target = board[to.y][to.x];
                        let sortScore = 0;

                        // 1. TT 最佳着法 (置换表置顶)
                        if (ttMove && ttMove.from.x === x && ttMove.from.y === y && ttMove.to.x === to.x && ttMove.to.y === to.y) {
                            sortScore += 1000000;
                        } 
                        // 2. MVV-LVA 吃子排序 (高价值被吃，低价值攻吃)
                        else if (target) {
                            sortScore += 50000 + PIECE_VALUES[target.type] * 10 - PIECE_VALUES[p.type];
                        } 
                        // 3. 杀手着法 (Killer Heuristic)
                        else if (ply < MAX_PLY) {
                            const k1 = killerMoves[ply][0];
                            const k2 = killerMoves[ply][1];
                            if (k1 && k1.from.x === x && k1.from.y === y && k1.to.x === to.x && k1.to.y === to.y) {
                                sortScore += 9000;
                            } else if (k2 && k2.from.x === x && k2.from.y === y && k2.to.x === to.x && k2.to.y === to.y) {
                                sortScore += 8000;
                            }
                        }

                        // 4. 历史启发表累加
                        sortScore += Math.min(historyTable[y][x][to.y][to.x], 6000);

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

// 静态搜索 (Quiescence Search) - 彻底避免地平线效应与漏将
const quiescenceSearch = (board: BoardState, alpha: number, beta: number, turn: Color, qDepth: number = 0): number => {
    const inCheck = isKingInDanger(board, turn);

    // 如果处于将军状态，绝不能 stand-pat 逃避！必须搜索所有应将解法
    if (!inCheck) {
        const standPat = evaluateBoard(board, turn);
        if (standPat >= beta) return beta;
        if (standPat > alpha) alpha = standPat;

        // Delta 剪枝：如果加上吃车(950分)依然小于 alpha，则提前剪枝
        if (standPat + 1050 < alpha) return alpha;
    }

    if (qDepth >= 4) {
        return evaluateBoard(board, turn);
    }

    // 未被将军时，仅搜索吃子着法
    const moves = inCheck ? getAllLegalMoves(board, turn) : getCaptureMoves(board, turn);

    if (moves.length === 0) {
        return inCheck ? (-MATE_SCORE + qDepth) : alpha;
    }

    for (const { move } of moves) {
        const fromP = board[move.from.y][move.from.x];
        const toP = board[move.to.y][move.to.x];
        board[move.to.y][move.to.x] = fromP;
        board[move.from.y][move.from.x] = null;
        
        const nextTurn = turn === Color.RED ? Color.BLACK : Color.RED;
        const score = -quiescenceSearch(board, -beta, -alpha, nextTurn, qDepth + 1);
        
        board[move.from.y][move.from.x] = fromP;
        board[move.to.y][move.to.x] = toP;
        
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
};

// ================= 主 Alpha-Beta 搜索 (支持空步剪枝与杀手更新) =================
const alphaBeta = (
    board: BoardState, 
    depth: number, 
    alpha: number, 
    beta: number, 
    turn: Color,
    ply: number = 0,
    allowNull: boolean = true
): number => {
    const hash = computeHash(board, turn);
    const ttEntry = TT.get(hash);
    if (ttEntry && ttEntry.depth >= depth) {
        if (ttEntry.flag === 0) return ttEntry.score;
        if (ttEntry.flag === 1 && ttEntry.score >= beta) return ttEntry.score;
        if (ttEntry.flag === 2 && ttEntry.score <= alpha) return ttEntry.score;
    }

    const inCheck = isKingInDanger(board, turn);
    if (inCheck && ply < 4) {
        depth++; // 将军延伸 (仅在前4层延伸，防止深层爆炸)
    }

    if (depth <= 0) {
        return quiescenceSearch(board, alpha, beta, turn, 0);
    }

    // 空步剪枝 (Null-Move Pruning, R=2)
    if (allowNull && !inCheck && depth >= 3) {
        const nextTurn = turn === Color.RED ? Color.BLACK : Color.RED;
        const nullScore = -alphaBeta(board, depth - 1 - 2, -beta, -beta + 1, nextTurn, ply + 1, false);
        if (nullScore >= beta) {
            return beta;
        }
    }

    const moves = getAllLegalMoves(board, turn, ttEntry?.bestMove, ply);
    if (moves.length === 0) {
        return inCheck ? (-MATE_SCORE + ply) : 0; // 被将死负分，困毙判和
    }

    let flag: 0 | 1 | 2 = 2; // 默认 UPPERBOUND
    let bestMove: Move | undefined = undefined;

    for (const { move } of moves) {
        const fromP = board[move.from.y][move.from.x];
        const toP = board[move.to.y][move.to.x];
        board[move.to.y][move.to.x] = fromP;
        board[move.from.y][move.from.x] = null;
        
        const nextTurn = turn === Color.RED ? Color.BLACK : Color.RED;
        const val = -alphaBeta(board, depth - 1, -beta, -alpha, nextTurn, ply + 1, true);
        
        board[move.from.y][move.from.x] = fromP;
        board[move.to.y][move.to.x] = toP;
        
        if (val >= beta) {
            // 产生 Beta 截断，记录杀手着法与历史分
            if (!toP && ply < MAX_PLY) {
                killerMoves[ply][1] = killerMoves[ply][0];
                killerMoves[ply][0] = move;
            }
            historyTable[move.from.y][move.from.x][move.to.y][move.to.x] += depth * depth;
            TT.set(hash, { depth, score: beta, flag: 1, bestMove: move });
            return beta;
        }
        if (val > alpha) {
            alpha = val;
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
        if (move.to.y === 1 || move.to.y === 8) return "车占下二道咽喉要道，锁敌将门";
        return "抢占大路，车控通津要津";
    }
    if (fromP.type === PieceType.HORSE) {
        if (move.to.x === 2 || move.to.x === 6) return "跃进卧槽马杀势，形成杀威胁";
        return "跃马抢占中央战术要点";
    }
    if (fromP.type === PieceType.CANNON) {
        if (move.to.x === 4) return "架中炮威震中路，直逼将帅";
        return "炮打冷着，暗藏牵制之机";
    }
    if (fromP.type === PieceType.SOLDIER) {
        return "挺兵制马，开通大子进攻通途";
    }
    return score > 200 ? "特大优势推进，步步紧逼" : "沉稳布阵，防守固若金汤";
};

// ================= 中文标准记谱法 (如 "炮二平五", "马8进7") =================
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
    const fromStr = isRed ? colName[fromColIdx] : numName[fromColIdx];
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
            const searchCount = Math.min(moves.length, 12);
            for (let i = 0; i < searchCount; i++) {
                const { move } = moves[i];
                const isBookMove = candidates.some(c => c.move.from.x === move.from.x && c.move.from.y === move.from.y && c.move.to.x === move.to.x && c.move.to.y === move.to.y);
                if (isBookMove) continue;

                const fromP = tempBoard[move.from.y][move.from.x];
                const toP = tempBoard[move.to.y][move.to.x];
                tempBoard[move.to.y][move.to.x] = fromP;
                tempBoard[move.from.y][move.from.x] = null;
                
                const nextTurn = turn === Color.RED ? Color.BLACK : Color.RED;
                const score = -alphaBeta(tempBoard, SUGGESTION_DEPTH - 1, -INFINITY, INFINITY, nextTurn, 1);
                
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

// ================= API: PVE 最佳着法 (特级大师迭代加深搜索) =================
export const searchBestMove = (board: BoardState, turn: Color, difficulty: AIDifficulty = 'master'): Move | null => {
    // 1. 查阅大师开局库 (菜鸟模式不查或小概率查，中高难度必查)
    if (difficulty !== 'beginner' || Math.random() < 0.5) {
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
    
    const maxDepth = DEPTH_MAP[difficulty] || 4;
    const tempBoard = board.map(row => row.map(p => p ? {...p} : null));
    let overallBestMove: Move | null = null;

    const rootMoves = getAllLegalMoves(tempBoard, turn);
    if (rootMoves.length === 0) return null;

    // 菜鸟模式：在候选走法中加入亲民随机性
    if (difficulty === 'beginner' && rootMoves.length > 2 && Math.random() < 0.35) {
        const randomIdx = Math.floor(Math.random() * Math.min(3, rootMoves.length));
        return rootMoves[randomIdx].move;
    }

    // 迭代加深搜索 (Iterative Deepening Search with Time Budget)
    const startTime = Date.now();
    const timeLimitMs = difficulty === 'master' ? 1200 : (difficulty === 'intermediate' ? 600 : 300);

    for (let depth = 2; depth <= maxDepth; depth++) {
        let currentBestScore = -INFINITY;
        let currentBestMove: Move | null = null;
        let alpha = -INFINITY;
        let beta = INFINITY;

        const hash = computeHash(tempBoard, turn);
        const ttEntry = TT.get(hash);
        const sortedMoves = getAllLegalMoves(tempBoard, turn, ttEntry?.bestMove, 0);

        for (const { move } of sortedMoves) {
            // 超时检查
            if (Date.now() - startTime > timeLimitMs && overallBestMove !== null) {
                return overallBestMove;
            }

            const fromP = tempBoard[move.from.y][move.from.x];
            const toP = tempBoard[move.to.y][move.to.x];
            tempBoard[move.to.y][move.to.x] = fromP;
            tempBoard[move.from.y][move.from.x] = null;

            const nextTurn = turn === Color.RED ? Color.BLACK : Color.RED;
            const val = -alphaBeta(tempBoard, depth - 1, -beta, -alpha, nextTurn, 1);

            tempBoard[move.from.y][move.from.x] = fromP;
            tempBoard[move.to.y][move.to.x] = toP;

            if (val > currentBestScore) {
                currentBestScore = val;
                currentBestMove = move;
            }
            if (val > alpha) alpha = val;
        }

        if (currentBestMove) {
            overallBestMove = currentBestMove;
        }

        // 如果已经找到必胜将死或即将超时，直接返回
        if (currentBestScore >= MATE_SCORE - 100 || Date.now() - startTime > timeLimitMs) {
            break;
        }
    }

    return overallBestMove || rootMoves[0].move;
};

// ================= API: 后台思考预热 TT =================
export const ponder = async (board: BoardState, turn: Color) => {
    const tempBoard = board.map(row => row.map(p => p ? {...p} : null));
    alphaBeta(tempBoard, 3, -INFINITY, INFINITY, turn);
};
