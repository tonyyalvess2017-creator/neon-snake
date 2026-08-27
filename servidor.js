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

// Gera comidas iniciais no mapa
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

    socket.on('player_died_notify', (data) => {
        if (players[socket.id] && players[socket.id].body) {
            players[socket.id].body.forEach((pt, index) => {
                if (index % 2 === 0) {
                    foods.push({ id: Math.random(), x: pt.x, y: pt.y, color: players[socket.id].color });
                }
            });
        }
        delete players[socket.id];
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

setInterval(() => {
    // Processamento centralizado de comida: garante que apenas quem colide de fato com a bolinha cresce e atualiza o tamanho real
    for (let id in players) {
        let p = players[id];
        if (!p || !p.body) continue;

        for (let i = foods.length - 1; i >= 0; i--) {
            let f = foods[i];
            let dist = Math.hypot(p.x - f.x, p.y - f.y);
            if (dist < 22) {
                // Adiciona novas partes ao corpo da cobra com base estrita na comida ingerida
                let tail = p.body[p.body.length - 1];
                p.body.push({ x: tail.x, y: tail.y });
                
                // Reposiciona a comida coletada no mapa
                foods[i].x = Math.random() * MAP_SIZE;
                foods[i].y = Math.random() * MAP_SIZE;
            }
        }
    }

    // Validação de colisão PVP
    for (let pId in players) {
        let p = players[pId];
        if (!p || !p.body) continue;

        for (let oId in players) {
            if (pId === oId) continue;
            let target = players[oId];
            if (!target || !target.body) continue;

            for (let i = 0; i < target.body.length; i++) {
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

    io.emit('server_update', { players, foods });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor 100% online rodando na porta ${PORT}`));
