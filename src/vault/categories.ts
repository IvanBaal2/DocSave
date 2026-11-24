import type { ScanKind } from '../scan/extract';
import type { CustomCategory } from './types';

export type DocTypeDef = {
  id: string;
  label: string;
  /** Ionicons name for the picker card. */
  icon: string;
  /** Capture steps, e.g. Front then Back for ID cards. */
  slots: string[];
  /** Index from which steps may be skipped. */
  optionalFrom?: number;
  /** Camera guide shape. */
  frame: 'card' | 'passport' | 'document' | 'photo';
  /** What the on-device recogniser looks for. */
  kind: ScanKind;
  /** Allow adding extra pages after the defined slots. */
  multiPage?: boolean;
  /** Start with file import instead of the camera (e.g. PDF files). */
  importFirst?: boolean;
  /** Card is usually vertical (badges); the camera guide starts in portrait. */
  portrait?: boolean;
  /** Short hint shown on the picker card. */
  hint: string;
};

export type CategoryDef = {
  id: string;
  name: string;
  icon: string; // Ionicons name
  color: string;
  description: string;
  builtIn: boolean;
  types: DocTypeDef[];
};

export const BUILT_IN_CATEGORIES: CategoryDef[] = [
  {
    "id": "identity",
    "name": "Identity Documents",
    "icon": "id-card-outline",
    "color": "#34D399",
    "description": "Passport, ID cards, licences, permits",
    "builtIn": true,
    "types": [
      {
        "id": "passport",
        "label": "Passport",
        "icon": "globe-outline",
        "slots": [
          "Photo page"
        ],
        "frame": "passport",
        "kind": "passport",
        "hint": "Reads the machine-readable zone automatically"
      },
      {
        "id": "national_id",
        "label": "National ID Card",
        "icon": "id-card-outline",
        "slots": [
          "Front",
          "Back"
        ],
        "frame": "card",
        "kind": "id-card",
        "hint": "Front and back, read automatically"
      },
      {
        "id": "driving_licence",
        "label": "Driving Licence",
        "icon": "car-outline",
        "slots": [
          "Front",
          "Back"
        ],
        "frame": "card",
        "kind": "licence",
        "hint": "Front and back, read automatically"
      },
      {
        "id": "residence_permit",
        "label": "Residence Permit",
        "icon": "home-outline",
        "slots": [
          "Front",
          "Back"
        ],
        "frame": "card",
        "kind": "id-card",
        "hint": "Front and back, read automatically"
      },
      {
        "id": "employee_id",
        "label": "Employee ID",
        "icon": "briefcase-outline",
        "slots": ["Front", "Back"],
        "optionalFrom": 1,
        "frame": "card",
        "kind": "org-id",
        "portrait": true,
        "hint": "Work badge; portrait or landscape"
      },
      {
        "id": "student_id",
        "label": "Student ID",
        "icon": "school-outline",
        "slots": ["Front", "Back"],
        "optionalFrom": 1,
        "frame": "card",
        "kind": "org-id",
        "portrait": true,
        "hint": "School or university card; portrait or landscape"
      },
      {
        "id": "other_identity",
        "label": "Other Identity Document",
        "icon": "person-circle-outline",
        "slots": [
          "Front",
          "Back"
        ],
        "frame": "card",
        "kind": "id-card",
        "hint": "Any other ID; back side optional",
        "optionalFrom": 1
      }
    ]
  },
  {
    "id": "travel",
    "name": "Travel Documents",
    "icon": "airplane-outline",
    "color": "#60A5FA",
    "description": "Tickets, boarding passes, bookings",
    "builtIn": true,
    "types": [
      {
        "id": "plane_ticket",
        "label": "Plane Ticket",
        "icon": "airplane-outline",
        "slots": [
          "Ticket"
        ],
        "frame": "document",
        "kind": "ticket",
        "hint": "Scan it or import the PDF",
        "multiPage": true
      },
      {
        "id": "boarding_pass",
        "label": "Boarding Pass",
        "icon": "qr-code-outline",
        "slots": [
          "Boarding pass"
        ],
        "frame": "document",
        "kind": "boarding",
        "hint": "Reads the boarding-pass barcode"
      },
      {
        "id": "train_ticket",
        "label": "Train Ticket",
        "icon": "train-outline",
        "slots": [
          "Ticket"
        ],
        "frame": "document",
        "kind": "ticket",
        "hint": "Scan it or import the PDF",
        "multiPage": true
      },
      {
        "id": "hotel_reservation",
        "label": "Hotel Reservation",
        "icon": "bed-outline",
        "slots": [
          "Reservation"
        ],
        "frame": "document",
        "kind": "generic",
        "hint": "Scan it or import the PDF",
        "multiPage": true
      },
      {
        "id": "travel_insurance",
        "label": "Travel Insurance",
        "icon": "medkit-outline",
        "slots": [
          "Policy"
        ],
        "frame": "document",
        "kind": "generic",
        "hint": "Scan it or import the PDF",
        "multiPage": true
      }
    ]
  },
  {
    "id": "personal",
    "name": "Personal Documents",
    "icon": "document-text-outline",
    "color": "#F5B544",
    "description": "Certificates, contracts, medical",
    "builtIn": true,
    "types": [
      {
        "id": "birth_certificate",
        "label": "Birth Certificate",
        "icon": "ribbon-outline",
        "slots": [
          "Page 1"
        ],
        "frame": "document",
        "kind": "certificate",
        "hint": "Scan every page",
        "multiPage": true
      },
      {
        "id": "marriage_certificate",
        "label": "Marriage Certificate",
        "icon": "heart-outline",
        "slots": [
          "Page 1"
        ],
        "frame": "document",
        "kind": "certificate",
        "hint": "Scan every page",
        "multiPage": true
      },
      {
        "id": "medical_document",
        "label": "Medical Document",
        "icon": "medical-outline",
        "slots": [
          "Page 1"
        ],
        "frame": "document",
        "kind": "generic",
        "hint": "Reports, prescriptions, cards",
        "multiPage": true
      },
      {
        "id": "contract",
        "label": "Contract",
        "icon": "create-outline",
        "slots": [
          "Page 1"
        ],
        "frame": "document",
        "kind": "generic",
        "hint": "Scan every page",
        "multiPage": true
      },
      {
        "id": "important_letter",
        "label": "Important Letter",
        "icon": "mail-outline",
        "slots": [
          "Page 1"
        ],
        "frame": "document",
        "kind": "generic",
        "hint": "Scan every page",
        "multiPage": true
      }
    ]
  },
  {
    "id": "cards",
    "name": "Cards",
    "icon": "card-outline",
    "color": "#F472B6",
    "description": "Membership, loyalty and gift cards",
    "builtIn": true,
    "types": [
      { "id": "membership_card", "label": "Membership Card", "icon": "people-outline", "slots": ["Front", "Back"], "optionalFrom": 1, "frame": "card", "kind": "loyalty", "hint": "Gym, club or association card" },
      { "id": "loyalty_card", "label": "Loyalty Card", "icon": "ribbon-outline", "slots": ["Front", "Back"], "optionalFrom": 1, "frame": "card", "kind": "loyalty", "hint": "Reads the barcode automatically" },
      { "id": "gift_card", "label": "Gift Card", "icon": "gift-outline", "slots": ["Front", "Back"], "optionalFrom": 1, "frame": "card", "kind": "giftcard", "hint": "Card number, PIN and value" }
    ]
  },
  {
    "id": "coupons",
    "name": "Coupons and Vouchers",
    "icon": "pricetag-outline",
    "color": "#FB923C",
    "description": "Coupons, vouchers, discount codes",
    "builtIn": true,
    "types": [
      { "id": "coupon", "label": "Coupon", "icon": "pricetag-outline", "slots": ["Coupon"], "frame": "document", "kind": "coupon", "hint": "Code, offer and expiry" },
      { "id": "voucher", "label": "Voucher", "icon": "ticket-outline", "slots": ["Voucher"], "frame": "document", "kind": "coupon", "hint": "Gift or travel voucher" }
    ]
  },
  {
    "id": "receipts",
    "name": "Receipts",
    "icon": "receipt-outline",
    "color": "#FACC15",
    "description": "Purchases, invoices, warranty proof",
    "builtIn": true,
    "types": [
      { "id": "receipt", "label": "Receipt", "icon": "receipt-outline", "slots": ["Receipt"], "frame": "document", "kind": "receipt", "hint": "Purchases, warranty proof", "multiPage": true }
    ]
  },
  {
    "id": "other",
    "name": "Other Documents",
    "icon": "folder-open-outline",
    "color": "#A78BFA",
    "description": "PDFs, letters, anything else",
    "builtIn": true,
    "types": [
      {
        "id": "pdf",
        "label": "PDF Document",
        "icon": "document-attach-outline",
        "slots": [
          "File"
        ],
        "frame": "document",
        "kind": "generic",
        "hint": "Import a PDF file",
        "importFirst": true
      },
      {
        "id": "other",
        "label": "General Document",
        "icon": "document-outline",
        "slots": [
          "Page 1"
        ],
        "frame": "document",
        "kind": "generic",
        "hint": "Scan any paper document",
        "multiPage": true
      },
      {
        "id": "custom",
        "label": "Custom Document",
        "icon": "construct-outline",
        "slots": [
          "Page 1"
        ],
        "frame": "document",
        "kind": "generic",
        "hint": "Give it your own name",
        "multiPage": true
      },
      {
        "id": "terms",
        "label": "Terms and Conditions",
        "icon": "reader-outline",
        "slots": [
          "Page 1"
        ],
        "frame": "document",
        "kind": "generic",
        "hint": "Policies, agreements",
        "multiPage": true
      }
    ]
  }
];

