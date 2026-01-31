import { Prize, SpinMode, GlobalSettings, RandomSource, ManualRevealMode, AutoStopMode } from './types';

export const DEFAULT_SETTINGS: GlobalSettings = {
  minNumber: 0,
  maxNumber: 133,
  excludePreviousWinners: true,
  randomSource: RandomSource.RANDOM_ORG, // Default to Random.org
  randomOrgApiKey: '750accd7-4cac-4dd1-a5c2-df556eb316b5',
};

export const DEFAULT_PRIZES: Prize[] = [
  {
    id: 'g-db',
    name: 'Giải Đặc Biệt',
    quantity: 1,
    spinMode: SpinMode.MANUAL,
    spinDuration: 15000, // 15s
    digitCount: 3,
    manualRevealMode: ManualRevealMode.CLICK,
  },
  {
    id: 'g-1',
    name: 'Giải Nhất',
    quantity: 1,
    spinMode: SpinMode.MANUAL,
    spinDuration: 15000, // 15s
    digitCount: 3,
    manualRevealMode: ManualRevealMode.CLICK,
  },
  {
    id: 'g-2',
    name: 'Giải Nhì',
    quantity: 1,
    spinMode: SpinMode.MANUAL,
    spinDuration: 10000, // 10s
    digitCount: 3,
    manualRevealMode: ManualRevealMode.CLICK,
  },
  {
    id: 'g-3',
    name: 'Giải Ba',
    quantity: 3,
    spinMode: SpinMode.MANUAL,
    spinDuration: 5000, // 5s
    digitCount: 3,
    manualRevealMode: ManualRevealMode.CLICK,
  },
  {
    id: 'kk-1',
    name: 'Giải Khuyến Khích',
    quantity: 6,
    spinMode: SpinMode.ALL_AT_ONCE,
    autoStopMode: AutoStopMode.MANUAL,
    spinDuration: 5000, // 5s
    digitCount: 3,
  }
];
