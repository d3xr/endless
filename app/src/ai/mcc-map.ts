/**
 * MCC code to category mapping.
 * Maps merchant category codes to human-readable category names.
 * These will be matched against ZenMoney categories by title.
 */
export const MCC_CATEGORY_MAP: Record<number, string> = {
  // Grocery
  5411: 'Продукты',
  5422: 'Продукты', // Meat
  5441: 'Продукты', // Candy
  5451: 'Продукты', // Dairy
  5462: 'Продукты', // Bakeries

  // Restaurants & Cafes
  5812: 'Кафе и рестораны',
  5813: 'Кафе и рестораны', // Bars
  5814: 'Фастфуд',

  // Transport
  4121: 'Такси',
  4131: 'Транспорт', // Bus
  4111: 'Транспорт', // Railways
  4112: 'Транспорт', // Railways
  4511: 'Авиабилеты',
  4784: 'Транспорт', // Tolls
  5541: 'Бензин', // Gas stations
  5542: 'Бензин',
  5983: 'Бензин', // Fuel

  // Auto
  5511: 'Авто', // Car dealers
  5521: 'Авто', // Used car dealers
  5531: 'Авто', // Auto parts
  7531: 'Авто', // Auto body repair
  7534: 'Авто', // Tire retreading
  7535: 'Авто', // Paint shops
  7538: 'Авто', // Auto service
  7542: 'Авто', // Car washes

  // Health
  5912: 'Аптека',
  8011: 'Медицина', // Doctors
  8021: 'Медицина', // Dentists
  8031: 'Медицина', // Osteopaths
  8041: 'Медицина', // Chiropractors
  8042: 'Медицина', // Optometrists
  8049: 'Медицина', // Podiatrists
  8050: 'Медицина', // Nursing
  8062: 'Медицина', // Hospitals
  8071: 'Медицина', // Medical labs
  8099: 'Медицина', // Health services

  // Shopping
  5311: 'Покупки', // Department stores
  5331: 'Покупки', // Variety stores
  5399: 'Покупки', // General merchandise
  5651: 'Одежда', // Family clothing
  5691: 'Одежда', // Men's/women's clothing
  5611: 'Одежда', // Men's clothing
  5621: 'Одежда', // Women's clothing
  5641: 'Одежда', // Children's clothing
  5661: 'Обувь', // Shoe stores
  5699: 'Одежда', // Misc apparel

  // Electronics
  5732: 'Электроника',
  5734: 'Электроника', // Software
  5735: 'Электроника', // Music stores
  5946: 'Электроника', // Camera shops

  // Home
  5200: 'Дом', // Home supply
  5211: 'Дом', // Building materials
  5231: 'Дом', // Glass/paint
  5251: 'Дом', // Hardware
  5261: 'Дом', // Garden/nursery
  5712: 'Дом', // Furniture
  5713: 'Дом', // Floor covering
  5714: 'Дом', // Drapery
  5719: 'Дом', // Misc home furnishing
  5722: 'Дом', // Household appliances

  // Entertainment
  7832: 'Развлечения', // Cinema
  7841: 'Развлечения', // Video rental
  7911: 'Развлечения', // Dance
  7922: 'Развлечения', // Theater
  7929: 'Развлечения', // Bands/orchestras
  7932: 'Развлечения', // Billiard
  7933: 'Развлечения', // Bowling
  7941: 'Спорт', // Sports clubs
  7991: 'Развлечения', // Tourist attractions
  7992: 'Развлечения', // Golf courses
  7993: 'Развлечения', // Video games
  7994: 'Развлечения', // Video game arcades
  7996: 'Развлечения', // Amusement parks
  7997: 'Спорт', // Recreation services
  7998: 'Развлечения', // Aquariums
  7999: 'Развлечения', // Recreation services

  // Education
  8211: 'Образование', // Schools
  8220: 'Образование', // Colleges
  8241: 'Образование', // Correspondence schools
  8244: 'Образование', // Business schools
  8249: 'Образование', // Vocational schools
  8299: 'Образование', // Educational services

  // Subscriptions & Digital
  4814: 'Связь', // Telecom
  4812: 'Связь', // Telecom equipment
  4816: 'Интернет', // Computer network
  4899: 'Связь', // Cable/satellite
  5815: 'Подписки', // Digital goods
  5816: 'Подписки', // Digital games
  5817: 'Подписки', // Digital apps
  5818: 'Подписки', // Digital large merchant

  // Beauty
  7230: 'Красота', // Beauty shops
  7297: 'Красота', // Massage parlors
  7298: 'Красота', // Health/beauty spas

  // Hotels
  7011: 'Отели', // Hotels
  7012: 'Отели', // Timeshares
  3501: 'Отели', // Holiday Inns
  3502: 'Отели', // Best Western

  // Insurance
  6300: 'Страхование',
  6381: 'Страхование',

  // Financial
  6010: 'Банковские операции', // Financial institution cash
  6011: 'Банковские операции', // ATM
  6012: 'Банковские операции', // Financial institution
  6051: 'Банковские операции', // Quasi cash

  // Pets
  5995: 'Животные', // Pet shops

  // Charity
  8398: 'Благотворительность',
};
