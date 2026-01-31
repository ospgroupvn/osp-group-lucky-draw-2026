export enum SpinMode {
  ALL_AT_ONCE = 'ALL_AT_ONCE', // All digits stop at the same time
  SEQUENTIAL = 'SEQUENTIAL',   // Digits stop one by one from left to right
  MANUAL = 'MANUAL',           // User clicks each digit to reveal it
}

export enum ManualRevealMode {
  CLICK = 'CLICK',       // User clicks each digit to reveal it (default)
  TIMER = 'TIMER',       // Digits auto-reveal one by one with timer
}

export enum RandomSource {
  LOCAL = 'LOCAL',           // Use crypto.getRandomValues()
  RANDOM_ORG = 'RANDOM_ORG', // Use Random.org API
}

export interface Prize {
  id: string;
  name: string; // e.g., "Giải Nhất", "Khuyến Khích"
  quantity: number; // How many winners for this prize
  spinMode: SpinMode;
  spinDuration: number; // Duration in ms before stopping (or between stops for sequential)
  digitCount: number; // usually 3
  manualRevealMode?: ManualRevealMode; // Only used when spinMode is MANUAL - CLICK (user clicks) or TIMER (auto reveal with timer)
}

export interface Winner {
  id: string;
  prizeId: string;
  prizeName: string;
  number: string; // The winning number padded (e.g., "007")
  timestamp: number;
}

export interface GlobalSettings {
  minNumber: number;
  maxNumber: number;
  excludePreviousWinners: boolean;
  randomSource: RandomSource; // LOCAL or RANDOM_ORG
  randomOrgApiKey?: string; // Optional API key for Random.org (true random)
}
