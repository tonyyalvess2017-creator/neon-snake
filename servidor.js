// --- CORREÇÃO DA BORDA: Limite Físico Rígido + Morte ---
        // Se a cobra encostar na borda (<= 30 ou >= MAP_SIZE - 30), travamos a posição dela para não vazar
        if (p.x < 50) p.x = 50;
        if (p.x > MAP_SIZE - 50) p.x = MAP_SIZE - 50;
        if (p.y < 50) p.y = 50;
        if (p.y > MAP_SIZE - 50) p.y = MAP_SIZE - 50;

        // Condição real de morte caso ultrapasse a linha limite extrema
        if (p.x <= 35 || p.x >= MAP_SIZE - 35 || p.y <= 35 || p.y >= MAP_SIZE - 35) {
            let finalScore = p.body.length;
            p.body.forEach((pt, index) => {
                if (index % 2 === 0) foods.push({ id: Math.random(), x: pt.x, y: pt.y, color: p.color });
            });
            io.to(pId).emit('player_died', { score: finalScore });
            delete players[pId];
            continue;
        }
