'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function DynamicLogo({ className = '', size = 120 }: { className?: string; size?: number }) {
  const [currentLogo, setCurrentLogo] = useState('/logos/logo-default.png');
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Determina il logo in base al giorno della settimana
    const today = new Date().getDay(); // 0 = Domenica, 1 = Lunedì, ..., 6 = Sabato

    const logoMap: { [key: number]: string } = {
      0: '/logos/logo-sunday.png',       // Domenica - Elegante oro
      1: '/logos/logo-monday.png',       // Lunedì - Tech globo oro
      2: '/logos/logo-tuesday.png',      // Martedì - Tech globo
      3: '/logos/logo-wednesday.png',    // Mercoledì - Classico
      4: '/logos/logo-thursday.png',     // Giovedì - Moderno colorato
      5: '/logos/logo-friday.png',       // Venerdì - Minimalista
      6: '/logos/logo-saturday.png',     // Sabato - Tech neon
    };

    const logo = logoMap[today] || '/logos/logo-default.png';
    setCurrentLogo(logo);

    // Animazione all'apertura
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`relative ${className} ${isAnimating ? 'animate-logo-entrance' : ''}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={currentLogo}
        alt="LAPA - Finest Italian Food"
        width={size}
        height={size}
        priority
        className="object-contain drop-shadow-2xl hover:scale-110 transition-transform duration-300"
        style={{
          filter: 'drop-shadow(0 0 20px rgba(16, 185, 129, 0.3))',
        }}
      />

      {/* Effetto particelle/glow dinamico */}
      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 animate-ping-slow">
          <div className="w-full h-full rounded-full bg-gradient-to-r from-green-500/20 to-red-500/20 blur-xl" />
        </div>
      </div>
    </div>
  );
}
