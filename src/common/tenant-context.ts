import { AsyncLocalStorage } from 'async_hooks';

export const tenantStorage = new AsyncLocalStorage<{ territorioId: string | null }>();

export class TenantContext {
  static get territorioId(): string | null {
    return tenantStorage.getStore()?.territorioId || null;
  }

  static run<T>(territorioId: string | null, fn: () => T): T {
    return tenantStorage.run({ territorioId }, fn);
  }
}
