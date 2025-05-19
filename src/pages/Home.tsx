import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, RefreshCw, Menu, Heart, Smile, Store, X, SkipForward } from 'lucide-react';
import { useMediaStream } from '../hooks/useMediaStream';
import { useAuth } from '../contexts/AuthContext';
import { useVideo } from '../contexts/VideoContext';
import { useSocket } from '../contexts/SocketContext';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { isConnected } = useSocket();
  const [showMenu, setShowMenu] = React.useState(false);
  const [showStore, setShowStore] = React.useState(false);
  const [videoError, setVideoError] = React.useState<string | null>(null);
  
  const { 
    remoteVideoRef,
    remoteStream,
    isChatting,
    isSearching,
    startChat,
    endChat,
    error: chatError
  } = useVideo();

  const { stream: localStream, error: mediaError } = useMediaStream({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'user'
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true
    }
  });

  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      try {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play().catch(err => {
          setVideoError(`Failed to play local video: ${err.message}`);
        });
      } catch (err) {
        setVideoError(`Failed to set local video source: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  }, [localStream]);

  const handleLogout = () => {
    endChat();
    setUser(null);
    navigate('/');
  };

  const handleStorePurchase = (coins: number, price: string) => {
    console.log(`Purchase attempted: ${coins} coins for ${price}`);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen w-full bg-[#0f172a]">
      {/* Top Controls */}
      <div className="absolute right-4 top-4 flex items-center space-x-2 z-10">
        <button
          onClick={() => setShowStore(true)}
          className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        >
          <Store className="h-5 w-5" />
        </button>
        <button className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
          <User className="h-5 w-5" />
        </button>
        <button
          onClick={() => setShowMenu(true)}
          className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Video Grid */}
      <div className="flex w-1/2 items-center justify-center">
        <div className="relative h-full w-full">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`h-full w-full rounded-lg object-cover ${!localStream ? 'hidden' : ''}`}
          />
          {(mediaError || videoError) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
              <div className="text-xl text-red-500 p-4 text-center">
                {mediaError?.message || videoError}
              </div>
            </div>
          )}
          <div className="absolute left-4 top-4 rounded-lg bg-black/50 px-4 py-2 text-white">
            <p className="text-sm">You • {user.country || 'Unknown'}</p>
          </div>
        </div>
      </div>

      <div className="flex w-1/2 items-center justify-center">
        <div className="relative h-full w-full">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`h-full w-full rounded-lg object-cover ${remoteStream ? '' : 'hidden'}`}
          />
          {isChatting && !remoteStream && (
            <div className="absolute top-4 left-4 z-50 bg-yellow-700 text-white px-4 py-2 rounded">
              Waiting for remote video to start...
            </div>
          )}
          {isChatting && remoteStream && (
            <div className="absolute top-4 right-4 z-10 bg-black/60 text-white px-4 py-2 rounded">
              <p className="text-sm font-mono">Stream ID: {remoteStream.id}</p>
            </div>
          )}
          {!isChatting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="mb-4 flex items-center justify-center space-x-2">
                <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-400"></div>
                <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: '0.2s' }}></div>
                <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: '0.4s' }}></div>
              </div>
              <h2 className="mb-4 text-2xl font-semibold text-white">
                {!isConnected ? 'Connecting...' : isSearching ? 'Looking for a match...' : 'Ready to chat?'}
              </h2>
              <button
                onClick={isSearching ? endChat : startChat}
                disabled={!isConnected || !!mediaError}
                className={`rounded-lg px-6 py-3 text-white transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#0f172a] ${
                  !isConnected || mediaError
                    ? 'bg-gray-500 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {!isConnected ? 'Connecting...' : isSearching ? 'Cancel Search' : 'Start Chatting'}
              </button>
              {chatError && (
                <p className="mt-4 text-red-400">{chatError.message}</p>
              )}
            </div>
          )}
          {isChatting && remoteStream && (
            <div className="absolute bottom-4 right-4 flex space-x-2">
              <button className="rounded-full bg-white/10 p-2 text-white backdrop-blur-sm hover:bg-white/20">
                <Heart className="h-5 w-5" />
              </button>
              <button className="rounded-full bg-white/10 p-2 text-white backdrop-blur-sm hover:bg-white/20">
                <Smile className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hamburger Menu */}
      {showMenu && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
          <div className="absolute right-0 h-full w-64 bg-white p-6">
            <div className="mb-6 flex justify-between">
              <h2 className="text-xl font-semibold">Menu</h2>
              <button onClick={() => setShowMenu(false)} className="text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <button className="w-full text-left hover:text-indigo-600">About</button>
              <button className="w-full text-left hover:text-indigo-600">Privacy Policy</button>
              <button onClick={handleLogout} className="w-full text-left text-red-500 hover:text-red-600">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Store Modal */}
      {showStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Get Coins</h2>
              <button
                onClick={() => setShowStore(false)}
                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              {[
                { coins: 100, price: '$1.99' },
                { coins: 500, price: '$6.99' },
                { coins: 1000, price: '$12.99' },
                { coins: 2500, price: '$24.99' },
              ].map(({ coins, price }) => (
                <button
                  key={coins}
                  onClick={() => handleStorePurchase(coins, price)}
                  className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
                >
                  <span className="flex items-center">
                    <Store className="mr-2 h-5 w-5 text-indigo-600" />
                    {coins} Coins
                  </span>
                  <span className="font-semibold text-gray-900">{price}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};