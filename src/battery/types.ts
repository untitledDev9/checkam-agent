/** Shared battery data types used across windows/mac parsers and the HTTP layer */

export interface BatteryData {
  platform: 'windows' | 'mac';
  /** Full Charge Capacity / Design Capacity * 100, rounded to 1 decimal */
  health: number;
  /** mWh on Windows, mAh on macOS */
  designCapacity: number;
  /** mWh on Windows, mAh on macOS */
  fullChargeCapacity: number;
  /** Charge cycles, null if the OS doesn't expose it */
  cycleCount: number | null;
  /** Unit label for UI */
  unit: 'mWh' | 'mAh';
}
