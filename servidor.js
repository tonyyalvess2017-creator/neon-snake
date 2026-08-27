const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let jogadores = {};

io.on('connection', (socket) => {
    console.log(`> Novo jogador conectado: ${socket.id}`);

    socket.on('player_sync', (dados) => {
        // Força o ID a ser o socket.id oficial para evitar conflitos e fantasmas
        dados.id = socket.id;
        jogadores[socket.id] = dados;
        io.emit('atualizar_arena', jogadores);
    });

    socket.on('disconnect', () => {
        console.log(`> Jogador desconectado: ${socket.id}`);
        delete jogadores[socket.id];
        io.emit('atualizar_arena', jogadores);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`> Servidor Neon Snake rodando na porta ${PORT}`);
});