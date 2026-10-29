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
  notifications: "i-tabler-bell",
  palette: "i-tabler-palette",
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
  columns: "i-tabler-columns-3",
  cancel: "i-tabler-ban",
  customerAdd: "i-tabler-user-plus",
  download: "i-tabler-download",
  expand: "i-tabler-arrows-diagonal",
  moreActions: "i-tabler-dots-vertical",
  pdf: "i-tabler-file-download",
  pin: "i-tabler-pin",
  productAdd: "i-tabler-square-rounded-plus",
  save: "i-tabler-device-floppy",
  send: "i-tabler-send",
  shuffle: "i-tabler-arrows-shuffle",
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
  trendDown: "i-tabler-trending-down",
  trendUp: "i-tabler-trending-up",
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

// Champs de saisie : fond blanc, trait fin et ombre légère, comme les boutons.
const field = {
  defaultVariants: { variant: "outline" as const },
  variants: {
    size: { md: { base: "text-sm/5" } },
    variant: { outline: "shadow-xs dark:bg-muted" },
  },
  // Focus : un trait gris foncé et un halo léger, plutôt que le noir plein de la couleur principale.
  compoundVariants: [
    {
      color: "primary" as const,
      variant: "outline" as const,
      class:
        "outline-inverted/10 focus-visible:outline-4 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500",
    },
  ],
};

// Menus déroulants : même surface que les fenêtres, un cran plus arrondie que les champs.
const floatingContent = "rounded-lg shadow-overlay dark:bg-elevated/95 dark:backdrop-blur-xl";

// Voile derrière les fenêtres : on assombrit le fond sans le cacher.
const overlay = "bg-sand-950/25 backdrop-blur-[2px] dark:bg-black/50";

