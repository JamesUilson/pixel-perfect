import brakepads from "@/assets/part-brakepads.jpg";
import oil from "@/assets/part-oil.jpg";
import wheel from "@/assets/part-wheel.jpg";
import cobalt from "@/assets/car-cobalt.jpg";

export const carImage = cobalt;

export type CategoryId =
  | "engine"
  | "suspension"
  | "brake"
  | "electrical"
  | "body"
  | "interior"
  | "accessories"
  | "tires"
  | "care"
  | "tuning";

export const categories: { id: CategoryId; uz: string; ru: string }[] = [
  { id: "engine", uz: "Dvigatel", ru: "Двигатель" },
  { id: "suspension", uz: "Xodovoy", ru: "Подвеска" },
  { id: "brake", uz: "Tormoz", ru: "Тормоза" },
  { id: "electrical", uz: "Elektrika", ru: "Электрика" },
  { id: "body", uz: "Kuzov", ru: "Кузов" },
  { id: "interior", uz: "Salon", ru: "Салон" },
  { id: "accessories", uz: "Aksessuarlar", ru: "Аксессуары" },
  { id: "tires", uz: "Shina va disk", ru: "Шины и диски" },
  { id: "care", uz: "Avtokimyo", ru: "Автохимия" },
  { id: "tuning", uz: "Tюning", ru: "Тюнинг" },
];

export type Seller = {
  id: string;
  name: string;
  district: string;
  rating: number;
  reviews: number;
  years: number;
  verified: boolean;
  deliveryUz: string;
  deliveryRu: string;
};

export const sellers: Seller[] = [
  {
    id: "avtodetal",
    name: "AvtoDetal Servis",
    district: "Chilonzor, Toshkent",
    rating: 4.9,
    reviews: 1284,
    years: 6,
    verified: true,
    deliveryUz: "Ertaga, bepul",
    deliveryRu: "Завтра, бесплатно",
  },
  {
    id: "turboparts",
    name: "Turbo Parts",
    district: "Yunusobod, Toshkent",
    rating: 4.7,
    reviews: 642,
    years: 4,
    verified: true,
    deliveryUz: "2 kun ichida",
    deliveryRu: "За 2 дня",
  },
  {
    id: "sergelimotors",
    name: "Sergeli Motors",
    district: "Sergeli, Toshkent",
    rating: 4.5,
    reviews: 318,
    years: 3,
    verified: false,
    deliveryUz: "Bugun, 25 000 so'm",
    deliveryRu: "Сегодня, 25 000 сум",
  },
  {
    id: "mirzoauto",
    name: "Mirzo Auto Market",
    district: "Mirzo Ulug'bek, Toshkent",
    rating: 4.8,
    reviews: 927,
    years: 8,
    verified: true,
    deliveryUz: "Ertaga, bepul",
    deliveryRu: "Завтра, бесплатно",
  },
];

export type Offer = { sellerId: string; price: number; stock: number };

export type Product = {
  id: string;
  nameUz: string;
  nameRu: string;
  brand: string;
  oem: string;
  category: CategoryId;
  image: string;
  price: number;
  oldPrice?: number;
  rating: number;
  reviews: number;
  sold: number;
  warrantyUz: string;
  warrantyRu: string;
  fitsModels: string[];
  offers: Offer[];
  specs: { uz: string; ru: string; value: string }[];
};

const specSet = (a: string, b: string, v: string) => ({ uz: a, ru: b, value: v });