/** Older vaults: "Cards & Coupons" became Cards; "General Photos" was folded into Other Documents. */
const LEGACY_CATEGORY: Record<string, string> = { wallet: 'cards', photos: 'other' };

/** Generic scan settings used for custom folders. */
export const GENERIC_TYPE: DocTypeDef = {
  id: 'custom',
  label: 'Document',
  icon: 'document-outline',
  slots: ['Page 1'],
  frame: 'document',
  kind: 'generic',
  multiPage: true,
  hint: 'Scan any paper document',
};

export function findDocTypeAny(docType?: string): { type: DocTypeDef; category: CategoryDef } | undefined {
  for (const c of BUILT_IN_CATEGORIES) {
    const t = c.types.find((x) => x.id === docType);
    if (t) return { type: t, category: c };
  }
  return undefined;
}

export const CUSTOM_CATEGORY_ICONS = [
  'folder-outline',
  'briefcase-outline',
  'home-outline',
  'school-outline',
  'car-outline',
  'medkit-outline',
  'card-outline',
  'paw-outline',
  'heart-outline',
  'star-outline',
] as const;

export function customToDef(c: CustomCategory): CategoryDef {
  return {
    id: c.id,
    name: c.name,
    icon: c.icon,
    color: '#2DD4BF',
    description: 'Custom folder',
    builtIn: false,
    types: [],
  };
}

export function allCategories(custom: CustomCategory[]): CategoryDef[] {
  return [...BUILT_IN_CATEGORIES, ...custom.map(customToDef)];
}

export function findCategory(id: string, custom: CustomCategory[]): CategoryDef | undefined {
  const real = LEGACY_CATEGORY[id] ?? id;
  return allCategories(custom).find((c) => c.id === real);
}

/** The type of a saved document, also when its type later moved to another category. */
export function findDocType(categoryId: string, docType?: string): DocTypeDef | undefined {
  if (!docType) return undefined;
  const real = LEGACY_CATEGORY[categoryId] ?? categoryId;
  return BUILT_IN_CATEGORIES.find((c) => c.id === real)?.types.find((t) => t.id === docType) ?? findDocTypeAny(docType)?.type;
}

/** The documents people need most often: shown as quick-access tiles. */
export const ESSENTIAL_TYPES = ['passport', 'national_id', 'driving_licence', 'employee_id', 'student_id'] as const;
