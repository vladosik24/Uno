// ===== Telegram WebApp =====
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#0f172a');
  tg.setBackgroundColor('#0f172a');
}

// ===== Константи =====
const COLORS = ['red', 'blue', 'green', 'yellow'];
const COLOR_NAMES = {
  red: 'Червоний',
  blue: 'Синій',
  green: 'Зелений',
  yellow: 'Жовтий'
};

const VALUES = {
  number: ['0','1','2','3','4','5','6','7','8','9'],
  action: ['skip', 'reverse', 'draw2'],
  wild: ['wild', 'wild4']
};

const VALUE_LABELS = {
  skip: 'Пропуск',
  reverse: 'Реверс',
  draw2: '+2',
  wild: 'Дика',
  wild4: '+4'
};

const BOT_NAMES = ['Богдан', 'Оксана', 'Тарас', 'Марія', 'Іван', 'Софія'];

// ===== Стан гри =====
let state = {
  players: [],
  deck: [],
  discard: [],
  currentPlayer: 0,
  direction: 1, // 1 = за годинниковою, -1 = проти
  currentColor: null,
  mustDraw: 0,
  gameOver: false,
  waitingForColor: false,
  saidUno: false,
  botCount: 2
};

// ===== DOM =====
const $ = id => document.getElementById(id);
const startScreen = $('start-screen');
const rulesScreen = $('rules-screen');
const gameScreen = $('game-screen');
const endScreen = $('end-screen');
const playerHand = $('player-hand');
const opponentsEl = $('opponents');
const discardPile = $('discard-pile');
const deckCount = $('deck-count');
const turnInfo = $('turn-info');
const directionEl = $('direction');
const unoBtn = $('uno-btn');
const colorPicker = $('color-picker');
const messageEl = $('message');

// ===== Події меню =====
document.querySelectorAll('.bot-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.bot-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.botCount = parseInt(btn.dataset.bots);
  });
});

$('start-btn').addEventListener('click', startGame);
$('rules-btn').addEventListener('click', () => {
  startScreen.classList.add('hidden');
  rulesScreen.classList.remove('hidden');
});
$('back-btn').addEventListener('click', () => {
  rulesScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');
});
$('restart-btn').addEventListener('click', () => {
  endScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');
});

$('draw-pile').addEventListener('click', () => {
  if (state.gameOver || state.waitingForColor) return;
  if (state.currentPlayer !== 0) return;
  drawCard(0);
});

unoBtn.addEventListener('click', () => {
  state.saidUno = true;
  unoBtn.classList.add('hidden');
  showMessage('УНО! 🇺🇦');
});

document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    chooseColor(btn.dataset.color);
  });
});

// ===== Створення колоди =====
function createDeck() {
  const deck = [];
  // Числа
  COLORS.forEach(color => {
    deck.push({ color, value: '0', type: 'number' });
    for (let i = 1; i <= 9; i++) {
      deck.push({ color, value: String(i), type: 'number' });
      deck.push({ color, value: String(i), type: 'number' });
    }
  });
  // Дії
  COLORS.forEach(color => {
    ['skip', 'reverse', 'draw2'].forEach(val => {
      deck.push({ color, value: val, type: 'action' });
      deck.push({ color, value: val, type: 'action' });
    });
  });
  // Дикі
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'black', value: 'wild', type: 'wild' });
    deck.push({ color: 'black', value: 'wild4', type: 'wild' });
  }
  return shuffle(deck);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===== Старт гри =====
function startGame() {
  state.deck = createDeck();
  state.discard = [];
  state.direction = 1;
  state.mustDraw = 0;
  state.gameOver = false;
  state.waitingForColor = false;
  state.saidUno = false;
  state.currentPlayer = 0;

  // Гравці
  state.players = [{ name: 'Ти', isBot: false, hand: [] }];
  const usedNames = new Set();
  for (let i = 0; i < state.botCount; i++) {
    let name;
    do {
      name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    } while (usedNames.has(name));
    usedNames.add(name);
    state.players.push({ name, isBot: true, hand: [] });
  }

  // Роздача
  state.players.forEach(p => {
    for (let i = 0; i < 7; i++) {
      p.hand.push(state.deck.pop());
    }
  });

  // Перша карта (не дика)
  let first;
  do {
    first = state.deck.pop();
  } while (first.type === 'wild');
  state.discard.push(first);
  state.currentColor = first.color;

  // UI
  startScreen.classList.add('hidden');
  rulesScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');

  render();
  // Якщо перша карта дія — обробити
  applyCardEffect(first, true);
}

