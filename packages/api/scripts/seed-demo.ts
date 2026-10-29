/* oxlint-disable no-await-in-loop -- la simulation avance jour après jour, dans l'ordre */
/**
 * Base de démonstration : cinq ans d'activité d'un commerce d'import à Lomé (tissus,
 * quincaillerie, électricité, plastiques), générés avec les services de l'application pour que
 * stock, coûts FIFO, références et soldes soient cohérents.
 *
 * Usage : `pnpm demo:seed` (crée `demo.db` à la racine), puis `pnpm dev:demo`.
 * La base réelle (local.db) n'est jamais ouverte. Le tirage est déterministe : même graine, même
 * histoire (seules les dates suivent le jour où l'on lance le script).
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createAuth } from "@G-stock/auth";
import { createDb } from "@G-stock/db";
import type { Database, Executor } from "@G-stock/db";
import { runMigrations } from "@G-stock/db/migrate";
import { sql } from "drizzle-orm";

import { createCustomer } from "../src/services/customers";
import { createProduct, setProductArchived } from "../src/services/products";
import {
  createPurchaseOrder,
  createSupplierPayment,
  getPurchaseOrder,
  receivePurchaseOrder,
  setPurchaseStatus,
} from "../src/services/purchases";
import { addSaleDiscount, cancelSale, createPayment, createSale } from "../src/services/sales";
import { updateSettings } from "../src/services/settings";
import { createSimulation } from "../src/services/simulations";
import { adjustLot, createLot, listLots } from "../src/services/stock";
import { createSupplier } from "../src/services/suppliers";

// ---------------------------------------------------------------------------------------------
// Fichiers
// ---------------------------------------------------------------------------------------------

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const DEMO_FILE = path.resolve(process.env.DEMO_DATABASE ?? path.join(ROOT, "demo.db"));
const DEMO_FOLDER = path.join(ROOT, "demo-data");

if (path.basename(DEMO_FILE).startsWith("local.db")) {
  throw new Error("Refusé : la démonstration ne s'écrit jamais dans local.db.");
}

// ---------------------------------------------------------------------------------------------
// Hasard reproductible
// ---------------------------------------------------------------------------------------------

// Générateur de Park-Miller : exact en virgule flottante, sans opérateur binaire.
let seed = 20_211_028;
const random = () => {
  seed = (seed * 16_807) % 2_147_483_647;
  return (seed - 1) / 2_147_483_646;
};
const between = (min: number, max: number) => min + random() * (max - min);
const integer = (min: number, max: number) => Math.floor(between(min, max + 1));
const chance = (probability: number) => random() < probability;
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
const weighted = <T>(items: readonly { weight: number; value: T }[]): T | undefined => {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) {
      return item.value;
    }
  }
  return items.at(-1)?.value;
};
const poisson = (lambda: number) => {
  const limit = Math.exp(-lambda);
  let count = 0;
  let product = random();
  while (product > limit) {
    count += 1;
    product *= random();
  }
  return count;
};
const roundTo = (value: number, step: number) => Math.max(step, Math.round(value / step) * step);

// ---------------------------------------------------------------------------------------------
// Calendrier
// ---------------------------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const YEARS = 5;
const SEED_STARTED_AT = Date.now();
const NOW = new Date(SEED_STARTED_AT);
const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
const START = new Date(TODAY.getFullYear() - YEARS, TODAY.getMonth(), TODAY.getDate());

/** Midi local : la convention des dates saisies dans l'application. */
const noon = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12);
const addDays = (day: Date, days: number) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate() + days);
const yearsAgo = (day: Date) => (TODAY.getTime() - day.getTime()) / (365.25 * DAY_MS);
const yearsSinceStart = (day: Date) => YEARS - yearsAgo(day);
const sameDay = (a: Date, b: Date) => a.getTime() === b.getTime();
const atTime = (day: Date, hours: number) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, Math.round(hours * 60));

const CLOSED_DAYS = new Set(["1-1", "4-27", "12-25"]);
const isOpen = (day: Date) =>
  day.getDay() !== 0 && !CLOSED_DAYS.has(`${day.getMonth() + 1}-${day.getDate()}`);

// Heure d'une vente : pics en fin de matinée et en fin d'après-midi.
const saleHour = () =>
  weighted([
    { value: between(8, 10), weight: 2 },
    { value: between(10, 12.5), weight: 4 },
    { value: between(12.5, 15), weight: 2 },
    { value: between(15, 18.5), weight: 4 },
    { value: between(18.5, 19.5), weight: 1 },
  ]) ?? 11;

// ---------------------------------------------------------------------------------------------
// Taux de change (USD → FCFA, USD → RMB), interpolés entre des repères réalistes
// ---------------------------------------------------------------------------------------------

const FCFA_PER_USD: [number, number][] = [
  [0, 560],
  [0.5, 598],
  [1, 655],
  [1.4, 615],
  [2, 608],
  [2.6, 603],
  [3.1, 622],
  [3.6, 586],
  [4.1, 566],
  [5, 572],
];
const RMB_PER_USD: [number, number][] = [
  [0, 6.4],
  [0.5, 6.45],
  [1, 7.12],
  [1.7, 7.22],
  [2.7, 7.24],
  [3.2, 7.3],
  [3.8, 7.18],
  [5, 7.12],
];
const interpolate = (points: [number, number][], at: number) => {
  const [first] = points;
  if (!first || at <= first[0]) {
    return first?.[1] ?? 0;
  }
  for (let index = 1; index < points.length; index += 1) {
    const [x1, y1] = points[index - 1] as [number, number];
    const [x2, y2] = points[index] as [number, number];
    if (at <= x2) {
      return y1 + ((y2 - y1) * (at - x1)) / (x2 - x1);
    }
  }
  return points.at(-1)?.[1] ?? 0;
};
const ratesOn = (day: Date) => ({
  fcfaPerUsd: Math.round(interpolate(FCFA_PER_USD, yearsSinceStart(day))),
  rmbPerUsd: Math.round(interpolate(RMB_PER_USD, yearsSinceStart(day)) * 100) / 100,
});

// ---------------------------------------------------------------------------------------------
// Fournisseurs et catalogue
// ---------------------------------------------------------------------------------------------

type SupplierKey = "dubai" | "electric" | "steel" | "textile" | "yiwu";

const SUPPLIERS: Record<
  SupplierKey,
  {
    name: string;
    country: string;
    contact: string;
    phone: string;
    notes: string;
    currency: "rmb" | "usd";
    allocation: "value" | "weight";
    /** Fabrication puis traversée, en jours. */
    produce: [number, number];
    sea: [number, number];
    depositShare: number;
  }
> = {
  dubai: {
    allocation: "value",
    contact: "M. Rashid Khan",
    country: "Émirats arabes unis",
    currency: "usd",
    depositShare: 1,
    name: "Al Noor Textiles Trading LLC",
    notes: "Bazin et dentelle. Paiement complet à la commande, expédition sous une semaine.",
    phone: "+971 4 225 8841",
    produce: [5, 9],
    sea: [24, 32],
  },
  electric: {
    allocation: "value",
    contact: "Mme Sophia Xu",
    country: "Chine",
    currency: "usd",
    depositShare: 0.3,
    name: "Ningbo Brightlight Electric Co.",
    notes: "Câbles, éclairage, ventilateurs, solaire. Acompte 30 %, solde avant embarquement.",
    phone: "+86 574 8765 2210",
    produce: [20, 30],
    sea: [40, 52],
  },
  steel: {
    allocation: "weight",
    contact: "M. Zhang Lei",
    country: "Chine",
    currency: "usd",
    depositShare: 0.3,
    name: "Tianjin Hengda Steel Wire Co.",
    notes: "Fil galvanisé et pointes facturés à la tonne. Frais répartis au poids.",
    phone: "+86 22 2758 4413",
    produce: [18, 26],
    sea: [42, 55],
  },
  textile: {
    allocation: "value",
    contact: "Mme Lin Wei",
    country: "Chine",
    currency: "rmb",
    depositShare: 0.3,
    name: "Guangzhou Huaxin Textile Co., Ltd",
    notes: "Wax et voile brodé. Production 3 à 4 semaines.",
    phone: "+86 20 8732 5561",
    produce: [18, 28],
    sea: [38, 50],
  },
  yiwu: {
    allocation: "value",
    contact: "M. Chen Hao",
    country: "Chine",
    currency: "rmb",
    depositShare: 0.3,
    name: "Yiwu Fortune Trading Co.",
    notes: "Plastiques, bâches, articles de cuisine. Groupage au départ de Ningbo.",
    phone: "+86 579 8551 2290",
    produce: [14, 22],
    sea: [40, 52],
  },
};

