import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import {
  validateEmployeePassword,
  getOrganizationBySlug,
  createOrganization,
  createEmployee,
  getEmployee,
} from '@/lib/time-attendance/db';
import {
  TAApiResponse,
  TALoginResponse,
  TAAuthPayload,
  Employee,
  Organization,
} from '@/lib/time-attendance/types';

const JWT_SECRET = process.env.JWT_SECRET || 'time-attendance-secret-key';
const JWT_EXPIRES_IN = '7d';

/**
 * POST /api/time-attendance/auth
 * Login dipendente
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, org_slug, email, password, name } = body;

    // ========== LOGIN ==========
    if (action === 'login') {
      if (!org_slug || !email || !password) {
        return NextResponse.json<TAApiResponse<TALoginResponse>>({
          success: false,
          error: 'org_slug, email e password sono obbligatori',
        }, { status: 400 });
      }

      // Trova organizzazione
      const org = await getOrganizationBySlug(org_slug);
      if (!org) {
        return NextResponse.json<TAApiResponse<TALoginResponse>>({
          success: false,
          error: 'Organizzazione non trovata',
        }, { status: 404 });
      }

      // Valida credenziali
      const employee = await validateEmployeePassword(org.id, email, password);
      if (!employee) {
        return NextResponse.json<TAApiResponse<TALoginResponse>>({
          success: false,
          error: 'Email o password non corretti',
        }, { status: 401 });
      }

      // Genera token
      const payload: TAAuthPayload = {
        employee_id: employee.id,
        org_id: org.id,
        role: employee.role,
        email: employee.email,
        name: employee.name,
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

      const response = NextResponse.json<TAApiResponse<TALoginResponse>>({
        success: true,
        data: {
          success: true,
          token,
          employee,
          organization: org,
        },
        message: `Benvenuto, ${employee.name}!`,
      });

      // Imposta cookie
      response.cookies.set('ta_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60, // 7 giorni
      });

      return response;
    }

    // ========== REGISTER ORGANIZATION ==========
    if (action === 'register_org') {
      const { org_name, org_email, admin_name, admin_email, admin_password } = body;

      if (!org_name || !org_email || !admin_name || !admin_email || !admin_password) {
        return NextResponse.json<TAApiResponse<null>>({
          success: false,
          error: 'Tutti i campi sono obbligatori',
        }, { status: 400 });
      }

      // Validazione email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(admin_email)) {
        return NextResponse.json<TAApiResponse<null>>({
          success: false,
          error: 'Email admin non valida',
        }, { status: 400 });
      }

      // Validazione password
      if (admin_password.length < 6) {
        return NextResponse.json<TAApiResponse<null>>({
          success: false,
          error: 'La password deve essere di almeno 6 caratteri',
        }, { status: 400 });
      }

      // Crea organizzazione
      const org = await createOrganization({
        name: org_name,
        slug: org_name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        email: org_email,
      });

      // Crea admin
      const admin = await createEmployee({
        org_id: org.id,
        email: admin_email,
        name: admin_name,
        password: admin_password,
        role: 'admin',
      });

      // Genera token
      const payload: TAAuthPayload = {
        employee_id: admin.id,
        org_id: org.id,
        role: admin.role,
        email: admin.email,
        name: admin.name,
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

      const response = NextResponse.json<TAApiResponse<{
        organization: Organization;
        employee: Employee;
        token: string;
      }>>({
        success: true,
        data: {
          organization: org,
          employee: admin,
          token,
        },
        message: 'Organizzazione creata con successo!',
      });

      response.cookies.set('ta_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60,
      });

      return response;
    }

    // ========== VERIFY TOKEN ==========
    if (action === 'verify') {
      const token = request.cookies.get('ta_token')?.value ||
                    request.headers.get('authorization')?.replace('Bearer ', '');

      if (!token) {
        return NextResponse.json<TAApiResponse<null>>({
          success: false,
          error: 'Token non trovato',
        }, { status: 401 });
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET) as TAAuthPayload;
        const employee = await getEmployee(decoded.employee_id);

        if (!employee) {
          return NextResponse.json<TAApiResponse<null>>({
            success: false,
            error: 'Dipendente non trovato',
          }, { status: 404 });
        }

        return NextResponse.json<TAApiResponse<{ employee: Employee; payload: TAAuthPayload }>>({
          success: true,
          data: {
            employee,
            payload: decoded,
          },
        });
      } catch {
        return NextResponse.json<TAApiResponse<null>>({
          success: false,
          error: 'Token non valido o scaduto',
        }, { status: 401 });
      }
    }

    // ========== LOGOUT ==========
    if (action === 'logout') {
      const response = NextResponse.json<TAApiResponse<null>>({
        success: true,
        message: 'Logout effettuato',
      });

      response.cookies.delete('ta_token');
      return response;
    }

    return NextResponse.json<TAApiResponse<null>>({
      success: false,
      error: 'Azione non riconosciuta. Usa: login, register_org, verify, logout',
    }, { status: 400 });

  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json<TAApiResponse<null>>({
      success: false,
      error: 'Errore interno del server',
    }, { status: 500 });
  }
}
