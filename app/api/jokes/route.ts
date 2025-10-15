import { NextResponse } from 'next/server';

// Lista di barzellette food/ristoranti e generiche
const JOKES = {
  food: [
    "Perché il pomodoro non riesce a dormire? Perché l'insalata RUSSA! 🍅😴",
    "Cosa fa un limone in discoteca? Il Limon-dance! 🍋💃",
    "Qual è il colmo per un cuoco? Fare una pasta all'assassina e farla FRANCA! 👨‍🍳🍝",
    "Perché gli spaghetti non raccontano segreti? Perché hanno paura che la salsa si SPARGA! 🤫🍝",
    "Cosa dice un caffè quando è arrabbiato? Sono ESPRESSO! ☕😤",
    "Qual è il dessert preferito dei fantasmi? Il BOO-net! 👻🍮",
    "Perché il vino non fa mai brutte figure? Perché è sempre in FORMA! 🍷✨",
    "Come si chiama un formaggio che non è tuo? NACHO cheese! 🧀😄",
    "Qual è il piatto preferito dei matematici? La torta PI-greco! 🥧📐",
    "Perché il peperoncino è sempre felice? Perché è PICCANTE di vita! 🌶️😊",
    "Cosa fa una pizza in palestra? Il MARGHE-fitness! 🍕💪",
    "Perché il gelato è sempre calmo? Perché mantiene la sua COOL-tura! 🍦😎",
    "Qual è il colmo per un ristorante? Avere clienti che fanno le PORZIONI! 🍽️😅",
    "Cosa dice un cameriere robot? 'Serv-IO al vostro servizio!' 🤖🍴",
    "Perché l'uovo è un buon comico? Perché fa sempre RIDERE a crepapelle! 🥚😂"
  ],
  general: [
    "Qual è il colmo per un elettricista? Rimanere al BUIO! 💡😄",
    "Perché i pesci non usano internet? Hanno paura della RETE! 🐟💻",
    "Come si chiama un boomerang che non torna? Un BASTONE! 🪃😅",
    "Cosa fa un libro in palestra? Le COPERTINE! 📚💪",
    "Qual è il colmo per un astronauta? Avere sempre la testa tra le NUVOLE! 🚀☁️",
    "Perché il telefono non va mai in vacanza? Perché è sempre in LINEA! 📱🏖️",
    "Cosa dice un muro all'altro muro? Ci vediamo all'ANGOLO! 🧱😆",
    "Qual è il colmo per un giardiniere? Avere un carattere SPINOSO! 🌹🌵",
    "Perché le api sono dei buoni lavoratori? Perché fanno sempre SCIAMI-plo! 🐝👔",
    "Come si chiama un ladro di spaghetti? Un PASTA-tore abusivo! 🍝😄"
  ]
};

function getRandomJoke(): string {
  // 70% food, 30% general
  const useFood = Math.random() < 0.7;
  const jokes = useFood ? JOKES.food : JOKES.general;
  const randomIndex = Math.floor(Math.random() * jokes.length);
  return jokes[randomIndex];
}

export async function GET() {
  try {
    const joke = getRandomJoke();

    return NextResponse.json({
      joke,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting joke:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero della barzelletta' },
      { status: 500 }
    );
  }
}
