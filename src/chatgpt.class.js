import dotenv from 'dotenv';
import { ChatGPTAPI } from 'chatgpt';

export class ChatGPTClass {
    queue = [];
    optionsGPT = { model: "gpt-4o-mini" };
    openai = undefined;

    constructor() {
        this.openai = null;
        dotenv.config();
    }

    /**
     * Esta función inicializa
     */
   
    async init() {
        //console.log('API:', process.env.OPENAI_API_KEY);
        this.openai = new ChatGPTAPI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    /**
     * Manejador de los mensajes
     * su función es enviar un mensaje a whatsapp
     * @param {string} body
     */
    async handleMsgChatGPT(body) {
        const interaccionChatGPT = await this.openai.sendMessage(body, {
            conversationId: !this.queue.length
                ? undefined
                : this.queue[this.queue.length - 1].conversationId,
            parentMessageId: !this.queue.length
                ? undefined
                : this.queue[this.queue.length - 1].id,
        });
        this.queue.push(interaccionChatGPT);
        return interaccionChatGPT;
    }
}