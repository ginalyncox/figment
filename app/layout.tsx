import type { Metadata } from "next";
import Link from "next/link";
import { config } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: config.siteName,
  description: "AI-made videos from independent creators. Watch a few free, then subscribe.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="site-header">
          <Link className="brand" href="/">{config.siteName}</Link>
          <nav aria-label="Main">
            <Link href="/subscribe">Subscribe</Link>
            <Link href="/creator">For creators</Link>
            <Link href="/account">Account</Link>
          </nav>
        </header>
        <main id="main">{children}</main>
        <footer className="site-footer">
          <nav aria-label="Legal">
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/creator-license">Creator license</Link>
            <Link href="/legal/copyright">Copyright</Link>
            <Link href="/legal/removal">Image removal</Link>
            <Link href="/report">Report a video</Link>
          </nav>
          <p>All videos here are made with AI tools. {config.copyrightLine}</p>
        </footer>
      </body>
    </html>
  );
}
