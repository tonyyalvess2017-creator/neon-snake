const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Serve o arquivo HTML do jogo direto da raiz
app.use(express.static(__dirname));

let players = {};

io.on('connection', (socket) => {
    console.log(`[+] Jogador conectado: ${socket.id}`);

    // Recebe a posição do cliente
    socket.on('player_sync', (data) => {
        players[socket.id] = data;
    });

    // Remove o jogador ao desconectar
    socket.on('disconnect', () => {
        console.log(`[-] Jogador desconectado: ${socket.id}`);
        delete players[socket.id];
    });
});

// Envia a lista atualizada para TODOS os clientes conectados a cada 30 milissegundos
setInterval(() => {
    io.emit('atualizar_arena', players);
}, 1000 / 30);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
