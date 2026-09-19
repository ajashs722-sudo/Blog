export interface Author {
  name: string;
  avatar: string;
  bio: string;
  twitter?: string;
  instagram?: string;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string;
  youtubeUrl?: string;
  videoUrl?: string;
  mediaGallery?: string[];
  quote?: { text: string; author?: string };
  date: string;
  readTime: string;
  author: Author;
  tags: string[];
  content?: string;
}

export const defaultAuthor: Author = {
  name: "Anvar",
  avatar: "/author.png",
  bio: "Aluvantis kompaniyasi asoschisi va bosh direktori (CEO). Raqamli transformatsiya, strategik rivojlanish, innovatsiyalar va biznes tahlillari sohasidagi ekspert.",
  instagram: "aluvantis"
};

// Real database initialized as empty array — all articles dynamically fetched from Telegram group database
export const articles: Article[] = [
  {
    id: "post_1",
    slug: "aluvantis-strategiyasi-2026",
    title: "Aluvantis Rivojlanish Strategiyasi: Raqamli Kelajak Sari Qadam",
    excerpt: "Zamonaviy raqamli bozorda kompaniyalarni texnologik transformatsiya qilish, samaradorlikni oshirish va Aluvantis-ning 2026-yildagi global rejalari.",
    coverImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1200&h=630&fit=crop",
    date: "18 Sentabr, 2026",
    readTime: "5 min o'qish",
    tags: ["Rivojlanish", "Biznes Strategiyasi"],
    author: defaultAuthor,
    content: "Bugungi kunda har bir biznes muvaffaqiyati uning texnologiyaga qanchalik tez moslashishiga bog'liq. Aluvantis sifatida biz mijozlarimizga va hamkorlarimizga eng ilg'or raqamli yechimlarni taqdim etishda davom etamiz.\n\nKompaniyamizning 2026-yildagi strategiyasi sun'iy intellekt, katta hajmdagi ma'lumotlar (Big Data) tahlili va bulutli infratuzilmalarni biznes jarayonlariga integratsiya qilishga qaratilgan. Ushbu maqolamizda an'anaviy biznes modellarini qanday qilib yuqori rentabelli raqamli ekotizimga aylantirish sirlarini tahlil qilamiz."
  },
  {
    id: "post_2",
    slug: "ai-biznesda-samaradorlik",
    title: "Biznesda Sun'iy Intellekt: Yangi Davr Integratsiyasi va Tahlil",
    excerpt: "AI texnologiyalari orqali operatsion xarajatlarni qisqartirish, qaror qabul qilish tezligini oshirish va mijozlarga xizmat ko'rsatishni avtomatlashtirish.",
    coverImage: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&h=630&fit=crop",
    date: "17 Sentabr, 2026",
    readTime: "4 min o'qish",
    tags: ["Texnologiya", "Innovatsiyalar"],
    author: defaultAuthor,
    content: "Sun'iy intellekt endilikda shunchaki trend emas, balki biznes omon qolishining muhim shartidir. AI vositalari yordamida korporatsiyalar katta hajmdagi ma'lumotlarni daqiqalar ichida qayta ishlab, kelajakdagi bozor tendensiyalarini bashorat qilmoqdalar.\n\nAluvantis tahlilchilarining fikriga ko'ra, AIdan to'g'ri foydalanish operatsion samaradorlikni kamida 35% ga oshiradi. Maqolada korporativ boshqaruvda sun'iy intellekt agentlarini qanday qilib joriy qilish va xodimlarning intellektual salohiyatini oshirish usullari yoritilgan."
  },
  {
    id: "post_3",
    slug: "investitsiya-va-innovatsiyalar-bozori",
    title: "Investitsiya va Innovatsiyalar: Zamonaviy Bozorda Muvaffaqiyat",
    excerpt: "Istiqbolli startaplar va yuqori texnologiyali loyihalarga investitsiya kiritish tendensiyalari, venchur kapitali va Aluvantis investitsiya yo'nalishlari.",
    coverImage: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?q=80&w=1200&h=630&fit=crop",
    date: "16 Sentabr, 2026",
    readTime: "6 min o'qish",
    tags: ["Investitsiyalar", "Moliya"],
    author: defaultAuthor,
    content: "Raqobatbardosh bo'lib qolish uchun kompaniyalar doimiy ravishda innovatsiyalarga sarmoya kiritishlari kerak. Moliya bozoridagi so'nggi o'zgarishlar shuni ko'rsatadiki, sarmoyadorlar faqat barqaror va raqamli asosga ega bo'lgan loyihalarni afzal ko'rmoqdalar.\n\nAluvantis investitsiya portfeli har doim kelajak texnologiyalariga yo'naltirilgan. Ushbu maqolada global venchur bozori, texnologik loyihalarni baholash mezonlari va Aluvantis taklif etayotgan moliyaviy yechimlar haqida batafsil ma'lumot beriladi."
  }
];

export interface TagCount {
  tag: string;
  count: number;
}

export function getAllTags(): TagCount[] {
  const counts = new Map<string, number>();
  articles.forEach((article) => {
    article.tags?.forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function getArticlesByTag(tag: string): Article[] {
  if (!tag) return articles;
  const normalized = tag.toLowerCase().trim();
  return articles.filter((article) =>
    article.tags?.some((t) => t.toLowerCase() === normalized)
  );
}
