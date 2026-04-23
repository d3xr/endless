import { makeTransaction } from '5-entities/transaction/makeTransaction'
import { accountModel } from '5-entities/account'
import { merchantModel } from '5-entities/merchant'
import { tagModel } from '5-entities/tag'
import { toISODate } from '6-shared/helpers/date'
import { getColorForString, hex2int } from '6-shared/helpers/color'
import {
  AccountType,
  TAccount,
  TDiff,
  TISODate,
  TMerchant,
  TTag,
  TTagId,
  TTransaction,
  TUser,
} from '6-shared/types'
import { round } from '6-shared/helpers/money'
import countries from '../countries.json'
import companies from '../companies.json'
import instruments from '../instruments.json'
import { Persona } from './types'

/**
 * Deterministic pseudo-random so the same persona always produces the same history.
 * Mulberry32 — good enough for demo jitter, 32-bit state, fully reproducible.
 */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function jitter(random: () => number, base: number, variance: number) {
  const delta = (random() * 2 - 1) * variance
  return Math.round(base * (1 + delta))
}

function pickBetween(random: () => number, min: number, max: number) {
  return Math.round(min + random() * (max - min))
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const YEARS_OF_HISTORY = 5
const RUB_INSTRUMENT = 2

// Merchant pools — feeds the payee/merchant fields so the UI looks like real data.
// Each persona uses a filtered subset matching their lifestyle.

interface MerchantDef {
  key: string
  title: string
  category: keyof CategoryTable
  mcc?: number
}

const MERCHANTS: MerchantDef[] = [
  // groceries
  { key: 'pyaterochka', title: 'Пятёрочка', category: 'groceries', mcc: 5411 },
  { key: 'magnit', title: 'Магнит', category: 'groceries', mcc: 5411 },
  { key: 'perekrestok', title: 'Перекрёсток', category: 'groceries', mcc: 5411 },
  { key: 'lenta', title: 'Лента', category: 'groceries', mcc: 5411 },
  { key: 'vkusvill', title: 'ВкусВилл', category: 'groceries', mcc: 5411 },
  { key: 'globus', title: 'Глобус', category: 'groceries', mcc: 5411 },
  { key: 'ozon-fresh', title: 'Ozon Fresh', category: 'groceries', mcc: 5411 },
  { key: 'samokat', title: 'Самокат', category: 'groceries', mcc: 5411 },
  { key: 'local-store', title: 'Продукты 24', category: 'groceries', mcc: 5411 },
  { key: 'market', title: 'Рынок', category: 'groceries', mcc: 5499 },

  // cafes
  { key: 'coffix', title: 'Coffix', category: 'cafes', mcc: 5814 },
  { key: 'cofix', title: 'Cofix', category: 'cafes', mcc: 5814 },
  { key: 'shokoladnitsa', title: 'Шоколадница', category: 'cafes', mcc: 5812 },
  { key: 'coffee-like', title: 'Coffee Like', category: 'cafes', mcc: 5814 },
  { key: 'surf-coffee', title: 'Surf Coffee', category: 'cafes', mcc: 5814 },
  { key: 'starbucks', title: 'Stars Coffee', category: 'cafes', mcc: 5814 },
  { key: 'dodo', title: 'Додо Пицца', category: 'cafes', mcc: 5812 },
  { key: 'kfc', title: 'Ростикс / KFC', category: 'cafes', mcc: 5814 },
  { key: 'burger-king', title: 'Burger King', category: 'cafes', mcc: 5814 },
  { key: 'vkusno', title: 'Вкусно — и точка', category: 'cafes', mcc: 5814 },

  // restaurants
  { key: 'tanuki', title: 'Тануки', category: 'restaurants', mcc: 5812 },
  { key: 'mama-rosa', title: 'Ресторан «Мама Роза»', category: 'restaurants', mcc: 5812 },
  { key: 'chikhopig', title: 'Чихо-Пыхо', category: 'restaurants', mcc: 5812 },
  { key: 'bardak', title: 'Бардак', category: 'restaurants', mcc: 5812 },
  { key: 'beer-club', title: 'Beer Club 1516', category: 'restaurants', mcc: 5813 },

  // delivery
  { key: 'yandex-eda', title: 'Яндекс Еда', category: 'delivery', mcc: 5812 },
  { key: 'delivery-club', title: 'Delivery Club', category: 'delivery', mcc: 5812 },
  { key: 'sbermarket', title: 'Сбермаркет', category: 'delivery', mcc: 5411 },

  // transport
  { key: 'yandex-taxi', title: 'Яндекс Go', category: 'taxi', mcc: 4121 },
  { key: 'citymobil', title: 'Ситимобил', category: 'taxi', mcc: 4121 },
  { key: 'metro', title: 'Метрополитен', category: 'publicTransport', mcc: 4111 },
  { key: 'mosgortrans', title: 'Мосгортранс', category: 'publicTransport', mcc: 4111 },

  // fuel
  { key: 'lukoil', title: 'Лукойл', category: 'fuel', mcc: 5541 },
  { key: 'rosneft', title: 'Роснефть', category: 'fuel', mcc: 5541 },
  { key: 'gazprom', title: 'Газпромнефть', category: 'fuel', mcc: 5541 },
  { key: 'shell', title: 'Shell', category: 'fuel', mcc: 5541 },

  // utilities
  { key: 'zhku', title: 'ЖКУ Москвы', category: 'utilities', mcc: 4900 },
  { key: 'energosbyt', title: 'Энергосбыт', category: 'utilities', mcc: 4900 },
  { key: 'mosenergosbyt', title: 'Мосэнергосбыт', category: 'utilities', mcc: 4900 },
  { key: 'rostelecom', title: 'Ростелеком', category: 'utilities', mcc: 4814 },
  { key: 'mts', title: 'МТС', category: 'utilities', mcc: 4814 },
  { key: 'megafon', title: 'Мегафон', category: 'utilities', mcc: 4814 },

  // shopping
  { key: 'wildberries', title: 'Wildberries', category: 'shopping', mcc: 5399 },
  { key: 'ozon', title: 'Ozon', category: 'shopping', mcc: 5399 },
  { key: 'yandex-market', title: 'Яндекс Маркет', category: 'shopping', mcc: 5399 },
  { key: 'dns', title: 'DNS', category: 'electronics', mcc: 5732 },
  { key: 'mvideo', title: 'М.Видео', category: 'electronics', mcc: 5732 },
  { key: 'citilink', title: 'Ситилинк', category: 'electronics', mcc: 5732 },
  { key: 'zara', title: 'Maag (ex-Zara)', category: 'clothing', mcc: 5651 },
  { key: 'uniqlo', title: 'Just Clothes', category: 'clothing', mcc: 5651 },
  { key: 'sport-master', title: 'Спортмастер', category: 'clothing', mcc: 5655 },
  { key: 'ikea', title: 'Хофф', category: 'home', mcc: 5712 },
  { key: 'leroy', title: 'Леруа Мерлен', category: 'home', mcc: 5211 },
  { key: 'fix-price', title: 'Fix Price', category: 'home', mcc: 5331 },

  // subscriptions
  { key: 'yandex-plus', title: 'Яндекс Плюс', category: 'subscriptions', mcc: 4899 },
  { key: 'kinopoisk', title: 'Кинопоиск', category: 'subscriptions', mcc: 4899 },
  { key: 'netflix', title: 'ivi', category: 'subscriptions', mcc: 4899 },
  { key: 'spotify', title: 'Звук', category: 'subscriptions', mcc: 4899 },
  { key: 'itunes', title: 'AppStore', category: 'subscriptions', mcc: 5735 },
  { key: 'google-play', title: 'RuStore', category: 'subscriptions', mcc: 5735 },

  // entertainment
  { key: 'kino', title: 'Киномакс', category: 'entertainment', mcc: 7832 },
  { key: 'cinema', title: 'Формула Кино', category: 'entertainment', mcc: 7832 },
  { key: 'theater', title: 'Театр Драмы', category: 'entertainment', mcc: 7922 },
  { key: 'concert', title: 'TicketLand', category: 'entertainment', mcc: 7922 },
  { key: 'park', title: 'Парк Горького', category: 'entertainment', mcc: 7991 },
  { key: 'museum', title: 'Третьяковка', category: 'entertainment', mcc: 7991 },

  // health
  { key: 'pharmacy', title: 'Аптека «Ригла»', category: 'health', mcc: 5912 },
  { key: 'apteka', title: 'Аптека 36.6', category: 'health', mcc: 5912 },
  { key: 'gemotest', title: 'Гемотест', category: 'health', mcc: 8099 },
  { key: 'invitro', title: 'Инвитро', category: 'health', mcc: 8099 },
  { key: 'clinic', title: 'СМ-Клиника', category: 'health', mcc: 8011 },
  { key: 'dental', title: 'Стоматология «Улыбка»', category: 'health', mcc: 8021 },

  // kids
  { key: 'detsky-mir', title: 'Детский Мир', category: 'kids', mcc: 5641 },
  { key: 'school', title: 'Школьные сборы', category: 'kids', mcc: 8211 },
  { key: 'kids-club', title: 'Детский клуб', category: 'kids', mcc: 8351 },

  // gifts
  { key: 'gift-cards', title: 'Подарки24', category: 'gifts', mcc: 5947 },

  // other
  { key: 'atm', title: 'Снятие наличных', category: 'atm', mcc: 6011 },
  { key: 'barber', title: 'Топ-Ган', category: 'personal', mcc: 7230 },
  { key: 'salon', title: 'Салон красоты «Лика»', category: 'personal', mcc: 7230 },
  { key: 'nail-salon', title: 'Ногтевая студия', category: 'personal', mcc: 7230 },
  { key: 'massage', title: 'СПА «Гранд»', category: 'personal', mcc: 7298 },
  { key: 'yoga', title: 'Yoga Lab', category: 'sport', mcc: 7997 },
  { key: 'fitness', title: 'World Class', category: 'sport', mcc: 7997 },
  { key: 'bike', title: 'Веломаг', category: 'hobby', mcc: 5940 },
  { key: 'fishing', title: 'Рыболов-Профи', category: 'hobby', mcc: 5941 },
  { key: 'hunt', title: 'Охотактив', category: 'hobby', mcc: 5941 },
  { key: 'books', title: 'Читай-Город', category: 'hobby', mcc: 5942 },
  { key: 'vet', title: 'Ветклиника «Бетховен»', category: 'pets', mcc: 742 },
  { key: 'pet-shop', title: 'Четыре лапы', category: 'pets', mcc: 5995 },
]

// Categories we'll create as ZenMoney tags. Mapped to consistent icons/colors.
type CategoryTable = {
  salary: true
  bonus: true
  sideIncome: true
  refund: true
  gifts: true
  groceries: true
  cafes: true
  restaurants: true
  delivery: true
  taxi: true
  publicTransport: true
  fuel: true
  carMaintenance: true
  rent: true
  mortgage: true
  utilities: true
  shopping: true
  electronics: true
  clothing: true
  home: true
  subscriptions: true
  entertainment: true
  health: true
  kids: true
  personal: true
  sport: true
  hobby: true
  pets: true
  parents: true
  atm: true
  savings: true
  unknown: true
}

type CategoryKey = keyof CategoryTable

const CATEGORY_TITLES: Record<CategoryKey, string> = {
  salary: 'Зарплата',
  bonus: 'Премия',
  sideIncome: 'Подработка',
  refund: 'Возврат',
  gifts: 'Подарки',
  groceries: 'Продукты',
  cafes: 'Кафе',
  restaurants: 'Рестораны',
  delivery: 'Доставка еды',
  taxi: 'Такси',
  publicTransport: 'Общественный транспорт',
  fuel: 'Бензин',
  carMaintenance: 'Авто — обслуживание',
  rent: 'Аренда',
  mortgage: 'Ипотека',
  utilities: 'Коммуналка',
  shopping: 'Покупки',
  electronics: 'Электроника',
  clothing: 'Одежда',
  home: 'Для дома',
  subscriptions: 'Подписки',
  entertainment: 'Развлечения',
  health: 'Здоровье',
  kids: 'Дети',
  personal: 'Салоны красоты',
  sport: 'Спорт',
  hobby: 'Хобби',
  pets: 'Питомцы',
  parents: 'Родители',
  atm: 'Наличка',
  savings: 'Сбережения',
  unknown: 'Без категории',
}

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  salary: '#2E7D32',
  bonus: '#388E3C',
  sideIncome: '#66BB6A',
  refund: '#A5D6A7',
  gifts: '#E91E63',
  groceries: '#FF9800',
  cafes: '#FFB300',
  restaurants: '#F57C00',
  delivery: '#FF8A65',
  taxi: '#FFA726',
  publicTransport: '#5C6BC0',
  fuel: '#3949AB',
  carMaintenance: '#283593',
  rent: '#8D6E63',
  mortgage: '#6D4C41',
  utilities: '#A1887F',
  shopping: '#9C27B0',
  electronics: '#7B1FA2',
  clothing: '#AB47BC',
  home: '#BA68C8',
  subscriptions: '#26A69A',
  entertainment: '#5E35B1',
  health: '#00ACC1',
  kids: '#FF7043',
  personal: '#EC407A',
  sport: '#00897B',
  hobby: '#9CCC65',
  pets: '#78909C',
  parents: '#8D6E63',
  atm: '#607D8B',
  savings: '#43A047',
  unknown: '#BDBDBD',
}

