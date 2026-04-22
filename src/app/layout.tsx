import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/language-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "X Bookmarks Manager",
  description: "Fetch and categorize your X bookmarks",
};

// Runs before React hydrates so the html already has .dark + data-lang
// applied. Prevents a flash of light theme or wrong-language copy.
const initScript = `(function(){try{
var t=localStorage.getItem('theme');
if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark');
var l=localStorage.getItem('lang');
if(l!=='en'&&l!=='zh'){var nv=(navigator.language||'').toLowerCase();l=nv.indexOf('zh')===0?'zh':'en';}
document.documentElement.setAttribute('data-lang',l);
document.documentElement.lang=l==='zh'?'zh-CN':'en';
}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
