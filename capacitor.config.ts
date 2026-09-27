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
      style: 'DARK',
      backgroundColor: '#ffffff',
    },
  },
}

export default config