type Season = "festive" | "heat" | "rain" | "school" | "steady";
const SEASONS: Record<Season, number[]> = {
  // Fêtes de fin d'année, Pâques et Tabaski (approchées).
  festive: [0.85, 0.9, 1.1, 1.15, 0.95, 1.05, 1.1, 0.95, 0.95, 1, 1.15, 1.6],
  // Grande saison des pluies (avril-juillet), petite saison (septembre-octobre).
  heat: [0.9, 1.6, 1.8, 1.6, 1.2, 0.8, 0.6, 0.6, 0.8, 1, 1.1, 1],
  rain: [0.65, 0.7, 0.95, 1.4, 1.6, 1.55, 1.35, 0.95, 1.2, 1.2, 0.85, 0.7],
  school: [0.9, 0.9, 0.95, 1, 1, 1, 0.95, 1.05, 1.45, 1.1, 0.95, 1.05],
  steady: [0.95, 0.95, 1, 1, 1, 1, 1, 0.95, 1, 1, 1, 1.15],
};

interface ProductDef {
  key: string;
  name: string;
  category: string;
  unit: string;
  reference: string;
  supplier: SupplierKey;
  /** Prix fournisseur actuel, en RMB par unité de stock. */
  rmb: number;
  /** Volume (m³) et poids (kg) d'une unité, pour le fret. */
  cbm: number;
  kg: number;
  /** Coefficient prix de vente / coût de revient. */
  markup: number;
  popularity: number;
  season: Season;
  retail: [number, number];
  reseller: [number, number];
  /** Arrivée au catalogue (années après le début) ; arrêt (années après le début). */
  launch?: number;
  discontinue?: number;
  pricedByWeight?: boolean;
  alertDays: number;
}

const PRODUCTS: ProductDef[] = [
  {
    alertDays: 25,
    category: "Tissus",
    cbm: 0.0025,
    key: "wax6",
    kg: 1.1,
    markup: 1.42,
    name: "Wax hollandais 6 yards",
    popularity: 10,
    reference: "TX-WAX-06",
    reseller: [6, 24],
    retail: [1, 3],
    rmb: 48,
    season: "festive",
    supplier: "textile",
    unit: "pièce",
  },
  {
    alertDays: 25,
    category: "Tissus",
    cbm: 0.004,
    key: "wax12",
    kg: 2.1,
    markup: 1.4,
    name: "Wax super 12 yards",
    popularity: 5,
    reference: "TX-WAX-12",
    reseller: [4, 12],
    retail: [1, 2],
    rmb: 85,
    season: "festive",
    supplier: "textile",
    unit: "pièce",
  },
  {
    alertDays: 25,
    category: "Tissus",
    cbm: 0.002,
    key: "voile",
    kg: 0.7,
    markup: 1.45,
    name: "Voile brodé 5 yards",
    popularity: 4,
    reference: "TX-VOI-05",
    reseller: [5, 15],
    retail: [1, 3],
    rmb: 60,
    season: "festive",
    supplier: "textile",
    unit: "pièce",
  },
  {
    alertDays: 30,
    category: "Tissus",
    cbm: 0.004,
    key: "bazin",
    kg: 1.6,
    markup: 1.38,
    name: "Bazin riche 10 m",
    popularity: 5,
    reference: "TX-BAZ-10",
    reseller: [3, 10],
    retail: [1, 2],
    rmb: 120,
    season: "festive",
    supplier: "dubai",
    unit: "pièce",
  },
  {
    alertDays: 30,
    category: "Tissus",
    cbm: 0.002,
    key: "dentelle",
    kg: 0.6,
    markup: 1.45,
    name: "Dentelle cordée 5 yards",
    popularity: 3,
    reference: "TX-DEN-05",
    reseller: [3, 8],
    retail: [1, 2],
    rmb: 95,
    season: "festive",
    supplier: "dubai",
    unit: "pièce",
  },
  {
    alertDays: 30,
    category: "Quincaillerie",
    cbm: 0.03,
    key: "galva",
    kg: 25,
    markup: 1.35,
    name: "Fil galvanisé 2,5 mm (25 kg)",
    popularity: 5,
    pricedByWeight: true,
    reference: "QC-GAL-25",
    reseller: [4, 15],
    retail: [1, 2],
    rmb: 105,
    season: "rain",
    supplier: "steel",
    unit: "rouleau",
  },
  {
    alertDays: 30,
    category: "Quincaillerie",
    cbm: 0.025,
    key: "pointes",
    kg: 25,
    markup: 1.35,
    name: "Pointes 70 mm (25 kg)",
    popularity: 5,
    pricedByWeight: true,
    reference: "QC-PTE-70",
    reseller: [3, 12],
    retail: [1, 2],
    rmb: 92,
    season: "rain",
    supplier: "steel",
    unit: "carton",
  },
  {
    alertDays: 30,
    category: "Quincaillerie",
    cbm: 0.05,
    key: "barbele",
    kg: 18,
    markup: 1.4,
    name: "Fil barbelé 200 m",
    popularity: 2,
    pricedByWeight: true,
    reference: "QC-BAR-200",
    reseller: [2, 8],
    retail: [1, 2],
    rmb: 128,
    season: "rain",
    supplier: "steel",
    unit: "rouleau",
  },
  {
    alertDays: 30,
    category: "Quincaillerie",
    cbm: 0.012,
    key: "tole",
    kg: 7,
    markup: 1.38,
    name: "Tôle bac alu 3 m",
    popularity: 4,
    pricedByWeight: true,
    reference: "QC-TOL-3M",
    reseller: [20, 80],
    retail: [2, 10],
    rmb: 36,
    season: "rain",
    supplier: "steel",
    unit: "feuille",
  },
  {
    alertDays: 30,
    category: "Électricité",
    cbm: 0.02,
    key: "cable",
    kg: 9,
    markup: 1.4,
    name: "Câble électrique 2,5 mm² (100 m)",
    popularity: 4,
    reference: "EL-CAB-25",
    reseller: [3, 10],
    retail: [1, 2],
    rmb: 175,
    season: "steady",
    supplier: "electric",
    unit: "rouleau",
  },
  {
    alertDays: 30,
    category: "Électricité",
    cbm: 0.06,
    key: "led",
    kg: 6,
    markup: 1.45,
    name: "Ampoules LED 12 W (carton de 100)",
    popularity: 3,
    reference: "EL-LED-12",
    reseller: [1, 4],
    retail: [1, 1],
    rmb: 255,
    season: "steady",
    supplier: "electric",
    unit: "carton",
  },
  {
    alertDays: 30,
    category: "Électricité",
    cbm: 0.05,
    key: "multiprise",
    kg: 7,
    markup: 1.45,
    name: "Multiprises 5 prises (carton de 20)",
    popularity: 2,
    reference: "EL-MUL-05",
    reseller: [1, 3],
    retail: [1, 1],
    rmb: 205,
    season: "steady",
    supplier: "electric",
    unit: "carton",
  },
  {
    alertDays: 30,
    category: "Électricité",
    cbm: 0.05,
    key: "ventilo",
    kg: 5,
    markup: 1.42,
    name: 'Ventilateur sur pied 16"',
    popularity: 3,
    reference: "EL-VEN-16",
    reseller: [3, 12],
    retail: [1, 2],
    rmb: 74,
    season: "heat",
    supplier: "electric",
    unit: "pièce",
  },
  {
    alertDays: 35,
    category: "Électricité",
    cbm: 0.08,
    key: "solaire",
    kg: 8,
    launch: 2.4,
    markup: 1.4,
    name: "Panneau solaire 100 W",
    popularity: 4,
    reference: "EL-SOL-100",
    reseller: [2, 8],
    retail: [1, 2],
    rmb: 210,
    season: "heat",
    supplier: "electric",
    unit: "pièce",
  },
  {
    alertDays: 30,
    category: "Électricité",
    cbm: 0.05,
    discontinue: 1.6,
    key: "incandescence",
    kg: 5,
    markup: 1.45,
    name: "Ampoules à incandescence 60 W (carton de 100)",
    popularity: 2,
    reference: "EL-INC-60",
    reseller: [1, 3],
    retail: [1, 1],
    rmb: 90,
    season: "steady",
    supplier: "electric",
    unit: "carton",
  },
  {
    alertDays: 30,
    category: "Plastiques",
    cbm: 0.06,
    key: "seau",
    kg: 6,
    markup: 1.45,
    name: "Seaux plastique 20 L (lot de 10)",
    popularity: 3,
    reference: "PL-SEA-20",
    reseller: [2, 8],
    retail: [1, 1],
    rmb: 52,
    season: "school",
    supplier: "yiwu",
    unit: "lot",
  },
  {
    alertDays: 30,
    category: "Plastiques",
    cbm: 0.025,
    key: "chaise",
    kg: 2.5,
    markup: 1.5,
    name: "Chaise plastique monobloc",
    popularity: 4,
    reference: "PL-CHA-01",
    reseller: [10, 40],
    retail: [1, 6],
    rmb: 27,
    season: "festive",
    supplier: "yiwu",
    unit: "pièce",
  },
  {
    alertDays: 30,
    category: "Plastiques",
    cbm: 0.006,
    key: "bache",
    kg: 2,
    markup: 1.48,
    name: "Bâche 4 × 6 m",
    popularity: 3,
    reference: "PL-BAC-46",
    reseller: [5, 20],
    retail: [1, 2],
    rmb: 44,
    season: "rain",
    supplier: "yiwu",
    unit: "pièce",
  },
  {
    alertDays: 30,
    category: "Plastiques",
    cbm: 0.01,
    key: "natte",
    kg: 1.5,
    markup: 1.5,
    name: "Natte plastique 2 × 3 m",
    popularity: 2,
    reference: "PL-NAT-23",
    reseller: [5, 20],
    retail: [1, 3],
    rmb: 21,
    season: "school",
    supplier: "yiwu",
    unit: "pièce",
  },
  {
    alertDays: 30,
    category: "Cuisine",
    cbm: 0.02,
    key: "marmite",
    kg: 2.2,
    markup: 1.45,
    name: "Marmite aluminium n° 30",
    popularity: 2,
    reference: "CU-MAR-30",
    reseller: [3, 10],
    retail: [1, 2],
    rmb: 63,
    season: "festive",
    supplier: "yiwu",
    unit: "pièce",
  },
  {
    alertDays: 30,
    category: "Cuisine",
    cbm: 0.09,
    key: "glaciere",
    kg: 4,
    markup: 1.42,
    name: "Glacière 45 L",
    popularity: 2,
    reference: "CU-GLA-45",
    reseller: [2, 6],
    retail: [1, 1],
    rmb: 108,
    season: "heat",
    supplier: "yiwu",
    unit: "pièce",
  },
  {
    alertDays: 30,
    category: "Cuisine",
    cbm: 0.06,
    key: "thermos",
    kg: 6,
    markup: 1.45,
    name: "Thermos 2 L (carton de 12)",
    popularity: 1,
    reference: "CU-THE-02",
    reseller: [1, 4],
    retail: [1, 1],
    rmb: 148,
    season: "steady",
    supplier: "yiwu",
    unit: "carton",
  },
];

