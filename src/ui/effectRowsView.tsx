import type { ReactNode } from 'react';
import { categoryColors, categoryLabels } from '../sim/categories';
import type { CardPoolEntry } from '../sim/cards';
import type { CardEffect, CardSpec, DiceCategory, MetaNodeEffect, MetaNodeSpec } from '../sim/types';

interface EffectRow {
  dice: string;
  category?: DiceCategory;
  target: string;
  value: string;
  note?: string;
}

export function CardSummary({ card }: { card: CardSpec }): ReactNode {
  return <EffectRows rows={cardEffectRows(card.effect)} compact />;
}

export function CardPoolSummary({ card }: { card: CardPoolEntry }): ReactNode {
  return (
    <>
      <strong className="my-1.5 block text-base">{cardPoolTitle(card)}</strong>
      <EffectRows rows={cardPoolEffectRows(card)} compact />
    </>
  );
}

export function MetaNodeSummary({ node }: { node: MetaNodeSpec }): ReactNode {
  return (
    <>
      <h3 className="m-0 mb-2.5 text-lg">{metaNodeTitle(node)}</h3>
      <EffectRows rows={metaEffectRows(node.effect)} />
    </>
  );
}

export function RollOnlyCardSummary({ card }: { card: CardSpec }): ReactNode {
  const rows = rollOnlyRows(card.effect);
  return rows.length > 0 ? <EffectRows rows={rows} compact /> : null;
}

