import { createBaseRocketStats, improveRocketStat } from './rocketStats';
import { defaultMetaUpgrades } from './metaUpgrades';
import type { GameState, LessonId, LessonSpec, MetaUpgradeId, RocketStats } from './types';

export const lessonSpecs: LessonSpec[] = [
  {
    id: 'reinforceFrame',
    name: 'Reinforce the Frame',
    description: 'Reliability up. Lightness drops a little.',
    effect: 'Reliability +5+ | Lightness -3',
    maxStacks: 10,
    unlock: 'failureReviewBoard',
  },
  {
    id: 'tuneEngineMix',
    name: 'Tune the Engine Mix',
    description: 'Thrust up. Reliability down slightly.',
    effect: 'Thrust +5+ | Reliability -3',
    maxStacks: 10,
  },
  {
    id: 'improveFuelFlow',
    name: 'Improve Fuel Flow',
    description: 'Fuel flow and consistency improve together.',
    effect: 'Fuel +5+ | Reliability +1',
    maxStacks: 10,
    unlock: 'blackBoxRecovery',
  },
  {
    id: 'salvageUsefulParts',
    name: 'Salvage Useful Parts',
    description: 'Failures return more usable hardware.',
    effect: 'Salvage +7%+',
    maxStacks: 5,
    unlock: 'scrapyardEngineering',
  },
  {
    id: 'stabilizeFins',
    name: 'Stabilize the Fins',
    description: 'Flight control improves, but the rocket gets a little less light.',
    effect: 'Guidance +5+ | Aerodynamics +2 | Lightness -2',
    maxStacks: 8,
    unlock: 'basicStabilizers',
  },
  {
    id: 'fairNoseCone',
    name: 'Fair the Nose Cone',
    description: 'Aerodynamics improve through cleaner shaping.',
    effect: 'Aerodynamics +5+ | Guidance +1',
    maxStacks: 8,
    unlock: 'advancedAerodynamics',
  },
  {
    id: 'cutDeadWeight',
    name: 'Cut Dead Weight',
    description: 'The rocket gets lighter, but quality control slips.',
    effect: 'Lightness +6+ | Reliability -3',
    maxStacks: 8,
    unlock: 'blackBoxRecovery',
  },
  {
    id: 'standardizeAssembly',
    name: 'Standardize Assembly',
    description: 'Launch operations get cheaper through repeatable process.',
    effect: 'Launch cost -5%+',
    maxStacks: 8,
    unlock: 'scrapyardEngineering',
  },
  {
    id: 'recruitSpecialist',
    name: 'Recruit a Specialist',
    description: 'Guidance and reliability both improve.',
    effect: 'Guidance +7+ | Reliability +4+',
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
  fairNoseCone: 0,
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

export function applyLessonToRocketStats(
  stats: RocketStats,
  id: LessonId,
  metaUpgrades: Record<MetaUpgradeId, number> = defaultMetaUpgrades,
): RocketStats {
  const upgradedTelemetry = metaUpgrades.blackBoxRecovery > 0 ? 2 : 0;
  const crashLabBonus = metaUpgrades.crashLab;
  const guidanceBonus = metaUpgrades.guidanceProgram * 2;
  const aeroBonus = metaUpgrades.advancedAerodynamics * 2;
  const reviewBonus = Math.min(3, metaUpgrades.failureReviewBoard);

  switch (id) {
    case 'reinforceFrame':
      return improveRocketStat(improveRocketStat(stats, 'reliability', 5 + reviewBonus), 'lightness', -3);
    case 'tuneEngineMix':
      return improveRocketStat(improveRocketStat(stats, 'thrust', 5 + upgradedTelemetry + crashLabBonus), 'reliability', -3);
    case 'improveFuelFlow':
      return improveRocketStat(improveRocketStat(stats, 'fuel', 5 + upgradedTelemetry + crashLabBonus), 'reliability', 1);
    case 'salvageUsefulParts':
      return stats;
    case 'stabilizeFins':
      return improveRocketStat(
        improveRocketStat(improveRocketStat(stats, 'guidance', 5 + guidanceBonus), 'aerodynamics', 2),
        'lightness',
        -2,
      );
    case 'fairNoseCone':
      return improveRocketStat(
        improveRocketStat(stats, 'aerodynamics', 5 + aeroBonus),
        'guidance',
        1,
      );
    case 'cutDeadWeight':
      return improveRocketStat(improveRocketStat(stats, 'lightness', 6 + upgradedTelemetry + crashLabBonus), 'reliability', -3);
    case 'standardizeAssembly':
      return stats;
    case 'recruitSpecialist':
      return improveRocketStat(
        improveRocketStat(stats, 'guidance', 7 + metaUpgrades.guidanceProgram),
        'reliability',
        4 + metaUpgrades.guidanceProgram,
      );
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
      stats = applyLessonToRocketStats(stats, lesson.id, metaUpgrades);
    }
  }

  return stats;
}