interface GenContext {
  persona: Persona
  random: () => number
  user: TUser
  tags: Record<CategoryKey, TTag>
  merchants: Record<string, TMerchant>
  accounts: Record<string, TAccount>
  transactions: TTransaction[]
  startDate: Date
  endDate: Date
}

function buildUser(persona: Persona, now: number): TUser {
  const DAY = 1000 * 60 * 60 * 24
  return {
    id: hashString(persona.bio.id),
    changed: now,
    currency: RUB_INSTRUMENT,
    parent: null,
    country: 1,
    countryCode: 'RU',
    email: null,
    login: persona.bio.id,
    monthStartDay: 1,
    paidTill: now + DAY * 365,
    subscription: '10yearssubscription',
    isForecastEnabled: false,
    planBalanceMode: 'balance',
    planSettings: '',
    subscriptionRenewalDate: now + DAY * 365,
  }
}

function buildTags(user: TUser, persona: Persona): Record<CategoryKey, TTag> {
  const make = (key: CategoryKey) =>
    tagModel.makeTag({
      id: `${persona.bio.id}-${key}`,
      user: user.id,
      title: CATEGORY_TITLES[key],
      color: hex2int(CATEGORY_COLORS[key]),
      showIncome: key === 'salary' || key === 'bonus' || key === 'sideIncome' || key === 'refund' || key === 'gifts',
      showOutcome: !(key === 'salary' || key === 'bonus' || key === 'sideIncome' || key === 'refund'),
    })

  const entries = (Object.keys(CATEGORY_TITLES) as CategoryKey[]).map(k => [k, make(k)] as const)
  return Object.fromEntries(entries) as Record<CategoryKey, TTag>
}

