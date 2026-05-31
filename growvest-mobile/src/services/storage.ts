import AsyncStorage from '@react-native-async-storage/async-storage';
import {ScanRecord} from './scanner';

const KEYS = {
  SCANS: '@growvest_scans',
  ENABLED_STRATEGIES: '@growvest_enabled_strategies',
};

export async function saveScan(scan: ScanRecord): Promise<void> {
  const existing = await getScans();
  existing.unshift(scan);
  if (existing.length > 50) existing.length = 50;
  await AsyncStorage.setItem(KEYS.SCANS, JSON.stringify(existing));
}

export async function getScans(): Promise<ScanRecord[]> {
  const raw = await AsyncStorage.getItem(KEYS.SCANS);
  return raw ? JSON.parse(raw) : [];
}

export async function deleteScan(id: string): Promise<void> {
  const scans = await getScans();
  await AsyncStorage.setItem(KEYS.SCANS, JSON.stringify(scans.filter(s => s.id !== id)));
}

export async function getEnabledStrategies(): Promise<string[] | null> {
  const raw = await AsyncStorage.getItem(KEYS.ENABLED_STRATEGIES);
  return raw ? JSON.parse(raw) : null;
}

export async function setEnabledStrategies(names: string[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.ENABLED_STRATEGIES, JSON.stringify(names));
}
