import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BoardState, Color, Move, PieceType, Position, User } from '../types';
import { INITIAL_BOARD, TURN_TIME_LIMIT } from '../constants';
import { Board } from './Board';
import { getValidMoves, willBeChecked, isKingInDanger, hasLegalMoves, evaluateMaterial } from '../utils/gameLogic';
import { getAiMove } from '../services/geminiService';
import { getTopMoves, getMoveName, AIDifficulty } from '../utils/engine';
import { soundManager } from '../utils/sound';
import { RulesModal } from './RulesModal';
import confetti from 'canvas-confetti';
import { 
  Volume2, VolumeX, RotateCw, Lightbulb, Undo2, Flag, Handshake, 
  BookOpen, ChevronLeft, History, Trophy, Sparkles, Brain, Swords, Shield, X, AlertTriangle
} from 'lucide-react';

interface Props {
  mode: 'pve' | 'pvp';
  onBack: () => void;
  invitedGameId?: string | null;
  user: User | null;
}

export const Game: React.FC<Props> = ({ mode, onBack, invitedGameId, user }) => {
  const [board, setBoard] = useState<BoardState>(INITIAL_BOARD);
  const [turn, setTurn] = useState<Color>(Color.RED);
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [winner, setWinner] = useState<Color | 'Draw' | null>(null);
  const [resultMessage, setResultMessage] = useState<string>('');
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(TURN_TIME_LIMIT);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  
  // Game enhancements
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('master');
  const [useCloudAi, setUseCloudAi] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [historyStack, setHistoryStack] = useState<BoardState[]>([]);
  const [moveHistory, setMoveHistory] = useState<{ notation: string, color: Color }[]>([]);
  const [noCaptureSteps, setNoCaptureSteps] = useState<number>(0);

  // Modals & Panels
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState<boolean>(false);
  const [advisorMoves, setAdvisorMoves] = useState<{ move: Move, score: number, desc: string, notation: string }[]>([]);
  const [isCalculatingAdvisor, setIsCalculatingAdvisor] = useState<boolean>(false);

  // @ts-ignore
  const WebApp = window.Telegram?.WebApp;

  // Haptic feedback helper
  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error') => {
    try {
      if (WebApp?.HapticFeedback) {
        if (type === 'success' || type === 'error') {
          WebApp.HapticFeedback.notificationOccurred(type);
        } else {
          WebApp.HapticFeedback.impactOccurred(type);
        }
      }
    } catch (_) {}
  };

  // Turn timer countdown
  useEffect(() => {
    if (winner || isInitializing) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeOut();
          return 0;
        }
        if (prev === 10 && soundEnabled) {
          triggerHaptic('medium');
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [turn, winner, isInitializing, soundEnabled]);

  const handleTimeOut = () => {
    const loser = turn;
    const winnerColor = loser === Color.RED ? Color.BLACK : Color.RED;
    handleGameEnd(winnerColor, `${loser === Color.RED ? '红方' : '黑方'} 超时判负`);
  };

  // Sound toggle
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.setMuted(!next);
  };

  // Find general position for check highlights
  const getKingPos = (b: BoardState, color: Color): Position | null => {
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 9; x++) {
        const p = b[y][x];
        if (p && p.type === PieceType.GENERAL && p.color === color) {
          return { x, y };
        }
      }
    }
    return null;
  };

  const isRedInCheck = isKingInDanger(board, Color.RED);
  const isBlackInCheck = isKingInDanger(board, Color.BLACK);
  const checkedGeneralPos = isRedInCheck 
    ? getKingPos(board, Color.RED) 
    : (isBlackInCheck ? getKingPos(board, Color.BLACK) : null);

  // Initialize PvP room if invited
  useEffect(() => {
    if (mode === 'pvp' && invitedGameId) {
      setIsInitializing(true);
      setStatusMessage("正在连接棋局对弈房间...");
      
      const joinGame = async () => {
        const telegram_id = user?.telegram_id || "dev_guest";
        const username = user?.username || "棋士";
        try {
          const userRes = await fetch(`/api/user?telegram_id=${telegram_id}&username=${encodeURIComponent(username)}`);
          const userData = await userRes.json();
          const userLevel = userData.points ? Math.floor(userData.points / 100) : 0;

          const joinRes = await fetch('/api/join_game', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ telegram_id, game_id: invitedGameId, user_level: userLevel })
          });
          
          const joinData = await joinRes.json();
          if (joinData.success) {
            setStatusMessage(joinData.message || "对局连线成功！");
            setIsInitializing(false);
          } else {
            // Preview fallback
            setStatusMessage("已进入房间 (等待对手中...)");
            setIsInitializing(false);
          }
        } catch (e) {
          // Fallback
          setStatusMessage("已进入本地练习房间");
          setIsInitializing(false);
        }
      };
      joinGame();
    }
  }, [mode, invitedGameId, user]);

  const handleGameEnd = async (winnerColor: Color | 'Draw', reason: string = "") => {
    setWinner(winnerColor);
    setResultMessage(reason);
    
    if (winnerColor === Color.RED) {
      soundManager.playWin();
      triggerHaptic('success');
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    } else if (winnerColor === Color.BLACK) {
      soundManager.playLoss();
      triggerHaptic('error');
    }

    const telegram_id = user?.telegram_id || "dev_user_123";
    let result = 'loss';
    if (winnerColor === Color.RED) result = 'win';
    if (winnerColor === 'Draw') result = 'draw';

    if (mode === 'pve') {
      try {
        const res = await fetch('/api/game_result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegram_id, result })
        });
        const data = await res.json();
        if (data.success) {
          setResultMessage(prev => `${reason} (${data.message})`);
        }
      } catch (e) {
        console.error("Points update offline");
      }
    }
  };

  const handleSelect = (pos: Position) => {
    if (winner || isAiThinking || isInitializing) return;
    if (mode === 'pve' && turn !== Color.RED) return;

    const piece = board[pos.y][pos.x];
    
    if (selectedPos && selectedPos.x === pos.x && selectedPos.y === pos.y) {
      setSelectedPos(null);
      setValidMoves([]);
      return;
    }

    if (piece && piece.color === turn) {
      setSelectedPos(pos);
      // Only include moves that don't leave own King in check
      const rawMoves = getValidMoves(board, pos);
      const legalMoves = rawMoves.filter(to => !willBeChecked(board, { from: pos, to }, turn));
      setValidMoves(legalMoves);
      triggerHaptic('light');
    }
  };

  const executeMove = useCallback((move: Move) => {
    // 1. Save history for Undo
    setHistoryStack(prev => {
      const copy = board.map(row => row.map(p => p ? {...p} : null));
      const next = [...prev, copy];
      if (next.length > 40) next.shift();
      return next;
    });

    const newBoard = board.map(row => row.map(p => p ? {...p} : null));
    const sourcePiece = newBoard[move.from.y][move.from.x];
    const targetPiece = newBoard[move.to.y][move.to.x];

    if (!sourcePiece) return;

    // Move notation in standard Chinese Chess form
    const notation = getMoveName(board, move);

    newBoard[move.to.y][move.to.x] = { ...sourcePiece };
    newBoard[move.from.y][move.from.x] = null;

    setBoard(newBoard);
    setSelectedPos(null);
    setValidMoves([]);
    setLastMove(move);
    setTimeLeft(TURN_TIME_LIMIT);

    // 60-Move Rule counter
    if (targetPiece) {
      setNoCaptureSteps(0);
      soundManager.playCapture();
      triggerHaptic('medium');
    } else {
      setNoCaptureSteps(prev => prev + 1);
      soundManager.playMove();
      triggerHaptic('light');
    }

    setMoveHistory(prev => [...prev, { notation, color: sourcePiece.color }]);

    // Check if move puts enemy King in check or checkmate
    const nextTurn = sourcePiece.color === Color.RED ? Color.BLACK : Color.RED;
    const enemyInCheck = isKingInDanger(newBoard, nextTurn);
    const enemyHasMoves = hasLegalMoves(newBoard, nextTurn);

    if (targetPiece && targetPiece.type === PieceType.GENERAL) {
      handleGameEnd(sourcePiece.color, "帅帐斩首！");
      return;
    }

    if (!enemyHasMoves) {
      if (enemyInCheck) {
        soundManager.playCheck();
        handleGameEnd(sourcePiece.color, "将死绝杀！");
      } else {
        handleGameEnd(sourcePiece.color, "困毙判负（无子可动）！");
      }
      return;
    }

    if (enemyInCheck) {
      soundManager.playCheck();
      setStatusMessage("将军！");
      setTimeout(() => setStatusMessage(""), 2000);
    }

    if (noCaptureSteps >= 120) {
      handleGameEnd('Draw', "60回合无吃子，自动判和");
      return;
    }

    setTurn(nextTurn);
  }, [board, noCaptureSteps]);

  // Undo (悔棋)
  const handleUndo = () => {
    if (mode !== 'pve' || turn !== Color.RED || winner) return;
    if (historyStack.length < 2) {
      if (WebApp?.showAlert) WebApp.showAlert("无法悔棋 (开局或步数不足)");
      else alert("无法悔棋 (开局或步数不足)");
      return;
    }

    // Go back 2 steps (player + AI)
    const targetBoard = historyStack[historyStack.length - 2];
    setBoard(targetBoard);
    setHistoryStack(prev => prev.slice(0, prev.length - 2));
    setMoveHistory(prev => prev.slice(0, prev.length - 2));
    setTurn(Color.RED);
    setWinner(null);
    setSelectedPos(null);
    setValidMoves([]);
    setLastMove(null);
    setNoCaptureSteps(prev => Math.max(0, prev - 2));
    setTimeLeft(TURN_TIME_LIMIT);
    triggerHaptic('light');
  };

  // Surrender
  const handleSurrender = () => {
    if (winner) return;
    const confirmed = window.confirm("确定要投降认输吗？将结算对局胜负。");
    if (confirmed) {
      handleGameEnd(turn === Color.RED ? Color.BLACK : Color.RED, "投降认输");
    }
  };

  // Offer Draw
  const handleDraw = () => {
    if (winner) return;
    if (mode === 'pve') {
      if (noCaptureSteps > 40) {
        handleGameEnd('Draw', "局势焦灼，双方握手言和");
      } else {
        const msg = "AI: 棋局战意正浓，未满20回合不准求和！";
        if (WebApp?.showAlert) WebApp.showAlert(msg);
        else alert(msg);
      }
    } else {
      if (WebApp?.showAlert) WebApp.showAlert("已向对手发送求和请求。");
      else alert("已向对手发送求和请求。");
    }
  };

  // Trigger Advisor (军师锦囊)
  const handleRequestAdvisor = () => {
    if (turn !== Color.RED || winner) return;
    setIsCalculatingAdvisor(true);
    setIsAdvisorOpen(true);
    setTimeout(() => {
      const suggestions = getTopMoves(board, Color.RED, 3);
      setAdvisorMoves(suggestions);
      setIsCalculatingAdvisor(false);
    }, 150);
  };

  // Apply Advisor Move
  const handleApplyAdvisorMove = (m: Move) => {
    setIsAdvisorOpen(false);
    executeMove(m);
  };

  // AI Turn Execution
  useEffect(() => {
    if (mode === 'pve' && turn === Color.BLACK && !winner && !isInitializing) {
      const makeAiMove = async () => {
        setIsAiThinking(true);
        // Add natural pause
        await new Promise(resolve => setTimeout(resolve, 600));
        
        try {
          const aiResult = await getAiMove(board, Color.BLACK, aiDifficulty, useCloudAi);
          if (aiResult && aiResult.move) {
            executeMove(aiResult.move);
          } else {
            handleGameEnd(Color.RED, "AI 困毙认输");
          }
        } catch (e) {
          console.error("AI turn error:", e);
        } finally {
          setIsAiThinking(false);
        }
      };
      makeAiMove();
    }
  }, [turn, winner, board, executeMove, mode, isInitializing, aiDifficulty, useCloudAi]);

  // Restart match
  const handleRestart = () => {
    setBoard(INITIAL_BOARD);
    setTurn(Color.RED);
    setSelectedPos(null);
    setValidMoves([]);
    setWinner(null);
    setResultMessage('');
    setLastMove(null);
    setHistoryStack([]);
    setMoveHistory([]);
    setNoCaptureSteps(0);
    setTimeLeft(TURN_TIME_LIMIT);
  };

  // Material evaluation
  const redMaterial = evaluateMaterial(board, Color.RED);
  const blackMaterial = evaluateMaterial(board, Color.BLACK);

  if (isInitializing) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#f0dbb0] text-[#5c4033] wood-texture">
         <div className="w-16 h-16 border-4 border-[#8B0000] border-t-transparent rounded-full animate-spin mb-4" />
         <p className="text-lg font-black animate-pulse">{statusMessage}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-[#f0dbb0] text-[#4a3b2a] font-sans pb-6 wood-texture select-none">
      {/* Top Header */}
      <header className="w-full max-w-lg px-4 py-2.5 flex justify-between items-center bg-[#5c4033] text-[#f0dbb0] shadow-md z-30">
        <button 
          onClick={onBack} 
          className="flex items-center space-x-1 hover:text-amber-300 transition"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="font-bold text-xs">大厅</span>
        </button>
        
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5 font-black text-sm tracking-wider">
            <span>{mode === 'pve' ? '人机博弈' : '楚河论剑 (PVP)'}</span>
            {mode === 'pve' && (
              <span className="text-[10px] px-1.5 py-0.2 bg-[#8B0000] text-amber-200 rounded font-normal">
                {aiDifficulty === 'beginner' ? '初级' : aiDifficulty === 'intermediate' ? '中级' : '特级大师'}
              </span>
            )}
          </div>
          <span className="text-[10px] opacity-75 font-mono">
            {moveHistory.length > 0 ? `第 ${Math.ceil(moveHistory.length / 2)} 回合` : '序盘对决'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={toggleSound} 
            className="p-1.5 hover:bg-[#4a3025] rounded-full transition"
            title={soundEnabled ? "静音" : "开启音效"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-300" /> : <VolumeX className="w-4 h-4 opacity-50" />}
          </button>
          <button 
            onClick={() => setIsRulesOpen(true)} 
            className="p-1.5 hover:bg-[#4a3025] rounded-full transition"
            title="棋规指南"
          >
            <BookOpen className="w-4 h-4 text-amber-300" />
          </button>
        </div>
      </header>

      {/* Opponent & Player Info Bars */}
      <div className="w-full max-w-[480px] px-3 pt-2 pb-1 space-y-1.5 z-10">
        {/* Status banner */}
        {statusMessage && (
          <div className="bg-[#8B0000] text-amber-100 text-center py-1 rounded-full text-xs font-bold shadow animate-bounce">
            ⚠️ {statusMessage}
          </div>
        )}

        {/* Dual Players Dashboard */}
        <div className="grid grid-cols-2 gap-2 bg-[#e3c08d]/90 p-2.5 rounded-2xl border-2 border-[#5c4033]/40 shadow-inner">
          {/* Black Player / AI */}
          <div className={`flex items-center justify-between p-2 rounded-xl transition-all ${
            turn === Color.BLACK ? 'bg-[#5c4033] text-[#f0dbb0] shadow-md scale-[1.02]' : 'bg-[#fcf5e5]/80 text-[#5c4033]'
          }`}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-stone-900 border-2 border-stone-600 flex items-center justify-center font-black text-white text-xs shadow">
                将
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xs">{mode === 'pve' ? '特级大师 AI' : '黑方对手'}</span>
                <span className="text-[10px] opacity-75 font-mono">战力: {blackMaterial}</span>
              </div>
            </div>
            {turn === Color.BLACK && !winner && (
              <div className="text-right">
                {isAiThinking ? (
                  <span className="text-[10px] font-bold text-amber-300 animate-pulse">弈算中...</span>
                ) : (
                  <span className={`text-xs font-mono font-bold ${timeLeft < 15 ? 'text-red-400 animate-ping' : ''}`}>
                    {timeLeft}s
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Red Player (User) */}
          <div className={`flex items-center justify-between p-2 rounded-xl transition-all ${
            turn === Color.RED ? 'bg-[#8B0000] text-[#f0dbb0] shadow-md scale-[1.02]' : 'bg-[#fcf5e5]/80 text-[#5c4033]'
          }`}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#8B0000] border-2 border-amber-300 flex items-center justify-center font-black text-[#f0dbb0] text-xs shadow">
                帅
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xs">{user?.username || '执红棋士'}</span>
                <span className="text-[10px] opacity-75 font-mono">战力: {redMaterial}</span>
              </div>
            </div>
            {turn === Color.RED && !winner && (
              <div className="text-right">
                <span className={`text-xs font-mono font-bold ${timeLeft < 15 ? 'text-amber-200 animate-ping' : ''}`}>
                  {timeLeft}s
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Chessboard Component */}
      <main className="w-full max-w-[480px] px-2 py-1 flex justify-center">
        <Board 
          board={board}
          selectedPos={selectedPos}
          validMoves={validMoves}
          onSelect={handleSelect}
          onMove={executeMove}
          turn={turn}
          lastMove={lastMove}
          checkedGeneralPos={checkedGeneralPos}
          isFlipped={isFlipped}
        />
      </main>

      {/* Action Command Bar */}
      <div className="w-full max-w-[480px] px-3 pt-2 grid grid-cols-5 gap-1.5">
        <button
          onClick={handleUndo}
          disabled={mode !== 'pve' || turn !== Color.RED || historyStack.length < 2 || !!winner}
          className="flex flex-col items-center justify-center py-2 px-1 bg-[#fcf5e5] hover:bg-[#e3c08d] text-[#5c4033] border border-[#5c4033]/40 rounded-xl transition disabled:opacity-40"
        >
          <Undo2 className="w-4 h-4 mb-0.5 text-[#8B0000]" />
          <span className="text-[10px] font-bold">悔棋</span>
        </button>

        <button
          onClick={handleRequestAdvisor}
          disabled={turn !== Color.RED || !!winner}
          className="flex flex-col items-center justify-center py-2 px-1 bg-[#fcf5e5] hover:bg-[#e3c08d] text-[#5c4033] border border-[#5c4033]/40 rounded-xl transition disabled:opacity-40"
        >
          <Lightbulb className="w-4 h-4 mb-0.5 text-amber-600" />
          <span className="text-[10px] font-bold">军师锦囊</span>
        </button>

        <button
          onClick={() => setIsFlipped(!isFlipped)}
          className="flex flex-col items-center justify-center py-2 px-1 bg-[#fcf5e5] hover:bg-[#e3c08d] text-[#5c4033] border border-[#5c4033]/40 rounded-xl transition"
        >
          <RotateCw className="w-4 h-4 mb-0.5 text-[#5c4033]" />
          <span className="text-[10px] font-bold">翻转</span>
        </button>

        <button
          onClick={() => setIsHistoryOpen(true)}
          className="flex flex-col items-center justify-center py-2 px-1 bg-[#fcf5e5] hover:bg-[#e3c08d] text-[#5c4033] border border-[#5c4033]/40 rounded-xl transition"
        >
          <History className="w-4 h-4 mb-0.5 text-[#5c4033]" />
          <span className="text-[10px] font-bold">棋谱</span>
        </button>

        <button
          onClick={handleSurrender}
          disabled={!!winner}
          className="flex flex-col items-center justify-center py-2 px-1 bg-[#fcf5e5] hover:bg-red-100 text-red-800 border border-red-300 rounded-xl transition disabled:opacity-40"
        >
          <Flag className="w-4 h-4 mb-0.5 text-red-700" />
          <span className="text-[10px] font-bold">认输</span>
        </button>
      </div>

      {/* AI Difficulty Selector (PVE mode) */}
      {mode === 'pve' && !winner && (
        <div className="w-full max-w-[480px] px-3 pt-2 flex items-center justify-between text-xs text-[#5c4033]">
          <div className="flex items-center gap-1 font-bold">
            <Brain className="w-3.5 h-3.5 text-[#8B0000]" />
            <span>AI难度:</span>
          </div>
          <div className="flex gap-1.5">
            {(['beginner', 'intermediate', 'master'] as AIDifficulty[]).map(diff => (
              <button
                key={diff}
                onClick={() => setAiDifficulty(diff)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${
                  aiDifficulty === diff
                    ? 'bg-[#8B0000] text-[#f0dbb0] shadow-sm'
                    : 'bg-[#e3c08d] text-[#5c4033] hover:bg-[#d4b483]'
                }`}
              >
                {diff === 'beginner' ? '休闲初级' : diff === 'intermediate' ? '高手中级' : '特级大师'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Military Advisor Drawer / Modal */}
      {isAdvisorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#f0dbb0] border-4 border-[#5c4033] w-full max-w-md rounded-3xl p-5 relative shadow-2xl">
            <button 
              onClick={() => setIsAdvisorOpen(false)} 
              className="absolute top-4 right-4 p-1 hover:bg-[#5c4033]/10 text-[#5c4033] rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-center space-x-2 border-b-2 border-[#5c4033]/30 pb-3 mb-3">
              <Sparkles className="w-6 h-6 text-amber-600" />
              <h2 className="text-xl font-black text-[#5c4033] tracking-wide">军师锦囊 · 妙手推演</h2>
            </div>

            {isCalculatingAdvisor ? (
              <div className="py-8 text-center text-sm font-bold text-[#5c4033] flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-3 border-[#8B0000] border-t-transparent rounded-full animate-spin" />
                <span>军师正在深入推演棋局...</span>
              </div>
            ) : advisorMoves.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#5c4033] font-bold">
                当前局势尚无推荐妙手，请稳扎稳打。
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                {advisorMoves.map((rec, i) => (
                  <div 
                    key={i} 
                    className="p-3 bg-[#fcf5e5] border-2 border-[#5c4033]/30 rounded-2xl flex items-center justify-between hover:border-[#8B0000] transition"
                  >
                    <div className="flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-[#8B0000] text-amber-100 font-mono text-xs font-black">
                          {rec.notation}
                        </span>
                        <span className="text-[10px] text-amber-800 font-bold">
                          {i === 0 ? '★ 首选妙招' : `备选招法 ${i + 1}`}
                        </span>
                      </div>
                      <p className="text-xs text-[#5c4033] mt-1 font-medium leading-relaxed">
                        {rec.desc}
                      </p>
                    </div>
                    <button
                      onClick={() => handleApplyAdvisorMove(rec.move)}
                      className="px-3 py-2 bg-[#8B0000] hover:bg-[#6b0000] text-[#f0dbb0] font-black text-xs rounded-xl shadow transition whitespace-nowrap"
                    >
                      采用此招
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Move History Drawer / Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#f0dbb0] border-4 border-[#5c4033] w-full max-w-sm rounded-3xl p-5 relative shadow-2xl max-h-[80vh] flex flex-col">
            <button 
              onClick={() => setIsHistoryOpen(false)} 
              className="absolute top-4 right-4 p-1 hover:bg-[#5c4033]/10 text-[#5c4033] rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-center space-x-2 border-b-2 border-[#5c4033]/30 pb-3 mb-3">
              <History className="w-5 h-5 text-[#8B0000]" />
              <h2 className="text-xl font-black text-[#5c4033]">对局棋谱</h2>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 text-xs">
              {moveHistory.length === 0 ? (
                <div className="py-8 text-center opacity-60 font-bold">尚未开始走子</div>
              ) : (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 bg-[#e3c08d] p-3 rounded-2xl border border-[#5c4033]/30">
                  {moveHistory.map((m, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 py-0.5">
                      <span className="text-[10px] opacity-60 font-mono w-4">{idx + 1}.</span>
                      <span className={`font-bold ${m.color === Color.RED ? 'text-[#8B0000]' : 'text-stone-900'}`}>
                        {m.notation}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setIsHistoryOpen(false)}
              className="mt-3 w-full py-2 bg-[#5c4033] text-[#f0dbb0] font-bold rounded-xl text-xs"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />

      {/* Game Over Banner / Modal */}
      {winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-[#f0dbb0] border-4 border-[#5c4033] w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl relative">
            <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center border-3 border-[#5c4033] shadow-inner bg-[#e3c08d]">
              {winner === Color.RED ? (
                <Trophy className="w-9 h-9 text-amber-600 animate-bounce" />
              ) : winner === 'Draw' ? (
                <Handshake className="w-9 h-9 text-[#5c4033]" />
              ) : (
                <Shield className="w-9 h-9 text-stone-700" />
              )}
            </div>

            <h2 className="text-3xl font-black text-[#5c4033] tracking-wide mb-1">
              {winner === Color.RED ? "旗开得胜！" : winner === 'Draw' ? "势均力敌" : "败局已定"}
            </h2>

            <p className="text-sm font-bold text-[#8B0000] mb-4">
              {resultMessage || (winner === Color.RED ? "恭喜斩获胜利！" : "再接再厉，棋逢对手！")}
            </p>

            <div className="space-y-2">
              <button
                onClick={handleRestart}
                className="w-full py-3 bg-[#8B0000] hover:bg-[#6b0000] text-[#f0dbb0] font-black rounded-xl shadow-lg transition"
              >
                重整旗鼓，再战一局
              </button>

              <button
                onClick={onBack}
                className="w-full py-2.5 bg-[#e3c08d] hover:bg-[#d4b483] text-[#5c4033] font-bold rounded-xl transition"
              >
                返回游戏大厅
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
