'use client';

import React from 'react';

interface TimelineEvent {
  type: string;
  label: string;
  date: string;
  description: string;
  icon: string;
  trackingRef?: string | null;
  invoiceId?: number;
}

interface OrderTimelineProps {
  events: TimelineEvent[];
}

export function OrderTimeline({ events }: OrderTimelineProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getIconComponent = (icon: string) => {
    const iconProps = {
      className: 'w-5 h-5',
      fill: 'none',
      stroke: 'currentColor',
      viewBox: '0 0 24 24',
    };

    switch (icon) {
      case 'document':
        return (
          <svg {...iconProps}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        );
      case 'check-circle':
        return (
          <svg {...iconProps}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'truck':
        return (
          <svg {...iconProps}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
            />
          </svg>
        );
      case 'clock':
        return (
          <svg {...iconProps}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'receipt':
        return (
          <svg {...iconProps}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
            />
          </svg>
        );
      case 'currency-euro':
        return (
          <svg {...iconProps}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14.121 15.536c-1.171 1.952-3.07 1.952-4.242 0-1.172-1.953-1.172-5.119 0-7.072 1.171-1.952 3.07-1.952 4.242 0M8 10.5h4m-4 3h4m9-1.5a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      default:
        return (
          <svg {...iconProps}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'created':
        return 'bg-gray-100 text-gray-600';
      case 'confirmed':
        return 'bg-blue-100 text-blue-600';
      case 'ready_to_ship':
        return 'bg-yellow-100 text-yellow-600';
      case 'delivered':
        return 'bg-green-100 text-green-600';
      case 'invoiced':
        return 'bg-purple-100 text-purple-600';
      case 'paid':
        return 'bg-emerald-100 text-emerald-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  if (!events || events.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6 text-center">
        <p className="text-xs sm:text-sm text-gray-500">Nessun evento disponibile per questo ordine</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 md:p-6">
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Timeline Ordine</h3>

      <div className="relative">
        {/* Linea verticale */}
        <div className="absolute left-3 sm:left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

        <div className="space-y-4 sm:space-y-6">
          {events.map((event, index) => (
            <div key={index} className="relative flex items-start gap-2 sm:gap-3 md:gap-4">
              {/* Icona */}
              <div
                className={`relative z-10 flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${getEventColor(
                  event.type
                )}`}
              >
                {getIconComponent(event.icon)}
              </div>

              {/* Contenuto */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-0.5 sm:gap-2">
                  <h4 className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                    {event.label}
                  </h4>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {formatDate(event.date)}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-gray-600 mb-1">{event.description}</p>

                {/* Info aggiuntive */}
                {event.trackingRef && (
                  <div className="mt-1.5 sm:mt-2 inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                    <svg
                      className="w-3 h-3 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="truncate">Tracking: {event.trackingRef}</span>
                  </div>
                )}

                {event.invoiceId && (
                  <div className="mt-1.5 sm:mt-2 inline-flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                    ID Fattura: {event.invoiceId}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
