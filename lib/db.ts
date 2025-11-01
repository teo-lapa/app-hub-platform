/**
 * Database client wrapper
 * Compatibile con PostgreSQL (Vercel Postgres)
 */

import { sql } from '@vercel/postgres';

export const db = {
  query: async (text: string, params?: any[]) => {
    if (params && params.length > 0) {
      // Con parametri, usa prepared statement
      // Converti $1, $2, etc. in template literal
      let query = text;
      params.forEach((param, index) => {
        query = query.replace(`$${index + 1}`, `'${param}'`);
      });
      const result = await sql.query(query);
      return result;
    } else {
      // Senza parametri
      const result = await sql.query(text);
      return result;
    }
  },
};
