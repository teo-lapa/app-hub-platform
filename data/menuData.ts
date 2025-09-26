export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isSpicy?: boolean;
  isPopular?: boolean;
  ingredients?: string[];
  allergens?: string[];
  calories?: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export const menuCategories: MenuCategory[] = [
  {
    id: 'appetizers',
    name: 'Antipasti',
    description: 'Stuzzichini per iniziare',
    icon: '🥗',
    color: 'from-green-400 to-emerald-500'
  },
  {
    id: 'mains',
    name: 'Primi e Secondi',
    description: 'Piatti principali',
    icon: '🍝',
    color: 'from-orange-400 to-red-500'
  },
  {
    id: 'desserts',
    name: 'Dolci',
    description: 'Dolci della casa',
    icon: '🍰',
    color: 'from-pink-400 to-purple-500'
  },
  {
    id: 'beverages',
    name: 'Bevande',
    description: 'Bibite e caffetteria',
    icon: '☕',
    color: 'from-blue-400 to-cyan-500'
  }
];

export const menuItems: MenuItem[] = [
  // Antipasti
  {
    id: '1',
    name: 'Bruschetta Classica',
    description: 'Pane tostato con pomodori freschi, basilico e aglio',
    price: 8.50,
    category: 'appetizers',
    image: '🍅',
    isVegetarian: true,
    isPopular: true,
    ingredients: ['Pane', 'Pomodori', 'Basilico', 'Aglio', 'Olio EVO'],
    calories: 180
  },
  {
    id: '2',
    name: 'Antipasto della Casa',
    description: 'Selezione di salumi, formaggi e olive della tradizione',
    price: 14.00,
    category: 'appetizers',
    image: '🧀',
    ingredients: ['Prosciutto', 'Salame', 'Formaggio', 'Olive', 'Giardiniera'],
    calories: 320
  },
  {
    id: '3',
    name: 'Caprese di Bufala',
    description: 'Mozzarella di bufala DOP con pomodori e basilico',
    price: 12.00,
    category: 'appetizers',
    image: '🍅',
    isVegetarian: true,
    ingredients: ['Mozzarella di bufala', 'Pomodori', 'Basilico', 'Olio EVO'],
    calories: 250
  },

  // Primi e Secondi
  {
    id: '4',
    name: 'Spaghetti Carbonara',
    description: 'La ricetta romana originale con guanciale, pecorino e uova',
    price: 13.50,
    category: 'mains',
    image: '🍝',
    isPopular: true,
    ingredients: ['Spaghetti', 'Guanciale', 'Pecorino Romano', 'Uova', 'Pepe nero'],
    calories: 580
  },
  {
    id: '5',
    name: 'Risotto ai Porcini',
    description: 'Cremoso risotto mantecato con funghi porcini freschi',
    price: 16.00,
    category: 'mains',
    image: '🍚',
    isVegetarian: true,
    ingredients: ['Riso Carnaroli', 'Porcini', 'Brodo vegetale', 'Parmigiano', 'Burro'],
    calories: 420
  },
  {
    id: '6',
    name: 'Tagliata di Manzo',
    description: 'Tagliata di manzo con rucola, pomodorini e scaglie di grana',
    price: 22.00,
    category: 'mains',
    image: '🥩',
    isGlutenFree: true,
    ingredients: ['Manzo', 'Rucola', 'Pomodorini', 'Grana Padano', 'Olio EVO'],
    calories: 450
  },
  {
    id: '7',
    name: 'Orecchiette Pugliesi',
    description: 'Con cime di rapa, salsiccia e peperoncino',
    price: 14.50,
    category: 'mains',
    image: '🍃',
    isSpicy: true,
    ingredients: ['Orecchiette', 'Cime di rapa', 'Salsiccia', 'Peperoncino', 'Aglio'],
    calories: 520
  },

  // Dolci
  {
    id: '8',
    name: 'Tiramisù della Casa',
    description: 'Il classico dolce al cucchiaio con mascarpone e caffè',
    price: 7.00,
    category: 'desserts',
    image: '🍰',
    isPopular: true,
    ingredients: ['Mascarpone', 'Savoiardi', 'Caffè', 'Cacao', 'Uova'],
    calories: 380
  },
  {
    id: '9',
    name: 'Panna Cotta ai Frutti di Bosco',
    description: 'Delicata panna cotta con coulis di frutti rossi',
    price: 6.50,
    category: 'desserts',
    image: '🍓',
    isVegetarian: true,
    isGlutenFree: true,
    ingredients: ['Panna', 'Frutti di bosco', 'Zucchero', 'Gelatina'],
    calories: 280
  },
  {
    id: '10',
    name: 'Cannoli Siciliani',
    description: 'Croccanti cannoli ripieni di ricotta e gocce di cioccolato',
    price: 8.00,
    category: 'desserts',
    image: '🥐',
    isVegetarian: true,
    ingredients: ['Ricotta', 'Cioccolato', 'Pistacchi', 'Zucchero a velo'],
    calories: 320
  },

  // Bevande
  {
    id: '11',
    name: 'Espresso Italiano',
    description: 'Il nostro blend esclusivo di caffè arabica',
    price: 1.50,
    category: 'beverages',
    image: '☕',
    isVegan: true,
    isGlutenFree: true,
    calories: 5
  },
  {
    id: '12',
    name: 'Aperol Spritz',
    description: 'Il cocktail italiano per eccellenza',
    price: 8.00,
    category: 'beverages',
    image: '🍹',
    isVegan: true,
    isGlutenFree: true,
    ingredients: ['Aperol', 'Prosecco', 'Soda', 'Arancia'],
    calories: 150
  },
  {
    id: '13',
    name: 'Limonata della Nonna',
    description: 'Fresca limonata preparata con limoni bio',
    price: 4.50,
    category: 'beverages',
    image: '🍋',
    isVegan: true,
    isGlutenFree: true,
    ingredients: ['Limoni bio', 'Zucchero di canna', 'Acqua', 'Menta'],
    calories: 80
  }
];

export const getItemsByCategory = (category: string): MenuItem[] => {
  return menuItems.filter(item => item.category === category);
};

export const getPopularItems = (): MenuItem[] => {
  return menuItems.filter(item => item.isPopular);
};

export const searchItems = (query: string): MenuItem[] => {
  const lowercaseQuery = query.toLowerCase();
  return menuItems.filter(item =>
    item.name.toLowerCase().includes(lowercaseQuery) ||
    item.description.toLowerCase().includes(lowercaseQuery) ||
    item.ingredients?.some(ing => ing.toLowerCase().includes(lowercaseQuery))
  );
};