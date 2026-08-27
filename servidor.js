const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Rota raiz para evitar o erro "Cannot GET /" no navegador
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Neon Snake Server</title>
            <style>
                body { background: #070711; color: #00ffcc; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .box { text-align: center; border: 1px solid #1a1a3a; padding: 30px; border-radius: 12px; background: #0c0c1d; box-shadow: 0 0 30px rgba(0,0,0,0.8); }
            </style>
        </head>
        <body>
            <div class="box">
                <h2>Servidor Neon Slither Online Ativo!</h2>
                <p style="color: #888;">O backend WebSocket está rodando e pronto para conexões.</p>
            </div>
        </body>
        </html>
    `);
});

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

// Envia o estado da arena a cada frame de rede (30 FPS)
setInterval(() => {
    io.emit('atualizar_arena', players);
}, 1000 / 30);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
