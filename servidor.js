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

// Inicializa o mapa com 1500 orbes de comida distribuídas
for (let i = 0; i < 1500; i++) {
    foods.push({
        id: i,
        x: Math.random() * MAP_SIZE,
        y: Math.random() * MAP_SIZE,
        color: ['#ff0055', '#ffe600', '#00f0ff', '#a855f7', '#00ff66', '#ff5500'][Math.floor(Math.random() * 6)]
    });
}

io.on('connection', (socket) => {
    console.log(`[+] Conexão estabelecida: ${socket.id}`);

    socket.on('player_join', (data) => {
        players[socket.id] = {
            id: socket.id,
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
        console.log(`[-] Conexão encerrada: ${socket.id}`);
        delete players[socket.id];
    });
});

// Loop de alta performance do servidor (60 FPS tick-rate)
setInterval(() => {
    io.emit('server_update', { players, foods });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor de produção rodando na porta ${PORT}`);
});
