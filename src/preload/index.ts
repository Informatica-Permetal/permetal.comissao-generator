import { contextBridge } from 'electron';

// Phase 1+ adds narrow typed IPC methods here; never expose generic fs/ipcRenderer passthrough.
const api = {} as const;

contextBridge.exposeInMainWorld('api', api);
