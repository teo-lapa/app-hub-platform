declare module 'odoo-xmlrpc' {
  interface OdooConfig {
    url: string
    port: number
    db: string
    username: string
    password: string
  }

  class Odoo {
    constructor(config: OdooConfig)
    connect(callback: (err: any) => void): void
    execute_kw(
      model: string,
      method: string,
      params: any[],
      callback: (err: any, value: any) => void
    ): void
  }

  export = Odoo
}
