const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

let players = {};

io.on('connection', (socket) => {
    console.log(`[+] Jogador conectado: ${socket.id}`);

    // Recebe a sincronização da cobra do jogador
    socket.on('player_sync', (data) => {
        players[socket.id] = data;
    });

    // Desconexão
    socket.on('disconnect', () => {
        console.log(`[-] Jogador desconectado: ${socket.id}`);
        delete players[socket.id];
    });
});

// Envia o estado da arena para todos a cada frame de rede (30 FPS)
setInterval(() => {
    io.emit('atualizar_arena', players);
}, 1000 / 30);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
