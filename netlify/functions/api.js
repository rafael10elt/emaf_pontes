// netlify/functions/api.js

const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    // Pega as variáveis de ambiente seguras
    const API_URL_BASE = process.env.NOCODB_API_URL;
    const API_TOKEN = process.env.NOCODB_API_TOKEN;

    // Pega o caminho do endpoint a partir da URL
    const apiPath = event.path.replace('/.netlify/functions/api/', '');

    // Constrói a string de parâmetros de consulta (query string)
    const queryString = event.rawQuery ? `?${event.rawQuery}` : '';
    
    // Monta a URL final completa, incluindo a base, o caminho e os parâmetros
    const fullNocoDBUrl = `${API_URL_BASE}/${apiPath}${queryString}`;

    try {
        const response = await fetch(fullNocoDBUrl, {
            method: event.httpMethod,
            headers: {
                'Content-Type': 'application/json',
                'xc-token': API_TOKEN,
            },
            // Repassa o corpo da requisição apenas se ele existir (para POST, PATCH)
            body: event.body ? event.body : undefined 
        });

        // Tenta ler a resposta como JSON. Se falhar (ex: resposta vazia), retorna sucesso.
        let data;
        try {
            data = await response.json();
        } catch (e) {
            // Se o corpo da resposta for vazio (comum em DELETE), consideramos sucesso
            if (response.ok) {
                return { statusCode: 200, body: JSON.stringify({ success: true }) };
            }
            // Se não for OK e não for JSON, é um erro de servidor
            throw new Error(`Resposta inválida do servidor: ${response.statusText}`);
        }

        // Se a resposta do NocoDB não for OK, repassa o erro
        if (!response.ok) {
            return {
                statusCode: response.status,
                body: JSON.stringify(data)
            };
        }

        // Se tudo deu certo, retorna os dados
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error("Erro na função Netlify:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Falha ao processar a requisição na função do servidor.',
                details: error.message
            })
        };
    }
};