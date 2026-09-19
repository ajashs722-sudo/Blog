import { motion } from "motion/react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { defaultAuthor } from "../data/articles";
import { FadeImage } from "../components/FadeImage";
import { SEOHead } from "../components/SEOHead";

export function About() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SEOHead
        title="Anvar (CEO) — Aluvantis Kompaniyasi Haqida"
        description={defaultAuthor.bio}
        image={defaultAuthor.avatar}
        type="website"
        keywords={["Anvar", "CEO Aluvantis", "Aluvantis kompaniyasi", "biznes strategiya", "bosh direktor"]}
      />
      <Header />
      <main className="flex-1">
        <article className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col md:flex-row gap-12 lg:gap-20 items-start"
          >
            <div className="w-full md:w-1/2">
              <div className="aspect-[4/5] overflow-hidden rounded-sm bg-ink/5 sticky top-24">
                <FadeImage 
                  src={defaultAuthor.avatar} 
                  alt={defaultAuthor.name} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            
            <div className="w-full md:w-1/2 flex flex-col justify-center pt-8 md:pt-0">
              <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-medium text-ink mb-8 tracking-tight">
                Anvar Haqida
              </h1>
              <div className="prose prose-stone prose-lg prose-p:leading-relaxed prose-p:text-ink-light">
                <p className="text-2xl font-serif italic text-ink mb-8 leading-snug">
                  {defaultAuthor.bio}
                </p>
                <p>
                  Men Aluvantis kompaniyasi asoschisi sifatida, jadal rivojlanayotgan raqamli bozor, investitsiyalar, sun'iy intellekt va innovatsion biznes strategiyalarini tahlil qilish hamda ulashish uchun ushbu professional platformani ishga tushirdim. Biznes olamidagi katta tezlik va raqamli transformatsiya davrida to'g'ri strategik qarorlar qabul qilish har qachongidan muhimroqdir.
                </p>
                <p>
                  O'z tajribamiz va tahliliy maqolalarimiz orqali ilg'or global texnologiyalar, biznes boshqaruvi, investitsiyalar va raqamli ekotizimlar yaratish san'atini o'rganamiz va yoritamiz. Maqsadimiz — har bir tadbirkor va biznes vakiliga zamonaviy texnologik imkoniyatlardan maksimal foydalanish yo'llarini ko'rsatib berishdir.
                </p>
                <p>
                  Aluvantis tahliliy portalida bo'lganingiz uchun tashakkur. Umid qilamanki, bu yerda chop etilayotgan korporativ yangiliklar va biznes tahlillari kompaniyangizni yanada yuqori bosqichga ko'tarishda va raqamli kelajakni qurishda sizga ishonchli yo'lboshchi bo'ladi.
                </p>
              </div>
              
              <div className="mt-16 pt-12 border-t border-ink/10">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink mb-6">Aloqa va Savollar</h3>
                <div className="flex flex-col gap-4">
                  <a href="https://www.instagram.com/aluvantis?stkn=MWI5Z2N3bjdjYnNwYw==" target="_blank" rel="noreferrer" className="text-ink-light hover:text-accent transition-colors font-medium">Instagram: aluvantis</a>
                  <a href="https://t.me/Aluvantis" target="_blank" rel="noreferrer" className="text-ink-light hover:text-accent transition-colors font-medium">Telegram: @Aluvantis</a>
                </div>
              </div>
            </div>
          </motion.div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
