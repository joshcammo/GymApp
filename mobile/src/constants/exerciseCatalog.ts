import { ImageSourcePropType } from 'react-native';

/**
 * Static exercise library shown in the Add Exercise picker.
 * Selecting an entry only fills the free-text exercise name — the catalog
 * is a browsing aid, not a constraint, so manual names keep working and
 * nothing here touches the database schema.
 */
export interface CatalogExercise {
  name:  string;
  image: ImageSourcePropType;
}

export interface ExerciseCategory {
  name:      string;
  exercises: CatalogExercise[];
}

export const EXERCISE_CATALOG: ExerciseCategory[] = [
  {
    name: 'Chest',
    exercises: [
      { name: 'Bench Press',            image: require('../../assets/exercises/bench-press.webp') },
      { name: 'Incline Bench Press',    image: require('../../assets/exercises/incline-bench-press.webp') },
      { name: 'Dumbbell Bench Press',   image: require('../../assets/exercises/dumbbell-bench-press.webp') },
      { name: 'Incline Dumbbell Press', image: require('../../assets/exercises/incline-dumbbell-press.webp') },
      { name: 'Chest Fly',              image: require('../../assets/exercises/chest-fly.webp') },
      { name: 'Cable Crossover',        image: require('../../assets/exercises/cable-crossover.webp') },
      { name: 'Push-Ups',               image: require('../../assets/exercises/push-ups.webp') },
      { name: 'Dips',                   image: require('../../assets/exercises/dips.webp') },
    ],
  },
  {
    name: 'Back',
    exercises: [
      { name: 'Deadlift',         image: require('../../assets/exercises/deadlift.webp') },
      { name: 'Pull-Ups',         image: require('../../assets/exercises/pull-ups.webp') },
      { name: 'Lat Pulldown',     image: require('../../assets/exercises/lat-pulldown.webp') },
      { name: 'Barbell Row',      image: require('../../assets/exercises/barbell-row.webp') },
      { name: 'Seated Cable Row', image: require('../../assets/exercises/seated-cable-row.webp') },
      { name: 'Dumbbell Row',     image: require('../../assets/exercises/dumbbell-row.webp') },
      { name: 'T-Bar Row',        image: require('../../assets/exercises/t-bar-row.webp') },
      { name: 'Back Extension',   image: require('../../assets/exercises/back-extension.webp') },
    ],
  },
  {
    name: 'Biceps',
    exercises: [
      { name: 'Barbell Curl',          image: require('../../assets/exercises/barbell-curl.webp') },
      { name: 'Dumbbell Curl',         image: require('../../assets/exercises/dumbbell-curl.webp') },
      { name: 'Hammer Curl',           image: require('../../assets/exercises/hammer-curl.webp') },
      { name: 'Preacher Curl',         image: require('../../assets/exercises/preacher-curl.webp') },
      { name: 'Incline Dumbbell Curl', image: require('../../assets/exercises/incline-dumbbell-curl.webp') },
      { name: 'Cable Curl',            image: require('../../assets/exercises/cable-curl.webp') },
      { name: 'Concentration Curl',    image: require('../../assets/exercises/concentration-curl.webp') },
      { name: 'Chin-Ups',              image: require('../../assets/exercises/chin-ups.webp') },
    ],
  },
  {
    name: 'Triceps',
    exercises: [
      { name: 'Tricep Pushdown',           image: require('../../assets/exercises/tricep-pushdown.webp') },
      { name: 'Skull Crushers',            image: require('../../assets/exercises/skull-crushers.webp') },
      { name: 'Overhead Tricep Extension', image: require('../../assets/exercises/overhead-tricep-extension.webp') },
      { name: 'Cable Overhead Extension',  image: require('../../assets/exercises/cable-overhead-extension.webp') },
      { name: 'Close-Grip Bench Press',    image: require('../../assets/exercises/close-grip-bench-press.webp') },
      { name: 'Tricep Dips',               image: require('../../assets/exercises/tricep-dips.webp') },
      { name: 'Dumbbell Kickback',         image: require('../../assets/exercises/dumbbell-kickback.webp') },
      { name: 'Diamond Push-Ups',          image: require('../../assets/exercises/diamond-push-ups.webp') },
    ],
  },
  {
    name: 'Shoulders',
    exercises: [
      { name: 'Overhead Press',          image: require('../../assets/exercises/overhead-press.webp') },
      { name: 'Dumbbell Shoulder Press', image: require('../../assets/exercises/dumbbell-shoulder-press.webp') },
      { name: 'Arnold Press',            image: require('../../assets/exercises/arnold-press.webp') },
      { name: 'Lateral Raise',           image: require('../../assets/exercises/lateral-raise.webp') },
      { name: 'Front Raise',             image: require('../../assets/exercises/front-raise.webp') },
      { name: 'Rear Delt Fly',           image: require('../../assets/exercises/rear-delt-fly.webp') },
      { name: 'Upright Row',             image: require('../../assets/exercises/upright-row.webp') },
      { name: 'Face Pull',               image: require('../../assets/exercises/face-pull.webp') },
    ],
  },
  {
    name: 'Legs',
    exercises: [
      { name: 'Squat',             image: require('../../assets/exercises/squat.webp') },
      { name: 'Leg Press',         image: require('../../assets/exercises/leg-press.webp') },
      { name: 'Romanian Deadlift', image: require('../../assets/exercises/romanian-deadlift.webp') },
      { name: 'Lunges',            image: require('../../assets/exercises/lunges.webp') },
      { name: 'Leg Extension',     image: require('../../assets/exercises/leg-extension.webp') },
      { name: 'Leg Curl',          image: require('../../assets/exercises/leg-curl.webp') },
      { name: 'Calf Raise',        image: require('../../assets/exercises/calf-raise.webp') },
      { name: 'Hip Thrust',        image: require('../../assets/exercises/hip-thrust.webp') },
    ],
  },
];
