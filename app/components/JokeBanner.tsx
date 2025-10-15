'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

interface JokeBannerProps {
  userName?: string;
  userRole?: string;
}

export default function JokeBanner({ userName = 'Ospite', userRole = 'Utente' }: JokeBannerProps) {
  const [joke, setJoke] = useState<string>('Caricamento barzelletta...');
  const [isLoading, setIsLoading] = useState(true);
  const [chefPosition, setChefPosition] = useState(0);
  const [chefDirection, setChefDirection] = useState<'right' | 'left' | 'pause'>('right');

  useEffect(() => {
    fetchJoke();
  }, []);

  // Animazione del cuoco che cammina
  useEffect(() => {
    const interval = setInterval(() => {
      setChefPosition((prev) => {
        // Ogni tanto si ferma e ti guarda (20% probabilità)
        if (Math.random() < 0.2 && chefDirection !== 'pause') {
          setChefDirection('pause');
          setTimeout(() => {
            setChefDirection(prev > 50 ? 'left' : 'right');
          }, 2000); // Pausa di 2 secondi
          return prev;
        }

        if (chefDirection === 'pause') {
          return prev;
        }

        // Cammina a destra
        if (chefDirection === 'right') {
          if (prev >= 95) {
            setChefDirection('left');
            return prev;
          }
          return prev + 1;
        }

        // Cammina a sinistra
        if (prev <= 0) {
          setChefDirection('right');
          return prev;
        }
        return prev - 1;
      });
    }, 100); // Velocità movimento

    return () => clearInterval(interval);
  }, [chefDirection]);

  const fetchJoke = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/jokes');
      const data = await response.json();
      setJoke(data.joke);
    } catch (error) {
      console.error('Error fetching joke:', error);
      setJoke('Benvenuto nella piattaforma LAPA! 👋');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-lg sm:rounded-xl md:rounded-2xl border border-gray-700 shadow-lg sm:shadow-xl md:shadow-2xl">
      {/* Animated background effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-red-500/10 to-green-500/10 animate-shimmer" />

      {/* Cuoco animato che cammina - più piccolo su mobile */}
      <div
        className="absolute top-1 sm:top-2 z-20 transition-all duration-100 text-xl sm:text-2xl md:text-3xl lg:text-4xl"
        style={{
          left: `${chefPosition}%`,
          transform: chefDirection === 'left' ? 'scaleX(-1)' : 'scaleX(1)',
        }}
      >
        👨‍🍳
      </div>

      {/* Padding responsivo: molto piccolo su mobile, crescente su schermi più grandi */}
      <div className="relative p-3 sm:p-4 md:p-6 lg:p-8">
        <div className="flex items-start gap-1.5 sm:gap-2 md:gap-3 lg:gap-4">
          {/* Emoji/Icon - molto più piccola su mobile */}
          <div className="flex-shrink-0 text-2xl sm:text-3xl md:text-4xl lg:text-5xl animate-bounce-slow">
            👋
          </div>

          <div className="flex-1 min-w-0">
            {/* Saluto personalizzato - responsive */}
            <h2 className="text-base sm:text-xl md:text-2xl lg:text-3xl font-bold text-white mb-0.5 sm:mb-1 md:mb-2 leading-tight">
              Bentornato, <span className="text-green-500">{userName}</span>!
            </h2>

            {/* Descrizione - più compatta su mobile */}
            <p className="text-gray-400 text-[10px] sm:text-xs md:text-sm lg:text-base mb-2 sm:mb-3 md:mb-4 leading-snug sm:leading-relaxed">
              Benvenuto nella piattaforma LAPA - fornitore alimentare per ristoranti.
              <span className="hidden md:inline">
                {' '}Il tuo piano <span className="text-red-500 font-semibold">{userRole}</span> ti dà accesso alle funzionalità dedicate.
              </span>
            </p>

            {/* Barzelletta del giorno - responsive */}
            <div className="bg-gradient-to-r from-green-500/20 to-red-500/20 rounded-md sm:rounded-lg md:rounded-xl p-2 sm:p-3 md:p-4 border border-green-500/30 backdrop-blur-sm">
              <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 mb-1 sm:mb-1.5 md:mb-2">
                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-yellow-400 flex-shrink-0" />
                <h3 className="text-xs sm:text-sm md:text-base lg:text-lg font-bold text-yellow-400">
                  Barzelletta del Momento
                </h3>
              </div>

              <p className={`text-white text-xs sm:text-sm md:text-base lg:text-lg leading-snug sm:leading-relaxed ${isLoading ? 'animate-pulse' : ''}`}>
                {joke}
              </p>
            </div>

            {/* Pulsante Curiosità Food - più compatto su mobile */}
            <button
              onClick={() => window.location.href = '/food-news'}
              className="mt-2 sm:mt-3 md:mt-4 lg:mt-6 w-full bg-gradient-to-r from-green-600 to-red-600 hover:from-green-700 hover:to-red-700 text-white font-bold py-2 sm:py-2.5 md:py-3 lg:py-4 px-3 sm:px-4 md:px-5 lg:px-6 rounded-md sm:rounded-lg md:rounded-xl shadow-md sm:shadow-lg transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 md:gap-3"
            >
              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 flex-shrink-0" />
              <span className="text-[10px] sm:text-xs md:text-sm lg:text-base xl:text-lg truncate">
                Curiosità del Mondo Food - Ricercate con AI
              </span>
              <span className="text-base sm:text-lg md:text-xl lg:text-2xl flex-shrink-0">📰</span>
            </button>
          </div>
        </div>
      </div>

      {/* Decorative corner accents - più piccoli su mobile */}
      <div className="absolute top-0 right-0 w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-32 lg:h-32 bg-gradient-to-br from-green-500/20 to-transparent rounded-bl-full" />
      <div className="absolute bottom-0 left-0 w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-32 lg:h-32 bg-gradient-to-tr from-red-500/20 to-transparent rounded-tr-full" />
    </div>
  );
}
