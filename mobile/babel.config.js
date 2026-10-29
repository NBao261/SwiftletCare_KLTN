// babel-preset-expo (SDK 53) đã tự đọc alias `@/*` từ tsconfig.json và tự thêm plugin Reanimated
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
  }
}