function buildMerchants(user: TUser, persona: Persona): Record<string, TMerchant> {
  const out: Record<string, TMerchant> = {}
  for (const m of MERCHANTS) {
    out[m.key] = merchantModel.makeMerchant({
      id: `${persona.bio.id}-${m.key}`,
      title: m.title,
      user: user.id,
    })
  }
  // persona-specific merchants
  const p = persona.bio
  out['employer'] = merchantModel.makeMerchant({
    id: `${p.id}-employer`,
    title: persona.bio.occupation.employer,
    user: user.id,
  })
  out['rent-landlord'] = merchantModel.makeMerchant({
    id: `${p.id}-landlord`,
    title: 'Аренда — ' + (p.gender === 'f' ? 'Елена Владимировна' : 'Виктор Николаевич'),
    user: user.id,
  })
  if (p.id === 'nikolay-business') {
    out['wife'] = merchantModel.makeMerchant({ id: `${p.id}-wife`, title: 'Светлана', user: user.id })
    out['son'] = merchantModel.makeMerchant({ id: `${p.id}-son`, title: 'Артём (сын)', user: user.id })
  }
  if (p.id === 'alexey-accountant') {
    out['wife'] = merchantModel.makeMerchant({ id: `${p.id}-wife`, title: 'Ирина (жена)', user: user.id })
    out['tesch'] = merchantModel.makeMerchant({ id: `${p.id}-tesch`, title: 'Тесть', user: user.id })
  }
  if (p.id === 'marina-cashier') {
    out['boyfriend'] = merchantModel.makeMerchant({ id: `${p.id}-bf`, title: 'Серёга', user: user.id })
    out['sister'] = merchantModel.makeMerchant({ id: `${p.id}-sister`, title: 'Сестра Наташа', user: user.id })
    out['mom'] = merchantModel.makeMerchant({ id: `${p.id}-mom`, title: 'Мама', user: user.id })
  }
  if (p.id === 'dmitry-it') {
    out['wife'] = merchantModel.makeMerchant({ id: `${p.id}-wife`, title: 'Наталья (жена)', user: user.id })
    out['kindergarten'] = merchantModel.makeMerchant({ id: `${p.id}-kg`, title: 'Частный садик', user: user.id })
  }
  if (p.id === 'olga-office') {
    out['parents'] = merchantModel.makeMerchant({ id: `${p.id}-parents`, title: 'Родители (Тагил)', user: user.id })
  }
  return out
}

