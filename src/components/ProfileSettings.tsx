"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Image as ImageIcon, Shield, Moon, Sun, Monitor, Trash2, LogOut, MapPin, Clock, Plus, Ghost, Sparkles, Key, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AvatarDisplay } from "./AvatarDisplay";
import { AvatarBuilder } from "./AvatarBuilder";
import { useTheme } from "next-themes";

export function ProfileSettings({ profile, onUpdate, onClose }: { profile: any; onUpdate: () => void; onClose: () => void }) {
  const [username, setUsername] = useState(profile.username || "");
  const [fullName, setFullName] = useState(profile.full_name || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [birthdate, setBirthdate] = useState(profile.birthdate || "");
  const [wallpaperUrl, setWallpaperUrl] = useState(profile.wallpaper_url || "");
  const { theme, setTheme } = useTheme();
  const [countdownEnd, setCountdownEnd] = useState(profile.countdown_end || "");
  const [locationEnabled, setLocationEnabled] = useState(profile.location_enabled || false);
  const [ghostMode, setGhostMode] = useState(profile.ghost_mode || false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordReason, setPasswordReason] = useState("");
  const [blockedProfiles, setBlockedProfiles] = useState<any[]>([]);
  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordRequest, setPasswordRequest] = useState<any>(null);
  const [requestingPassword, setRequestingPassword] = useState(false);

  useEffect(() => {
    fetchBlockedProfiles();
    fetchPasswordRequest();
  }, []);

  async function fetchBlockedProfiles() {
    const { data: blockedIds } = await supabase
      .from("blocked_users")
      .select("blocked_id")
      .eq("blocker_id", profile.id);
    
    if (blockedIds && blockedIds.length > 0) {
      const ids = blockedIds.map(b => b.blocked_id);
      const { data } = await supabase.from("profiles").select("*").in("id", ids);
      setBlockedProfiles(data || []);
    }
  }

  async function unblockUser(id: string) {
    const { error } = await supabase
      .from("blocked_users")
      .delete()
      .eq("blocker_id", profile.id)
      .eq("blocked_id", id);
    if (!error) {
      toast.success("User unblocked");
      fetchBlockedProfiles();
    }
  }

  async function fetchPasswordRequest() {
    const { data } = await supabase
      .from("password_change_requests")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    
    if (data) setPasswordRequest(data);
  }

  async function handlePasswordChangeRequest() {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    
    setRequestingPassword(true);
    try {
      const { error: deleteError } = await supabase
        .from("password_change_requests")
        .delete()
        .eq("user_id", profile.id)
        .eq("status", "pending");

      const { error } = await supabase.from("password_change_requests").insert({
        user_id: profile.id,
        new_password_hash: newPassword,
        reason: passwordReason || "User requested password change",
        status: "pending"
      });

      if (error) throw error;
      
      toast.success("Password change request submitted! Waiting for admin approval.");
      setNewPassword("");
      setPasswordReason("");
      fetchPasswordRequest();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setRequestingPassword(false);
    }
  }

  async function cancelPasswordRequest() {
    const { error } = await supabase
      .from("password_change_requests")
      .delete()
      .eq("id", passwordRequest.id);
    
    if (!error) {
      toast.success("Password request cancelled");
      setPasswordRequest(null);
    }
  }

  async function handleUpdate() {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          username,
          full_name: fullName,
          bio,
          birthdate,
          wallpaper_url: wallpaperUrl,
          theme,
          countdown_end: countdownEnd || null,
          location_enabled: locationEnabled,
          ghost_mode: ghostMode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;
      toast.success("Identity updated");
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteData() {
    if (!confirm("Are you sure? This cannot be undone.")) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("messages").delete().eq("sender_id", profile.id);
      if (error) throw error;
      toast.success("All data purged");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteProfile() {
    if (!confirm("Permanently delete account?")) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", profile.id);
      if (error) throw error;
      await supabase.auth.signOut();
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a0a0a] border border-white/10 w-full max-w-lg rounded-[3rem] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh] relative">
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3 text-white">
              <Shield className="w-6 h-6 text-indigo-500" />
              Entity
            </h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mt-1">Persona & Security Matrix</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/20 hover:text-white">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar scroll-smooth">
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <AvatarDisplay profile={profile} className="h-24 w-24 border-4 border-indigo-500/50 shadow-2xl transition-transform group-hover:scale-105" />
              <button 
                onClick={() => setShowAvatarBuilder(true)}
                className="absolute bottom-0 right-0 bg-indigo-600 p-2 rounded-full border-4 border-[#0a0a0a] shadow-xl text-white hover:scale-110 transition-all"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Biological Node ID</p>
          </div>

          <div className="space-y-6">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 flex items-center gap-2">
              <Ghost className="w-3 h-3" /> System Identity
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1">Neural Alias</Label>
                <Input 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-white/[0.03] border-white/10 h-12 rounded-2xl focus:ring-indigo-500/30 font-bold text-white placeholder:text-white/10"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1">Network Handle</Label>
                <Input 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-white/[0.03] border-white/10 h-12 rounded-2xl focus:ring-indigo-500/30 font-bold text-white placeholder:text-white/10"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1">Subconscious Stream (Bio)</Label>
                <Input 
                  value={bio} 
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Input stream data..."
                  className="bg-white/[0.03] border-white/10 h-12 rounded-2xl focus:ring-indigo-500/30 text-white placeholder:text-white/10"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1 flex items-center gap-2">
                  <Key className="w-3 h-3" /> Security Protocol Shift
                </Label>
                
                {passwordRequest?.status === 'pending' ? (
                  <div className="p-5 bg-orange-500/10 border border-orange-500/20 rounded-2xl space-y-3">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
                      <div>
                        <p className="text-xs font-black text-orange-400 uppercase">Shift Pending</p>
                        <p className="text-[9px] text-orange-400/60 font-bold uppercase tracking-widest">Awaiting admin uplink</p>
                      </div>
                    </div>
                    <Button onClick={cancelPasswordRequest} variant="ghost" className="w-full h-10 text-[9px] font-black uppercase tracking-widest text-orange-400 hover:bg-orange-500/10">
                      Abort Request
                    </Button>
                  </div>
                ) : passwordRequest?.status === 'approved' ? (
                  <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <div>
                        <p className="text-xs font-black text-emerald-400 uppercase">Key Rotated</p>
                        <p className="text-[9px] text-emerald-400/60 font-bold uppercase tracking-widest">New authorization active</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Input 
                      type="password"
                      placeholder="Input new access key"
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="bg-white/[0.03] border-white/10 h-12 rounded-2xl focus:ring-indigo-500/30 text-white placeholder:text-white/10"
                    />
                    <Button 
                      onClick={handlePasswordChangeRequest}
                      disabled={requestingPassword || !newPassword}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 rounded-2xl px-6 font-black uppercase text-[10px] tracking-widest text-white shadow-lg shadow-indigo-900/40"
                    >
                      {requestingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : "Request Key Rotation"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