/** Prix fournisseur à une date : +2,5 % par an jusqu'au prix actuel, avec un peu de variation. */
const supplierRmbOn = (def: ProductDef, day: Date) =>
  (def.rmb / 1.025 ** yearsAgo(day)) * between(0.97, 1.03);

/** Fret maritime en groupage : environ 210 $ le mètre cube. */
const FREIGHT_USD_PER_CBM = 210;
/** Douane (~15 %), transit et transport local (~4 %), en part de la marchandise. */
const IMPORT_COSTS_SHARE = 0.19;

/**
 * Le fret se répartit comme dans l'application : selon la valeur (ou le poids, pour l'acier). Le
 * tarif part donc du volume moyen du fournisseur par yuan (ou par kilo) de marchandise.
 */
const freightBasis = (supplier: SupplierKey) => {
  const items = PRODUCTS.filter((def) => def.supplier === supplier);
  const byWeight = SUPPLIERS[supplier].allocation === "weight";
  const average = items.reduce((sum, def) => sum + def.cbm / (byWeight ? def.kg : def.rmb), 0);
  return average / items.length;
};

/** Coût de revient estimé d'une unité : marchandise, frais d'import et part du fret. */
const landedCostOn = (def: ProductDef, day: Date) => {
  const rates = ratesOn(day);
  const goodsRmb = def.rmb / 1.025 ** yearsAgo(day);
  const goodsFcfa = goodsRmb * (rates.fcfaPerUsd / rates.rmbPerUsd);
  const byWeight = SUPPLIERS[def.supplier].allocation === "weight";
  const cbm = freightBasis(def.supplier) * (byWeight ? def.kg : goodsRmb);
  return Math.round(
    goodsFcfa * (1 + IMPORT_COSTS_SHARE) + cbm * FREIGHT_USD_PER_CBM * rates.fcfaPerUsd,
  );
};

/** Le tarif est revu chaque trimestre, à partir du coût de revient du moment. */
const quarterStart = (day: Date) =>
  new Date(day.getFullYear(), Math.floor(day.getMonth() / 3) * 3, 1);
const priceOn = (def: ProductDef, day: Date) =>
  roundTo(landedCostOn(def, quarterStart(day)) * def.markup, 100);
const currentPrice = (def: ProductDef) => roundTo(priceOn(def, TODAY), 500);

// ---------------------------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------------------------

const QUARTIERS = [
  "Bè",
  "Tokoin",
  "Adidogomé",
  "Agoè-Nyivé",
  "Nyékonakpoè",
  "Hédzranawoé",
  "Kodjoviakopé",
  "Grand marché",
  "Déckon",
  "Avédji",
  "Baguida",
  "Bè-Kpota",
  "Kégué",
  "Totsi",
  "Djidjolé",
];
const phone = () =>
  `${pick(["90", "91", "92", "93", "96", "97", "98", "99", "70", "79"])} ${integer(10, 99)} ${integer(10, 99)} ${integer(10, 99)}`;

interface CustomerDef {
  name: string;
  kind: "counter" | "person" | "reseller";
  categories: string[];
  /** Visites relatives (revendeurs). */
  frequency: number;
  credit: number;
  /** Délai de paiement d'une vente à crédit, en jours. */
  payDays: [number, number];
  /** Arrivée (années après le début). */
  since: number;
  /** Cesse de payer à partir de cette date (années après le début). */
  stopsPaying?: number;
  id?: string;
}