function buildAccounts(user: TUser, persona: Persona): Record<string, TAccount> {
  const out: Record<string, TAccount> = {}
  for (const a of persona.finance.accounts) {
    const typeMap: Record<string, AccountType> = {
      checking: AccountType.Ccard,
      ccard: AccountType.Ccard,
      cash: AccountType.Cash,
      deposit: AccountType.Deposit,
      debt: AccountType.Loan,
    }
    out[a.key] = accountModel.makeAccount({
      id: `${persona.bio.id}-${a.key}`,
      user: user.id,
      title: a.title,
      type: typeMap[a.type],
      instrument: RUB_INSTRUMENT,
      inBalance: a.type !== 'debt',
      startBalance: a.type === 'deposit' || a.type === 'debt' ? a.openingBalance : 0,
      balance: a.openingBalance,
    })
  }
  return out
}

function primaryCardAccount(ctx: GenContext): TAccount {
  const first = Object.values(ctx.accounts).find(a => a.type === AccountType.Ccard)
  return first || Object.values(ctx.accounts)[0]
}

function cashAccount(ctx: GenContext): TAccount | null {
  return Object.values(ctx.accounts).find(a => a.type === AccountType.Cash) || null
}

function depositAccount(ctx: GenContext): TAccount | null {
  return Object.values(ctx.accounts).find(a => a.type === AccountType.Deposit) || null
}

function addTx(
  ctx: GenContext,
  args: {
    date: Date
    tag?: TTagId
    outcome?: number
    income?: number
    outcomeAccount?: TAccount
    incomeAccount?: TAccount
    merchant?: TMerchant | null
    comment?: string
    payee?: string
  }
) {
  const iso = toISODate(args.date)
  const chosenOut = args.outcomeAccount || (args.outcome ? primaryCardAccount(ctx) : null)
  const chosenIn = args.incomeAccount || (args.income ? primaryCardAccount(ctx) : null)
  const trDraft = {
    date: iso,
    created: +args.date,
    changed: +args.date,
    user: ctx.user.id,
    deleted: false,
    hold: false,
    viewed: true,
    income: args.income || 0,
    outcome: args.outcome || 0,
    incomeInstrument: chosenIn?.instrument || RUB_INSTRUMENT,
    incomeAccount: chosenIn?.id || chosenOut?.id || '',
    outcomeInstrument: chosenOut?.instrument || RUB_INSTRUMENT,
    outcomeAccount: chosenOut?.id || chosenIn?.id || '',
    tag: args.tag ? ([args.tag] as TTagId[]) : null,
    comment: args.comment || null,
    merchant: args.merchant?.id || null,
    payee: args.payee || args.merchant?.title || null,
  }
  ctx.transactions.push(makeTransaction(trDraft))
}

// ---------------------------------------------------------------------------
// Core generation logic.
// Walks day by day for 5 years and emits income + expenses according to
// the persona's budget. Applies life events at the right month.
// ---------------------------------------------------------------------------

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function dateAt(ctx: GenContext, year: number, month: number, day: number): Date {
  const base = new Date(ctx.startDate)
  base.setFullYear(base.getFullYear() + (year - 1))
  base.setMonth(base.getMonth() + (month - 1))
  base.setDate(Math.min(day, 28))
  return base
}

function pickMerchant(ctx: GenContext, category: CategoryKey, allowed: string[]): TMerchant {
  const filtered = MERCHANTS.filter(m => m.category === category && allowed.includes(m.key))
  const pool = filtered.length > 0 ? filtered : MERCHANTS.filter(m => m.category === category)
  const idx = Math.floor(ctx.random() * pool.length)
  return ctx.merchants[pool[idx].key]
}

/**
 * Defines which merchant pool fits which persona (so Marina shops at Пятёрочка,
 * Dmitry occasionally at ВкусВилл and Ozon Fresh). Keeps amounts realistic.
 */
