/**
 * Odoo XML-RPC Client
 * Direct XML-RPC implementation that works reliably
 */

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = process.env.NEXT_PUBLIC_ODOO_DB || process.env.ODOO_DB || 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = process.env.ODOO_USERNAME || 'paul@lapa.ch';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || 'lapa201180';

interface OdooXMLRPC {
  authenticate(): Promise<number>;
  execute_kw(model: string, method: string, args: any[], kwargs?: any): Promise<any>;
}

class OdooXMLRPCClient implements OdooXMLRPC {
  private uid: number | null = null;

  async authenticate(): Promise<number> {
    if (this.uid) {
      return this.uid;
    }

    const response = await fetch(`${ODOO_URL}/xmlrpc/2/common`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: this.buildXMLRPC('authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {}])
    });

    const text = await response.text();
    const uid = this.parseXMLRPCResponse(text);

    if (!uid || uid === false) {
      throw new Error('Odoo authentication failed');
    }

    this.uid = uid;
    return uid;
  }

  async execute_kw(model: string, method: string, args: any[] = [], kwargs: any = {}): Promise<any> {
    const uid = await this.authenticate();

    const response = await fetch(`${ODOO_URL}/xmlrpc/2/object`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: this.buildXMLRPC('execute_kw', [
        ODOO_DB,
        uid,
        ODOO_PASSWORD,
        model,
        method,
        args,
        kwargs
      ])
    });

