import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User, UserRole } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Mock users database - using plain text passwords for demo accounts
const mockUsers: (User & { password: string })[] = [
  {
    id: '1',
    email: 'admin@apphub.com',
    name: 'Admin User',
    role: 'admin',
    password: 'admin123', // Demo account with plain text password
    createdAt: new Date('2023-01-01'),
    lastLogin: new Date(),
  },
  {
    id: '2',
    email: 'pro@apphub.com',
    name: 'Pro User',
    role: 'pro_user',
    password: 'pro123', // Demo account with plain text password
    createdAt: new Date('2023-02-15'),
    lastLogin: new Date(),
  },
  {
    id: '3',
    email: 'free@apphub.com',
    name: 'Free User',
    role: 'free_user',
    password: 'free123', // Demo account with plain text password
    createdAt: new Date('2023-03-10'),
    lastLogin: new Date(),
  },
];

export const generateToken = (user: User): string => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
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

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const authenticateUser = async (email: string, password: string): Promise<User | null> => {
  const user = mockUsers.find(u => u.email === email);
  if (!user) return null;

  let isValidPassword = false;

  // Check for demo accounts with plain text passwords
  if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
    // Hashed password - use bcrypt
    isValidPassword = await comparePassword(password, user.password);
  } else {
    // Plain text password for demo accounts
    isValidPassword = password === user.password;
  }

  if (!isValidPassword) return null;

  // Aggiorna ultimo login
  user.lastLogin = new Date();

  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

export const createUser = async (email: string, password: string, name: string): Promise<User> => {
  const hashedPassword = await hashPassword(password);

  const newUser = {
    id: (mockUsers.length + 1).toString(),
    email,
    name,
    role: 'free_user' as UserRole,
    password: hashedPassword,
    createdAt: new Date(),
  };

  mockUsers.push(newUser);

  const { password: _, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
};

export const getUserById = (id: string): User | null => {
  const user = mockUsers.find(u => u.id === id);
  if (!user) return null;

  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

export const canAccessApp = (userRole: UserRole, requiredRole: UserRole): boolean => {
  const roleHierarchy: Record<UserRole, number> = {
    visitor: 0,
    free_user: 1,
    pro_user: 2,
    admin: 3,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};