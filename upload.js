const axios = require('axios');
const FormData = require('form-data');

exports.handler = async function(event, context) {
    // 1. Verifica se a requisição é do tipo POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // 2. Pega os dados enviados pelo frontend (nome do arquivo, tipo, e o arquivo em base64)
        const { file, fileName, fileType, path } = JSON.parse(event.body);

        // 3. Pega o Token Secreto das variáveis de ambiente da Netlify
        const NOCODB_API_TOKEN = process.env.NOCODB_API_TOKEN;
        const NOCODB_BASE_URL = 'https://lumitechia-nocodb.aeenwc.easypanel.host'; // Sua URL base

        // 4. Converte o arquivo de base64 de volta para formato binário (Buffer)
        const fileBuffer = Buffer.from(file, 'base64');

        // 5. Cria um novo formulário de dados no servidor
        const form = new FormData();
        form.append('file', fileBuffer, { filename: fileName, contentType: fileType });

        // 6. Monta a URL de upload do NocoDB
        const uploadUrl = `${NOCODB_BASE_URL}/api/v1/db/storage/upload?path=${path}`;

        // 7. Envia o arquivo para o NocoDB a partir da função serverless, usando o token secreto
        const response = await axios.post(uploadUrl, form, {
            headers: {
                ...form.getHeaders(),
                'xc-token': NOCODB_API_TOKEN,
            },
        });

        // 8. Retorna a resposta do NocoDB para o frontend
        return {
            statusCode: 200,
            body: JSON.stringify(response.data),
        };

    } catch (error) {
        console.error('Erro na função de upload:', error.response ? error.response.data : error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Falha ao processar o upload do arquivo.' }),
        };
    }
};