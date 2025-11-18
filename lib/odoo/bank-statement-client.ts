/**
 * Odoo Bank Statement Client
 *
 * Handles bank statement import and account reconciliation via Odoo XML-RPC API
 *
 * Models used:
 * - account.journal: Bank accounts/journals
 * - account.bank.statement: Bank statements
 * - account.bank.statement.line: Individual transactions
 * - res.partner.bank: Bank account details
 */

import { OdooClient } from './xmlrpc-client';

export interface OdooBankAccount {
  id: number;
  name: string;
  code: string;
  currency_id: [number, string];
  type: string;
  bank_account_id?: [number, string];
  company_id: [number, string];
}

export interface OdooJournal {
  id: number;
  name: string;
  code: string;
  type: 'bank' | 'cash' | 'sale' | 'purchase' | 'general';
  currency_id?: [number, string];
  bank_account_id?: [number, string];
  default_account_id?: [number, string];
}

export interface OdooBankStatement {
  id: number;
  name: string;
  journal_id: [number, string];
  date: string; // YYYY-MM-DD
  balance_start: number;
  balance_end_real: number;
  balance_end: number; // Computed from transactions
  state: 'open' | 'confirm' | 'posted';
  line_ids: number[];
  company_id: [number, string];
}

export interface OdooBankStatementLine {
  id: number;
  statement_id: [number, string];
  date: string; // YYYY-MM-DD
  payment_ref: string; // Transaction reference/description
  partner_id?: [number, string];
  amount: number; // Positive = credit, negative = debit
  running_balance?: number;
  foreign_currency_id?: [number, string];
  amount_currency?: number;
  is_reconciled: boolean;
  move_id?: [number, string]; // Linked accounting move
  sequence?: number;
}

export interface CreateStatementInput {
  journalId: number;
  name: string; // Statement name (e.g., "UBS CHF Q1 2024")
  date: string; // Statement date (end date)
  balanceStart: number;
  balanceEnd: number;
  lines: CreateStatementLineInput[];
}

export interface CreateStatementLineInput {
  date: string; // Transaction date
  paymentRef: string; // Description
  partnerName?: string; // Partner name (will be matched or created)
  amount: number; // Amount (positive = credit, negative = debit)
  sequence?: number;
  reference?: string; // Additional reference
}

export class OdooBankStatementClient {
  private odoo: OdooClient;

  constructor(config: {
    url: string;
    db: string;
    username: string;
    password: string;
  }) {
    this.odoo = new OdooClient(config);
  }

  /**
   * Connect to Odoo
   */
  async connect(): Promise<void> {
    await this.odoo.connect();
  }

  /**
   * Find bank journal by code or name
   */
  async findJournal(codeOrName: string): Promise<OdooJournal | null> {
    const journals = await this.odoo.searchRead<OdooJournal>(
      'account.journal',
      [
        '|',
        ['code', '=', codeOrName],
        ['name', 'ilike', codeOrName]
      ],
      {
        fields: ['name', 'code', 'type', 'currency_id', 'bank_account_id', 'default_account_id'],
        limit: 1
      }
    );

    return journals.length > 0 ? journals[0] : null;
  }

  /**
   * Get all bank journals
   */
  async getBankJournals(): Promise<OdooJournal[]> {
    return this.odoo.searchRead<OdooJournal>(
      'account.journal',
      [['type', '=', 'bank']],
      {
        fields: ['name', 'code', 'type', 'currency_id', 'bank_account_id', 'default_account_id']
      }
    );
  }

  /**
   * Find existing bank statement by name and journal
   */
  async findStatement(
    journalId: number,
    name: string
  ): Promise<OdooBankStatement | null> {
    const statements = await this.odoo.searchRead<OdooBankStatement>(
      'account.bank.statement',
      [
        ['journal_id', '=', journalId],
        ['name', '=', name]
      ],
      {
        fields: ['name', 'journal_id', 'date', 'balance_start', 'balance_end_real', 'balance_end', 'state', 'line_ids'],
        limit: 1
      }
    );

    return statements.length > 0 ? statements[0] : null;
  }

