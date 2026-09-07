import { View, Text, StyleSheet } from 'react-native'

/** AUTH-FR-002: Login Screen – M4 implements full UI */
export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SwiftletCare</Text>
      <Text style={styles.subtitle}>Đăng nhập</Text>
      {/* TODO: M4 – Login form with email/password + OTP */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D9488' },
  title:     { fontSize: 36, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  subtitle:  { fontSize: 18, color: '#CCFBF1' },
})
