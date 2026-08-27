const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let players = {};
let foods = [];
const MAP_SIZE = 6000;

// Gera a comida inicial no mapa
for (let i = 0; i < 800; i++) {
    foods.push({
        id: i,
        x: Math.random() * MAP_SIZE,
        y: Math.random() * MAP_SIZE,
        color: ['#ff0055', '#ffe600', '#00f0ff', '#a855f7', '#00ff66', '#ff5500'][Math.floor(Math.random() * 6)]
    });
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
            color: data.color || '#00f0ff',
            score: data.body ? data.body.length : 35
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
            // Atualiza a pontuação baseada no comprimento exato enviado pelo cliente
            players[socket.id].score = data.body ? data.body.length : 35;
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

setInterval(() => {
    // Verificação de colisão com a comida (processada centralmente)
    for (let id in players) {
        let p = players[id];
        if (!p || !p.body) continue;

        for (let i = foods.length - 1; i >= 0; i--) {
            let f = foods[i];
            let dist = Math.hypot(p.x - f.x, p.y - f.y);
            if (dist < 20) {
                let tail = p.body[p.body.length - 1];
                p.body.push({ x: tail.x, y: tail.y });
                foods[i].x = Math.random() * MAP_SIZE;
                foods[i].y = Math.random() * MAP_SIZE;
            }
        }
    }

    // Verificação de bordas e colisões entre jogadores reais
    for (let pId in players) {
        let p = players[pId];
        if (!p || !p.body) continue;

        if (p.x <= 30 || p.x >= MAP_SIZE - 30 || p.y <= 30 || p.y >= MAP_SIZE - 30) {
            io.to(pId).emit('player_died', { score: p.body.length });
            delete players[pId];
            continue;
        }

        for (let oId in players) {
            let target = players[oId];
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

    // Envia o estado atualizado contendo apenas os dados dos jogadores reais e comidas
    io.emit('server_update', { players, foods });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor 100% online rodando na porta ${PORT}`));
