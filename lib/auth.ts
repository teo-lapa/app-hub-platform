import jwt from 'jsonwebtoken';
import { User, UserRole } from '@/lib/types';
import { UserDatabase } from '@/lib/database/users';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

export const generateToken = (user: User): string => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      azienda: user.azienda,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

export const verifyToken = (token: string): { id: string; email: string; role: UserRole } | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
  } catch (error) {
    return null;
  }
};

export const authenticateUser = async (email: string, password: string): Promise<User | null> => {
  return UserDatabase.authenticate(email, password);
};

export const createUser = async (email: string, password: string, name: string): Promise<User> => {
  const userData = {
    email,
    name,
    role: 'cliente_gratuito' as UserRole,
    abilitato: true,
    appPermessi: ['1'], // Solo Menu App per default
  };

  return UserDatabase.createUser({ ...userData, password });
};

export const getUserById = async (id: string): Promise<User | null> => {
  return UserDatabase.getUserById(id);
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
  return UserDatabase.getUserByEmail(email);
};

export const updateUser = async (id: string, updates: Partial<User & { password?: string }>): Promise<User | null> => {
  return UserDatabase.updateUser(id, updates);
};

export const getAllUsers = async (): Promise<User[]> => {
  return UserDatabase.getAllUsers();
};

export const deleteUser = async (id: string): Promise<boolean> => {
  return UserDatabase.deleteUser(id);
};

export const canAccessApp = (user: User, appId: string): boolean => {
  // Se l'utente è disabilitato, non può accedere a nulla
  if (!user.abilitato) {
    return false;
  }

  // Gli admin possono accedere a tutto
  if (user.role === 'admin') {
    return true;
  }

  // Verifica se l'app è nei permessi dell'utente
  return user.appPermessi.includes(appId);
};

export const getRoleDisplayName = (role: UserRole): string => {
  const roleMap = {
    'visitor': 'Visitatore',
    'cliente_gratuito': 'Cliente Gratuito',
    'cliente_premium': 'Cliente Premium',
    'dipendente': 'Dipendente',
    'admin': 'Amministratore'
  };
  return roleMap[role] || role;
};

export const getRoleColor = (role: UserRole): string => {
  const colorMap = {
    'visitor': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    'cliente_gratuito': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'cliente_premium': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    'dipendente': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'admin': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  };
  return colorMap[role] || colorMap.visitor;
};