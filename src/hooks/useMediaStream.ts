import { useState, useEffect } from 'react';

interface MediaStreamOptions {
  video?: boolean | MediaTrackConstraints;
  audio?: boolean | MediaTrackConstraints;
}

interface UseMediaStreamReturn {
  stream: MediaStream | null;
  error: Error | null;
  isLoading: boolean;
}

export const useMediaStream = (options: MediaStreamOptions = { video: true, audio: true }): UseMediaStreamReturn => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    const getMediaStream = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 },
            aspectRatio: { ideal: 1.7777777778 },
            frameRate: { max: 30 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            sampleSize: 16
          }
        });

        if (mounted) {
          setStream(mediaStream);
          setError(null);
        }
      } catch (err: any) {
        if (mounted) {
          let errorMessage = 'Failed to access media devices';
          
          switch (err.name) {
            case 'NotAllowedError':
              errorMessage = 'Camera access denied. Please allow camera and microphone access in your browser settings.';
              break;
            case 'NotFoundError':
              errorMessage = 'No camera or microphone found. Please check your device connections.';
              break;
            case 'NotReadableError':
              errorMessage = 'Camera or microphone is already in use by another application.';
              break;
            case 'OverconstrainedError':
              errorMessage = 'Camera requirements not met. Please check your camera settings.';
              break;
            case 'TypeError':
              errorMessage = 'No permission to access media devices.';
              break;
          }
          
          setError(new Error(errorMessage));
          setStream(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    getMediaStream();

    return () => {
      mounted = false;
      if (stream) {
        stream.getTracks().forEach(track => {
          track.stop();
        });
      }
    };
  }, []);

  return { stream, error, isLoading };
};