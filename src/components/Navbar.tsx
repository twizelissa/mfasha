"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const pathname = usePathname();
  const { user, loginWithGoogle, logout, isLoading } = useAuth();

  return (
    <nav className="sticky top-0 z-50 glass border-b border-[#222222] backdrop-blur-md px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <span className="font-tight font-black text-lg tracking-widest text-[#F5F1EA] group-hover:text-primary transition-colors flex items-center gap-1">
            MF<span className="text-primary font-light">▲</span>SHA
          </span>
        </Link>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-8 font-sans text-xs font-semibold text-[#a39c8e]">
          <Link href="/" className="hover:text-white transition-colors">
            Platform
          </Link>
          <Link href="/#features" className="hover:text-white transition-colors">
            Features
          </Link>
          <Link href="/#specs" className="hover:text-white transition-colors">
            Specifications
          </Link>
        </div>

        {/* User Info / CTA */}
        <div className="flex items-center gap-4">
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-t-white border-transparent rounded-full animate-spin" />
          ) : user ? (
            <div className="flex items-center gap-3">
              {/* Quota indicator */}
              <div className="hidden sm:flex flex-col items-end text-[9px] font-mono leading-tight">
                <span className="text-muted-foreground">QUOTA_REMAINING</span>
                <span className="font-bold text-primary">
                  {user.email.toLowerCase() === "twizelissa@gmail.com" ? (
                    "UNLIMITED"
                  ) : (
                    `${Math.max(0, user.quotaLimit - user.quotaUsed)} / ${user.quotaLimit}`
                  )}
                </span>
              </div>
              
              {/* User Avatar & Dropdown */}
              <div className="flex items-center gap-3 pl-3 border-l border-border">
                <Link
                  href="/dashboard"
                  className="text-xs font-semibold text-white hover:text-primary transition-colors"
                >
                  Dashboard
                </Link>
                <img
                  src={user.image}
                  alt={user.name}
                  className="w-7 h-7 rounded-full border border-border"
                />
                <button
                  onClick={logout}
                  className="text-[9px] font-mono bg-transparent hover:bg-accent-coral/10 text-muted-foreground hover:text-accent-coral px-3 py-1.5 border border-border hover:border-accent-coral transition-all cursor-pointer uppercase tracking-wider"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={loginWithGoogle}
              className="flex items-center gap-1.5 bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold px-5 py-2.5 rounded-full transition-all duration-300 shadow-md active:scale-98 cursor-pointer"
            >
              Sign In <span className="font-light">→</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
