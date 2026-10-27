import { describe, expect, it } from "vite-plus/test";

import { DEFAULT_EXCHANGE_RATES } from "./currency";
import { allocateAmount, computeLandedCosts, stockQtyFromWeight } from "./purchasing";
import type { LandedCostInput } from "./purchasing";

// A : 100 × 72 RMB = 7 200 RMB = 1 000 $ = 598 000 FCFA, 3 voyages.
// B : 50 × 36 RMB = 1 800 RMB = 250 $ = 149 500 FCFA, 1 voyage.
// Frais : 2 CBM × 150 000 + 100 000 de transport local = 400 000 FCFA.
const order = (allocationMethod: LandedCostInput["allocationMethod"]): LandedCostInput => ({
  allocationMethod,
  freightCbm: 2,
  freightRatePerCbmFcfa: 150_000,
  items: [
    { qty: 100, trips: 3, unitPriceRmb: 72 },
    { qty: 50, trips: 1, unitPriceRmb: 36 },
  ],
  localTransportFcfa: 100_000,
  otherFeesFcfa: 0,
  rates: DEFAULT_EXCHANGE_RATES,
});

describe("allocateAmount", () => {
  it("répartit au prorata des poids", () => {
    expect(allocateAmount(400_000, [3, 1])).toEqual([300_000, 100_000]);
  });

  it("ne perd aucun FCFA à l'arrondi", () => {
    const shares = allocateAmount(100, [1, 1, 1]);
    expect(shares).toEqual([34, 33, 33]);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(100);
  });

  it("répartit à parts égales si tous les poids sont nuls", () => {
    expect(allocateAmount(10, [0, 0])).toEqual([5, 5]);
  });

  it("renvoie une liste vide sans ligne", () => {
    expect(allocateAmount(1000, [])).toEqual([]);
  });
});

describe("computeLandedCosts", () => {
  it("convertit la marchandise et totalise les frais", () => {
    const result = computeLandedCosts(order("proportional"));
    expect(result.goodsRmb).toBe(9000);
    expect(result.goodsUsd).toBeCloseTo(1250);
    expect(result.goodsFcfa).toBe(747_500);
    expect(result.freightFcfa).toBe(300_000);
    expect(result.feesFcfa).toBe(400_000);
    expect(result.totalFcfa).toBe(1_147_500);
  });

  it("répartit les frais selon le nombre de voyages (méthode proportionnelle)", () => {
    const [a, b] = computeLandedCosts(order("proportional")).lines;
    expect(a?.transportShareFcfa).toBe(300_000);
    expect(a?.unitCostFcfa).toBe(8980);
    expect(b?.transportShareFcfa).toBe(100_000);
    expect(b?.unitCostFcfa).toBe(4990);
  });

  it("répartit les frais à parts égales (méthode égale)", () => {
    const [a, b] = computeLandedCosts(order("equal")).lines;
    expect(a?.transportShareFcfa).toBe(200_000);
    expect(a?.unitCostFcfa).toBe(7980);
    expect(b?.transportShareFcfa).toBe(200_000);
    expect(b?.unitCostFcfa).toBe(6990);
  });

  it("donne le prix converti seul quand il n'y a aucun frais", () => {
    const result = computeLandedCosts({
      ...order("equal"),
      freightCbm: 0,
      localTransportFcfa: 0,
    });
    expect(result.feesFcfa).toBe(0);
    expect(result.lines[0]?.unitCostFcfa).toBe(5980);
  });

  it("utilise les taux figés de la commande", () => {
    const result = computeLandedCosts({
      ...order("equal"),
      rates: { fcfaPerUsd: 600, rmbPerUsd: 7.2 },
    });
    expect(result.lines[0]?.goodsFcfa).toBe(600_000);
  });
});

// Bon de commande Yiwu (FAFA, 10/13) : prix à la tonne, stock compté en cartons.
// Fil galva 8 T × 4 450 = 35 600 RMB ; fil barbelé 5 T × 4 700 = 23 500 ;
// barbelé PVC 4 T × 7 200 = 28 800 ; pointes de toiture 2 T × 5 100 = 10 200. Total 98 100 RMB, 19 T.
const tonnageOrder = (allocationMethod: LandedCostInput["allocationMethod"]): LandedCostInput => ({
  allocationMethod,
  freightCbm: 24.8,
  freightRatePerCbmFcfa: 100_000,
  items: [
    { pricingBasis: "weight", qty: 800, trips: 1, unitPriceRmb: 4450, weightTons: 8 },
    { pricingBasis: "weight", qty: 25, trips: 1, unitPriceRmb: 4700, weightTons: 5 },
    { pricingBasis: "weight", qty: 20, trips: 1, unitPriceRmb: 7200, weightTons: 4 },
    { pricingBasis: "weight", qty: 80, trips: 1, unitPriceRmb: 5100, weightTons: 2 },
  ],
  localTransportFcfa: 0,
  otherFeesFcfa: 0,
  rates: DEFAULT_EXCHANGE_RATES,
});

describe("commande à la tonne", () => {
  it("calcule la marchandise sur le poids et non sur le nombre de cartons", () => {
    const result = computeLandedCosts(tonnageOrder("equal"));
    expect(result.lines.map((line) => line.goodsRmb)).toEqual([35_600, 23_500, 28_800, 10_200]);
    expect(result.goodsRmb).toBe(98_100);
    expect(result.totalWeightTons).toBe(19);
  });

  it("répartit les frais au prorata du poids, sans perte d'arrondi", () => {
    const result = computeLandedCosts(tonnageOrder("weight"));
    // 24,8 CBM × 100 000 = 2 480 000 FCFA, répartis 8 : 5 : 4 : 2 sur 19 T.
    expect(result.lines.map((line) => line.transportShareFcfa)).toEqual([
      1_044_210, 652_632, 522_105, 261_053,
    ]);
    expect(result.lines.reduce((sum, line) => sum + line.transportShareFcfa, 0)).toBe(2_480_000);
  });

  it("donne le coût de revient par carton et par tonne", () => {
    const [galva] = computeLandedCosts(tonnageOrder("weight")).lines;
    // 35 600 RMB = 2 956 778 FCFA ; + 1 044 210 de frais = 4 000 988 FCFA.
    expect(galva?.totalFcfa).toBe(4_000_988);
    expect(galva?.unitCostFcfa).toBe(5001);
    expect(galva?.costPerTonFcfa).toBe(500_124);
  });

  it("garde le calcul à l'unité quand la ligne n'est pas au poids", () => {
    const [line] = computeLandedCosts({
      ...order("equal"),
      items: [{ qty: 100, trips: 1, unitPriceRmb: 72, weightTons: 2 }],
    }).lines;
    expect(line?.goodsRmb).toBe(7200);
    expect(line?.costPerTonFcfa).toBe(Math.round((598_000 + 400_000) / 2));
  });
});

describe("stockQtyFromWeight", () => {
  it("convertit le poids pour les produits gérés en tonnes ou en kg", () => {
    expect(stockQtyFromWeight("tonne", 8)).toBe(8);
    expect(stockQtyFromWeight(" T ", 2.5)).toBe(2.5);
    expect(stockQtyFromWeight("kg", 2)).toBe(2000);
  });

  it("ne devine rien pour les autres unités", () => {
    expect(stockQtyFromWeight("carton", 8)).toBeNull();
  });
});
