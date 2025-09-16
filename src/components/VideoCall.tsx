import React, { useEffect, useRef, useState } from 'react';
import { Phone, Mic, MicOff, Video, VideoOff, Pause } from 'lucide-react';
import { WebRTCService } from '../services/WebRTCService';

interface VideoCallProps {
  webrtcService: WebRTCService;
  onEndCall: () => void;
  otherUser: string;
}

const VideoCall: React.FC<VideoCallProps> = ({ 
  webrtcService, 
  onEndCall, 
  otherUser 
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isOnHold, setIsOnHold] = useState(false);
  const [remoteOnHold, setRemoteOnHold] = useState(false);
  const [remoteVideoOff, setRemoteVideoOff] = useState(false);
  const [connectionState, setConnectionState] = useState<string>('connecting');
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const initializeCall = async () => {
      try {
        await webrtcService.startCall(localVideoRef.current!, remoteVideoRef.current!);
        
        // Listen for connection state changes
        webrtcService.onConnectionStateChange((state) => {
          console.log(`🎥 Video call connection state changed to: ${state}`);
          setConnectionState(state);
        });

        // Listen for remote video state changes
        webrtcService.on('video-state-change', (data: { videoEnabled: boolean }) => {
          console.log(`🎥 Remote video state changed: ${data.videoEnabled ? 'on' : 'off'}`);
          setRemoteVideoOff(!data.videoEnabled);
        });

        // Listen for remote hold state changes
        webrtcService.on('hold-state-change', (data: { onHold: boolean }) => {
          console.log(`🎥 Remote hold state changed: ${data.onHold ? 'on hold' : 'resumed'}`);
          setRemoteOnHold(data.onHold);
        });
        
      } catch (error) {
        console.error('Failed to initialize call:', error);
        onEndCall();
      }
    };

    initializeCall();

    return () => {
      console.log('🎥 VideoCall component unmounting, cleaning up...');
      webrtcService.endCall();
      // Check camera status after cleanup
      setTimeout(async () => {
        await webrtcService.checkCameraStatus();
      }, 200);
      console.log('🎥 VideoCall cleanup completed');
    };
  }, [webrtcService, onEndCall]);

  // Handle mouse movement for auto-hide controls
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      
      // Clear existing timeout
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      
      // Set new timeout to hide controls after 5 seconds
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 5000);
    };

    // Add mouse move listener
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const toggleAudio = () => {
    const newState = !isAudioEnabled;
    webrtcService.toggleAudio(newState);
    setIsAudioEnabled(newState);
  };

  const toggleVideo = () => {
    const newState = !isVideoEnabled;
    webrtcService.toggleVideo(newState);
    setIsVideoEnabled(newState);
  };

  const toggleHold = () => {
    const newState = !isOnHold;
    webrtcService.toggleHold(newState);
    setIsOnHold(newState);
    console.log(`Call ${newState ? 'put on hold' : 'resumed'}`);
  };

  const getConnectionStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return 'text-green-500';
      case 'connecting':
        return 'text-yellow-500';
      case 'disconnected':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionState) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="fixed inset-0 bg-black">
      {/* Video Container - Full Screen */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Remote Video (Main) - Fill full height */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full"
          style={{ 
            objectFit: 'cover',
            objectPosition: 'center'
          }}
        />
        
        {/* Header - Overlay */}
        <div className={`absolute top-0 left-0 right-0 bg-black bg-opacity-50 text-white p-4 flex items-center justify-between transition-opacity duration-300 z-10 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}>
          <div>
            <h2 className="text-lg font-semibold">{otherUser}</h2>
            <p className={`text-sm ${getConnectionStatusColor()}`}>
              {getConnectionStatusText()}
            </p>
          </div>
        </div>
        
        {/* Local Video (Picture-in-Picture) */}
        <div className="absolute top-4 right-4 w-32 h-24 sm:w-40 sm:h-30 bg-gray-800 rounded-lg overflow-hidden border-2 border-white shadow-lg z-20">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>

        {/* Connection Status Overlay */}
        {connectionState !== 'connected' && (
          <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-lg">{getConnectionStatusText()}</p>
            </div>
          </div>
        )}

        {/* Remote Hold Overlay */}
        {remoteOnHold && (
          <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="bg-yellow-600 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                <Pause className="w-8 h-8" />
              </div>
              <p className="text-xl font-semibold">{otherUser} put the call on hold</p>
              <p className="text-sm opacity-75">Waiting for them to resume...</p>
            </div>
          </div>
        )}

        {/* Remote Video Off Overlay */}
        {remoteVideoOff && !remoteOnHold && (
          <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="bg-gray-700 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                <VideoOff className="w-8 h-8" />
              </div>
              <p className="text-xl font-semibold">{otherUser} turned off their camera</p>
              <p className="text-sm opacity-75">Video is disabled</p>
            </div>
          </div>
        )}
        
        {/* Controls - Overlay */}
        <div className={`absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-4 sm:p-6 transition-opacity duration-300 z-10 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}>
        <div className="flex items-center justify-center space-x-4 sm:space-x-6">
          <button
            onClick={toggleAudio}
            className={`p-3 sm:p-4 rounded-full transition-all duration-200 ${
              isAudioEnabled
                ? 'bg-gray-700 hover:bg-gray-600 text-white hover:scale-105'
                : 'bg-red-600 hover:bg-red-700 text-white hover:scale-105'
            }`}
            title={isAudioEnabled ? 'Mute' : 'Unmute'}
          >
            {isAudioEnabled ? (
              <Mic className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : (
              <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
          </button>

          <button
            onClick={onEndCall}
            className="p-3 sm:p-4 bg-red-600 hover:bg-red-700 text-white rounded-full transition-all duration-200 hover:scale-105"
            title="End Call"
          >
            <Phone className="w-5 h-5 sm:w-6 sm:h-6 transform rotate-[135deg]" />
          </button>

          <button
            onClick={toggleVideo}
            className={`p-3 sm:p-4 rounded-full transition-all duration-200 ${
              isVideoEnabled
                ? 'bg-gray-700 hover:bg-gray-600 text-white hover:scale-105'
                : 'bg-red-600 hover:bg-red-700 text-white hover:scale-105'
            }`}
            title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {isVideoEnabled ? (
              <Video className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : (
              <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
          </button>

          <button
            onClick={toggleHold}
            className={`p-3 sm:p-4 rounded-full transition-all duration-200 ${
              isOnHold
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white hover:scale-105'
                : 'bg-gray-700 hover:bg-gray-600 text-white hover:scale-105'
            }`}
            title={isOnHold ? 'Resume call' : 'Hold call'}
          >
            <Pause className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;