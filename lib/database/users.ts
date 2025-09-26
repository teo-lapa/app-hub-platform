import { User } from '@/lib/types';
import bcrypt from 'bcryptjs';

// Simulazione database in memoria - in produzione usare un vero database
export class UserDatabase {
  private static users: Map<string, User & { password: string }> = new Map();

  static async init() {
    // Crea utenti di default se il database è vuoto
    if (this.users.size === 0) {
      await this.createDefaultUsers();
    }
  }

  private static async createDefaultUsers() {
    const defaultUsers = [
      {
        id: 'admin-001',
        email: 'admin@lapa.com',
        password: await bcrypt.hash('admin123', 12),
        name: 'Amministratore LAPA',
        role: 'admin' as const,
        telefono: '+39 123 456 789',
        azienda: 'LAPA S.r.l.',
        indirizzo: 'Via Roma 123',
        citta: 'Milano',
        cap: '20100',
        partitaIva: 'IT12345678901',
        codiceCliente: 'ADMIN001',
        note: 'Account amministratore principale',
        abilitato: true,
        appPermessi: ['1', '2', '3', '4', '5', '6'], // Tutte le app
        createdAt: new Date('2023-01-01'),
        lastLogin: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'dipendente-001',
        email: 'mario.rossi@lapa.com',
        password: await bcrypt.hash('mario123', 12),
        name: 'Mario Rossi',
        role: 'dipendente' as const,
        telefono: '+39 123 456 788',
        azienda: 'LAPA S.r.l.',
        indirizzo: 'Via Roma 123',
        citta: 'Milano',
        cap: '20100',
        codiceCliente: 'DIP001',
        note: 'Dipendente area vendite',
        abilitato: true,
        appPermessi: ['1', '2', '4'], // Menu, Booking, Analytics
        createdAt: new Date('2023-02-01'),
        lastLogin: new Date('2024-01-15'),
        updatedAt: new Date(),
      },
      {
        id: 'cliente-premium-001',
        email: 'ristorante.bella@gmail.com',
        password: await bcrypt.hash('bella123', 12),
        name: 'Giuseppe Verdi',
        role: 'cliente_premium' as const,
        telefono: '+39 334 567 890',
        azienda: 'Ristorante Bella Vista',
        indirizzo: 'Corso Venezia 45',
        citta: 'Roma',
        cap: '00187',
        partitaIva: 'IT98765432109',
        codiceCliente: 'PREM001',
        note: 'Cliente premium dal 2023',
        abilitato: true,
        appPermessi: ['1', '2', '5'], // Menu, Booking, Inventory
        createdAt: new Date('2023-03-15'),
        lastLogin: new Date('2024-01-10'),
        updatedAt: new Date(),
      },
      {
        id: 'cliente-gratuito-001',
        email: 'trattoria.marco@hotmail.com',
        password: await bcrypt.hash('marco123', 12),
        name: 'Marco Bianchi',
        role: 'cliente_gratuito' as const,
        telefono: '+39 345 678 901',
        azienda: 'Trattoria da Marco',
        indirizzo: 'Via Garibaldi 12',
        citta: 'Napoli',
        cap: '80100',
        partitaIva: 'IT11223344556',
        codiceCliente: 'FREE001',
        note: 'Cliente da convertire a premium',
        abilitato: true,
        appPermessi: ['1'], // Solo Menu App
        createdAt: new Date('2023-06-01'),
        lastLogin: new Date('2023-12-20'),
        updatedAt: new Date(),
      },
      {
        id: 'cliente-disabilitato-001',
        email: 'old.client@example.com',
        password: await bcrypt.hash('old123', 12),
        name: 'Cliente Disabilitato',
        role: 'cliente_gratuito' as const,
        telefono: '+39 366 789 012',
        azienda: 'Vecchio Ristorante',
        indirizzo: 'Via Vecchia 1',
        citta: 'Torino',
        cap: '10100',
        codiceCliente: 'DIS001',
        note: 'Account disabilitato per mancato pagamento',
        abilitato: false,
        appPermessi: [],
        createdAt: new Date('2022-01-01'),
        lastLogin: new Date('2023-06-01'),
        updatedAt: new Date(),
      }
    ];

    for (const user of defaultUsers) {
      this.users.set(user.email, user);
    }
  }

  static async authenticate(email: string, password: string): Promise<User | null> {
    await this.init();
    const user = this.users.get(email);

    if (!user || !user.abilitato) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return null;
    }

    // Aggiorna ultimo login
    user.lastLogin = new Date();

    // Ritorna user senza password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  static async getUserById(id: string): Promise<User | null> {
    await this.init();
    const user = Array.from(this.users.values()).find(u => u.id === id);
    if (!user) return null;

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  static async getUserByEmail(email: string): Promise<User | null> {
    await this.init();
    const user = this.users.get(email);
    if (!user) return null;

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  static async updateUser(id: string, updates: Partial<User & { password?: string }>): Promise<User | null> {
    await this.init();
    const user = Array.from(this.users.values()).find(u => u.id === id);
    if (!user) return null;

    // Aggiorna i campi
    Object.assign(user, updates);
    user.updatedAt = new Date();

    // Se c'è una nuova password, hashala
    if (updates.password) {
      user.password = await bcrypt.hash(updates.password, 12);
    }

    // Aggiorna nella mappa se l'email è cambiata
    if (updates.email && updates.email !== user.email) {
      this.users.delete(user.email);
      this.users.set(updates.email, user);
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  static async getAllUsers(): Promise<User[]> {
    await this.init();
    return Array.from(this.users.values()).map(user => {
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }

  static async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'> & { password: string }): Promise<User> {
    await this.init();

    const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const hashedPassword = await bcrypt.hash(userData.password, 12);

    const newUser = {
      ...userData,
      id,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(userData.email, newUser);

    const { password: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  static async deleteUser(id: string): Promise<boolean> {
    await this.init();
    const user = Array.from(this.users.values()).find(u => u.id === id);
    if (!user) return false;

    this.users.delete(user.email);
    return true;
  }
}