import { createBaseRocketStats, improveRocketStat } from './rocketStats';
import type { GameState, LessonId, LessonSpec, MetaUpgradeId, RocketStats } from './types';

export const lessonSpecs: LessonSpec[] = [
  {
    id: 'reinforceFrame',
    name: 'Reinforce the Frame',
    description: 'Reliability up. Lightness drops a little.',
    effect: 'Reliability +8 | Lightness -4',
    maxStacks: 10,
    unlock: 'failureReviewBoard',
  },
  {
    id: 'tuneEngineMix',
    name: 'Tune the Engine Mix',
    description: 'Thrust up. Reliability down slightly.',
    effect: 'Thrust +10 | Reliability -4',
    maxStacks: 10,
  },
  {
    id: 'improveFuelFlow',
    name: 'Improve Fuel Flow',
    description: 'Fuel flow and consistency improve together.',
    effect: 'Fuel +10 | Reliability +3',
    maxStacks: 10,
    unlock: 'blackBoxRecovery',
  },
  {
    id: 'salvageUsefulParts',
    name: 'Salvage Useful Parts',
    description: 'Failures return more usable hardware.',
    effect: 'Salvage +10%',
    maxStacks: 5,
    unlock: 'scrapyardEngineering',
  },
  {
    id: 'stabilizeFins',
    name: 'Stabilize the Fins',
    description: 'Flight control improves, but the rocket gets a little less light.',
    effect: 'Guidance +8 | Aerodynamics +6 | Lightness -2',
    maxStacks: 8,
    unlock: 'basicStabilizers',
  },
  {
    id: 'cutDeadWeight',
    name: 'Cut Dead Weight',
    description: 'The rocket gets lighter, but quality control slips.',
    effect: 'Lightness +12 | Reliability -4',
    maxStacks: 8,
    unlock: 'blackBoxRecovery',
  },
  {
    id: 'standardizeAssembly',
    name: 'Standardize Assembly',
    description: 'Launch operations get cheaper through repeatable process.',
    effect: 'Launch cost -8%',
    maxStacks: 8,
    unlock: 'scrapyardEngineering',
  },
  {
    id: 'recruitSpecialist',
    name: 'Recruit a Specialist',
    description: 'Guidance and reliability both jump. Every second launch gets an extra choice.',
    effect: 'Guidance +12 | Reliability +8 | Extra choice every 2nd launch',
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

export function applyLessonToRocketStats(stats: RocketStats, id: LessonId): RocketStats {
  switch (id) {
    case 'reinforceFrame':
      return improveRocketStat(improveRocketStat(stats, 'reliability', 8), 'lightness', -4);
    case 'tuneEngineMix':
      return improveRocketStat(improveRocketStat(stats, 'thrust', 10), 'reliability', -4);
    case 'improveFuelFlow':
      return improveRocketStat(improveRocketStat(stats, 'fuel', 10), 'reliability', 3);
    case 'salvageUsefulParts':
      return stats;
    case 'stabilizeFins':
      return improveRocketStat(
        improveRocketStat(improveRocketStat(stats, 'guidance', 8), 'aerodynamics', 6),
        'lightness',
        -2,
      );
    case 'cutDeadWeight':
      return improveRocketStat(improveRocketStat(stats, 'lightness', 12), 'reliability', -4);
    case 'standardizeAssembly':
      return stats;
    case 'recruitSpecialist':
      return improveRocketStat(improveRocketStat(stats, 'guidance', 12), 'reliability', 8);
    case 'documentEverything':
      return stats;
  }
}

export function rebuildRocketStats(
  metaUpgrades: Record<MetaUpgradeId, number>,
  lessons: Record<LessonId, number>,
): RocketStats {
  let stats = createBaseRocketStats(metaUpgrades);

  for (const lesson of lessonSpecs) {
    const stacks = lessons[lesson.id];
    for (let index = 0; index < stacks; index += 1) {
      stats = applyLessonToRocketStats(stats, lesson.id);
    }
  }

  return stats;
}
