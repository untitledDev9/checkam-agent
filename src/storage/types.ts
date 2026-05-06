export interface StorageDisk {
  model: string;
  healthStatus: 'Healthy' | 'Warning' | 'Unhealthy' | 'Unknown';
  mediaType: 'SSD' | 'HDD' | 'NVMe' | 'Unknown';
  sizeGB: number;
  temperature: number | null;
  wearLevel: number | null;
}

export interface StorageData {
  platform: 'windows' | 'mac';
  disks: StorageDisk[];
}
