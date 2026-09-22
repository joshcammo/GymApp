const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'android/**', 'ios/**', 'assets/**'],
  },

  ...expoConfig,

  {
    rules: {
      // Web-only rule. React Native has no HTML: <Text>it's</Text> renders the
      // apostrophe, and the "fix" (&apos;) would render those six characters
      // literally on screen. Escaping here breaks the UI rather than fixing it.
      'react/no-unescaped-entities': 'off',

      // The React Compiler rules that eslint-config-expo 57 turns on flag real
      // patterns across 18 sites, but every fix is a behavioural refactor of
      // working screens, and this project has no test suite, simulator or
      // device in CI — see "What has not been tested" in
      // APP_STORE_SUBMISSION.md. Refactoring them blind immediately before an
      // App Store submission is the wrong trade, so they are parked rather
      // than pretended away.
      //
      // `npm run lint:compiler` re-enables both so the debt stays greppable
      // and can be worked through with a device in hand. It is deliberately
      // not part of the CI gate.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs':                'off',
    },
  },
];
