const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Define a pasta atual como pública para servir os arquivos HTML
app.use(express.static(__dirname));

let players = {};

io.on('connection', (socket) => {
    console.log(`[+] Jogador conectado: ${socket.id}`);

    socket.on('player_sync', (data) => {
        players[socket.id] = data;
    });

    socket.on('disconnect', () => {
        console.log(`[-] Jogador desconectado: ${socket.id}`);
        delete players[socket.id];
    });
});

setInterval(() => {
    io.emit('atualizar_arena', players);
}, 1000 / 30);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
