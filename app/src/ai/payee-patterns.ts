/**
 * Known payee patterns for Russian market.
 * Pattern → category title mapping.
 * Patterns are case-insensitive and matched as substrings.
 */
export const PAYEE_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  // Grocery chains
  { pattern: /пятерочка|пятёрочка/i, category: 'Продукты' },
  { pattern: /магнит/i, category: 'Продукты' },
  { pattern: /перекресток|перекрёсток/i, category: 'Продукты' },
  { pattern: /ашан|auchan/i, category: 'Продукты' },
  { pattern: /лента/i, category: 'Продукты' },
  { pattern: /дикси/i, category: 'Продукты' },
  { pattern: /вкусвилл|вкус\s?вилл/i, category: 'Продукты' },
  { pattern: /metro\s?cc|метро\s?кэш/i, category: 'Продукты' },
  { pattern: /окей|o'?key/i, category: 'Продукты' },
  { pattern: /глобус/i, category: 'Продукты' },
  { pattern: /spar|спар/i, category: 'Продукты' },
  { pattern: /самокат/i, category: 'Продукты' },
  { pattern: /яндекс.лавка|lavka/i, category: 'Продукты' },

  // Restaurants & Delivery
  { pattern: /яндекс.еда|yandex.eda/i, category: 'Кафе и рестораны' },
  { pattern: /delivery\s?club/i, category: 'Кафе и рестораны' },
  { pattern: /макдональдс|mcdonald/i, category: 'Фастфуд' },
  { pattern: /бургер\s?кинг|burger\s?king/i, category: 'Фастфуд' },
  { pattern: /kfc|ростикс/i, category: 'Фастфуд' },
  { pattern: /subway|сабвей/i, category: 'Фастфуд' },
  { pattern: /starbucks|старбакс/i, category: 'Кафе и рестораны' },
  { pattern: /шоколадница/i, category: 'Кафе и рестораны' },
  { pattern: /кофемания/i, category: 'Кафе и рестораны' },
  { pattern: /coffee/i, category: 'Кафе и рестораны' },

  // Transport
  { pattern: /яндекс.такси|yandex.taxi/i, category: 'Такси' },
  { pattern: /uber/i, category: 'Такси' },
  { pattern: /ситимобил|citymobil/i, category: 'Такси' },
  { pattern: /метрополитен|metro/i, category: 'Транспорт' },
  { pattern: /тройка|тро[ий]ка/i, category: 'Транспорт' },
  { pattern: /ржд|rzd|railways/i, category: 'Транспорт' },
  { pattern: /аэрофлот|aeroflot/i, category: 'Авиабилеты' },
  { pattern: /s7|победа|pobeda|utair/i, category: 'Авиабилеты' },

  // Gas
  { pattern: /лукойл|lukoil/i, category: 'Бензин' },
  { pattern: /газпром\s?нефть|gazprom/i, category: 'Бензин' },
  { pattern: /роснефть|rosneft/i, category: 'Бензин' },
  { pattern: /bp\b|shell/i, category: 'Бензин' },
  { pattern: /азс|azs/i, category: 'Бензин' },

  // Telecom
  { pattern: /мтс|mts/i, category: 'Связь' },
  { pattern: /мегафон|megafon/i, category: 'Связь' },
  { pattern: /билайн|beeline/i, category: 'Связь' },
  { pattern: /теле2|tele2/i, category: 'Связь' },
  { pattern: /ростелеком|rostelecom/i, category: 'Интернет' },

  // Marketplaces
  { pattern: /ozon|озон/i, category: 'Покупки' },
  { pattern: /wildberries|вайлдберриз|wb/i, category: 'Покупки' },
  { pattern: /aliexpress|алиэкспресс/i, category: 'Покупки' },
  { pattern: /яндекс.маркет|yandex.market/i, category: 'Покупки' },
  { pattern: /мвидео|m.video/i, category: 'Электроника' },
  { pattern: /dns|днс/i, category: 'Электроника' },
  { pattern: /эльдорадо|eldorado/i, category: 'Электроника' },
  { pattern: /citilink|ситилинк/i, category: 'Электроника' },

  // Pharmacy
  { pattern: /аптека|apteka/i, category: 'Аптека' },
  { pattern: /горздрав/i, category: 'Аптека' },
  { pattern: /36.6|36,6/i, category: 'Аптека' },
  { pattern: /ригла|rigla/i, category: 'Аптека' },

  // Subscriptions
  { pattern: /spotify/i, category: 'Подписки' },
  { pattern: /netflix/i, category: 'Подписки' },
  { pattern: /apple\.com|itunes/i, category: 'Подписки' },
  { pattern: /google\s?(play|storage|one)/i, category: 'Подписки' },
  { pattern: /яндекс.плюс|yandex.plus/i, category: 'Подписки' },
  { pattern: /youtube/i, category: 'Подписки' },
  { pattern: /telegram\s?premium/i, category: 'Подписки' },
  { pattern: /chatgpt|openai/i, category: 'Подписки' },
  { pattern: /кинопоиск/i, category: 'Подписки' },
  { pattern: /иви|ivi/i, category: 'Подписки' },

  // Fitness
  { pattern: /world\s?class/i, category: 'Спорт' },
  { pattern: /фитнес|fitness/i, category: 'Спорт' },

  // Beauty
  { pattern: /лэтуаль|letual/i, category: 'Красота' },
  { pattern: /рив\s?гош|rive\s?gauche/i, category: 'Красота' },
  { pattern: /золотое\s?яблоко/i, category: 'Красота' },
  { pattern: /парикмахерская|barbershop|барбер/i, category: 'Красота' },

  // Home & Repair
  { pattern: /леруа\s?мерлен|leroy\s?merlin/i, category: 'Дом' },
  { pattern: /obi|оби/i, category: 'Дом' },
  { pattern: /ikea|икея|икеа/i, category: 'Дом' },
  { pattern: /петрович/i, category: 'Дом' },
  { pattern: /сантехник|сантехника|плитка/i, category: 'Ремонт' },

  // Utilities
  { pattern: /жкх|коммунальн|квартплат/i, category: 'ЖКХ' },
  { pattern: /электроэнерг|мосэнерго/i, category: 'ЖКХ' },
  { pattern: /водоканал/i, category: 'ЖКХ' },
];