export const products: Product[] = [
  {
    id: "brake-front-cobalt",
    nameUz: "Old tormoz kolodkalari to'plami",
    nameRu: "Комплект передних тормозных колодок",
    brand: "DriveCo",
    oem: "13301234",
    category: "brake",
    image: brakepads,
    price: 285000,
    oldPrice: 340000,
    rating: 4.8,
    reviews: 214,
    sold: 1320,
    warrantyUz: "12 oy kafolat",
    warrantyRu: "Гарантия 12 месяцев",
    fitsModels: ["Cobalt", "Gentra", "Nexia 3"],
    offers: [
      { sellerId: "avtodetal", price: 285000, stock: 24 },
      { sellerId: "turboparts", price: 299000, stock: 9 },
      { sellerId: "sergelimotors", price: 269000, stock: 3 },
    ],
    specs: [
      specSet("Pozitsiya", "Позиция", "Old o'q / Передняя ось"),
      specSet("Material", "Материал", "Ceramic"),
      specSet("Ishlab chiqarilgan", "Производство", "EU"),
    ],
  },
  {
    id: "oil-5w30",
    nameUz: "Motor moyi 5W-30 to'liq sintetik, 4L",
    nameRu: "Моторное масло 5W-30 синтетика, 4 л",
    brand: "UltraDrive",
    oem: "UD5W30-4",
    category: "engine",
    image: oil,
    price: 410000,
    rating: 4.9,
    reviews: 863,
    sold: 5400,
    warrantyUz: "Original sertifikat",
    warrantyRu: "Оригинальный сертификат",
    fitsModels: ["Cobalt", "Gentra", "Spark", "Onix", "Tracker", "Nexia 3"],
    offers: [
      { sellerId: "mirzoauto", price: 410000, stock: 60 },
      { sellerId: "avtodetal", price: 425000, stock: 31 },
    ],
    specs: [
      specSet("Hajmi", "Объём", "4 L"),
      specSet("Spetsifikatsiya", "Спецификация", "API SP / ILSAC GF-6A"),
      specSet("Tur", "Тип", "Full synthetic"),
    ],
  },
  {
    id: "wheel-r16-alloy",
    nameUz: "Quyma disk R16 5x105 + shina",
    nameRu: "Литой диск R16 5x105 + шина",
    brand: "Axis Forged",
    oem: "AX16-5105",
    category: "tires",
    image: wheel,
    price: 1250000,
    oldPrice: 1390000,
    rating: 4.6,
    reviews: 97,
    sold: 240,
    warrantyUz: "24 oy kafolat",
    warrantyRu: "Гарантия 24 месяца",
    fitsModels: ["Cobalt", "Gentra", "Tracker", "Onix"],
    offers: [
      { sellerId: "turboparts", price: 1250000, stock: 8 },
      { sellerId: "mirzoauto", price: 1310000, stock: 12 },
    ],
    specs: [
      specSet("Diametri", "Диаметр", "R16"),
      specSet("PCD", "PCD", "5x105"),
      specSet("Shina", "Шина", "205/55 R16"),
    ],
  },
  {
    id: "air-filter",
    nameUz: "Havo filtri",
    nameRu: "Воздушный фильтр",
    brand: "DriveCo",
    oem: "96536696",
    category: "engine",
    image: oil,
    price: 74000,
    rating: 4.7,
    reviews: 412,
    sold: 3100,
    warrantyUz: "6 oy kafolat",
    warrantyRu: "Гарантия 6 месяцев",
    fitsModels: ["Cobalt", "Gentra", "Nexia 3"],
    offers: [
      { sellerId: "avtodetal", price: 74000, stock: 88 },
      { sellerId: "sergelimotors", price: 69000, stock: 14 },
    ],
    specs: [
      specSet("Tur", "Тип", "Panel"),
      specSet("O'lcham", "Размер", "230 x 180 mm"),
    ],
  },
  {
    id: "shock-absorber",
    nameUz: "Old amortizator (juftlik)",
    nameRu: "Передние амортизаторы (пара)",
    brand: "RoadLine",
    oem: "94566490",
    category: "suspension",
    image: brakepads,
    price: 890000,
    rating: 4.5,
    reviews: 128,
    sold: 610,
    warrantyUz: "18 oy kafolat",
    warrantyRu: "Гарантия 18 месяцев",
    fitsModels: ["Cobalt", "Gentra"],
    offers: [
      { sellerId: "mirzoauto", price: 890000, stock: 6 },
      { sellerId: "turboparts", price: 935000, stock: 4 },
    ],
    specs: [
      specSet("Pozitsiya", "Позиция", "Old o'q / Передняя ось"),
      specSet("Tur", "Тип", "Gas-oil"),
    ],
  },
  {
    id: "battery-60ah",
    nameUz: "Akkumulyator 60Ah",
    nameRu: "Аккумулятор 60Ah",
    brand: "VoltPro",
    oem: "VP60R",
    category: "electrical",
    image: oil,
    price: 720000,
    oldPrice: 795000,
    rating: 4.8,
    reviews: 356,
    sold: 1870,
    warrantyUz: "24 oy kafolat",
    warrantyRu: "Гарантия 24 месяца",
    fitsModels: ["Cobalt", "Gentra", "Spark", "Damas", "Nexia 3"],
    offers: [
      { sellerId: "avtodetal", price: 720000, stock: 19 },
      { sellerId: "mirzoauto", price: 745000, stock: 22 },
    ],
    specs: [
      specSet("Sig'imi", "Ёмкость", "60 Ah"),
      specSet("Tok", "Пусковой ток", "540 A"),
    ],
  },
  {
    id: "floor-mats",
    nameUz: "EVA poliki to'plami",
    nameRu: "Комплект EVA ковриков",
    brand: "Salon Pro",
    oem: "EVA-CBT",
    category: "interior",
    image: brakepads,
    price: 320000,
    rating: 4.6,
    reviews: 189,
    sold: 980,
    warrantyUz: "12 oy kafolat",
    warrantyRu: "Гарантия 12 месяцев",
    fitsModels: ["Cobalt"],
    offers: [
      { sellerId: "sergelimotors", price: 320000, stock: 17 },
      { sellerId: "turboparts", price: 349000, stock: 25 },
    ],
    specs: [
      specSet("Material", "Материал", "EVA"),
      specSet("Rang", "Цвет", "Qora / Чёрный"),
    ],
  },
  {
    id: "polish-kit",
    nameUz: "Keramik himoya to'plami",
    nameRu: "Набор керамической защиты",
    brand: "ShineLab",
    oem: "SL-CER9",
    category: "care",
    image: oil,
    price: 265000,
    rating: 4.4,
    reviews: 74,
    sold: 420,
    warrantyUz: "9 oy himoya",
    warrantyRu: "Защита 9 месяцев",
    fitsModels: ["Cobalt", "Gentra", "Spark", "Onix", "Tracker", "Damas", "Nexia 3"],
    offers: [
      { sellerId: "mirzoauto", price: 265000, stock: 40 },
      { sellerId: "avtodetal", price: 279000, stock: 12 },
    ],
    specs: [
      specSet("Hajmi", "Объём", "50 ml"),
      specSet("Qatlam", "Слой", "9H"),
    ],
  },
  {
    id: "led-headlight",
    nameUz: "LED far lampalari H4",
    nameRu: "LED лампы фар H4",
    brand: "VoltPro",
    oem: "VP-H4LED",
    category: "electrical",
    image: wheel,
    price: 395000,
    rating: 4.3,
    reviews: 143,
    sold: 760,
    warrantyUz: "12 oy kafolat",
    warrantyRu: "Гарантия 12 месяцев",
    fitsModels: ["Nexia 3", "Damas", "Spark"],
    offers: [
      { sellerId: "turboparts", price: 395000, stock: 30 },
      { sellerId: "sergelimotors", price: 379000, stock: 7 },
    ],
    specs: [
      specSet("Yorug'lik", "Световой поток", "6000 lm"),
      specSet("Harorat", "Температура", "6000K"),
    ],
  },
  {
    id: "brake-disc",
    nameUz: "Old tormoz disklari (juftlik)",
    nameRu: "Передние тормозные диски (пара)",
    brand: "DriveCo",
    oem: "13502045",
    category: "brake",
    image: brakepads,
    price: 640000,
    rating: 4.7,
    reviews: 168,
    sold: 890,
    warrantyUz: "18 oy kafolat",
    warrantyRu: "Гарантия 18 месяцев",
    fitsModels: ["Cobalt", "Gentra", "Onix"],
    offers: [
      { sellerId: "avtodetal", price: 640000, stock: 11 },
      { sellerId: "mirzoauto", price: 669000, stock: 15 },
    ],
    specs: [
      specSet("Diametri", "Диаметр", "256 mm"),
      specSet("Tur", "Тип", "Ventilyatsiyali / Вентилируемый"),
    ],
  },
];

