import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "uz" | "ru";

type Dict = Record<string, { uz: string; ru: string }>;

export const dict = {
  "nav.home": { uz: "Bosh sahifa", ru: "Главная" },
  "nav.market": { uz: "Marketplace", ru: "Маркетплейс" },
  "nav.feed": { uz: "Lenta", ru: "Лента" },
  "nav.garage": { uz: "Garaj", ru: "Гараж" },
  "nav.orders": { uz: "Buyurtmalar", ru: "Заказы" },
  "nav.profile": { uz: "Profil", ru: "Профиль" },
  "nav.cart": { uz: "Savat", ru: "Корзина" },
  "nav.create": { uz: "Yaratish", ru: "Создать" },

  "common.search": { uz: "Detal, OEM yoki mahsulotni qidiring…", ru: "Деталь, OEM или товар…" },
  "common.all": { uz: "Barchasi", ru: "Все" },
  "common.viewAll": { uz: "Hammasini ko'rish", ru: "Смотреть все" },
  "common.addToCart": { uz: "Savatga", ru: "В корзину" },
  "common.buyNow": { uz: "Hozir sotib olish", ru: "Купить сейчас" },
  "common.inStock": { uz: "Sotuvda", ru: "В наличии" },
  "common.pcs": { uz: "dona", ru: "шт" },
  "common.back": { uz: "Orqaga", ru: "Назад" },
  "common.next": { uz: "Davom etish", ru: "Далее" },
  "common.save": { uz: "Saqlash", ru: "Сохранить" },
  "common.cancel": { uz: "Bekor qilish", ru: "Отмена" },
  "common.empty": { uz: "Hozircha bo'sh", ru: "Пока пусто" },
  "common.sellers": { uz: "Sotuvchilar", ru: "Продавцы" },
  "common.delivery": { uz: "Yetkazib berish", ru: "Доставка" },
  "common.warranty": { uz: "Kafolat", ru: "Гарантия" },
  "common.reviews": { uz: "Sharhlar", ru: "Отзывы" },
  "common.total": { uz: "Jami", ru: "Итого" },
  "common.quantity": { uz: "Soni", ru: "Количество" },
  "common.remove": { uz: "O'chirish", ru: "Удалить" },

  "fit.yes": { uz: "Mashinangizga mos keladi", ru: "Подходит вашему авто" },
  "fit.check": { uz: "Moslikni tekshirish kerak", ru: "Требует проверки" },
  "fit.no": { uz: "Mos kelmaydi", ru: "Не подходит" },
  "fit.short": { uz: "Mos keladi", ru: "Подходит" },
  "fit.filter": { uz: "Mening mashinamga mos", ru: "Подходит моей машине" },

  "home.question": { uz: "Mashinam uchun nima kerak?", ru: "Что нужно моей машине?" },
  "home.forYourCar": { uz: "Mashinangiz uchun", ru: "Для вашей машины" },
  "home.explore": { uz: "Mos mahsulotlar", ru: "Подходящие товары" },
  "home.openGarage": { uz: "Garajni ochish", ru: "Открыть гараж" },
  "home.categories": { uz: "Kategoriyalar", ru: "Категории" },
  "home.trending": { uz: "Trendda", ru: "В тренде" },
  "home.nearby": { uz: "Yaqin sotuvchilar", ru: "Продавцы рядом" },
  "home.deals": { uz: "Chegirmalar", ru: "Скидки" },
  "home.fromFeed": { uz: "Lentadan", ru: "Из ленты" },
  "home.noCar": { uz: "Mashinangizni qo'shing", ru: "Добавьте свою машину" },
  "home.noCarSub": {
    uz: "Mashinangizni qo'shsangiz, faqat mos keladigan detallarni ko'rasiz.",
    ru: "Добавьте машину — и увидите только подходящие детали.",
  },
  "home.addCar": { uz: "Mashina qo'shish", ru: "Добавить машину" },

  "garage.title": { uz: "Garaj", ru: "Гараж" },
  "garage.mine": { uz: "Mening mashinalarim", ru: "Мои машины" },
  "garage.compatible": { uz: "Mos mahsulotlar", ru: "Подходящие товары" },
  "garage.maintenance": { uz: "Texnik xizmat", ru: "Обслуживание" },
  "garage.edit": { uz: "Tahrirlash", ru: "Редактировать" },
  "garage.setActive": { uz: "Asosiy qilish", ru: "Сделать основной" },
  "garage.active": { uz: "Asosiy mashina", ru: "Основная машина" },
  "garage.add": { uz: "Mashina qo'shish", ru: "Добавить машину" },
  "garage.ready": { uz: "Mashinangiz tayyor.", ru: "Ваша машина готова." },

  "add.brand": { uz: "Marka", ru: "Марка" },
  "add.model": { uz: "Model", ru: "Модель" },
  "add.year": { uz: "Yil", ru: "Год" },
  "add.engine": { uz: "Dvigatel", ru: "Двигатель" },
  "add.transmission": { uz: "Uzatmalar qutisi", ru: "Коробка передач" },
  "add.vin": { uz: "VIN (ixtiyoriy)", ru: "VIN (необязательно)" },
  "add.confirm": { uz: "Tasdiqlash", ru: "Подтверждение" },
  "add.finish": { uz: "Garajga qo'shish", ru: "Добавить в гараж" },
  "add.step": { uz: "Qadam", ru: "Шаг" },

  "market.title": { uz: "Marketplace", ru: "Маркетплейс" },
  "market.results": { uz: "natija", ru: "результатов" },
  "market.filters": { uz: "Filtrlar", ru: "Фильтры" },
  "market.price": { uz: "Narx", ru: "Цена" },
  "market.brand": { uz: "Brend", ru: "Бренд" },
  "market.sort": { uz: "Saralash", ru: "Сортировка" },
  "market.sortPopular": { uz: "Ommabop", ru: "Популярные" },
  "market.sortCheap": { uz: "Arzon", ru: "Дешевле" },
  "market.sortExpensive": { uz: "Qimmat", ru: "Дороже" },
  "market.sortRating": { uz: "Reyting", ru: "Рейтинг" },
  "market.nothing": { uz: "Hech narsa topilmadi", ru: "Ничего не найдено" },

  "product.oem": { uz: "OEM raqami", ru: "OEM номер" },
  "product.otherSellers": { uz: "Boshqa sotuvchilar", ru: "Другие продавцы" },
  "product.compare": { uz: "Sotuvchilarni solishtirish", ru: "Сравнить продавцов" },
  "product.specs": { uz: "Xususiyatlar", ru: "Характеристики" },
  "product.fits": { uz: "Mos mashinalar", ru: "Подходит для" },

  "feed.title": { uz: "Lenta", ru: "Лента" },
  "feed.shop": { uz: "Mahsulotni ko'rish", ru: "Смотреть товар" },
  "feed.follow": { uz: "Obuna", ru: "Подписаться" },
  "feed.following": { uz: "Obuna bo'lingan", ru: "Вы подписаны" },

  "cart.title": { uz: "Savat", ru: "Корзина" },
  "cart.empty": { uz: "Savat bo'sh", ru: "Корзина пуста" },
  "cart.emptySub": {
    uz: "Mashinangizga mos detallarni qo'shing.",
    ru: "Добавьте детали, подходящие вашей машине.",
  },
  "cart.checkout": { uz: "Rasmiylashtirish", ru: "Оформить заказ" },
  "cart.subtotal": { uz: "Mahsulotlar", ru: "Товары" },

  "checkout.title": { uz: "Rasmiylashtirish", ru: "Оформление" },
  "checkout.contact": { uz: "Aloqa", ru: "Контакты" },
  "checkout.name": { uz: "Ism", ru: "Имя" },
  "checkout.phone": { uz: "Telefon", ru: "Телефон" },
  "checkout.address": { uz: "Manzil", ru: "Адрес" },
  "checkout.city": { uz: "Shahar / tuman", ru: "Город / район" },
  "checkout.payment": { uz: "To'lov", ru: "Оплата" },
  "checkout.cash": { uz: "Yetkazishda naqd", ru: "Наличными при доставке" },
  "checkout.card": { uz: "Karta (Uzcard / Humo)", ru: "Карта (Uzcard / Humo)" },
  "checkout.place": { uz: "Buyurtma berish", ru: "Оформить заказ" },
  "checkout.required": { uz: "Bu maydon to'ldirilishi kerak", ru: "Заполните это поле" },
  "checkout.phoneInvalid": { uz: "Telefon raqami noto'g'ri", ru: "Неверный номер телефона" },
  "checkout.done": { uz: "Buyurtma qabul qilindi", ru: "Заказ принят" },

  "orders.title": { uz: "Buyurtmalar", ru: "Заказы" },
  "orders.empty": { uz: "Buyurtmalar yo'q", ru: "Заказов пока нет" },
  "orders.status.new": { uz: "Qabul qilindi", ru: "Принят" },
  "orders.status.packed": { uz: "Yig'ilmoqda", ru: "Собирается" },
  "orders.status.shipped": { uz: "Yo'lda", ru: "В пути" },
  "orders.status.delivered": { uz: "Yetkazildi", ru: "Доставлен" },
  "orders.advance": { uz: "Holatni yangilash", ru: "Обновить статус" },

  "profile.wishlist": { uz: "Saqlanganlar", ru: "Избранное" },
  "profile.settings": { uz: "Sozlamalar", ru: "Настройки" },
  "profile.language": { uz: "Til", ru: "Язык" },
} as unknown as Dict;

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "uz",
  setLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("uz");

  useEffect(() => {
    const stored = localStorage.getItem("motora.lang");
    if (stored === "uz" || stored === "ru") setLangState(stored);
  }, []);

  const value = useMemo(
    () => ({
      lang,
      setLang: (l: Lang) => {
        setLangState(l);
        localStorage.setItem("motora.lang", l);
      },
    }),
    [lang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

export function useT() {
  const { lang } = useLang();
  return (key: string) => dict[key]?.[lang] ?? key;
}

export function pick(lang: Lang, uz: string, ru: string) {
  return lang === "uz" ? uz : ru;
}
