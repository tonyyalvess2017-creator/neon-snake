// ==========================================
// 1. IMPORTAÇÕES E CONFIGURAÇÃO DO SERVIDOR
// ==========================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Define que os arquivos do front-end (index.html, etc.) estão na mesma pasta
app.use(express.static(__dirname));

// ==========================================
// 2. VARIÁVEIS GLOBAIS DO MUNDO E ESTADO DO JOGO
// ==========================================
let players = {}; // Armazena todos os jogadores online conectados
let bots = {};    // Armazena todos os bots (cobras controladas pela IA)
let foods = [];   // Armazena as bolinhas de comida espalhadas pelo mapa
const MAP_SIZE = 6000; // Tamanho total do mapa em pixels (largura e altura)

// [MODIFICÁVEL] Aqui você altera a quantidade inicial de comida gerada no mapa
for (let i = 0; i < 2000; i++) {
    foods.push({
        id: i,
        x: Math.random() * MAP_SIZE,
        y: Math.random() * MAP_SIZE,
        color: ['#ff0055', '#ffe600', '#00f0ff', '#a855f7', '#00ff66', '#ff5500'][Math.floor(Math.random() * 6)]
    });
}

// ==========================================
// 3. SISTEMA DE BOTS (CRIAÇÃO E COMPORTAMENTO)
// ==========================================
const botNames = ["Viper", "CyberSnake", "NeonWorm", "Venom", "Apex", "Titan", "Shadow", "Blaze", "Ghost", "PythonMaster"];

// [MODIFICÁVEL] Altere o número "20" abaixo para ter mais ou menos bots no servidor
for (let i = 0; i < 20; i++) {
    spawnBot(`bot_${i}`, botNames[i % botNames.length]);
}

function spawnBot(id, name) {
    let bX = Math.random() * (MAP_SIZE - 1000) + 500;
    let bY = Math.random() * (MAP_SIZE - 1000) + 500;
    let bBody = [];
    
    // [MODIFICÁVEL] Tamanho inicial do corpo dos bots (35 partes)
    for (let j = 0; j < 35; j++) {
        bBody.push({ x: bX, y: bY + (j * 4) });
    }
    
    bots[id] = {
        id: id,
        name: name,
        x: bX,
        y: bY,
        angle: Math.random() * Math.PI * 2,
        speed: 3.5, // [MODIFICÁVEL] Velocidade de movimento dos bots
        body: bBody,
        color: ['#ff0055', '#ffe600', '#a855f7', '#00ff66', '#00f0ff'][Math.floor(Math.random() * 5)],
        changeTimer: 0
    };
}

