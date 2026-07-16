"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

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
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncQuota = async (email: string, baseUser: Omit<User, "quotaUsed" | "quotaLimit">) => {
    try {
      const res = await fetch(`/api/user/profile?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          const syncedUser: User = {
            ...baseUser,
            quotaUsed: data.user.quotaUsed,
            quotaLimit: data.user.quotaLimit
          };
          setUser(syncedUser);
          localStorage.setItem("formflo_session", JSON.stringify(syncedUser));
          return syncedUser;
        }
      }
    } catch (err) {
      console.error("Failed to sync quota with server:", err);
    }
    return null;
  };

  useEffect(() => {
    const savedSession = localStorage.getItem("formflo_session");
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        setUser(parsed);
        // Async fetch latest quota from server in background
        syncQuota(parsed.email, parsed);
      } catch (e) {
        localStorage.removeItem("formflo_session");
      }
    }
    setIsLoading(false);
  }, []);

  const loginWithGoogle = async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (typeof window !== "undefined" && (window as any).google?.accounts?.id && clientId) {
      setIsLoading(true);

      const handleCredentialResponse = async (response: any) => {
        try {
          const base64Url = response.credential.split(".")[1];
          const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
          const jsonPayload = decodeURIComponent(
            window
              .atob(base64)
              .split("")
              .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
              .join("")
          );

          const decoded = JSON.parse(jsonPayload);
          const baseUser = {
            name: decoded.name || "Google User",
            email: decoded.email.toLowerCase(),
            image: decoded.picture || "https://lh3.googleusercontent.com/a/default-user=s96-c"
          };

          const synced = await syncQuota(baseUser.email, baseUser);
          if (!synced) {
            const mockUser: User = {
              ...baseUser,
              quotaUsed: 0,
              quotaLimit: 20
            };
            setUser(mockUser);
            localStorage.setItem("formflo_session", JSON.stringify(mockUser));
          }
        } catch (err) {
          console.error("Failed to parse Google credential:", err);
          alert("Google Sign-In failed. Please try again.");
        } finally {
          setIsLoading(false);
        }
      };

      try {
        (window as any).google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          ux_mode: "popup"
        });

        // Initialize standard token client to trigger google account chooser prompt
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "openid profile email",
          callback: async (tokenResponse: any) => {
            if (tokenResponse && tokenResponse.access_token) {
              try {
                const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                });
                const profile = await profileRes.json();
                const baseUser = {
                  name: profile.name || "Google User",
                  email: profile.email.toLowerCase(),
                  image: profile.picture || "https://lh3.googleusercontent.com/a/default-user=s96-c"
                };

                const synced = await syncQuota(baseUser.email, baseUser);
                if (!synced) {
                  const mockUser: User = {
                    ...baseUser,
                    quotaUsed: 0,
                    quotaLimit: 20
                  };
                  setUser(mockUser);
                  localStorage.setItem("formflo_session", JSON.stringify(mockUser));
                }
              } catch (err) {
                console.error(err);
              } finally {
                setIsLoading(false);
              }
            } else {
              setIsLoading(false);
            }
          }
        });
        client.requestAccessToken({ prompt: "select_account" });
      } catch (err) {
        console.error("Failed to initialize Google login:", err);
        setIsLoading(false);
      }
    } else {
      // Fallback popup if Client ID is not configured (specifically prefilled for twizelissa@gmail.com)
      const email = prompt(
        "Real Google Sign-In is simulated because NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured in your environment.\n\nEnter an email address to choose an account:",
        "twizelissa@gmail.com"
      );

      if (email && email.trim()) {
        setIsLoading(true);
        const namePart = email.split("@")[0];
        const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        const baseUser = {
          name: formattedName,
          email: email.trim().toLowerCase(),
          image: "https://lh3.googleusercontent.com/a/default-user=s96-c"
        };

        const synced = await syncQuota(baseUser.email, baseUser);
        if (!synced) {
          const mockUser: User = {
            ...baseUser,
            quotaUsed: 0,
            quotaLimit: 20
          };
          setUser(mockUser);
          localStorage.setItem("formflo_session", JSON.stringify(mockUser));
        }
        setIsLoading(false);
      }
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("formflo_session");
  };

  const incrementQuota = (amount: number) => {
    if (!user) return;
    const updatedUser = {
      ...user,
      quotaUsed: user.quotaUsed + amount
    };
    setUser(updatedUser);
    localStorage.setItem("formflo_session", JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, loginWithGoogle, logout, incrementQuota }}>
      {children}
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
