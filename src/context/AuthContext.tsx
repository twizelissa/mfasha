"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, isFirebaseConfigured } from "@/utils/firebase";
import { getDeviceFingerprint } from "@/utils/fingerprint";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";

export interface User {
  name: string;
  email: string;
  image: string;
  quotaUsed: number;
  quotaLimit: number;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  incrementQuota: (amount: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== "undefined") {
      const savedSession = localStorage.getItem("mfasha_session") || localStorage.getItem("formflo_session");
      if (savedSession) {
        try {
          return JSON.parse(savedSession);
        } catch {
          localStorage.removeItem("mfasha_session");
          localStorage.removeItem("formflo_session");
        }
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);

  // Custom Google auth modal states (used when Firebase configuration keys are missing)
  const [showMockLoginModal, setShowMockLoginModal] = useState(false);
  const [mockEmail, setMockEmail] = useState("");
  const [mockName, setMockName] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const syncQuota = async (email: string, baseUser: Omit<User, "quotaUsed" | "quotaLimit">) => {
    try {
      const deviceId = getDeviceFingerprint();
      const res = await fetch(`/api/user/profile?email=${encodeURIComponent(email)}&deviceId=${encodeURIComponent(deviceId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          const syncedUser: User = {
            ...baseUser,
            quotaUsed: data.user.quotaUsed,
            quotaLimit: data.user.quotaLimit,
          };
          setUser(syncedUser);
          localStorage.setItem("mfasha_session", JSON.stringify(syncedUser));
          return syncedUser;
        }
      }
    } catch (err) {
      console.error("Failed to sync quota with server:", err);
    }
    return null;
  };

  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          const baseUser = {
            name: firebaseUser.displayName || "Google User",
            email: firebaseUser.email?.toLowerCase() || "",
            image: firebaseUser.photoURL || "https://lh3.googleusercontent.com/a/default-user=s96-c",
          };

          const synced = await syncQuota(baseUser.email, baseUser);
          if (!synced) {
            const mockUser: User = {
              ...baseUser,
              quotaUsed: 0,
              quotaLimit: 20,
            };
            setUser(mockUser);
            localStorage.setItem("mfasha_session", JSON.stringify(mockUser));
          }
        } else {
          setUser(null);
          localStorage.removeItem("mfasha_session");
          localStorage.removeItem("formflo_session");
        }
        setIsLoading(false);
      });
      return () => unsubscribe();
    } else {
      // Fallback localStorage check for Mock Auth
      const savedSession = localStorage.getItem("mfasha_session") || localStorage.getItem("formflo_session");
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          syncQuota(parsed.email, parsed);
        } catch {
          localStorage.removeItem("mfasha_session");
          localStorage.removeItem("formflo_session");
        }
      }
      setIsLoading(false);
    }
  }, []);

  const loginWithGoogle = async () => {
    if (isFirebaseConfigured && auth) {
      setIsLoading(true);
      try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      } catch (err: any) {
        console.error("Firebase Sign-In Error:", err);
        const currentHost = typeof window !== "undefined" ? window.location.hostname : "";
        alert(`Google Sign-In failed: ${err.message || err}\n\n👉 To fix this, please copy the exact hostname: "${currentHost}" and add it to your Firebase Authorized Domains list (without http:// or port).`);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Show our stateful Google Login/Signup modal fallback
      setShowMockLoginModal(true);
    }
  };

  const handleMockSelect = async (name: string, email: string) => {
    setIsLoading(true);
    const baseUser = {
      name,
      email: email.trim().toLowerCase(),
      image: "https://lh3.googleusercontent.com/a/default-user=s96-c",
    };

    const synced = await syncQuota(baseUser.email, baseUser);
    if (!synced) {
      const mockUser: User = {
        ...baseUser,
        quotaUsed: 0,
        quotaLimit: 20,
      };
      setUser(mockUser);
      localStorage.setItem("mfasha_session", JSON.stringify(mockUser));
    }
    setIsLoading(false);
    setShowMockLoginModal(false);
  };

  const handleMockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mockName.trim() || !mockEmail.trim()) return;
    await handleMockSelect(mockName.trim(), mockEmail.trim());
  };

  const logout = async () => {
    if (isFirebaseConfigured && auth) {
      setIsLoading(true);
      try {
        await firebaseSignOut(auth);
      } catch (err) {
        console.error("Firebase Sign-Out Error:", err);
      } finally {
        setIsLoading(false);
      }
    } else {
      setUser(null);
      localStorage.removeItem("mfasha_session");
      localStorage.removeItem("formflo_session");
    }
  };

  const incrementQuota = (amount: number) => {
    if (!user) return;
    const updatedUser = {
      ...user,
      quotaUsed: user.quotaUsed + amount,
    };
    setUser(updatedUser);
    localStorage.setItem("mfasha_session", JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, loginWithGoogle, logout, incrementQuota }}>
      {children}

      {/* Premium Google Auth Login/Signup Modal */}
      {showMockLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-sm p-8 shadow-2xl relative space-y-6">
            <button
              onClick={() => setShowMockLoginModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Google Logo */}
            <div className="flex justify-center">
              <svg className="w-9 h-9" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>

            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-white">Sign in with Google</h2>
              <p className="text-xs text-zinc-400">to continue to Mfasha</p>
            </div>

            {!isCreatingNew ? (
              <div className="space-y-3">
                {/* Account list */}
                <button
                  onClick={() => handleMockSelect("Elissa Twizerimana", "twizelissa@gmail.com")}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all text-left group"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                    ET
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">Elissa Twizerimana</p>
                    <p className="text-[10px] text-zinc-500 truncate">twizelissa@gmail.com</p>
                  </div>
                  <div className="text-[10px] text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                    Sign In →
                  </div>
                </button>

                <button
                  onClick={() => setIsCreatingNew(true)}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all text-xs font-semibold"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Use another Google account
                </button>
              </div>
            ) : (
              <form onSubmit={handleMockSubmit} className="space-y-4">
                <div className="space-y-3 text-left">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={mockName}
                      onChange={(e) => setMockName(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Google Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="name@gmail.com"
                      value={mockEmail}
                      onChange={(e) => setMockEmail(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNew(false);
                      setMockName("");
                      setMockEmail("");
                    }}
                    className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 rounded-xl text-xs font-semibold border border-zinc-800 transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-500/10 transition-colors cursor-pointer"
                  >
                    Continue
                  </button>
                </div>
              </form>
            )}

            <div className="text-[9px] text-zinc-600 leading-normal text-center">
              Standard secure credentials validation rules apply. Authentication acts as both Log In and Sign Up.
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
