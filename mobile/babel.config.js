module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': './',
            '@components': './components',
            '@hooks': './hooks',
            '@services': './services',
            '@store': './store',
            '@utils': './utils',
            '@constants': './constants',
            '@types': './types',
            '@config': './config',
            '@assets': './assets',
          },
        },
      ],
      'react-native-reanimated/plugin', // Must be last
    ],
  }
}