function merchantPoolFor(persona: Persona): Record<CategoryKey, string[]> {
  const id = persona.bio.id
  const base: Record<CategoryKey, string[]> = {
    salary: ['employer'],
    bonus: ['employer'],
    sideIncome: [],
    refund: ['wildberries', 'ozon'],
    gifts: [],
    groceries: ['pyaterochka', 'magnit', 'local-store'],
    cafes: ['coffix', 'dodo', 'kfc'],
    restaurants: ['chikhopig'],
    delivery: ['yandex-eda'],
    taxi: ['yandex-taxi'],
    publicTransport: ['metro', 'mosgortrans'],
    fuel: ['lukoil', 'rosneft', 'gazprom'],
    carMaintenance: [],
    rent: ['rent-landlord'],
    mortgage: [],
    utilities: ['zhku', 'energosbyt', 'rostelecom', 'mts'],
    shopping: ['wildberries', 'ozon'],
    electronics: ['dns'],
    clothing: ['zara', 'sport-master'],
    home: ['fix-price', 'leroy'],
    subscriptions: ['yandex-plus', 'kinopoisk'],
    entertainment: ['kino', 'park'],
    health: ['pharmacy', 'apteka'],
    kids: ['detsky-mir'],
    personal: ['nail-salon'],
    sport: ['yoga', 'fitness'],
    hobby: ['books'],
    pets: ['pet-shop'],
    parents: [],
    atm: ['atm'],
    savings: [],
    unknown: [],
  }

  if (id === 'marina-cashier') {
    base.groceries = ['pyaterochka', 'magnit', 'local-store', 'market']
    base.cafes = ['coffix', 'dodo', 'vkusno', 'kfc']
    base.shopping = ['wildberries']
    base.clothing = ['sport-master']
    base.entertainment = ['kino']
    base.subscriptions = ['yandex-plus']
    base.personal = ['nail-salon']
    base.publicTransport = ['mosgortrans']
  }
  if (id === 'alexey-accountant') {
    base.groceries = ['pyaterochka', 'magnit', 'perekrestok', 'lenta']
    base.cafes = ['coffix', 'shokoladnitsa', 'dodo', 'burger-king']
    base.restaurants = ['chikhopig', 'tanuki', 'beer-club']
    base.shopping = ['wildberries', 'ozon', 'yandex-market']
    base.electronics = ['dns', 'citilink']
    base.clothing = ['zara', 'sport-master']
    base.home = ['fix-price', 'leroy']
    base.entertainment = ['kino', 'concert']
    base.hobby = ['fishing', 'books']
    base.subscriptions = ['yandex-plus', 'kinopoisk']
    base.utilities = ['zhku', 'rostelecom', 'mts']
  }
  if (id === 'olga-office') {
    base.groceries = ['perekrestok', 'vkusvill', 'magnit', 'samokat']
    base.cafes = ['coffix', 'starbucks', 'surf-coffee', 'shokoladnitsa', 'coffee-like']
    base.restaurants = ['chikhopig', 'tanuki', 'mama-rosa']
    base.delivery = ['yandex-eda', 'delivery-club', 'sbermarket']
    base.shopping = ['wildberries', 'ozon', 'yandex-market']
    base.electronics = ['dns', 'mvideo']
    base.clothing = ['zara', 'uniqlo']
    base.entertainment = ['theater', 'concert', 'museum', 'kino']
    base.personal = ['salon', 'nail-salon', 'massage']
    base.sport = ['yoga']
    base.hobby = ['books']
    base.subscriptions = ['yandex-plus', 'spotify', 'kinopoisk']
  }
  if (id === 'dmitry-it') {
    base.groceries = ['vkusvill', 'ozon-fresh', 'perekrestok', 'globus', 'samokat']
    base.cafes = ['surf-coffee', 'starbucks', 'shokoladnitsa']
    base.restaurants = ['chikhopig', 'tanuki', 'mama-rosa', 'beer-club', 'bardak']
    base.delivery = ['yandex-eda', 'sbermarket', 'delivery-club']
    base.shopping = ['ozon', 'yandex-market', 'wildberries']
    base.electronics = ['dns', 'mvideo', 'citilink']
    base.clothing = ['uniqlo', 'zara']
    base.home = ['ikea', 'leroy']
    base.entertainment = ['theater', 'museum', 'park', 'cinema']
    base.subscriptions = ['yandex-plus', 'kinopoisk', 'spotify', 'itunes', 'google-play']
    base.hobby = ['bike', 'books']
    base.pets = ['pet-shop', 'vet']
    base.sport = ['fitness']
  }
  if (id === 'nikolay-business') {
    base.groceries = ['lenta', 'globus', 'magnit', 'perekrestok', 'market']
    base.cafes = ['shokoladnitsa', 'burger-king', 'vkusno']
    base.restaurants = ['chikhopig', 'mama-rosa', 'beer-club']
    base.delivery = ['yandex-eda']
    base.shopping = ['ozon', 'yandex-market', 'wildberries']
    base.electronics = ['dns', 'mvideo']
    base.clothing = ['sport-master', 'zara']
    base.home = ['leroy']
    base.entertainment = ['kino', 'concert']
    base.hobby = ['hunt', 'fishing']
    base.pets = ['pet-shop', 'vet']
    base.subscriptions = ['yandex-plus']
  }
  return base
}

// ---------------------------------------------------------------------------
// Per-day / per-month event emitters
// ---------------------------------------------------------------------------

