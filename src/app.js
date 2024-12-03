import { join } from 'path'
import { createBot, createProvider, createFlow, addKeyword, utils } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'

import { ChatGPTClass } from './chatgpt.class.js';
import { flowPrincipal } from './flow/principal.js';
import { flowOfertas } from './flow/ofertas.js';
import { flowRespuestas } from './flow/flowRespuestas.js';
import dotenv from 'dotenv';

const PORT = process.env.PORT ?? 3008;

// Inicializar dotenv
dotenv.config();

const main = async () => {
    try {
        // Inicializar ChatGPT
        const chatGPT = new ChatGPTClass();
        await chatGPT.init();

        const adapterProvider = createProvider(Provider)
        const adapterDB = new Database()
        
        // Crear flujos en orden específico
        const adapterFlow = createFlow([
            flowPrincipal(chatGPT),
            flowOfertas(chatGPT),
            flowRespuestas(),
        ]);

        const { handleCtx, httpServer } = await createBot({
            flow: adapterFlow,
            provider: adapterProvider,
            database: adapterDB,
        })
    
        httpServer(+PORT)

        console.log('Bot iniciado correctamente');
    } catch (error) {
        console.error('Error al iniciar el bot:', error);
        process.exit(1);
    }
};

main();