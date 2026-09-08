import { BoardState, Color, PieceType, Position, ROWS, COLS } from '../types';

// ================= 常量定义 =================
export const PIECE_VALUES: Record<string, number> = {
    [PieceType.GENERAL]: 10000,
    [PieceType.CHARIOT]: 900,
    [PieceType.CANNON]: 450,
    [PieceType.HORSE]: 400,
    [PieceType.ELEPHANT]: 200,
    [PieceType.ADVISOR]: 200,
    [PieceType.SOLDIER]: 100
};

export const calculatePlayerLevel = (points: number): number => {
  return Math.floor(Math.max(0, points) / 100);
};

// ================= 基础辅助 =================
export const isWithinBounds = (x: number, y: number) => x >= 0 && x < COLS && y >= 0 && y < ROWS;

export const isSameColor = (board: BoardState, to: Position, color: Color) => {
  const target = board[to.y][to.x];
  return target && target.color === color;
};

// ================= 核心规则：生成合法走法 =================
export const getValidMoves = (board: BoardState, from: Position): Position[] => {
  const piece = board[from.y][from.x];
  if (!piece) return [];

  const moves: Position[] = [];
  const { type, color } = piece;
  const isRed = color === Color.RED;

  const tryAdd = (x: number, y: number) => {
    if (isWithinBounds(x, y) && !isSameColor(board, { x, y }, color)) {
      moves.push({ x, y });
    }
  };

  switch (type) {
    case PieceType.GENERAL: {
      // 九宫格内移动 (帅/将)
      const deltas = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      const yMin = isRed ? 7 : 0;
      const yMax = isRed ? 9 : 2;
      const xMin = 3;
      const xMax = 5;

      deltas.forEach(([dx, dy]) => {
        const nx = from.x + dx;
        const ny = from.y + dy;
        if (nx >= xMin && nx <= xMax && ny >= yMin && ny <= yMax) {
          tryAdd(nx, ny);
        }
      });
      
      // 飞将规则 (老将照面 / 对将)
      const stepY = isRed ? -1 : 1;
      let checkY = from.y + stepY;
      while (checkY >= 0 && checkY < ROWS) {
          const p = board[checkY][from.x];
          if (p) {
              if (p.type === PieceType.GENERAL && p.color !== color) {
                  moves.push({ x: from.x, y: checkY });
              }
              break;
          }
          checkY += stepY;
      }
      break;
    }

    case PieceType.ADVISOR: {
      // 士/仕：九宫格斜走1格
      const deltas = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
      const yMin = isRed ? 7 : 0;
      const yMax = isRed ? 9 : 2;
      const xMin = 3;
      const xMax = 5;

      deltas.forEach(([dx, dy]) => {
        const nx = from.x + dx;
        const ny = from.y + dy;
        if (nx >= xMin && nx <= xMax && ny >= yMin && ny <= yMax) {
          tryAdd(nx, ny);
        }
      });
      break;
    }

    case PieceType.ELEPHANT: {
      // 相/象：田字格，不能过河，别象眼
      const deltas = [
        { dx: 2, dy: 2, eyeX: 1, eyeY: 1 },
        { dx: 2, dy: -2, eyeX: 1, eyeY: -1 },
        { dx: -2, dy: 2, eyeX: -1, eyeY: 1 },
        { dx: -2, dy: -2, eyeX: -1, eyeY: -1 },
      ];
      
      const yMin = isRed ? 5 : 0;
      const yMax = isRed ? 9 : 4;

      deltas.forEach(({ dx, dy, eyeX, eyeY }) => {
        const nx = from.x + dx;
        const ny = from.y + dy;
        const ex = from.x + eyeX;
        const ey = from.y + eyeY;

        if (isWithinBounds(nx, ny) && ny >= yMin && ny <= yMax) {
          // 塞象眼检测
          if (!board[ey][ex]) {
            tryAdd(nx, ny);
          }
        }
      });
      break;
    }

    case PieceType.HORSE: {
      // 马/傌：日字格，别马腿
      const steps = [
        { dx: 1, dy: 2, legX: 0, legY: 1 },
        { dx: -1, dy: 2, legX: 0, legY: 1 },
        { dx: 1, dy: -2, legX: 0, legY: -1 },
        { dx: -1, dy: -2, legX: 0, legY: -1 },
        { dx: 2, dy: 1, legX: 1, legY: 0 },
        { dx: 2, dy: -1, legX: 1, legY: 0 },
        { dx: -2, dy: 1, legX: -1, legY: 0 },
        { dx: -2, dy: -1, legX: -1, legY: 0 },
      ];

      steps.forEach(({ dx, dy, legX, legY }) => {
        const nx = from.x + dx;
        const ny = from.y + dy;
        const lx = from.x + legX;
        const ly = from.y + legY;

        if (isWithinBounds(nx, ny)) {
          // 别马腿检测
          if (!board[ly][lx]) {
            tryAdd(nx, ny);
          }
        }
      });
      break;
    }

    case PieceType.CHARIOT: {
      // 车/俥：直线任意格
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      dirs.forEach(([dx, dy]) => {
        let nx = from.x + dx;
        let ny = from.y + dy;
        while (isWithinBounds(nx, ny)) {
          const target = board[ny][nx];
          if (!target) {
            moves.push({ x: nx, y: ny });
          } else {
            if (target.color !== color) {
              moves.push({ x: nx, y: ny });
            }
            break;
          }
          nx += dx;
          ny += dy;
        }
      });
      break;
    }

    case PieceType.CANNON: {
      // 炮/砲：直线移动，隔子吃子
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      dirs.forEach(([dx, dy]) => {
        let nx = from.x + dx;
        let ny = from.y + dy;
        let screenFound = false;

        while (isWithinBounds(nx, ny)) {
          const target = board[ny][nx];
          if (!screenFound) {
            if (!target) {
              moves.push({ x: nx, y: ny });
            } else {
              screenFound = true; // 发现炮架
            }
          } else {
            if (target) {
              if (target.color !== color) {
                moves.push({ x: nx, y: ny }); // 隔一子吃敌子
              }
              break;
            }
          }
          nx += dx;
          ny += dy;
        }
      });
      break;
    }

    case PieceType.SOLDIER: {
      // 兵/卒：过河前只能向前，过河后可向前或左右
      const forward = isRed ? -1 : 1;
      const crossedRiver = isRed ? from.y <= 4 : from.y >= 5;

      tryAdd(from.x, from.y + forward);

      if (crossedRiver) {
        tryAdd(from.x - 1, from.y);
        tryAdd(from.x + 1, from.y);
      }
      break;
    }
  }

  return moves;
};

