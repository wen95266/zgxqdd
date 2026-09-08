import React, { useState, useEffect, useCallback } from 'react';
import { Game } from './components/Game';
import { Lobby } from './components/Lobby';
import { User } from './types';

type ViewState = 'lobby' | 'pve' | 'pvp';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('lobby');
  const [initialGameId, setInitialGameId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState<boolean>(true);

  // @ts-ignore
  const WebApp = window.Telegram?.WebApp;

  // Initialize and refresh user profile
  const fetchUser = useCallback(async () => {
    try {
      WebApp?.ready?.();
      WebApp?.expand?.();

      const tgUser = WebApp?.initDataUnsafe?.user;
      const telegram_id = tgUser?.id?.toString() || "dev_user_123";
      const username = tgUser?.username || tgUser?.first_name || "棋坛行者";

      const res = await fetch(`/api/user?telegram_id=${telegram_id}&username=${encodeURIComponent(username)}`);
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        // Fallback for preview / dev
        setUser({
          id: 1,
          telegram_id,
          username,
          points: 1500
        });
      }
    } catch (e) {
      setUser({
        id: 1,
        telegram_id: "dev_user_123",
        username: "弈林高手",
        points: 1200
      });
    } finally {
      setIsLoadingUser(false);
    }
  }, [WebApp]);

  useEffect(() => {
    fetchUser();

    // Check deep link for PVP game invite
    // 1. Telegram WebApp start_param
    const startParam = WebApp?.initDataUnsafe?.start_param;
    // 2. URL search params fallback
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('startapp') || urlParams.get('tgWebAppStartParam');
    const targetParam = startParam || queryParam;

    if (targetParam && targetParam.startsWith('game_')) {
      const gameId = targetParam.replace('game_', '');
      setInitialGameId(gameId);
      setView('pvp');
    }
  }, [fetchUser, WebApp]);

  const handleStartGame = (mode: 'pve' | 'pvp', invitedId?: string) => {
    if (invitedId) {
      setInitialGameId(invitedId);
    }
    setView(mode);
  };

  const handleBackToLobby = () => {
    setView('lobby');
    setInitialGameId(null);
    fetchUser();
  };

  return (
    <div className="w-full min-h-screen bg-[#f0dbb0]">
      {view === 'lobby' && (
        <Lobby 
          onStartGame={handleStartGame} 
          user={user}
          onRefreshUser={fetchUser}
        />
      )}
      {(view === 'pve' || view === 'pvp') && (
        <Game 
          mode={view} 
          onBack={handleBackToLobby}
          invitedGameId={initialGameId}
          user={user}
        />
      )}
    </div>
  );
};

export default App;
