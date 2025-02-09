import { ChatGPTClass } from '../chatgpt.class.js';
import { flowRespuestas } from './flowRespuestas.js';
import { flowOfertas } from './ofertas.js';
import { flowPrincipal } from './principal.js';
import { flowTraining } from './training.js';


const chatGPT = new ChatGPTClass();
await chatGPT.init();

export const allFlows = [
    flowPrincipal(chatGPT),
    flowOfertas(chatGPT),
    flowTraining,
    flowRespuestas()
];