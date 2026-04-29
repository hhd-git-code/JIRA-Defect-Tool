import type { ReproduceRate } from '../types/defect';

export interface ReproduceRateOption {
  label: string;
  value: ReproduceRate;
}

export const REPRODUCE_RATE_OPTIONS: ReproduceRateOption[] = [
  { label: 'Always', value: 'Always' },
  { label: 'Often', value: 'Often' },
  { label: 'Sometimes', value: 'Sometimes' },
  { label: 'Rarely', value: 'Rarely' },
  { label: 'Unable to Reproduce', value: 'Unable to Reproduce' },
];
