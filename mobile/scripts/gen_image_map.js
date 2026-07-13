const fs = require('fs');
const path = require('path');
const dir = path.join(process.cwd(), 'assets', 'exercises');
const files = fs.readdirSync(dir).filter(f => /\.(webp|png|jpg)$/.test(f)).sort();
const lines = files.map(f => {
  const key = f.replace(/\.(webp|png|jpg)$/, '');
  return `  '${key}': require('../../assets/exercises/${f}'),`;
});
const out = `import { ImageSourcePropType } from 'react-native';

/**
 * image_key (from exercise_defs) -> bundled illustration.
 * GENERATED from the contents of assets/exercises/ — regenerate with
 * scripts/gen_image_map.js after adding art. Keys missing here (new
 * catalog art not yet generated, custom exercises) fall back to a
 * muscle-group icon tile in the picker.
 */
export const EXERCISE_IMAGES: Record<string, ImageSourcePropType> = {
${lines.join('\n')}
};
`;
fs.writeFileSync(path.join(process.cwd(), 'src', 'constants', 'exerciseImages.ts'), out);
console.log(`wrote ${files.length} entries`);