// ==========================================
// 4. GERENCIAMENTO DE CONEXÕES DOS JOGADORES
// ==========================================
io.on('connection', (socket) => {
    
    // Quando o jogador entra na partida
    socket.on('player_join', (data) => {
        // [ÁREA DE ADMIN / PERMISSÕES] Você pode checar se o ID do socket ou o nick é seu para dar privilégios de Admin aqui
        let isAdmin = (data.name.toLowerCase() === 'admin'); // Exemplo simples

        players[socket.id] = {
            id: socket.id,
            name: data.name,
            x: data.x,
            y: data.y,
            angle: 0,
            body: data.body || [],
            color: data.color || '#00f0ff',
            admin: isAdmin // Flag de admin caso queira usar futuramente
        };
    });

    // Sincroniza a posição, ângulo e corpo enviados pelo cliente em tempo real
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

    // Remove o jogador se ele fechar a aba ou cair a conexão
    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

// ==========================================
// 5. LOOP PRINCIPAL DO SERVIDOR (60 FPS)
// ==========================================
setInterval(() => {
    
    // --- 5.1 Atualiza a IA e Movimento dos Bots ---
    for (let id in bots) {
        let bot = bots[id];
        bot.changeTimer++;
        if (bot.changeTimer > 90) {
            bot.angle += (Math.random() - 0.5) * 2.5;
            bot.changeTimer = 0;
        }

        bot.x += Math.cos(bot.angle) * bot.speed;
        bot.y += Math.sin(bot.angle) * bot.speed;

        // Mantém os bots dentro dos limites do mapa
        if (bot.x < 100 || bot.x > MAP_SIZE - 100) bot.angle = Math.PI - bot.angle;
        if (bot.y < 100 || bot.y > MAP_SIZE - 100) bot.angle = -bot.angle;

        // Atualiza a física do corpo do bot (efeito cobrinha seguindo a cabeça)
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

    // --- 5.2 Consumo de Comida Comum ---
    for (let id in allEntities) {
        let entity = allEntities[id];
        if (!entity || !entity.body) continue;

        for (let i = foods.length - 1; i >= 0; i--) {
            let f = foods[i];
            let dist = Math.hypot(entity.x - f.x, entity.y - f.y);
            
            // [MODIFICÁVEL] Distância para comer a bolinha (22 pixels)
            if (dist < 22) {
                let tail = entity.body[entity.body.length - 1];
                entity.body.push({ x: tail.x, y: tail.y }); // Cresce 1 gomo
                
                // Reposiona a comida comida em outro lugar aleatório do mapa
                foods[i].x = Math.random() * MAP_SIZE;
                foods[i].y = Math.random() * MAP_SIZE;
            }
        }
    }

    // --- 5.3 Sistema de Colisão PVP e Morte ---
    for (let pId in players) {
        let p = players[pId];
        if (!p || !p.body) continue;

        // Morte instantânea se bater nas paredes da borda do mapa
        if (p.x <= 30 || p.x >= MAP_SIZE - 30 || p.y <= 30 || p.y >= MAP_SIZE - 30) {
            let finalScore = p.body.length;
            // Transforma o corpo em massa espalhada no mapa ao morrer na borda
            p.body.forEach((pt, index) => {
                if (index % 2 === 0) {
                    foods.push({ id: Math.random(), x: pt.x, y: pt.y, color: p.color });
                }
            });
            io.to(pId).emit('player_died', { score: finalScore });
            delete players[pId];
            continue;
        }

        let morreu = false;
        for (let oId in allEntities) {
            let target = allEntities[oId];
            if (!target || !target.body) continue;

            // IMPORTANTE: Se for o próprio player, ignoramos os primeiros 6 segmentos da cabeça 
            // para evitar que a cobra bata nela mesma logo no início do corpo e morra "do nada".
            let startIdx = (pId === oId) ? 6 : 0;
            
            for (let i = startIdx; i < target.body.length; i++) {
                let part = target.body[i];
                let dist = Math.hypot(p.x - part.x, p.y - part.y);
                
                // [MODIFICÁVEL] Hitbox de colisão letal (12 pixels). 
                // Se quiser deixar mais difícil de morrer, diminua para 10. Se quiser mais fácil, aumente para 15.
                if (dist < 12) {
                    morreu = true;
                    break;
                }
            }
            if (morreu) break;
        }

        // Se a morte foi confirmada por colisão PVP
        if (morreu) {
            let finalScore = p.body.length;
            
            // Joga todo o corpo do player morto em forma de bolinhas de massa colorida no mapa
            p.body.forEach((pt, index) => {
                if (index % 2 === 0) {
                    foods.push({ id: Math.random(), x: pt.x, y: pt.y, color: p.color });
                }
            });

            // Avisa o cliente que ele morreu e envia a pontuação para calcular as moedas da lojinha
            io.to(pId).emit('player_died', { score: finalScore });
            delete players[pId];
        }
    }

    // --- 5.4 Envia os dados atualizados para todos os jogadores conectados ---
    io.emit('server_update', { players, bots, foods });

}, 1000 / 60); // Roda exatamente a 60 vezes por segundo

// ==========================================
// 6. INICIALIZAÇÃO DA PORTA DO SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
