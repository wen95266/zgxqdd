import { BoardState, Color, Move, ROWS, COLS } from '../types';
import { searchBestMove, AIDifficulty, getMoveName, getAllLegalMoves } from '../utils/engine';
import { boardToFen } from '../utils/gameLogic';

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
    let parsed: any = null;
    if (typeof data.text === 'object' && data.text !== null) {
      parsed = data.text;
    } else if (typeof data.text === 'string') {
      let text = data.text.replace(/```json/g, '').replace(/```/g, '').trim();
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        text = text.substring(jsonStart, jsonEnd + 1);
      }
      parsed = JSON.parse(text);
    } else if (data.bestMoveIndex !== undefined) {
      parsed = data;
    }

    if (parsed) {
      const idx = parsed.bestMoveIndex;
      if (typeof idx === 'number' && idx >= 0 && idx < allMoves.length) {
        return {
          move: allMoves[idx].move,
          reasoning: parsed.reasoning || "Gemini 深度思考推荐招法"
        };
      }
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
  // 1. 获取所有严格合法且经过启发式排序的走法
  const scoredLegalMoves = getAllLegalMoves(board, turn);
  if (scoredLegalMoves.length === 0) {
    return null;
  }

  // 2. 如果开启了云端 Gemini 特级大师分析，组装精细的棋谱上下文与启发式候选
  if (useCloudAi) {
    const legalCandidates = scoredLegalMoves.slice(0, 16).map(sm => ({
      move: sm.move,
      notation: getMoveName(board, sm.move)
    }));

    const fen = boardToFen(board, turn);
    const sideName = turn === Color.RED ? "红方" : "黑方";
    const candidatesStr = legalCandidates.map((m, i) => `[${i}]: ${m.notation}`).join(', ');

    const prompt = `你是一位拥有中国象棋特级大师棋力的决策大脑。当前轮到${sideName}走棋。\n` +
      `局面 FEN: ${fen}\n` +
      `候选合法走法(已预排序): ${candidatesStr}\n` +
      `决断原则：\n` +
      `1. 防杀应将：如受威胁务必化解；\n` +
      `2. 致命杀着：有双车错、卧槽马、重炮、马后炮杀势坚决进击；\n` +
      `3. 抢占枢纽：车占下二道或肋线，马跃要津，炮镇当头；\n` +
      `4. 得子控局：优先吃子，勿孤子深入送吃。\n` +
      `请输出严格 JSON 格式：\n{"bestMoveIndex": 数字, "reasoning": "简短战术理由（不超过20字）"}`;

    const cloudResult = await callCloudGemini(prompt, legalCandidates);
    if (cloudResult) {
      return cloudResult;
    }
  }

  // 3. 本地特级大师 Alpha-Beta 引擎 (集成开局库、PST、增量哈希、抱负窗口与置换表)
  const engineMove = searchBestMove(board, turn, difficulty);
  if (engineMove) {
    return {
      move: engineMove,
      reasoning: "弈算引擎推演"
    };
  }

  return {
    move: scoredLegalMoves[0].move,
    reasoning: "弈算引擎推演"
  };
};

// Backward-compatible export
export const getGeminiMove = async (board: BoardState): Promise<Move | null> => {
  const res = await getAiMove(board, Color.BLACK, 'master', false);
  return res ? res.move : null;
};
