import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { 
  createPeerConnection, 
  addTracksToConnection, 
  createOffer, 
  createAnswer, 
  addIceCandidate, 
  handleConnectionStateChange
} from '../utils/webrtc';

interface VideoContextType {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isChatting: boolean;
  isSearching: boolean;
  startChat: () => Promise<void>;
  endChat: () => void;
  error: Error | null;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
}

const VideoContext = createContext<VideoContextType>({
  localStream: null,
  remoteStream: null,
  isChatting: false,
  isSearching: false,
  startChat: async () => {},
  endChat: () => {},
  error: null,
  localVideoRef: React.createRef(),
  remoteVideoRef: React.createRef()
});

export const useVideo = () => useContext(VideoContext);

interface VideoProviderProps {
  children: React.ReactNode;
}

export const VideoProvider: React.FC<VideoProviderProps> = ({ children }) => {
  const { user, preferences } = useAuth();
  const { socket, isConnected } = useSocket();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isChatting, setIsChatting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [pendingCandidates, setPendingCandidates] = useState<RTCIceCandidateInit[]>([]);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteStreamTimeout = useRef<NodeJS.Timeout | null>(null);

  const cleanupPeerConnection = () => {
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    setPendingCandidates([]);
  };

  const setupPeerConnection = async (peerId: string) => {
    try {
      if (!socket) return null;

      console.log("Setting up peer connection for:", peerId);
      console.log("Local stream available:", !!localStreamRef.current);
      if (localStreamRef.current) {
        console.log("Local tracks:", localStreamRef.current.getTracks());
      }

      cleanupPeerConnection();

      const pc = createPeerConnection(peerId);
      setPeerConnection(pc.connection);

      if (localStreamRef.current) {
        console.log("📤 Local tracks being sent:", localStreamRef.current.getTracks());
        addTracksToConnection(pc.connection, localStreamRef.current);
        console.log("✅ Added tracks to connection:", localStreamRef.current.getTracks());
      } else {
        console.warn("⚠️ No localStream found when trying to add tracks.");
      }

      handleConnectionStateChange(pc.connection, () => {
        endChat();
      });

      pc.connection.ontrack = (event) => {
        console.log("🎥 Receiving remote track:", event.streams[0]);
        
        if (
          event.streams[0] &&
          (!localStreamRef.current || event.streams[0].id !== localStreamRef.current.id)
        ) {
          if (remoteStreamTimeout.current) {
            clearTimeout(remoteStreamTimeout.current);
          }

          remoteStreamTimeout.current = setTimeout(() => {
            setRemoteStream(event.streams[0]);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.pause();
              remoteVideoRef.current.srcObject = null;
              remoteVideoRef.current.load();
              remoteVideoRef.current.srcObject = event.streams[0];
              remoteVideoRef.current.play().catch(console.error);
            }
          }, 300);
        } else {
          console.warn("⚠️ Invalid remote stream or same as local");
        }
      };

      pc.connection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice-candidate', {
            userId: peerId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      return pc;
    } catch (err) {
      console.error('Error setting up peer connection:', err);
      return null;
    }
  };

  const startChat = async () => {
    try {
      if (!socket || !isConnected) {
        throw new Error('Socket connection not available');
      }

      setError(null);
      setIsSearching(true);
      setIsEnding(false);

      if (!localStreamRef.current) {
        try {
          console.log("Requesting user media");
          const stream = await navigator.mediaDevices.getUserMedia({
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
          
          console.log("User media acquired:", stream.id);
          setLocalStream(stream);
          localStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        } catch (err: any) {
          if (err.name === 'NotAllowedError') {
            throw new Error('Please allow camera and microphone access to use video chat.');
          } else {
            throw err;
          }
        }
      }

      socket.emit('match:search', { preferences });

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to start chat'));
      setIsSearching(false);
      endChat();
    }
  };

  const endChat = () => {
    if (isEnding) return;
    
    setIsEnding(true);
    
    if (socket && isConnected) {
      socket.emit('match:cancel');
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      setRemoteStream(null);
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    if (remoteStreamTimeout.current) {
      clearTimeout(remoteStreamTimeout.current);
      remoteStreamTimeout.current = null;
    }

    cleanupPeerConnection();
    setIsChatting(false);
    setIsSearching(false);
    setError(null);
    setIsEnding(false);
  };

  useEffect(() => {
    if (!socket) return;

    const handleMatchFound = async ({ peerId }: { peerId: string }) => {
      try {
        console.log("Match found, ensuring localStream is available...");
        
        if (!localStreamRef.current) {
          console.log("Waiting for localStream to be available before proceeding with match...");
          let attempts = 0;
          const maxAttempts = 50; // 5 seconds maximum wait
          
          while (!localStreamRef.current && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }
          
          if (!localStreamRef.current) {
            throw new Error("Failed to acquire local stream within timeout");
          }
        }

        console.log("LocalStream confirmed, proceeding with peer connection setup");
        const pc = await setupPeerConnection(peerId);
        if (!pc) {
          throw new Error("Failed to setup peer connection");
        }

        // Determine if we should create the offer based on socket ID comparison
        const shouldCreateOffer = socket.id < peerId;
        console.log(`Should create offer: ${shouldCreateOffer} (${socket.id} vs ${peerId})`);

        if (shouldCreateOffer) {
          const offer = await createOffer(pc.connection);
          if (!offer) {
            throw new Error('Failed to create offer');
          }

          socket.emit('offer', { userId: peerId, offer });
        } else {
          console.log("Waiting for offer from peer...");
        }

        setIsChatting(true);
        setIsSearching(false);
      } catch (err) {
        console.error('Error handling match:', err);
        endChat();
      }
    };

    const handleOffer = async ({ userId, offer }: { userId: string; offer: RTCSessionDescriptionInit }) => {
      try {
        if (!offer || !offer.type) {
          throw new Error('Invalid offer received');
        }

        const pc = await setupPeerConnection(userId);
        if (!pc) return;

        await pc.connection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await createAnswer(pc.connection, offer);
        
        socket.emit('answer', { userId, answer });

        for (const candidate of pendingCandidates) {
          await addIceCandidate(pc.connection, candidate);
        }
        setPendingCandidates([]);

        setIsChatting(true);
        setIsSearching(false);
      } catch (err) {
        console.error('Error handling offer:', err);
        endChat();
      }
    };

    const handleAnswer = async ({ userId, answer }: { userId: string; answer: RTCSessionDescriptionInit }) => {
      try {
        if (!peerConnection) {
          throw new Error('No peer connection available');
        }

        if (!answer || !answer.type) {
          throw new Error('Invalid answer received');
        }

        const signalingState = peerConnection.signalingState;

        if (signalingState === 'stable') {
          return;
        }

        if (signalingState !== 'have-local-offer') {
          throw new Error(`Invalid signaling state for setting remote answer: ${signalingState}`);
        }

        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

        for (const candidate of pendingCandidates) {
          await addIceCandidate(peerConnection, candidate);
        }
        setPendingCandidates([]);
      } catch (err) {
        console.error('Error handling answer:', err);
        endChat();
      }
    };

    const handleIceCandidate = async ({ userId, candidate }: { userId: string; candidate: RTCIceCandidateInit }) => {
      try {
        if (!candidate) return;

        if (peerConnection && peerConnection.remoteDescription) {
          await addIceCandidate(peerConnection, candidate);
        } else {
          setPendingCandidates(prev => [...prev, candidate]);
        }
      } catch (err) {
        console.error('Error handling ICE candidate:', err);
      }
    };

    socket.on('match:found', handleMatchFound);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('match:cancelled', endChat);

    return () => {
      socket.off('match:found', handleMatchFound);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('match:cancelled', endChat);
    };
  }, [socket, peerConnection, pendingCandidates]);

  useEffect(() => {
    return () => {
      endChat();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <VideoContext.Provider
      value={{
        localStream,
        remoteStream,
        isChatting,
        isSearching,
        startChat,
        endChat,
        error,
        localVideoRef,
        remoteVideoRef,
      }}
    >
      {children}
    </VideoContext.Provider>
  );
};