// ===== Рендер =====
function render() {
  if (state.gameOver) return;

  // Напрямок
  directionEl.textContent = state.direction === 1 ? '→' : '←';

  // Інфо ходу
  const current = state.players[state.currentPlayer];
  turnInfo.textContent = current.isBot ? `Хід: ${current.name}` : 'Твій хід';

  // Колода
  deckCount.textContent = state.deck.length;

  // Відбій
  const top = state.discard[state.discard.length - 1];
  discardPile.innerHTML = '';
  if (top) {
    discardPile.appendChild(createCardElement(top, false));
  }

  // Супротивники
  opponentsEl.innerHTML = '';
  state.players.forEach((p, idx) => {
    if (idx === 0) return;
    const div = document.createElement('div');
    div.className = 'opponent' + (idx === state.currentPlayer ? ' active' : '');
    const cardsHtml = Array(Math.min(p.hand.length, 7))
      .fill('<div class="mini-card"></div>')
      .join('');
    div.innerHTML = `
      <div class="opponent-name">${p.name}</div>
      <div class="opponent-cards">${cardsHtml}</div>
      <div class="opponent-count">${p.hand.length} карт</div>
    `;
    opponentsEl.appendChild(div);
  });

  // Твоя рука
  playerHand.innerHTML = '';
  $('player-cards-count').textContent = `(${state.players[0].hand.length})`;

  const isMyTurn = state.currentPlayer === 0 && !state.waitingForColor;
  state.players[0].hand.forEach((card, idx) => {
    const el = createCardElement(card, true);
    const canPlay = isMyTurn && canPlayCard(card);
    if (canPlay) el.classList.add('playable');
    el.addEventListener('click', () => {
      if (canPlay) playCard(0, idx);
    });
    playerHand.appendChild(el);
  });

  // Кнопка УНО
  if (state.players[0].hand.length === 1 && isMyTurn && !state.saidUno) {
    unoBtn.classList.remove('hidden');
  } else {
    unoBtn.classList.add('hidden');
  }
}

function createCardElement(card, small) {
  const el = document.createElement('div');
  el.className = `card ${card.color} ${card.value}`;
  let valueText = card.value;
  let label = '';
  if (card.type === 'action' || card.type === 'wild') {
    valueText = VALUE_LABELS[card.value] || card.value;
    if (card.value === 'wild' || card.value === 'wild4') {
      label = 'Дика';
    }
  }
  el.innerHTML = `
    <div class="value">${valueText}</div>
    ${label ? `<div class="label">${label}</div>` : ''}
  `;
  return el;
}

// ===== Логіка =====
function canPlayCard(card) {
  const top = state.discard[state.discard.length - 1];
  if (state.mustDraw > 0) {
    // Можна тільки +2 або +4
    if (state.mustDraw === 2 && card.value === 'draw2') return true;
    if (state.mustDraw === 4 && card.value === 'wild4') return true;
    return false;
  }
  if (card.type === 'wild') return true;
  if (card.color === state.currentColor) return true;
  if (card.value === top.value) return true;
  return false;
}

function playCard(playerIdx, cardIdx) {
  const player = state.players[playerIdx];
  const card = player.hand.splice(cardIdx, 1)[0];
  state.discard.push(card);

  if (card.type !== 'wild') {
    state.currentColor = card.color;
  }

  // Перевірка УНО
  if (playerIdx === 0) {
    if (player.hand.length === 1 && !state.saidUno) {
      // Штраф якщо не сказав
      setTimeout(() => {
        showMessage('Не сказав УНО! +2 карти');
        drawCards(0, 2);
        render();
      }, 400);
    }
    state.saidUno = false;
  }

  // Перевірка перемоги
  if (player.hand.length === 0) {
    endGame(playerIdx);
    return;
  }

  applyCardEffect(card);
}

function applyCardEffect(card, isFirst = false) {
  if (card.value === 'skip') {
    nextPlayer();
    if (!isFirst) showMessage(`${state.players[state.currentPlayer].name} пропускає`);
  } else if (card.value === 'reverse') {
    state.direction *= -1;
    if (state.players.length === 2) {
      // У двох гравців реверс = пропуск
      nextPlayer();
    }
    showMessage('Напрямок змінено!');
  } else if (card.value === 'draw2') {
    state.mustDraw = 2;
  } else if (card.value === 'wild' || card.value === 'wild4') {
    if (card.value === 'wild4') state.mustDraw = 4;
    if (state.players[state.currentPlayer].isBot) {
      // Бот обирає колір
      const preferred = chooseBotColor(state.players[state.currentPlayer]);
      state.currentColor = preferred;
      showMessage(`${state.players[state.currentPlayer].name} обрав ${COLOR_NAMES[preferred]}`);
      nextTurn();
    } else {
      state.waitingForColor = true;
      colorPicker.classList.remove('hidden');
      render();
      return;
    }
  }

  nextTurn();
}

function chooseColor(color) {
  state.currentColor = color;
  state.waitingForColor = false;
  colorPicker.classList.add('hidden');
  showMessage(`Обрано: ${COLOR_NAMES[color]}`);
  nextTurn();
}

function nextTurn() {
  if (state.mustDraw > 0) {
    // Наступний повинен або покрити, або брати
    nextPlayer();
    const next = state.players[state.currentPlayer];
    // Перевірити чи може покрити
    const canCover = next.hand.some(c => canPlayCard(c));
    if (!canCover) {
      drawCards(state.currentPlayer, state.mustDraw);
      showMessage(`${next.name} бере ${state.mustDraw} карт`);
      state.mustDraw = 0;
      nextPlayer(); // пропускає після взяття
    }
  } else {
    nextPlayer();
  }

  render();

  // Хід бота
  if (!state.gameOver && state.players[state.currentPlayer].isBot) {
    setTimeout(botTurn, 900 + Math.random() * 600);
  }
}

