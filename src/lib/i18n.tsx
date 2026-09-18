import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "uz" | "ru";

type Entry = { uz: string; ru: string };
type Dict = Record<string, Entry>;

/**
 * Uzbek Latin is the primary language; Russian ships alongside it.
 *
 * Keys are grouped by surface. English can be added as a third field without
 * touching a single component — that is the whole point of keeping strings here
 * rather than inline.
 */
export const dict = {
  "nav.home": { uz: "Bosh sahifa", ru: "Главная" },
  "nav.market": { uz: "Katalog", ru: "Каталог" },
  "nav.feed": { uz: "Feed", ru: "Лента" },
  "nav.garage": { uz: "Garaj", ru: "Гараж" },
  "nav.orders": { uz: "Buyurtmalar", ru: "Заказы" },
  "nav.profile": { uz: "Profil", ru: "Профиль" },
  "nav.cart": { uz: "Savat", ru: "Корзина" },
  "nav.create": { uz: "Qo'shish", ru: "Добавить" },
  "nav.wishlist": { uz: "Saqlanganlar", ru: "Избранное" },

  "common.search": { uz: "Detal, OEM yoki mahsulotni qidiring…", ru: "Деталь, OEM или товар…" },
  "common.all": { uz: "Barchasi", ru: "Все" },
  "common.viewAll": { uz: "Barchasini ko'rish", ru: "Смотреть все" },
  "common.addToCart": { uz: "Savatga qo'shish", ru: "В корзину" },
  "common.buyNow": { uz: "Hoziroq olish", ru: "Купить сейчас" },
  "common.inStock": { uz: "Omborda bor", ru: "В наличии" },
  "common.outOfStock": { uz: "Omborda yo'q", ru: "Нет в наличии" },
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
  "common.loading": { uz: "Yuklanmoqda…", ru: "Загрузка…" },
  "common.retry": { uz: "Qayta urinish", ru: "Повторить" },
  "common.months": { uz: "oy", ru: "мес" },
  "common.free": { uz: "Bepul", ru: "Бесплатно" },
  "common.optional": { uz: "ixtiyoriy", ru: "необязательно" },

  "error.generic": {
    uz: "Nimadir xato ketdi. Birozdan so'ng qayta urinib ko'ring.",
    ru: "Что-то пошло не так. Попробуйте позже.",
  },
  "error.offline": { uz: "Internet aloqasi yo'q.", ru: "Нет соединения с интернетом." },
  "error.notFound": { uz: "Topilmadi", ru: "Не найдено" },

  "fit.yes": { uz: "Mashinangizga mos keladi", ru: "Подходит вашему авто" },
  "fit.check": { uz: "Moslikni tekshirish kerak", ru: "Требует проверки" },
  "fit.no": { uz: "Mos kelmaydi", ru: "Не подходит" },
  "fit.short": { uz: "Mos keladi", ru: "Подходит" },
  "fit.filter": { uz: "Mashinamga mos", ru: "Подходит моей машине" },
  "fit.source.OEM_CATALOG": { uz: "Rasmiy katalog bo'yicha", ru: "По официальному каталогу" },
  "fit.source.MANUFACTURER": { uz: "Ishlab chiqaruvchi ma'lumoti", ru: "Данные производителя" },
  "fit.source.STRUCTURED": { uz: "Katalog ma'lumoti", ru: "Данные каталога" },
  "fit.source.SELLER": { uz: "Sotuvchi ma'lumoti", ru: "Данные продавца" },
  "fit.source.AI_INFERENCE": {
    uz: "AI taxmini — tasdiqlanmagan",
    ru: "Предположение ИИ — не подтверждено",
  },

  "home.question": { uz: "Mashinangiz uchun aniq tanlov", ru: "Точный выбор для вашей машины" },
  "home.forYourCar": { uz: "Mashinangizga mos", ru: "Подходит вашей машине" },
  "home.explore": { uz: "O'xshash mahsulotlar", ru: "Похожие товары" },
  "home.openGarage": { uz: "Garajni ochish", ru: "Открыть гараж" },
  "home.categories": { uz: "Kategoriyalar", ru: "Категории" },
  "home.trending": { uz: "Trendda", ru: "В тренде" },
  "home.nearby": { uz: "Ishonchli sotuvchilar", ru: "Надёжные продавцы" },
  "home.deals": { uz: "Chegirmalar", ru: "Скидки" },
  "home.fromFeed": { uz: "Feeddan", ru: "Из ленты" },
  "home.noCar": { uz: "Mashinangizni qo'shing", ru: "Добавьте свою машину" },
  "home.noCarSub": {
    uz: "Mashinangizni qo'shsangiz, faqat mos keladigan detallarni ko'rasiz.",
    ru: "Добавьте машину — и увидите только подходящие детали.",
  },
  "home.addCar": { uz: "Mashina qo'shish", ru: "Добавить машину" },
  "home.checked": { uz: "mahsulot mosligi tekshirilgan", ru: "товаров проверено на совместимость" },

  "garage.title": { uz: "Mening garajim", ru: "Мой гараж" },
  "garage.mine": { uz: "Mening mashinalarim", ru: "Мои машины" },
  "garage.compatible": { uz: "Mos mahsulotlar", ru: "Подходящие товары" },
  "garage.edit": { uz: "Tahrirlash", ru: "Редактировать" },
  "garage.setActive": { uz: "Asosiy qilish", ru: "Сделать основной" },
  "garage.active": { uz: "Asosiy avtomobil", ru: "Основная машина" },
  "garage.add": { uz: "Avtomobil qo'shish", ru: "Добавить машину" },
  "garage.ready": { uz: "Mashinangiz tayyor.", ru: "Ваша машина готова." },
  "garage.plate": { uz: "Davlat raqami", ru: "Гос. номер" },
  "garage.color": { uz: "Kuzov rangi", ru: "Цвет кузова" },
  "garage.mileage": { uz: "Yurgan masofa", ru: "Пробег" },
  "garage.vin": { uz: "VIN", ru: "VIN" },
  "garage.nextService": { uz: "Keyingi servis", ru: "Следующий сервис" },
  "garage.removeConfirm": {
    uz: "Bu avtomobilni garajdan o'chirilsinmi?",
    ru: "Удалить эту машину из гаража?",
  },

  "add.brand": { uz: "Marka", ru: "Марка" },
  "add.model": { uz: "Model", ru: "Модель" },
  "add.year": { uz: "Yil", ru: "Год" },
  "add.variant": { uz: "Dvigatel va uzatma", ru: "Двигатель и коробка" },
  "add.details": { uz: "Qo'shimcha ma'lumot", ru: "Дополнительно" },
  "add.vin": { uz: "VIN", ru: "VIN" },
  "add.confirm": { uz: "Tasdiqlash", ru: "Подтверждение" },
  "add.finish": { uz: "Garajga qo'shish", ru: "Добавить в гараж" },
  "add.step": { uz: "Qadam", ru: "Шаг" },

  "market.title": { uz: "Katalog", ru: "Каталог" },
  "market.results": { uz: "natija", ru: "результатов" },
  "market.filters": { uz: "Filtrlar", ru: "Фильтры" },
  "market.price": { uz: "Narx", ru: "Цена" },
  "market.priceFrom": { uz: "dan", ru: "от" },
  "market.priceTo": { uz: "gacha", ru: "до" },
  "market.brand": { uz: "Brend", ru: "Бренд" },
  "market.sort": { uz: "Saralash", ru: "Сортировка" },
  "market.sortRelevance": { uz: "Mosligi bo'yicha", ru: "По релевантности" },
  "market.sortPopular": { uz: "Ommabop", ru: "Популярные" },
  "market.sortCheap": { uz: "Arzon", ru: "Дешевле" },
  "market.sortExpensive": { uz: "Qimmat", ru: "Дороже" },
  "market.sortRating": { uz: "Reyting", ru: "Рейтинг" },
  "market.sortNewest": { uz: "Yangi", ru: "Новинки" },
  "market.nothing": { uz: "Hech narsa topilmadi", ru: "Ничего не найдено" },
  "market.nothingSub": {
    uz: "Qidiruv so'zini yoki filtrlarni o'zgartirib ko'ring.",
    ru: "Попробуйте изменить запрос или фильтры.",
  },
  "market.clearFilters": { uz: "Filtrlarni tozalash", ru: "Сбросить фильтры" },
  "market.onlyInStock": { uz: "Faqat omborda bor", ru: "Только в наличии" },

  "product.oem": { uz: "OEM raqami", ru: "OEM номер" },
  "product.article": { uz: "Artikul", ru: "Артикул" },
  "product.otherSellers": { uz: "Boshqa sotuvchilar", ru: "Другие продавцы" },
  "product.compare": { uz: "Sotuvchilarni solishtiring", ru: "Сравните продавцов" },
  "product.specs": { uz: "Xususiyatlar", ru: "Характеристики" },
  "product.fits": { uz: "Mos avtomobillar", ru: "Подходит для" },
  "product.description": { uz: "Tavsif", ru: "Описание" },
  "product.seller": { uz: "Sotuvchi", ru: "Продавец" },
  "product.sold": { uz: "sotilgan", ru: "продано" },

  "feed.title": { uz: "Feed", ru: "Лента" },
  "feed.shop": { uz: "Mahsulotni ko'rish", ru: "Смотреть товар" },
  "feed.follow": { uz: "Obuna bo'lish", ru: "Подписаться" },
  "feed.following": { uz: "Obuna bo'lingan", ru: "Вы подписаны" },
  "feed.forYou": { uz: "Siz uchun", ru: "Для вас" },

  "cart.title": { uz: "Savat", ru: "Корзина" },
  "cart.empty": { uz: "Savat bo'sh", ru: "Корзина пуста" },
  "cart.emptySub": {
    uz: "Mashinangizga mos detallarni qo'shing.",
    ru: "Добавьте детали, подходящие вашей машине.",
  },
  "cart.checkout": { uz: "Rasmiylashtirish", ru: "Оформить заказ" },
  "cart.subtotal": { uz: "Mahsulotlar", ru: "Товары" },
  "cart.deliveryTotal": { uz: "Yetkazib berish", ru: "Доставка" },
  "cart.issues": { uz: "Diqqat talab qiladi", ru: "Требует внимания" },
  "cart.goShopping": { uz: "Katalogga o'tish", ru: "Перейти в каталог" },

  "checkout.title": { uz: "Rasmiylashtirish", ru: "Оформление" },
  "checkout.contact": { uz: "Aloqa ma'lumotlari", ru: "Контактные данные" },
  "checkout.name": { uz: "Ism familiya", ru: "Имя и фамилия" },
  "checkout.phone": { uz: "Telefon", ru: "Телефон" },
  "checkout.address": { uz: "Manzil", ru: "Адрес" },
  "checkout.region": { uz: "Viloyat", ru: "Область" },
  "checkout.district": { uz: "Tuman", ru: "Район" },
  "checkout.street": { uz: "Ko'cha va uy", ru: "Улица и дом" },
  "checkout.landmark": { uz: "Mo'ljal", ru: "Ориентир" },
  "checkout.payment": { uz: "To'lov usuli", ru: "Способ оплаты" },
  "checkout.cash": { uz: "Yetkazishda naqd", ru: "Наличными при доставке" },
  "checkout.click": { uz: "Click", ru: "Click" },
  "checkout.payme": { uz: "Payme", ru: "Payme" },
  "checkout.card": { uz: "Bank kartasi (Uzcard / Humo)", ru: "Банковская карта (Uzcard / Humo)" },
  "checkout.deliveryMethod": { uz: "Yetkazib berish usuli", ru: "Способ доставки" },
  "checkout.courier": { uz: "Kuryer orqali", ru: "Курьером" },
  "checkout.sellerDelivery": { uz: "Sotuvchi yetkazadi", ru: "Доставка продавца" },
  "checkout.pickup": { uz: "Do'kondan olib ketish", ru: "Самовывоз" },
  "checkout.comment": { uz: "Izoh", ru: "Комментарий" },
  "checkout.place": { uz: "Buyurtmani tasdiqlash", ru: "Подтвердить заказ" },
  "checkout.required": { uz: "Bu maydonni to'ldiring", ru: "Заполните это поле" },
  "checkout.phoneInvalid": { uz: "Telefon raqami noto'g'ri", ru: "Неверный номер телефона" },
  "checkout.done": { uz: "Buyurtma qabul qilindi", ru: "Заказ принят" },
  "checkout.payOnline": { uz: "To'lovga o'tish", ru: "Перейти к оплате" },

  "orders.title": { uz: "Buyurtmalar", ru: "Заказы" },
  "orders.empty": { uz: "Buyurtmalar yo'q", ru: "Заказов пока нет" },
  "orders.emptySub": {
    uz: "Birinchi buyurtmangizni katalogdan boshlang.",
    ru: "Начните первый заказ из каталога.",
  },
  "orders.number": { uz: "Buyurtma", ru: "Заказ" },
  "orders.history": { uz: "Holatlar tarixi", ru: "История статусов" },
  "orders.cancel": { uz: "Buyurtmani bekor qilish", ru: "Отменить заказ" },
  "orders.status.PENDING": { uz: "To'lov kutilmoqda", ru: "Ожидает оплаты" },
  "orders.status.CONFIRMED": { uz: "Qabul qilindi", ru: "Принят" },
  "orders.status.PREPARING": { uz: "Yig'ilmoqda", ru: "Собирается" },
  "orders.status.SHIPPED": { uz: "Yo'lda", ru: "В пути" },
  "orders.status.DELIVERED": { uz: "Yetkazildi", ru: "Доставлен" },
  "orders.status.COMPLETED": { uz: "Yakunlandi", ru: "Завершён" },
  "orders.status.CANCELLED": { uz: "Bekor qilindi", ru: "Отменён" },
  "orders.status.REFUNDED": { uz: "Pul qaytarildi", ru: "Возврат" },
  "orders.status.DISPUTED": { uz: "Nizoli", ru: "Спорный" },

  "auth.login": { uz: "Kirish", ru: "Вход" },
  "auth.register": { uz: "Ro'yxatdan o'tish", ru: "Регистрация" },
  "auth.logout": { uz: "Chiqish", ru: "Выйти" },
  "auth.identifier": { uz: "Telefon yoki e-pochta", ru: "Телефон или эл. почта" },
  "auth.password": { uz: "Parol", ru: "Пароль" },
  "auth.fullName": { uz: "Ism familiya", ru: "Имя и фамилия" },
  "auth.phone": { uz: "Telefon raqami", ru: "Номер телефона" },
  "auth.noAccount": { uz: "Hisobingiz yo'qmi?", ru: "Нет аккаунта?" },
  "auth.hasAccount": { uz: "Hisobingiz bormi?", ru: "Уже есть аккаунт?" },
  "auth.passwordHint": {
    uz: "Kamida 8 belgi, harf va raqamdan iborat",
    ru: "Минимум 8 символов, буквы и цифры",
  },
  "auth.required": { uz: "Kirish talab qilinadi", ru: "Требуется вход" },
  "auth.requiredSub": {
    uz: "Davom etish uchun hisobingizga kiring.",
    ru: "Войдите в аккаунт, чтобы продолжить.",
  },

  "profile.title": { uz: "Profil", ru: "Профиль" },
  "profile.wishlist": { uz: "Saqlanganlar", ru: "Избранное" },
  "profile.settings": { uz: "Sozlamalar", ru: "Настройки" },
  "profile.language": { uz: "Til", ru: "Язык" },
  "profile.guest": { uz: "Mehmon", ru: "Гость" },
} as unknown as Dict;

const STORAGE_KEY = "avtoqism.lang";

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "uz",
  setLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("uz");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "uz" || stored === "ru") setLangState(stored);
    } catch {
      /* storage blocked — Uzbek stays the default */
    }
  }, []);

  const value = useMemo(
    () => ({
      lang,
      setLang: (l: Lang) => {
        setLangState(l);
        try {
          localStorage.setItem(STORAGE_KEY, l);
        } catch {
          /* ignore */
        }
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

export function pick(lang: Lang, uz: string | null | undefined, ru: string | null | undefined) {
  return (lang === "uz" ? uz : ru) ?? uz ?? ru ?? "";
}