  /**
   * Get bank statements for a journal in a date range
   */
  async getStatements(
    journalId: number,
    dateFrom?: string,
    dateTo?: string
  ): Promise<OdooBankStatement[]> {
    const domain: any[] = [['journal_id', '=', journalId]];

    if (dateFrom) {
      domain.push(['date', '>=', dateFrom]);
    }
    if (dateTo) {
      domain.push(['date', '<=', dateTo]);
    }

    return this.odoo.searchRead<OdooBankStatement>(
      'account.bank.statement',
      domain,
      {
        fields: ['name', 'journal_id', 'date', 'balance_start', 'balance_end_real', 'balance_end', 'state', 'line_ids'],
        order: 'date asc'
      }
    );
  }

  /**
   * Create a new bank statement
   */
  async createStatement(input: CreateStatementInput): Promise<number> {
    // Create statement without lines first
    const statementId = await this.odoo.create('account.bank.statement', {
      name: input.name,
      journal_id: input.journalId,
      date: input.date,
      balance_start: input.balanceStart,
      balance_end_real: input.balanceEnd
    });

    // Create lines
    if (input.lines && input.lines.length > 0) {
      await this.createStatementLines(statementId, input.lines);
    }

    return statementId;
  }

  /**
   * Create statement lines
   */
  async createStatementLines(
    statementId: number,
    lines: CreateStatementLineInput[]
  ): Promise<number[]> {
    const lineIds: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Find partner if name provided
      let partnerId: number | undefined;
      if (line.partnerName) {
        partnerId = await this.findOrCreatePartner(line.partnerName);
      }

      const lineData: any = {
        statement_id: statementId,
        date: line.date,
        payment_ref: line.paymentRef,
        amount: line.amount,
        sequence: line.sequence || i + 1
      };

      if (partnerId) {
        lineData.partner_id = partnerId;
      }

      const lineId = await this.odoo.create('account.bank.statement.line', lineData);
      lineIds.push(lineId);
    }