const RESELLERS: CustomerDef[] = [
  {
    categories: ["Tissus"],
    credit: 0.45,
    frequency: 6,
    kind: "reseller",
    name: "Boutique Sainte Rita",
    payDays: [45, 110],
    since: 0,
  },
  {
    categories: ["Tissus"],
    credit: 0.35,
    frequency: 5,
    kind: "reseller",
    name: "Couture Élégance Tokoin",
    payDays: [10, 35],
    since: 0,
  },
  {
    categories: ["Tissus"],
    credit: 0.3,
    frequency: 4,
    kind: "reseller",
    name: "Ets Maman Bénie",
    payDays: [7, 30],
    since: 0.3,
  },
  {
    categories: ["Tissus"],
    credit: 0.4,
    frequency: 3,
    kind: "reseller",
    name: "Tissus Akofa",
    payDays: [15, 45],
    since: 1.2,
  },
  {
    categories: ["Tissus"],
    credit: 0.25,
    frequency: 3,
    kind: "reseller",
    name: "Pagnes Dédé Adawlato",
    payDays: [7, 25],
    since: 2.1,
  },
  {
    categories: ["Tissus", "Cuisine"],
    credit: 0.2,
    frequency: 2,
    kind: "reseller",
    name: "Boutique Grâce Divine",
    payDays: [10, 30],
    since: 3.2,
  },
  {
    categories: ["Quincaillerie"],
    credit: 0.5,
    frequency: 6,
    kind: "reseller",
    name: "Quincaillerie La Bénédiction",
    payDays: [15, 40],
    since: 0,
  },
  {
    categories: ["Quincaillerie"],
    credit: 0.55,
    frequency: 4,
    kind: "reseller",
    name: "Chantier Agoè BTP",
    payDays: [20, 60],
    since: 0.8,
    stopsPaying: 4.55,
  },
  {
    categories: ["Quincaillerie"],
    credit: 0.4,
    frequency: 4,
    kind: "reseller",
    name: "Ets Dieu Merci Matériaux",
    payDays: [10, 35],
    since: 0.2,
  },
  {
    categories: ["Quincaillerie", "Plastiques"],
    credit: 0.35,
    frequency: 3,
    kind: "reseller",
    name: "Quincaillerie du Rond-point",
    payDays: [10, 30],
    since: 1.5,
  },
  {
    categories: ["Quincaillerie"],
    credit: 0.45,
    frequency: 3,
    kind: "reseller",
    name: "Bâtir Plus Togo",
    payDays: [20, 50],
    since: 2.6,
  },
  {
    categories: ["Électricité"],
    credit: 0.4,
    frequency: 5,
    kind: "reseller",
    name: "Électro Plus Bè",
    payDays: [10, 35],
    since: 0,
  },
  {
    categories: ["Électricité"],
    credit: 0.3,
    frequency: 3,
    kind: "reseller",
    name: "Lumière du Monde",
    payDays: [7, 25],
    since: 0.9,
  },
  {
    categories: ["Électricité"],
    credit: 0.35,
    frequency: 3,
    kind: "reseller",
    name: "Solaire Afrique Services",
    payDays: [15, 40],
    since: 2.5,
  },
  {
    categories: ["Électricité", "Quincaillerie"],
    credit: 0.3,
    frequency: 2,
    kind: "reseller",
    name: "Kossi Électricité Générale",
    payDays: [10, 30],
    since: 1.8,
  },
  {
    categories: ["Plastiques", "Cuisine"],
    credit: 0.3,
    frequency: 4,
    kind: "reseller",
    name: "Bazar Akwaba",
    payDays: [7, 30],
    since: 0,
  },
  {
    categories: ["Plastiques", "Cuisine"],
    credit: 0.25,
    frequency: 3,
    kind: "reseller",
    name: "Alimentation Générale Espoir",
    payDays: [7, 20],
    since: 0.6,
  },
  {
    categories: ["Plastiques"],
    credit: 0.3,
    frequency: 2,
    kind: "reseller",
    name: "Ets Yawa & Fils",
    payDays: [10, 30],
    since: 2.9,
  },
  {
    categories: ["Cuisine", "Plastiques", "Tissus"],
    credit: 0.2,
    frequency: 2,
    kind: "reseller",
    name: "Marché Hédzranawoé — Mme Ablavi",
    payDays: [7, 21],
    since: 3.6,
  },
  {
    categories: ["Quincaillerie", "Électricité"],
    credit: 0.35,
    frequency: 2,
    kind: "reseller",
    name: "Atelier Mécanique Kégué",
    payDays: [10, 30],
    since: 4.1,
  },
];

const FIRST_NAMES = [
  "Afi",
  "Kossi",
  "Yawa",
  "Komlan",
  "Ama",
  "Kodjo",
  "Abla",
  "Edem",
  "Mawuli",
  "Akouvi",
  "Koffi",
  "Adjo",
  "Sena",
  "Elom",
  "Dzifa",
  "Kokou",
  "Ayélé",
  "Yao",
  "Essi",
  "Mensah",
  "Akossiwa",
  "Kwami",
  "Enyonam",
  "Foli",
  "Délali",
  "Agbéko",
  "Mawuena",
  "Sélom",
  "Kafui",
  "Efua",
];
const LAST_NAMES = [
  "Mensah",
  "Agbeko",
  "Ahiadji",
  "Dossou",
  "Lawson",
  "Amouzou",
  "Kpodar",
  "Tsogbe",
  "Adjovi",
  "Akakpo",
  "Gbadoé",
  "Ayité",
  "Koudawo",
  "Amegah",
  "Dogbé",
  "Attiogbé",
  "Kpélly",
  "Sossou",
  "Djossou",
  "Afanou",
  "Agbodjan",
  "Hounkpati",
  "Kponton",
  "Ekué",
  "Adzoh",
];
const PEOPLE: CustomerDef[] = Array.from({ length: 70 }, (_, index) => ({
  categories: [],
  credit: index % 9 === 0 ? 0.15 : 0.03,
  frequency: 1,
  kind: "person",
  name: `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[(index * 7) % LAST_NAMES.length]}`,
  payDays: [7, 30],
  since: (index / 70) * 4.8,
}));
const COUNTER: CustomerDef = {
  categories: [],
  credit: 0,
  frequency: 1,
  kind: "counter",
  name: "Client comptoir",
  payDays: [0, 0],
  since: 0,
};

// ---------------------------------------------------------------------------------------------
// État de la simulation
// ---------------------------------------------------------------------------------------------

interface ProductState {
  def: ProductDef;
  id: string;
  stock: number;
  inTransit: number;
  /** Demande moyenne par jour (ventes souhaitées, y compris celles manquées faute de stock). */
  demand: number;
  archived: boolean;
}

interface PendingOrder {
  id: string;
  supplier: SupplierKey;
  items: { productId: string; qty: number }[];
  goodsAmount: number;
  cbm: number;
  goodsFcfa: number;
  shipOn: Date;
  arriveOn: Date;
  receiveOn: Date;
  shipped: boolean;
}

interface Installment {
  on: Date;
  saleId: string;
  customer: CustomerDef;
  /** `null` : solde le reste dû. */
  amount: number | null;
}

const products = new Map<string, ProductState>();
const supplierIds = new Map<SupplierKey, string>();
const pending: PendingOrder[] = [];
const lastOrderOn = new Map<SupplierKey, Date>();
const dueBySale = new Map<string, number>();
let installments: Installment[] = [];
const stats = { cancelled: 0, discounts: 0, orders: 0, payments: 0, sales: 0 };

let managerId = "";
let sellerId = "";
let counterId = "";

const productsOf = (supplier: SupplierKey) =>
  [...products.values()].filter((product) => product.def.supplier === supplier);
const isOrderable = (product: ProductState, day: Date) =>
  !product.archived &&
  yearsSinceStart(day) >= (product.def.launch ?? 0) &&
  yearsSinceStart(day) < (product.def.discontinue ?? Number.POSITIVE_INFINITY);

// ---------------------------------------------------------------------------------------------
// Dates d'enregistrement : la base date chaque ligne à l'instant de l'insertion ; on les ramène
// au jour simulé pour que historiques et graphiques soient cohérents.
// ---------------------------------------------------------------------------------------------

const lastRowIds = new Map<string, number>();
let datedTables: { name: string; created: boolean; updated: boolean }[] = [];

const loadDatedTables = async (db: Database) => {
  const tables = await db.$client.execute(
    "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '__drizzle%'",
  );
  datedTables = [];
  for (const row of tables.rows) {
    const name = String(row.name);
    const columns = await db.$client.execute(`pragma table_info("${name}")`);
    const names = new Set(columns.rows.map((column) => String(column.name)));
    if (names.has("created_at") || names.has("updated_at")) {
      datedTables.push({
        created: names.has("created_at"),
        name,
        updated: names.has("updated_at"),
      });
    }
  }
};

/** Lignes créées ou modifiées pendant la journée simulée : datées du soir de ce jour. */
const stampDay = async (db: Database, day: Date) => {
  const evening = atTime(day, 19.5).getTime();
  for (const table of datedTables) {
    const last = lastRowIds.get(table.name) ?? 0;
    if (table.created) {
      await db.$client.execute({
        args: [evening, last, SEED_STARTED_AT],
        sql: `update "${table.name}" set created_at = ? where rowid > ? and created_at >= ?`,
      });
    }
    if (table.updated) {
      await db.$client.execute({
        args: [evening, SEED_STARTED_AT],
        sql: `update "${table.name}" set updated_at = ? where updated_at >= ?`,
      });
    }
    const max = await db.$client.execute(
      `select coalesce(max(rowid), 0) as id from "${table.name}"`,
    );
    lastRowIds.set(table.name, Number(max.rows[0]?.id ?? 0));
  }
};

