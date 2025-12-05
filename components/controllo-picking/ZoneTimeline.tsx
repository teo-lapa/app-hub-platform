'use client';

interface ZoneTimelineProps {
  timeline: Array<{
    time: string;
    event: string;
    user: string;
    type: 'prelievo' | 'controllo' | 'video' | 'problema';
  }>;
}

export default function ZoneTimeline({ timeline }: ZoneTimelineProps) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'prelievo':
        return 'bg-green-500';
      case 'controllo':
        return 'bg-blue-500';
      case 'video':
        return 'bg-purple-500';
      case 'problema':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTypeBorderColor = (type: string) => {
    switch (type) {
      case 'prelievo':
        return 'border-green-200';
      case 'controllo':
        return 'border-blue-200';
      case 'video':
        return 'border-purple-200';
      case 'problema':
        return 'border-red-200';
      default:
        return 'border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'prelievo':
        return '📦';
      case 'controllo':
        return '✅';
      case 'video':
        return '📹';
      case 'problema':
        return '⚠️';
      default:
        return '•';
    }
  };

  const formatTime = (timeString: string) => {
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timeString;
    }
  };

  if (timeline.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nessun evento da mostrare
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline Line */}
      <div className="absolute left-[60px] top-0 bottom-0 w-0.5 bg-gray-200" />

      {/* Timeline Items */}
      <div className="space-y-6">
        {timeline.map((item, index) => (
          <div key={index} className="relative flex items-start gap-4">
            {/* Time */}
            <div className="w-[50px] text-right flex-shrink-0">
              <span className="text-sm font-medium text-gray-600">
                {formatTime(item.time)}
              </span>
            </div>

            {/* Dot */}
            <div className="relative z-10 flex-shrink-0">
              <div
                className={`w-10 h-10 rounded-full ${getTypeColor(
                  item.type
                )} flex items-center justify-center text-white shadow-md`}
              >
                <span className="text-lg">{getTypeIcon(item.type)}</span>
              </div>
            </div>

            {/* Event Details */}
            <div className={`flex-1 pb-6 border-l-2 ${getTypeBorderColor(item.type)} pl-4`}>
              <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                <div className="font-medium text-gray-900 mb-1 whitespace-pre-line">{item.event}</div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="inline-flex items-center gap-1">
                    👤 {item.user}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
