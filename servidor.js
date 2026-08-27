const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Faz o servidor carregar o index.html e os arquivos da pasta automaticamente
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let jogadores = {};

io.on('connection', (socket) => {
    console.log(`> Novo jogador conectado: ${socket.id}`);

    socket.on('player_sync', (dados) => {
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
