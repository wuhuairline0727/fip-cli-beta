declare module 'chrome-remote-interface' {
  interface CDPClient {
    Runtime: {
      evaluate(options: {
        expression: string;
        returnByValue?: boolean;
      }): Promise<{
        result?: {
          value?: unknown;
          type?: string;
        };
      }>;
    };
    Input: {
      dispatchMouseEvent(options: {
        type: string;
        x: number;
        y: number;
        button?: string;
        clickCount?: number;
      }): Promise<void>;
    };
    close(): Promise<void>;
  }

  function CDP(options?: { port?: number }): Promise<CDPClient>;

  export = CDP;
  export default CDP;
}
