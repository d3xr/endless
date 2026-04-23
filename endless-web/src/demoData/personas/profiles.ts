import { Persona } from './types'

/**
 * Five fictional personas covering the range from working-poor to small-business-owner.
 * Bias: two middle-class office workers, one lower-income retail worker, one senior IT,
 * one small-business owner. Matches the user's brief: "перекос в сторону офисного служащего".
 *
 * Amounts are in rubles (₽). Everything here is deterministic input — the generator
 * turns these numbers into 5 years of transactions.
 */
export const PERSONAS: Persona[] = [
  // --------------------------------------------------------------------------
  // 1. Marina — low income, retail cashier
  // --------------------------------------------------------------------------
  {
    bio: {
      id: 'marina-cashier',
      firstName: 'Марина',
      lastName: 'Петрова',
      age: 23,
      gender: 'f',
      city: 'Саратов',
      cityPopulationTier: 'regional-center',
      emoji: '🛒',

      headline: 'Продавец-кассир в «Пятёрочке»',
      wealthTier: 'low',
      wealthTierLabel: 'Низкий доход · ~45 000 ₽ в месяц',

      occupation: {
        title: 'Продавец-кассир',
        employer: 'X5 Retail Group («Пятёрочка»)',
        industry: 'Ритейл',
        yearsInRole: 2,
        educationLevel: 'college',
      },

      family: {
        status: 'relationship',
        kids: [],
        pets: ['кот Мурзик'],
        livesWith: 'живёт с молодым человеком Серёгой (автослесарь) в съёмной однушке',
      },

      personality:
        'Добрая, стеснительная, копит на «когда-нибудь свадьбу». Не умеет говорить «нет» родственникам, поэтому постоянно одалживает сестре деньги.',

      hobbies: [
        'сериалы на Кинопоиске (скрин аккаунта у подруги)',
        'вяжет носки и хомяков из плюша',
        'подписана на 50+ пабликов про «простые рецепты»',
        'иногда ходит на зумбу в ДК «Россия»',
      ],
      weekend:
        'в субботу — к родителям в деревню под Энгельс (помогает на огороде, привозит еды на неделю). В воскресенье — киношка с Серёгой или прогулка по набережной, если тепло.',
      entertainment:
        'Wildberries-терапия раз в 2 недели (мелочь до 1500₽). День рождения подруги — шашлыки. Новый год — у родителей, с «оливьё» и мандаринами. Отпуск — в Кабардинке 7 дней раз в год.',
      financialHabits:
        'Копит на Ozon-карту (т.к. там кешбэк), остальное — в наличке в «конвертах». Не умеет в инвестиции и боится их. Подушки нет, живёт от зарплаты до аванса.',
      painPoints:
        'Одна поломка стиралки = минус весь месяц. Если Серёга без работы неделю — нечем платить за съём. Сестра звонит «одолжи 3 тысячи до пятницы» раз в месяц и отдаёт через три.',
      backstory:
        'Родилась в селе под Саратовом. После 9 класса пошла в колледж на «товароведа». Переехала в Саратов в 19. Работала в «Магните», потом в «Пятёрочке» — сейчас старший кассир. Мечтает «открыть своё ателье», но пока даже отложить на машинку Janome не получается.',
    },

    finance: {
      currency: 'RUB',
      monthStartDay: 1,
      income: {
        salaryBase: 42_000,
        salaryVariancePct: 0.08,
        advancePaymentPct: 0.4,
        bonusMonths: [12],
        bonusAmount: [2_000, 5_000],
        sideIncome: {
          kind: 'Продажа вязаных носков через Авито',
          averageMonthly: 1500,
          frequencyPerYear: 8,
        },
        annualGrowthPct: 0.07,
      },
      housing: { kind: 'rent', amount: 22_000 },
      accounts: [
        { key: 'sber-card', title: 'Сбер Карта', type: 'checking', bank: 'Сбер', openingBalance: 3_500 },
        { key: 'ozon-card', title: 'Ozon Карта', type: 'ccard', bank: 'Ozon Банк', openingBalance: 0 },
        { key: 'cash-envelope', title: 'Наличка «конверт»', type: 'cash', openingBalance: 5_000 },
      ],
      budget: {
        rent: 22_000,
        utilities: 3_500,
        groceries: 10_500,
        transport: 1_800,
        cafesAndRestaurants: 1_200,
        entertainment: 600,
        subscriptions: 199,
        clothing: 1_500,
        health: 500,
        parents: 0,
        savings: 1_500,
        miscellaneous: 1_200,
      },
      lifeEvents: [
        { year: 1, month: 11, kind: 'breakdown', description: 'Сломалась стиралка — пришлось взять в рассрочку новую', amount: 22_000 },
        { year: 2, month: 7, kind: 'loan-to-family', description: 'Одолжила сестре на свадьбу', amount: 15_000 },
        { year: 3, month: 3, kind: 'promotion', description: 'Повысили до старшего кассира', incomePct: 0.15 },
        { year: 3, month: 8, kind: 'vacation', description: 'Отпуск в Кабардинке', amount: 38_000 },
        { year: 4, month: 6, kind: 'medical', description: 'Лечение зуба в платной клинике', amount: 18_000 },
        { year: 5, month: 5, kind: 'big-buy', description: 'Купила б/у швейную машинку Janome', amount: 14_000 },
      ],
      assets: [],
      behavioralScenarios: {
        // Потеряла работу в «Пятёрочке», временно уборщица, долгое восстановление
        negative: {
          salaryMultipliers: [1.00, 0.92, 0.85, 0.90, 0.95, 1.00, 1.03, 1.05, 1.08, 1.10, 1.12],
          savingsRateByYear: [0.03, 0.00, 0.00, 0.00, 0.02, 0.03, 0.04, 0.02, 0.03, 0.05, 0.05],
        },
        // Стабильно кассир → старший → администратор магазина, индексация на инфляцию
        conservative: {
          salaryMultipliers: [1.00, 1.05, 1.10, 1.16, 1.22, 1.28, 1.35, 1.42, 1.48, 1.55, 1.62],
          savingsRateByYear: [0.04, 0.04, 0.05, 0.05, 0.06, 0.06, 0.07, 0.07, 0.07, 0.08, 0.08],
        },
        // Машинка Janome окупилась, ателье на дому переросло в небольшой цех на 2 человека
        optimistic: {
          salaryMultipliers: [1.00, 1.08, 1.15, 1.25, 1.40, 1.60, 1.80, 2.00, 2.20, 2.40, 2.65],
          savingsRateByYear: [0.05, 0.08, 0.10, 0.12, 0.15, 0.18, 0.20, 0.22, 0.25, 0.25, 0.28],
        },
      },
    },
  },

  // --------------------------------------------------------------------------
  // 2. Alexey — middle class, company accountant (PRIMARY OFFICE PERSONA)
  // --------------------------------------------------------------------------
  {
    bio: {
      id: 'alexey-accountant',
      firstName: 'Алексей',
      lastName: 'Смирнов',
      age: 34,
      gender: 'm',
      city: 'Воронеж',
      cityPopulationTier: 'million-plus',
      emoji: '📊',

      headline: 'Бухгалтер в средней компании',
      wealthTier: 'middle',
      wealthTierLabel: 'Средний класс · ~75 000 ₽ в месяц',

      occupation: {
        title: 'Ведущий бухгалтер',
        employer: 'ООО «Стройресурс» (оптовая стройбаза)',
        industry: 'Оптовая торговля',
        yearsInRole: 6,
        educationLevel: 'university',
      },

      family: {
        status: 'married',
        kids: [{ name: 'Маша', age: 7 }],
        livesWith: 'живёт с женой Ириной (учитель начальных классов) и дочкой Машей в двушке на ипотеке',
      },

      personality:
        'Спокойный, методичный, любит когда всё посчитано. Ворчит на жену за «лишние» траты, но сам тайком покупает рыболовные приманки. На работе его зовут «Алексей Палыч» и просят посоветовать налоговый вычет.',

      hobbies: [
        'рыбалка на Дону (летом — почти каждые выходные)',
        'просмотр футбола (болеет за «Факел»)',
        'мангал и самогон домашний у тестя',
        'исторические документалки на YouTube',
      ],
      weekend:
        'суббота — рыбалка или дача тестя (построить что-нибудь, выпить). Воскресенье — с Машей в парк, жена готовит плов. Вечером — сериал с женой.',
      entertainment:
        'Раз в пару месяцев — в кино всей семьёй. Весной — шашлыки на даче. Раз в год — отпуск в Анапе или Сочи на 10 дней. Новогодние корпоративы на работе, жена ходит со скепсисом. Футбол иногда ходят смотреть с друзьями в бар.',
      financialHabits:
        'Зарплатная карта Сбера, копит на вклад под проценты («ИИС слишком сложно»). Ипотека на 15 лет, осталось 9. Ведёт Excel с расходами, но забрасывает через 2 месяца. Жена ведёт бюджет «в голове» и спорит с его цифрами.',
      painPoints:
        'Ипотека 38 тысяч в месяц — почти половина его зарплаты. Жена получает 38 тысяч учителем. Дочке надо в школу собирать. Машина старенькая, боится что помрёт. Отпуск хочется в Турцию, но «посчитал — не тянем».',
      backstory:
        'Родился в Воронеже, отец — инженер на заводе, мать — врач. ВГУ, экономический. После универа пошёл в маленькую бухгалтерию, потом на «Стройресурс» где и сейчас. Женился в 26. Ипотеку взяли в 2019, жалеет что не взяли ещё одну тогда же («сейчас было бы проще»). Мечтает когда-нибудь купить лодку.',
    },

    finance: {
      currency: 'RUB',
      monthStartDay: 1,
      income: {
        salaryBase: 72_000,
        salaryVariancePct: 0.03,
        advancePaymentPct: 0.35,
        bonusMonths: [6, 12],
        bonusAmount: [18_000, 35_000],
        sideIncome: {
          kind: 'Подработка: годовой отчёт для ИП-знакомых',
          averageMonthly: 2500,
          frequencyPerYear: 10,
        },
        annualGrowthPct: 0.06,
      },
      housing: { kind: 'mortgage', amount: 38_400, yearsLeft: 9 },
      car: { make: 'Hyundai', model: 'Solaris 2014', monthlyFuel: 6_500, maintenance: 4_000 },
      accounts: [
        { key: 'sber-salary', title: 'Сбер Зарплатная', type: 'checking', bank: 'Сбер', openingBalance: 18_000 },
        { key: 'tinkoff-black', title: 'Т-Банк Black', type: 'ccard', bank: 'Т-Банк', openingBalance: 0 },
        { key: 'sber-deposit', title: 'Сбер Вклад «Лучший%»', type: 'deposit', bank: 'Сбер', openingBalance: 180_000 },
        { key: 'cash-wallet', title: 'Кошелёк', type: 'cash', openingBalance: 3_000 },
      ],
      budget: {
        rent: 38_400,
        utilities: 7_500,
        groceries: 22_000,
        transport: 6_500,
        cafesAndRestaurants: 4_500,
        entertainment: 2_500,
        subscriptions: 899,
        clothing: 3_500,
        health: 2_000,
        kids: 6_500,
        parents: 3_000,
        savings: 8_000,
        fuelIfCar: 6_500,
        carMaintenance: 4_000,
        miscellaneous: 2_500,
      },
      lifeEvents: [
        { year: 1, month: 8, kind: 'vacation', description: 'Анапа, семейный отдых 10 дней', amount: 95_000 },
        { year: 2, month: 3, kind: 'car-repair', description: 'Капиталка двигателя Соляриса', amount: 48_000 },
        { year: 2, month: 9, kind: 'school', description: 'Маша пошла в 1 класс — подготовка', amount: 28_000 },
        { year: 3, month: 5, kind: 'bonus', description: 'Годовая премия больше обычной', amount: 55_000 },
        { year: 3, month: 8, kind: 'vacation', description: 'Сочи, 12 дней', amount: 140_000 },
        { year: 4, month: 2, kind: 'promotion', description: 'Повысили до ведущего бухгалтера', incomePct: 0.18 },
        { year: 4, month: 11, kind: 'appliance', description: 'Купили холодильник (старый умер)', amount: 75_000 },
        { year: 5, month: 6, kind: 'vacation', description: 'Турция, наконец-то', amount: 210_000 },
      ],
      assets: [
        {
          id: 'alexey-apt',
          type: 'apartment',
          name: 'Двушка в Воронеже (ипотека)',
          emoji: '🏢',
          sqm: 52,
          purchasePrice: 3_800_000,
          purchaseDate: '2019-06-01',
          currentValue: 5_400_000,
          currentValueDate: '2026-04-01',
          growthPhases: [],
        },
        {
          id: 'alexey-car',
          type: 'car',
          name: 'Hyundai Solaris 2014',
          emoji: '🚗',
          purchasePrice: 620_000,
          purchaseDate: '2014-09-01',
          currentValue: 480_000,
          currentValueDate: '2026-04-01',
          growthPhases: [],
        },
      ],
      behavioralScenarios: {
        // Стройбаза закрылась в кризис, полгода без работы, устроился в меньшую контору с меньшей зарплатой
        negative: {
          salaryMultipliers: [1.00, 1.02, 0.88, 0.85, 0.92, 1.00, 1.08, 1.15, 1.20, 1.25, 1.30],
          savingsRateByYear: [0.08, 0.05, 0.02, 0.00, 0.02, 0.05, 0.07, 0.08, 0.08, 0.10, 0.10],
        },
        // Ведущий → главбух, компания стабильна, индексация на 6% в год
        conservative: {
          salaryMultipliers: [1.00, 1.06, 1.12, 1.19, 1.27, 1.36, 1.45, 1.55, 1.65, 1.75, 1.86],
          savingsRateByYear: [0.11, 0.11, 0.12, 0.12, 0.13, 0.13, 0.14, 0.14, 0.15, 0.15, 0.15],
        },
        // Перешёл в крупный федеральный ритейлер — главбух дочки, затем финдир
        optimistic: {
          salaryMultipliers: [1.00, 1.12, 1.28, 1.50, 1.75, 2.10, 2.40, 2.70, 3.00, 3.30, 3.60],
          savingsRateByYear: [0.14, 0.17, 0.20, 0.22, 0.24, 0.25, 0.27, 0.28, 0.30, 0.30, 0.30],
        },
      },
    },
  },

  // --------------------------------------------------------------------------
  // 3. Olga — middle class, bank office manager (SECOND OFFICE PERSONA)
  // --------------------------------------------------------------------------
  {
    bio: {
      id: 'olga-office',
      firstName: 'Ольга',
      lastName: 'Кузнецова',
      age: 29,
      gender: 'f',
      city: 'Екатеринбург',
      cityPopulationTier: 'million-plus',
      emoji: '💼',

      headline: 'Офис-менеджер в банке',
      wealthTier: 'middle',
      wealthTierLabel: 'Средний класс · ~85 000 ₽ в месяц',

      occupation: {
        title: 'Офис-менеджер / координатор',
        employer: 'ПАО «УБРиР», региональный офис',
        industry: 'Банки',
        yearsInRole: 4,
        educationLevel: 'university',
      },

      family: {
        status: 'single',
        kids: [],
        pets: ['кошка Муся'],
        livesWith: 'снимает студию в «Академическом», живёт одна',
      },

      personality:
        'Амбициозная, аккуратная, всё записывает в Notion. Любит «маленькие радости»: свечи, кофе из спешиалти, уход. Переживает что «ещё не замужем», но внешне это отрицает.',

      hobbies: [
        'йога дважды в неделю (абонемент Yota Yoga)',
        'подкасты про саморазвитие и таро',
        'готовит сложные блюда по выходным и фотографирует',
        'читает русский нонфикшн, ходит в книжный клуб раз в месяц',
      ],
      weekend:
        'суббота — йога утром, потом кофейня с подругой, вечером — маникюр и ужин дома под сериал. Воскресенье — приготовить что-то новое, созвониться с родителями в Нижнем Тагиле, прогулка в Центральном парке.',
      entertainment:
        'Театр драмы раз в пару месяцев. Концерты — 3-4 в год (русский инди). Путешествия — Питер, Калининград, один раз в Грузию. Подписки: Яндекс.Плюс, Букмейт, Delivery Club. Любит «поход в СПА» раз в два месяца.',
      financialHabits:
        'Ведёт учёт в Notion-таблице, знает свой «savings rate». 20% дохода — на брокерский счёт Т-Инвестиции (сбалансированный портфель). Думает про ИИС. Кредиток две, одна для кешбэка, другую забыла закрыть.',
      painPoints:
        'Аренда 40К в Академическом — дорого, но район «свой». Постоянно ловит себя на «подружки замужем, а я нет». Родители зовут вернуться в Тагил («там дешевле»), но она не хочет. Боится «что через 5 лет будет то же самое».',
      backstory:
        'Из Нижнего Тагила. Приехала в Екб на учёбу (УрФУ, маркетинг), осталась. Работала в рознице банка, потом ушла в «тихий» офис координатором. Долго встречалась с Кириллом (ушёл к бывшей 2 года назад). Сейчас «одна и ей ок». Тайно хочет попробовать себя в юве́лирке или мыловарении как хобби-бизнес.',
    },

    finance: {
      currency: 'RUB',
      monthStartDay: 1,
      income: {
        salaryBase: 82_000,
        salaryVariancePct: 0.02,
        advancePaymentPct: 0.35,
        bonusMonths: [3, 9, 12],
        bonusAmount: [12_000, 25_000],
        sideIncome: {
          kind: 'Редкие фрилансы: ведение соцсетей знакомым',
          averageMonthly: 3500,
          frequencyPerYear: 6,
        },
        annualGrowthPct: 0.08,
      },
      housing: { kind: 'rent', amount: 40_000 },
      accounts: [
        { key: 'tinkoff-black', title: 'Т-Банк Black', type: 'ccard', bank: 'Т-Банк', openingBalance: 12_000 },
        { key: 'tinkoff-debit', title: 'Т-Банк Дебет', type: 'checking', bank: 'Т-Банк', openingBalance: 24_000 },
        { key: 'tinkoff-invest', title: 'Т-Инвестиции', type: 'deposit', bank: 'Т-Банк', openingBalance: 65_000 },
        { key: 'alfa-card', title: 'Альфа Карта', type: 'ccard', bank: 'Альфа-Банк', openingBalance: 0 },
      ],
      budget: {
        rent: 40_000,
        utilities: 4_500,
        groceries: 14_000,
        transport: 3_500,
        cafesAndRestaurants: 8_500,
        entertainment: 4_500,
        subscriptions: 1_299,
        clothing: 6_500,
        health: 3_500,
        parents: 4_000,
        savings: 16_500,
        miscellaneous: 3_500,
      },
      lifeEvents: [
        { year: 1, month: 9, kind: 'vacation', description: 'Санкт-Петербург на выходные', amount: 32_000 },
        { year: 2, month: 4, kind: 'wellness', description: 'Курс массажа и СПА-абонемент', amount: 25_000 },
        { year: 2, month: 10, kind: 'vacation', description: 'Грузия с подругой', amount: 88_000 },
        { year: 3, month: 2, kind: 'promotion', description: 'Повышение грейда', incomePct: 0.14 },
        { year: 3, month: 7, kind: 'big-buy', description: 'Ноутбук MacBook Air M2', amount: 125_000 },
        { year: 4, month: 3, kind: 'medical', description: 'Стоматолог: виниры', amount: 95_000 },
        { year: 4, month: 9, kind: 'vacation', description: 'Калининград + Куршская коса', amount: 52_000 },
        { year: 5, month: 4, kind: 'big-buy', description: 'Курс по ювелирке как хобби', amount: 42_000 },
        { year: 5, month: 10, kind: 'vacation', description: 'Армения, 8 дней', amount: 72_000 },
      ],
      assets: [],
      behavioralScenarios: {
        // УБРиР оптимизировал региональную сеть, её перевели на «понижение» координатором смены
        negative: {
          salaryMultipliers: [1.00, 1.04, 0.92, 0.95, 1.00, 1.08, 1.15, 1.20, 1.25, 1.30, 1.35],
          savingsRateByYear: [0.15, 0.10, 0.05, 0.07, 0.10, 0.12, 0.14, 0.15, 0.16, 0.17, 0.17],
        },
        // Грейды раз в 2 года, старший координатор, потом руководитель админ-блока
        conservative: {
          salaryMultipliers: [1.00, 1.07, 1.15, 1.23, 1.32, 1.42, 1.52, 1.63, 1.75, 1.88, 2.00],
          savingsRateByYear: [0.20, 0.20, 0.22, 0.22, 0.23, 0.24, 0.24, 0.25, 0.25, 0.26, 0.26],
        },
        // Хобби в ювелирке доросло до мастерской на Ленина + рост в HR в IT-компании
        optimistic: {
          salaryMultipliers: [1.00, 1.10, 1.25, 1.45, 1.70, 2.00, 2.30, 2.60, 2.90, 3.20, 3.50],
          savingsRateByYear: [0.22, 0.25, 0.28, 0.30, 0.32, 0.34, 0.35, 0.35, 0.35, 0.36, 0.36],
        },
      },
    },
  },

  // --------------------------------------------------------------------------
  // 4. Dmitry — senior IT, big-city
  // --------------------------------------------------------------------------
  {
    bio: {
      id: 'dmitry-it',
      firstName: 'Дмитрий',
      lastName: 'Волков',
      age: 38,
      gender: 'm',
      city: 'Москва',
      cityPopulationTier: 'million-plus',
      emoji: '💻',

      headline: 'Senior Backend Engineer',
      wealthTier: 'upper-middle',
      wealthTierLabel: 'Высокий доход · ~340 000 ₽ в месяц',

      occupation: {
        title: 'Senior Backend Engineer (Go/Python)',
        employer: 'Крупный финтех (remote-first)',
        industry: 'IT',
        yearsInRole: 5,
        educationLevel: 'university',
      },

      family: {
        status: 'married',
        kids: [
          { name: 'Лев', age: 5 },
          { name: 'Соня', age: 2 },
        ],
        livesWith: 'жена Наталья (UX-дизайнер, в декрете/частичный фриланс), двое детей, кот Джобс',
      },

      personality:
        'Интроверт, перфекционист в коде и немного распиздяй в быту. «Оптимизирует» всё вокруг — от подписок до маршрутов доставки продуктов. Любит pet-projects, но редко их заканчивает.',

      hobbies: [
        'pet-projects (сейчас пишет финансовый бот на Claude)',
        'велосипед по выходным (гравийник)',
        'настольные игры с компанией раз в месяц',
        'подкасты про экономику и индустриализацию',
        'варит кофе V60, коллекционирует зёрна',
      ],
      weekend:
        'суббота — с детьми в парк или музей, вечером настолки или кино с женой. Воскресенье — вело по Серебряному бору, потом тихий вечер и пет-проджект.',
      entertainment:
        'Кино — стримы. Рестораны — на дни рождения и «раз в месяц без детей». Путешествия — раньше часто за границу, сейчас Турция, ОАЭ, иногда Кипр. Покупает гаджеты (новый айфон каждые 2 года, мониторы, механика). Годовой абонемент в ВДНХ/Зарядье с детьми.',
      financialHabits:
        'Серьёзно относится к финансам: ИИС, ETF, валютный buffer, 3-6 месячная подушка. Ведёт бюджет в YNAB + ZenMoney. Считает savings rate и FIRE-цель. Автоматизация переводов в день зарплаты.',
      painPoints:
        'Ипотека на трёшку в Подмосковье большая. Двое детей, садик/няня — дорого. Жена в частичном фрилансе, доход нестабильный. Выгорает раз в год. «Инвестиции просели на 30% — настроение просело тоже».',
      backstory:
        'Родился в Туле, в Москве с 18 лет (МГТУ, ИУ7). Работал в Яндексе, потом 2 стартапа, сейчас в финтехе — ремоут, но офис есть для коворкинга. Зарабатывает в рублях, часть в USD-эквиваленте. Купили трёшку в 2021 в ипотеку, 20 минут от МКАД. В 2022 думал уехать — в итоге остался. Мечта — построить дом в Подмосковье через 5-7 лет.',
    },

    finance: {
      currency: 'RUB',
      monthStartDay: 1,
      income: {
        salaryBase: 330_000,
        salaryVariancePct: 0.02,
        advancePaymentPct: 0.4,
        bonusMonths: [3, 12],
        bonusAmount: [180_000, 420_000],
        sideIncome: {
          kind: 'Консультации / менторство',
          averageMonthly: 15_000,
          frequencyPerYear: 8,
        },
        annualGrowthPct: 0.12,
      },
      housing: { kind: 'mortgage', amount: 92_000, yearsLeft: 17 },
      car: { make: 'Toyota', model: 'RAV4 2020', monthlyFuel: 8_000, maintenance: 7_000 },
      accounts: [
        { key: 'tinkoff-black', title: 'Т-Банк Black', type: 'ccard', bank: 'Т-Банк', openingBalance: 85_000 },
        { key: 'tinkoff-premium', title: 'Т-Банк Премиум', type: 'checking', bank: 'Т-Банк', openingBalance: 250_000 },
        { key: 'sber-mortgage', title: 'Сбер Ипотека', type: 'debt', bank: 'Сбер', openingBalance: -6_800_000 },
        { key: 'tinkoff-iis', title: 'Т-ИИС', type: 'deposit', bank: 'Т-Банк', openingBalance: 450_000 },
        { key: 'cushion-deposit', title: 'Подушка (вклад)', type: 'deposit', bank: 'Сбер', openingBalance: 900_000 },
        { key: 'usd-cash', title: 'USD нал', type: 'cash', openingBalance: 180_000 },
      ],
      budget: {
        rent: 92_000,
        utilities: 12_000,
        groceries: 48_000,
        transport: 8_000,
        cafesAndRestaurants: 22_000,
        entertainment: 12_000,
        subscriptions: 4_500,
        clothing: 12_000,
        health: 8_500,
        kids: 55_000,
        parents: 8_000,
        savings: 95_000,
        fuelIfCar: 8_000,
        carMaintenance: 7_000,
        miscellaneous: 10_000,
      },
      lifeEvents: [
        { year: 1, month: 5, kind: 'vacation', description: 'Турция All-Inclusive 10 дней', amount: 380_000 },
        { year: 1, month: 11, kind: 'tech', description: 'Новый MacBook Pro для работы', amount: 280_000 },
        { year: 2, month: 3, kind: 'family', description: 'Родилась Соня — роды платные', amount: 180_000 },
        { year: 2, month: 8, kind: 'renovation', description: 'Ремонт детской', amount: 420_000 },
        { year: 3, month: 1, kind: 'promotion', description: 'Повышение до сеньора+', incomePct: 0.25 },
        { year: 3, month: 6, kind: 'vacation', description: 'ОАЭ, 12 дней', amount: 520_000 },
        { year: 3, month: 10, kind: 'investment', description: 'Докупил ETF на просадке', amount: 350_000 },
        { year: 4, month: 4, kind: 'tech', description: 'Новый айфон + часы', amount: 180_000 },
        { year: 4, month: 7, kind: 'vacation', description: 'Кипр семьёй', amount: 480_000 },
        { year: 5, month: 2, kind: 'big-buy', description: 'Обмен машины с доплатой на RAV4', amount: 1_200_000 },
        { year: 5, month: 9, kind: 'vacation', description: 'Грузия на машине', amount: 320_000 },
      ],
      assets: [
        {
          id: 'dmitry-apt',
          type: 'apartment',
          name: 'Трёшка в Подмосковье (ипотека)',
          emoji: '🏢',
          sqm: 72,
          purchasePrice: 12_500_000,
          purchaseDate: '2021-09-15',
          currentValue: 16_800_000,
          currentValueDate: '2026-04-01',
          growthPhases: [],
          linkedLoanAccountId: 'dmitry-it-sber-mortgage',
        },
        {
          id: 'dmitry-car',
          type: 'car',
          name: 'Toyota RAV4 2020',
          emoji: '🚙',
          purchasePrice: 2_500_000,
          purchaseDate: '2020-03-01',
          currentValue: 2_900_000,
          currentValueDate: '2026-04-01',
          growthPhases: [],
        },
      ],
      behavioralScenarios: {
        // Финтех сократили, прошёл волну, устроился на middle+ с потерей, жена фриланс умер, выгорание
        negative: {
          salaryMultipliers: [1.00, 0.98, 0.85, 0.82, 0.90, 1.00, 1.10, 1.20, 1.30, 1.40, 1.50],
          savingsRateByYear: [0.20, 0.15, 0.08, 0.05, 0.08, 0.12, 0.15, 0.18, 0.20, 0.22, 0.22],
        },
        // Staff engineer, регулярные премии, выплачивает ипотеку по графику
        conservative: {
          salaryMultipliers: [1.00, 1.08, 1.17, 1.27, 1.37, 1.48, 1.60, 1.72, 1.85, 2.00, 2.15],
          savingsRateByYear: [0.27, 0.27, 0.28, 0.28, 0.29, 0.30, 0.30, 0.31, 0.31, 0.32, 0.32],
        },
        // Principal / тимлид, перешёл в стартап с опционами, cash-out через 4-5 лет
        optimistic: {
          salaryMultipliers: [1.00, 1.15, 1.35, 1.60, 1.95, 2.35, 2.80, 3.20, 3.60, 4.00, 4.40],
          savingsRateByYear: [0.32, 0.35, 0.37, 0.40, 0.42, 0.44, 0.45, 0.46, 0.47, 0.48, 0.48],
        },
      },
    },
  },

  // --------------------------------------------------------------------------
  // 5. Nikolay — small business owner
  // --------------------------------------------------------------------------
  {
    bio: {
      id: 'nikolay-business',
      firstName: 'Николай',
      lastName: 'Рябинин',
      age: 52,
      gender: 'm',
      city: 'Краснодар',
      cityPopulationTier: 'million-plus',
      emoji: '🔧',

      headline: 'Владелец автосервиса',
      wealthTier: 'high',
      wealthTierLabel: 'Высокий доход · ~520 000 ₽ в месяц (нерегулярно)',

      occupation: {
        title: 'Собственник / директор',
        employer: 'ИП Рябинин — автосервис «Мотор Хаус»',
        industry: 'Автосервис',
        yearsInRole: 14,
        educationLevel: 'secondary',
      },

      family: {
        status: 'married',
        kids: [
          { name: 'Артём', age: 22 },
          { name: 'Катя', age: 17 },
        ],
        livesWith: 'жена Светлана (не работает, занимается домом), сын Артём (учится в Краснодаре, живёт отдельно), дочь Катя (с ними), собака Гром (алабай)',
      },

      personality:
        'Практичный, прямой, не любит «офисных теорий». Верит в «бумажный нал» больше чем в ИИС. К людям относится как к семье — сотрудники с ним 8-10 лет. Охота, баня, застолье.',

      hobbies: [
        'охота и рыбалка в плавнях',
        'баня с друзьями раз в неделю',
        'реставрирует старую «Волгу» в гараже',
        'смотрит советское кино и болеет за «Кубань»',
        'жарит шашлык на даче почти каждые выходные с весны по октябрь',
      ],
      weekend:
        'пятница вечером — баня с мужиками. Суббота — на даче (40 минут от Краснодара), мангал, семья, иногда Артём приезжает. Воскресенье — свозить Катю в ТЦ, доделать что-то по дому. Иногда — на море в Джубгу.',
      entertainment:
        'Большие застолья на праздники, много гостей. Путешествия — ездит с женой в Турцию 2 раза в год, недавно был в Дубае. Покупает новый телефон раз в 3 года, но «флагманы не нужны». Ходит в баню «Парная» в Краснодаре — элитная, но «оно того стоит».',
      financialHabits:
        'Большинство транзакций через бизнес, личный и бизнесовый счёт часто смешивает. Не особо любит банки, держит часть в кэше и в валюте. Инвестирует в железо для сервиса, машины, земля. Купил квартиру сыну, копит на квартиру дочери.',
      painPoints:
        'Бизнес зависит от сезона и от «как пойдёт». Запчасти дорожают, клиенты «хотят дешевле». Катя через год в ВУЗ — в Питер хочет, дорого. Жена пилит «давай в Турцию». Поставщики иногда кидают.',
      backstory:
        'Родился в Краснодаре. Отслужил в армии (танковые войска). В 90-е крутился: возил запчасти из Прибалтики, потом с братом открыли шиномонтажку. В 2010 купил помещение под сервис, взял двух механиков, вырос до 8 человек и двух боксов. Всю жизнь «сам себе голова». Планов громадьё, но «кто знает как ещё повернётся».',
    },

    finance: {
      currency: 'RUB',
      monthStartDay: 1,
      income: {
        salaryBase: 450_000,
        salaryVariancePct: 0.22,
        advancePaymentPct: 0.3,
        bonusMonths: [5, 10, 12],
        bonusAmount: [250_000, 650_000],
        sideIncome: {
          kind: 'Продажа авто/запчастей, разовая выручка',
          averageMonthly: 35_000,
          frequencyPerYear: 10,
        },
        annualGrowthPct: 0.09,
      },
      housing: { kind: 'own', amount: 0 },
      car: { make: 'Toyota', model: 'Land Cruiser Prado', monthlyFuel: 22_000, maintenance: 12_000 },
      accounts: [
        { key: 'sber-business', title: 'Сбер Бизнес (ИП)', type: 'checking', bank: 'Сбер', openingBalance: 1_400_000 },
        { key: 'sber-personal', title: 'Сбер Личная', type: 'checking', bank: 'Сбер', openingBalance: 320_000 },
        { key: 'tinkoff-black', title: 'Т-Банк Black', type: 'ccard', bank: 'Т-Банк', openingBalance: 50_000 },
        { key: 'cash-safe', title: 'Сейф в гараже', type: 'cash', openingBalance: 850_000 },
        { key: 'usd-cash', title: 'USD нал', type: 'cash', openingBalance: 1_200_000 },
        { key: 'deposit-ruble', title: 'Вклад «Драгоценный»', type: 'deposit', bank: 'Сбер', openingBalance: 1_800_000 },
      ],
      budget: {
        rent: 0,
        utilities: 18_000,
        groceries: 55_000,
        transport: 22_000,
        cafesAndRestaurants: 35_000,
        entertainment: 25_000,
        subscriptions: 2_500,
        clothing: 18_000,
        health: 12_000,
        kids: 70_000,
        parents: 25_000,
        savings: 120_000,
        fuelIfCar: 22_000,
        carMaintenance: 12_000,
        miscellaneous: 25_000,
      },
      lifeEvents: [
        { year: 1, month: 6, kind: 'vacation', description: 'Турция all-inclusive с женой', amount: 450_000 },
        { year: 1, month: 10, kind: 'business', description: 'Новый подъёмник для сервиса', amount: 680_000 },
        { year: 2, month: 3, kind: 'gift', description: 'Ремонт у сестры — помог деньгами', amount: 350_000 },
        { year: 2, month: 7, kind: 'vacation', description: 'Дубай, первый раз', amount: 780_000 },
        { year: 3, month: 4, kind: 'big-buy', description: 'Купил Катi подержанный Solaris', amount: 950_000 },
        { year: 3, month: 9, kind: 'business', description: 'Аренда второго бокса', amount: 280_000 },
        { year: 4, month: 2, kind: 'family', description: 'Купили квартиру Артёму (ипотека с первоначалкой)', amount: 2_400_000 },
        { year: 4, month: 8, kind: 'vacation', description: 'Турция + Грузия', amount: 620_000 },
        { year: 5, month: 5, kind: 'business', description: 'Ремонт в автосервисе + реклама', amount: 850_000 },
        { year: 5, month: 9, kind: 'family', description: 'Катя поступила — расходы на учёбу и переезд', amount: 450_000 },
      ],
      assets: [
        {
          id: 'nikolay-house',
          type: 'house',
          name: 'Дом под Краснодаром (Динская)',
          emoji: '🏡',
          sqm: 150,
          purchasePrice: 6_500_000,
          purchaseDate: '2015-08-01',
          currentValue: 14_200_000,
          currentValueDate: '2026-04-01',
          growthPhases: [],
        },
        {
          id: 'nikolay-commercial',
          type: 'other',
          name: 'Помещение под автосервис',
          emoji: '🏭',
          sqm: 210,
          purchasePrice: 2_800_000,
          purchaseDate: '2010-05-01',
          currentValue: 7_500_000,
          currentValueDate: '2026-04-01',
          growthPhases: [],
        },
        {
          id: 'nikolay-car',
          type: 'car',
          name: 'Toyota Land Cruiser Prado',
          emoji: '🚙',
          purchasePrice: 4_200_000,
          purchaseDate: '2019-11-01',
          currentValue: 5_100_000,
          currentValueDate: '2026-04-01',
          growthPhases: [],
        },
      ],
      behavioralScenarios: {
        // Клиенты перешли в неформал / гаражи, второй бокс закрыли, два механика ушли
        negative: {
          salaryMultipliers: [1.00, 0.85, 0.75, 0.80, 0.90, 1.00, 1.08, 1.12, 1.15, 1.20, 1.25],
          savingsRateByYear: [0.20, 0.10, 0.03, 0.05, 0.08, 0.12, 0.15, 0.15, 0.16, 0.18, 0.18],
        },
        // Стабильный сервис, аренда второго бокса выходит, клиентура не растёт, но и не уходит
        conservative: {
          salaryMultipliers: [1.00, 1.06, 1.12, 1.19, 1.27, 1.35, 1.43, 1.52, 1.60, 1.68, 1.76],
          savingsRateByYear: [0.22, 0.22, 0.22, 0.23, 0.23, 0.23, 0.24, 0.24, 0.25, 0.25, 0.25],
        },
        // Открыл третий бокс, Артём пришёл управляющим, начал сдавать часть помещения арендаторам
        optimistic: {
          salaryMultipliers: [1.00, 1.15, 1.30, 1.50, 1.75, 2.00, 2.30, 2.60, 2.85, 3.05, 3.25],
          savingsRateByYear: [0.25, 0.28, 0.30, 0.33, 0.35, 0.37, 0.38, 0.40, 0.40, 0.40, 0.40],
        },
      },
    },
  },
]

export const getPersonaById = (id: string): Persona | undefined =>
  PERSONAS.find(p => p.bio.id === id)
