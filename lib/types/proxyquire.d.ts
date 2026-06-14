declare module 'proxyquire' {
  interface Proxyquire {
    (path: string, stubs: Record<string, unknown>): unknown;
    noCallThru(): Proxyquire;
    callThru(): Proxyquire;
  }
  const proxyquire: Proxyquire;
  export = proxyquire;
}