const stampSale = async (executor: Executor, saleId: string, at: Date) => {
  const ms = at.getTime();
  await executor.run(sql`update sales set created_at = ${ms} where id = ${saleId}`);
  await executor.run(
    sql`update stock_movements set created_at = ${ms} where reference_type = 'sale' and reference_id = ${saleId}`,
  );
  await executor.run(sql`update payments set created_at = ${ms} where sale_id = ${saleId}`);
};

// ---------------------------------------------------------------------------------------------
// Achats
// ---------------------------------------------------------------------------------------------

const leadDays = (supplier: SupplierKey) => {
  const def = SUPPLIERS[supplier];
  return (def.produce[0] + def.produce[1]) / 2 + (def.sea[0] + def.sea[1]) / 2 + 6;
};

const packStep = (def: ProductDef) => (def.category === "Tissus" || def.key === "tole" ? 10 : 5);

const fcfaPerOrderUnit = (supplier: SupplierKey, day: Date) => {
  const rates = ratesOn(day);
  return SUPPLIERS[supplier].currency === "usd"
    ? rates.fcfaPerUsd
    : rates.fcfaPerUsd / rates.rmbPerUsd;
};

const payOrder = async (
  executor: Executor,
  orderId: string,
  supplier: SupplierKey,
  goodsAmount: number,
  share: number,
  day: Date,
  notes: string,
) => {
  const rate = fcfaPerOrderUnit(supplier, day) * between(0.995, 1.012);
  await createSupplierPayment(
    executor,
    {
      // Acompte arrondi au millier ; paiement complet au franc près.
      amountFcfa:
        share >= 1 ? Math.ceil(goodsAmount * rate) : roundTo(goodsAmount * share * rate, 1000),
      fcfaRate: Math.round(rate * 100) / 100,
      notes,
      orderId,
      paymentDate: noon(day),
    },
    managerId,
  );
};

const placeOrder = async (executor: Executor, supplier: SupplierKey, day: Date, force = false) => {
  const lead = leadDays(supplier);
  const lines: { product: ProductState; qty: number }[] = [];
  for (const product of productsOf(supplier)) {
    if (!isOrderable(product, day)) {
      continue;
    }
    const position = product.stock + product.inTransit;
    const urgent = position < product.demand * (lead + 30);
    const topUp = position < product.demand * (lead + 70);
    if (urgent || (force && topUp) || (product.stock === 0 && product.inTransit === 0)) {
      const target = product.demand * (lead + 110) - position;
      if (target > 0) {
        lines.push({ product, qty: roundTo(target, packStep(product.def)) });
      }
    }
  }
  if (
    lines.length === 0 ||
    !lines.some(
      (line) => line.product.stock + line.product.inTransit < line.product.demand * (lead + 30),
    )
  ) {
    return;
  }
  // Une commande groupe aussi les produits du même fournisseur qui baisseront bientôt.
  for (const product of productsOf(supplier)) {
    if (!isOrderable(product, day) || lines.some((line) => line.product === product)) {
      continue;
    }
    const position = product.stock + product.inTransit;
    if (position < product.demand * (lead + 70)) {
      lines.push({
        product,
        qty: roundTo(product.demand * (lead + 110) - position, packStep(product.def)),
      });
    }
  }

  const config = SUPPLIERS[supplier];
  const rates = ratesOn(day);
  const items = lines.map(({ product, qty }) => {
    const rmb = supplierRmbOn(product.def, day);
    const unitPriceInCurrency = config.currency === "usd" ? rmb / rates.rmbPerUsd : rmb;
    const weightTons = Math.round(((qty * product.def.kg) / 1000) * 1000) / 1000;
    if (product.def.pricedByWeight && product.def.key !== "tole") {
      // Prix à la tonne.
      return {
        pricingBasis: "weight" as const,
        productId: product.id,
        qty,
        trips: 1,
        unitPrice: Math.round(((unitPriceInCurrency * 1000) / product.def.kg) * 100) / 100,
        weightTons,
      };
    }
    return {
      pricingBasis: "unit" as const,
      productId: product.id,
      qty,
      trips: 1,
      unitPrice: Math.round(unitPriceInCurrency * 100) / 100,
      weightTons: config.allocation === "weight" ? weightTons : null,
    };
  });
  const goodsAmount = items.reduce(
    (sum, item) =>
      sum +
      (item.pricingBasis === "weight"
        ? item.unitPrice * (item.weightTons ?? 0)
        : item.unitPrice * item.qty),
    0,
  );
  const goodsFcfa = goodsAmount * fcfaPerOrderUnit(supplier, day);
  const cbm =
    Math.round(lines.reduce((sum, line) => sum + line.qty * line.product.def.cbm, 0) * 10) / 10;

  // Incident récent : les dernières commandes d'acier arrivent avec des semaines de retard, d'où
  // des alertes de stock bas et de rupture sur la quincaillerie aujourd'hui.
  const delayed = supplier === "steel" && yearsAgo(day) < 0.4;
  const order = await createPurchaseOrder(executor, {
    allocationMethod: config.allocation,
    currency: config.currency,
    fcfaPerUsd: rates.fcfaPerUsd,
    freightCbm: cbm,
    freightRatePerCbmFcfa: roundTo(between(112_000, 135_000) * (rates.fcfaPerUsd / 600), 1000),
    items,
    localTransportFcfa: roundTo(between(55_000, 120_000), 5000),
    notes: delayed
      ? "Retard annoncé : conteneur bloqué au transbordement, arrivée repoussée de 6 à 8 semaines."
      : pick([
          null,
          null,
          "Commande groupée, chargement en conteneur partagé.",
          "Vérifier l'emballage à la réception (casse lors du dernier envoi).",
          "Prix négociés pour la saison.",
        ]),
    orderDate: noon(day),
    otherFeesFcfa: roundTo(goodsFcfa * 0.15, 1000),
    rmbPerUsd: rates.rmbPerUsd,
    supplierId: supplierIds.get(supplier) ?? null,
  });
  await setPurchaseStatus(executor, order.id, "ordered");
  await payOrder(
    executor,
    order.id,
    supplier,
    goodsAmount,
    config.depositShare,
    day,
    config.depositShare >= 1 ? "Paiement complet à la commande" : "Acompte de 30 % à la commande",
  );

  const shipOn = addDays(day, integer(...config.produce));
  const arriveOn = addDays(shipOn, integer(...config.sea) + (delayed ? integer(45, 60) : 0));
  pending.push({
    arriveOn,
    cbm,
    goodsAmount,
    goodsFcfa,
    id: order.id,
    items: lines.map((line) => ({ productId: line.product.id, qty: line.qty })),
    receiveOn: addDays(arriveOn, integer(3, 9)),
    shipOn,
    shipped: false,
    supplier,
  });
  for (const line of lines) {
    line.product.inTransit += line.qty;
  }
  lastOrderOn.set(supplier, day);
  stats.orders += 1;
};

const FORWARDERS = ["Bolloré Transport & Logistics Togo", "Maersk Lomé", "Getma Togo", "MSC Togo"];
const CONTAINER_PREFIXES = ["MSCU", "MAEU", "CMAU", "TGHU", "OOLU"];