    return lineIds;
  }

  /**
   * Find or create partner by name
   */
  private async findOrCreatePartner(name: string): Promise<number> {
    // Search for existing partner
    const partners = await this.odoo.searchRead(
      'res.partner',
      [['name', 'ilike', name]],
      { fields: ['id'], limit: 1 }
    );

    if (partners.length > 0) {
      return partners[0].id;
    }

    // Create new partner
    return this.odoo.create('res.partner', {
      name: name,
      is_company: true
    });
  }

  /**
   * Get statement lines
   */
  async getStatementLines(statementId: number): Promise<OdooBankStatementLine[]> {
    return this.odoo.searchRead<OdooBankStatementLine>(
      'account.bank.statement.line',
      [['statement_id', '=', statementId]],
      {
        fields: [
          'statement_id',
          'date',
          'payment_ref',
          'partner_id',
          'amount',
          'running_balance',
          'foreign_currency_id',
          'amount_currency',
          'is_reconciled',
          'move_id',
          'sequence'
        ],
        order: 'sequence asc, date asc'
      }
    );
  }

  /**
   * Post (confirm) a bank statement
   */
  async postStatement(statementId: number): Promise<void> {
    // In Odoo, posting is done via button_post method
    await this.odoo.execute(
      'account.bank.statement',
      'button_post',
      [statementId]
    );
  }

  /**
   * Delete a bank statement
   */
  async deleteStatement(statementId: number): Promise<void> {
    // First set to draft if posted
    const [statement] = await this.odoo.read<OdooBankStatement>(
      'account.bank.statement',
      [statementId],
      { fields: ['state'] }
    );

    if (statement.state === 'posted' || statement.state === 'confirm') {
      // Try to reset to draft
      try {
        await this.odoo.execute(
          'account.bank.statement',
          'button_reopen',
          [statementId]
        );
      } catch (error) {
        console.warn('Could not reset statement to draft:', error);
      }
    }

    // Delete statement (will cascade delete lines)
    await this.odoo.delete('account.bank.statement', [statementId]);
  }

  /**
   * Get current balance for a journal
   */
  async getJournalBalance(journalId: number): Promise<number> {
    // Get the last posted statement
    const statements = await this.odoo.searchRead<OdooBankStatement>(
      'account.bank.statement',
      [
        ['journal_id', '=', journalId],
        ['state', '=', 'posted']
      ],
      {
        fields: ['balance_end_real'],
        order: 'date desc',
        limit: 1
      }
    );

    return statements.length > 0 ? statements[0].balance_end_real : 0;
  }

  /**
   * Reconcile statement lines automatically
   */
  async autoReconcile(statementId: number): Promise<{
    reconciled: number;
    total: number;
  }> {
    // Get unreconciled lines
    const lines = await this.odoo.searchRead<OdooBankStatementLine>(
      'account.bank.statement.line',
      [
        ['statement_id', '=', statementId],
        ['is_reconciled', '=', false]
      ],
      { fields: ['id'] }
    );

    let reconciled = 0;

    // Try to reconcile each line
    for (const line of lines) {
      try {
        // Call reconcile method
        await this.odoo.execute(
          'account.bank.statement.line',
          'button_undo_reconciliation',
          [line.id]
        );
        reconciled++;
      } catch (error) {
        // Reconciliation failed - that's ok
        console.debug(`Line ${line.id} could not be auto-reconciled`);
      }
    }

    return {
      reconciled,
      total: lines.length
    };
  }

  /**
   * Import statement with validation
   */
  async importStatement(input: CreateStatementInput): Promise<{
    statementId: number;
    linesCreated: number;
    balanceMatches: boolean;
    computedBalance: number;
    expectedBalance: number;
  }> {
    // Check if statement already exists
    const existing = await this.findStatement(input.journalId, input.name);
    if (existing) {
      throw new Error(
        `Statement "${input.name}" already exists for this journal (ID: ${existing.id})`
      );
    }

    // Create statement
    const statementId = await this.createStatement(input);

    // Validate balance
    const computedBalance = input.balanceStart + input.lines.reduce(
      (sum, line) => sum + line.amount,
      0
    );

    const balanceMatches = Math.abs(computedBalance - input.balanceEnd) < 0.01;

    return {
      statementId,
      linesCreated: input.lines.length,
      balanceMatches,
      computedBalance: parseFloat(computedBalance.toFixed(2)),
      expectedBalance: input.balanceEnd
    };
  }

  /**
   * Get statement summary
   */
  async getStatementSummary(statementId: number): Promise<{
    name: string;
    journal: string;
    date: string;
    balanceStart: number;
    balanceEnd: number;
    computedBalance: number;
    transactionCount: number;
    totalCredits: number;
    totalDebits: number;
    reconciled: number;
    unreconciled: number;
    balanceMatches: boolean;
  }> {
    // Get statement
    const [statement] = await this.odoo.read<OdooBankStatement>(
      'account.bank.statement',
      [statementId],
      {
        fields: ['name', 'journal_id', 'date', 'balance_start', 'balance_end_real', 'balance_end']
      }
    );

    // Get lines
    const lines = await this.getStatementLines(statementId);

    const totalCredits = lines
      .filter(l => l.amount > 0)
      .reduce((sum, l) => sum + l.amount, 0);

    const totalDebits = lines
      .filter(l => l.amount < 0)
      .reduce((sum, l) => sum + l.amount, 0);

    const computedBalance = statement.balance_start + totalCredits + totalDebits;

    const reconciled = lines.filter(l => l.is_reconciled).length;
    const unreconciled = lines.length - reconciled;

    return {
      name: statement.name,
      journal: statement.journal_id[1],
      date: statement.date,
      balanceStart: statement.balance_start,
      balanceEnd: statement.balance_end_real,
      computedBalance: parseFloat(computedBalance.toFixed(2)),
      transactionCount: lines.length,
      totalCredits: parseFloat(totalCredits.toFixed(2)),
      totalDebits: parseFloat(totalDebits.toFixed(2)),
      reconciled,
      unreconciled,
      balanceMatches: Math.abs(computedBalance - statement.balance_end_real) < 0.01
    };
  }
}
