/**
 * Shared product visual theme mapping — used in both POSPage and ProductsPage
 * Maps product name keywords → Unsplash photo URL + emoji + gradient fallback
 */

const IMG = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=600&h=400&fit=crop&auto=format&q=80`;

export const PRODUCT_IMGS: Record<string, string> = {
  espresso     : IMG("1510707577719-ae7c14805e3a"),
  americano    : IMG("1497935586047-9395b4f6c6f7"),
  cappuccino   : IMG("1541167760496-1628856ab772"),
  flatWhite    : IMG("1562777717-dc6984f65a63"),
  latte        : IMG("1509042239860-f550ce710b93"),
  cortado      : IMG("1474888564977-cef5b9b76d7b"),
  macchiato    : IMG("1575385151084-08beaabd5d2b"),
  icedLatte    : IMG("1461023058943-07fcbe16d735"),
  icedCoffee   : IMG("1600093463592-8e36ae95ef56"),
  coldBrew     : IMG("1524350876685-274059332603"),
  matcha       : IMG("1536256263959-770b48d82b0a"),
  icedMatcha   : IMG("1556679343-c7306c1976bc"),
  whiteMocha   : IMG("1596711405955-8e07b44e78e3"),
  pistachio    : IMG("1607920591850-3ea4ee00af80"),
  caramel      : IMG("1612892483236-52d32a0e0ac1"),
  saffron      : IMG("1592508751036-9c0cf8ad855a"),
  hotChoc      : IMG("1542990253-0d0f5be5f0ed"),
  tea          : IMG("1544787219-7f47ccb76574"),
  karkade      : IMG("1525385133512-2f3bdd039054"),
  v60          : IMG("1495474472287-4d71bcdd2085"),
  orangeJuice  : IMG("1568702846914-96b305d2aaeb"),
  mojito       : IMG("1544145945-f90425340c7e"),
  lemonade     : IMG("1621263764928-df1444c5e859"),
  icedTea      : IMG("1556679343-c7306c1976bc"),
  cheesecake   : IMG("1567171466153-276a0b50bd23"),
  tiramisu     : IMG("1571877227200-a0d98ea607e9"),
  brownie      : IMG("1564355808539-22fda35bed7e"),
  cookie       : IMG("1499636136210-6f4ee915583e"),
  cake         : IMG("1578985545062-69928b1d9587"),
  donut        : IMG("1551024601-bec78aea704b"),
  frenchToast  : IMG("1484723091739-30a097e8f929"),
  waffle       : IMG("1562376552-0d160a2f238d"),
  croissant    : IMG("1555507036-ab1f4038808a"),
  pancake      : IMG("1528207776546-365bb710ee93"),
  sandwich     : IMG("1539252554453-80ab65ce3586"),
  coffeeBeans  : IMG("1447933601403-0c6688de566e"),
  chocolateDrink: IMG("1517959105821-ecd3c2a3a8d2"),
  water        : IMG("1548839140-29a749e1cf4d"),
  pudding      : IMG("1550317138-10000687a72b"),
};

export type ProductTheme = {
  imageUrl: string;
  emoji: string;
  gradientFallback: string;
};

export function getProductTheme(name: string): ProductTheme {
  const n = name || "";

  /* Iced drinks — check before generic hot coffee */
  if (/(آيس ماتشا|iced matcha)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.icedMatcha,    emoji: "🍵", gradientFallback: "from-green-800 to-green-950" };
  if (/(كولد برو|cold brew)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.coldBrew,      emoji: "🧊", gradientFallback: "from-slate-800 to-slate-950" };
  if (/(آيس تشوكلت|iced choc|تشوكلت مثلج)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.chocolateDrink,emoji: "🍫", gradientFallback: "from-stone-800 to-stone-950" };
  if (/(آيس تي|iced tea|شاي مثلج)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.icedTea,       emoji: "🍵", gradientFallback: "from-amber-700 to-amber-900" };
  if (/(آيس|ice )/i.test(n) && /(موكا|mocha)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.icedCoffee,    emoji: "🤍", gradientFallback: "from-slate-700 to-slate-900" };
  if (/(آيس|ice )/i.test(n) && /(بستاشيو|pistachio)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.icedLatte,     emoji: "🌿", gradientFallback: "from-green-700 to-green-900" };
  if (/(آيس|ice )/i.test(n) && /(كراميل|caramel)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.icedLatte,     emoji: "🍮", gradientFallback: "from-amber-800 to-amber-950" };
  if (/(آيس|ice )/i.test(n) && /(زعفران|saffron)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.icedLatte,     emoji: "💛", gradientFallback: "from-yellow-700 to-yellow-900" };
  if (/(آيس أمريكانو|ice americano)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.icedCoffee,    emoji: "☕", gradientFallback: "from-zinc-700 to-zinc-950" };
  if (/(آيس لاتيه|iced latte|آيس اوز)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.icedLatte,     emoji: "☕", gradientFallback: "from-amber-700 to-amber-950" };
  if (/(آيس كورتادو)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.icedLatte,     emoji: "☕", gradientFallback: "from-stone-700 to-stone-900" };
  if (/(آيس|iced|مثلج)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.icedCoffee,    emoji: "🧊", gradientFallback: "from-sky-800 to-sky-950" };

  /* Hot coffees */
  if (/(اسبريسو|espresso|alfredo)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.espresso,      emoji: "☕", gradientFallback: "from-amber-900 to-amber-950" };
  if (/(أمريكانو|americano)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.americano,     emoji: "☕", gradientFallback: "from-zinc-800 to-zinc-950" };
  if (/(كابتشينو|cappuccino)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.cappuccino,    emoji: "☕", gradientFallback: "from-amber-800 to-amber-950" };
  if (/(مكياتو|macchiato)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.macchiato,     emoji: "☕", gradientFallback: "from-amber-700 to-amber-900" };
  if (/(كورتادو|cortado)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.cortado,       emoji: "☕", gradientFallback: "from-stone-700 to-stone-900" };
  if (/(فلات وايت|flat white)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.flatWhite,     emoji: "☕", gradientFallback: "from-stone-600 to-stone-800" };
  if (/(وايت موكا|white mocha)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.whiteMocha,    emoji: "🤍", gradientFallback: "from-slate-600 to-slate-800" };
  if (/(بستاشيو|pistachio)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.pistachio,     emoji: "🌿", gradientFallback: "from-green-700 to-green-900" };
  if (/(كاراميل|caramel)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.caramel,       emoji: "🍮", gradientFallback: "from-amber-800 to-amber-950" };
  if (/(زعفران|saffron)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.saffron,       emoji: "💛", gradientFallback: "from-yellow-700 to-yellow-900" };
  if (/(اوز لاتيه|oz latte)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.latte,         emoji: "☕", gradientFallback: "from-amber-700 to-amber-900" };
  if (/(قهوة اللوز|almond)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.latte,         emoji: "🌰", gradientFallback: "from-amber-800 to-amber-950" };
  if (/(لاتيه|latte)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.latte,         emoji: "☕", gradientFallback: "from-amber-700 to-amber-900" };
  if (/(v60|في 60)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.v60,           emoji: "☕", gradientFallback: "from-amber-800 to-amber-950" };
  if (/(هوت شوكليت|hot chocolate|تراميسيو ساخن)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.hotChoc,       emoji: "🍫", gradientFallback: "from-stone-800 to-stone-950" };
  if (/(قهوة اليوم|coffee of the day)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.v60,           emoji: "☕", gradientFallback: "from-amber-700 to-amber-900" };

  /* Tea & herbal */
  if (/(كركديه|hibiscus)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.karkade,       emoji: "🌺", gradientFallback: "from-rose-800 to-rose-950" };
  if (/(ماتشا|matcha)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.matcha,        emoji: "🍵", gradientFallback: "from-green-700 to-green-900" };
  if (/(شاي|tea)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.tea,           emoji: "🍵", gradientFallback: "from-amber-600 to-amber-800" };

  /* Cold drinks */
  if (/(موهيتو|mojito)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.mojito,        emoji: "🍹", gradientFallback: "from-green-700 to-green-900" };
  if (/(ليمونيد|lemonade|بينك)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.lemonade,      emoji: "🍋", gradientFallback: "from-yellow-700 to-yellow-900" };
  if (/(عصير برتقال|orange)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.orangeJuice,   emoji: "🍊", gradientFallback: "from-orange-700 to-orange-900" };

  /* Desserts */
  if (/(تيراميسو|tiramisu)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.tiramisu,      emoji: "☕", gradientFallback: "from-amber-800 to-amber-950" };
  if (/(تشيز كيك|cheesecake)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.cheesecake,    emoji: "🎂", gradientFallback: "from-pink-800 to-pink-950" };
  if (/(براوني|brownie)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.brownie,       emoji: "🍫", gradientFallback: "from-stone-800 to-stone-950" };
  if (/(دونات|donut)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.donut,         emoji: "🍩", gradientFallback: "from-pink-700 to-purple-900" };
  if (/(كوكيز|cookies|cookie)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.cookie,        emoji: "🍪", gradientFallback: "from-amber-700 to-amber-900" };
  if (/(بودينق|pudding)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.pudding,       emoji: "🍮", gradientFallback: "from-amber-700 to-amber-900" };
  if (/(تارت|tart|سان سباستيان)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.cheesecake,    emoji: "🥧", gradientFallback: "from-amber-700 to-amber-900" };
  if (/(كيك|cake)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.cake,          emoji: "🎂", gradientFallback: "from-rose-700 to-rose-950" };
  if (/(ماجيك بار|magic bar)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.brownie,       emoji: "✨", gradientFallback: "from-purple-800 to-purple-950" };
  if (/(شوكليت|شوكو|chocolate|choco)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.hotChoc,       emoji: "🍫", gradientFallback: "from-stone-800 to-stone-950" };

  /* Bakery */
  if (/(فرنش توست|french toast|فرنس توست)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.frenchToast,   emoji: "🍞", gradientFallback: "from-amber-700 to-amber-900" };
  if (/(وافل|waffle)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.waffle,        emoji: "🧇", gradientFallback: "from-amber-700 to-amber-900" };
  if (/(كراوسون|كروسون|كروفل|croissant)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.croissant,     emoji: "🥐", gradientFallback: "from-amber-700 to-amber-900" };
  if (/(بانكيك|pancake)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.pancake,       emoji: "🥞", gradientFallback: "from-amber-600 to-amber-800" };
  if (/(بريوش|كريب|brioche|crepe)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.croissant,     emoji: "🍞", gradientFallback: "from-amber-700 to-amber-900" };
  if (/(بانيني|ساندوتش|sandwich|panini)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.sandwich,      emoji: "🥪", gradientFallback: "from-amber-800 to-amber-950" };

  /* Retail bags */
  if (/(محصول|بوكس قهوة|coffee bag)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.coffeeBeans,   emoji: "🫘", gradientFallback: "from-amber-900 to-amber-950" };

  /* Water */
  if (/(مياه|water)/i.test(n))
    return { imageUrl: PRODUCT_IMGS.water,         emoji: "💧", gradientFallback: "from-sky-700 to-sky-900" };

  return { imageUrl: "",                            emoji: "🍽️", gradientFallback: "from-slate-700 to-slate-900" };
}

/* ── localStorage helpers ─────────────────────────────────────────── */
const CUSTOM_IMG_KEY = "product_custom_images_v1";

export function getCustomImages(): Record<number, string> {
  try { return JSON.parse(localStorage.getItem(CUSTOM_IMG_KEY) || "{}"); }
  catch { return {}; }
}

export function saveCustomImage(productId: number, url: string) {
  const map = getCustomImages();
  if (url.trim()) map[productId] = url.trim();
  else delete map[productId];
  localStorage.setItem(CUSTOM_IMG_KEY, JSON.stringify(map));
}

export function deleteCustomImage(productId: number) {
  const map = getCustomImages();
  delete map[productId];
  localStorage.setItem(CUSTOM_IMG_KEY, JSON.stringify(map));
}
