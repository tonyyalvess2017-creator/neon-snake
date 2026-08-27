const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let players = {};
let foods = [];

// Gera comida inicial na arena gigante
for (let i = 0; i < 1000; i++) {
    foods.push({
        id: i,
        x: Math.random() * 5000,
        y: Math.random() * 5000,
        color: ['#ff0055', '#ffe600', '#00f0ff', '#a855f7', '#00ff66'][Math.floor(Math.random() * 5)]
    });
}

io.on('connection', (socket) => {
    console.log(`[+] Jogador conectado: ${socket.id}`);

    socket.on('join_game', (data) => {
        players[socket.id] = {
            id: socket.id,
            x: data.x,
            y: data.y,
            angle: 0,
            score: 30,
            body: data.body,
            color: data.color
        };
    });

    socket.on('player_update', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].angle = data.angle;
            players[socket.id].score = data.score;
            players[socket.id].body = data.body;
        }
    });

    socket.on('disconnect', () => {
        console.log(`[-] Jogador desconectado: ${socket.id}`);
        delete players[socket.id];
    });
});

// Loop de sincronização global da arena
setInterval(() => {
    io.emit('server_tick', { players, foods });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Engine rodando na porta ${PORT}`));
