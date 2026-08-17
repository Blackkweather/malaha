import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { NavLinks } from '@/components/NavLinks';

export const metadata: Metadata = {
  title: 'Malaga Prospect Finder',
  description: 'Finds the strongest potential website and design clients in Malaga, Spain.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ground text-ink antialiased">
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 border-b border-line bg-ground/85 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center gap-8 px-6 py-4">
              <Link href="/" className="group flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-[13px] font-bold text-[#05202e]">
                  M
                </span>
                <span className="text-[15px] font-semibold tracking-tight">
                  Prospect Finder
                  <span className="ml-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-dim">
                    Malaga
                  </span>
                </span>
              </Link>
              <NavLinks />
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">{children}</main>

          <footer className="border-t border-line px-6 py-6">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-[12px] text-ink-dim">
              <span>Built on public business information. Scope locked to Malaga city.</span>
              <span className="font-mono">search reads the precomputed index only</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