export default defineAppConfig({
  ui: {
    colors: {
      neutral: "sand",
      primary: "sand",
      success: "emerald",
      warning: "amber",
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

    // Cadre de l'application : la barre latérale sur le fond, le contenu dans un panneau posé
    // dessus (à partir de la tablette en paysage).
    dashboardGroup: { base: "bg-canvas" },
    dashboardSidebar: {
      slots: {
        body: "px-3",
        footer: "px-3 py-3",
        header: "px-3",
      },
      variants: { side: { left: { root: "border-e-0" } } },
    },
    dashboardPanel: {
      slots: {
        root: "bg-default lg:my-2 lg:me-2 lg:min-h-0 lg:overflow-hidden lg:rounded-xl lg:shadow-card lg:ring lg:ring-default",
      },
    },
    dashboardNavbar: {
      slots: {
        left: "gap-1",
        right: "gap-2",
        title: "font-normal",
      },
    },
    // Fil d'Ariane de la barre du haut : les pages parentes en gris, la page en cours en noir.
    breadcrumb: {
      slots: {
        link: "text-sm",
        separatorIcon: "size-4 text-dimmed",
      },
      variants: {
        active: {
          true: { link: "font-medium text-highlighted" },
          false: { link: "font-normal text-muted" },
        },
      },
      compoundVariants: [
        { active: false, disabled: false, to: true, class: { link: "hover:text-highlighted" } },
        // La page en cours reste en gris foncé, quelle que soit la couleur du thème.
        { active: true, color: "primary", class: { link: "text-highlighted" } },
      ],
    },
    dashboardSearchButton: { slots: { base: "text-muted" } },
    dashboardToolbar: { slots: { root: "min-h-12" } },
    navigationMenu: {
      slots: {
        link: "text-default",
        linkLeadingIcon: "size-[18px] text-muted",
      },
      compoundVariants: [
        {
          active: false,
          disabled: false,
          variant: "pill",
          class: { link: "hover:before:bg-accented/50" },
        },
        {
          active: true,
          highlight: false,
          variant: "pill",
          class: {
            link: "before:bg-default before:shadow-tactile before:ring before:ring-default dark:before:bg-elevated",
          },
        },
      ],
    },

    button: {
      slots: {
        base: "transition-[color,background-color,box-shadow,translate] active:translate-y-px disabled:active:translate-y-0",
      },
      variants: {
        size: {
          md: { base: "px-3" },
          lg: { base: "px-3.5" },
        },
      },
      compoundVariants: [
        {
          color: "primary",
          variant: "solid",
          class:
            "bg-linear-to-b from-white/10 to-transparent shadow-primary hover:bg-primary/90 active:bg-primary/90 dark:from-transparent",
        },
        {
          color: "neutral",
          variant: "outline",
          class:
            "bg-default shadow-tactile ring-default hover:bg-muted active:bg-elevated dark:bg-elevated/60 dark:hover:bg-elevated",
        },
        {
          color: "neutral",
          variant: "subtle",
          class: "bg-muted shadow-tactile ring-default hover:bg-elevated",
        },
        {
          color: "neutral",
          variant: "ghost",
          class: "text-toned hover:bg-accented/50 hover:text-highlighted active:bg-accented/70",
        },
        {
          color: "error",
          variant: "outline",
          class: "bg-default shadow-tactile ring-default hover:bg-error/5 dark:bg-elevated/60",
        },
      ],
    },

    pageCard: {
      slots: {
        // Colonne plafonnée à la carte : un graphique ou un tableau large ne l'élargit pas.
        container: "lg:grid-cols-[minmax(0,1fr)]",
        description: "text-sm",
        leading: "mb-2",
        leadingIcon: "size-4 text-muted",
        root: "rounded-xl",
        title: "font-mono text-[11px]/4 font-medium tracking-[0.08em] text-muted uppercase",
      },
      variants: {
        variant: {
          // Carte dans un cadre : un liseré teinté autour d'une surface blanche.
          subtle: {
            container:
              "rounded-[calc(var(--radius-xl)-0.25rem)] bg-default p-4 shadow-card ring ring-default sm:p-5",
            root: "bg-elevated p-1",
          },
        },
      },
      compoundVariants: [{ to: true, variant: "subtle", class: { root: "hover:bg-elevated" } }],
    },
    card: {
      slots: {
        root: "rounded-xl shadow-card",
        title: "text-sm",
      },
    },

    table: {
      slots: {
        root: "rounded-xl bg-default shadow-card ring ring-default",
        separator: "bg-(--ui-border)",
        tbody: "[&>tr]:transition-colors [&>tr]:hover:bg-muted/70",
        td: "py-3",
        th: "bg-muted py-2.5 font-mono text-[11px] font-medium tracking-[0.06em] text-muted uppercase",
      },
    },

    badge: {
      variants: {
        size: {
          sm: { base: "rounded-full px-2 py-0.5 text-[11px]/4" },
          md: { base: "rounded-full px-2.5 py-0.5" },
          lg: { base: "rounded-full px-2.5" },
        },
      },
      compoundVariants: [
        { color: "neutral", variant: "subtle", class: "bg-muted text-toned ring-default" },
        { color: "neutral", variant: "outline", class: "text-muted ring-default" },
      ],
    },
    alert: {
      compoundVariants: [
        { color: "neutral", variant: "subtle", class: { root: "bg-muted ring-default" } },
      ],
    },
    // Onglets en pilule (contrôle segmenté) : la vue choisie est une touche blanche en relief.
    tabs: {
      defaultVariants: { variant: "pill" },
      variants: {
        size: { md: { trigger: "px-3 py-1 text-[13px]", leadingIcon: "size-4" } },
        variant: { pill: { list: "rounded-lg bg-muted p-0.5 ring ring-default" } },
      },
      compoundVariants: [
        // À la taille de son contenu, calée à gauche ; défile si l'écran est trop étroit.
        {
          orientation: "horizontal",
          variant: "pill",
          class: {
            list: "w-fit max-w-full overflow-x-auto",
            root: "items-start",
            trigger: "grow-0 whitespace-nowrap",
          },
        },
        {
          color: "primary",
          variant: "pill",
          class: {
            indicator: "bg-default shadow-tactile ring ring-default dark:bg-accented",
            trigger: "data-[state=active]:text-highlighted",
          },
        },
      ],
    },

    input: field,
    inputDate: field,
    inputMenu: { ...field, slots: { content: floatingContent } },
    inputNumber: field,
    inputTags: field,
    inputTime: field,
    pinInput: field,
    select: { ...field, slots: { content: floatingContent } },
    selectMenu: { ...field, slots: { content: floatingContent } },
    textarea: field,
    formField: { slots: { label: "text-[13px]" } },
    radioGroup: {
      compoundVariants: [
        {
          color: "primary",
          variant: "card",
          class: {
            item: "has-data-[state=checked]:border-inverted has-data-[state=checked]:bg-default has-data-[state=checked]:shadow-tactile",
          },
        },
      ],
    },

    dropdownMenu: { slots: { content: floatingContent } },
    popover: { slots: { content: floatingContent } },
    tooltip: {
      slots: {
        arrow: "fill-inverted stroke-transparent",
        content: "h-7 rounded-md bg-inverted font-medium text-inverted shadow-overlay ring-0",
      },
    },
    toast: { slots: { root: "rounded-xl shadow-overlay" } },
    modal: {
      slots: {
        footer: "bg-muted",
      },
      variants: {
        fullscreen: { false: { content: "rounded-xl shadow-overlay" } },
        overlay: { true: { overlay } },
      },
    },
    slideover: {
      slots: {
        content: "sm:shadow-overlay",
        footer: "bg-muted",
        overlay,
      },
      // `overflow-hidden` : le pied teinté suit l'arrondi du panneau.
      variants: { inset: { true: { content: "overflow-hidden rounded-xl" } } },
    },
    drawer: {
      slots: {
        content: "shadow-overlay",
        overlay,
      },
    },
  },
});
