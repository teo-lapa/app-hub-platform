'use client';

import Link from 'next/link';
import { ArrowLeft, Bell } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  back?: string;
  showBeta?: boolean;
}

export default function Header({ title, subtitle, back, showBeta = true }: HeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        padding: '14px 18px 12px',
        background: '#fff',
        borderBottom: '1px solid var(--border, #e5e2dd)',
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flex: 1, minWidth: 0 }}>
        {back && (
          <Link href={back} style={{ color: 'var(--fg-2, #4a4038)', display: 'flex', paddingBottom: 4 }}>
            <ArrowLeft size={20} />
          </Link>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          {subtitle && (
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--fg-3, #6b5f52)',
                fontWeight: 600,
              }}
            >
              {subtitle}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 2,
            }}
          >
            <h1
              style={{
                fontFamily: 'Fraunces, Georgia, serif',
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: 'var(--fg-1, #1c1815)',
                margin: 0,
                lineHeight: 1.1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </h1>
            {showBeta && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  color: '#fff',
                  background: 'var(--lapa-red-700, #951616)',
                  padding: '2px 6px',
                  borderRadius: 2,
                }}
              >
                BETA
              </span>
            )}
          </div>
        </div>
      </div>
      <button
        style={{
          width: 36,
          height: 36,
          background: 'transparent',
          border: '1px solid var(--border, #e5e2dd)',
          borderRadius: 8,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Notifiche"
      >
        <Bell size={16} color="var(--fg-2, #4a4038)" />
      </button>
    </div>
  );
}
