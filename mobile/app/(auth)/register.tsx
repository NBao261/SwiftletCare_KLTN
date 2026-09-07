import { View, Text, StyleSheet } from 'react-native'

/** AUTH-FR-001: Register Screen */
export default function RegisterScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Đăng ký tài khoản</Text>
      {/* TODO: M4 – Registration form */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title:     { fontSize: 24, fontWeight: '600' },
})
