const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let players = {};
let bots = {};
let foods = [];
const MAP_SIZE = 6000;

// Gera comida inicial
for (let i = 0; i < 1500; i++) {
    foods.push({
        id: i,
        x: Math.random() * MAP_SIZE,
        y: Math.random() * MAP_SIZE,
        color: ['#ff0055', '#ffe600', '#00f0ff', '#a855f7', '#00ff66', '#ff5500'][Math.floor(Math.random() * 6)]
    });
}

// Cria Bots Inteligentes na Arena
const botNames = ["Viper", "CyberSnake", "NeonWorm", "Venom", "Apex", "Titan", "Shadow", "Blaze", "Ghost", "PythonMaster"];
for (let i = 0; i < 15; i++) {
    let bId = `bot_${i}`;
    let bX = Math.random() * MAP_SIZE;
    let bY = Math.random() * MAP_SIZE;
    let bBody = [];
    for (let j = 0; j < 30; j++) {
        bBody.push({ x: bX, y: bY + (j * 4) });
    }
    bots[bId] = {
        id: bId,
        name: botNames[i % botNames.length],
        x: bX,
        y: bY,
        angle: Math.random() * Math.PI * 2,
        speed: 3.5,
        score: 30,
        body: bBody,
        color: ['#ff0055', '#ffe600', '#a855f7', '#00ff66'][Math.floor(Math.random() * 4)],
        changeTimer: 0
    };
}

io.on('connection', (socket) => {
    console.log(`[+] Conectado: ${socket.id}`);

    socket.on('player_join', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name,
            x: data.x,
            y: data.y,
            angle: 0,
            score: 30,
            body: data.body || [],
            color: data.color || '#00f0ff'
        };
    });

    socket.on('player_sync', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].angle = data.angle;
            players[socket.id].score = data.score;
            players[socket.id].body = data.body;
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

// Loop principal de atualização de Bots e Estado Global (60 FPS)
setInterval(() => {
    // Atualiza IA dos Bots
    for (let id in bots) {
        let bot = bots[id];
        bot.changeTimer++;
        if (bot.changeTimer > 120) {
            bot.angle += (Math.random() - 0.5) * 2;
            bot.changeTimer = 0;
        }

        bot.x += Math.cos(bot.angle) * bot.speed;
        bot.y += Math.sin(bot.angle) * bot.speed;

        // Limites do mapa
        if (bot.x < 50 || bot.x > MAP_SIZE - 50) bot.angle = Math.PI - bot.angle;
        if (bot.y < 50 || bot.y > MAP_SIZE - 50) bot.angle = -bot.angle;

        bot.x = Math.max(30, Math.min(MAP_SIZE - 30, bot.x));
        bot.y = Math.max(30, Math.min(MAP_SIZE - 30, bot.y));

        let targetX = bot.x;
        let targetY = bot.y;
        for (let i = 0; i < bot.body.length; i++) {
            let part = bot.body[i];
            let dx = targetX - part.x;
            let dy = targetY - part.y;
            let dist = Math.hypot(dx, dy);
            if (dist > 12) {
                let ang = Math.atan2(dy, dx);
                part.x = targetX - Math.cos(ang) * 12;
                part.y = targetY - Math.sin(ang) * 12;
            }
            targetX = part.x;
            targetY = part.y;
        }
    }

    io.emit('server_update', { players, bots, foods });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
