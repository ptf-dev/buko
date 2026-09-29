import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'al.ngopu.app',
  appName: 'Ngopu',
  webDir: 'dist',
  backgroundColor: '#00615f',
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#00615f',
      showSpinner: false,
    },
    StatusBar: {
      // Dark icons on the app's white header (main.tsx sets the same at runtime).
      style: 'LIGHT',
      backgroundColor: '#ffffff',
    },
    PushNotifications: {
      // iOS: show a push that arrives while the app is open.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
