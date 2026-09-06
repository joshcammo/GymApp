module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo adds the worklets/Reanimated plugin itself when the
    // package is installed, so listing it here would apply it twice.
    presets: ['babel-preset-expo'],
  };
};
