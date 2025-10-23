// netlify/functions/upload.js
const axios = require('axios');
const FormData = require('form-data');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const API_TOKEN = process.env.NOCODB_API_TOKEN;
    const { tableName, columnName } = event.queryStringParameters;

    if (!tableName || !columnName) {
        return { statusCode: 400, body: 'Bad Request: tableName and columnName are required.' };
    }

    const UPLOAD_URL_BASE = process.env.NOCODB_UPLOAD_URL;
    const fullUploadUrl = `${UPLOAD_URL_BASE}?path=Consultoria_DB/${tableName}/${columnName}`;

    try {
        const formData = new FormData();
        // O corpo do evento virá em base64 pela Netlify
        const fileBuffer = Buffer.from(event.body, 'base64');
        
        // Extrai o tipo de conteúdo e nome do arquivo dos headers
        const contentType = event.headers['content-type'];
        const contentDisposition = event.headers['content-disposition'];
        const filenameMatch = contentDisposition && contentDisposition.match(/filename="(.+)"/);
        const filename = filenameMatch ? filenameMatch[1] : 'upload.dat';

        formData.append('file', fileBuffer, { filename, contentType });

        const response = await axios.post(fullUploadUrl, formData, {
            headers: {
                ...formData.getHeaders(),
                'xc-token': API_TOKEN,
            },
        });

        return {
            statusCode: 200,
            body: JSON.stringify(response.data)
        };
    } catch (error) {
        console.error("Erro na função de upload:", error.response ? error.response.data : error.message);
        return {
            statusCode: error.response ? error.response.status : 500,
            body: JSON.stringify({ error: 'Falha no upload do arquivo.' })
        };
    }
};