function emitMonthlyIncome(ctx: GenContext, monthIdx: number, pool: Record<CategoryKey, string[]>) {
  const { persona, random } = ctx
  const growth = Math.pow(1 + persona.finance.income.annualGrowthPct, monthIdx / 12)

  const base = new Date(ctx.startDate)
  base.setMonth(base.getMonth() + monthIdx)
  const year = base.getFullYear()
  const month = base.getMonth()

  const salaryTotal = jitter(random, persona.finance.income.salaryBase * growth, persona.finance.income.salaryVariancePct)
  const advance = Math.round(salaryTotal * persona.finance.income.advancePaymentPct)
  const rest = salaryTotal - advance

  const advanceDate = new Date(year, month, 20 + Math.floor(random() * 3))
  const restDate = new Date(year, month + 1, 5 + Math.floor(random() * 3))

  addTx(ctx, {
    date: advanceDate,
    tag: ctx.tags.salary.id,
    income: advance,
    incomeAccount: primaryCardAccount(ctx),
    merchant: ctx.merchants['employer'],
    comment: 'Аванс',
  })
  addTx(ctx, {
    date: restDate,
    tag: ctx.tags.salary.id,
    income: rest,
    incomeAccount: primaryCardAccount(ctx),
    merchant: ctx.merchants['employer'],
    comment: 'Зарплата',
  })

  // bonus months
  if (persona.finance.income.bonusMonths.includes(month + 1)) {
    const [lo, hi] = persona.finance.income.bonusAmount
    const bonus = Math.round(pickBetween(random, lo, hi) * growth)
    addTx(ctx, {
      date: new Date(year, month, 28),
      tag: ctx.tags.bonus.id,
      income: bonus,
      incomeAccount: primaryCardAccount(ctx),
      merchant: ctx.merchants['employer'],
      comment: 'Премия',
    })
  }

  // side income (probabilistic)
  const side = persona.finance.income.sideIncome
  if (side && random() < side.frequencyPerYear / 12) {
    const amount = jitter(random, side.averageMonthly * growth, 0.4)
    addTx(ctx, {
      date: new Date(year, month, 10 + Math.floor(random() * 18)),
      tag: ctx.tags.sideIncome.id,
      income: amount,
      incomeAccount: cashAccount(ctx) || primaryCardAccount(ctx),
      comment: side.kind,
    })
  }

  return { salaryTotal, bonusIncluded: persona.finance.income.bonusMonths.includes(month + 1) }
}

function emitMonthlyFixed(ctx: GenContext, monthIdx: number, pool: Record<CategoryKey, string[]>) {
  const { persona, random } = ctx
  const base = new Date(ctx.startDate)
  base.setMonth(base.getMonth() + monthIdx)
  const year = base.getFullYear()
  const month = base.getMonth()

  // rent / mortgage
  if (persona.finance.housing.kind === 'rent' && persona.finance.housing.amount > 0) {
    const d = new Date(year, month, 2 + Math.floor(random() * 3))
    addTx(ctx, {
      date: d,
      tag: ctx.tags.rent.id,
      outcome: persona.finance.housing.amount,
      outcomeAccount: primaryCardAccount(ctx),
      merchant: ctx.merchants['rent-landlord'],
      comment: 'Аренда квартиры',
    })
  }
  if (persona.finance.housing.kind === 'mortgage' && persona.finance.housing.amount > 0) {
    const d = new Date(year, month, 15 + Math.floor(random() * 3))
    addTx(ctx, {
      date: d,
      tag: ctx.tags.mortgage.id,
      outcome: persona.finance.housing.amount,
      outcomeAccount: primaryCardAccount(ctx),
      comment: 'Платёж по ипотеке',
    })
  }

  // utilities
  const util = persona.finance.budget.utilities
  if (util > 0) {
    const parts = [
      { m: pickMerchant(ctx, 'utilities', pool.utilities), pct: 0.55, note: 'ЖКУ' },
      { m: pickMerchant(ctx, 'utilities', pool.utilities), pct: 0.25, note: 'Электричество' },
      { m: pickMerchant(ctx, 'utilities', pool.utilities), pct: 0.2, note: 'Интернет/связь' },
    ]
    parts.forEach((p, i) => {
      addTx(ctx, {
        date: new Date(year, month, 8 + i * 3),
        tag: ctx.tags.utilities.id,
        outcome: jitter(random, util * p.pct, 0.08),
        outcomeAccount: primaryCardAccount(ctx),
        merchant: p.m,
        comment: p.note,
      })
    })
  }

  // subscriptions
  if (persona.finance.budget.subscriptions > 0) {
    addTx(ctx, {
      date: new Date(year, month, 17),
      tag: ctx.tags.subscriptions.id,
      outcome: persona.finance.budget.subscriptions,
      outcomeAccount: primaryCardAccount(ctx),
      merchant: pickMerchant(ctx, 'subscriptions', pool.subscriptions),
      comment: 'Подписка',
    })
  }

  // savings transfer (into deposit)
  if (persona.finance.budget.savings > 0) {
    const dep = depositAccount(ctx)
    if (dep) {
      addTx(ctx, {
        date: new Date(year, month, 11),
        outcome: persona.finance.budget.savings,
        income: persona.finance.budget.savings,
        outcomeAccount: primaryCardAccount(ctx),
        incomeAccount: dep,
        comment: 'Перевод в накопления',
      })
    }
  }
}

