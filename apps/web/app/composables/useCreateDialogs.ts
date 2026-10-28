/**
 * Fenêtres de création ouvertes depuis n'importe où (barre latérale, recherche, pages) : une seule
 * instance de chacune, rendue par le layout.
 */
export const useCreateDialogs = () => {
  const state = useState("create-dialogs", () => ({
    customer: false,
    product: false,
    purchase: false,
    sale: false,
    /** Client choisi d'avance pour la nouvelle vente. */
    saleCustomerId: undefined as string | undefined,
    simulation: false,
  }));

  const openSale = (customerId?: string) => {
    state.value.saleCustomerId = customerId;
    state.value.sale = true;
  };
  const openPurchase = () => {
    state.value.purchase = true;
  };
  const openSimulation = () => {
    state.value.simulation = true;
  };
  const openProduct = () => {
    state.value.product = true;
  };
  const openCustomer = () => {
    state.value.customer = true;
  };

  return { openCustomer, openProduct, openPurchase, openSale, openSimulation, state };
};
