import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chuiyi.modknight',
  appName: '魔改骑士',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#110e18'
  }
};

export default config;
