import React, { useState, useEffect, useCallback } from 'react';
import { Game } from './components/Game';
import { Lobby } from './components/Lobby';
import { User } from './types';
import { loadLocalUser, saveLocalUser } from './utils/userStorage';

type ViewState = 'lobby' | 'pve' | 'pvp';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('lobby');
  const [initialGameId, setInitialGameId] = useState<string | null>(null);
  const [user, setUser] = useState<User>(() => loadLocalUser());
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

      // Load cached first to avoid UI jumps
      const localCached = loadLocalUser(telegram_id, username);
      setUser(localCached);

      const res = await fetch(`/api/user?telegram_id=${telegram_id}&username=${encodeURIComponent(username)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.points === 'number') {
          const merged: User = {
            ...localCached,
            id: data.id || localCached.id,
            points: data.points,
            username: data.username || localCached.username,
          };
          setUser(merged);
          saveLocalUser(merged);
        }
      }
    } catch (e) {
      // Offline fallback: continue using local storage
    } finally {
      setIsLoadingUser(false);
    }
  }, [WebApp]);

  const handleUpdateUser = useCallback((updated: User) => {
    setUser(updated);
    saveLocalUser(updated);
  }, []);

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
    <div className="w-full min-h-screen serene-bg text-[#2D2721] flex flex-col items-center">
      {view === 'lobby' && (
        <Lobby 
          onStartGame={handleStartGame} 
          user={user}
          onRefreshUser={fetchUser}
          onUpdateUser={handleUpdateUser}
        />
      )}
      {(view === 'pve' || view === 'pvp') && (
        <Game 
          mode={view} 
          onBack={handleBackToLobby}
          invitedGameId={initialGameId}
          user={user}
          onUpdateUser={handleUpdateUser}
        />
      )}
    </div>
  );
};

export default App;