    const text = await response.text();
    return this.parseXMLRPCResponse(text);
  }

  private buildXMLRPC(methodName: string, params: any[]): string {
    const paramsXML = params.map(p => this.valueToXML(p)).join('');

    return `<?xml version="1.0"?>
<methodCall>
  <methodName>${methodName}</methodName>
  <params>
    ${paramsXML}
  </params>
</methodCall>`;
  }

  private valueToXML(value: any): string {
    if (value === null || value === undefined) {
      return '<param><value><boolean>0</boolean></value></param>';
    }

    if (typeof value === 'boolean') {
      return `<param><value><boolean>${value ? '1' : '0'}</boolean></value></param>`;
    }

    if (typeof value === 'number') {
      return `<param><value><int>${value}</int></value></param>`;
    }

    if (typeof value === 'string') {
      return `<param><value><string>${this.escapeXML(value)}</string></value></param>`;
    }

    if (Array.isArray(value)) {
      const arrayData = value.map(v => this.valueToXMLData(v)).join('');
      return `<param><value><array><data>${arrayData}</data></array></value></param>`;
    }

    if (typeof value === 'object') {
      const members = Object.entries(value)
        .map(([k, v]) => `<member><name>${k}</name>${this.valueToXMLData(v)}</member>`)
        .join('');
      return `<param><value><struct>${members}</struct></value></param>`;
    }

    return '<param><value><string></string></value></param>';
  }

  private valueToXMLData(value: any): string {
    if (value === null || value === undefined) {
      return '<value><boolean>0</boolean></value>';
    }

    if (typeof value === 'boolean') {
      return `<value><boolean>${value ? '1' : '0'}</boolean></value>`;
    }

    if (typeof value === 'number') {
      return `<value><int>${value}</int></value>`;
    }

    if (typeof value === 'string') {
      return `<value><string>${this.escapeXML(value)}</string></value>`;
    }

    if (Array.isArray(value)) {
      const arrayData = value.map(v => this.valueToXMLData(v)).join('');
      return `<value><array><data>${arrayData}</data></array></value>`;
    }

    if (typeof value === 'object') {
      const members = Object.entries(value)
        .map(([k, v]) => `<member><name>${k}</name>${this.valueToXMLData(v)}</member>`)
        .join('');
      return `<value><struct>${members}</struct></value>`;
    }

    return '<value><string></string></value>';
  }

  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private parseXMLRPCResponse(xml: string): any {
    // Simple parser for methodResponse
    // Extract the value inside <param><value>...</value></param>
    const paramMatch = xml.match(/<param>\s*<value>([\s\S]*)<\/value>\s*<\/param>/);
    if (!paramMatch) {
      throw new Error('Invalid XML-RPC response');
    }

    const valueContent = paramMatch[1];

    // Check for array FIRST (before checking for nested types)
    const arrayMatch = valueContent.match(/<array><data>([\s\S]*?)<\/data><\/array>/);
    if (arrayMatch) {
      const items: any[] = [];
      const dataContent = arrayMatch[1];
      // Match struct values specifically to avoid non-greedy issues with nested <value> tags
      const structValueRegex = /<value><struct>([\s\S]*?)<\/struct><\/value>/g;
      let match;

      while ((match = structValueRegex.exec(dataContent)) !== null) {
        const structContent = match[1];

        // Parse struct members
        const obj: any = {};
        const memberRegex = /<member>\s*<name>(.*?)<\/name>\s*<value>([\s\S]*?)<\/value>\s*<\/member>/g;
        let memberMatch;

        while ((memberMatch = memberRegex.exec(structContent)) !== null) {
          const key = memberMatch[1];
          const valContent = memberMatch[2];

          const intM = valContent.match(/<int>(\d+)<\/int>/);
          const strM = valContent.match(/<string>(.*?)<\/string>/);
          const boolM = valContent.match(/<boolean>([01])<\/boolean>/);

          if (intM) obj[key] = parseInt(intM[1], 10);
          else if (strM) obj[key] = strM[1];
          else if (boolM) obj[key] = boolM[1] === '1';
          else obj[key] = null;
        }

        items.push(obj);
      }

      return items;
    }

    // Fallback: try parsing as array of primitives
    const arrayPrimitiveMatch = valueContent.match(/<array><data>([\s\S]*?)<\/data><\/array>/);
    if (arrayPrimitiveMatch) {
      const items: any[] = [];
      const dataContent = arrayPrimitiveMatch[1];

      // Match primitive values (int, string, etc.)
      const intValueRegex = /<value><int>(\d+)<\/int><\/value>/g;
      let intMatch;
      while ((intMatch = intValueRegex.exec(dataContent)) !== null) {
        items.push(parseInt(intMatch[1], 10));
      }

      if (items.length > 0) {
        return items;
      }

      // Could add more primitive types here if needed

      // If no primitives found, check if there were structs that we missed
      const hasStructs = dataContent.includes('<struct>');
      if (hasStructs) {
        // There are structs but we couldn't parse them - return what we have
        return items;
      }
    }

    // Original struct parsing code (keeping for backward compatibility)
    {
      const arrayMatch2 = valueContent.match(/<array><data>([\s\S]*?)<\/data><\/array>/);
      if (arrayMatch2) {
        const items: any[] = [];
        const dataContent = arrayMatch2[1];
        const valueRegex = /<value>([\s\S]*?)<\/value>/g;
        let match;

        while ((match = valueRegex.exec(dataContent)) !== null) {
          const itemContent = match[1];

          // Parse struct
          const structMatch = itemContent.match(/<struct>([\s\S]*?)<\/struct>/);
          if (structMatch) {
          const obj: any = {};
          const memberRegex = /<member>\s*<name>(.*?)<\/name>\s*<value>([\s\S]*?)<\/value>\s*<\/member>/g;
          let memberMatch;

          while ((memberMatch = memberRegex.exec(structMatch[1])) !== null) {
            const key = memberMatch[1];
            const valContent = memberMatch[2];

            const intM = valContent.match(/<int>(\d+)<\/int>/);
            const strM = valContent.match(/<string>(.*?)<\/string>/);
            const boolM = valContent.match(/<boolean>([01])<\/boolean>/);

            if (intM) obj[key] = parseInt(intM[1], 10);
            else if (strM) obj[key] = strM[1];
            else if (boolM) obj[key] = boolM[1] === '1';
            else obj[key] = null;
          }

          items.push(obj);
        }
      }

      return items;
      }
    }

    // Check for int
    const intMatch = valueContent.match(/<int>(\d+)<\/int>/);
    if (intMatch) {
      return parseInt(intMatch[1], 10);
    }

    // Check for boolean
    const boolMatch = valueContent.match(/<boolean>([01])<\/boolean>/);
    if (boolMatch) {
      return boolMatch[1] === '1';
    }

    // Check for string
    const strMatch = valueContent.match(/<string>(.*?)<\/string>/);
    if (strMatch) {
      return strMatch[1];
    }

    return null;
  }
}

let clientInstance: OdooXMLRPCClient | null = null;

export async function getOdooXMLRPCClient(): Promise<OdooXMLRPC> {
  if (!clientInstance) {
    clientInstance = new OdooXMLRPCClient();
  }
  return clientInstance;
}
