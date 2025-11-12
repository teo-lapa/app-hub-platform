declare module 'xmlrpc' {
  export interface ClientOptions {
    host: string
    port?: number
    path?: string
    cookies?: boolean
    headers?: Record<string, string>
  }

  export interface Client {
    methodCall(
      method: string,
      params: any[],
      callback: (error: any, value: any) => void
    ): void
  }

  export function createClient(options: ClientOptions): Client
  export function createSecureClient(options: ClientOptions): Client
}
