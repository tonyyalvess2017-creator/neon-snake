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

// Otimizado para 800 comidas para garantir fluidez total sem travar
for (let i = 0; i < 800; i++) {
    foods.push({
        id: i,
        x: Math.random() * MAP_SIZE,
        y: Math.random() * MAP_SIZE,
        color: ['#ff0055', '#ffe600', '#00f0ff', '#a855f7', '#00ff66', '#ff5500'][Math.floor(Math.random() * 6)]
    });
}

const botNames = ["Viper", "CyberSnake", "NeonWorm", "Venom", "Apex", "Titan", "Shadow", "Blaze", "Ghost", "PythonMaster"];
for (let i = 0; i < 15; i++) {
    spawnBot(`bot_${i}`, botNames[i % botNames.length]);
}

function spawnBot(id, name) {
    let bX = Math.random() * (MAP_SIZE - 1000) + 500;
    let bY = Math.random() * (MAP_SIZE - 1000) + 500;
    let bBody = [];
    for (let j = 0; j < 35; j++) {
        bBody.push({ x: bX, y: bY + (j * 4) });
    }
    bots[id] = {
        id: id,
        name: name,
        x: bX,
        y: bY,
        angle: Math.random() * Math.PI * 2,
        speed: 3.5,
        body: bBody,
        color: ['#ff0055', '#ffe600', '#a855f7', '#00ff66', '#00f0ff'][Math.floor(Math.random() * 5)],
        changeTimer: 0
    };
}

io.on('connection', (socket) => {
    socket.on('player_join', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name,
            x: data.x,
            y: data.y,
            angle: 0,
            body: data.body || [],
            color: data.color || '#00f0ff'
        };
    });

    socket.on('player_sync', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].angle = data.angle;
            players[socket.id].body = data.body;
            players[socket.id].color = data.color;
            players[socket.id].name = data.name;
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

setInterval(() => {
    for (let id in bots) {
        let bot = bots[id];
        bot.changeTimer++;
        if (bot.changeTimer > 90) {
            bot.angle += (Math.random() - 0.5) * 2.5;
            bot.changeTimer = 0;
        }

        bot.x += Math.cos(bot.angle) * bot.speed;
        bot.y += Math.sin(bot.angle) * bot.speed;

        if (bot.x < 100 || bot.x > MAP_SIZE - 100) bot.angle = Math.PI - bot.angle;
        if (bot.y < 100 || bot.y > MAP_SIZE - 100) bot.angle = -bot.angle;

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

    let allEntities = { ...players, ...bots };

    // Verificação de comida otimizada
    for (let id in allEntities) {
        let entity = allEntities[id];
        if (!entity || !entity.body) continue;

        for (let i = foods.length - 1; i >= 0; i--) {
            let f = foods[i];
            let dist = Math.hypot(entity.x - f.x, entity.y - f.y);
            if (dist < 20) {
                let tail = entity.body[entity.body.length - 1];
                entity.body.push({ x: tail.x, y: tail.y });
                foods[i].x = Math.random() * MAP_SIZE;
                foods[i].y = Math.random() * MAP_SIZE;
            }
        }
    }

    for (let pId in players) {
        let p = players[pId];
        if (!p || !p.body) continue;

        if (p.x <= 30 || p.x >= MAP_SIZE - 30 || p.y <= 30 || p.y >= MAP_SIZE - 30) {
            io.to(pId).emit('player_died', { score: p.body.length });
            delete players[pId];
            continue;
        }

        for (let oId in allEntities) {
            let target = allEntities[oId];
            if (!target || !target.body) continue;

            let startIdx = (pId === oId) ? 5 : 0;
            for (let i = startIdx; i < target.body.length; i++) {
                let part = target.body[i];
                let dist = Math.hypot(p.x - part.x, p.y - part.y);
                if (dist < 14) {
                    let finalScore = p.body.length;
                    p.body.forEach((pt, index) => {
                        if (index % 2 === 0) {
                            foods.push({ id: Math.random(), x: pt.x, y: pt.y, color: p.color });
                        }
                    });
                    io.to(pId).emit('player_died', { score: finalScore });
                    delete players[pId];
                    break;
                }
            }
            if (!players[pId]) break;
        }
    }

    io.emit('server_update', { players, bots, foods });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
