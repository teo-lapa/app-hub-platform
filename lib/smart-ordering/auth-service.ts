/**
 * LAPA Smart Ordering - Auth & Permissions Service
 *
 * Gestisce autenticazione e permessi per:
 * - Admin: Tutto
 * - Manager: Creazione ordini + view analytics
 * - Viewer: Solo visualizzazione
 */

export type UserRole = 'admin' | 'manager' | 'viewer';

export interface UserPermissions {
  canViewDashboard: boolean;
  canCreateOrders: boolean;
  canEditPredictions: boolean;
  canManageUsers: boolean;
  canViewAnalytics: boolean;
  canExportData: boolean;
  canConfigureSettings: boolean;
}

export interface SmartOrderingUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  permissions: UserPermissions;
  lastAccess?: Date;
}

class AuthService {
  /**
   * Get permissions for role
   */
  getPermissionsForRole(role: UserRole): UserPermissions {
    const rolePermissions: Record<UserRole, UserPermissions> = {
      admin: {
        canViewDashboard: true,
        canCreateOrders: true,
        canEditPredictions: true,
        canManageUsers: true,
        canViewAnalytics: true,
        canExportData: true,
        canConfigureSettings: true
      },
      manager: {
        canViewDashboard: true,
        canCreateOrders: true,
        canEditPredictions: true,
        canManageUsers: false,
        canViewAnalytics: true,
        canExportData: true,
        canConfigureSettings: false
      },
      viewer: {
        canViewDashboard: true,
        canCreateOrders: false,
        canEditPredictions: false,
        canManageUsers: false,
        canViewAnalytics: true,
        canExportData: false,
        canConfigureSettings: false
      }
    };

    return rolePermissions[role];
  }

  /**
   * Check if user has permission
   */
  hasPermission(user: SmartOrderingUser, permission: keyof UserPermissions): boolean {
    return user.permissions[permission] === true;
  }

  /**
   * Require permission (throws if not authorized)
   */
  requirePermission(user: SmartOrderingUser, permission: keyof UserPermissions): void {
    if (!this.hasPermission(user, permission)) {
      throw new Error(`Permesso negato: ${permission}`);
    }
  }

  /**
   * Get user from session (placeholder - integrate with your auth)
   */
  async getCurrentUser(): Promise<SmartOrderingUser | null> {
    // TODO: Integrate with your auth system (useAuthStore)
    // For now return mock admin user

    return {
      id: 1,
      name: 'Admin User',
      email: 'admin@lapa.com',
      role: 'admin',
      permissions: this.getPermissionsForRole('admin'),
      lastAccess: new Date()
    };
  }

  /**
   * Create audit log entry
   */
  async logAction(
    userId: number,
    action: string,
    details: any
  ): Promise<void> {
    // TODO: Implement audit logging to database

    console.log(`[AUDIT] User ${userId} - ${action}`, details);
  }

  /**
   * Get user activity log
   */
  async getUserActivity(userId: number, limit: number = 50): Promise<any[]> {
    // TODO: Implement activity log fetch

    return [];
  }
}

// Export singleton
export const authService = new AuthService();