const advanceOrders = async (executor: Executor, day: Date) => {
  for (const order of pending.filter((entry) => !entry.shipped && sameDay(entry.shipOn, day))) {
    await setPurchaseStatus(executor, order.id, "in_transit");
    const share = SUPPLIERS[order.supplier].depositShare;
    if (share < 1) {
      // Le solde est payé au franc près, au taux du jour.
      const detail = await getPurchaseOrder(executor, order.id);
      const rate = fcfaPerOrderUnit(order.supplier, day) * between(0.995, 1.012);
      if (detail.payment.remainingAmount > 0) {
        await createSupplierPayment(
          executor,
          {
            amountFcfa: Math.ceil(detail.payment.remainingAmount * rate),
            fcfaRate: rate,
            notes: "Solde avant embarquement",
            orderId: order.id,
            paymentDate: noon(day),
          },
          managerId,
        );
      }
    }
    order.shipped = true;
  }

  for (const order of pending.filter((entry) => sameDay(entry.receiveOn, day))) {
    const detail = await getPurchaseOrder(executor, order.id);
    const allocationMethod = SUPPLIERS[order.supplier].allocation;
    const rates = ratesOn(day);
    await receivePurchaseOrder(executor, {
      arrivedAt: noon(order.arriveOn),
      billOfLading: `${pick(["MEDU", "MAEU", "CMDU"])}${integer(10_000_000, 99_999_999)}`,
      containerNumber: `${pick(CONTAINER_PREFIXES)}${integer(1_000_000, 9_999_999)}`,
      fees: [
        {
          allocationMethod,
          amount: Math.round(order.cbm * between(185, 235)),
          currency: "usd",
          label: "Fret maritime (groupage)",
        },
        {
          allocationMethod,
          amount: roundTo(order.goodsFcfa * between(0.13, 0.17), 1000),
          currency: "fcfa",
          label: "Dédouanement et taxes",
        },
        {
          allocationMethod,
          amount: roundTo(between(150_000, 280_000) * (rates.fcfaPerUsd / 600), 5000),
          currency: "fcfa",
          label: "Transit et manutention port",
        },
        {
          allocationMethod,
          amount: roundTo(between(45_000, 110_000), 5000),
          currency: "fcfa",
          label: "Transport port → magasin",
        },
      ],
      forwarder: pick(FORWARDERS),
      id: order.id,
      items: detail.items.map((item) => ({
        id: item.id,
        // Un peu de casse ou de manquants sur une ligne sur douze.
        qtyReceived: chance(1 / 12)
          ? item.qty - Math.max(1, Math.round(item.qty * between(0.01, 0.03)))
          : item.qty,
      })),
      receivedAt: noon(day),
      userId: managerId,
    });
    const received = await getPurchaseOrder(executor, order.id);
    for (const item of received.items) {
      const product = products.get(item.productId);
      if (product) {
        product.stock += item.qtyReceived ?? item.qty;
        product.inTransit -= item.qty;
      }
    }
  }
  for (let index = pending.length - 1; index >= 0; index -= 1) {
    if (sameDay((pending[index] as PendingOrder).receiveOn, day)) {
      pending.splice(index, 1);
    }
  }
};

// ---------------------------------------------------------------------------------------------
// Ventes
// ---------------------------------------------------------------------------------------------

const BASE_SALES_PER_DAY = 5.4;
const GROWTH_PER_YEAR = 1.12;
const WEEKDAY_FACTORS = [0, 0.95, 1, 1, 1, 1.05, 1.3];

const salesPerDay = (day: Date) =>
  BASE_SALES_PER_DAY *
  GROWTH_PER_YEAR ** yearsSinceStart(day) *
  (SEASONS.steady[day.getMonth()] ?? 1) *
  (WEEKDAY_FACTORS[day.getDay()] ?? 1);

const customerPool = (day: Date) => {
  const since = yearsSinceStart(day);
  return {
    people: PEOPLE.filter((customer) => customer.since <= since),
    resellers: RESELLERS.filter((customer) => customer.since <= since),
  };
};

const ensureCustomer = async (executor: Executor, customer: CustomerDef) => {
  if (customer.id) {
    return customer.id;
  }
  const created = await createCustomer(executor, {
    address: customer.kind === "counter" ? null : `${pick(QUARTIERS)}, Lomé`,
    name: customer.name,
    notes:
      customer.kind === "reseller"
        ? `Revendeur : ${customer.categories.join(", ").toLowerCase()}.`
        : null,
    phone: customer.kind === "counter" ? null : phone(),
  });
  customer.id = created.id;
  return created.id;
};

const chooseProduct = (day: Date, categories: string[]) =>
  weighted(
    [...products.values()]
      .filter((product) => !product.archived && (isOrderable(product, day) || product.stock > 0))
      .filter((product) => categories.length === 0 || categories.includes(product.def.category))
      .map((product) => ({
        value: product,
        weight: product.def.popularity * (SEASONS[product.def.season][day.getMonth()] ?? 1),
      })),
  );

/** Demande attendue par produit et par jour, estimée sur des journées fictives. */
const estimateDemand = (day: Date) => {
  const totals = new Map<string, number>();
  const SAMPLE_DAYS = 300;
  for (let sample = 0; sample < SAMPLE_DAYS; sample += 1) {
    const count = poisson(BASE_SALES_PER_DAY * GROWTH_PER_YEAR ** yearsSinceStart(day) * 0.95);
    for (let index = 0; index < count; index += 1) {
      const reseller = chance(0.3);
      const lineCount = reseller ? integer(1, 3) : integer(1, 2);
      const categories = reseller ? pick(RESELLERS).categories : [];
      for (let line = 0; line < lineCount; line += 1) {
        const product = chooseProduct(day, categories);
        if (product) {
          const range = reseller ? product.def.reseller : product.def.retail;
          totals.set(product.id, (totals.get(product.id) ?? 0) + (range[0] + range[1]) / 2);
        }
      }
    }
  }
  return totals;
};

const DEMAND_SMOOTHING = 1 / 45;

const scheduleRepayment = (saleId: string, customer: CustomerDef, day: Date) => {
  const parts = chance(0.6) ? 1 : integer(2, 3);
  const last = integer(customer.payDays[0], customer.payDays[1]);
  for (let part = 1; part <= parts; part += 1) {
    installments.push({
      amount: part === parts ? null : -1,
      customer,
      on: addDays(day, Math.round((last * part) / parts)),
      saleId,
    });
  }
};

interface SaleLine {
  product: ProductState;
  qty: number;
  unitPriceFcfa: number;
}

/** Un client sur deux au comptoir, un sur cinq particulier connu, le reste des revendeurs. */
const chooseCustomer = (day: Date): CustomerDef => {
  const pool = customerPool(day);
  const roll = random();
  if (roll < 0.5 || pool.people.length === 0) {
    return COUNTER;
  }
  if (roll < 0.7) {
    return pick(pool.people);
  }
  return (
    weighted(pool.resellers.map((entry) => ({ value: entry, weight: entry.frequency }))) ?? COUNTER
  );
};

/** Lignes voulues par le client, limitées au stock ; la demande inclut ce qui manquait. */
const buildLines = (day: Date, customer: CustomerDef, desired: Map<string, number>) => {
  const reseller = customer.kind === "reseller";
  const lines: SaleLine[] = [];
  const lineCount = reseller ? integer(1, 3) : integer(1, 2);
  for (let index = 0; index < lineCount; index += 1) {
    const product = chooseProduct(day, customer.categories);
    if (!product || lines.some((line) => line.product === product)) {
      continue;
    }
    const range = reseller ? product.def.reseller : product.def.retail;
    const wanted = integer(range[0], range[1]);
    desired.set(product.id, (desired.get(product.id) ?? 0) + wanted);
    const qty = Math.min(wanted, product.stock);
    if (qty > 0) {
      const listPrice = priceOn(product.def, day);
      lines.push({
        product,
        qty,
        unitPriceFcfa: reseller ? roundTo(listPrice * (1 - between(0.03, 0.08)), 100) : listPrice,
      });
    }
  }
  return lines;
};

const paymentMethodFor = (reseller: boolean) =>
  weighted([
    { value: "cash" as const, weight: 72 },
    { value: "mobile_money" as const, weight: 22 },
    { value: "bank" as const, weight: reseller ? 8 : 0 },
  ]) ?? "cash";

/** Annulation le jour même (rare) : le stock revient. */
const maybeCancel = async (executor: Executor, saleId: string, lines: SaleLine[]) => {
  if (!chance(0.004)) {
    return false;
  }
  await cancelSale(
    executor,
    {
      id: saleId,
      reason: pick([
        "Erreur de saisie : mauvais produit.",
        "Le client a renoncé avant l'enlèvement.",
        "Vente enregistrée deux fois.",
      ]),
    },
    managerId,
  );
  for (const line of lines) {
    line.product.stock += line.qty;
  }
  stats.cancelled += 1;
  return true;
};

