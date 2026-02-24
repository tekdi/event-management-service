export interface TenantConfig {
  [tenantId: string]: {
    config: {
      [key: string]: any;
    };
    lastSynced?: string;
  };
}

export interface TenantConfigValue {
  config: {
    [key: string]: any;
  };
  lastSynced?: string;
  IsConfigsSync?: number;
}
