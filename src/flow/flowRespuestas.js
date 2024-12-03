import { addKeyword } from '@builderbot/bot';

// Función para extraer información del mensaje original
const extractInfoFromMessage = (message) => {
    try {
        const regex = {
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

// Función para formatear la información extraída
const formatExtractedInfo = (originalInfo, response) => {
    const presupuesto = response.replace(/[^0-9]/g, '');
    
    return {
        direccion: originalInfo.direccion || 'No especificada',
        excavacion: originalInfo.excavacion || 'No especificada',
        medidas: originalInfo.medidas || 'No especificadas',
        superficie: originalInfo.superficie || 'No especificada',
        coronacion: originalInfo.coronacion || 'No especificada',
        interior: originalInfo.interior || 'No especificado',
        presupuesto: presupuesto ? `${presupuesto}€` : 'No especificado'
    };
};

export const flowRespuestas = () => {
    return addKeyword('')
        .addAnswer('🔄 Iniciando flow de respuestas...')
        .addAction(async (ctx, { flowDynamic }) => {
            try {
                console.log('\n[FLOW RESPUESTAS - INICIO]');
                console.log('Contexto completo:', JSON.stringify(ctx, null, 2));
                console.log('Mensaje recibido:', ctx.body);

                await flowDynamic('📝 Analizando mensaje...');

                // Verificar si es una respuesta a un mensaje
                console.log('Verificando si es respuesta a mensaje...');
                console.log('ctx.message:', JSON.stringify(ctx.message, null, 2));

                if (!ctx.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                    console.log('❌ No es una respuesta a un mensaje');
                    await flowDynamic('⚠️ Este mensaje no es una respuesta a ningún presupuesto');
                    return;
                }

                // Obtener el mensaje original y la respuesta
                const quotedMessage = ctx.message.extendedTextMessage.contextInfo.quotedMessage;
                const originalText = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text;
                const responseText = ctx.body;

                console.log('Mensaje original encontrado:', originalText);
                console.log('Respuesta encontrada:', responseText);

                // Verificar si el mensaje original tiene el formato esperado
                if (!originalText || !originalText.includes('Dirección:')) {
                    console.log('❌ Formato incorrecto. Contenido:', originalText);
                    await flowDynamic('⚠️ El formato del mensaje original no es correcto');
                    return;
                }

                // Extraer información del mensaje original
                console.log('Extrayendo información...');
                const extractedInfo = extractInfoFromMessage(originalText);
                if (!extractedInfo) {
                    console.log('❌ Error en extracción de información');
                    await flowDynamic('❌ Error al procesar la información del presupuesto');
                    return;
                }

                console.log('Información extraída:', extractedInfo);

                // Formatear toda la información
                const formattedInfo = formatExtractedInfo(extractedInfo, responseText);

                // Crear mensaje de registro
                const logMessage = `
🏊‍♂️ Nuevo presupuesto registrado:
📍 Dirección: ${formattedInfo.direccion}
🚛 Excavación: ${formattedInfo.excavacion}
📏 Medidas: ${formattedInfo.medidas}
🗺️ Superficie: ${formattedInfo.superficie}
👑 Coronación: ${formattedInfo.coronacion}
🎨 Interior: ${formattedInfo.interior}
💰 Presupuesto: ${formattedInfo.presupuesto}
`;

                console.log('[RESULTADO FINAL]');
                console.log(logMessage);
                
                await flowDynamic([
                    '✅ Presupuesto registrado correctamente',
                    logMessage
                ]);

            } catch (error) {
                console.error('[ERROR EN FLOW RESPUESTAS]', error);
                console.error('Stack trace:', error.stack);
                await flowDynamic('❌ Error al procesar el presupuesto');
            }
        });
};