function emitDailyExpenses(ctx: GenContext, day: Date, pool: Record<CategoryKey, string[]>) {
  const { persona, random, tags } = ctx
  const budget = persona.finance.budget
  const dow = day.getDay() // 0 sun … 6 sat
  const isWeekend = dow === 0 || dow === 6

  // groceries — 2-3 times a week
  if (random() < (isWeekend ? 0.55 : 0.28)) {
    const share = isWeekend ? 0.22 : 0.12
    const amount = jitter(random, budget.groceries * share, 0.35)
    if (amount > 50) {
      const useCash = cashAccount(ctx) && random() < 0.15
      addTx(ctx, {
        date: day,
        tag: tags.groceries.id,
        outcome: amount,
        outcomeAccount: useCash ? cashAccount(ctx)! : primaryCardAccount(ctx),
        merchant: pickMerchant(ctx, 'groceries', pool.groceries),
      })
    }
  }

  // cafes / lunch
  if (!isWeekend && budget.cafesAndRestaurants > 0 && random() < 0.45) {
    const amount = jitter(random, budget.cafesAndRestaurants * 0.08, 0.4)
    if (amount > 80) {
      addTx(ctx, {
        date: day,
        tag: tags.cafes.id,
        outcome: amount,
        outcomeAccount: primaryCardAccount(ctx),
        merchant: pickMerchant(ctx, 'cafes', pool.cafes),
        comment: 'Обед',
      })
    }
  }

  // weekend restaurant
  if (isWeekend && budget.cafesAndRestaurants > 0 && random() < 0.22) {
    const amount = jitter(random, budget.cafesAndRestaurants * 0.25, 0.4)
    addTx(ctx, {
      date: day,
      tag: tags.restaurants.id,
      outcome: amount,
      outcomeAccount: primaryCardAccount(ctx),
      merchant: pickMerchant(ctx, 'restaurants', pool.restaurants),
      comment: 'Ужин',
    })
  }

  // delivery
  if (budget.cafesAndRestaurants > 500 && random() < 0.12) {
    const amount = jitter(random, budget.cafesAndRestaurants * 0.15, 0.3)
    addTx(ctx, {
      date: day,
      tag: tags.delivery.id,
      outcome: amount,
      outcomeAccount: primaryCardAccount(ctx),
      merchant: pickMerchant(ctx, 'delivery', pool.delivery),
      comment: 'Доставка',
    })
  }

  // transport
  if (persona.finance.car) {
    if (random() < 0.12) {
      const amount = jitter(random, persona.finance.car.monthlyFuel / 4, 0.3)
      addTx(ctx, {
        date: day,
        tag: tags.fuel.id,
        outcome: amount,
        outcomeAccount: primaryCardAccount(ctx),
        merchant: pickMerchant(ctx, 'fuel', pool.fuel),
        comment: 'Заправка',
      })
    }
  } else {
    // metro / bus
    if (!isWeekend && random() < 0.8) {
      addTx(ctx, {
        date: day,
        tag: tags.publicTransport.id,
        outcome: pickBetween(random, 45, 85),
        outcomeAccount: primaryCardAccount(ctx),
        merchant: pickMerchant(ctx, 'publicTransport', pool.publicTransport),
      })
    }
    if (random() < 0.08) {
      addTx(ctx, {
        date: day,
        tag: tags.taxi.id,
        outcome: pickBetween(random, 220, 850),
        outcomeAccount: primaryCardAccount(ctx),
        merchant: pickMerchant(ctx, 'taxi', pool.taxi),
      })
    }
  }

  // shopping (Wildberries/Ozon) — random day of week
  if (budget.clothing > 0 && random() < 0.05) {
    const amount = jitter(random, budget.clothing * 0.4, 0.5)
    addTx(ctx, {
      date: day,
      tag: tags.shopping.id,
      outcome: amount,
      outcomeAccount: primaryCardAccount(ctx),
      merchant: pickMerchant(ctx, 'shopping', pool.shopping),
      comment: 'Заказ',
    })
  }

  // pharmacy / health
  if (budget.health > 0 && random() < 0.04) {
    const amount = jitter(random, budget.health * 0.3, 0.6)
    addTx(ctx, {
      date: day,
      tag: tags.health.id,
      outcome: amount,
      outcomeAccount: primaryCardAccount(ctx),
      merchant: pickMerchant(ctx, 'health', pool.health),
      comment: 'Аптека',
    })
  }

  // entertainment
  if (isWeekend && budget.entertainment > 0 && random() < 0.15) {
    const amount = jitter(random, budget.entertainment * 0.25, 0.35)
    addTx(ctx, {
      date: day,
      tag: tags.entertainment.id,
      outcome: amount,
      outcomeAccount: primaryCardAccount(ctx),
      merchant: pickMerchant(ctx, 'entertainment', pool.entertainment),
    })
  }

  // sport
  if (budget.entertainment > 2000 && pool.sport.length && random() < 0.09) {
    addTx(ctx, {
      date: day,
      tag: tags.sport.id,
      outcome: jitter(random, 1500, 0.3),
      outcomeAccount: primaryCardAccount(ctx),
      merchant: pickMerchant(ctx, 'sport', pool.sport),
    })
  }

  // personal care
  if (random() < 0.04 && pool.personal.length) {
    const amount = persona.bio.gender === 'f'
      ? jitter(random, 2800, 0.35)
      : jitter(random, 900, 0.25)
    addTx(ctx, {
      date: day,
      tag: tags.personal.id,
      outcome: amount,
      outcomeAccount: primaryCardAccount(ctx),
      merchant: pickMerchant(ctx, 'personal', pool.personal),
    })
  }

  // miscellaneous untagged "unknown" noise — leaves work for the AI demo
  if (random() < 0.025) {
    const amount = jitter(random, 500, 0.8) + pickBetween(random, 100, 2000)
    addTx(ctx, {
      date: day,
      outcome: amount,
      outcomeAccount: primaryCardAccount(ctx),
      payee: `Оплата по СБП ${pickBetween(random, 1000, 9999)}`,
    })
  }
}

