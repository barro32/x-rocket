import { improvePartStat } from './parts';
import type { GameState, LessonId, LessonSpec, RocketParts } from './types';

export const lessonSpecs: LessonSpec[] = [
  {
    id: 'reinforceFrame',
    name: 'Reinforce the Frame',
    description: 'Hull reliability up. Adds a little mass.',
    effect: 'Hull reliability +5.5% | Mass +0.6',
    maxStacks: 10,
  },
  {
    id: 'tuneEngineMix',
    name: 'Tune the Engine Mix',
    description: 'Engine thrust up. Engine reliability down slightly.',
    effect: 'Engine thrust +3.2 | Engine reliability -1.5% | Cost +$1',
    maxStacks: 10,
  },
  {
    id: 'improveFuelFlow',
    name: 'Improve Fuel Flow',
    description: 'Engine burn time and reliability up.',
    effect: 'Burn time +0.08s | Engine reliability +2.5%',
    maxStacks: 10,
    unlock: 'blackBoxRecovery',
  },
  {
    id: 'salvageUsefulParts',
    name: 'Salvage Useful Parts',
    description: 'Recovery salvage rate up.',
    effect: 'Salvage rate +8%',
    maxStacks: 5,
    unlock: 'scrapyardEngineering',
  },
  {
    id: 'stabilizeFins',
    name: 'Stabilize the Fins',
    description: 'Fin stability and aerodynamics up. Adds a little mass.',
    effect: 'Fin stability +5.5% | Aero +2.5% | Mass +0.25',
    maxStacks: 8,
    unlock: 'basicStabilizers',
  },
  {
    id: 'cutDeadWeight',
    name: 'Cut Dead Weight',
    description: 'Body and tank mass down. Hull reliability down.',
    effect: 'Body mass -1.4 | Tank mass -0.8 | Hull reliability -2.5%',
    maxStacks: 8,
    unlock: 'blackBoxRecovery',
  },
  {
    id: 'standardizeAssembly',
    name: 'Standardize Assembly',
    description: 'Launch mount reliability up. Build costs down.',
    effect: 'Mount reliability +3.5% | Mount cost -$0.35 | Body cost -$0.25',
    maxStacks: 8,
  },
  {
    id: 'recruitSpecialist',
    name: 'Recruit a Specialist',
    description: 'Avionics reliability up. Every third launch gets an extra choice.',
    effect: 'Avionics reliability +2.5% | Extra choice every 3rd launch',
    maxStacks: 1,
    unlock: 'guidanceProgram',
  },
  {
    id: 'documentEverything',
    name: 'Document Everything',
    description: '+1 extra meta knowledge on bankruptcy.',
    effect: 'Bankruptcy knowledge +1',
    maxStacks: 5,
    unlock: 'failureReviewBoard',
  },
];

export const lessonById = Object.fromEntries(
  lessonSpecs.map((spec) => [spec.id, spec]),
) as Record<LessonId, LessonSpec>;

export const defaultLessons: Record<LessonId, number> = {
  reinforceFrame: 0,
  tuneEngineMix: 0,
  improveFuelFlow: 0,
  salvageUsefulParts: 0,
  stabilizeFins: 0,
  cutDeadWeight: 0,
  standardizeAssembly: 0,
  recruitSpecialist: 0,
  documentEverything: 0,
};

export function availableLessons(state: GameState): LessonId[] {
  return lessonSpecs
    .filter((spec) => state.lessons[spec.id] < spec.maxStacks)
    .filter((spec) => !spec.unlock || state.metaUpgrades[spec.unlock] > 0)
    .map((spec) => spec.id);
}

export function applyLessonToParts(parts: RocketParts, id: LessonId): RocketParts {
  switch (id) {
    case 'reinforceFrame':
      return improvePartStat(improvePartStat(parts, 'body', 'reliability', 0.055), 'body', 'mass', 0.6);
    case 'tuneEngineMix':
      return improvePartStat(
        improvePartStat(improvePartStat(parts, 'engine', 'thrust', 3.2), 'engine', 'reliability', -0.015),
        'engine',
        'cost',
        1,
      );
    case 'improveFuelFlow':
      return improvePartStat(
        improvePartStat(parts, 'engine', 'burnTime', 0.08),
        'engine',
        'reliability',
        0.025,
      );
    case 'salvageUsefulParts':
      return improvePartStat(parts, 'recovery', 'salvageRate', 0.08);
    case 'stabilizeFins':
      return improvePartStat(
        improvePartStat(improvePartStat(parts, 'fins', 'stability', 0.055), 'fins', 'aerodynamics', 0.025),
        'fins',
        'mass',
        0.25,
      );
    case 'cutDeadWeight':
      return improvePartStat(
        improvePartStat(improvePartStat(parts, 'body', 'mass', -1.4), 'fuelTank', 'mass', -0.8),
        'body',
        'reliability',
        -0.025,
      );
    case 'standardizeAssembly':
      return improvePartStat(
        improvePartStat(improvePartStat(parts, 'launchMount', 'reliability', 0.035), 'launchMount', 'cost', -0.35),
        'body',
        'cost',
        -0.25,
      );
    case 'recruitSpecialist':
      return improvePartStat(parts, 'avionics', 'reliability', 0.025);
    case 'documentEverything':
      return parts;
  }
}
