import { MuscleGroup } from '../types';

export const MUSCLE_GROUPS: { key: MuscleGroup; label: string }[] = [
  { key: 'CHEST',      label: 'Chest' },
  { key: 'BACK',       label: 'Back' },
  { key: 'SHOULDERS',  label: 'Shoulders' },
  { key: 'BICEPS',     label: 'Biceps' },
  { key: 'TRICEPS',    label: 'Triceps' },
  { key: 'FOREARMS',   label: 'Forearms' },
  { key: 'QUADS',      label: 'Quads' },
  { key: 'HAMSTRINGS', label: 'Hamstrings' },
  { key: 'GLUTES',     label: 'Glutes' },
  { key: 'CALVES',     label: 'Calves' },
  { key: 'CORE',       label: 'Core' },
];

export const muscleGroupLabel = (key: MuscleGroup): string =>
  MUSCLE_GROUPS.find(g => g.key === key)?.label ?? key;