/** Vente à crédit : échéancier de remboursement, et parfois une remise accordée après coup. */
const followCredit = async (
  executor: Executor,
  saleId: string,
  customer: CustomerDef,
  day: Date,
  total: number,
  due: number,
) => {
  dueBySale.set(saleId, due);
  scheduleRepayment(saleId, customer, day);
  if (customer.kind !== "reseller" || !chance(0.05)) {
    return;
  }
  const discount = roundTo(total * between(0.02, 0.05), 500);
  if (discount >= due) {
    return;
  }
  await addSaleDiscount(
    executor,
    {
      amountFcfa: discount,
      discountDate: noon(day),
      reason: pick([
        "Geste commercial : client fidèle.",
        "Article légèrement abîmé à la livraison.",
        "Alignement sur le prix du marché.",
      ]),
      saleId,
    },
    managerId,
  );
  dueBySale.set(saleId, due - discount);
  stats.discounts += 1;
};

const SALE_NOTES = [
  "Livraison au magasin du client.",
  "Enlèvement demain matin.",
  "Commande passée par téléphone.",
];

const sellOne = async (
  executor: Executor,
  day: Date,
  hour: number,
  desired: Map<string, number>,
) => {
  const customer = chooseCustomer(day);
  const reseller = customer.kind === "reseller";
  const lines = buildLines(day, customer, desired);
  if (lines.length === 0) {
    return;
  }
  const total = lines.reduce((sum, line) => sum + line.qty * line.unitPriceFcfa, 0);
  const credit = chance(customer.credit);
  const paidFcfa =
    credit && chance(0.5) ? Math.min(total, roundTo(total * between(0.2, 0.5), 1000)) : 0;
  const sale = await createSale(
    executor,
    {
      customerId: await ensureCustomer(executor, customer),
      lines: lines.map((line) => ({
        productId: line.product.id,
        qty: line.qty,
        unitPriceFcfa: line.unitPriceFcfa,
      })),
      notes: reseller && chance(0.08) ? pick(SALE_NOTES) : null,
      paidFcfa,
      paymentMethod: credit ? "cash" : paymentMethodFor(reseller),
      paymentType: credit ? "credit" : "cash",
      saleDate: noon(day),
    },
    chance(0.65) ? sellerId : managerId,
  );
  await stampSale(executor, sale.id, atTime(day, hour));
  for (const line of lines) {
    line.product.stock -= line.qty;
  }
  stats.sales += 1;
  if (await maybeCancel(executor, sale.id, lines)) {
    return;
  }
  if (credit) {
    await followCredit(executor, sale.id, customer, day, total, total - paidFcfa);
  }
};

const sellDay = async (executor: Executor, day: Date, fraction: number) => {
  const desired = new Map<string, number>();
  const count = poisson(salesPerDay(day) * fraction);
  const hours = Array.from({ length: count }, () => saleHour()).toSorted((a, b) => a - b);
  // Aujourd'hui : rien après l'heure actuelle.
  const latest = sameDay(day, TODAY)
    ? (NOW.getTime() - TODAY.getTime()) / 3_600_000 - 0.1
    : Number.POSITIVE_INFINITY;
  for (const hour of hours.filter((value) => value <= latest)) {
    await sellOne(executor, day, hour, desired);
  }
  for (const product of products.values()) {
    const observed = (desired.get(product.id) ?? 0) / Math.max(fraction, 0.05);
    product.demand += (observed - product.demand) * DEMAND_SMOOTHING;
  }
};

const collectPayments = async (executor: Executor, day: Date) => {
  const today = installments.filter((entry) => sameDay(entry.on, day));
  if (today.length === 0) {
    return;
  }
  installments = installments.filter((entry) => !sameDay(entry.on, day));
  for (const entry of today) {
    const due = dueBySale.get(entry.saleId) ?? 0;
    const stopped =
      entry.customer.stopsPaying !== undefined &&
      yearsSinceStart(day) >= entry.customer.stopsPaying;
    if (due <= 0 || stopped || !entry.customer.id) {
      continue;
    }
    const amount =
      entry.amount === null ? due : Math.min(due, roundTo(due * between(0.3, 0.6), 1000));
    await createPayment(
      executor,
      {
        amountFcfa: amount,
        customerId: entry.customer.id,
        method:
          weighted([
            { value: "cash" as const, weight: 60 },
            { value: "mobile_money" as const, weight: 30 },
            { value: "bank" as const, weight: 10 },
          ]) ?? "cash",
        notes: amount < due ? "Versement partiel." : null,
        paymentDate: noon(day),
        saleId: entry.saleId,
      },
      chance(0.5) ? sellerId : managerId,
    );
    dueBySale.set(entry.saleId, due - amount);
    stats.payments += 1;
  }
};

// ---------------------------------------------------------------------------------------------
// Inventaires semestriels : quelques écarts (casse, vol, erreur de comptage)
// ---------------------------------------------------------------------------------------------

const inventory = async (executor: Executor) => {
  const candidates = [...products.values()].filter((product) => product.stock > 5);
  for (let index = 0; index < 3 && candidates.length > 0; index += 1) {
    const product = candidates.splice(integer(0, candidates.length - 1), 1)[0] as ProductState;
    const lots = await listLots(executor, product.id, false);
    const lot = lots.find((entry) => entry.qtyRemaining >= 3);
    if (!lot) {
      continue;
    }
    const delta = integer(1, 3);
    await adjustLot(executor, {
      lotId: lot.id,
      newQty: lot.qtyRemaining - delta,
      reason: pick([
        "Inventaire semestriel : articles abîmés (humidité).",
        "Inventaire : écart de comptage.",
        "Inventaire : casse constatée en réserve.",
      ]),
      userId: managerId,
    });
    product.stock -= delta;
  }
};

// ---------------------------------------------------------------------------------------------
// Simulations d'achat récentes
// ---------------------------------------------------------------------------------------------

const simulationLine = (key: string, qty: number, markup: number) => {
  const product = [...products.values()].find((entry) => entry.def.key === key);
  if (!product) {
    throw new Error(`Produit ${key} introuvable`);
  }
  return {
    label: product.def.name,
    pricing: { mode: "markup" as const, value: markup },
    pricingBasis: "unit" as const,
    productId: product.id,
    qty,
    trips: 1,
    unit: product.def.unit,
    unitPriceRmb: product.def.rmb,
    weightTons: null,
  };
};

const simulationFees = (customs: number) => [
  {
    allocationMethod: "value" as const,
    amount: customs,
    currency: "fcfa" as const,
    label: "Dédouanement et taxes",
  },
  {
    allocationMethod: "value" as const,
    amount: 220_000,
    currency: "fcfa" as const,
    label: "Transit et manutention port",
  },
];

const createSimulations = async (executor: Executor) => {
  const rates = ratesOn(TODAY);
  const simulations = [
    {
      data: {
        fees: simulationFees(2_400_000),
        freightAllocation: "value" as const,
        freightCbm: 4.5,
        freightRatePerCbmFcfa: 120_000,
        lines: [
          simulationLine("wax6", 1200, 45),
          simulationLine("wax12", 400, 42),
          simulationLine("voile", 300, 48),
        ],
        rates,
      },
      name: "Conteneur tissus pour les fêtes",
      notes:
        "Objectif : recevoir avant le 1er décembre. Comparer avec la commande de l'an dernier.",
    },
    {
      data: {
        fees: simulationFees(1_100_000),
        freightAllocation: "value" as const,
        freightCbm: 9,
        freightRatePerCbmFcfa: 118_000,
        lines: [
          simulationLine("solaire", 120, 40),
          simulationLine("cable", 60, 40),
          simulationLine("led", 30, 45),
        ],
        rates,
      },
      name: "Kit solaire : panneaux, câbles et LED",
      notes:
        "Demande forte chez Solaire Afrique Services. Tester une marge plus basse sur les panneaux.",
    },
    {
      data: {
        fees: simulationFees(1_650_000),
        freightAllocation: "value" as const,
        freightCbm: 14,
        freightRatePerCbmFcfa: 125_000,
        lines: [
          simulationLine("bache", 400, 48),
          simulationLine("chaise", 600, 50),
          {
            ...simulationLine("seau", 150, 45),
            pricing: { mode: "price" as const, value: 15_000 },
          },
        ],
        rates,
      },
      name: "Saison des pluies : bâches et plastiques",
      notes: null,
    },
  ];
  for (const simulation of simulations) {
    await createSimulation(executor, simulation, managerId);
  }
};

// ---------------------------------------------------------------------------------------------
// Programme
// ---------------------------------------------------------------------------------------------

