import type { CustomCategory } from './types';

export type DocTypeDef = {
  id: string;
  label: string;
  /** Pre-defined capture slots, e.g. Front / Back for ID cards. */
  slots?: string[];
  /** Preferred camera frame shape. */
  frame?: 'card' | 'passport' | 'document';
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
    id: 'identity',
    name: 'Identity Documents',
    icon: 'id-card-outline',
    color: '#34D399',
    description: 'Passport, ID cards, licences, permits',
    builtIn: true,
    types: [
      { id: 'passport', label: 'Passport', slots: ['Front', 'Back'], frame: 'passport' },
      { id: 'national_id', label: 'National ID card', slots: ['Front', 'Back'], frame: 'card' },
      { id: 'driving_licence', label: 'Driving licence', slots: ['Front', 'Back'], frame: 'card' },
      { id: 'residence_permit', label: 'Residence permit', slots: ['Front', 'Back'], frame: 'card' },
    ],
  },
  {
    id: 'travel',
    name: 'Travel Documents',
    icon: 'airplane-outline',
    color: '#60A5FA',
    description: 'Tickets, boarding passes, bookings',
    builtIn: true,
    types: [
      { id: 'plane_ticket', label: 'Plane ticket', frame: 'document' },
      { id: 'boarding_pass', label: 'Boarding pass', frame: 'document' },
      { id: 'train_ticket', label: 'Train ticket', frame: 'document' },
      { id: 'hotel_reservation', label: 'Hotel reservation', frame: 'document' },
      { id: 'travel_insurance', label: 'Travel insurance', frame: 'document' },
    ],
  },
  {
    id: 'personal',
    name: 'Personal Documents',
    icon: 'document-text-outline',
    color: '#F5B544',
    description: 'Certificates, contracts, medical',
    builtIn: true,
    types: [
      { id: 'birth_certificate', label: 'Birth certificate', frame: 'document' },
      { id: 'marriage_certificate', label: 'Marriage certificate', frame: 'document' },
      { id: 'contract', label: 'Contract', frame: 'document' },
      { id: 'important_letter', label: 'Important letter', frame: 'document' },
      { id: 'medical_document', label: 'Medical document', frame: 'document' },
    ],
  },
  {
    id: 'other',
    name: 'Other Documents',
    icon: 'folder-open-outline',
    color: '#A78BFA',
    description: 'Receipts, PDFs, images, more',
    builtIn: true,
    types: [
      { id: 'terms', label: 'Terms and conditions', frame: 'document' },
      { id: 'receipt', label: 'Receipt', frame: 'document' },
      { id: 'pdf', label: 'PDF file', frame: 'document' },
      { id: 'image', label: 'Image', frame: 'document' },
      { id: 'other', label: 'Other important file', frame: 'document' },
    ],
  },
];

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
  return allCategories(custom).find((c) => c.id === id);
}

export function findDocType(categoryId: string, docType?: string): DocTypeDef | undefined {
  if (!docType) return undefined;
  return BUILT_IN_CATEGORIES.find((c) => c.id === categoryId)?.types.find((t) => t.id === docType);
}