function nextPlayer() {
  state.currentPlayer = (state.currentPlayer + state.direction + state.players.length) % state.players.length;
}

function drawCard(playerIdx) {
  if (state.deck.length === 0) reshuffle();
  if (state.deck.length === 0) return;

  const card = state.deck.pop();
  state.players[playerIdx].hand.push(card);

  if (playerIdx === 0) {
    // Після взяття — можна зіграти якщо підходить
    if (canPlayCard(card)) {
      // Автоматично не граємо — гравець сам вирішує
      render();
      // Але хід закінчується якщо не зіграв (стандартне правило: можна зіграти взяту)
      // Для простоти — після взяття хід переходить
      setTimeout(() => {
        if (state.currentPlayer === 0) {
          nextPlayer();
          render();
          if (state.players[state.currentPlayer].isBot) {
            setTimeout(botTurn, 800);
          }
        }
      }, 600);
    } else {
      nextPlayer();
      render();
      if (state.players[state.currentPlayer].isBot) {
        setTimeout(botTurn, 800);
      }
    }
  }
}

function drawCards(playerIdx, count) {
  for (let i = 0; i < count; i++) {
    if (state.deck.length === 0) reshuffle();
    if (state.deck.length === 0) break;
    state.players[playerIdx].hand.push(state.deck.pop());
  }
}

function reshuffle() {
  if (state.discard.length <= 1) return;
  const top = state.discard.pop();
  state.deck = shuffle(state.discard);
  state.discard = [top];
}

// ===== Бот ШІ =====
function botTurn() {
  if (state.gameOver) return;
  const bot = state.players[state.currentPlayer];
  if (!bot.isBot) return;

  // Якщо треба брати
  if (state.mustDraw > 0) {
    const coverIdx = bot.hand.findIndex(c => canPlayCard(c));
    if (coverIdx >= 0) {
      playCard(state.currentPlayer, coverIdx);
    } else {
      drawCards(state.currentPlayer, state.mustDraw);
      showMessage(`${bot.name} бере ${state.mustDraw} карт`);
      state.mustDraw = 0;
      nextPlayer();
      render();
      if (!state.gameOver && state.players[state.currentPlayer].isBot) {
        setTimeout(botTurn, 900);
      }
    }
    return;
  }

  // Знайти можливі карти
  const playable = [];
  bot.hand.forEach((c, i) => {
    if (canPlayCard(c)) playable.push(i);
  });

  if (playable.length === 0) {
    // Бере карту
    if (state.deck.length === 0) reshuffle();
    if (state.deck.length > 0) {
      const card = state.deck.pop();
      bot.hand.push(card);
      showMessage(`${bot.name} бере карту`);
      // Якщо підходить — грає
      if (canPlayCard(card)) {
        setTimeout(() => {
          const idx = bot.hand.length - 1;
          playCard(state.currentPlayer, idx);
        }, 500);
        return;
      }
    }
    nextPlayer();
    render();
    if (!state.gameOver && state.players[state.currentPlayer].isBot) {
      setTimeout(botTurn, 900);
    }
    return;
  }

  // Вибір карти (пріоритет: +4 > +2 > skip/reverse > число > дика)
  playable.sort((a, b) => {
    const ca = bot.hand[a], cb = bot.hand[b];
    const score = c => {
      if (c.value === 'wild4') return 100;
      if (c.value === 'draw2') return 80;
      if (c.value === 'skip' || c.value === 'reverse') return 60;
      if (c.type === 'number') return 40 + parseInt(c.value || 0);
      if (c.value === 'wild') return 20;
      return 0;
    };
    return score(cb) - score(ca);
  });

  // Якщо одна карта — "говорить" УНО
  if (bot.hand.length === 2) {
    showMessage(`${bot.name}: УНО!`);
  }

  playCard(state.currentPlayer, playable[0]);
}

function chooseBotColor(bot) {
  const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
  bot.hand.forEach(c => {
    if (c.color !== 'black') counts[c.color]++;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ===== Кінець =====
function endGame(winnerIdx) {
  state.gameOver = true;
  gameScreen.classList.add('hidden');
  endScreen.classList.remove('hidden');

  const winner = state.players[winnerIdx];
  if (winnerIdx === 0) {
    $('end-title').textContent = 'Перемога! 🇺🇦';
    $('end-text').textContent = 'Ти позбувся всіх карт першим. Слава Україні!';
    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
  } else {
    $('end-title').textContent = 'Поразка';
    $('end-text').textContent = `${winner.name} переміг. Спробуй ще раз!`;
  }
}

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.classList.remove('hidden');
  setTimeout(() => messageEl.classList.add('hidden'), 1800);
}

// Ініціалізація
console.log('Уно 🇺🇦 готово до гри');