const main = async () => {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    if (existsSync(`${DEMO_FILE}${suffix}`)) {
      try {
        rmSync(`${DEMO_FILE}${suffix}`);
      } catch {
        throw new Error(
          `${DEMO_FILE} est ouverte (serveur de démonstration lancé ?) : arrêtez-le puis relancez.`,
        );
      }
    }
  }
  mkdirSync(path.join(DEMO_FOLDER, "sauvegardes"), { recursive: true });
  mkdirSync(path.join(DEMO_FOLDER, "documents"), { recursive: true });

  console.log(`Base de démonstration : ${DEMO_FILE}`);
  console.log(
    `Période simulée : du ${START.toLocaleDateString("fr-FR")} au ${TODAY.toLocaleDateString("fr-FR")}\n`,
  );

  const db = createDb({ DATABASE_URL: pathToFileURL(DEMO_FILE).href });
  await runMigrations(db);
  await db.$client.execute("pragma journal_mode = wal");
  await db.$client.execute("pragma synchronous = off");
  await loadDatedTables(db);

  // Comptes : le gérant et la vendeuse.
  const auth = createAuth(
    {
      BETTER_AUTH_SECRET: "demo-seed-secret-not-used-for-sessions",
      BETTER_AUTH_URL: "http://localhost:3003",
    },
    db,
  );
  const manager = await auth.api.signUpEmail({
    body: {
      email: "demo@g-stock.local",
      name: "Kossi Mensah",
      password: "demo-gstock",
    },
  });
  const seller = await auth.api.signUpEmail({
    body: {
      email: "afi@g-stock.local",
      name: "Afi Lawson",
      password: "demo-gstock",
    },
  });
  managerId = manager.user.id;
  sellerId = seller.user.id;

  await db.transaction(async (tx) => {
    for (const [key, config] of Object.entries(SUPPLIERS) as [
      SupplierKey,
      (typeof SUPPLIERS)[SupplierKey],
    ][]) {
      const supplier = await createSupplier(tx, {
        contact: config.contact,
        country: config.country,
        name: config.name,
        notes: config.notes,
        phone: config.phone,
      });
      supplierIds.set(key, supplier.id);
    }
    for (const def of PRODUCTS) {
      const product = await createProduct(tx, {
        alertThreshold: 0,
        category: def.category,
        name: def.name,
        notes: def.discontinue ? "Remplacé par les ampoules LED." : null,
        reference: def.reference,
        referencePriceRmb: def.rmb,
        suggestedSalePriceFcfa: currentPrice(def),
        unit: def.unit,
      });
      products.set(product.id, {
        archived: false,
        def,
        demand: 0,
        id: product.id,
        inTransit: 0,
        stock: 0,
      });
    }
    counterId = await ensureCustomer(tx, COUNTER);
  });

  // Demande de départ, puis stock initial (environ trois mois) à la mise en service.
  const demand = estimateDemand(START);
  await db.transaction(async (tx) => {
    for (const product of products.values()) {
      product.demand = (demand.get(product.id) ?? 0) / 300;
      if (!isOrderable(product, START) || product.demand <= 0) {
        continue;
      }
      const qty = roundTo(product.demand * 85, packStep(product.def));
      await createLot(tx, {
        notes: "Stock à la mise en service de G-stock.",
        productId: product.id,
        qty,
        receivedAt: noon(START),
        source: "initial",
        unitCostFcfa: landedCostOn(product.def, START),
        userId: managerId,
      });
      product.stock = qty;
    }
  });
  await stampDay(db, START);

  // Seuils d'alerte : environ trois semaines de ventes, une fois la demande connue.
  for (let day = addDays(START, 1); day <= TODAY; day = addDays(day, 1)) {
    const isToday = sameDay(day, TODAY);
    await db.transaction(async (tx) => {
      await advanceOrders(tx, day);
      await collectPayments(tx, day);
      if (isOpen(day)) {
        const fraction = isToday ? Math.min(1, Math.max(0, (NOW.getHours() - 8) / 11.5)) : 1;
        await sellDay(tx, day, fraction);
      }
      // Commandes : chaque lundi, un fournisseur à la fois, au plus une commande par mois.
      if (day.getDay() === 1 && !isToday) {
        for (const supplier of Object.keys(SUPPLIERS) as SupplierKey[]) {
          const last = lastOrderOn.get(supplier);
          if (!last || (day.getTime() - last.getTime()) / DAY_MS >= 30) {
            await placeOrder(tx, supplier, day);
          }
        }
      }
      // Produit arrêté : archivé une fois son stock écoulé.
      for (const product of products.values()) {
        if (
          !product.archived &&
          product.def.discontinue !== undefined &&
          yearsSinceStart(day) >= product.def.discontinue &&
          product.stock === 0 &&
          product.inTransit === 0
        ) {
          await setProductArchived(tx, product.id, true);
          product.archived = true;
        }
      }
      if (
        (day.getMonth() === 5 && day.getDate() === 30) ||
        (day.getMonth() === 11 && day.getDate() === 30)
      ) {
        await inventory(tx);
      }
    });
    await stampDay(db, day);
    if (day.getDate() === 1 && day.getMonth() % 3 === 0) {
      console.log(
        `${day.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })} : ${stats.sales} ventes, ${stats.orders} commandes, ${stats.payments} paiements`,
      );
    }
  }

  // Seuils d'alerte réalistes, simulations récentes, une commande en brouillon et les réglages.
  await db.transaction(async (tx) => {
    for (const product of products.values()) {
      await tx.run(
        sql`update products set alert_threshold = ${Math.max(1, Math.round(product.demand * product.def.alertDays))} where id = ${product.id}`,
      );
    }
    await createSimulations(tx);
    const draftSupplier: SupplierKey = "textile";
    const rates = ratesOn(TODAY);
    const textiles = productsOf(draftSupplier).filter((product) => isOrderable(product, TODAY));
    await createPurchaseOrder(tx, {
      allocationMethod: "value",
      currency: "rmb",
      fcfaPerUsd: rates.fcfaPerUsd,
      freightCbm: 3.5,
      freightRatePerCbmFcfa: 125_000,
      items: textiles.map((product) => ({
        pricingBasis: "unit" as const,
        productId: product.id,
        qty: roundTo(product.demand * 60, 10),
        trips: 1,
        unitPrice: product.def.rmb,
        weightTons: null,
      })),
      localTransportFcfa: 80_000,
      notes: "Brouillon : à valider avec Mme Lin après réception de ses nouveaux prix.",
      orderDate: noon(TODAY),
      otherFeesFcfa: 900_000,
      rmbPerUsd: rates.rmbPerUsd,
      supplierId: supplierIds.get(draftSupplier) ?? null,
    });
    await updateSettings(tx, {
      backupFolder: path.join(DEMO_FOLDER, "sauvegardes"),
      backupKeep: 30,
      companyAddress: "Grand marché, rue des Commerçants, Lomé",
      companyName: "Ets Mensah Import & Fils",
      companyPhone: "+228 22 21 45 67",
      documentsFolder: path.join(DEMO_FOLDER, "documents"),
      fcfaPerUsd: rates.fcfaPerUsd,
      phoneCountryCode: "228",
      receivableAlertDays: 60,
      receivableCriticalDays: 90,
      receivableWarningDays: 30,
      rmbPerUsd: rates.rmbPerUsd,
    });
  });
  await stampDay(db, TODAY);
  await db.$client.execute("pragma wal_checkpoint(truncate)");
  db.$client.close();

  const due = [...dueBySale.values()].reduce((sum, value) => sum + Math.max(0, value), 0);
  console.log(
    `\n✔ Terminé : ${stats.sales} ventes (${stats.cancelled} annulées, ${stats.discounts} remises), ${stats.payments} paiements, ${stats.orders} commandes.`,
  );
  console.log(`  Créances en cours : ${Math.round(due).toLocaleString("fr-FR")} FCFA`);
  console.log(`  Client comptoir : ${counterId}`);
  console.log(
    "\n  Connexion : demo@g-stock.local / demo-gstock (gérant) — afi@g-stock.local / demo-gstock (vendeuse)",
  );
  console.log("  Lancer : pnpm dev:demo  →  http://localhost:3003\n");
};

await main();
// Le client libsql peut garder le processus ouvert après sa fermeture : on quitte explicitement.
// oxlint-disable-next-line unicorn/no-process-exit
process.exit(0);
