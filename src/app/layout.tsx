import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Valg 2026 — Dansk Valgprognose',
    template: '%s | Valg 2026',
  },
  description:
    'Den ultimative valgprognose for folketingsvalget 2026. Meningsmålinger, mandatberegninger, koalitionsscenarier og Monte Carlo-simuleringer.',
  keywords: [
    'folketingsvalg',
    'valg 2026',
    'meningsmålinger',
    'valgprognose',
    'danmark',
    'mandater',
    'blokpolitik',
  ],
  openGraph: {
    title: 'Valg 2026 — Dansk Valgprognose',
    description:
      'Den ultimative valgprognose for folketingsvalget 2026.',
    locale: 'da_DK',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="da"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </TooltipProvider>
      </body>
    </html>
  );
}
