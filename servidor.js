// ==========================================
// 1. IMPORTAÇÕES E CONFIGURAÇÃO DO SERVIDOR
// ==========================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

// ==========================================
// 2. VARIÁVEIS GLOBAIS E MAPA
// ==========================================
let players = {}; 
let bots = {};    
let foods = [];   
const MAP_SIZE = 6000; // Tamanho do mapa

for (let i = 0; i < 1500; i++) {
    foods.push({
        id: i,
        x: Math.random() * MAP_SIZE,
        y: Math.random() * MAP_SIZE,
        color: ['#ff0055', '#ffe600', '#00f0ff', '#a855f7', '#00ff66', '#ff5500'][Math.floor(Math.random() * 6)]
    });
}

// ==========================================
// 3. SISTEMA DE BOTS (IA) COM NOMES PERSONALIZADOS
// ==========================================
const botNames = ["Bernardo", "Gabriel", "Lucas", "Igor", "Viper", "CyberSnake", "NeonWorm", "Venom", "Apex", "Titan", "Shadow", "Blaze", "Ghost", "PythonMaster"];

for (let i = 0; i < 15; i++) {
    spawnBot(`bot_${i}`, botNames[i % botNames.length]);
}

function spawnBot(id, name) {
    let bX = Math.random() * (MAP_SIZE - 1000) + 500;
    let bY = Math.random() * (MAP_SIZE - 1000) + 500;
    let bBody = [];
    
    for (let j = 0; j < 35; j++) {
        bBody.push({ x: bX, y: bY + (j * 4) });
    }
    
    bots[id] = {
        id: id,
        name: name,
        x: bX,
        y: bY,
        angle: Math.random() * Math.PI * 2,
        speed: 3.5,
        body: bBody,
        color: ['#ff0055', '#ffe600', '#a855f7', '#00ff66', '#00f0ff'][Math.floor(Math.random() * 5)],
        changeTimer: 0
    };
}

// ==========================================
// 4. CONEXÕES DOS JOGADORES (COM BLINDAGEM DE BORDA)
// ==========================================
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
            // Trava rígida para impedir que o cliente ultrapasse o limite do mapa
            let clampedX = Math.max(60, Math.min(MAP_SIZE - 60, data.x));
            let clampedY = Math.max(60, Math.min(MAP_SIZE - 60, data.y));

            players[socket.id].x = clampedX;
            players[socket.id].y = clampedY;
            players[socket.id].angle = data.angle;
            players[socket.id].body = data.body;
            players[socket.id].color = data.color;
            players[socket.id].name = data.name;
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

// ==========================================
// 5. LOOP PRINCIPAL (OTIMIZADO PARA 60 FPS)
// ==========================================
setInterval(() => {
    
    // --- 5.1 Movimentação dos Bots ---
    for (let id in bots) {
        let bot = bots[id];
        bot.changeTimer++;
        if (bot.changeTimer > 90) {
            bot.angle += (Math.random() - 0.5) * 2.5;
            bot.changeTimer = 0;
        }

        bot.x += Math.cos(bot.angle) * bot.speed;
        bot.y += Math.sin(bot.angle) * bot.speed;

        if (bot.x < 100 || bot.x > MAP_SIZE - 100) bot.angle = Math.PI - bot.angle;
        if (bot.y < 100 || bot.y > MAP_SIZE - 100) bot.angle = -bot.angle;

        let targetX = bot.x;
        let targetY = bot.y;
        for (let i = 0; i < bot.body.length; i++) {
            let part = bot.body[i];
            let dx = targetX - part.x;
            let dy = targetY - part.y;
            let dist = Math.hypot(dx, dy);
            if (dist > 12) {
                let ang = Math.atan2(dy, dx);
                part.x = targetX - Math.cos(ang) * 12;
                part.y = targetY - Math.sin(ang) * 12;
            }
            targetX = part.x;
            targetY = part.y;
        }
    }

    let allEntities = { ...players, ...bots };

    // --- 5.2 Consumo de Comida ---
    for (let id in allEntities) {
        let entity = allEntities[id];
        if (!entity || !entity.body) continue;

        for (let i = foods.length - 1; i >= 0; i--) {
            let f = foods[i];
            if (Math.abs(entity.x - f.x) < 20 && Math.abs(entity.y - f.y) < 20) {
                let tail = entity.body[entity.body.length - 1];
                entity.body.push({ x: tail.x, y: tail.y });
                foods[i].x = Math.random() * MAP_SIZE;
                foods[i].y = Math.random() * MAP_SIZE;
            }
        }
    }

    // --- 5.3 Colisão PVP Limpa (Com folga de 18 partes para zerar morte fantasma) ---
    for (let pId in players) {
        let p = players[pId];
        if (!p || !p.body) continue;

        let morreu = false;
        for (let oId in allEntities) {
            let target = allEntities[oId];
            if (!target || !target.body) continue;

            // Ignora os primeiros 18 segmentos do próprio corpo para evitar colisão ao fazer curvas
            let startIdx = (pId === oId) ? 18 : 0;
            
            for (let i = startIdx; i < target.body.length; i += 2) {
                let part = target.body[i];
                if (Math.abs(p.x - part.x) < 10 && Math.abs(p.y - part.y) < 10) {
                    morreu = true;
                    break;
                }
            }
            if (morreu) break;
        }

        if (morreu) {
            let finalScore = p.body.length;
            p.body.forEach((pt, index) => {
                if (index % 2 === 0) {
                    foods.push({ id: Math.random(), x: pt.x, y: pt.y, color: p.color });
                }
            });
            io.to(pId).emit('player_died', { score: finalScore });
            delete players[pId];
        }
    }

    io.emit('server_update', { players, bots, foods });

}, 1000 / 60);

// ==========================================
// 6. INICIALIZAÇÃO
// ==========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
