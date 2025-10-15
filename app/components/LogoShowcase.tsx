'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

const LOGOS = [
  { day: 'Lunedì', name: 'Tech Globo Oro', file: 'logo-monday.png', color: 'from-yellow-400 to-orange-500' },
  { day: 'Martedì', name: 'Tech Globo', file: 'logo-tuesday.png', color: 'from-blue-400 to-cyan-500' },
  { day: 'Mercoledì', name: 'Classico', file: 'logo-wednesday.png', color: 'from-red-400 to-pink-500' },
  { day: 'Giovedì', name: 'Moderno Colorato', file: 'logo-thursday.png', color: 'from-purple-400 to-pink-500' },
  { day: 'Venerdì', name: 'Minimalista', file: 'logo-friday.png', color: 'from-gray-400 to-gray-600' },
  { day: 'Sabato', name: 'Tech Neon', file: 'logo-saturday.png', color: 'from-cyan-400 to-blue-600' },
  { day: 'Domenica', name: 'Elegante Oro', file: 'logo-sunday.png', color: 'from-amber-400 to-yellow-600' },
];

export default function LogoShowcase() {
  const [currentDay, setCurrentDay] = useState(0); // Default Monday

  useEffect(() => {
    const today = new Date().getDay();
    // Converti da 0-6 (Dom-Sab) a 0-6 (Lun-Dom)
    const dayIndex = today === 0 ? 6 : today - 1;
    setCurrentDay(dayIndex);
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">
          Logo Dinamico LAPA
        </h2>
        <p className="text-gray-400">
          Un logo diverso per ogni giorno della settimana - Clicca per selezionare
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {LOGOS.map((logo, index) => (
          <button
            key={logo.day}
            onClick={() => setCurrentDay(index)}
            className={`relative group cursor-pointer ${
              index === currentDay
                ? 'ring-4 ring-green-500'
                : 'ring-2 ring-gray-700 hover:ring-green-400'
            } transition-all duration-300 rounded-xl overflow-hidden bg-gradient-to-br ${logo.color} p-1 hover:scale-105 active:scale-95`}
          >
            <div className="bg-white rounded-lg p-3 h-full flex flex-col items-center justify-between min-h-[180px]">
              <div className="relative w-full aspect-square mb-2 flex-1 flex items-center justify-center">
                <div className="relative w-full h-full">
                  <Image
                    src={`/logos/${logo.file}`}
                    alt={`Logo ${logo.day}`}
                    fill
                    className="object-contain drop-shadow-lg"
                  />
                </div>
              </div>

              <div className="text-center mt-auto">
                <p className={`font-bold text-xs ${index === currentDay ? 'text-green-600' : 'text-gray-800'}`}>
                  {logo.day}
                </p>
                <p className="text-[10px] text-gray-500">{logo.name}</p>
              </div>
            </div>

            {/* Effetto hover glow */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
