import { addKeyword, EVENTS } from '@builderbot/bot';
import axios from 'axios';
import { OpenAI } from 'openai';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Initialize OpenAI client with direct API key
const apiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({
    apiKey: apiKey
});

// API Gateway endpoint
const API_GATEWAY_ENDPOINT = "https://7g6o6vby9j.execute-api.eu-west-3.amazonaws.com/Talky-PLH/crear-lead";

// Utility function for delays
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const REGEX_ANY_CHARACTER = '/^.+$/';

// Enhanced logging function with better formatting
const logInfo = (context, message, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] [${context}]`);
    console.log(`Message: ${message}`);
    if (data) {
        console.log('Data:', JSON.stringify(data, null, 2));
    }
    console.log('-'.repeat(80));
};

// Funciones para el procesamiento de respuestas de presupuestos
const extractInfoFromMessage = (message) => {
    try {
        const regex = {
            id_proyecto: /ID Proyecto:\s*([^\n]+)/i,
            direccion: /Dirección:\s*([^\n]+)/i,
            excavacion: /Excavación:\s*([^\n]+)/i,
            medidas: /Medidas piscina:\s*(\d+x\d+)\s*metros/i,
            superficie: /Superficie parcela:\s*(\d+)\s*m²/i,
            coronacion: /Coronación:\s*([^\n]+)/i,
            interior: /Interior:\s*([^\n]+)/i
        };

        const info = {};
        for (const [key, reg] of Object.entries(regex)) {
            const match = message.match(reg);
            if (match) {
                info[key] = match[1].trim();
            }
        }

        return info;
    } catch (error) {
        console.error('Error extrayendo información:', error);
        return null;
    }
};

const formatExtractedInfo = (originalInfo, response) => {
    const presupuesto = response.replace(/[^0-9]/g, '');
    
    return {
        id_proyecto: originalInfo.id_proyecto || 'No especificado',
        direccion: originalInfo.direccion || 'No especificada',
        excavacion: originalInfo.excavacion || 'No especificada',
        medidas: originalInfo.medidas || 'No especificadas',
        superficie: originalInfo.superficie || 'No especificada',
        coronacion: originalInfo.coronacion || 'No especificada',
        interior: originalInfo.interior || 'No especificado',
        presupuesto: presupuesto ? `${presupuesto}€` : 'No especificado'
    };
};

const procesarRespuestaPresupuesto = async (ctx, flowDynamic) => {
    try {
        console.log('\n[PROCESAMIENTO DE RESPUESTA DE PRESUPUESTO]');
        console.log('Mensaje recibido:', ctx.body);

        if (!ctx.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            console.log('No es una respuesta a un mensaje');
            return;
        }

        const quotedMessage = ctx.message.extendedTextMessage.contextInfo.quotedMessage;
        const originalText = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text;
        const responseText = ctx.body;

        console.log('Mensaje original:', originalText);
        console.log('Respuesta:', responseText);

        if (!originalText || !originalText.includes('Dirección:')) {
            console.log('El mensaje original no tiene el formato esperado');
            return;
        }

        const extractedInfo = extractInfoFromMessage(originalText);
        if (!extractedInfo) {
            console.log('No se pudo extraer información del mensaje');
            return;
        }

        const formattedInfo = formatExtractedInfo(extractedInfo, responseText);

        const apiData = {
            projectId: formattedInfo.id_proyecto,
            budget: parseInt(formattedInfo.presupuesto.replace('€', ''))
        };

        try {
            await axios.post('https://7g6o6vby9j.execute-api.eu-west-3.amazonaws.com/Talky-PLH/coger-presupuesto', apiData);
            console.log('Presupuesto enviado exitosamente a la API');
        } catch (error) {
            console.error('Error al enviar a la API:', error);
        }

    } catch (error) {
        console.error('[ERROR EN PROCESAMIENTO DE PRESUPUESTO]', error);
        console.error('Stack trace:', error.stack);
    }
};

// Conversational AI to handle the chat flow
const getNextInteraction = async (conversation) => {
    try {
        logInfo('getNextInteraction', 'Processing conversation with AI', {
            conversationLength: conversation.length
        });

        const prompt = `
        Eres un asistente experto en piscinas que está ayudando a un cliente a recopilar información para un presupuesto.
        Debes mantener una conversación natural y amigable, pero también asegurarte de obtener toda la información necesaria.

        Información necesaria a recopilar:
        - Nombre completo
        - Número de teléfono
        - Dirección de la obra
        - Dimensiones de la parcela (en metros cuadrados)
        - Dimensiones deseadas para la piscina (largo y ancho en metros)
        - Material interior preferido (gresite o porcelánico)
        - Material para la coronación (piedra artificial u otras opciones)
        - Accesibilidad a la parcela (facilidad de acceso para maquinaria donde estará la piscina)

        Historial de la conversación:
        ${conversation.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

        Instrucciones:
        1. Analiza el contexto de la conversación y determina qué información falta por recopilar
        2. Formula la siguiente pregunta o interacción de manera natural y conversacional
        3. Si ya tienes toda la información necesaria, indica que has terminado con un prefijo [COMPLETED]
        4. Si detectas que el cliente está confundido o necesita aclaraciones, proporciónalas
        5. Adapta tu tono según el cliente, siendo profesional pero cercano
        6. Si el cliente proporciona información incompleta o poco clara, pide aclaraciones de forma amable
        7. Para la accesibilidad, asegúrate de preguntar específicamente sobre el acceso de maquinaria

        Responde SOLO con tu siguiente interacción, sin explicaciones adicionales.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: prompt },
                ...conversation
            ],
            temperature: 0.7
        });

        const response = completion.choices[0].message.content;
        logInfo('getNextInteraction', 'Got AI response', { response });
        return response;
    } catch (error) {
        logInfo('getNextInteraction', 'Error getting next interaction', { error: error.message });
        return "Lo siento, ha ocurrido un error. ¿Podrías repetir tu última respuesta?";
    }
};

