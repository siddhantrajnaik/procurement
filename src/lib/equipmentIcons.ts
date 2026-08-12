// Inline SVG icons for common virology / molecular biology lab equipment.
// Each returns an SVG string that can be rendered via dangerouslySetInnerHTML
// or as a data URI for <img> tags. Icons are 64×64 viewBox, single-color
// stroked paths so they work on the dark theme.

export type EquipmentCategory =
  | 'microscope'
  | 'centrifuge'
  | 'pcr'
  | 'biosafety_cabinet'
  | 'incubator'
  | 'freezer'
  | 'autoclave'
  | 'spectrophotometer'
  | 'water_bath'
  | 'gel_electrophoresis'
  | 'vortex'
  | 'ph_meter'
  | 'fume_hood'
  | 'plate_reader'
  | 'flow_cytometer'
  | 'shaker'
  | 'balance'
  | 'pipette'
  | 'other';

interface EquipmentIconDef {
  label: string;
  svg: string;
}

const icon = (paths: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

export const EQUIPMENT_ICONS: Record<EquipmentCategory, EquipmentIconDef> = {
  microscope: {
    label: 'Microscope',
    svg: icon(
      '<path d="M32 8v12"/><circle cx="32" cy="24" r="6"/><path d="M32 30v14"/><path d="M26 44h12"/><path d="M22 52h20"/><path d="M32 44v8"/><path d="M38 24l8 8"/><ellipse cx="48" cy="34" rx="4" ry="3"/>'
    ),
  },
  centrifuge: {
    label: 'Centrifuge',
    svg: icon(
      '<rect x="14" y="12" width="36" height="40" rx="4"/><circle cx="32" cy="32" r="12"/><circle cx="32" cy="32" r="3"/><path d="M32 20v-0.01"/><path d="M32 44v-0.01"/><path d="M20 32h-0.01"/><path d="M44 32h-0.01"/><rect x="22" y="8" width="20" height="4" rx="1"/>'
    ),
  },
  pcr: {
    label: 'PCR / Thermocycler',
    svg: icon(
      '<rect x="10" y="20" width="44" height="32" rx="3"/><path d="M10 36h44"/><rect x="14" y="24" width="36" height="10" rx="1"/><path d="M20 40v8"/><path d="M28 40v8"/><path d="M36 40v8"/><path d="M44 40v8"/><rect x="16" y="14" width="32" height="6" rx="2"/>'
    ),
  },
  biosafety_cabinet: {
    label: 'Biosafety Cabinet',
    svg: icon(
      '<rect x="8" y="8" width="48" height="48" rx="2"/><path d="M8 18h48"/><path d="M8 42h48"/><path d="M8 42v14h6v-6"/><path d="M56 42v14h-6v-6"/><rect x="14" y="22" width="36" height="16" rx="1" stroke-dasharray="4 2"/><circle cx="16" cy="13" r="2" fill="currentColor"/><circle cx="24" cy="13" r="2" fill="currentColor"/>'
    ),
  },
  incubator: {
    label: 'CO₂ Incubator',
    svg: icon(
      '<rect x="12" y="8" width="40" height="48" rx="3"/><rect x="18" y="14" width="28" height="18" rx="2"/><path d="M18 24h28"/><path d="M12 40h40"/><circle cx="22" cy="46" r="3"/><path d="M36 44h10v4h-10z"/><text x="30" y="21" font-size="7" fill="currentColor" stroke="none" text-anchor="middle">CO₂</text>'
    ),
  },
  freezer: {
    label: '-80°C / -20°C Freezer',
    svg: icon(
      '<rect x="14" y="6" width="36" height="52" rx="3"/><path d="M14 30h36"/><rect x="18" y="10" width="28" height="16" rx="1"/><rect x="18" y="34" width="28" height="20" rx="1"/><path d="M40 18h4"/><path d="M40 42h4"/><path d="M32 10v6l-3 3 6 0-3 3"/><path d="M32 38v6l-3 3 6 0-3 3"/>'
    ),
  },
  autoclave: {
    label: 'Autoclave',
    svg: icon(
      '<ellipse cx="32" cy="32" rx="20" ry="22"/><path d="M12 28h40"/><path d="M22 8h20v6H22z"/><circle cx="32" cy="38" r="6"/><path d="M29 38h6"/><path d="M32 35v6"/><path d="M20 18h4"/><path d="M40 18h4"/>'
    ),
  },
  spectrophotometer: {
    label: 'Spectrophotometer / NanoDrop',
    svg: icon(
      '<rect x="8" y="22" width="48" height="28" rx="4"/><rect x="14" y="26" width="20" height="14" rx="2" fill="currentColor" opacity="0.15"/><path d="M14 26h20v14H14z"/><circle cx="46" cy="36" r="4"/><path d="M22 18v4"/><path d="M30 16v6"/><path d="M38 18v4"/><rect x="16" y="44" width="32" height="6" rx="1"/>'
    ),
  },
  water_bath: {
    label: 'Water Bath',
    svg: icon(
      '<rect x="10" y="20" width="44" height="30" rx="3"/><path d="M14 26c4-4 8 4 12 0s8 4 12 0s8 4 12 0"/><path d="M14 34c4-4 8 4 12 0s8 4 12 0s8 4 12 0"/><rect x="16" y="14" width="32" height="6" rx="2"/><path d="M10 50h6v6"/><path d="M54 50h-6v6"/>'
    ),
  },
  gel_electrophoresis: {
    label: 'Gel Electrophoresis',
    svg: icon(
      '<rect x="10" y="16" width="44" height="32" rx="3"/><rect x="16" y="22" width="32" height="20" rx="1"/><path d="M22 22v20"/><path d="M28 22v20"/><path d="M34 22v20"/><path d="M40 22v20"/><path d="M22 28h20"/><path d="M22 34h20"/><circle cx="16" cy="12" r="3"/><circle cx="48" cy="12" r="3" fill="red" stroke="red"/><path d="M16 12h32"/>'
    ),
  },
  vortex: {
    label: 'Vortex Mixer',
    svg: icon(
      '<path d="M20 52h24"/><path d="M24 52V36"/><path d="M40 52V36"/><ellipse cx="32" cy="30" rx="16" ry="8"/><ellipse cx="32" cy="22" rx="8" ry="4"/><path d="M28 14c2-4 6-4 8 0"/><path d="M26 10c3-5 9-5 12 0"/>'
    ),
  },
  ph_meter: {
    label: 'pH Meter',
    svg: icon(
      '<rect x="20" y="6" width="24" height="16" rx="3"/><rect x="24" y="10" width="16" height="8" rx="1" fill="currentColor" opacity="0.15"/><path d="M32 22v8"/><path d="M30 30h4v22h-4z"/><path d="M30 52c0 4 4 6 4 6s4-2 4-6"/><path d="M16 40h12"/><rect x="8" y="36" width="8" height="16" rx="2"/>'
    ),
  },
  fume_hood: {
    label: 'Fume Hood',
    svg: icon(
      '<rect x="8" y="12" width="48" height="40" rx="2"/><path d="M8 20h48"/><path d="M12 12V8h40v4"/><rect x="12" y="24" width="40" height="24" rx="1" stroke-dasharray="4 2"/><path d="M14 20l6-8"/><path d="M50 20l-6-8"/><path d="M28 6v-2h8v2"/>'
    ),
  },
  plate_reader: {
    label: 'Plate Reader / ELISA Reader',
    svg: icon(
      '<rect x="8" y="18" width="48" height="30" rx="4"/><path d="M8 30h48"/><rect x="14" y="22" width="16" height="6" rx="1" fill="currentColor" opacity="0.15"/><path d="M20 36h24"/><path d="M20 40h24"/><path d="M20 44h16"/><rect x="40" y="34" width="10" height="10" rx="1"/>'
    ),
  },
  flow_cytometer: {
    label: 'Flow Cytometer',
    svg: icon(
      '<rect x="8" y="14" width="48" height="36" rx="4"/><rect x="14" y="18" width="22" height="16" rx="2" fill="currentColor" opacity="0.15"/><circle cx="25" cy="26" r="4"/><path d="M29 26h16"/><path d="M42 22v8"/><path d="M42 18v-4h8v4"/><path d="M14 40h36"/><path d="M18 44h6"/><path d="M28 44h6"/><path d="M38 44h6"/>'
    ),
  },
  shaker: {
    label: 'Orbital Shaker',
    svg: icon(
      '<rect x="10" y="28" width="44" height="20" rx="4"/><rect x="16" y="20" width="32" height="8" rx="2"/><circle cx="32" cy="38" r="6"/><circle cx="32" cy="38" r="2" fill="currentColor"/><path d="M18 48v8"/><path d="M46 48v8"/>'
    ),
  },
  balance: {
    label: 'Analytical Balance',
    svg: icon(
      '<rect x="12" y="16" width="40" height="32" rx="3"/><rect x="16" y="20" width="32" height="14" rx="2" stroke-dasharray="3 2"/><rect x="22" y="26" width="20" height="6" rx="1"/><rect x="20" y="40" width="24" height="6" rx="1" fill="currentColor" opacity="0.15"/><path d="M12 48h40v4H12z"/>'
    ),
  },
  pipette: {
    label: 'Micropipette',
    svg: icon(
      '<path d="M32 6v10"/><rect x="28" y="16" width="8" height="20" rx="3"/><path d="M28 28l-2 12h12l-2-12"/><path d="M28 40l2 14h4l2-14"/><circle cx="32" cy="22" r="3"/><path d="M24 18h-4"/><path d="M40 18h4"/>'
    ),
  },
  other: {
    label: 'Other Equipment',
    svg: icon(
      '<rect x="12" y="12" width="40" height="40" rx="4"/><path d="M24 24h16"/><path d="M24 32h16"/><path d="M24 40h10"/><circle cx="32" cy="8" r="4"/>'
    ),
  },
};

export const EQUIPMENT_CATEGORIES = Object.entries(EQUIPMENT_ICONS).map(
  ([value, { label }]) => ({ value: value as EquipmentCategory, label })
);

export function equipmentIconSvg(category: EquipmentCategory): string {
  return EQUIPMENT_ICONS[category]?.svg ?? EQUIPMENT_ICONS.other.svg;
}

export function equipmentLabel(category: EquipmentCategory): string {
  return EQUIPMENT_ICONS[category]?.label ?? 'Other Equipment';
}
