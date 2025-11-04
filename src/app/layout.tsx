import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import AuthButtons from "@/components/AuthButtons";
import { AuthProvider } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Words of Wisdom - Save Sentences You Want to Remember",
  description: "Save sentences you want to remember. Review them regularly and let them grow in your memory.",
  keywords: ["words of wisdom", "memory", "vocabulary", "review", "remember", "study"],
  authors: [{ name: "Words of Wisdom" }],
  openGraph: {
    title: "Words of Wisdom - Save Sentences You Want to Remember",
    description: "Save sentences you want to remember. Review them regularly and let them grow in your memory.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get user information from server
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-slate-100`}
      >
        <AuthProvider initialUser={user}>
          <header className="bg-neutral-900 border-b border-neutral-800 shadow-sm">
            <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
              <nav className="flex items-center gap-5 text-[15px] font-medium">
                <Link className="text-slate-100 hover:underline underline-offset-4" href="/">Home</Link>
                <Link className="text-slate-100 hover:underline underline-offset-4" href="/notes">Notes</Link>
              </nav>
              <AuthButtons />
            </div>
          </header>
          <main className="max-w-4xl mx-auto p-5 sm:p-7 leading-relaxed">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