function emitLifeEvents(ctx: GenContext, pool: Record<CategoryKey, string[]>) {
  for (const event of ctx.persona.finance.lifeEvents) {
    const d = dateAt(ctx, event.year, event.month, 10 + Math.floor(ctx.random() * 14))
    if (event.amount && event.amount > 0) {
      addTx(ctx, {
        date: d,
        outcome: event.amount,
        outcomeAccount: primaryCardAccount(ctx),
        comment: event.description,
        tag: event.kind === 'vacation'
          ? ctx.tags.entertainment.id
          : event.kind === 'big-buy' || event.kind === 'tech' || event.kind === 'appliance'
            ? ctx.tags.electronics.id
            : event.kind === 'medical'
              ? ctx.tags.health.id
              : event.kind === 'car-repair'
                ? ctx.tags.carMaintenance.id
                : event.kind === 'school'
                  ? ctx.tags.kids.id
                  : event.kind === 'loan-to-family' || event.kind === 'gift' || event.kind === 'family'
                    ? ctx.tags.parents.id
                    : event.kind === 'business'
                      ? undefined
                      : event.kind === 'investment'
                        ? ctx.tags.savings.id
                        : undefined,
      })
    }
  }
}

function applyIncomeGrowth(ctx: GenContext) {
  // events like promotion update the persona.finance.income.salaryBase mid-stream
  // We apply them as a sticky income boost — re-inject at the event month and
  // keep the change for all subsequent months.
  for (const event of ctx.persona.finance.lifeEvents) {
    if (event.incomePct && event.incomePct > 0) {
      const d = dateAt(ctx, event.year, event.month, 5)
      addTx(ctx, {
        date: d,
        tag: ctx.tags.bonus.id,
        income: Math.round(ctx.persona.finance.income.salaryBase * event.incomePct * 2),
        incomeAccount: primaryCardAccount(ctx),
        merchant: ctx.merchants['employer'],
        comment: event.description,
      })
      // lock in the bump for the future by patching the salaryBase
      ctx.persona.finance.income.salaryBase = Math.round(
        ctx.persona.finance.income.salaryBase * (1 + event.incomePct)
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Public entry: build a ZenMoney-compatible diff for a persona.
// ---------------------------------------------------------------------------

export function generatePersonaDiff(persona: Persona, opts?: { yearsOfHistory?: number }): TDiff {
  const years = opts?.yearsOfHistory || YEARS_OF_HISTORY
  const now = Date.now()

  const endDate = new Date()
  const startDate = new Date(endDate)
  startDate.setFullYear(startDate.getFullYear() - years)
  const startISO: TISODate = toISODate(startDate)
  // ^ used for merchant id continuity (unused here, but useful for deterministic seeds)
  void startISO

  const seed = hashString(persona.bio.id)
  const user = buildUser(persona, now)

  const ctx: GenContext = {
    persona: JSON.parse(JSON.stringify(persona)), // deep-copy so growth mutation doesn't leak
    random: rng(seed),
    user,
    tags: {} as any,
    merchants: {},
    accounts: {},
    transactions: [],
    startDate,
    endDate,
  }

  ctx.tags = buildTags(user, persona)
  ctx.merchants = buildMerchants(user, persona)
  ctx.accounts = buildAccounts(user, persona)

  const pool = merchantPoolFor(persona)

  applyIncomeGrowth(ctx)

  const totalMonths = Math.max(1, monthsBetween(startDate, endDate))
  for (let m = 0; m < totalMonths; m++) {
    emitMonthlyIncome(ctx, m, pool)
    emitMonthlyFixed(ctx, m, pool)
  }

  // daily walk
  for (let d = new Date(startDate); d <= endDate; d = addDays(d, 1)) {
    emitDailyExpenses(ctx, new Date(d), pool)
  }

  emitLifeEvents(ctx, pool)

  // Sort transactions chronologically so the UI feels right
  ctx.transactions.sort((a, b) => +new Date(a.date) - +new Date(b.date))

  // Recompute account balances from the transactions (matches real ZM behavior)
  const balances: Record<string, number> = {}
  Object.values(ctx.accounts).forEach(a => {
    balances[a.id] = a.startBalance
  })
  ctx.transactions.forEach(t => {
    if (t.income) balances[t.incomeAccount] = (balances[t.incomeAccount] || 0) + t.income
    if (t.outcome) balances[t.outcomeAccount] = (balances[t.outcomeAccount] || 0) - t.outcome
  })
  Object.values(ctx.accounts).forEach(a => {
    a.balance = round(balances[a.id] || 0)
  })

  const diff: TDiff = {
    serverTimestamp: Math.round(Date.now() / 1000),
    instrument: instruments,
    country: countries,
    company: companies,
    user: [user],
    merchant: Object.values(ctx.merchants),
    account: Object.values(ctx.accounts),
    tag: Object.values(ctx.tags),
    budget: [],
    reminder: [],
    reminderMarker: [],
    transaction: ctx.transactions,
  }

  return diff
}
