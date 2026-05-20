import type { DiceCategory } from './types';

export const diceCategories: DiceCategory[] = ['thrusters', 'fuel', 'aerodynamics', 'guidance', 'weight'];

export const categoryLabels: Record<DiceCategory, string> = {
  thrusters: 'Thrusters',
  fuel: 'Fuel',
  aerodynamics: 'Aero',
  guidance: 'Guidance',
  weight: 'Weight',
};

export function categoryLabel(category: DiceCategory): string {
  return categoryLabels[category];
}
