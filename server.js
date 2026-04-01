const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

// Зберігання кімнат: roomCode -> { players, gameState }
let rooms = {};

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createDeck() { /* така сама логіка, як у фронтенді */ }
function shuffle(deck) { /* ... */ }

// Початковий стан гри
function initGame(players) {
    let deck = createDeck();
    shuffle(deck);
    let tableCard = deck.pop();
    while (tableCard.type === 'wild') { // якщо дика – перемішати
        deck.push(tableCard);
        shuffle(deck);
        tableCard = deck.pop();
    }
    const hands = {};
    for (let id in players) {
        hands[id] = [];
        for (let i = 0; i < 5; i++) hands[id].push(deck.pop());
    }
    return {
        deck,
        tableCard,
        hands,
        players: Object.fromEntries(Object.entries(players).map(([id, p]) => [id, { name: p.name, cardsCount: hands[id].length }])),
        currentPlayer: Object.keys(players)[0],
        direction: 1,
        drawStack: 0
    };
}

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        switch (data.action) {
            case 'createRoom':
                const roomCode = generateRoomCode();
                const playerId = generateRoomCode(); // унікальний ід гравця
                rooms[roomCode] = {
                    players: { [playerId]: { name: data.playerName, ws, cards: [] } },
                    gameState: null
                };
                ws.roomCode = roomCode;
                ws.playerId = playerId;
                ws.send(JSON.stringify({ type: 'roomCreated', roomCode, playerId }));
                break;
            case 'joinRoom':
                const room = rooms[data.roomCode];
                if (!room) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Кімнату не знайдено' }));
                    return;
                }
                const newPlayerId = generateRoomCode();
                room.players[newPlayerId] = { name: data.playerName, ws, cards: [] };
                ws.roomCode = data.roomCode;
                ws.playerId = newPlayerId;
                ws.send(JSON.stringify({ type: 'joined', roomCode: data.roomCode, playerId: newPlayerId }));
                // Якщо це другий гравець – починаємо гру
                if (Object.keys(room.players).length === 2) {
                    startGame(room);
                }
                break;
            case 'playCard':
                // Логіка перевірки та оновлення стану
                break;
            case 'drawCard':
                // Логіка
                break;
            case 'resetGame':
                // Перезапуск гри
                break;
        }
    });
});

function startGame(room) {
    const gameState = initGame(room.players);
    room.gameState = gameState;
    // Розсилаємо стан усім гравцям
    broadcast(room, { type: 'gameState', state: serializeGameState(room.gameState, room.players) });
}

function broadcast(room, data) {
    for (let id in room.players) {
        const player = room.players[id];
        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify(data));
        }
    }
}

function serializeGameState(gameState, players) {
    // Повертаємо стан, придатний для клієнта (без повних рук інших гравців)
    const serialized = {
        tableCard: gameState.tableCard,
        currentPlayer: gameState.currentPlayer,
        players: {}
    };
    for (let id in players) {
        serialized.players[id] = {
            name: players[id].name,
            cardsCount: gameState.hands[id] ? gameState.hands[id].length : 0
        };
    }
    // Додаємо руку поточного гравця (кожен клієнт отримає свою руку окремо)
    // Тому для кожного клієнта потрібно надсилати індивідуальний стан
    // Це спрощений підхід, для реальної гри потрібно надсилати окремі повідомлення кожному гравцю з його рукою.
    return serialized;
}

wss.on('listening', () => console.log('Server running on port 8080'));
