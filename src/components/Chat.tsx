"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Send, Plus, Camera, Image as ImageIcon, MapPin, 
    Video, Mic, X, Download, Shield, AlertTriangle,
    Eye, EyeOff, Save, Trash2, ShieldCheck, Lock,
    Sparkles, Zap, ChevronLeft, Phone, Check, CheckCheck, ArrowLeft,
    MoreVertical, Trash, Star, Heart, ThumbsUp, Smile, Wow, Sad,
    Volume2, VolumeX, Minimize2, Maximize2, CameraOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AvatarDisplay } from "./AvatarDisplay";

interface ChatProps {
  session: any;
  privateKey?: CryptoKey;
  initialContact: any;
  isPartnerOnline?: boolean;
  onBack?: () => void;
  onInitiateCall: (contact: any, mode: "video" | "voice") => void;
}

export function Chat({ session, privateKey, initialContact, isPartnerOnline, onBack, onInitiateCall }: ChatProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [showOptions, setShowOptions] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [partnerPresence, setPartnerPresence] = useState<{
    isOnline: boolean;
    isInChat: boolean;
    isTyping: boolean;
  }>({ isOnline: false, isInChat: false, isTyping: false });
  const [isFocused, setIsFocused] = useState(true);
  const [showSnapshotView, setShowSnapshotView] = useState<any>(null);
  const [snapshotViewMode, setSnapshotViewMode] = useState<"view" | "save">("view");
  const [showSaveToVault, setShowSaveToVault] = useState<any>(null);
  const [vaultPassword, setVaultPassword] = useState("");
  const [longPressedMessage, setLongPressedMessage] = useState<any>(null);
  const [showMenu, setShowMenu] = useState(false);
  
  // Persistence for auto-delete mode
  const [autoDeleteMode, setAutoDeleteMode] = useState<"none" | "view" | "3h">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`chatify_auto_delete_${session.user.id}`);
      return (saved as any) || "none";
    }
    return "none";
  });

  useEffect(() => {
    localStorage.setItem(`chatify_auto_delete_${session.user.id}`, autoDeleteMode);
  }, [autoDeleteMode, session.user.id]);

  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  // Camera stream handling to prevent black screen
  useEffect(() => {
    let active = true;
    if (showCamera && stream && videoRef.current) {
      const video = videoRef.current;
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      
      const playVideo = async () => {
        try {
          if (video.paused) {
            await video.play();
          }
        } catch (e) {
          console.error("Snapshot camera play failed:", e);
        }
      };

      video.onloadedmetadata = () => {
        if (active) playVideo();
      };

      if (video.readyState >= 2 && active) {
        playVideo();
      }
    }
    return () => { active = false; };
  }, [showCamera, stream]);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (msg: any) => {
    longPressTimerRef.current = setTimeout(() => {
      setLongPressedMessage(msg);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchMove = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => {
    const handleBlur = () => setIsFocused(false);
    const handleFocus = () => setIsFocused(true);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    if (!isFocused && showSnapshotView) {
      toast.error("Security Alert: Unauthorized access attempt detected. Snapshot obscured.");
    }
  }, [isFocused, showSnapshotView]);

  async function saveToVault(message: any) {
    if (!vaultPassword) {
      toast.error("Enter vault password to authorize storage");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("vault_password")
      .eq("id", session.user.id)
      .single();

    if (profile?.vault_password !== vaultPassword) {
      toast.error("Invalid Vault Password");
      return;
    }

    toast.loading("Transferring intelligence to vault...");

    const { error } = await supabase.from("vault_items").insert({
      user_id: session.user.id,
      type: 'photo',
      file_url: message.media_url,
      file_name: `vault-${Date.now()}.jpg`,
      metadata: { source: 'chat', sender_id: message.sender_id }
    });

    toast.dismiss();
    if (error) {
      toast.error("Vault transfer failed");
    } else {
      toast.success("Intelligence secured in vault");
      setShowSaveToVault(null);
      setVaultPassword("");
    }
  }

  async function toggleSaveChat(message: any) {
    const isSaved = message.is_saved;
    const { error } = await supabase
      .from("messages")
      .update({ is_saved: !isSaved })
      .eq("id", message.id);
    
    if (error) {
      toast.error("Failed to update status");
    } else {
      setMessages(prev => prev.map(m => m.id === message.id ? { ...m, is_saved: !isSaved } : m));
      toast.success(!isSaved ? "Message saved in chat" : "Message unsaved");
    }
    setLongPressedMessage(null);
  }

  async function reactToMessage(message: any, reaction: string) {
    const reactions = message.reactions || {};
    reactions[session.user.id] = reaction;
    
    const { error } = await supabase
      .from("messages")
      .update({ reactions })
      .eq("id", message.id);
    
    if (error) {
      toast.error("Failed to react");
    } else {
      setMessages(prev => prev.map(m => m.id === message.id ? { ...m, reactions } : m));
    }
    setLongPressedMessage(null);
  }

  useEffect(() => {
    if (!initialContact || !session.user) return;

    const userIds = [session.user.id, initialContact.id].sort();
    const channelName = `presence-chat-${userIds[0]}-${userIds[1]}`;

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: session.user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const partnerState: any = state[initialContact.id];
        
        if (partnerState && partnerState.length > 0) {
          const latest = partnerState[partnerState.length - 1];
          setPartnerPresence({
            isOnline: true,
            isInChat: latest.current_chat_id === session.user.id,
            isTyping: latest.is_typing === true,
          });
        } else {
          setPartnerPresence({ isOnline: false, isInChat: false, isTyping: false });
        }
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (key === initialContact.id) {
          const latest = newPresences[newPresences.length - 1];
          setPartnerPresence({
            isOnline: true,
            isInChat: latest.current_chat_id === session.user.id,
            isTyping: latest.is_typing === true,
          });
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key === initialContact.id) {
          setPartnerPresence({ isOnline: false, isInChat: false, isTyping: false });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
            current_chat_id: initialContact.id,
            is_typing: isTyping
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [initialContact, session.user, isTyping]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isTyping) setIsTyping(false);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [newMessage]);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!isTyping) setIsTyping(true);
  };

  useEffect(() => {
    if (initialContact) {
      fetchMessages();
      const subscription = subscribeToMessages();
      
      const cleanupInterval = setInterval(async () => {
        await supabase.rpc('purge_viewed_content');
        fetchMessages();
      }, 60000);

      return () => {
        supabase.removeChannel(subscription);
        clearInterval(cleanupInterval);
      };
    }
  }, [initialContact]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  async function deleteMessage(id: string) {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) {
      toast.error("Failed to purge intelligence packet");
    } else {
      setMessages(prev => prev.filter(m => m.id !== id));
      toast.success("Intelligence purged from node");
    }
  }

  async function fetchMessages() {
    setLoading(true);
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${session.user.id},receiver_id.eq.${initialContact.id}),and(sender_id.eq.${initialContact.id},receiver_id.eq.${session.user.id})`)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Failed to sync neural link");
    } else {
      setMessages(data || []);
      
      const unviewed = data?.filter(m => m.receiver_id === session.user.id && !m.is_viewed) || [];
      if (unviewed.length > 0) {
        const ids = unviewed.map(m => m.id);
        await supabase.from("messages").update({ 
          is_viewed: true, 
          viewed_at: new Date().toISOString() 
        }).in("id", ids);
      }
    }
    setLoading(false);
  }

  function subscribeToMessages() {
    return supabase
      .channel(`chat-${initialContact.id}`)
      .on("postgres_changes", { 
        event: "INSERT", 
        schema: "public", 
        table: "messages",
        filter: `receiver_id=eq.${session.user.id}`
      }, async (payload) => {
        if (payload.new.sender_id === initialContact.id) {
          setMessages(prev => [...prev, payload.new]);
          
          await supabase.from("messages").update({ 
            is_delivered: true,
            delivered_at: new Date().toISOString()
          }).eq("id", payload.new.id);

          if (payload.new.media_type === 'snapshot') {
            toast.info("Secure Snapshot Received", {
              description: "A one-time view intelligence packet has arrived.",
              icon: <Camera className="w-4 h-4 text-purple-500" />
            });
          }
        }
      })
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "messages"
    }, (payload) => {
      setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
    })
    .subscribe();
  }

  useEffect(() => {
    if (partnerPresence.isOnline) {
      const markDelivered = async () => {
        const undelivered = messages.filter(m => m.sender_id === session.user.id && !m.is_delivered);
        if (undelivered.length > 0) {
          const ids = undelivered.map(m => m.id);
          await supabase.from("messages").update({ 
            is_delivered: true, 
            delivered_at: new Date().toISOString() 
          }).in("id", ids);
        }
      };
      markDelivered();
    }
  }, [partnerPresence.isOnline, messages.length]);

  async function sendMessage(mediaType: string = "text", mediaUrl: string | null = null) {
    if (!newMessage.trim() && !mediaUrl) return;

    const messageData: any = {
      sender_id: session.user.id,
      receiver_id: initialContact.id,
      encrypted_content: newMessage.trim() || " ", 
      media_type: mediaType,
      media_url: mediaUrl,
      is_viewed: false,
      is_delivered: partnerPresence.isOnline,
      delivered_at: partnerPresence.isOnline ? new Date().toISOString() : null,
      expires_at: autoDeleteMode === "3h" ? new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() : null,
      is_view_once: autoDeleteMode === "view"
    };

    if (mediaType === 'snapshot') {
      messageData.view_count = 0;
      messageData.is_view_once = true;
    }

    const { data, error } = await supabase.from("messages").insert(messageData).select();

    if (error) {
      console.error("Transmission error:", error);
      toast.error("Packet transmission failed: " + (error.message || "Protocol Error"));
    } else {
      const sentMsg = data?.[0] || messageData;
      setMessages(prev => [...prev, sentMsg]);
      setNewMessage("");
      setShowOptions(false);
    }
  }

  const sendLocation = async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }

    toast.loading("Acquiring satellite coordinates...");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
      toast.dismiss();
      await sendMessage("location", url);
      toast.success("Coordinates deployed");
    }, (err) => {
      toast.dismiss();
      toast.error("Signal lost: Location access denied");
    });
  };

  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }, 
        audio: false 
      });
      setStream(s);
      setShowCamera(true);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
        };
      }
    } catch (err) {
      console.error("Camera error:", err);
      toast.error("Camera access denied or failed");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const fileName = `snapshot-${Date.now()}.jpg`;
      const filePath = `chat/${session.user.id}/${fileName}`;
      
      toast.loading("Securing snapshot...");
      const { error } = await supabase.storage.from("chat-media").upload(filePath, blob);
      if (error) {
        toast.dismiss();
        toast.error("Upload failed");
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(filePath);
      toast.dismiss();
      await sendMessage("snapshot", publicUrl);
      toast.success("Snapshot deployed");
      stopCamera();
    }, 'image/jpeg');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isSnapshot: boolean = false, type: "image" | "video" | "audio" = "image") => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `chat/${session.user.id}/${fileName}`;

    toast.loading(isSnapshot ? "Securing snapshot..." : `Uploading ${type} packet...`);

    const { error: uploadError } = await supabase.storage
      .from("chat-media")
      .upload(filePath, file);

    if (uploadError) {
      toast.dismiss();
      toast.error("Upload failed");
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("chat-media")
      .getPublicUrl(filePath);

    toast.dismiss();
    await sendMessage(isSnapshot ? "snapshot" : type, publicUrl);
    toast.success(isSnapshot ? "Snapshot deployed" : `${type.charAt(0).toUpperCase() + type.slice(1)} transmitted`);
  };

  const openSnapshot = async (message: any) => {
    // Strictly 2 views limit for receiver
    const views = message.view_count || 0;
    
    if (message.receiver_id === session.user.id && views >= 2) {
      toast.error("Snapshot expired: Intelligence purged");
      return;
    }
    
    setShowSnapshotView(message);
    
    if (message.receiver_id === session.user.id) {
      const newViews = views + 1;
      const isNowPurged = newViews >= 2;
      
      const { error } = await supabase.from("messages").update({ 
        is_viewed: isNowPurged,
        view_count: newViews,
        viewed_at: new Date().toISOString()
      }).eq("id", message.id);

      if (!error) {
        setMessages(prev => prev.map(m => m.id === message.id ? { ...m, is_viewed: isNowPurged, view_count: newViews } : m));
      }
    }
  };

  const closeSnapshot = async () => {
    setShowSnapshotView(null);
  };

  const saveToDevice = async (url: string, name: string = "nexus-media") => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${name}-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success("Intelligence saved to device");
    } catch (err) {
      toast.error("Download failed: Protocol error");
    }
  };

  if (!initialContact) return null;

  return (
    <div className="flex flex-col h-full bg-[#030303] relative overflow-hidden select-none" onContextMenu={(e) => e.preventDefault()}>
      <style jsx global>{`
        @media print { body { display: none; } }
        .no-screenshot {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
        }
      `}</style>

      {/* Header */}
      <header className="h-20 border-b border-white/5 bg-black/40 backdrop-blur-3xl flex items-center justify-between px-6 z-20 shrink-0">
          <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onBack} 
                className="text-white/20 hover:text-white mr-1 lg:hidden bg-white/5 rounded-xl border border-white/5"
              >
                <ArrowLeft className="w-6 h-6" />
              </Button>
              {onBack && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onBack} 
                  className="text-white/20 hover:text-white mr-2 hidden lg:flex"
                >
                  <ArrowLeft className="w-6 h-6" />
                </Button>
              )}
        <AvatarDisplay profile={initialContact} className="h-10 w-10 ring-2 ring-indigo-500/20" />
          <div>
            <h3 className="text-sm font-black italic tracking-tighter uppercase text-white">{initialContact.username}</h3>
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${(isPartnerOnline ?? partnerPresence.isOnline) ? 'bg-blue-500 animate-pulse' : 'bg-zinc-600'}`} />
        <span className={`text-[8px] font-black uppercase tracking-widest ${(isPartnerOnline ?? partnerPresence.isOnline) ? 'text-blue-400' : 'text-zinc-500'}`}>
          {(isPartnerOnline ?? partnerPresence.isOnline) ? 'Online' : 'Offline'}
        </span>
      </div>
          </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => onInitiateCall(initialContact, "voice")} className="text-white/20 hover:text-white hover:bg-white/5 rounded-xl"><Phone className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => onInitiateCall(initialContact, "video")} className="text-white/20 hover:text-white hover:bg-white/5 rounded-xl"><Video className="w-4 h-4" /></Button>
        <div className="relative">
          <Button variant="ghost" size="icon" onClick={() => setShowMenu(!showMenu)} className="text-white/20 hover:text-white hover:bg-white/5 rounded-xl"><MoreVertical className="w-4 h-4" /></Button>
          <AnimatePresence>
            {showMenu && (
              <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 top-12 w-48 bg-zinc-900 border border-white/10 rounded-2xl p-2 shadow-2xl z-50">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30 px-3 py-2">Auto-Delete Protocol</p>
                {[
                  { id: "none", label: "No Auto-Delete" },
                  { id: "view", label: "Delete After View" },
                  { id: "3h", label: "Delete After 3 Hours" }
                ].map(opt => (
                  <button key={opt.id} onClick={() => { setAutoDeleteMode(opt.id as any); setShowMenu(false); }} className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${autoDeleteMode === opt.id ? 'bg-indigo-600 text-white' : 'text-white/60 hover:bg-white/5'}`}>
                    {opt.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>

    {/* Messages */}
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 no-screenshot">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full opacity-20">
          <ShieldCheck className="w-12 h-12 mb-4" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em]">End-to-End Encrypted</p>
        </div>
      ) : (
        messages.map((msg, i) => {
          const isMe = msg.sender_id === session.user.id;
          const reactions = msg.reactions || {};
          const reactionCounts = Object.values(reactions).reduce((acc: any, curr: any) => {
            acc[curr] = (acc[curr] || 0) + 1;
            return acc;
          }, {});

            return (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, x: isMe ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex ${isMe ? "justify-end" : "justify-start"} touch-none`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setLongPressedMessage(msg);
                }}
                onTouchStart={() => handleTouchStart(msg)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
                onMouseDown={() => handleTouchStart(msg)}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
              >
              <div className={`max-w-[80%] flex flex-col ${isMe ? "items-end" : "items-start"} relative`}>
                {msg.media_type === 'snapshot' ? (
                  <button 
                    onClick={() => openSnapshot(msg)}
                    className={`group relative p-4 rounded-[2rem] border transition-all ${
                      msg.view_count >= 2 && !isMe 
                        ? "bg-zinc-900/50 border-white/5 opacity-50 cursor-not-allowed" 
                        : "bg-purple-600/10 border-purple-500/30 hover:bg-purple-600/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                        {msg.view_count >= 2 && !isMe ? <EyeOff className="w-5 h-5 text-purple-400" /> : <Camera className="w-5 h-5 text-purple-400" />}
                      </div>
                      <div className="text-left">
                          <p className="text-[10px] font-black uppercase tracking-widest text-white">Snapshot</p>
                          <p className="text-[8px] font-bold text-purple-400 uppercase tracking-tighter">
                            {msg.view_count >= 2 && !isMe ? "Purged" : `${msg.is_saved ? 'Saved' : 'Viewable'}`}
                          </p>
                        </div>
                      </div>
                    </button>
                ) : msg.media_type === 'image' ? (
                    <div className="group relative rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl">
                      <img src={msg.media_url} alt="" className="max-w-full max-h-80 object-cover" />
                    </div>
                  ) : msg.media_type === 'location' ? (
                    <div className={`p-5 rounded-[2rem] border transition-all ${
                      isMe ? "bg-emerald-600 border-emerald-500 shadow-lg shadow-emerald-600/20" : "bg-white/[0.03] border-white/5"
                    }`}>
                      <div className="flex items-center gap-4">
                        <MapPin className="w-6 h-6 text-white animate-pulse" />
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-white">Live Satellite Link</p>
                          <Button variant="link" onClick={() => window.open(msg.media_url, '_blank')} className="text-white font-bold p-0 h-auto underline text-[10px] uppercase tracking-tighter">Open Satellite View</Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                        <div className={`group/msg relative p-5 rounded-[2rem] text-sm font-medium leading-relaxed transition-all ${
                        msg.is_saved 
                          ? "bg-[#FCFCFA]/80 backdrop-blur-md text-amber-900 border border-amber-400/50 shadow-[0_10px_20px_rgba(251,191,36,0.1)]" 
                          : isMe 
                          ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/10" 
                          : "bg-white/[0.03] border border-white/5 text-white/90"
                      }`}>
                        {msg.encrypted_content}
                        {msg.is_saved && <Star className="absolute -top-2 -right-2 w-5 h-5 text-amber-500 fill-amber-500" />}
                      </div>
                  )}

                  {/* Reactions Display */}
                  {Object.keys(reactionCounts).length > 0 && (
                    <div className={`flex gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {Object.entries(reactionCounts).map(([reaction, count]: [any, any]) => (
                        <div key={reaction} className="bg-white/10 border border-white/5 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="text-xs">{reaction}</span>
                          <span className="text-[8px] font-black text-white/40">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}

                    <div className="flex items-center gap-2 mt-2 px-2">
                      <span className="text-[7px] font-black uppercase tracking-widest text-white/10">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                          {isMe && (
                            <div className="flex items-center">
                              {msg.is_viewed ? (
                                <CheckCheck className="w-2.5 h-2.5 text-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                              ) : msg.is_delivered ? (
                                <CheckCheck className="w-2.5 h-2.5 text-white/90" />
                              ) : (
                                <Check className="w-2.5 h-2.5 text-zinc-600" />
                              )}
                            </div>
                          )}
                    </div>
                </div>
              </motion.div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      <AnimatePresence>
        {partnerPresence.isTyping && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-6 py-2 flex items-center gap-3"
          >
            <div className="relative">
              <AvatarDisplay profile={initialContact} className="h-6 w-6" />
              <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full border border-[#030303] animate-pulse" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black italic uppercase tracking-widest text-blue-400">Typing</span>
              <div className="flex gap-0.5">
                <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-0.5 h-0.5 bg-blue-400 rounded-full" />
                <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-0.5 h-0.5 bg-blue-400 rounded-full" />
                <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-0.5 h-0.5 bg-blue-400 rounded-full" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <footer className="p-6 bg-black/40 backdrop-blur-3xl border-t border-white/5 relative z-30 shrink-0">
        <div className="flex items-center gap-3 relative">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowOptions(!showOptions)}
            className={`h-12 w-12 rounded-2xl transition-all ${showOptions ? 'bg-indigo-600 text-white rotate-45' : 'bg-white/5 text-white/20'}`}
          >
            <Plus className="w-6 h-6" />
          </Button>
          
            <input 
              value={newMessage}
              onChange={handleTyping}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type intelligence packet..."
              className="flex-1 bg-white/[0.03] border border-white/10 rounded-[2rem] h-12 px-6 text-sm font-medium outline-none focus:border-indigo-500/50 transition-all placeholder:text-white/10"
            />

          <Button 
            onClick={() => sendMessage()}
            disabled={!newMessage.trim()}
            className="h-12 w-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 disabled:opacity-20"
          >
            <Send className="w-5 h-5" />
          </Button>

          <AnimatePresence>
            {showOptions && (
              <motion.div initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.9 }} className="absolute bottom-20 left-0 w-64 bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-4 shadow-2xl z-50 overflow-hidden">
                <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col items-center justify-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-indigo-600/10 hover:border-indigo-500/30 transition-all cursor-pointer group">
                      <ImageIcon className="w-6 h-6 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Photo</span>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, false, "image")} />
                    </label>
                    
                      <button onClick={startCamera} className="flex flex-col items-center justify-center p-4 bg-purple-600/5 border border-purple-500/20 rounded-2xl hover:bg-purple-600/20 hover:border-purple-500/40 transition-all group">
                        <Camera className="w-6 h-6 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Snapshot</span>
                      </button>

                      <button onClick={sendLocation} className="flex flex-col items-center justify-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-emerald-600/10 hover:border-emerald-500/30 transition-all group">
                        <MapPin className="w-6 h-6 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Location</span>
                      </button>

                    <label className="flex flex-col items-center justify-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-indigo-600/10 hover:border-indigo-500/30 transition-all cursor-pointer group">
                      <Video className="w-6 h-6 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Video</span>
                      <input type="file" className="hidden" accept="video/*" onChange={(e) => handleFileUpload(e, false, "video")} />
                    </label>

                    <label className="flex flex-col items-center justify-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-indigo-600/10 hover:border-indigo-500/30 transition-all cursor-pointer group">
                      <Mic className="w-6 h-6 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Audio</span>
                      <input type="file" className="hidden" accept="audio/*" onChange={(e) => handleFileUpload(e, false, "audio")} />
                    </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </footer>

        {/* Long Press Menu */}
        <AnimatePresence>
          {longPressedMessage && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6" 
              onClick={() => setLongPressedMessage(null)}
            >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }} 
                  animate={{ scale: 1, y: 0 }} 
                  className="bg-[#0a0a0a]/90 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-8 w-full max-w-sm space-y-8 shadow-[0_50px_100px_rgba(0,0,0,0.8)]" 
                  onClick={e => e.stopPropagation()}
                >
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500/50 text-center">Neural Reactions</p>
                    <div className="flex justify-between gap-2 overflow-x-auto pb-4 no-scrollbar">
                      {['❤️', '👍', '😂', '😮', '😢', '🔥', '✨', '💯'].map(emoji => (
                        <button 
                          key={emoji} 
                          onClick={() => reactToMessage(longPressedMessage, emoji)} 
                          className="text-4xl hover:scale-125 transition-transform p-2 active:scale-90 grayscale-[0.5] hover:grayscale-0"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button 
                      onClick={() => toggleSaveChat(longPressedMessage)} 
                      className={`w-full h-16 rounded-[1.5rem] border font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-3 ${
                        longPressedMessage.is_saved 
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.1)]' 
                          : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:border-amber-500/20 hover:text-amber-500'
                      }`}
                    >
                      <Star className={`w-5 h-5 ${longPressedMessage.is_saved ? 'fill-amber-500' : ''}`} />
                      {longPressedMessage.is_saved ? 'Unsave from Chat' : 'Save to Chat'}
                    </Button>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <Button 
                        onClick={() => setShowSaveToVault(longPressedMessage)} 
                        className="h-16 rounded-[1.5rem] bg-indigo-500/5 border border-indigo-500/20 text-indigo-400 font-black uppercase tracking-widest text-[9px] hover:bg-indigo-500/10 transition-all flex items-center justify-center gap-2"
                      >
                        <Shield className="w-4 h-4" /> Vault
                      </Button>
                      <Button 
                        onClick={() => deleteMessage(longPressedMessage.id)} 
                        className="h-16 rounded-[1.5rem] bg-red-500/5 border border-red-500/20 text-red-500 font-black uppercase tracking-widest text-[9px] hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
                      >
                        <Trash className="w-4 h-4" /> Purge
                      </Button>
                    </div>
                  </div>
                </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      {/* Camera Modal */}
      <AnimatePresence>
        {showCamera && (
            <div className="fixed inset-0 z-[150] bg-black flex flex-col items-center justify-center">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute bottom-10 flex gap-10 items-center">
              <Button onClick={stopCamera} variant="ghost" className="bg-white/10 hover:bg-white/20 rounded-full h-16 w-16"><X className="w-8 h-8 text-white" /></Button>
              <button onClick={capturePhoto} className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center"><div className="w-14 h-14 rounded-full bg-white" /></button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Snapshot Modal */}
      <AnimatePresence>
        {showSnapshotView && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black backdrop-blur-3xl flex items-center justify-center p-6">
            <div className={`relative w-full max-w-2xl aspect-[3/4] bg-black rounded-[3rem] overflow-hidden border border-white/10 flex flex-col transition-all duration-500 ${!isFocused ? 'blur-3xl opacity-50' : 'blur-0 opacity-100'}`}>
              <div className="flex-1 relative">
                <img src={showSnapshotView.media_url} alt="" className="w-full h-full object-contain pointer-events-none select-none" />
                {!isFocused && (
                  <div className="absolute inset-0 flex items-center justify-center z-50">
                    <div className="bg-black/80 backdrop-blur-md p-8 rounded-[2rem] border border-white/10 text-center">
                      <Lock className="w-12 h-12 text-red-500 mx-auto mb-4 animate-pulse" />
                      <p className="text-xl font-black italic text-white uppercase tracking-tighter">Privacy Lock Active</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-10 bg-black/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-between">
                <div>
                  <h4 className="text-xl font-black italic text-white uppercase tracking-tighter">Temporal Snapshot</h4>
                  <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mt-1">2 Views Limit Applied</p>
                </div>
                  <div className="flex gap-4">
                    <Button onClick={() => saveToDevice(showSnapshotView.media_url, "snapshot-intel")} variant="ghost" className="h-16 px-8 bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 border border-amber-500/30 rounded-2xl font-black tracking-widest text-[10px] uppercase">
                      <Save className="w-4 h-4 mr-3" /> Save Snapshot
                    </Button>
                    <Button onClick={closeSnapshot} variant="ghost" className="h-16 px-8 bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/30 rounded-2xl font-black tracking-widest text-[10px] uppercase">
                      <X className="w-4 h-4 mr-3" /> Close Snapshot
                    </Button>
                  </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vault Password Modal */}
      <AnimatePresence>
        {showSaveToVault && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-10 rounded-[3rem] space-y-8">
              <div className="text-center space-y-2">
                <Shield className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
                <h3 className="text-2xl font-black uppercase italic">Vault Authorization</h3>
              </div>
              <Input type="password" placeholder="Enter Vault Password" value={vaultPassword} onChange={(e) => setVaultPassword(e.target.value)} className="h-14 bg-zinc-800 border-zinc-700 rounded-2xl px-6 text-center tracking-widest" />
              <div className="flex gap-4">
                <Button variant="ghost" onClick={() => setShowSaveToVault(null)} className="flex-1 h-14 rounded-2xl uppercase font-bold text-[10px]">Cancel</Button>
                <Button onClick={() => saveToVault(showSaveToVault)} className="flex-1 h-14 rounded-2xl bg-indigo-600 uppercase font-bold text-[10px]">Secure Intel</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
