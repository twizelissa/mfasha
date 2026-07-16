import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FormFlo - Automate Google Form Responses",
  description: "Generate realistic, randomized survey responses for Google Forms in seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Script src="https://accounts.google.com/gsi/client" strategy="beforeInteractive" />
        <AuthProvider>
          <Navbar />
          <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8">
            {children}
          </main>
          <footer className="border-t border-zinc-800/50 py-6 text-center text-xs text-zinc-500">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 px-6">
              <span>&copy; {new Date().getFullYear()} FormFlo. All rights reserved.</span>
              <div className="flex gap-4">
                <a href="#" className="hover:text-zinc-300">Privacy Policy</a>
                <a href="#" className="hover:text-zinc-300">Terms of Service</a>
                <a href="#" className="hover:text-zinc-300">Contact Support</a>
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
