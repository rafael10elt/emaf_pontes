// netlify/functions/api.js

const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    const API_URL_BASE = process.env.NOCODB_API_URL;
    const API_TOKEN = process.env.NOCODB_API_TOKEN;

    if (!API_URL_BASE || !API_TOKEN) {
        return { statusCode: 500, body: JSON.stringify({ error: "Variáveis de ambiente não configuradas no servidor." }) };
    }

    const apiPath = event.path.replace('/.netlify/functions/api/', '');
    const queryString = event.rawQuery ? `?${event.rawQuery}` : '';
    const fullNocoDBUrl = `${API_URL_BASE}/${apiPath}${queryString}`;

    const fetchOptions = {
        method: event.httpMethod,
        headers: {
            'Content-Type': 'application/json',
            'xc-token': API_TOKEN,
        },
    };

    // Adiciona o corpo (body) apenas para métodos que o suportam e se ele existir.
    if (['POST', 'PATCH'].includes(event.httpMethod) && event.body) {
        fetchOptions.body = event.body;
    }

    try {
        const response = await fetch(fullNocoDBUrl, fetchOptions);

        // Para DELETE ou respostas sem conteúdo, retorna sucesso.
        if (response.status === 204 || event.httpMethod === 'DELETE') {
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }

        const data = await response.json();

        if (!response.ok) {
            return {
                statusCode: response.status,
                body: JSON.stringify(data)
            };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error("Erro na função Netlify 'api.js':", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Falha ao processar a requisição na função do servidor.',
                details: error.message
            })
        };
    }
};