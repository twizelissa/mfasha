"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const pathname = usePathname();
  const { user, loginWithGoogle, logout, isLoading } = useAuth();

  return (
    <nav className="sticky top-0 z-50 glass border-b border-zinc-800/50 backdrop-blur-md px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            FF
          </div>
          <span className="font-semibold text-lg tracking-tight text-white group-hover:text-indigo-400 transition-colors">
            FormFlo
          </span>
        </Link>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            href="/"
            className={`text-sm font-medium transition-colors ${
              pathname === "/" ? "text-indigo-400" : "text-zinc-400 hover:text-white"
            }`}
          >
            Home
          </Link>
          <Link
            href="/dashboard"
            className={`text-sm font-medium transition-colors ${
              pathname === "/dashboard" ? "text-indigo-400" : "text-zinc-400 hover:text-white"
            }`}
          >
            Dashboard
          </Link>
          {user?.email === "twizelissa@gmail.com" && (
            <Link
              href="/admin"
              className={`text-sm font-medium transition-colors ${
                pathname === "/admin" ? "text-indigo-400" : "text-zinc-400 hover:text-white"
              }`}
            >
              Admin Panel
            </Link>
          )}
        </div>

        {/* User Info / CTA */}
        <div className="flex items-center gap-4">
          {isLoading ? (
            <div className="w-8 h-8 rounded-full border border-t-indigo-500 border-zinc-800 animate-spin" />
          ) : user ? (
            <div className="flex items-center gap-3">
              {/* Quota indicator */}
              <div className="hidden sm:flex flex-col items-end text-xs">
                <span className="text-zinc-400">Free Quota</span>
                <span className="font-semibold text-indigo-400">
                  {Math.max(0, user.quotaLimit - user.quotaUsed)} / {user.quotaLimit} left
                </span>
              </div>
              
              {/* User Avatar & Dropdown */}
              <div className="flex items-center gap-2 pl-2 border-l border-zinc-800">
                <img
                  src={user.image}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border border-zinc-700"
                />
                <button
                  onClick={logout}
                  className="text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white px-3 py-1.5 rounded-md border border-zinc-800 transition-all"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={loginWithGoogle}
              className="flex items-center gap-2 bg-white hover:bg-zinc-100 text-zinc-900 text-sm font-semibold px-4 py-2 rounded-lg transition-all shadow-md active:scale-95"
            >
              {/* Google logo svg */}
              <svg className="w-4 h-4" viewBox="0 0 24 24" width="24" height="24">
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
              Login with Google
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
