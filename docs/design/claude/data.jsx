// Mock UMass dining data — today's menus
const TODAY = 'Fri · Apr 24';

const BEST_NOW = {
  meal: 'Lunch',
  period: 'Serving until 2:15pm',
  dish: 'Grilled chicken bowl, brown rice, roasted broccoli',
  station: 'Grill · made-to-order',
  commons: 'Worcester',
  kcal: 560,
  protein: 42,
  carbs: 58,
  fat: 14,
  reason: 'Hits your 40g protein target for lunch without pushing you over on carbs.',
  tags: ['High protein', 'No dairy'],
};

const MEALS = [
  {
    period: 'Breakfast',
    window: '7:00 – 10:45am',
    status: 'closed',
    items: [
      { dish: 'Steel-cut oats with berries & almonds', station: 'Hot cereal', commons: 'Franklin', kcal: 320, protein: 11, tags: ['Vegan'], recommended: true },
      { dish: 'Egg white & spinach wrap', station: 'Grill', commons: 'Worcester', kcal: 380, protein: 24, tags: ['High protein'] },
      { dish: 'Greek yogurt parfait', station: 'Cold line', commons: 'Hampshire', kcal: 290, protein: 18, tags: [] },
    ],
  },
  {
    period: 'Lunch',
    window: '11:00am – 2:15pm',
    status: 'now',
    items: [
      { dish: 'Grilled chicken bowl, brown rice, broccoli', station: 'Grill · MTO', commons: 'Worcester', kcal: 560, protein: 42, tags: ['Pick'], recommended: true },
      { dish: 'Turkey chili', station: 'Soup & grain', commons: 'Berkshire', kcal: 420, protein: 30, tags: ['Gluten-free'] },
      { dish: 'Tofu banh mi', station: 'Global', commons: 'Franklin', kcal: 490, protein: 22, tags: ['Vegetarian'] },
      { dish: 'Caesar salad, grilled shrimp', station: 'Salad bar', commons: 'Hampshire', kcal: 380, protein: 28, tags: [] },
    ],
  },
  {
    period: 'Dinner',
    window: '4:30 – 9:00pm',
    status: 'upcoming',
    items: [
      { dish: 'Seared salmon, farro, green beans', station: 'Exhibition', commons: 'Berkshire', kcal: 610, protein: 44, tags: ['Pick'], recommended: true },
      { dish: 'Chicken shawarma plate', station: 'Global', commons: 'Worcester', kcal: 580, protein: 38, tags: [] },
      { dish: 'Rigatoni bolognese', station: 'Italian', commons: 'Franklin', kcal: 720, protein: 32, tags: [] },
      { dish: 'Buddha bowl, chickpeas, tahini', station: 'Plant-based', commons: 'Hampshire', kcal: 520, protein: 20, tags: ['Vegan'] },
    ],
  },
  {
    period: 'Late Night',
    window: '9:30pm – 1:00am',
    status: 'upcoming',
    items: [
      { dish: 'Chicken quesadilla', station: 'Grill', commons: 'Berkshire', kcal: 540, protein: 30, tags: [] },
      { dish: 'Ramen bowl, pork belly', station: 'Noodle', commons: 'Berkshire', kcal: 680, protein: 26, tags: [] },
    ],
  },
];

Object.assign(window, { TODAY, BEST_NOW, MEALS });
