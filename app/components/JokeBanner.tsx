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
    <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl border border-gray-700 shadow-2xl">
      {/* Animated background effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-red-500/10 to-green-500/10 animate-shimmer" />

      {/* Cuoco animato che cammina */}
      <div
        className="absolute top-2 z-20 transition-all duration-100 text-4xl"
        style={{
          left: `${chefPosition}%`,
          transform: chefDirection === 'left' ? 'scaleX(-1)' : 'scaleX(1)',
        }}
      >
        👨‍🍳
      </div>

      <div className="relative p-8">
        <div className="flex items-start gap-4">
          {/* Emoji/Icon grande */}
          <div className="flex-shrink-0 text-5xl animate-bounce-slow">
            👋
          </div>

          <div className="flex-1">
            {/* Saluto personalizzato */}
            <h2 className="text-3xl font-bold text-white mb-2">
              Bentornato, <span className="text-green-500">{userName}</span>!
            </h2>

            <p className="text-gray-400 mb-4">
              Benvenuto nella piattaforma LAPA - fornitore alimentare per ristoranti.
              Il tuo piano <span className="text-red-500 font-semibold">{userRole}</span> ti dà accesso alle funzionalità dedicate.
            </p>

            {/* Barzelletta del giorno */}
            <div className="bg-gradient-to-r from-green-500/20 to-red-500/20 rounded-xl p-4 border border-green-500/30 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                <h3 className="text-lg font-bold text-yellow-400">
                  Barzelletta del Momento
                </h3>
              </div>

              <p className={`text-white text-lg leading-relaxed ${isLoading ? 'animate-pulse' : ''}`}>
                {joke}
              </p>
            </div>

            {/* Pulsante Curiosità Food */}
            <button
              onClick={() => window.location.href = '/food-news'}
              className="mt-6 w-full bg-gradient-to-r from-green-600 to-red-600 hover:from-green-700 hover:to-red-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-3"
            >
              <Sparkles className="w-6 h-6" />
              <span className="text-lg">
                Curiosità del Mondo Food - Ricercate con AI
              </span>
              <span className="text-2xl">📰</span>
            </button>
          </div>
        </div>
      </div>

      {/* Decorative corner accents */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/20 to-transparent rounded-bl-full" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-red-500/20 to-transparent rounded-tr-full" />
    </div>
  );
}
