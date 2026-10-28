// Thème de l'application : couleurs et icônes se changent ici, nulle part ailleurs.
// Dans les composants, les icônes se lisent avec `useIcons()` (ex. `icons.save`).

// Icônes de Nuxt UI, aussi réutilisées par l'application
const nuxtUiIcons = {
  arrowDown: "i-tabler-arrow-down",
  arrowLeft: "i-tabler-arrow-left",
  arrowRight: "i-tabler-arrow-right",
  arrowUp: "i-tabler-arrow-up",
  caution: "i-tabler-alert-square-rounded",
  check: "i-tabler-check",
  chevronDoubleLeft: "i-tabler-chevrons-left",
  chevronDoubleRight: "i-tabler-chevrons-right",
  chevronDown: "i-tabler-chevron-down",
  chevronLeft: "i-tabler-chevron-left",
  chevronRight: "i-tabler-chevron-right",
  chevronUp: "i-tabler-chevron-up",
  close: "i-tabler-x",
  copy: "i-tabler-copy",
  copyCheck: "i-tabler-copy-check",
  dark: "i-tabler-moon",
  drag: "i-tabler-grip-vertical",
  edit: "i-tabler-pencil",
  ellipsis: "i-tabler-dots",
  error: "i-tabler-square-rounded-x",
  external: "i-tabler-external-link",
  eye: "i-tabler-eye",
  eyeOff: "i-tabler-eye-off",
  file: "i-tabler-file",
  folder: "i-tabler-folder",
  folderOpen: "i-tabler-folder-open",
  hash: "i-tabler-hash",
  info: "i-tabler-info-square-rounded",
  light: "i-tabler-sun",
  loading: "i-tabler-loader-2",
  menu: "i-tabler-menu",
  minus: "i-tabler-minus",
  panelClose: "i-tabler-layout-sidebar-left-collapse",
  panelOpen: "i-tabler-layout-sidebar-left-expand",
  plus: "i-tabler-plus",
  reload: "i-tabler-reload",
  search: "i-tabler-search",
  star: "i-tabler-star",
  stop: "i-tabler-player-stop",
  success: "i-tabler-square-rounded-check",
  system: "i-tabler-device-desktop",
  tip: "i-tabler-bulb",
  trash: "i-tabler-trash",
  upload: "i-tabler-upload",
  warning: "i-tabler-alert-triangle",
};

// Application : modules et navigation
const navigationIcons = {
  comingSoon: "i-tabler-circle-dashed",
  compare: "i-tabler-git-compare",
  customer: "i-tabler-user",
  customers: "i-tabler-users",
  dashboard: "i-tabler-layout-dashboard",
  documents: "i-tabler-file-text",
  logo: "i-tabler-packages",
  lots: "i-tabler-stack-2",
  movements: "i-tabler-history",
  product: "i-tabler-package",
  products: "i-tabler-packages",
  purchases: "i-tabler-ship",
  sale: "i-tabler-receipt",
  sales: "i-tabler-shopping-cart",
  settings: "i-tabler-settings",
  simulations: "i-tabler-calculator",
  suppliers: "i-tabler-building-factory-2",
};

// Application : actions
const actionIcons = {
  archive: "i-tabler-archive",
  calculate: "i-tabler-calculator",
  cancel: "i-tabler-ban",
  customerAdd: "i-tabler-user-plus",
  download: "i-tabler-download",
  moreActions: "i-tabler-dots-vertical",
  pdf: "i-tabler-file-download",
  pin: "i-tabler-pin",
  productAdd: "i-tabler-square-rounded-plus",
  save: "i-tabler-device-floppy",
  send: "i-tabler-send",
  unarchive: "i-tabler-archive-off",
  undo: "i-tabler-arrow-back-up",
  whatsapp: "i-tabler-brand-whatsapp",
};

// Application : compte
const accountIcons = {
  selector: "i-tabler-selector",
  signIn: "i-tabler-login",
  signOut: "i-tabler-logout",
  signUp: "i-tabler-user-plus",
};

// Application : stock
const stockIcons = {
  averageCost: "i-tabler-scale",
  price: "i-tabler-tag",
  stock: "i-tabler-packages",
  stockAdjust: "i-tabler-adjustments-horizontal",
  stockEntry: "i-tabler-package-import",
  stockLow: "i-tabler-alert-triangle",
  stockMissing: "i-tabler-package-off",
  stockOk: "i-tabler-circle-check",
  stockOut: "i-tabler-circle-x",
  stockValue: "i-tabler-wallet",
  unpack: "i-tabler-package-export",
};

// Application : ventes, clients et argent
const salesIcons = {
  address: "i-tabler-map-pin",
  amounts: "i-tabler-calculator",
  calendar: "i-tabler-calendar",
  customerCredit: "i-tabler-wallet",
  customerPurchases: "i-tabler-shopping-bag",
  discount: "i-tabler-rosette-discount",
  overdue: "i-tabler-clock",
  payInFull: "i-tabler-checks",
  payment: "i-tabler-cash-banknote",
  pending: "i-tabler-hourglass",
  period: "i-tabler-calendar-week",
  phone: "i-tabler-phone",
  profit: "i-tabler-pig-money",
  receiptMobile: "i-tabler-device-mobile",
  receiptReady: "i-tabler-file-check",
  receivables: "i-tabler-coins",
  receivablesCritical: "i-tabler-urgent",
  revenue: "i-tabler-trending-up",
};

// Application : achats fournisseurs
const purchaseIcons = {
  exchangeRate: "i-tabler-arrows-exchange",
  locked: "i-tabler-lock",
  purchaseDraft: "i-tabler-file-pencil",
  purchaseInTransit: "i-tabler-ship",
  purchaseOrdered: "i-tabler-send",
  purchaseReceived: "i-tabler-truck-delivery",
  reception: "i-tabler-truck-delivery",
  receptionInProgress: "i-tabler-truck-loading",
  supplierPayment: "i-tabler-send",
};

// Application : sauvegardes
const backupIcons = {
  backup: "i-tabler-database",
  backupFolder: "i-tabler-folder-lock",
  backupNow: "i-tabler-database-export",
  backupOk: "i-tabler-shield-check",
  cloud: "i-tabler-cloud",
  cloudOff: "i-tabler-cloud-off",
};

export default defineAppConfig({
  ui: {
    colors: {
      primary: 'red',
      neutral: 'neutral'
    },
    icons: {
      ...nuxtUiIcons,
      ...navigationIcons,
      ...actionIcons,
      ...accountIcons,
      ...stockIcons,
      ...salesIcons,
      ...purchaseIcons,
      ...backupIcons,
    },
    input: {
      defaultVariants: {
        variant: 'soft'
      }
    },
    select: {
      defaultVariants: {
        variant: 'soft'
      }
    },
    textarea: {
      defaultVariants: {
        variant: 'soft'
      }
    },
    selectMenu: {
      defaultVariants: {
        variant: 'soft'
      }
    },
    inputMenu: {
      defaultVariants: {
        variant: 'soft'
      }
    },
    inputNumber: {
      defaultVariants: {
        variant: 'soft'
      }
    },
    inputTags: {
      defaultVariants: {
        variant: 'soft'
      }
    },
    inputDate: {
      defaultVariants: {
        variant: 'soft'
      }
    },
    inputTime: {
      defaultVariants: {
        variant: 'soft'
      }
    },
    pinInput: {
      defaultVariants: {
        variant: 'soft'
      }
    }
  },
});
