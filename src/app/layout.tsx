import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { Analytics } from "@vercel/analytics/next";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://chatly-stream.vercel.app";
const description =
  "Chatly is a real-time messaging app with direct chats, groups, media sharing, and message tracking, built on Next.js and Firebase.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Chatly | Real-time messaging", template: "%s | Chatly" },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Chatly",
    title: "Chatly | Real-time messaging",
    description,
    url: siteUrl,
  },
  twitter: { card: "summary", title: "Chatly | Real-time messaging", description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <head>
        {/* Inline theme script — prevents flash of unstyled content */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var c=document.cookie.split('; ').find(function(r){return r.indexOf('theme=')===0})?.split('=')[1];var x=t||c||'light';document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(x==='dark'?'dark':'light');document.documentElement.style.colorScheme=x==='dark'?'dark':'light'}catch(e){document.documentElement.classList.add('light');document.documentElement.style.colorScheme='light'}})()`,
          }}
        />
      </head>
      <body className={`${inter.variable} font-inter bg-background text-foreground`}>
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}