export function EffectRows({ rows, compact = false }: { rows: EffectRow[]; compact?: boolean }): ReactNode {
  return (
    <div className={`grid w-full ${compact ? 'mt-2 gap-[5px]' : 'gap-1.5'}`}>
      {rows.map((row, index) => (
        <div
          className={`effect-row grid min-w-0 items-center rounded-md border border-[rgba(160,181,210,0.18)] bg-[rgba(5,9,16,0.28)] ${compact ? 'grid-cols-[minmax(0,0.9fr)_minmax(0,1.05fr)_auto] gap-[5px] px-[7px] py-1.5 text-[11px]' : 'grid-cols-[minmax(66px,0.9fr)_minmax(76px,1.1fr)_auto] gap-2 px-2 py-[7px]'} ${row.category ? 'stat-themed' : ''}`}
          key={`${row.dice}-${row.target}-${row.value}-${index}`}
          style={row.category ? ({ '--stat-color': categoryColors[row.category] } as React.CSSProperties) : undefined}
        >
          <span className="effect-dice min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-extrabold">{row.dice}</span>
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[#c8d6e8]">{row.target}</span>
          <span className={`whitespace-nowrap rounded-full border px-[7px] py-0.5 font-mono font-extrabold ${compact ? 'px-[5px]' : ''} ${effectValueClass(row.value)}`}>{row.value}</span>
          {row.note ? <span className="col-span-full min-w-0 text-[11px] text-[#c8d6e8]">{row.note}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function metaNodeTitle(node: MetaNodeSpec): string {
  switch (node.effect.type) {
    case 'startingMoney':
      return 'Better Starting Money';
    case 'unlockDice':
      return `Unlock ${categoryLabels[node.effect.category]}`;
    case 'addFaceValue':
      return `${signed(node.effect.amount)} ${categoryLabels[node.effect.category]}`;
    case 'addWeakestFace':
      return `${signed(node.effect.amount)} Weakest Side`;
    case 'autoRerollLowest':
      return 'Reroll Lowest';
    case 'upgradeRandomFaceCard':
      return `Better ${categoryLabels[node.effect.category]} Cards`;
    case 'unlockCard':
      return `Unlock ${unlockCardTitle(node.effect.cardId)}`;
  }
}

function cardPoolTitle(card: CardPoolEntry): string {
  if (card.id.startsWith('base-random-face-')) {
    return `+1 ${card.affectedCategories[0] ? categoryLabels[card.affectedCategories[0]] : 'Die'}`;
  }

  return card.name
    .replaceAll('S1', 'Side 1')
    .replaceAll('S5', 'Side 5')
    .replaceAll('S6', 'Side 6')
    .replaceAll('x3', '3 Dice');
}

function cardPoolEffectRows(card: CardPoolEntry): EffectRow[] {
  const baseRandomCategory = matchCategoryCard(card.id, 'base-random-face-');
  if (baseRandomCategory) {
    return [categoryRow(baseRandomCategory, card.name.includes('sides') ? 'Predetermined sides' : 'Predetermined side', '+1')];
  }

  const baseDoubleCategory = matchCategoryCard(card.id, 'base-x2-');
  if (baseDoubleCategory) {
    return [categoryRow(baseDoubleCategory, 'Roll result', 'x2')];
  }

  if (card.id.startsWith('base-s5-')) {
    return card.affectedCategories.map((category) => categoryRow(category, 'Side 5', '+1'));
  }

  if (card.id === 'base-auto-reroll') {
    return [{ dice: 'Any', target: 'Lowest roll', value: '+1 reroll' }];
  }

  return unlockCardRows(card.id);
}

export function cardEffectRows(effect: CardEffect): EffectRow[] {
  switch (effect.type) {
    case 'addFaceValue':
      return [categoryRow(effect.category, sideName(effect.faceIndex), signed(effect.amount))];
    case 'addRandomFaceValue':
      return effect.faceIndexes.map((faceIndex) => categoryRow(effect.category, sideName(faceIndex), signed(effect.amount)));
    case 'addFaceValueToCategories':
      return effect.categories.map((category) => categoryRow(category, sideName(effect.faceIndex), signed(effect.amount)));
    case 'addAllFaces':
      return [categoryRow(effect.category, 'All sides', signed(effect.amount))];
    case 'multiplyStat':
      return [categoryRow(effect.category, 'Roll result', `x${effect.multiplier}`)];
    case 'autoRerollLowest':
      return [{ dice: 'Any', target: 'Lowest roll', value: rerollValue(effect.amount) }];
    case 'doubleHighestRoll':
      return [{ dice: 'Any', target: 'Highest roll', value: 'x2' }];
    case 'categoryDelta':
      return [
        categoryRow(effect.category, 'All sides', signed(effect.amount)),
        ...effect.penaltyCategory && effect.penaltyAmount
          ? [categoryRow(effect.penaltyCategory, 'All sides', signed(effect.penaltyAmount))]
          : [],
      ];
    case 'topBottomDelta':
      return [
        { dice: 'Any', target: 'Highest roll', value: signed(effect.topAmount) },
        { dice: 'Any', target: 'Lowest roll', value: signed(effect.bottomAmount) },
      ];
  }
}

function metaEffectRows(effect: MetaNodeEffect): EffectRow[] {
  switch (effect.type) {
    case 'startingMoney':
      return [{ dice: 'Run', target: 'Starting money', value: '$10' }];
    case 'unlockDice':
      return [categoryRow(effect.category, 'Dice', 'Unlock')];
    case 'addFaceValue':
      return [categoryRow(effect.category, sideName(effect.faceIndex), signed(effect.amount))];
    case 'addWeakestFace':
      return [{ dice: 'Any', target: 'First empty side', value: signed(effect.amount) }];
    case 'autoRerollLowest':
      return [{ dice: 'Any', target: 'Lowest roll', value: rerollValue(effect.amount) }];
    case 'upgradeRandomFaceCard':
      return [categoryRow(effect.category, 'Future side cards', `${effect.amount} sides`)];
    case 'unlockCard':
      return unlockCardRows(effect.cardId).map((row) => ({ ...row, note: 'Unlocked card' }));
  }
}

function rollOnlyRows(effect: CardEffect): EffectRow[] {
  switch (effect.type) {
    case 'autoRerollLowest':
      return [{ dice: 'Any', target: 'Lowest roll', value: rerollValue(effect.amount) }];
    case 'doubleHighestRoll':
      return [{ dice: 'Any', target: 'Highest roll', value: 'x2' }];
    case 'topBottomDelta':
      return [
        { dice: 'Any', target: 'Highest roll', value: signed(effect.topAmount) },
        { dice: 'Any', target: 'Lowest roll', value: signed(effect.bottomAmount) },
      ];
    case 'addFaceValue':
    case 'addRandomFaceValue':
    case 'addFaceValueToCategories':
    case 'addAllFaces':
    case 'multiplyStat':
    case 'categoryDelta':
      return [];
  }
}

function unlockCardRows(cardId: string): EffectRow[] {
  if (cardId === 'double-highest') {
    return [{ dice: 'Any', target: 'Highest roll', value: 'x2' }];
  }

  if (cardId === 'top-bottom') {
    return [
      { dice: 'Any', target: 'Highest roll', value: '+5' },
      { dice: 'Any', target: 'Lowest roll', value: '-1' },
    ];
  }

  if (cardId === 's6-three-stats') {
    return [{ dice: '3 dice', target: 'Side 6', value: '+1' }];
  }

  const plus3 = matchCategoryCard(cardId, 'plus3-minus1-');
  if (plus3) {
    const penaltyCategory = nextCategory(plus3);
    return [
      categoryRow(plus3, 'All sides', '+3'),
      categoryRow(penaltyCategory, 'All sides', '-1'),
    ];
  }

  const plus3SideOne = matchCategoryCard(cardId, 'plus3-side1-');
  if (plus3SideOne) {
    return [categoryRow(plus3SideOne, 'Side 1', '+3')];
  }

  const rareDie = matchCategoryCard(cardId, 'rare-die-');
  if (rareDie) {
    return [categoryRow(rareDie, 'Roll result', 'x2')];
  }

  const allFaces = matchCategoryCard(cardId, 'all-faces-');
  if (allFaces) {
    return [categoryRow(allFaces, 'All sides', '+1')];
  }

  return [{ dice: 'Card', target: 'Unlock', value: cardId }];
}

function unlockCardTitle(cardId: string): string {
  const rows = unlockCardRows(cardId);
  const first = rows[0];
  if (!first) {
    return 'Card';
  }

  if (first.dice === 'Any') {
    return `${first.value} ${first.target}`;
  }

  return `${first.value} ${first.dice}`;
}

function categoryRow(category: DiceCategory, target: string, value: string): EffectRow {
  return { dice: categoryLabels[category], category, target, value };
}

function sideName(faceIndex: number): string {
  return `Side ${faceIndex + 1}`;
}

function signed(amount: number): string {
  return `${amount >= 0 ? '+' : ''}${amount}`;
}

function rerollValue(amount: number): string {
  return `${signed(amount)} ${amount === 1 ? 'reroll' : 'rerolls'}`;
}

function effectValueClass(value: string): string {
  if (value.startsWith('x')) {
    return 'border-[rgba(142,246,197,0.48)] bg-[rgba(142,246,197,0.16)] text-rocket-green';
  }

  if (value.startsWith('-')) {
    return 'border-[rgba(255,90,95,0.48)] bg-[rgba(255,90,95,0.16)] text-[#ffb4b7]';
  }

  if (value.startsWith('+')) {
    return 'border-[rgba(142,246,197,0.48)] bg-[rgba(142,246,197,0.16)] text-rocket-green';
  }

  return 'border-[rgba(160,181,210,0.32)] bg-[rgba(160,181,210,0.14)] text-rocket-text';
}

function matchCategoryCard(cardId: string, prefix: string): DiceCategory | undefined {
  const value = cardId.startsWith(prefix) ? cardId.slice(prefix.length) : '';
  return isDiceCategory(value) ? value : undefined;
}

function isDiceCategory(value: string): value is DiceCategory {
  return ['thrusters', 'fuel', 'aerodynamics', 'guidance', 'weight'].includes(value);
}

function nextCategory(category: DiceCategory): DiceCategory {
  const categories: DiceCategory[] = ['thrusters', 'fuel', 'aerodynamics', 'guidance', 'weight'];
  return categories[(categories.indexOf(category) + 1) % categories.length];
}
