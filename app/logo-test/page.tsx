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

export default function LogoTestPage() {
  const [selectedLogoIndex, setSelectedLogoIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const today = new Date().getDay();
    const dayIndex = today === 0 ? 6 : today - 1;
    setSelectedLogoIndex(dayIndex);
  }, []);

  const handleLogoClick = (index: number) => {
    setSelectedLogoIndex(index);
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 600);
  };

  const currentLogo = LOGOS[selectedLogoIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section con Logo Grande */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-4">
            LAPA App Platform
          </h1>
          <p className="text-xl text-gray-400 mb-8">
            Logo Dinamico - <span className="text-green-500 font-bold">{currentLogo.day}</span>
          </p>

          {/* Logo Grande che cambia al click */}
          <div className="flex justify-center mb-8">
            <div
              className={`relative ${isAnimating ? 'animate-logo-entrance' : 'animate-float'}`}
              style={{ width: 300, height: 300 }}
            >
              <Image
                src={`/logos/${currentLogo.file}`}
                alt={`LAPA - ${currentLogo.name}`}
                width={300}
                height={300}
                priority
                className="object-contain drop-shadow-2xl hover:scale-110 transition-transform duration-300"
                style={{
                  filter: 'drop-shadow(0 0 20px rgba(16, 185, 129, 0.3))',
                }}
              />
            </div>
          </div>

          <div className="max-w-2xl mx-auto bg-gray-800/50 backdrop-blur rounded-2xl p-8 border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-4">
              {currentLogo.name}
            </h2>
            <p className="text-gray-400 mb-4">
              Clicca sui loghi qui sotto per cambiarli!
            </p>
            <div className="space-y-2 text-left text-gray-300">
              <p>✅ <strong>Logo cambia con un click</strong> - Prova ora!</p>
              <p>✅ <strong>Animazione fluida</strong> al cambio logo</p>
              <p>✅ <strong>7 varianti</strong> diverse per ogni giorno</p>
              <p>✅ <strong>Logo fisso per PWA</strong> (Lunedì - Oro)</p>
            </div>
          </div>
        </div>

        {/* Galleria Loghi Cliccabili */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">
              Scegli il Tuo Logo
            </h2>
            <p className="text-gray-400">
              Clicca su un logo per cambiare quello principale
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 max-w-7xl mx-auto">
            {LOGOS.map((logo, index) => (
              <button
                key={logo.day}
                onClick={() => handleLogoClick(index)}
                className={`relative group cursor-pointer ${
                  index === selectedLogoIndex
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
                    <p className={`font-bold text-xs ${index === selectedLogoIndex ? 'text-green-600' : 'text-gray-800'}`}>
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

        {/* Info tecnica */}
        <div className="bg-gradient-to-r from-green-500/10 to-red-500/10 backdrop-blur rounded-2xl p-8 border border-green-500/30">
          <h3 className="text-2xl font-bold text-white mb-4">Come Funziona</h3>
          <div className="grid md:grid-cols-2 gap-6 text-gray-300">
            <div>
              <h4 className="font-bold text-green-500 mb-2">🗓️ Sistema Automatico</h4>
              <ul className="space-y-1 text-sm">
                <li>• Lunedì: Tech Globo Oro (scritta dorata)</li>
                <li>• Martedì: Tech Globo (mappamondo)</li>
                <li>• Mercoledì: Classico (stile tradizionale)</li>
                <li>• Giovedì: Moderno Colorato (artistico)</li>
                <li>• Venerdì: Minimalista (elegante)</li>
                <li>• Sabato: Tech Neon (effetto neon)</li>
                <li>• Domenica: Elegante Oro (premium)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-red-500 mb-2">⚡ Features</h4>
              <ul className="space-y-1 text-sm">
                <li>• <strong>Click interattivo</strong> - Cambia logo istantaneamente</li>
                <li>• Animazione entrata smooth</li>
                <li>• Hover con effetto scale</li>
                <li>• Drop shadow dinamico</li>
                <li>• Responsive su tutti i dispositivi</li>
                <li>• Performance ottimizzata</li>
                <li>• <strong>Logo PWA fisso</strong> (Lunedì - Oro)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
