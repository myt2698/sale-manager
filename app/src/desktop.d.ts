export {};

declare global {
  interface Window {
    desktopAPI?: {
      loadState(): Promise<Record<string, string>>;
      saveState(state: Record<string, string>): Promise<{ ok: boolean }>;
      getInfo(): Promise<{ dataDir: string; databasePath: string; isPortable: boolean }>;
      openDataDir(): Promise<string>;
      createBackup(): Promise<{ canceled: boolean; filePath?: string }>;
      restoreBackup(): Promise<{ canceled: boolean; state?: Record<string, string> }>;
      saveExport(payload: { name: string; base64: string }): Promise<{ canceled: boolean; filePath?: string }>;
    };
  }
}