// Data extraction AI to analyze the conversation history
const extractDataFromConversation = async (conversation) => {
    try {
        logInfo('extractDataFromConversation', 'Starting data extraction from conversation');

        const prompt = `
        Analiza la siguiente conversación y extrae toda la información relevante para un presupuesto de piscina.
        
        Conversación:
        ${conversation.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
        
        Extrae y estructura la siguiente información en formato JSON:
        {
            "nombre_completo": "Nombre y apellidos encontrados en la conversación",
            "numero_telefono": "Número de teléfono (añadir prefijo 34 si falta)",
            "ubicacion": "Dirección completa (añadir ', Madrid' si no se especifica otra ciudad)",
            "dimension_parcela": "Área en metros cuadrados (solo el número)",
            "dimension_piscina": {
                "largo": "Largo en metros (solo el número)",
                "ancho": "Ancho en metros (solo el número)"
            },
            "material_interior": "Material interior mencionado (gresite o porcelánico)",
            "material_coronacion": "Material de coronación mencionado",
            "acceso_parcela": "Descripción de la facilidad de acceso para maquinaria"
        }

        Reglas importantes:
        1. Solo incluye datos que aparezcan explícitamente en la conversación
        2. Si un dato no está presente o es ambiguo, no lo incluyas
        3. Asegúrate de que los valores numéricos sean números sin unidades
        4. Normaliza los números de teléfono para que empiecen con 34
        5. Verifica que la información sea consistente en toda la conversación
        6. Para el acceso_parcela, incluye cualquier información sobre la facilidad de acceso mencionada

        Responde SOLO con el JSON, sin explicaciones adicionales.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: prompt },
                { role: "user", content: conversation.map(msg => `${msg.role}: ${msg.content}`).join('\n') }
            ],
            temperature: 0.1
        });

        const extractedData = JSON.parse(completion.choices[0].message.content);
        logInfo('extractDataFromConversation', 'Successfully extracted data', { extractedData });
        return extractedData;
    } catch (error) {
        logInfo('extractDataFromConversation', 'Error extracting data', { error: error.message });
        return null;
    }
};

// Function to format data for DynamoDB
const formatDataForDynamoDB = (data) => {
    const formattedData = {
        id: `lead-${uuidv4().split('-')[0]}`,
        address: data.ubicacion,
        name: data.nombre_completo,
        phone: data.numero_telefono,
        parcelDimensions: {
            area: Number(data.dimension_parcela)
        },
        poolDimensions: {
            length: Number(data.dimension_piscina.largo),
            width: Number(data.dimension_piscina.ancho)
        },
        Interior: data.material_interior,
        Coronacion: data.material_coronacion,
        acceso_parcela: data.acceso_parcela,
        source: 'whatsapp',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    logInfo('formatDataForDynamoDB', 'Formatted data for DynamoDB', formattedData);
    return formattedData;
};

// Function to check if all required data is present
const isDataComplete = (data) => {
    const requiredFields = [
        'nombre_completo',
        'numero_telefono',
        'ubicacion',
        'dimension_parcela',
        ['dimension_piscina', 'largo'],
        ['dimension_piscina', 'ancho'],
        'material_interior',
        'material_coronacion',
        'acceso_parcela'
    ];

    const missingFields = requiredFields.filter(field => {
        if (Array.isArray(field)) {
            return !data[field[0]]?.[field[1]];
        }
        return !data[field];
    });

    logInfo('isDataComplete', 'Checking data completeness', {
        isComplete: missingFields.length === 0,
        missingFields,
        availableData: data
    });

    return missingFields.length === 0;
};

// Function to send data to API
const sendToAPI = async (data) => {
    logInfo('sendToAPI', 'Attempting to send data to API', { inputData: data });
    
    try {
        const formattedData = formatDataForDynamoDB(data);
        logInfo('sendToAPI', 'Sending formatted data to API endpoint', { 
            endpoint: API_GATEWAY_ENDPOINT,
            formattedData 
        });

        const response = await axios.post(
            API_GATEWAY_ENDPOINT,
            formattedData,
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        logInfo('sendToAPI', 'Successfully sent data to API', { 
            responseStatus: response.status,
            responseData: response.data 
        });
        
        return response.data;
    } catch (error) {
        logInfo('sendToAPI', 'Error sending data to API', {
            message: error.message,
            status: error.response?.status,
            responseData: error.response?.data,
            originalData: data
        });
        throw error;
    }
};

// Main flow -> Aquí debería ser un addResponse, para que no se active directamente si le dices un 'hola'
export const flowOfertas = (chatgptClass) => {
    return addKeyword(EVENTS.ACTION)
        .addAction(async (ctx, { flowDynamic, state }) => {
            console.log('Se llega al puto flow de oferas');
            try {
                // Verificar si el mensaje viene del número específico de presupuestos
                if (ctx.from === '34684713364') {
                    console.log('\n[PROCESANDO MENSAJE DEL NÚMERO DE PRESUPUESTOS]');
                    console.log('Número detectado:', ctx.from);
                    console.log('Contenido:', ctx.body);

                    await procesarRespuestaPresupuesto(ctx, flowDynamic);
                    return false;
                }

                logInfo('flowOfertas', 'Processing new message', { 
                    messageBody: ctx.body,
                    from: ctx.from 
                });

                // Get or initialize conversation history
                let conversation = state.get('conversation') || [];
                
                // Add user's message to conversation
                conversation.push({ role: "user", content: ctx.body });
                
                // If this is the first message, add initial greeting
                if (conversation.length === 0) {
                    const greeting = "¡Hola! Soy el asistente virtual de piscinas. ¿En qué puedo ayudarte hoy?";
                    await flowDynamic(greeting);
                    conversation.push({ role: "assistant", content: greeting });
                    logInfo('flowOfertas', 'Sent initial greeting');
                }

                // Get next interaction from conversational AI
                const nextResponse = await getNextInteraction(conversation);
                logInfo('flowOfertas', 'Got AI response', { aiResponse: nextResponse });
                
                // Check if conversation is complete
                if (nextResponse.includes('[COMPLETED]')) {
                    logInfo('flowOfertas', 'AI indicates conversation is complete');
                    
                    // Extract all data from conversation
                    const extractedData = await extractDataFromConversation(conversation);
                    logInfo('flowOfertas', 'Extracted data from conversation', { extractedData });
                    
                    if (extractedData && isDataComplete(extractedData)) {
                        logInfo('flowOfertas', 'Data is complete, attempting to send to API');
                        try {
                            const apiResponse = await sendToAPI(extractedData);
                            logInfo('flowOfertas', 'Successfully sent data to API', { apiResponse });
                            
                            const completionMessages = [
                                "¡Perfecto! Ya tengo toda la información necesaria.",
                                "Nuestro equipo revisará los detalles y te contactará pronto con un presupuesto personalizado.",
                                "¿Hay algo más en lo que pueda ayudarte?"
                            ];
                            await flowDynamic(completionMessages);
                            
                            // Add completion messages to conversation
                            completionMessages.forEach(msg => {
                                conversation.push({ role: "assistant", content: msg });
                            });
                            
                            // Clear conversation after successful submission
                            await state.update({ conversation: [] });
                            logInfo('flowOfertas', 'Successfully completed flow and reset conversation');
                            return false;
                        } catch (error) {
                            logInfo('flowOfertas', 'Error sending data to API', { error: error.message });
                            await flowDynamic("Lo siento, ha ocurrido un error al procesar tu solicitud. ¿Podrías intentarlo más tarde?");
                        }
                    } else {
                        logInfo('flowOfertas', 'Data is incomplete despite [COMPLETED] flag', { 
                            extractedData,
                            isComplete: extractedData ? isDataComplete(extractedData) : false 
                        });
                        const cleanResponse = nextResponse.replace('[COMPLETED]', '').trim();
                        await flowDynamic(cleanResponse);
                        conversation.push({ role: "assistant", content: cleanResponse });
                    }
                } else {
                    logInfo('flowOfertas', 'Continuing normal conversation');
                    await flowDynamic(nextResponse);
                    conversation.push({ role: "assistant", content: nextResponse });
                }

                // Update conversation in state
                await state.update({ conversation });
                logInfo('flowOfertas', 'Updated conversation state', { 
                    conversationLength: conversation.length 
                });
                
                return false;

            } catch (error) {
                logInfo('flowOfertas', 'Error in flow', { 
                    error: error.message,
                    stack: error.stack 
                });
                await flowDynamic('Lo siento, ha ocurrido un error. ¿Podrías intentarlo de nuevo?');
                return false;
            }
        });
};