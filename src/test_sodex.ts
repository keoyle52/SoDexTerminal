import { fetchPerpsAccountState } from './api/services.js';
import { useSettingsStore } from './store/settingsStore.js';

const keys = [
  '0x72a0ac99954a62de63a23908b6b4430694c1b2bec3b2d418370c74b97a9a4ba5',
  '0x95cc77cfcee7cf785def506d54d483fb0ccdd99634fbd205cb5214b7d87bd0cb'
];

async function runTest() {
  for (const key of keys) {
    console.log(`\nTesting key: ${key}`);
    useSettingsStore.setState({
      apiKeyName: '',
      privateKey: key,
      isTestnet: true
    });
    try {
      const res = await fetchPerpsAccountState();
      console.log('Account State:', res);
      console.log('SUCCESS! Key is valid and signing works.');
      return;
    } catch (e: any) {
      console.error('Error fetching account state:', e.message || e);
    }
  }
}

runTest();