export type Video = {
  id: string;
  authorId: string;
  authorName: string;
  titleUz: string;
  titleRu: string;
  poster: string;
  likes: number;
  comments: number;
  productId: string;
  district: string;
};

export const videos: Video[] = [
  {
    id: "v1",
    authorId: "avtodetal",
    authorName: "AvtoDetal Servis",
    titleUz: "Cobalt uchun old kolodkani 12 daqiqada almashtirish",
    titleRu: "Меняем передние колодки на Cobalt за 12 минут",
    poster: brakepads,
    likes: 8420,
    comments: 236,
    productId: "brake-front-cobalt",
    district: "Chilonzor",
  },
  {
    id: "v2",
    authorId: "mirzoauto",
    authorName: "Mirzo Auto Market",
    titleUz: "5W-30 original va soxtasini qanday farqlash mumkin",
    titleRu: "Как отличить оригинальное 5W-30 от подделки",
    poster: oil,
    likes: 15230,
    comments: 512,
    productId: "oil-5w30",
    district: "Mirzo Ulug'bek",
  },
  {
    id: "v3",
    authorId: "turboparts",
    authorName: "Turbo Parts",
    titleUz: "R16 disk Cobaltda qanday ko'rinadi",
    titleRu: "Как смотрятся R16 диски на Cobalt",
    poster: wheel,
    likes: 6310,
    comments: 148,
    productId: "wheel-r16-alloy",
    district: "Yunusobod",
  },
  {
    id: "v4",
    authorId: "sergelimotors",
    authorName: "Sergeli Motors",
    titleUz: "Salonni yangilash: EVA poliklar",
    titleRu: "Обновляем салон: EVA коврики",
    poster: brakepads,
    likes: 3980,
    comments: 87,
    productId: "floor-mats",
    district: "Sergeli",
  },
];

