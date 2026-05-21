import type { DiceCategory } from './types';

export const diceCategories: DiceCategory[] = ['thrusters', 'fuel', 'aerodynamics', 'guidance', 'weight'];

export const categoryLabels: Record<DiceCategory, string> = {
  thrusters: 'Thrusters',
  fuel: 'Fuel',
  aerodynamics: 'Aero',
  guidance: 'Guidance',
  weight: 'Weight',
};

export const categoryColors: Record<DiceCategory, string> = {
  thrusters: '#ff5a5f',
  fuel: '#58d68d',
  aerodynamics: '#4ea1ff',
  guidance: '#f7c948',
  weight: '#c084fc',
};

export function categoryLabel(category: DiceCategory): string {
  return categoryLabels[category];
}
