"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { 
  Video as VideoIcon, Phone, Maximize2, Minimize2, MicOff, Mic, PhoneOff, CameraOff, AlertTriangle, Shield, Globe, Zap, Camera, ShieldCheck, Volume2, VolumeX
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoCallProps {
  contact: any;
  onClose: () => void;
  userId: string;
  callType: "video" | "voice";
  isInitiator?: boolean;
  incomingSignal?: any;
}

export function VideoCall({ 
  contact, 
  onClose, 
  userId, 
  callType: initialCallType,
  isInitiator = true,
  incomingSignal
}: VideoCallProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(initialCallType === "voice");
  const [isBlurred, setIsBlurred] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState("Initializing...");
  const [callDuration, setCallDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  
    const myVideo = useRef<HTMLVideoElement>(null);
    const userVideo = useRef<HTMLVideoElement>(null);
    const remoteAudio = useRef<HTMLAudioElement>(null);
    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const channelRef = useRef<any>(null);
    const hasAnswered = useRef(false);
    const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);
    const remoteDescriptionSet = useRef(false);

    // Ensure streams are attached to video/audio elements
    useEffect(() => {
      if (myVideo.current && stream) {
        myVideo.current.srcObject = stream;
        myVideo.current.play().catch(e => console.error("My video play failed:", e));
      }
    }, [stream]);

    useEffect(() => {
      if (userVideo.current && remoteStream && initialCallType === "video") {
        userVideo.current.srcObject = remoteStream;
        userVideo.current.onloadedmetadata = () => {
          userVideo.current?.play().catch(e => console.error("Remote video play failed:", e));
        };
      }
      if (remoteAudio.current && remoteStream) {
        remoteAudio.current.srcObject = remoteStream;
        remoteAudio.current.onloadedmetadata = () => {
          remoteAudio.current?.play().catch(e => console.error("Remote audio play failed:", e));
        };
      }
    }, [remoteStream, initialCallType]);


  useEffect(() => {
    const timer = setInterval(() => {
      if (!isConnecting) {
        setCallDuration((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isConnecting]);

  const processQueuedCandidates = async (pc: RTCPeerConnection) => {
    while (iceCandidateQueue.current.length > 0) {
      const candidate = iceCandidateQueue.current.shift();
      if (candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Failed to add queued ICE candidate:", err);
        }
      }
    }
  };

  const createPeerConnection = useCallback((localStream: MediaStream) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
      ],
      iceCandidatePoolSize: 10,
    });

    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

      pc.ontrack = (event) => {
        console.log("Track received:", event.track.kind, event.streams);
        const [remoteStreamFromEvent] = event.streams;
        
        if (remoteStreamFromEvent) {
          setRemoteStream(remoteStreamFromEvent);
          
          if (event.track.kind === 'video') {
            setHasRemoteVideo(true);
          }
          
          setIsConnecting(false);
          setConnectionStatus("Connected");
        }
      };


    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await supabase.from("calls").insert({
          caller_id: userId,
          receiver_id: contact.id,
          signal_data: JSON.stringify({ candidate: event.candidate.toJSON() }),
          type: "candidate",
          call_mode: initialCallType
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected') {
        setIsConnecting(false);
        setConnectionStatus("Connected");
      } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        endCall();
      }
    };

    return pc;
  }, [userId, contact.id, initialCallType]);

  useEffect(() => {
    let isMounted = true;

    const startCall = async () => {
      try {
        const constraints = {
          video: initialCallType === "video" ? { facingMode: "user" } : false,
          audio: true
        };

        const localStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isMounted) {
          localStream.getTracks().forEach(t => t.stop());
          return;
        }

        setStream(localStream);
        if (myVideo.current) myVideo.current.srcObject = localStream;

        const pc = createPeerConnection(localStream);
        peerConnection.current = pc;

        if (isInitiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await supabase.from("calls").insert({
            caller_id: userId,
            receiver_id: contact.id,
            signal_data: JSON.stringify({ sdp: pc.localDescription }),
            type: "offer",
            call_mode: initialCallType
          });
        } else if (incomingSignal?.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal.sdp));
          remoteDescriptionSet.current = true;
          await processQueuedCandidates(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await supabase.from("calls").insert({
            caller_id: userId,
            receiver_id: contact.id,
            signal_data: JSON.stringify({ sdp: pc.localDescription }),
            type: "answer",
            call_mode: initialCallType
          });
        }

        const channelId = [userId, contact.id].sort().join('-');
        const channel = supabase.channel(`call-${channelId}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "calls", filter: `receiver_id=eq.${userId}` }, async (payload) => {
            const data = payload.new;
            if (!peerConnection.current) return;
            const signalData = JSON.parse(data.signal_data);

            if (data.type === "answer" && isInitiator && signalData.sdp && !hasAnswered.current) {
              hasAnswered.current = true;
              await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
              remoteDescriptionSet.current = true;
              await processQueuedCandidates(peerConnection.current);
            } else if (data.type === "candidate" && signalData.candidate) {
              if (remoteDescriptionSet.current) {
                await peerConnection.current.addIceCandidate(new RTCIceCandidate(signalData.candidate));
              } else {
                iceCandidateQueue.current.push(signalData.candidate);
              }
            } else if (data.type === "end") {
              endCall();
            }
          })
          .subscribe();
        channelRef.current = channel;

      } catch (err) {
        toast.error("Call setup failed. Check permissions.");
        onClose();
      }
    };

    startCall();
    return () => {
      isMounted = false;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      if (peerConnection.current) {
        peerConnection.current.close();
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const endCall = async () => {
    try {
      await supabase.from("calls").insert({ caller_id: userId, receiver_id: contact.id, type: "end", signal_data: "{}" });
    } catch (e) {}
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    onClose();
  };

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks()[0].enabled = !stream.getAudioTracks()[0].enabled;
      setIsMuted(!stream.getAudioTracks()[0].enabled);
    }
  };

  const toggleVideo = () => {
    if (stream && stream.getVideoTracks()[0]) {
      stream.getVideoTracks()[0].enabled = !stream.getVideoTracks()[0].enabled;
      setIsVideoOff(!stream.getVideoTracks()[0].enabled);
    }
  };

  const toggleSpeaker = () => {
    if (userVideo.current) userVideo.current.muted = !userVideo.current.muted;
    if (remoteAudio.current) remoteAudio.current.muted = !remoteAudio.current.muted;
    setIsSpeakerOn(!isSpeakerOn);
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4">
      <audio ref={remoteAudio} autoPlay playsInline />
      
      <div className="w-full max-w-4xl aspect-video bg-zinc-900 rounded-[3rem] overflow-hidden border border-white/10 relative shadow-2xl">
        {/* Remote Video - Main View */}
        {initialCallType === "video" && (
          <video 
            ref={userVideo} 
            autoPlay 
            playsInline 
            className={`w-full h-full object-cover ${(!remoteStream || !hasRemoteVideo) ? 'hidden' : 'block'}`} 
          />
        )}
        
        {/* Avatar fallback when no remote video */}
        {(!remoteStream || !hasRemoteVideo || initialCallType === "voice") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full animate-pulse" />
              <Avatar className="h-40 w-40 border-4 border-indigo-500/30 relative z-10">
                <AvatarImage src={contact.avatar_url} />
                <AvatarFallback className="text-4xl font-black bg-indigo-900/50">{contact.username?.substring(0,2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </div>
            <h2 className="text-3xl font-black italic mt-8 text-white uppercase tracking-tighter">{contact.username}</h2>
            <p className={`font-bold mt-2 uppercase tracking-widest text-[10px] ${isConnecting ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}>{connectionStatus}</p>
            {!isConnecting && <p className="text-2xl font-black mt-4 font-mono text-white/40">{formatDuration(callDuration)}</p>}
          </div>
        )}

        {/* My Video - Picture in Picture (Always visible for video calls) */}
        {initialCallType === "video" && stream && (
          <div className="absolute bottom-6 right-6 w-40 md:w-48 aspect-video rounded-2xl overflow-hidden border-2 border-indigo-500/50 shadow-2xl z-20 bg-black">
            <video ref={myVideo} autoPlay playsInline muted className="w-full h-full object-cover mirror" style={{ transform: 'scaleX(-1)' }} />
            {isVideoOff && (
              <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
                <CameraOff className="w-8 h-8 text-white/30" />
              </div>
            )}
          </div>
        )}

        {/* Call Duration Overlay */}
        {!isConnecting && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-xl px-6 py-2 rounded-full border border-white/10 z-20">
            <p className="text-lg font-black font-mono text-white/80">{formatDuration(callDuration)}</p>
          </div>
        )}

        {/* Controls */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 md:gap-6 bg-black/60 backdrop-blur-xl p-4 md:p-6 rounded-[2.5rem] border border-white/10 z-30">
          <Button onClick={toggleMute} className={`h-12 w-12 sm:h-16 sm:w-16 rounded-2xl transition-all ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
            {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
          </Button>
          <Button onClick={toggleSpeaker} className={`h-12 w-12 sm:h-16 sm:w-16 rounded-2xl transition-all ${!isSpeakerOn ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
            {isSpeakerOn ?<Volume2 className="w-5 h-5 sm:w-6 sm:h-6" /> : <VolumeX className="w-5 h-5 sm:w-6 sm:h-6" />}
          </Button>
          {initialCallType === "video" && (
            <Button onClick={toggleVideo} className={`h-12 w-12 sm:h-16 sm:w-16 rounded-2xl transition-all ${isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
              {isVideoOff ? <CameraOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Camera className="w-5 h-5 sm:w-6 sm:h-6" />}
            </Button>
          )}
          <Button onClick={endCall} className="h-14 w-14 sm:h-20 sm:w-20 rounded-[2rem] bg-red-500 hover:bg-red-600 shadow-xl shadow-red-500/30">
            <PhoneOff className="w-6 h-6 sm:w-8 sm:h-8" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
