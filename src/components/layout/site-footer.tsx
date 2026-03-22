export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30 mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>
            Valg 2026 &mdash; Uafhængig valgprognose baseret på offentlige meningsmålinger
          </p>
          <p>
            Data fra Voxmeter, Epinion, Megafon, Verian, YouGov m.fl. &middot;{' '}
            <a
              href="https://github.com"
              className="underline hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open source
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
