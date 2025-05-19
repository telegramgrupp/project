import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { SocketEventMap } from '../types';

type SocketContextType = {
  socket: Socket | null;
  isConnected: boolean;
  isSearching: boolean;
  startSearching: () => void;
  stopSearching: () => void;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  isSearching: false,
  startSearching: () => {},
  stopSearching: () => {},
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  
  // Centralized connection management
  const peerConnections = useRef(new Map<string, RTCPeerConnection>());
  const pendingCandidates = useRef(new Map<string, RTCIceCandidateInit[]>());
  const allowedPairs = useRef(new Map<string, string>());

  const getOrCreatePeerConnection = (userId: string): RTCPeerConnection => {
    let pc = peerConnections.current.get(userId);
    
    if (!pc || pc.connectionState === 'closed') {
      pc = new RTCPeerConnection({
        iceServers: [
          {
            urls: [
              'stun:stun.l.google.com:19302',
              'stun:stun1.l.google.com:19302',
            ],
          },
        ],
        iceCandidatePoolSize: 10,
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('webrtc:candidate', {
            userId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`Connection state for ${userId}:`, pc?.connectionState);
        if (pc?.connectionState === 'failed' || pc?.connectionState === 'closed') {
          cleanupPeerConnection(userId);
        }
      };

      peerConnections.current.set(userId, pc);
    }

    return pc;
  };

  const cleanupPeerConnection = (userId: string) => {
    const pc = peerConnections.current.get(userId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(userId);
    }
    pendingCandidates.current.delete(userId);
    allowedPairs.current.delete(userId);
  };

  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL as string;

    if (SOCKET_URL) {
      const socketInstance = io(SOCKET_URL, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
      });

      socketInstance.on('connect', () => {
        console.log('📡 Socket connected:', socketInstance.id);
        setIsConnected(true);
      });

      socketInstance.on('disconnect', () => {
        console.log('❌ Socket disconnected');
        setIsConnected(false);
        setIsSearching(false);
        setIsCancelling(false);
        
        // Cleanup all connections
        peerConnections.current.forEach((_, userId) => cleanupPeerConnection(userId));
        allowedPairs.current.clear();
        pendingCandidates.current.clear();
      });

      socketInstance.on('match:found', (data: { peerId: string }) => {
        console.log('🤝 Match found with peer:', data.peerId);
        setIsSearching(false);
        setIsCancelling(false);

        // Store allowed pair
        allowedPairs.current.set(data.peerId, socketInstance.id);

        // Determine if we should create the offer
        const shouldCreateOffer = socketInstance.id < data.peerId;
        
        if (shouldCreateOffer) {
          const pc = getOrCreatePeerConnection(data.peerId);
          pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .then(() => {
              socketInstance.emit('webrtc:offer', {
                userId: data.peerId,
                offer: pc.localDescription
              });
            })
            .catch(err => console.error('Error creating offer:', err));
        }
      });

      socketInstance.on('webrtc:offer', async (data: { userId: string; offer: RTCSessionDescriptionInit }) => {
        console.log('📥 Received offer from:', data.userId);
        
        if (!allowedPairs.current.has(data.userId)) {
          console.warn('⚠️ Unauthorized offer received');
          return;
        }

        try {
          const pc = getOrCreatePeerConnection(data.userId);
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          socketInstance.emit('webrtc:answer', {
            userId: data.userId,
            answer
          });

          // Process any pending candidates
          const candidates = pendingCandidates.current.get(data.userId) || [];
          for (const candidate of candidates) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidates.current.delete(data.userId);
        } catch (err) {
          console.error('Error handling offer:', err);
          cleanupPeerConnection(data.userId);
        }
      });

      socketInstance.on('webrtc:answer', async (data: { userId: string; answer: RTCSessionDescriptionInit }) => {
        console.log('📥 Received answer from:', data.userId);
        
        if (!allowedPairs.current.has(data.userId)) {
          console.warn('⚠️ Unauthorized answer received');
          return;
        }

        try {
          const pc = peerConnections.current.get(data.userId);
          if (!pc) throw new Error('No peer connection found');

          if (pc.signalingState !== 'have-local-offer') {
            console.warn('Invalid signaling state for answer:', pc.signalingState);
            return;
          }

          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));

          // Process any pending candidates
          const candidates = pendingCandidates.current.get(data.userId) || [];
          for (const candidate of candidates) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidates.current.delete(data.userId);
        } catch (err) {
          console.error('Error handling answer:', err);
          cleanupPeerConnection(data.userId);
        }
      });

      socketInstance.on('webrtc:candidate', async (data: { userId: string; candidate: RTCIceCandidateInit }) => {
        if (!allowedPairs.current.has(data.userId)) {
          console.warn('⚠️ Unauthorized ICE candidate received');
          return;
        }

        const pc = peerConnections.current.get(data.userId);
        if (pc?.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (err) {
            console.error('Error adding ICE candidate:', err);
          }
        } else {
          // Queue the candidate
          if (!pendingCandidates.current.has(data.userId)) {
            pendingCandidates.current.set(data.userId, []);
          }
          pendingCandidates.current.get(data.userId)?.push(data.candidate);
        }
      });

      socketInstance.connect();
      setSocket(socketInstance);

      return () => {
        socketInstance.disconnect();
        peerConnections.current.forEach((_, userId) => cleanupPeerConnection(userId));
      };
    }
  }, []);

  const startSearching = () => {
    if (socket && isConnected && !isSearching) {
      console.log('🔍 Starting search for match');
      socket.emit('match:search');
      setIsSearching(true);
      setIsCancelling(false);
    }
  };

  const stopSearching = () => {
    if (socket && isConnected && isSearching && !isCancelling) {
      console.log('⏹️ Stopping search');
      setIsCancelling(true);
      socket.emit('match:cancel');
      setIsSearching(false);
      
      // Cleanup all connections
      peerConnections.current.forEach((_, userId) => cleanupPeerConnection(userId));
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, isSearching, startSearching, stopSearching }}>
      {children}
    </SocketContext.Provider>
  );
};