export const brands = [
  {
    name: "Chevrolet",
    models: [
      { name: "Cobalt", years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
      { name: "Gentra", years: [2017, 2018, 2019, 2020, 2021, 2022, 2023] },
      { name: "Nexia 3", years: [2016, 2017, 2018, 2019, 2020] },
      { name: "Spark", years: [2016, 2017, 2018, 2019, 2020, 2021] },
      { name: "Damas", years: [2015, 2018, 2020, 2022, 2023] },
      { name: "Tracker", years: [2020, 2021, 2022, 2023, 2024] },
      { name: "Onix", years: [2021, 2022, 2023, 2024] },
    ],
  },
  {
    name: "Lacetti",
    models: [{ name: "Lacetti", years: [2010, 2012, 2014, 2016, 2018] }],
  },
  {
    name: "Kia",
    models: [
      { name: "K5", years: [2021, 2022, 2023] },
      { name: "Sportage", years: [2019, 2021, 2023] },
    ],
  },
];

export const engines = ["1.2", "1.4", "1.5", "1.6", "1.8", "2.0"];
export const transmissions = [
  { uz: "Mexanika", ru: "Механика" },
  { uz: "Avtomat", ru: "Автомат" },
  { uz: "Robot", ru: "Робот" },
];

export function getSeller(id: string) {
  return sellers.find((s) => s.id === id)!;
}

export function getProduct(id: string) {
  return products.find((p) => p.id === id);
}
