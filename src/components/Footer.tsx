import { Link } from "react-router-dom";
import { Send } from "lucide-react";

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

export function Footer() {
  return (
    <footer className="border-t border-ink/10 bg-paper py-12 mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="font-serif text-xl font-semibold tracking-wide">ALUVANTIS</span>
              <span className="rounded bg-ink/5 px-1.5 py-0.5 font-sans text-[10px] font-semibold tracking-widest uppercase text-accent">
                BLOG
              </span>
            </div>
            <p className="text-sm text-ink-light max-w-xs">
              Aluvantis — Raqamli transformatsiya, strategik rivojlanish, biznes boshqaruvi va ilg'or texnologik innovatsiyalar tahliliy platformasi.
            </p>
          </div>
          
          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-light">Bo'limlar</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/" className="text-sm hover:text-accent transition-colors">Essalar</Link>
              <Link to="/photography" className="text-sm hover:text-accent transition-colors">Fotosuratlar</Link>
              <Link to="/" className="text-sm hover:text-accent transition-colors">Sayohat</Link>
              <Link to="/about" className="text-sm hover:text-accent transition-colors">Haqida</Link>
            </nav>
          </div>
          
          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-light">Ijtimoiy tarmoqlar</h4>
            <nav className="flex flex-col gap-2">
              <a href="https://www.instagram.com/aluvantis?stkn=MWI5Z2N3bjdjYnNwYw==" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm hover:text-accent transition-colors">
                <InstagramIcon className="h-3.5 w-3.5 text-accent" />
                <span>Instagram</span>
              </a>
              <a href="https://t.me/Aluvantis" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm hover:text-accent transition-colors">
                <Send className="h-3.5 w-3.5 text-accent" />
                <span>Telegram</span>
              </a>
            </nav>
          </div>
        </div>
        
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-ink/5 pt-8 sm:flex-row text-center sm:text-left">
          <p className="text-xs text-ink-light">
            &copy; {new Date().getFullYear()} Aluvantis Blog. Barcha huquqlar himoyalangan.
          </p>
        </div>
      </div>
    </footer>
  );
}
