'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/lib/store/uiStore';
import { useAuthStore } from '@/lib/store/authStore';
import { X, Crown, Check, Zap } from 'lucide-react';

export function UpgradeModal() {
  const { showUpgradeModal, setShowUpgradeModal, selectedApp } = useUIStore();
  const { user } = useAuthStore();

  const proFeatures = [
    'Accesso a tutte le app PRO',
    'Supporto prioritario 24/7',
    'Backup automatici',
    'Analytics avanzate',
    'Integrazione API illimitata',
    'Personalizzazione completa',
  ];

  const handleUpgrade = () => {
    // Simula processo di upgrade
    alert('Reindirizzamento al pagamento...');
    setShowUpgradeModal(false);
  };

  return (
    <AnimatePresence>
      {showUpgradeModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowUpgradeModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="glass-strong rounded-3xl p-8 w-full max-w-md border border-white/20 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-pink-500/10" />

            {/* Close Button */}
            <button
              onClick={() => setShowUpgradeModal(false)}
              className="absolute top-4 right-4 glass p-2 rounded-full hover:bg-white/20 transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative z-10">
              {/* Header */}
              <div className="text-center mb-6">
                <motion.div
                  animate={{ rotate: [0, -10, 10, 0] }}
                  transition={{ repeat: Infinity, duration: 4 }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-primary mb-4"
                >
                  <Crown className="w-8 h-8 text-white" />
                </motion.div>
                <h2 className="text-2xl font-bold gradient-primary bg-clip-text text-transparent mb-2">
                  Upgrade a PRO
                </h2>
                <p className="text-muted-foreground">
                  {selectedApp ? (
                    <>Sblocca <strong>{selectedApp.name}</strong> e molto altro</>
                  ) : (
                    'Sblocca tutte le funzionalità premium'
                  )}
                </p>
              </div>

              {/* Selected App */}
              {selectedApp && (
                <div className="glass rounded-xl p-4 mb-6 border">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{selectedApp.icon}</div>
                    <div>
                      <h3 className="font-semibold">{selectedApp.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Richiede piano PRO
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Features List */}
              <div className="space-y-3 mb-6">
                <h3 className="font-semibold text-center mb-4">
                  Cosa ottieni con PRO:
                </h3>
                {proFeatures.map((feature, index) => (
                  <motion.div
                    key={feature}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check className="w-3 h-3 text-green-400" />
                    </div>
                    <span className="text-sm">{feature}</span>
                  </motion.div>
                ))}
              </div>

              {/* Pricing */}
              <div className="text-center mb-6">
                <div className="glass rounded-2xl p-6 border">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-3xl font-bold">€29</span>
                    <div className="text-left">
                      <div className="text-sm text-muted-foreground">/mese</div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cancellabile in qualsiasi momento
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleUpgrade}
                  className="w-full gradient-primary text-white py-4 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple-500/25 transition-shadow"
                >
                  <Zap className="w-5 h-5" />
                  Passa a PRO Ora
                </motion.button>
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="w-full glass-strong py-3 px-6 rounded-xl font-medium hover:bg-white/10 transition-colors"
                >
                  Forse più tardi
                </button>
              </div>

              {/* Current User Info */}
              {user && (
                <div className="mt-6 pt-4 border-t border-white/10 text-center">
                  <p className="text-xs text-muted-foreground">
                    Accesso come: <strong>{user.name}</strong> (Piano {user.role?.replace('_', ' ').toUpperCase()})
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}