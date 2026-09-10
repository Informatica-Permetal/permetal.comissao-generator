import type { FormatadorComissaoApi } from '@shared/contracts/api';

export {};

declare global {
  interface Window {
    api: FormatadorComissaoApi;
  }
}
