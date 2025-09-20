import { SocketService } from './SocketService';

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private localVideoElement: HTMLVideoElement | null = null;
  private remoteVideoElement: HTMLVideoElement | null = null;
  private connectionStateCallback: ((state: string) => void) | null = null;
  private eventListeners: Map<string, Function[]> = new Map();

  private readonly iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  constructor(private socketService: SocketService) {
    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    this.socketService.on('offer', async (offer: RTCSessionDescriptionInit) => {
      await this.handleOffer(offer);
    });

    this.socketService.on('answer', async (answer: RTCSessionDescriptionInit) => {
      await this.handleAnswer(answer);
    });

    this.socketService.on('ice-candidate', async (candidate: RTCIceCandidate) => {
      await this.handleIceCandidate(candidate);
    });

    this.socketService.on('video-state-change', (data: { videoEnabled: boolean }) => {
      this.emit('video-state-change', data);
    });

    this.socketService.on('hold-state-change', (data: { onHold: boolean }) => {
      this.emit('hold-state-change', data);
    });
  }

  async startCall(localVideo: HTMLVideoElement | null, remoteVideo: HTMLVideoElement | null, callType: 'voice' | 'video' = 'video'): Promise<void> {
    this.localVideoElement = localVideo;
    this.remoteVideoElement = remoteVideo;

    try {
      const mediaConstraints = callType === 'voice' 
        ? { video: false, audio: true }
        : { video: true, audio: true };
        
      console.log(`🎥 Requesting ${callType} access with constraints:`, mediaConstraints);
      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);

      console.log(`🎥 ${callType} access granted!`);
      console.log(`🎥 Local stream tracks: ${this.localStream.getTracks().length}`);
      this.localStream.getTracks().forEach((track, index) => {
        console.log(`🎥 Track ${index}: ${track.kind} - ${track.label} - enabled: ${track.enabled}`);
      });

      // Display local video only for video calls
      if (callType === 'video' && this.localVideoElement) {
        this.localVideoElement.srcObject = this.localStream;
        console.log('🎥 Local video element connected to stream');
      } else if (callType === 'voice') {
        console.log('🎤 Voice call - no video element needed for local stream');
      }

      // Create peer connection
      this.createPeerConnection();

      // Add local stream to peer connection
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
          console.log(`🎥 Added ${track.kind} track to peer connection`);
        }
      });

      // Create and send offer
      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);
      this.socketService.sendOffer(offer);
      console.log('🎥 WebRTC offer created and sent');

    } catch (error) {
      console.error('🎥 Error starting call:', error);
      throw error;
    }
  }

  private createPeerConnection(): void {
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers
    });

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      console.log(`🎥 Remote stream received with ${event.streams[0].getTracks().length} tracks`);
      event.streams[0].getTracks().forEach((track, index) => {
        console.log(`🎥 Remote track ${index}: ${track.kind} - enabled: ${track.enabled}`);
      });
      
      if (this.remoteVideoElement) {
        this.remoteVideoElement.srcObject = this.remoteStream;
        console.log('🎥 Remote video element connected to stream');
      } else {
        console.log('🎤 Voice call - no remote video element, audio will play through default output');
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socketService.sendIceCandidate(event.candidate);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState || 'unknown';
      console.log('Connection state:', state);
      if (this.connectionStateCallback) {
        this.connectionStateCallback(state);
      }
    };
  }

  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      console.log('🎥 Handling incoming WebRTC offer...');
      if (!this.peerConnection) {
        console.log('🎥 No existing peer connection, requesting media access for incoming call...');
        // For incoming calls, we need to determine if it's voice or video
        // For now, assume video call - this could be improved with call type signaling
        const mediaConstraints = { video: true, audio: true };
        console.log('🎥 Using media constraints for incoming call:', mediaConstraints);
        
        // Get user media first
        this.localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);

        console.log('🎥 Camera access granted for incoming call!');
        console.log(`🎥 Local stream tracks: ${this.localStream.getTracks().length}`);
        this.localStream.getTracks().forEach((track, index) => {
          console.log(`🎥 Track ${index}: ${track.kind} - ${track.label} - enabled: ${track.enabled}`);
        });

        if (this.localVideoElement) {
          this.localVideoElement.srcObject = this.localStream;
          console.log('🎥 Local video element connected to stream for incoming call');
        }

        this.createPeerConnection();

        // Add local stream
        this.localStream.getTracks().forEach(track => {
          if (this.peerConnection && this.localStream) {
            this.peerConnection.addTrack(track, this.localStream);
            console.log(`🎥 Added ${track.kind} track to peer connection for incoming call`);
          }
        });
      }

      if (this.peerConnection) {
        await this.peerConnection.setRemoteDescription(offer);
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        this.socketService.sendAnswer(answer);
        console.log('🎥 WebRTC answer created and sent');
      } else {
        console.log('🎥 No peer connection available to process offer');
      }

    } catch (error) {
      console.error('🎥 Error handling offer:', error);
    }
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      if (this.peerConnection) {
        await this.peerConnection.setRemoteDescription(answer);
        console.log('🎥 WebRTC answer processed successfully');
      } else {
        console.log('🎥 No peer connection available to handle answer');
      }
    } catch (error) {
      console.error('🎥 Error handling answer:', error);
    }
  }

  private async handleIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    try {
      if (this.peerConnection) {
        await this.peerConnection.addIceCandidate(candidate);
        console.log('🎥 ICE candidate added successfully');
      } else {
        console.log('🎥 No peer connection available to handle ICE candidate');
      }
    } catch (error) {
      console.error('🎥 Error handling ICE candidate:', error);
    }
  }

  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
    // Signal video state change to remote peer
    this.socketService.sendVideoState({ videoEnabled: enabled });
  }

  toggleHold(onHold: boolean): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.enabled = !onHold;
      });
    }
    // Signal hold state to remote peer
    this.socketService.sendHoldState({ onHold });
  }

  sendVideoState(data: { videoEnabled: boolean }): void {
    this.socketService.sendVideoState(data);
  }

  sendHoldState(data: { onHold: boolean }): void {
    this.socketService.sendHoldState(data);
  }

  endCall(): void {
    console.log('🎥 Ending call and stopping all media tracks...');
    
    // Force stop all tracks first
    this.forceStopAllTracks();
    
    // Stop local stream and all tracks
    if (this.localStream) {
      console.log(`🎥 Stopping local stream with ${this.localStream.getTracks().length} tracks`);
      this.localStream.getTracks().forEach((track, index) => {
        console.log(`🎥 Stopping track ${index}: ${track.kind} - ${track.label} - state: ${track.readyState}`);
        track.stop();
        console.log(`🎥 Track ${index} stopped successfully`);
      });
      this.localStream = null;
      console.log('🎥 Local stream cleared');
    } else {
      console.log('🎥 No local stream to stop');
    }

    // Close peer connection
    if (this.peerConnection) {
      console.log(`🎥 Closing peer connection (state: ${this.peerConnection.connectionState})`);
      this.peerConnection.close();
      this.peerConnection = null;
      console.log('🎥 Peer connection closed');
    } else {
      console.log('🎥 No peer connection to close');
    }

    // Clear video elements
    if (this.localVideoElement) {
      console.log('🎥 Clearing local video element');
      this.localVideoElement.srcObject = null;
      this.localVideoElement.load(); // Reset the video element
      console.log('🎥 Local video element cleared');
    }
    if (this.remoteVideoElement) {
      console.log('🎥 Clearing remote video element');
      this.remoteVideoElement.srcObject = null;
      this.remoteVideoElement.load(); // Reset the video element
      console.log('🎥 Remote video element cleared');
    }

    this.remoteStream = null;
    console.log('🎥 Call ended and all media tracks stopped - camera should be released now');
  }

  onConnectionStateChange(callback: (state: string) => void): void {
    this.connectionStateCallback = callback;
  }

  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  // Method to check if camera is currently being accessed
  async checkCameraStatus(): Promise<void> {
    try {
      console.log('🎥 Checking camera access status...');
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      console.log(`🎥 Found ${videoDevices.length} video devices:`, videoDevices.map(d => d.label));
      
      // Check if we have an active stream
      if (this.localStream) {
        const tracks = this.localStream.getTracks();
        console.log(`🎥 Active stream with ${tracks.length} tracks:`);
        tracks.forEach((track, index) => {
          console.log(`🎥 Track ${index}: ${track.kind} - ${track.label} - state: ${track.readyState} - enabled: ${track.enabled}`);
        });
      } else {
        console.log('🎥 No active local stream');
      }
    } catch (error) {
      console.error('🎥 Error checking camera status:', error);
    }
  }

  // Method to force stop all media tracks (emergency cleanup)
  forceStopAllTracks(): void {
    console.log('🎥 Force stopping all media tracks...');
    
    // Stop local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track, index) => {
        if (track.readyState === 'live') {
          console.log(`🎥 Force stopping track ${index}: ${track.kind}`);
          track.stop();
        }
      });
    }

    // Stop remote stream tracks if any
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track, index) => {
        if (track.readyState === 'live') {
          console.log(`🎥 Force stopping remote track ${index}: ${track.kind}`);
          track.stop();
        }
      });
    }

    console.log('🎥 All tracks force stopped');
  }
}