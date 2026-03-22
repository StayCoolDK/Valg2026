'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X, BarChart3 } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';

const NAV_ITEMS = [
  { href: '/#blokoversigt', label: 'Overblik' },
  { href: '/#partier', label: 'Partier' },
  { href: '/#meningsmaalinger', label: 'Målinger' },
  { href: '/#prognose', label: 'Prognose' },
  { href: '/#koalitioner', label: 'Koalitioner' },
  { href: '/#historik', label: 'Historik' },
  { href: '/#metodologi', label: 'Metodologi' },
  { href: '/valgaften', label: 'Valgaften' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    const hashIndex = href.indexOf('#');
    if (hashIndex === -1) return; // plain link, let it navigate normally

    e.preventDefault();
    const id = href.slice(hashIndex + 1);

    const scrollToId = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

    if (pathname === '/') {
      scrollToId();
    } else {
      router.push('/');
      // Wait for the page to render before scrolling
      setTimeout(scrollToId, 300);
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg mr-8">
          <BarChart3 className="h-5 w-5 text-primary" />
          <span>Valg 2026</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => handleNavClick(e, item.href)}
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent cursor-pointer"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Mobile nav */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="md:hidden inline-flex items-center justify-center rounded-md text-sm font-medium h-9 w-9 hover:bg-accent">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </SheetTrigger>
          <SheetContent side="right" className="w-64">
            <SheetTitle className="text-lg font-bold mb-4">Navigation</SheetTitle>
            <nav className="flex flex-col gap-2">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => { handleNavClick(e, item.href); setOpen(false); }}
                  className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent cursor-pointer"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
