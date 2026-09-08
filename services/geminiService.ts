import { BoardState, Color, Move, ROWS, COLS, PieceType } from '../types';
import { searchBestMove, AIDifficulty, getMoveName } from '../utils/engine';
import { getValidMoves, boardToFen } from '../utils/gameLogic';

const boardToString = (board: BoardState): string => {
  let str = "   0 1 2 3 4 5 6 7 8\n";
  for (let y = 0; y < ROWS; y++) {
    str += `${y}  `;
    for (let x = 0; x < COLS; x++) {
      const p = board[y][x];
      if (!p) str += ". ";
      else {
        const c = p.color === Color.RED ? 'R' : 'B';
        const t = p.type.charAt(0).toUpperCase();
        str += `${c}${t}`;
      }
    }
    str += "\n";
  }
  return str;
};

// Query Cloudflare Pages Function `/api/gemini`
const callCloudGemini = async (prompt: string, allMoves: { move: Move, notation: string }[]): Promise<{ move: Move, reasoning: string } | null> => {
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!res.ok) return null;
    const data = await res.json();
    let text = data.text || "";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      text = text.substring(jsonStart, jsonEnd + 1);
    }

    const parsed = JSON.parse(text);
    const idx = parsed.bestMoveIndex;
    if (typeof idx === 'number' && idx >= 0 && idx < allMoves.length) {
      return {
        move: allMoves[idx].move,
        reasoning: parsed.reasoning || "Gemini 深度思考推荐招法"
      };
    }
  } catch (e) {
    console.warn("Cloud Gemini API request unavailable or timed out:", e);
  }
  return null;
};

export const getAiMove = async (
  board: BoardState, 
  turn: Color = Color.BLACK,
  difficulty: AIDifficulty = 'master',
  useCloudAi: boolean = false
): Promise<{ move: Move; reasoning?: string } | null> => {
  // If user requested Cloud Gemini AI reasoning, attempt API first
  if (useCloudAi) {
    const allMoves: { move: Move, notation: string }[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const p = board[y][x];
        if (p && p.color === turn) {
          const dests = getValidMoves(board, { x, y });
          dests.forEach(to => {
            const m = { from: { x, y }, to };
            allMoves.push({
              move: m,
              notation: getMoveName(board, m)
            });
          });
        }
      }
    }

    if (allMoves.length > 0) {
      const fen = boardToFen(board, turn);
      const visual = boardToString(board);
      const candidatesStr = allMoves.slice(0, 20).map((m, i) => `[${i}]: ${m.notation}`).join(', ');

      const prompt = `你是一位中国象棋特级大师。当前轮到黑方走棋。\nFEN: ${fen}\n候选走法列表: ${candidatesStr}\n请从候选列表中选出胜率最高、战术最优的一着，并输出严格的 JSON 格式：\n{"bestMoveIndex": 数字, "reasoning": "简短战术理由"}`;

      const cloudResult = await callCloudGemini(prompt, allMoves);
      if (cloudResult) {
        return cloudResult;
      }
    }
  }

  // Fast & strong local Alpha-Beta / Opening Book / PST Engine
  const engineMove = searchBestMove(board, turn, difficulty);
  if (engineMove) {
    return {
      move: engineMove,
      reasoning: "弈算引擎推演"
    };
  }

  return null;
};

// Backward-compatible export
export const getGeminiMove = async (board: BoardState): Promise<Move | null> => {
  const res = await getAiMove(board, Color.BLACK, 'master', false);
  return res ? res.move : null;
};
