const { existsSync } = require('fs')

// File Firebase của bản Android (ALERT-FR-002): biến môi trường kiểu file của EAS, hoặc mobile/google-services.json trên máy (gitignored)
function getGoogleServicesFile() {
  if (process.env.GOOGLE_SERVICES_JSON) return process.env.GOOGLE_SERVICES_JSON
  return existsSync('./google-services.json') ? './google-services.json' : undefined
}

// Cấu hình đọc từ app.json; chỉ thêm googleServicesFile khi có file, để bản build không có Firebase (Expo Go, máy dev) vẫn chạy
module.exports = ({ config }) => {
  const googleServicesFile = getGoogleServicesFile()
  return {
    ...config,
    android: googleServicesFile ? { ...config.android, googleServicesFile } : config.android,
  }
}