// ================= 规则判断 =================

// 检查老将是否被攻击 (将军)
export const isKingInDanger = (board: BoardState, color: Color): boolean => {
    // 1. 寻找老将位置
    let kx = -1, ky = -1;
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const p = board[y][x];
            if (p && p.type === PieceType.GENERAL && p.color === color) {
                kx = x; ky = y; break;
            }
        }
        if (kx !== -1) break;
    }
    if (kx === -1) return true; // 老将已被吃，处于必死态

    // 2. 遍历对方所有棋子，看能否攻击到老将
    const enemyColor = color === Color.RED ? Color.BLACK : Color.RED;
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const p = board[y][x];
            if (p && p.color === enemyColor) {
                const moves = getValidMoves(board, { x, y });
                if (moves.some(m => m.x === kx && m.y === ky)) {
                    return true;
                }
            }
        }
    }
    return false;
};

// 模拟一步棋，检查是否导致自己被将军 (自杀/送将判断)
export const willBeChecked = (board: BoardState, move: { from: Position, to: Position }, myColor: Color): boolean => {
    const fromP = board[move.from.y][move.from.x];
    const toP = board[move.to.y][move.to.x];
    
    board[move.to.y][move.to.x] = fromP;
    board[move.from.y][move.from.x] = null;

    const isChecked = isKingInDanger(board, myColor);

    board[move.from.y][move.from.x] = fromP;
    board[move.to.y][move.to.x] = toP;

    return isChecked;
};

// 判断是否还有合法走法 (若无合法走法且被将军为将死绝杀，无合法走法且未被将军为困毙)
export const hasLegalMoves = (board: BoardState, color: Color): boolean => {
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const p = board[y][x];
            if (p && p.color === color) {
                const moves = getValidMoves(board, { x, y });
                for (const move of moves) {
                    if (!willBeChecked(board, { from: { x, y }, to: move }, color)) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
};

// 计算总兵力价值
export const evaluateMaterial = (board: BoardState, color: Color): number => {
    let score = 0;
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const p = board[y][x];
            if (p && p.color === color) {
                score += PIECE_VALUES[p.type] || 0;
            }
        }
    }
    return score;
};

// 生成 FEN 串 (用于检测重复局面/开局识别)
export const boardToFen = (board: BoardState, turn: Color): string => {
    let fen = "";
    for (let y = 0; y < ROWS; y++) {
        let emptyCount = 0;
        for (let x = 0; x < COLS; x++) {
            const p = board[y][x];
            if (!p) {
                emptyCount++;
            } else {
                if (emptyCount > 0) {
                    fen += emptyCount;
                    emptyCount = 0;
                }
                let char = '';
                switch (p.type) {
                    case PieceType.GENERAL: char = 'k'; break;
                    case PieceType.ADVISOR: char = 'a'; break;
                    case PieceType.ELEPHANT: char = 'b'; break;
                    case PieceType.HORSE: char = 'n'; break;
                    case PieceType.CHARIOT: char = 'r'; break;
                    case PieceType.CANNON: char = 'c'; break;
                    case PieceType.SOLDIER: char = 'p'; break;
                }
                if (p.color === Color.RED) char = char.toUpperCase();
                fen += char;
            }
        }
        if (emptyCount > 0) fen += emptyCount;
        if (y < ROWS - 1) fen += "/";
    }
    const turnChar = turn === Color.RED ? 'w' : 'b'; 
    return `${fen} ${turnChar}`;
};
