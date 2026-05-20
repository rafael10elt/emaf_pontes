document.addEventListener('DOMContentLoaded', function() {
    // --- ConfiguraÃ§Ã£o da API ---   
     
    // O token agora Ã© nulo no frontend, pois ele serÃ¡ adicionado no backend (Netlify Function)
    const API_TOKEN = null; 
    
    // A URL base agora Ã© vazia, pois faremos chamadas relativas para nossa prÃ³pria funÃ§Ã£o
    const NOCODB_BASE_URL = '';
    
    // O caminho do projeto agora aponta para a nossa funÃ§Ã£o proxy
    const NOCODB_PROJECT_PATH = '/.netlify/functions/api';

    // URL base do servidor NocoDB, usada apenas para carregar arquivos/imagens
    const NOCODB_HOST_URL = 'https://lumitechia-nocodb.aeenwc.easypanel.host';
    const LOGO_URL = 'images/ponteslogosfundo4.png';
    let reportLogoDataUrl = null;

    // --- VariÃ¡veis Globais de Dados ---
    let equipeData = [];
    let clientesData = [];
    let produtosData = [];
    let estoqueData = [];
    let producaoData = [];
    let loggedInUser = null;

    const STORAGE_KEYS = {
        user: 'loggedInUser',
        page: 'currentPage'
    };

    function saveSessionState(user) {
        const serialized = JSON.stringify(user);
        sessionStorage.setItem(STORAGE_KEYS.user, serialized);
        localStorage.setItem(STORAGE_KEYS.user, serialized);
    }

    function loadSessionUser() {
        return sessionStorage.getItem(STORAGE_KEYS.user) || localStorage.getItem(STORAGE_KEYS.user);
    }

    function saveCurrentPage(pageId) {
        sessionStorage.setItem(STORAGE_KEYS.page, pageId);
        localStorage.setItem(STORAGE_KEYS.page, pageId);
    }

    function loadCurrentPage() {
        return sessionStorage.getItem(STORAGE_KEYS.page) || localStorage.getItem(STORAGE_KEYS.page);
    }

    function clearSessionState() {
        sessionStorage.removeItem(STORAGE_KEYS.user);
        sessionStorage.removeItem(STORAGE_KEYS.page);
        localStorage.removeItem(STORAGE_KEYS.user);
        localStorage.removeItem(STORAGE_KEYS.page);
    }

    async function getReportLogoDataUrl() {
        if (reportLogoDataUrl) return reportLogoDataUrl;

        try {
            const response = await fetch(LOGO_URL);
            if (!response.ok) return null;

            const blob = await response.blob();
            reportLogoDataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            return reportLogoDataUrl;
        } catch (error) {
            console.warn('Não foi possível carregar o logo do relatório.', error);
            return null;
        }
    }
    // --- VariÃ¡veis de Estado da UI ---
let activeDeleteItem = { id: null, type: null, element: null };
let activeLoteProducao = null;
let activeProducaoItem = null;
let currentProducaoView = 'kanban';
let currentDashboardTab = 'estoque';

// Objeto para gerenciar as instÃ¢ncias dos grÃ¡ficos
const charts = {
    movimentacaoChart: null,
    topProdutosChart: null,
    topClientesChart: null,
    statusChart: null,
    recusasProdutoChart: null,
    producaoTempoChart: null,
    eficienciaProdutoChart: null,
    gargaloWipChart: null
};
    // --- Mapeamento de Nomes de Tabela ---
    const TABLE_NAME_MAP = {
        equipe: 'm8kxb95la3bq1u1',
        clientes: 'm3nzvi1j1wuddtv',
        produtos: 'mk8g5ipopo3t08i',
        estoque: 'm23cve24fkfq4fg',
        producao: 'm636w6ysa5pttmc'
    };
   const TODAS_ESTUFAS = ['A', 'B', 'C', 'D'];
   const TODOS_CONTAINERS = ['Container 1', 'Container 2', 'In Natura'];

    // --- Mapeamento de Nomes de Campos para RÃ³tulos AmigÃ¡veis ---
    const GLOBAL_LABEL_MAP = {
        nome: 'Nome',
        login: 'Login',
        senha: 'Senha',
        role: 'FunÃ§Ã£o',
        foto: 'Foto',
        cliente: 'Cliente',
        cnpj: 'CNPJ',
        razao_social: 'RazÃ£o Social',
        produto: 'Produto',
        emaf_equipe: 'ResponsÃ¡vel',
        emaf_clientes: 'Cliente',
        emaf_produto: 'Produto',
        emaf_estoque: 'Lote do Estoque',
        data: 'Data e Hora',
        lote: 'Lote',
        etiqueta: 'Foto da Etiqueta',
        quantidade: 'Quantidade (Kg)',
        container: 'Container',
        status: 'Status',
        observacao: 'ObservaÃ§Ã£o',
        foto_produto: 'Foto do Produto',
        foto_local: 'Foto do Local',
        foto_veiculo: 'Foto do VeÃ­culo',
        createdat: 'Criado em',
        updatedat: 'Alterado em',
        qtde_insumo: 'Qtd. Insumo (Kg)',
    qtde_final: 'Rendimento (kg)',
    lote_origem: 'Lote da MatÃ©ria-Prima',
    inicio_preparo: 'InÃ­cio do Preparo',
    inicio_producao: 'InÃ­cio da ProduÃ§Ã£o',
    finalizado: 'Finalizado em',
    estufa: 'Estufa',
    bandeja: 'Bandejas',
    lote_batelada: 'Lote Batelada',
    turno: 'Turno', 
    status_lote: 'Status do Lote'
    };

    // --- FunÃ§Ãµes de API e UtilitÃ¡rios ---
    function getTurno(date) {
    if (!date) return 'Indefinido'; // Retorna 'Indefinido' se a data for invÃ¡lida

    const dataObj = new Date(date);
    const hour = dataObj.getHours();
    
    // Turno Noturno: entre 18:00 e 04:59
    if (hour >= 18 || hour < 5) {
        return 'Noturno';
    } 
    // Todo o resto Ã© considerado Diurno
    else {
        return 'Diurno';
    }
}
    async function refreshCurrentView() {
    showLoadingOverlay('Atualizando dados...');
    await fetchAllData(); // Primeiro, busca os dados mais recentes do servidor.
    
    // Pega o ID da pÃ¡gina que estÃ¡ visÃ­vel no momento.
    const currentPageId = loadCurrentPage();

    // Com base na pÃ¡gina atual, chama a funÃ§Ã£o de renderizaÃ§Ã£o correspondente.
    switch (currentPageId) {
        case 'dashboard':
            updateDashboard();
            break;
        case 'estoque':
            applyAndRenderEstoque();
            break;
        case 'producao':
            applyAndRenderProducao();
            break;
        case 'equipe':
            applyAndRenderEquipe();
            break;
        case 'clientes':
            applyAndRenderClientes();
            break;
        case 'produtos':
            applyAndRenderProdutos();
            break;
    }
    hideLoadingOverlay();
}
    function showModal(modalElement) {
        modalElement?.classList.replace('hidden', 'flex');
    }

    function hideModal(modalElement) {
        modalElement?.classList.replace('flex', 'hidden');
    }
function formatCNPJ(cnpj) {
        if (!cnpj || typeof cnpj !== 'string') return 'Sem CNPJ';
        
        // Remove todos os caracteres que nÃ£o sÃ£o dÃ­gitos
        const cleaned = cnpj.replace(/\D/g, '');

        // Retorna o CNPJ original se nÃ£o tiver 14 dÃ­gitos
        if (cleaned.length !== 14) return cnpj;

        // Aplica a mÃ¡scara XX.XXX.XXX/XXXX-XX
        return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }

function formatTimestamp(isoString) {
    if (!isoString) return 'N/A';
    // Converte a data/hora para o fuso horÃ¡rio local e formata
    return new Date(isoString).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function calculateDuration(startISO, endISO) {
    if (!startISO || !endISO) return 'N/A';
    const start = new Date(startISO);
    const end = new Date(endISO);
    const diffMs = end - start; // DiferenÃ§a em milissegundos

    if (diffMs < 0) return 'InvÃ¡lido';

    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}min`;
}
    function showImageModal(src) {
        // Remove qualquer modal de imagem que jÃ¡ esteja aberto
        const existingModal = document.getElementById('image-zoom-modal');
        if (existingModal) {
            document.body.removeChild(existingModal);
        }

        // Cria o elemento de overlay (fundo escuro)
        const overlay = document.createElement('div');
        overlay.id = 'image-zoom-modal';
        overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-80 cursor-pointer modal-bg-animate';
        
        // Cria o elemento da imagem
        const img = document.createElement('img');
        img.src = src;
        img.className = 'max-w-[90vw] max-h-[90vh] object-contain';
        
        overlay.appendChild(img);
        
        // Adiciona um evento para fechar o modal ao clicar em qualquer lugar
        overlay.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
        
        document.body.appendChild(overlay);
    }
async function nocoFetch(endpoint, options = {}) {
    try {
        // Separa o endpoint do caminho e da query string
        const [path, query] = endpoint.split('?');
        
        // ConstrÃ³i a query string final
        let finalQuery = 'limit=2000';
        if (query) {
            finalQuery += `&${query}`;
        }
        
        // Monta a URL final corretamente
        const fullUrl = `${NOCODB_BASE_URL}${NOCODB_PROJECT_PATH}/${path}?${finalQuery}`;

        const response = await fetch(fullUrl, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });
        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = `HTTP ${response.status}: ${errorData.msg || response.statusText}`;
            throw new Error(errorMessage);
        }
        if (options.method === 'DELETE' || response.status === 204) {
            return { success: true };
        }
        return await response.json();
    } catch (error) {
        console.error(`Falha no fetch para ${endpoint}:`, error);
        alert(`Ocorreu um erro de comunicaÃ§Ã£o com o servidor. Verifique o console (F12) para mais detalhes.\n\nDetalhes: ${error.message}`);
        hideLoadingOverlay(); 
        return null;
    }
}
async function uploadFile(tableName, columnName, file) {
    // A URL agora aponta para nossa nova funÃ§Ã£o de upload, passando os parÃ¢metros na URL
    const uploadUrl = `/.netlify/functions/upload?tableName=${tableName}&columnName=${columnName}`;
    
    try {
        // Usamos fetch para enviar o arquivo para nossa prÃ³pria funÃ§Ã£o
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                // A funÃ§Ã£o backend precisa saber o nome e tipo do arquivo
                'Content-Type': file.type,
                'Content-Disposition': `attachment; filename="${file.name}"`
            },
            body: file 
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Falha no upload do arquivo: ${errorText}`);
        }
        
        const result = await response.json();
        return Array.isArray(result) ? result[0] : result;

    } catch (error) {
        console.error(`Erro no upload para ${tableName}/${columnName}:`, error);
        alert(`Ocorreu um erro ao enviar o arquivo. Detalhes: ${error.message}`);
        return null;
    }
}

    function showLoadingOverlay(message = 'Carregando...') {
        document.getElementById('loading-text').textContent = message;
        document.getElementById('loading-overlay').classList.remove('hidden');
    }

    function hideLoadingOverlay() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }

    function showModal(modalElement) {
        modalElement?.classList.replace('hidden', 'flex');
    }

    function hideModal(modalElement) {
        modalElement?.classList.replace('flex', 'hidden');
    }

function updateEstoqueDashboard() {
    // 1. Filtrar os dados
    const startDate = document.getElementById('dash-start-date').value;
    const endDate = document.getElementById('dash-end-date').value;
    const clienteId = document.getElementById('dash-cliente').value;
    const produtoId = document.getElementById('dash-produto').value;

    const filteredEstoqueAll = estoqueData.filter(item => 
        (!startDate || item.Data.slice(0, 10) >= startDate) &&
        (!endDate || item.Data.slice(0, 10) <= endDate) &&
        (!clienteId || item.Emaf_Clientes?.Id == clienteId) &&
        (!produtoId || item.Emaf_Produto?.Id == produtoId)
    );
    const filteredEstoqueRecebido = filteredEstoqueAll.filter(item => item.Status === 'Recebido');

    const filteredProducao = producaoData.filter(item => 
        (!startDate || (item.Inicio_Preparo && item.Inicio_Preparo.slice(0, 10) >= startDate)) &&
        (!endDate || (item.Inicio_Preparo && item.Inicio_Preparo.slice(0, 10) <= endDate)) &&
        (!clienteId || item.Emaf_Clientes?.Id == clienteId) &&
        (!produtoId || item.Emaf_Produto?.Id == produtoId)
    );
    
    // 2. Atualizar KPIs e GrÃ¡ficos
    updateEstoqueKPIs(filteredEstoqueRecebido, filteredProducao);
    updateMovimentacaoEstoqueChart(filteredEstoqueRecebido, filteredProducao);
    
    // 3. Tabelas e Rankings
    renderSaldoPorProdutoTable(filteredEstoqueRecebido, filteredProducao);
    
    // ======================= CHAMADAS DE FUNÃ‡ÃƒO ADICIONADAS AQUI =======================
    renderRecusasPorClienteRanking(filteredEstoqueAll);
    renderSaldoPorClienteRanking(filteredEstoqueRecebido, filteredProducao);
    // =================================================================================
}
function renderSaldoPorProdutoTable(entradas, saidas) {
    const container = document.getElementById('saldo-produto-table');
    if (!container) return;

    const byCompositeKey = {}; // A chave serÃ¡ "clienteId-produtoId"

    // FunÃ§Ã£o interna para processar tanto entradas quanto saÃ­das
    const processItem = (item, type) => {
        const cliente = item.Emaf_Clientes;
        const produto = item.Emaf_Produto;
        if (!cliente || !produto) return; // Ignora se nÃ£o tiver cliente ou produto

        const key = `${cliente.Id}-${produto.Id}`;
        if (!byCompositeKey[key]) {
            byCompositeKey[key] = {
                cliente: cliente.Cliente,
                produto: produto.Produto,
                recebido: 0,
                consumido: 0
            };
        }

        if (type === 'entrada') {
            byCompositeKey[key].recebido += item.Quantidade || 0;
        }
        if (type === 'saida') {
            byCompositeKey[key].consumido += item.Qtde_Insumo || 0;
        }
    };

    entradas.forEach(item => processItem(item, 'entrada'));
    saidas.forEach(item => processItem(item, 'saida'));

    // Ordena por nome do cliente e depois por nome do produto
    const sortedData = Object.values(byCompositeKey).sort((a, b) => {
        if (a.cliente < b.cliente) return -1;
        if (a.cliente > b.cliente) return 1;
        if (a.produto < b.produto) return -1;
        if (a.produto > b.produto) return 1;
        return 0;
    });

    let tableHTML = `<table class="w-full text-sm"><thead><tr class="border-b">
        <th class="p-2 text-left">Cliente</th>
        <th class="p-2 text-left">Produto</th>
        <th class="p-2 text-right">Total Recebido (Kg)</th>
        <th class="p-2 text-right">Total Consumido (Kg)</th>
        <th class="p-2 text-right font-bold">Saldo Atual (Kg)</th>
        </tr></thead><tbody>`;

    sortedData.forEach(row => {
        const saldo = row.recebido - row.consumido;
        tableHTML += `<tr class="border-b dark:border-gray-700">
            <td class="p-2 text-left font-semibold">${row.cliente}</td>
            <td class="p-2 text-left">${row.produto}</td>
            <td class="p-2 text-right">${row.recebido.toLocaleString('pt-BR')}</td>
            <td class="p-2 text-right">${row.consumido.toLocaleString('pt-BR')}</td>
            <td class="p-2 text-right font-bold">${saldo.toLocaleString('pt-BR')}</td>
        </tr>`;
    });
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}
function renderRecusasPorClienteRanking(entradas) {
    const container = document.getElementById('ranking-recusas-cliente');
    if (!container) return;

    const recusadoPorCliente = entradas
        .filter(item => item.Status === 'Recusado')
        .reduce((acc, item) => {
            const cliente = item.Emaf_Clientes?.Cliente || 'N/A';
            acc[cliente] = (acc[cliente] || 0) + (item.Quantidade || 0);
            return acc;
        }, {});
    
    const top5 = Object.entries(recusadoPorCliente)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    if (top5.length > 0) {
        let listHTML = '<div class="space-y-3">';
        top5.forEach(([cliente, total]) => {
            listHTML += `<div class="flex justify-between items-center text-sm">
                <span class="font-semibold">${cliente}</span>
                <span class="font-bold text-red-500">${total.toLocaleString('pt-BR')} Kg</span>
            </div>`;
        });
        listHTML += '</div>';
        container.innerHTML = listHTML;
    } else {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center">Nenhum material recusado no perÃ­odo.</p>';
    }
}

function renderSaldoPorClienteRanking(entradas, saidas) {
    const container = document.getElementById('ranking-saldo-cliente');
    if (!container) return;

    const saldos = {};
    entradas.forEach(item => {
        const cliente = item.Emaf_Clientes?.Cliente || 'N/A';
        saldos[cliente] = (saldos[cliente] || 0) + (item.Quantidade || 0);
    });
    saidas.forEach(item => {
        const cliente = item.Emaf_Clientes?.Cliente || 'N/A';
        saldos[cliente] = (saldos[cliente] || 0) - (item.Qtde_Insumo || 0);
    });

    const top5 = Object.entries(saldos)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    let listHTML = '<div class="space-y-3">';
    top5.forEach(([cliente, total]) => {
        listHTML += `<div class="flex justify-between items-center text-sm">
            <span class="font-semibold">${cliente}</span>
            <span class="font-bold text-blue-500">${total.toLocaleString('pt-BR')} Kg</span>
        </div>`;
    });
    listHTML += '</div>';
    container.innerHTML = listHTML;
}

function updateEstoqueKPIs(entradas, saidas) {
    const totalRecebido = entradas.reduce((sum, item) => sum + (item.Quantidade || 0), 0);
    const totalConsumido = saidas.reduce((sum, item) => sum + (item.Qtde_Insumo || 0), 0);
    const saldoAtual = totalRecebido - totalConsumido;
    const totalTransacoes = entradas.length + saidas.length;

    // Atualiza os elementos HTML dos KPIs (vocÃª precisarÃ¡ criar/ajustar os IDs no seu HTML)
    document.getElementById('kpi-total-recebido').textContent = totalRecebido.toLocaleString('pt-BR');
    document.getElementById('kpi-total-consumido').textContent = totalConsumido.toLocaleString('pt-BR'); // NOVO KPI
    document.getElementById('kpi-saldo-atual').textContent = saldoAtual.toLocaleString('pt-BR'); // NOVO KPI
    document.getElementById('kpi-total-transacoes').textContent = totalTransacoes;
}

function updateMovimentacaoEstoqueChart(entradas, saidas) {
    const ctx = document.getElementById('movimentacao-chart').getContext('2d');
    
    const movimentacao = {};

    entradas.forEach(item => {
        const date = item.Data.slice(0, 10);
        if (!movimentacao[date]) movimentacao[date] = { recebido: 0, consumido: 0 };
        movimentacao[date].recebido += (item.Quantidade || 0);
    });

    saidas.forEach(item => {
        const date = item.Inicio_Preparo.slice(0, 10);
        if (!movimentacao[date]) movimentacao[date] = { recebido: 0, consumido: 0 };
        movimentacao[date].consumido += (item.Qtde_Insumo || 0);
    });

    const sortedDates = Object.keys(movimentacao).sort();
    const chartData = {
        labels: sortedDates.map(d => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')),
        datasets: [
            { 
                label: 'Recebido (Kg)', 
                data: sortedDates.map(d => movimentacao[d].recebido), 
                backgroundColor: 'rgba(75, 192, 192, 0.6)', // Verde/Azul para entradas
                borderColor: 'rgba(75, 192, 192, 1)',
            },
            { 
                label: 'Consumido (Kg)', 
                data: sortedDates.map(d => movimentacao[d].consumido), 
                backgroundColor: 'rgba(255, 99, 132, 0.6)', // Vermelho para saÃ­das
                borderColor: 'rgba(255, 99, 132, 1)',
            }
        ]
    };
    createChart(ctx, 'bar', chartData, getChartDefaultOptions(), 'movimentacaoChart');
}

function renderSaldoPorProdutoTable(entradas, saidas) {
    const container = document.getElementById('saldo-produto-table');
    if (!container) return;

    const byCompositeKey = {}; // A chave serÃ¡ "clienteId-produtoId"

    const processItem = (item, type) => {
        const cliente = item.Emaf_Clientes;
        const produto = item.Emaf_Produto;
        if (!cliente || !produto) return;

        const key = `${cliente.Id}-${produto.Id}`;
        if (!byCompositeKey[key]) {
            byCompositeKey[key] = { cliente: cliente.Cliente, produto: produto.Produto, recebido: 0, consumido: 0 };
        }
        if (type === 'entrada') byCompositeKey[key].recebido += item.Quantidade || 0;
        if (type === 'saida') byCompositeKey[key].consumido += item.Qtde_Insumo || 0;
    };

    entradas.forEach(item => processItem(item, 'entrada'));
    saidas.forEach(item => processItem(item, 'saida'));
    
    const sortedData = Object.values(byCompositeKey).sort((a, b) => a.cliente.localeCompare(b.cliente) || a.produto.localeCompare(b.produto));

    if (sortedData.length > 0) {
        let tableHTML = `<table class="w-full text-sm"><thead><tr class="border-b">
            <th class="p-2 text-left">Cliente</th>
            <th class="p-2 text-left">Produto</th>
            <th class="p-2 text-right">Recebido (Kg)</th>
            <th class="p-2 text-right">Consumido (Kg)</th>
            <th class="p-2 text-right font-bold">Saldo (Kg)</th>
            </tr></thead><tbody>`;

        sortedData.forEach(row => {
            const saldo = row.recebido - row.consumido;
            tableHTML += `<tr class="border-b dark:border-gray-700">
                <td class="p-2 text-left font-semibold">${row.cliente}</td>
                <td class="p-2 text-left">${row.produto}</td>
                <td class="p-2 text-right">${row.recebido.toLocaleString('pt-BR')}</td>
                <td class="p-2 text-right">${row.consumido.toLocaleString('pt-BR')}</td>
                <td class="p-2 text-right font-bold">${saldo.toLocaleString('pt-BR')}</td>
            </tr>`;
        });
        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
    } else {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center">Nenhum saldo de estoque para exibir com os filtros atuais.</p>';
    }
}
function updateDashboard() {
    if (currentDashboardTab === 'estoque') {
        updateEstoqueDashboard();
    } else {
        updateProducaoDashboard();
    }
}
function updateProducaoDashboard() {
    const startDate = document.getElementById('dash-prod-start-date').value;
    const endDate = document.getElementById('dash-prod-end-date').value;
    const clienteId = document.getElementById('dash-prod-cliente').value;
    const produtoId = document.getElementById('dash-prod-produto').value;
    const responsavelId = document.getElementById('dash-prod-responsavel').value;

    const filteredData = producaoData.filter(item => {
        const itemDate = item.Inicio_Preparo ? item.Inicio_Preparo.slice(0, 10) : null;
        return (!startDate || (itemDate && itemDate >= startDate)) &&
               (!endDate || (itemDate && itemDate <= endDate)) &&
               (!clienteId || item.Emaf_Clientes?.Id == clienteId) &&
               (!produtoId || item.Emaf_Produto?.Id == produtoId) &&
               (!responsavelId || item.Emaf_Equipe?.Id == responsavelId);
    });

    // Chama todas as funÃ§Ãµes de renderizaÃ§Ã£o da aba
    updateProducaoKPIs(filteredData);
    updateProducaoTempoChart(filteredData);
    updateEficienciaProdutoChart(filteredData);
    updateGargaloWipChart(filteredData);
    renderPerformanceRecursosTable(filteredData);
    renderDetalhamentoProducaoTable(filteredData);

    // ======================= CHAMADAS DE FUNÃ‡ÃƒO ADICIONADAS AQUI =======================
    renderTopClientesProducao(filteredData);
    renderTempoMedioPorProduto(filteredData);
    renderMelhorRendimentoProduto(filteredData);
    // =================================================================================
}
function renderTopClientesProducao(data) {
    const container = document.getElementById('ranking-producao-cliente');
    if (!container) return;
    const porCliente = data.filter(d => d.Status === 'Finalizado').reduce((acc, item) => {
        const cliente = item.Emaf_Clientes?.Cliente || 'N/A';
        acc[cliente] = (acc[cliente] || 0) + (item.Qtde_Final || 0);
        return acc;
    }, {});
    const top5 = Object.entries(porCliente).sort(([,a],[,b]) => b - a).slice(0, 5);
    if (top5.length > 0) {
        let listHTML = '<div class="space-y-3">';
        top5.forEach(([cliente, total]) => {
            listHTML += `<div class="flex justify-between items-center text-sm">
                <span class="font-semibold">${cliente}</span>
                <span class="font-bold">${total.toLocaleString('pt-BR')} Kg</span>
            </div>`;
        });
        container.innerHTML = listHTML + '</div>';
    } else {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center">Nenhum pedido finalizado no perÃ­odo.</p>';
    }
}

function renderTempoMedioPorProduto(data) {
    const container = document.getElementById('ranking-tempo-produto');
    if (!container) return;
    const getDurationInMinutes = (start, end) => (new Date(end) - new Date(start)) / 60000;
    const porProduto = data.filter(d => d.Status === 'Finalizado' && d.Inicio_Preparo && d.Finalizado).reduce((acc, item) => {
        const produto = item.Emaf_Produto?.Produto || 'N/A';
        if (!acc[produto]) acc[produto] = { totalMinutos: 0, count: 0 };
        acc[produto].totalMinutos += getDurationInMinutes(item.Inicio_Preparo, item.Finalizado);
        acc[produto].count++;
        return acc;
    }, {});
    const avgTimes = Object.entries(porProduto).map(([produto, {totalMinutos, count}]) => ({
        produto, avg: totalMinutos / count
    })).sort((a,b) => a.avg - b.avg);
    if (avgTimes.length > 0) {
        let listHTML = '<div class="space-y-3">';
        avgTimes.forEach(({produto, avg}) => {
            const hours = Math.floor(avg / 60);
            const minutes = Math.round(avg % 60);
            listHTML += `<div class="flex justify-between items-center text-sm">
                <span class="font-semibold">${produto}</span>
                <span class="font-bold">${hours}h ${minutes}m</span>
            </div>`;
        });
        container.innerHTML = listHTML + '</div>';
    } else {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center">Nenhum pedido finalizado no perÃ­odo.</p>';
    }
}

function renderMelhorRendimentoProduto(data) {
    const container = document.getElementById('ranking-rendimento-produto');
    if (!container) return;
    const porProduto = data.filter(d => d.Status === 'Finalizado' && d.Qtde_Insumo > 0 && d.Qtde_Final > 0).reduce((acc, item) => {
        const produto = item.Emaf_Produto?.Produto || 'N/A';
        if (!acc[produto]) acc[produto] = { insumo: 0, final: 0 };
        acc[produto].insumo += item.Qtde_Insumo || 0;
        acc[produto].final += item.Qtde_Final || 0;
        return acc;
    }, {});
    const yields = Object.entries(porProduto).map(([produto, {insumo, final}]) => ({
        produto, rendimento: (final / insumo) * 100
    })).sort((a,b) => b.rendimento - a.rendimento).slice(0, 5);
    if (yields.length > 0) {
        let listHTML = '<div class="space-y-3">';
        yields.forEach(({produto, rendimento}) => {
            listHTML += `<div class="flex justify-between items-center text-sm">
                <span class="font-semibold">${produto}</span>
                <span class="font-bold text-green-500">${rendimento.toFixed(1)}%</span>
            </div>`;
        });
        container.innerHTML = listHTML + '</div>';
    } else {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center">Nenhum pedido com rendimento calculado.</p>';
    }
}
function updateProducaoKPIs(data) {
    const finalizados = data.filter(d => d.Status === 'Finalizado');
    
    // Total Produzido
    const totalProduzido = finalizados.reduce((sum, item) => sum + (item.Qtde_Final || 0), 0);
    document.getElementById('kpi-prod-total').textContent = totalProduzido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Pedidos Finalizados
    document.getElementById('kpi-prod-pedidos').textContent = finalizados.length;

    // Rendimento MÃ©dio
    const totalInsumo = finalizados.reduce((sum, item) => sum + (item.Qtde_Insumo || 0), 0);
    const rendimentoMedio = totalInsumo > 0 ? (totalProduzido / totalInsumo) * 100 : 0;
    document.getElementById('kpi-prod-rendimento').textContent = `${rendimentoMedio.toFixed(1)}%`;

    // Tempo MÃ©dio de Ciclo
    const getDurationInMinutes = (start, end) => (new Date(end) - new Date(start)) / 60000;
    const totalMinutos = finalizados.reduce((sum, item) => sum + getDurationInMinutes(item.Inicio_Preparo, item.Finalizado), 0);
    const tempoMedioMinutos = finalizados.length > 0 ? totalMinutos / finalizados.length : 0;
    const avgHours = Math.floor(tempoMedioMinutos / 60);
    const avgMinutes = Math.round(tempoMedioMinutos % 60);
    document.getElementById('kpi-prod-tempo-ciclo').textContent = `${avgHours}h ${avgMinutes}m`;

    // Pedidos em Andamento (WIP)
    const wip = data.filter(d => d.Status === 'Processamento' || d.Status === 'Em LiofilizaÃ§Ã£o').length;
    document.getElementById('kpi-prod-wip').textContent = wip;
}

function updateProducaoTempoChart(data) {
    const ctx = document.getElementById('producao-tempo-chart').getContext('2d');
    const finalizados = data.filter(d => d.Status === 'Finalizado');
    
    const byDate = finalizados.reduce((acc, item) => {
        const date = item.Finalizado.slice(0, 10);
        if (!acc[date]) acc[date] = { qtdFinal: 0, qtdInsumo: 0, count: 0 };
        acc[date].qtdFinal += item.Qtde_Final || 0;
        acc[date].qtdInsumo += item.Qtde_Insumo || 0;
        acc[date].count++;
        return acc;
    }, {});

    const sortedDates = Object.keys(byDate).sort();
    const chartData = {
        labels: sortedDates.map(d => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')),
        datasets: [
            {
                type: 'bar',
                label: 'Produzido (Kg)',
                data: sortedDates.map(d => byDate[d].qtdFinal),
                backgroundColor: 'rgba(54, 162, 235, 0.6)', // Azul para barras
                borderColor: 'rgba(54, 162, 235, 1)',
                yAxisID: 'y'
            },
            {
                type: 'line',
                label: 'Rendimento (%)',
                data: sortedDates.map(d => (byDate[d].qtdFinal / byDate[d].qtdInsumo) * 100),
                borderColor: 'rgba(255, 159, 64, 1)', // Laranja para a linha
                backgroundColor: 'rgba(255, 159, 64, 0.2)',
                tension: 0.3,
                yAxisID: 'y1'
            }
        ]
    };

    const options = { ...getChartDefaultOptions(), scales: { y: { position: 'left' }, y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false } } } };
    createChart(ctx, 'bar', chartData, options, 'producaoTempoChart');
}

function updateEficienciaProdutoChart(data) {
    const ctx = document.getElementById('eficiencia-produto-chart').getContext('2d');
    const finalizados = data.filter(d => d.Status === 'Finalizado' && d.Qtde_Insumo > 0 && d.Qtde_Final > 0 && d.Inicio_Preparo && d.Finalizado);
    const getDurationInHours = (start, end) => (new Date(end) - new Date(start)) / 3600000;

    // Agrupa os dados por produto para calcular as mÃ©dias
    const byProduto = finalizados.reduce((acc, item) => {
        const nome = item.Emaf_Produto?.Produto || 'N/A';
        if (!acc[nome]) {
            acc[nome] = { duracoes: [], rendimentos: [] };
        }
        acc[nome].duracoes.push(getDurationInHours(item.Inicio_Preparo, item.Finalizado));
        acc[nome].rendimentos.push((item.Qtde_Final / item.Qtde_Insumo) * 100);
        return acc;
    }, {});

    const produtos = Object.keys(byProduto);
    const avgRendimentos = produtos.map(p => byProduto[p].rendimentos.reduce((a, b) => a + b, 0) / byProduto[p].rendimentos.length);
    const avgDuracoes = produtos.map(p => byProduto[p].duracoes.reduce((a, b) => a + b, 0) / byProduto[p].duracoes.length);

    // Estrutura de dados para o novo grÃ¡fico de barras
    const chartData = {
        labels: produtos,
        datasets: [
            {
                label: 'Rendimento MÃ©dio (%)',
                data: avgRendimentos,
                backgroundColor: 'rgba(16, 185, 129, 0.6)', // Verde
                borderColor: 'rgba(16, 185, 129, 1)',
                yAxisID: 'yRendimento',
                borderWidth: 1
            },
            {
                label: 'Tempo MÃ©dio de Ciclo (Horas)',
                data: avgDuracoes,
                backgroundColor: 'rgba(245, 158, 11, 0.6)', // Laranja/Ambar
                borderColor: 'rgba(245, 158, 11, 1)',
                yAxisID: 'yTempo',
                borderWidth: 1
            }
        ]
    };

    // OpÃ§Ãµes do grÃ¡fico, incluindo dois eixos Y para escalas diferentes
    const options = { 
        ...getChartDefaultOptions(), 
        scales: { 
            // Eixo Y para o Rendimento (Ã  esquerda)
            yRendimento: { 
                type: 'linear', 
                display: true, 
                position: 'left',
                title: {
                    display: true,
                    text: 'Rendimento (%)',
                    color: 'rgba(16, 185, 129, 1)'
                },
                ticks: {
                    color: 'rgba(16, 185, 129, 1)',
                    callback: value => value.toFixed(1) + '%'
                }
            },
            // Eixo Y para o Tempo (Ã  direita)
            yTempo: {
                type: 'linear', 
                display: true, 
                position: 'right',
                title: {
                    display: true,
                    text: 'Tempo (Horas)',
                    color: 'rgba(245, 158, 11, 1)'
                },
                ticks: {
                    color: 'rgba(245, 158, 11, 1)',
                    callback: value => value.toFixed(1) + 'h'
                },
                grid: {
                    drawOnChartArea: false // Evita linhas de grade sobrepostas
                }
            }
        },
        plugins: {
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += context.parsed.y.toFixed(2);
                            if (context.dataset.yAxisID === 'yRendimento') {
                                label += '%';
                            } else {
                                label += ' horas';
                            }
                        }
                        return label;
                    }
                }
            }
        }
    };

    // Cria o novo grÃ¡fico
    createChart(ctx, 'bar', chartData, options, 'eficienciaProdutoChart');
}

function updateGargaloWipChart(data) {
    const ctx = document.getElementById('gargalo-wip-chart').getContext('2d');
    const wip = data.filter(d => d.Status === 'Processamento' || d.Status === 'Em LiofilizaÃ§Ã£o');
    
    const counts = {
        'Processamento': wip.filter(d => d.Status === 'Processamento').length,
        'Em LiofilizaÃ§Ã£o': wip.filter(d => d.Status === 'Em LiofilizaÃ§Ã£o').length,
    };
    
    const chartData = {
        labels: Object.keys(counts),
        datasets: [{ data: Object.values(counts), backgroundColor: ['#F59E0B', '#3B82F6'] }]
    };
    const options = { ...getChartDefaultOptions(), indexAxis: 'y', plugins: { legend: { display: false } } };
    createChart(ctx, 'bar', chartData, options, 'gargaloWipChart');
}

function renderPerformanceRecursosTable(data) {
    const container = document.getElementById('performance-recursos-table');
    const responsaveis = [...new Set(data.map(d => d.Emaf_Equipe?.Nome || 'N/A'))];
    const estufas = ['A', 'B', 'C', 'D'];

    const pivotData = responsaveis.map(r => {
        const row = { responsavel: r };
        estufas.forEach(e => {
            row[e] = data.filter(d => d.Emaf_Equipe?.Nome === r && d.Estufa == e).length;
        });
        return row;
    });

    let tableHTML = `<table class="w-full text-sm text-center"><thead><tr class="border-b">
        <th class="p-2 text-left">ResponsÃ¡vel</th>`;
    estufas.forEach(e => tableHTML += `<th class="p-2">Estufa ${e}</th>`);
    tableHTML += `</tr></thead><tbody>`;

    pivotData.forEach(row => {
        tableHTML += `<tr class="border-b dark:border-gray-700">
            <td class="p-2 text-left font-semibold">${row.responsavel}</td>`;
        estufas.forEach(e => {
            const count = row[e];
            const bgColor = count > 0 ? `bg-blue-${Math.min(count * 100 + 100, 700)}` : '';
            const textColor = count > 2 ? 'text-white' : '';
            tableHTML += `<td class="p-2 ${bgColor} ${textColor}">${count}</td>`;
        });
        tableHTML += `</tr>`;
    });
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

function renderDetalhamentoProducaoTable(data) {
    const tbody = document.getElementById('detalhamento-producao-tbody');
    const finalizados = data.filter(d => d.Status === 'Finalizado').sort((a,b) => new Date(b.Finalizado) - new Date(a.Finalizado));

    tbody.innerHTML = '';
    finalizados.forEach(item => {
        const rendimento = (item.Qtde_Final / item.Qtde_Insumo) * 100;
        let rendimentoClass = 'text-gray-500';
        if (rendimento > 15) rendimentoClass = 'text-green-500'; // Ex: > 15% Ã© bom
        if (rendimento < 10) rendimentoClass = 'text-red-500';   // Ex: < 10% Ã© ruim

        tbody.innerHTML += `<tr class="border-b dark:border-gray-700">
            <td class="px-4 py-2 font-semibold">${item.Emaf_Produto?.Produto || 'N/A'}</td>
            <td class="px-4 py-2">${item.Emaf_Clientes?.Cliente || 'N/A'}</td>
            <td class="px-4 py-2">${formatTimestamp(item.Finalizado)}</td>
            <td class="px-4 py-2 text-right">${(item.Qtde_Insumo || 0).toLocaleString('pt-BR')}</td>
            <td class="px-4 py-2 text-right">${(item.Qtde_Final || 0).toLocaleString('pt-BR')}</td>
            <td class="px-4 py-2 text-right font-bold ${rendimentoClass}">${rendimento.toFixed(1)}%</td>
            <td class="px-4 py-2 text-right">${calculateDuration(item.Inicio_Preparo, item.Finalizado)}</td>
        </tr>`;
    });
}

    function updateKPIs(data) {
        const formatKg = (num) => Number(num || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        const recebido = data.filter(d => d.Status === 'Recebido').reduce((sum, item) => sum + (item.Quantidade || 0), 0);
        const recusado = data.filter(d => d.Status === 'Recusado').reduce((sum, item) => sum + (item.Quantidade || 0), 0);
        const total = recebido + recusado;
        const taxaRecusa = total > 0 ? (recusado / total) * 100 : 0;
        const totalTransacoes = data.length;
        const ticketMedio = totalTransacoes > 0 ? data.reduce((sum, item) => sum + (item.Quantidade || 0), 0) / totalTransacoes : 0;

        document.getElementById('kpi-total-recebido').textContent = formatKg(recebido);
        document.getElementById('kpi-total-recusado').textContent = formatKg(recusado);
        document.getElementById('kpi-taxa-recusa').textContent = `${taxaRecusa.toFixed(1)}%`;
        document.getElementById('kpi-total-transacoes').textContent = totalTransacoes;
        document.getElementById('kpi-ticket-medio').textContent = formatKg(ticketMedio);
    }

function createChart(ctx, type, data, options, chartVarName) {
        // Agora verificamos e destruÃ­mos usando o objeto 'charts'
        if (charts[chartVarName]) {
            charts[chartVarName].destroy();
        }
        // E atribuÃ­mos a nova instÃ¢ncia ao objeto 'charts'
        charts[chartVarName] = new Chart(ctx, { type, data, options });
    }

function getChartDefaultOptions() {
    const isDark = document.body.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    // CORRIGIDO: Usando um cinza escuro para melhor contraste
    const labelColor = isDark ? '#e5e7eb' : '#374151'; 
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
            legend: { 
                labels: { 
                    color: labelColor,
                    // Adiciona um box colorido na legenda
                    usePointStyle: true, 
                    pointStyle: 'rect'
                } 
            } 
        },
        scales: {
            x: { ticks: { color: labelColor }, grid: { color: gridColor } },
            y: { ticks: { color: labelColor }, grid: { color: gridColor } }
        }
    };
}

function updateMovimentacaoChart(data) {
        const ctx = document.getElementById('movimentacao-chart');
        
        // VerificaÃ§Ã£o de seguranÃ§a: se o canvas nÃ£o for encontrado, nÃ£o faz nada.
        if (!ctx) {
            console.error("Elemento canvas 'movimentacao-chart' nÃ£o encontrado.");
            return; 
        }
        
        const context = ctx.getContext('2d');

        const movimentacao = data.reduce((acc, item) => {
            const date = item.Data.slice(0, 10);
            if (!acc[date]) acc[date] = { recebido: 0, recusado: 0 };
            if (item.Status === 'Recebido') acc[date].recebido += (item.Quantidade || 0);
            if (item.Status === 'Recusado') acc[date].recusado += (item.Quantidade || 0);
            return acc;
        }, {});

        const sortedDates = Object.keys(movimentacao).sort();
        const chartData = {
            labels: sortedDates.map(d => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')),
            datasets: [
                { 
                    label: 'Recebido (Kg)', 
                    data: sortedDates.map(d => movimentacao[d].recebido), 
                    backgroundColor: 'rgba(16, 185, 129, 0.5)', 
                    borderColor: '#10B981', 
                    fill: true, 
                    tension: 0.3 
                },
                { 
                    label: 'Recusado (Kg)', 
                    data: sortedDates.map(d => movimentacao[d].recusado), 
                    backgroundColor: 'rgba(239, 68, 68, 0.5)', 
                    borderColor: '#EF4444', 
                    fill: true, 
                    tension: 0.3 
                }
            ]
        };
        createChart(context, 'line', chartData, getChartDefaultOptions(), 'movimentacaoChart');
    }

    function updateTopProdutosChart(data) {
        const ctx = document.getElementById('top-produtos-chart').getContext('2d');
        const byProduto = data.filter(d => d.Status === 'Recebido').reduce((acc, item) => {
            const nome = item.Emaf_Produto?.Produto || 'Desconhecido';
            acc[nome] = (acc[nome] || 0) + (item.Quantidade || 0);
            return acc;
        }, {});
        const top5 = Object.entries(byProduto).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const chartData = {
            labels: top5.map(p => p[0]),
            datasets: [{ label: 'Quantidade (Kg)', data: top5.map(p => p[1]), backgroundColor: '#BFA16A' }]
        };
        const options = { ...getChartDefaultOptions(), indexAxis: 'y', plugins: { legend: { display: false } } };
        createChart(ctx, 'bar', chartData, options, 'topProdutosChart');
    }

    function updateTopClientesChart(data) {
        const ctx = document.getElementById('top-clientes-chart').getContext('2d');
        const byCliente = data.filter(d => d.Status === 'Recebido').reduce((acc, item) => {
            const nome = item.Emaf_Clientes?.Cliente || 'Desconhecido';
            acc[nome] = (acc[nome] || 0) + (item.Quantidade || 0);
            return acc;
        }, {});
        const top5 = Object.entries(byCliente).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const chartData = {
            labels: top5.map(c => c[0]),
            datasets: [{ label: 'Quantidade (Kg)', data: top5.map(c => c[1]), backgroundColor: '#373737' }]
        };
        const options = { ...getChartDefaultOptions(), indexAxis: 'y', plugins: { legend: { display: false } } };
        createChart(ctx, 'bar', chartData, options, 'topClientesChart');
    }

    function updateStatusChart(data) {
        const ctx = document.getElementById('status-chart').getContext('2d');
        const statusData = data.reduce((acc, item) => {
            const status = item.Status || 'N/A';
            acc[status] = (acc[status] || 0) + (item.Quantidade || 0);
            return acc;
        }, {});
        const chartData = {
            labels: Object.keys(statusData),
            datasets: [{
                data: Object.values(statusData),
                backgroundColor: ['#10B981', '#EF4444', '#F59E0B', '#3B82F6'],
            }]
        };
        const options = { ...getChartDefaultOptions(), scales: { x: { display: false }, y: { display: false } } };
        createChart(ctx, 'doughnut', chartData, options, 'statusChart');
    }
    
    function updateRecusasProdutoChart(data) {
        const ctx = document.getElementById('recusas-produto-chart').getContext('2d');
        const byProduto = data.filter(d => d.Status === 'Recusado').reduce((acc, item) => {
            const nome = item.Emaf_Produto?.Produto || 'Desconhecido';
            acc[nome] = (acc[nome] || 0) + (item.Quantidade || 0);
            return acc;
        }, {});
        const sorted = Object.entries(byProduto).sort((a, b) => b[1] - a[1]);
        const chartData = {
            labels: sorted.map(p => p[0]),
            datasets: [{ label: 'Recusado (Kg)', data: sorted.map(p => p[1]), backgroundColor: '#EF4444' }]
        };
        const options = { ...getChartDefaultOptions(), indexAxis: 'y', plugins: { legend: { display: false } } };
        createChart(ctx, 'bar', chartData, options, 'recusasProdutoChart');
    }
    // --- FunÃ§Ãµes de Carregamento de Dados ---
async function fetchAllData() {
    showLoadingOverlay('Carregando dados do sistema...');
    await Promise.all([
        fetchEquipe(),
        fetchClientes(),
        fetchProdutos(),
        fetchEstoque(),
        fetchProducao()
    ]);
    
    // Apenas preenche os selects que sÃ£o usados em vÃ¡rias telas
    populateSelects(); 
    
    // As funÃ§Ãµes de renderizaÃ§Ã£o foram movidas para a funÃ§Ã£o navigateTo()
    hideLoadingOverlay();
}

    async function fetchEquipe() {
        const result = await nocoFetch(`${TABLE_NAME_MAP.equipe}?nested[all]=true`);
        equipeData = (result && result.list) ? result.list.sort((a, b) => a.Nome.localeCompare(b.Nome)) : [];
    }
    async function fetchClientes() {
        const result = await nocoFetch(TABLE_NAME_MAP.clientes);
        clientesData = (result && result.list) ? result.list.sort((a, b) => a.Cliente.localeCompare(b.Cliente)) : [];
    }
    async function fetchProdutos() {
        const result = await nocoFetch(TABLE_NAME_MAP.produtos);
        produtosData = (result && result.list) ? result.list.sort((a, b) => a.Produto.localeCompare(b.Produto)) : [];
    }
    async function fetchEstoque() {
        const result = await nocoFetch(`${TABLE_NAME_MAP.estoque}?nested[all]=true`);
        estoqueData = (result && result.list) ? result.list.sort((a, b) => new Date(b.Data) - new Date(a.Data)) : [];
    }
    async function fetchProducao() {
        // Usamos nested[all]=true para jÃ¡ trazer os dados das tabelas relacionadas (cliente, produto, etc.)
        const result = await nocoFetch(`${TABLE_NAME_MAP.producao}?nested[all]=true&fields=*`);
        producaoData = (result && result.list) ? result.list : [];
    }

    // --- AutenticaÃ§Ã£o e SessÃ£o ---
    // --- AutenticaÃ§Ã£o e SessÃ£o ---
    async function handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        if (!username || !password) return alert('Por favor, preencha usuÃ¡rio e senha.');

        showLoadingOverlay('Autenticando...');
        
        // Use o ID da tabela de equipe
        const endpoint = `${TABLE_NAME_MAP.equipe}?where=(Login,eq,${username})~and(Senha,eq,${password})`;
        const result = await nocoFetch(endpoint);
        
        hideLoadingOverlay();

        if (result && result.list && result.list.length > 0) {
            const user = result.list[0];
            saveSessionState(user);
            await initializeUserSession(user);
        } else {
            alert('UsuÃ¡rio ou senha invÃ¡lidos.');
        }
    }
    
async function initializeUserSession(user) {
    loggedInUser = user;
    const userRole = loggedInUser.Role;

    // --- 1. Preenche informaÃ§Ãµes do usuÃ¡rio no header ---
    document.getElementById('logged-user-name').textContent = loggedInUser.Nome;
    document.getElementById('logged-user-role').textContent = userRole;

    const userAvatar = document.querySelector('#main-app header img');
    if (userAvatar && loggedInUser.Foto && loggedInUser.Foto.length > 0 && loggedInUser.Foto[0]?.signedPath) {
        userAvatar.src = `${NOCODB_HOST_URL}/${loggedInUser.Foto[0].signedPath}`;
    } else {
        userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(loggedInUser.Nome)}&background=BFA16A&color=fff`;
    }

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');

    // --- 2. LÃ³gica de PermissÃµes ---
    // Reseta a visibilidade para o padrÃ£o (tudo visÃ­vel)
    document.querySelectorAll('.nav-link').forEach(link => link.style.display = 'flex');
    document.querySelectorAll('#show-equipe-form, #show-clientes-form, #show-produtos-form, #show-estoque-form, #show-producao-form').forEach(btn => btn.style.display = 'block');
    document.getElementById('toggle-list-view').style.display = 'block';
    document.getElementById('toggle-kanban-view').style.display = 'block';
    document.getElementById('generate-producao-report').style.display = 'block';
    
    // Esconde o Dashboard e o botÃ£o de RelatÃ³rio para todos, exceto Admin
    if (userRole !== 'Admin') {
        document.querySelector('.nav-link[data-target="dashboard"]').style.display = 'none';
        document.getElementById('generate-producao-report').style.display = 'none';
    }

    // RestriÃ§Ãµes para GestÃ£o
    if (userRole === 'GestÃ£o') {
        // Gestor nÃ£o vÃª a aba de Equipe
        document.querySelector('.nav-link[data-target="equipe"]').style.display = 'none';
        document.getElementById('show-equipe-form').style.display = 'none';
    } 
    // RestriÃ§Ãµes para ProduÃ§Ã£o
    else if (userRole === 'ProduÃ§Ã£o') {
        // Esconde abas de navegaÃ§Ã£o
        document.querySelector('.nav-link[data-target="equipe"]').style.display = 'none';
        document.querySelector('.nav-link[data-target="clientes"]').style.display = 'none';
        document.querySelector('.nav-link[data-target="produtos"]').style.display = 'none';

        // Esconde botÃµes de criaÃ§Ã£o que nÃ£o sÃ£o de sua responsabilidade
        document.getElementById('show-equipe-form').style.display = 'none';
        document.getElementById('show-clientes-form').style.display = 'none';
        document.getElementById('show-produtos-form').style.display = 'none';
        
        // Na tela de ProduÃ§Ã£o, esconde os botÃµes de alternar visÃ£o
        document.getElementById('toggle-list-view').style.display = 'none';
        document.getElementById('toggle-kanban-view').style.display = 'none';
        
        // ForÃ§a a visualizaÃ§Ã£o para Kanban
        currentProducaoView = 'kanban';
        document.getElementById('producao-kanban-container').classList.remove('hidden');
        document.getElementById('producao-list-container').classList.add('hidden');
    }

    // --- 3. Carrega dados e navega para a pÃ¡gina inicial ---
    await fetchAllData();
    
    // Define a pÃ¡gina inicial: Dashboard para Admin, Estoque para os outros
    const initialPage = loadCurrentPage() || (userRole === 'Admin' ? 'dashboard' : 'estoque');
    navigateTo(initialPage);
}

    async function checkSession() {
        const userString = loadSessionUser();
        if (userString) {
            await initializeUserSession(JSON.parse(userString));
        }
    }

    // --- FunÃ§Ãµes de NavegaÃ§Ã£o e UI ---
 function navigateTo(targetId) {
    document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));
    const targetPage = document.getElementById(targetId);
    if (targetPage) {
        targetPage.classList.remove('hidden');

        // Chama a funÃ§Ã£o de renderizaÃ§Ã£o correta para a pÃ¡gina que estÃ¡ sendo exibida
        switch (targetId) {
            case 'dashboard':
                // O timeout ajuda a garantir que a pÃ¡gina esteja visÃ­vel antes de desenhar os grÃ¡ficos
                syncDashboardTabUI();
                setTimeout(updateDashboard, 50); 
                break;
            case 'estoque':
                applyAndRenderEstoque();
                break;
            case 'producao':
                applyAndRenderProducao();
                break;
            case 'equipe':
                applyAndRenderEquipe();
                break;
            case 'clientes':
                applyAndRenderClientes();
                break;
            case 'produtos':
                applyAndRenderProdutos();
                break;
        }
    }
    
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.remove('bg-brand-gold', 'text-white');
        l.classList.add('text-gray-400', 'hover:bg-brand-gold', 'hover:text-white');
    });
    const navLink = document.querySelector(`.nav-link[data-target="${targetId}"]`);
    navLink?.classList.add('bg-brand-gold', 'text-white');
    navLink?.classList.remove('text-gray-400');
    saveCurrentPage(targetId);
}

function syncDashboardTabUI() {
    const tabs = document.querySelectorAll('.dashboard-tab');
    tabs.forEach(tab => {
        tab.classList.remove('text-brand-gold', 'border-brand-gold', 'border-transparent', 'hover:text-gray-600', 'hover:border-gray-300');
        tab.classList.add('border-transparent', 'hover:text-gray-600', 'hover:border-gray-300');
    });

    const activeTab = document.querySelector(`.dashboard-tab[data-tab="${currentDashboardTab}"]`);
    activeTab?.classList.add('text-brand-gold', 'border-brand-gold');
    activeTab?.classList.remove('border-transparent');

    document.querySelectorAll('.dashboard-tab-content').forEach(content => content.classList.add('hidden'));
    document.getElementById(`dashboard-${currentDashboardTab}-content`)?.classList.remove('hidden');
}
    
    function toggleMobileSidebar() {
        document.getElementById('sidebar').classList.toggle('-translate-x-full');
        document.getElementById('sidebar-overlay').classList.toggle('hidden');
    }
    function toggleRecusadoFields() {
        const statusSelect = document.getElementById('estoque-Status');
        const fotosContainer = document.getElementById('recusado-fotos-container');
        const fotoProdutoInput = document.getElementById('estoque-Foto_Produto');
        const fotoLocalInput = document.getElementById('estoque-Foto_Local');
        const fotoVeiculoInput = document.getElementById('estoque-Foto_Veiculo');
        const etiquetaInput = document.getElementById('estoque-Etiqueta');
        
        // Etiqueta Ã© sempre obrigatÃ³ria na criaÃ§Ã£o, mas nÃ£o na ediÃ§Ã£o se jÃ¡ existir
        const estoqueId = document.getElementById('estoque-Id').value;
        const currentItem = estoqueId ? estoqueData.find(d => d.Id == estoqueId) : null;
        etiquetaInput.required = !currentItem || !(currentItem.Etiqueta && currentItem.Etiqueta.length > 0);

        if (statusSelect.value === 'Recusado') {
            fotosContainer.classList.remove('hidden');
            // Torna obrigatÃ³rio apenas se nÃ£o estiver editando um item que jÃ¡ tem a foto
            fotoProdutoInput.required = !currentItem || !(currentItem.Foto_Produto && currentItem.Foto_Produto.length > 0);
            fotoLocalInput.required = !currentItem || !(currentItem.Foto_Local && currentItem.Foto_Local.length > 0);
            fotoVeiculoInput.required = !currentItem || !(currentItem.Foto_Veiculo && currentItem.Foto_Veiculo.length > 0);
        } else {
            fotosContainer.classList.add('hidden');
            fotoProdutoInput.required = false;
            fotoLocalInput.required = false;
            fotoVeiculoInput.required = false;
        }
    }
    function populateSelects() {
        const createOptions = (data, valueField, textField, defaultText) => {
            let options = `<option value="">${defaultText}</option>`;
            data.forEach(item => {
                options += `<option value="${item[valueField]}">${item[textField]}</option>`;
            });
            return options;
        };

        document.querySelectorAll('.equipe-select').forEach(el => el.innerHTML = createOptions(equipeData, 'Id', 'Nome', 'Todos'));
        document.querySelectorAll('.cliente-select').forEach(el => el.innerHTML = createOptions(clientesData, 'Id', 'Cliente', 'Todos'));
        document.querySelectorAll('.produto-select').forEach(el => el.innerHTML = createOptions(produtosData, 'Id', 'Produto', 'Todos'));
    }

    // --- RenderizaÃ§Ã£o de ConteÃºdo ---
    function applyAndRenderEquipe() {
        const searchTerm = document.getElementById('equipe-search').value.toLowerCase();
        const filtered = equipeData.filter(e => e.Nome.toLowerCase().includes(searchTerm));
        renderCards('equipe', filtered);
    }
    function applyAndRenderClientes() {
        const searchTerm = document.getElementById('clientes-search').value.toLowerCase();
        const filtered = clientesData.filter(c => c.Cliente.toLowerCase().includes(searchTerm));
        renderCards('clientes', filtered);
    }
    function applyAndRenderProdutos() {
        const searchTerm = document.getElementById('produtos-search').value.toLowerCase();
        const filtered = produtosData.filter(p => p.Produto.toLowerCase().includes(searchTerm));
        renderCards('produtos', filtered);
    }
   function applyAndRenderEstoque() {
        const startDate = document.getElementById('filter-estoque-start-date').value;
        const endDate = document.getElementById('filter-estoque-end-date').value;
        const clienteId = document.getElementById('filter-estoque-cliente').value;
        const produtoId = document.getElementById('filter-estoque-produto').value;
        const status = document.getElementById('filter-estoque-status').value;
        const lote = document.getElementById('filter-estoque-lote').value.toLowerCase();
        const container = document.getElementById('filter-estoque-container').value;

        const filtered = estoqueData.filter(item => 
            (!startDate || item.Data.slice(0, 10) >= startDate) &&
            (!endDate || item.Data.slice(0, 10) <= endDate) &&
            (!clienteId || item.Emaf_Clientes?.Id == clienteId) &&
            (!produtoId || item.Emaf_Produto?.Id == produtoId) &&
            (!status || item.Status === status) &&
            (!lote || (item.Lote || '').toLowerCase().includes(lote)) &&
            (!container || item.Container === container)
        );
        renderEstoque(filtered);
    }

    function renderCards(type, data) {
        const container = document.getElementById(`${type}-cards-container`);
        if (!container) return;
        container.innerHTML = data.map(item => createGenericCard(type, item)).join('');
    }

    function createGenericCard(type, item) {
        let title, subtitle, fotoUrl;
        switch(type) {
            case 'equipe':
                title = item.Nome;
                subtitle = item.Role;
                fotoUrl = (item.Foto && item.Foto[0]?.signedPath) ? `${NOCODB_HOST_URL}/${item.Foto[0].signedPath}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(item.Nome)}&background=BFA16A&color=fff`;
                break;
            case 'clientes':
                title = item.Cliente;
                subtitle = formatCNPJ(item.Cnpj);
                fotoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.Cliente)}&background=BFA16A&color=fff`;
                break;
            case 'produtos':
                title = item.Produto;
                subtitle = `ID: ${item.Id}`;
                fotoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.Produto)}&background=373737&color=fff`;
                break;
        }

        const isGestaoOrAdmin = ['Admin', 'GestÃ£o'].includes(loggedInUser.Role);
        const actionsHTML = isGestaoOrAdmin ? `
            <button class="action-btn text-blue-500 hover:text-blue-700" data-action="edit" title="Editar"><i class="fas fa-edit"></i></button>
            <button class="action-btn text-red-500 hover:text-red-700" data-action="delete" title="Apagar"><i class="fas fa-trash"></i></button>
        ` : '';

        return `
            <div class="generic-card bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col items-center text-center" data-id="${item.Id}" data-type="${type}">
                <img src="${fotoUrl}" class="w-24 h-24 rounded-full object-cover mb-4">
                <h4 class="font-bold text-lg text-gray-800 dark:text-white">${title}</h4>
                <p class="text-sm text-gray-500 dark:text-gray-400">${subtitle}</p>
                <div class="flex space-x-4 mt-auto pt-4">
                    ${type !== 'equipe' ? '<button class="action-btn text-gray-500 hover:text-gray-700" data-action="details" title="Ver Detalhes"><i class="fas fa-eye"></i></button>' : ''}
                    ${actionsHTML}
                </div>
            </div>`;
    }

function renderEstoque(data) {
    const tbody = document.getElementById('estoque-table-body');
    const cardsContainer = document.getElementById('estoque-cards-container');
    tbody.innerHTML = '';
    cardsContainer.innerHTML = '';
    const getStatusClass = (status) => status === 'Recebido' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800';
    
    const formatQuantity = (qty) => {
        if (qty === null || typeof qty === 'undefined') return '0,00';
        return Number(qty).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 5 });
    };

    // NOVO: Permite que Admin E GestÃ£o gerenciem o estoque
    const canManageEstoque = ['Admin', 'GestÃ£o'].includes(loggedInUser.Role);

    data.forEach(item => {
        const statusClass = getStatusClass(item.Status);
        const dataFormatada = item.Data ? new Date(item.Data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short'}) : 'N/A';
        
        // Calcular Saldo
        // Filtra os registros de produÃ§Ã£o que usaram este lote especÃ­fico de estoque
        const consumos = producaoData.filter(p => p.Emaf_Estoque && p.Emaf_Estoque.Id === item.Id);
        // Soma a quantidade de insumo utilizada em todas as produÃ§Ãµes
        const totalConsumido = consumos.reduce((sum, prod) => sum + (prod.Qtde_Insumo || 0), 0);
        // Calcula o saldo
        const saldo = (item.Quantidade || 0) - totalConsumido;
        
        // Define uma cor para o saldo (opcional, mas Ãºtil visualmente)
        let saldoClass = 'text-gray-900 dark:text-white';
        if (saldo <= 0) saldoClass = 'text-red-600 dark:text-red-400 font-bold';
        else if (saldo < (item.Quantidade * 0.2)) saldoClass = 'text-yellow-600 dark:text-yellow-400 font-bold'; // Alerta de estoque baixo (< 20%)

        // A lÃ³gica de construÃ§Ã£o dos botÃµes agora usa a nova variÃ¡vel 'canManageEstoque'
        const actionsHTML = `
            <button class="action-btn text-gray-500" data-action="details" title="Ver Detalhes"><i class="fas fa-eye"></i></button>
            ${canManageEstoque ? `
            <button class="action-btn text-blue-500" data-action="edit" title="Editar"><i class="fas fa-edit"></i></button>
            <button class="action-btn text-red-500" data-action="delete" title="Apagar"><i class="fas fa-trash"></i></button>
            ` : ''}
        `;
        
        // Tabela
        tbody.innerHTML += `
            <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700" data-id="${item.Id}" data-type="estoque">
                <td class="px-6 py-4">${dataFormatada}</td>
                <td class="px-6 py-4">${item.Emaf_Clientes?.Cliente || 'N/A'}</td>
                <td class="px-6 py-4">${item.Emaf_Equipe?.Nome || 'N/A'}</td>
                <td class="px-6 py-4">${item.Emaf_Produto?.Produto || 'N/A'}</td>
                <td class="px-6 py-4">${item.Lote || 'N/A'}</td>
                <td class="px-6 py-4">${item.Container || 'N/A'}</td>
                <td class="px-6 py-4 text-right">${formatQuantity(item.Quantidade)}</td>
                <td class="px-6 py-4 text-right ${saldoClass}">${formatQuantity(saldo)}</td> <td class="px-6 py-4"><span class="text-xs font-semibold px-2 py-0.5 rounded-full ${statusClass}">${item.Status}</span></td>
                <td class="px-6 py-4 space-x-2 text-center">${actionsHTML}</td>
            </tr>`;

        // Cards (Atualizando tambÃ©m o card para mostrar o saldo)
        cardsContainer.innerHTML += `
            <div class="p-4 bg-white rounded-lg shadow dark:bg-gray-800 border dark:border-gray-700" data-id="${item.Id}" data-type="estoque">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="text-lg font-semibold text-gray-900 dark:text-white">${item.Emaf_Produto?.Produto || 'N/A'}</p>
                        <p class="text-xs text-gray-500">${dataFormatada}</p>
                    </div>
                    <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${statusClass}">${item.Status}</span>
                </div>
                <div class="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <p><strong>Cliente:</strong> ${item.Emaf_Clientes?.Cliente || 'N/A'}</p>
                    <p><strong>ResponsÃ¡vel:</strong> ${item.Emaf_Equipe?.Nome || 'N/A'}</p>
                    <p><strong>Lote:</strong> ${item.Lote || 'N/A'} | <strong>Container:</strong> ${item.Container || 'N/A'}</p>
                    <div class="flex justify-between border-t border-b border-gray-100 dark:border-gray-700 py-1 mt-1">
                        <p><strong>Qtde Inicial:</strong> ${formatQuantity(item.Quantidade)} Kg</p>
                        <p class="${saldoClass}"><strong>Saldo:</strong> ${formatQuantity(saldo)} Kg</p>
                    </div>
                </div>
                <div class="flex justify-end pt-2 mt-2 border-t dark:border-gray-600 space-x-2">${actionsHTML}</div>
            </div>`;
    });
}

function createProducaoCard(item) {
    const formatQuantity = (qty) => Number(qty || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let actionButtonHTML = '';
    let crudButtonsHTML = '';
    let detailsHTML = ''; // VariÃ¡vel para os detalhes incrementais

    // NOVO: Define se o usuÃ¡rio pode gerenciar (editar/apagar)
    const canManageProducao = ['Admin', 'GestÃ£o'].includes(loggedInUser.Role);

    // --- LÃ³gica dos BotÃµes de AÃ§Ã£o (AvanÃ§ar Etapa) ---
    if (item.Status === 'Processamento') {
        actionButtonHTML = `<button class="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded transition-colors action-btn-producao" data-action="start-liofilizacao" data-id="${item.Id}">
                                <i class="fas fa-industry mr-2"></i>Carregar Estufa
                            </button>`;
    } else if (item.Status === 'Em LiofilizaÃ§Ã£o') { 
        actionButtonHTML = `<button class="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition-colors action-btn-producao" data-action="finish-producao" data-id="${item.Id}">
                                <i class="fas fa-check-circle mr-2"></i>Finalizar ProduÃ§Ã£o
                            </button>`;
    } else if (item.Status === 'Finalizado' && (!item.Qtde_Final || item.Qtde_Final <= 0)) {
        actionButtonHTML = `<button class="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition-colors action-btn-producao" data-action="add-qtd-final" data-id="${item.Id}">
                                <i class="fas fa-balance-scale-right mr-2"></i>Informar Rendimento (kg)
                            </button>`;
    }

    // --- LÃ³gica dos BotÃµes CRUD (Editar/Apagar) com base na permissÃ£o ---
    if (canManageProducao && item.Status === 'Processamento') {
        crudButtonsHTML = `
            <button class="action-btn-producao-crud text-blue-500 hover:text-blue-700" data-action="edit" data-id="${item.Id}" title="Editar"><i class="fas fa-edit"></i></button>
            <button class="action-btn-producao-crud text-red-500 hover:text-red-700" data-action="delete" data-id="${item.Id}" title="Apagar"><i class="fas fa-trash"></i></button>
        `;
    }

    // --- LÃ³gica Incremental dos Detalhes (sem alteraÃ§Ãµes) ---
    if (item.Inicio_Preparo) {
        detailsHTML += `<p><i class="far fa-clock w-4 text-gray-400"></i> Preparo: <span class="font-medium text-gray-800 dark:text-gray-200">${formatTimestamp(item.Inicio_Preparo)}</span></p>`;
    }
    if (item.Inicio_Producao) {
        detailsHTML += `<p><i class="fas fa-industry w-4 text-gray-400"></i> ProduÃ§Ã£o: <span class="font-medium text-gray-800 dark:text-gray-200">${formatTimestamp(item.Inicio_Producao)}</span></p>`;
        detailsHTML += `<p><i class="fas fa-tag w-4 text-gray-400"></i> Lote Batelada: <span class="font-medium text-gray-800 dark:text-gray-200">${item.Lote_Batelada || 'N/A'}</span></p>`;
        detailsHTML += `<p><i class="fas fa-sun w-4 text-gray-400"></i> Turno: <span class="font-medium text-gray-800 dark:text-gray-200">${item.Turno || 'N/A'}</span></p>`;
        detailsHTML += `<p><i class="fas fa-thermometer-half w-4 text-gray-400"></i> Estufa: <span class="font-medium text-gray-800 dark:text-gray-200">${item.Estufa}</span> | Bandejas: <span class="font-medium text-gray-800 dark:text-gray-200">${item.Bandeja}</span></p>`;
    }
    if (item.Finalizado) {
        detailsHTML += `<p><i class="far fa-check-circle w-4 text-gray-400"></i> Finalizado: <span class="font-medium text-gray-800 dark:text-gray-200">${formatTimestamp(item.Finalizado)}</span></p>`;
        detailsHTML += `<p><i class="fas fa-hourglass-half w-4 text-gray-400"></i> DuraÃ§Ã£o Total: <span class="font-bold text-blue-500">${calculateDuration(item.Inicio_Preparo, item.Finalizado)}</span></p>`;
        
        if (item.Qtde_Final > 0) {
             detailsHTML += `<p><i class="fas fa-balance-scale-right w-4 text-gray-400"></i> Rendimento(KG): <span class="font-bold text-green-600 dark:text-green-400">${formatQuantity(item.Qtde_Final)} Kg</span></p>`;
        } else {
             detailsHTML += `<p class="text-yellow-600 dark:text-yellow-400 font-semibold mt-2"><i class="fas fa-exclamation-triangle w-4"></i> Pendente: Informar Quantidade Final</p>`;
        }
    }

    // --- Template Final do Card ---
    return `
        <div class="bg-white dark:bg-gray-700 rounded-lg shadow-md p-4 border-l-4 border-brand-gold" data-id="${item.Id}">
            <div class="flex justify-between items-start mb-2">
                <h4 class="font-bold text-gray-900 dark:text-white pr-2">${item.Emaf_Clientes?.Cliente || 'N/A'}</h4>
                <div class="flex items-center space-x-2 flex-shrink-0">
                    <span class="text-xs text-gray-500 dark:text-gray-400">#${String(item.Id).padStart(4, '0')}</span>
                    ${crudButtonsHTML}
                </div>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-3">${item.Emaf_Produto?.Produto || 'N/A'}</p>
            <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-3">
                <p><i class="fas fa-box w-4"></i> Lote do Estoque: <span class="font-medium text-gray-800 dark:text-gray-200">${item.Emaf_Estoque?.Lote || 'N/A'}</span></p>
                <p><i class="fas fa-weight-hanging w-4"></i> Insumo: <span class="font-medium text-gray-800 dark:text-gray-200">${formatQuantity(item.Qtde_Insumo)} Kg</span></p>
                <p><i class="fas fa-user w-4"></i> ResponsÃ¡vel: <span class="font-medium text-gray-800 dark:text-gray-200">${item.Emaf_Equipe?.Nome || 'N/A'}</span></p>
            </div>
            ${detailsHTML ? `<div class="text-xs text-gray-500 dark:text-gray-400 space-y-1 py-3 border-t border-b border-gray-200 dark:border-gray-600 my-3">${detailsHTML}</div>` : ''}
            ${actionButtonHTML ? `<div class="pt-2">${actionButtonHTML}</div>` : ''}
        </div>
    `;
}

// FunÃ§Ã£o que aplica os filtros e decide qual view renderizar

function getFilteredProducaoData() {
    // 1. Obter os valores de todos os filtros
    const startDate = document.getElementById('filter-producao-start-date').value;
    const endDate = document.getElementById('filter-producao-end-date').value;
    const clienteId = document.getElementById('filter-producao-cliente').value;
    const lote = document.getElementById('filter-producao-lote').value.toLowerCase();
    const responsavelId = document.getElementById('filter-producao-responsavel').value;
    const estufa = document.getElementById('filter-producao-estufa').value;
    const status = document.getElementById('filter-producao-status').value;
    const turno = document.getElementById('filter-producao-turno').value;

    // 2. Filtrar o array de dados principal
    const filteredData = producaoData.filter(item => {
        const itemDate = item.Inicio_Preparo ? item.Inicio_Preparo.slice(0, 10) : null;

        const dateMatch = (!startDate || (itemDate && itemDate >= startDate)) && 
                          (!endDate || (itemDate && itemDate <= endDate));
        
        const clienteMatch = !clienteId || item.Emaf_Clientes?.Id == clienteId;
        const loteMatch = !lote || (item.Lote_Batelada || '').toLowerCase().includes(lote);
        const responsavelMatch = !responsavelId || item.Emaf_Equipe?.Id == responsavelId;
        const estufaMatch = !estufa || item.Estufa == estufa;
        const statusMatch = !status || item.Status === status;
        const turnoMatch = !turno || item.Turno === turno;

        return dateMatch && clienteMatch && loteMatch && responsavelMatch && estufaMatch && statusMatch && turnoMatch;
    });
    return filteredData;
}

function applyAndRenderProducao() {
    const filteredData = getFilteredProducaoData();
    // Renderiza a visualizaÃ§Ã£o correta
    if (currentProducaoView === 'kanban') {
        renderProducaoKanban(filteredData);
    } else {
        renderProducaoList(filteredData);
    }
}
// FunÃ§Ã£o para alternar entre as visualizaÃ§Ãµes
function toggleProducaoView(view) {
    if (view === currentProducaoView) return;
    currentProducaoView = view;

    const kanbanContainer = document.getElementById('producao-kanban-container');
    const listContainer = document.getElementById('producao-list-container');
    const kanbanBtn = document.getElementById('toggle-kanban-view');
    const listBtn = document.getElementById('toggle-list-view');

    if (view === 'kanban') {
        kanbanContainer.classList.remove('hidden');
        listContainer.classList.add('hidden');
        kanbanBtn.classList.add('bg-brand-gold', 'text-white');
        listBtn.classList.remove('bg-brand-gold', 'text-white');
    } else {
        kanbanContainer.classList.add('hidden');
        listContainer.classList.remove('hidden');
        listBtn.classList.add('bg-brand-gold', 'text-white');
        kanbanBtn.classList.remove('bg-brand-gold', 'text-white');
    }
    applyAndRenderProducao();
}
function renderProducaoKanban(data) {
    const columns = {
        preparo: document.getElementById('kanban-column-preparo'),
        producao: document.getElementById('kanban-column-producao'),
        finalizado: document.getElementById('kanban-column-finalizado')
    };

    // Limpa as colunas antes de renderizar
    Object.values(columns).forEach(col => col.innerHTML = '');

    // 1. SEPARAR os dados por status
    const preparoItems = data.filter(item => item.Status === 'Processamento');
    const producaoItems = data.filter(item => item.Status === 'Em LiofilizaÃ§Ã£o');
    const finalizadoItems = data.filter(item => item.Status === 'Finalizado');

    // 2. ORDENAR cada lista de acordo com suas regras especÃ­ficas
    // Processamento: Do mais antigo para o mais novo (ascendente)
    preparoItems.sort((a, b) => new Date(a.Inicio_Preparo) - new Date(b.Inicio_Preparo));
    
    // Em LiofilizaÃ§Ã£o: Do mais antigo para o mais novo (ascendente)
    producaoItems.sort((a, b) => new Date(a.Inicio_Producao) - new Date(b.Inicio_Producao));

    // Finalizado: Do mais novo para o mais antigo (descendente)
    finalizadoItems.sort((a, b) => new Date(b.Finalizado) - new Date(a.Finalizado));

    // 3. RENDERIZAR os itens jÃ¡ ordenados em suas respectivas colunas
    preparoItems.forEach(item => {
        columns.preparo.innerHTML += createProducaoCard(item);
    });
    producaoItems.forEach(item => {
        columns.producao.innerHTML += createProducaoCard(item);
    });
    finalizadoItems.forEach(item => {
        columns.finalizado.innerHTML += createProducaoCard(item);
    });

    // 4. ATUALIZAR os contadores no cabeÃ§alho das colunas
    document.getElementById('count-preparo').textContent = preparoItems.length;
    document.getElementById('count-producao').textContent = producaoItems.length;
    document.getElementById('count-finalizado').textContent = finalizadoItems.length;
}

async function generateProducaoPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'pt', 'a4'); // 'l' para paisagem (landscape), 'p' para retrato
    const filteredData = getFilteredProducaoData();

    // --- 1. VALIDAÃ‡ÃƒO ---
    const startDate = document.getElementById('filter-producao-start-date').value;
    const endDate = document.getElementById('filter-producao-end-date').value;
    if (!startDate || !endDate) {
        alert('Por favor, selecione um perÃ­odo (data de inÃ­cio e fim) para gerar o relatÃ³rio.');
        return;
    }
    if (filteredData.length === 0) {
        alert('Nenhum dado encontrado para os filtros selecionados.');
        return;
    }

    // --- 2. CABEÃ‡ALHO DO DOCUMENTO ---
    const reportLogo = await getReportLogoDataUrl();
    if (reportLogo) {
        doc.addImage(reportLogo, 'PNG', 40, 40, 120, 38);
    }
    doc.setFontSize(22);
    doc.text('RelatÃ³rio de ProduÃ§Ã£o', doc.internal.pageSize.getWidth() / 2, 60, { align: 'center' });
    
    doc.setFontSize(10);
    const periodo = `${new Date(startDate+'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(endDate+'T00:00:00').toLocaleDateString('pt-BR')}`;
    doc.text(`PerÃ­odo: ${periodo}`, 40, 110);
    
    let startY = 130;

    // --- 3. LÃ“GICA DE AGRUPAMENTO E DESENHO ---
    const responsavelId = document.getElementById('filter-producao-responsavel').value;
    const estufa = document.getElementById('filter-producao-estufa').value;
    const status = document.getElementById('filter-producao-status').value;

    const drawTableForGroup = (data, groupTitle) => {
        if (data.length === 0) return;

        if (startY > 130) startY += 20;

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(groupTitle, 40, startY);
        startY += 20;

        // ======================= COLUNAS ATUALIZADAS =======================
        const head = [['ID', 'Status', 'Cliente', 'Produto', 'Lote', 'Insumo (Kg)', 'Final (Kg)', 'Preparo', 'ProduÃ§Ã£o', 'Finalizado', 'DuraÃ§Ã£o', 'Estufa', 'Bandejas', 'ResponsÃ¡vel']];
        
        const body = data.map(item => [
            String(item.Id).padStart(4, '0'),
            item.Status || 'N/A',
            item.Emaf_Clientes?.Cliente || 'N/A',
            item.Emaf_Produto?.Produto || 'N/A',
            item.Emaf_Estoque?.Lote || 'N/A',
            item.Qtde_Insumo ? item.Qtde_Insumo.toLocaleString('pt-BR') : 'N/A',
            item.Qtde_Final ? item.Qtde_Final.toLocaleString('pt-BR') : 'N/A',
            formatTimestamp(item.Inicio_Preparo),
            formatTimestamp(item.Inicio_Producao),
            formatTimestamp(item.Finalizado),
            calculateDuration(item.Inicio_Preparo, item.Finalizado),
            item.Estufa || 'N/A',
            item.Bandeja || 'N/A',
            item.Emaf_Equipe?.Nome || 'N/A'
        ]);
        // ====================================================================

        doc.autoTable({
            head, body, startY,
            theme: 'grid',
            headStyles: { fillColor: [55, 55, 55] },
            styles: { fontSize: 8 }, // Diminui o tamanho da fonte para caber mais colunas
            didDrawPage: (data) => {
                doc.setFontSize(10);
                doc.text('PÃ¡gina ' + doc.internal.getNumberOfPages(), data.settings.margin.left, doc.internal.pageSize.getHeight() - 30);
            }
        });
        startY = doc.autoTable.previous.finalY;
    };

    // --- 4. ESCOLHA DA ESTRATÃ‰GIA DE AGRUPAMENTO (sem alteraÃ§Ãµes) ---
    if (responsavelId) {
        const responsavelName = document.getElementById('filter-producao-responsavel').selectedOptions[0]?.text;
        drawTableForGroup(filteredData, `ResponsÃ¡vel: ${responsavelName}`);
    } else if (estufa) {
        drawTableForGroup(filteredData, `Estufa: ${estufa}`);
    } else if (status) {
        drawTableForGroup(filteredData, `Status: ${status}`);
    } else {
        const statuses = ['Processamento', 'Em LiofilizaÃ§Ã£o', 'Finalizado'];
        statuses.forEach(s => {
            const dataByStatus = filteredData.filter(item => item.Status === s);
            if (dataByStatus.length > 0) {
                const estufasInStatus = [...new Set(dataByStatus.map(item => item.Estufa || 'N/A'))];
                estufasInStatus.forEach(e => {
                    const dataByEstufa = dataByStatus.filter(item => (item.Estufa || 'N/A') === e);
                    if (dataByEstufa.length > 0) {
                        const responsaveisInEstufa = [...new Set(dataByEstufa.map(item => item.Emaf_Equipe?.Nome || 'N/A'))];
                        responsaveisInEstufa.forEach(r => {
                            const dataByResponsavel = dataByEstufa.filter(item => (item.Emaf_Equipe?.Nome || 'N/A') === r);
                            if (dataByResponsavel.length > 0) {
                                let groupTitle = `Status: ${s} | Estufa: ${e} | ResponsÃ¡vel: ${r}`;
                                drawTableForGroup(dataByResponsavel, groupTitle);
                            }
                        });
                    }
                });
            }
        });
    }

    // --- 5. SALVAR O PDF ---
    doc.save(`relatorio_producao_${new Date().toISOString().slice(0,10)}.pdf`);
}
function createProducaoCard(item) {
    const formatQuantity = (qty) => Number(qty || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let actionButtonHTML = '';
    let crudButtonsHTML = '';
    let detailsHTML = ''; // VariÃ¡vel para os detalhes incrementais

    // --- LÃ³gica dos BotÃµes de AÃ§Ã£o ---
    if (item.Status === 'Processamento') {
        actionButtonHTML = `<button class="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded transition-colors action-btn-producao" data-action="start-liofilizacao" data-id="${item.Id}">
                                <i class="fas fa-industry mr-2"></i>Carregar Estufa
                            </button>`;
    } else if (item.Status === 'Em LiofilizaÃ§Ã£o') { 
        actionButtonHTML = `<button class="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition-colors action-btn-producao" data-action="finish-producao" data-id="${item.Id}">
                                <i class="fas fa-check-circle mr-2"></i>Finalizar ProduÃ§Ã£o
                            </button>`;
    } else if (item.Status === 'Finalizado' && (!item.Qtde_Final || item.Qtde_Final <= 0)) {
        // BotÃ£o para adicionar a quantidade final, se pendente
        actionButtonHTML = `<button class="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition-colors action-btn-producao" data-action="add-qtd-final" data-id="${item.Id}">
                                <i class="fas fa-balance-scale-right mr-2"></i>Informar Rendimento (kg)
                            </button>`;
    }

    // --- LÃ³gica dos BotÃµes CRUD (Editar/Apagar) ---
    if (item.Status === 'Processamento') {
        crudButtonsHTML = `
            <button class="action-btn-producao-crud text-blue-500 hover:text-blue-700" data-action="edit" data-id="${item.Id}" title="Editar"><i class="fas fa-edit"></i></button>
            <button class="action-btn-producao-crud text-red-500 hover:text-red-700" data-action="delete" data-id="${item.Id}" title="Apagar"><i class="fas fa-trash"></i></button>
        `;
    }

    // --- LÃ³gica Incremental dos Detalhes ---
    if (item.Inicio_Preparo) {
        detailsHTML += `<p><i class="far fa-clock w-4 text-gray-400"></i> Preparo: <span class="font-medium text-gray-800 dark:text-gray-200">${formatTimestamp(item.Inicio_Preparo)}</span></p>`;
    }
    if (item.Inicio_Producao) {
        detailsHTML += `<p><i class="fas fa-industry w-4 text-gray-400"></i> ProduÃ§Ã£o: <span class="font-medium text-gray-800 dark:text-gray-200">${formatTimestamp(item.Inicio_Producao)}</span></p>`;
        detailsHTML += `<p><i class="fas fa-tag w-4 text-gray-400"></i> Lote Batelada: <span class="font-medium text-gray-800 dark:text-gray-200">${item.Lote_Batelada || 'N/A'}</span></p>`;
        detailsHTML += `<p><i class="fas fa-sun w-4 text-gray-400"></i> Turno: <span class="font-medium text-gray-800 dark:text-gray-200">${item.Turno || 'N/A'}</span></p>`;
        detailsHTML += `<p><i class="fas fa-thermometer-half w-4 text-gray-400"></i> Estufa: <span class="font-medium text-gray-800 dark:text-gray-200">${item.Estufa}</span> | Bandejas: <span class="font-medium text-gray-800 dark:text-gray-200">${item.Bandeja}</span></p>`;
    }
    if (item.Finalizado) {
        detailsHTML += `<p><i class="far fa-check-circle w-4 text-gray-400"></i> Finalizado: <span class="font-medium text-gray-800 dark:text-gray-200">${formatTimestamp(item.Finalizado)}</span></p>`;
        detailsHTML += `<p><i class="fas fa-hourglass-half w-4 text-gray-400"></i> DuraÃ§Ã£o Total: <span class="font-bold text-blue-500">${calculateDuration(item.Inicio_Preparo, item.Finalizado)}</span></p>`;
        
        // Exibe a quantidade final ou o status de pendente
        if (item.Qtde_Final > 0) {
             detailsHTML += `<p><i class="fas fa-balance-scale-right w-4 text-gray-400"></i> Rendimento (kg): <span class="font-bold text-green-600 dark:text-green-400">${formatQuantity(item.Qtde_Final)} Kg</span></p>`;
        } else {
             detailsHTML += `<p class="text-yellow-600 dark:text-yellow-400 font-semibold mt-2"><i class="fas fa-exclamation-triangle w-4"></i> Pendente: Informar Quantidade Final</p>`;
        }
    }

    // --- Template Final do Card ---
    return `
        <div class="bg-white dark:bg-gray-700 rounded-lg shadow-md p-4 border-l-4 border-brand-gold" data-id="${item.Id}">
            <div class="flex justify-between items-start mb-2">
                <h4 class="font-bold text-gray-900 dark:text-white pr-2">${item.Emaf_Clientes?.Cliente || 'N/A'}</h4>
                <div class="flex items-center space-x-2 flex-shrink-0">
                    <span class="text-xs text-gray-500 dark:text-gray-400">#${String(item.Id).padStart(4, '0')}</span>
                    ${crudButtonsHTML}
                </div>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-3">${item.Emaf_Produto?.Produto || 'N/A'}</p>
            <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-3">
                <p><i class="fas fa-box w-4"></i> Lote do Estoque: <span class="font-medium text-gray-800 dark:text-gray-200">${item.Emaf_Estoque?.Lote || 'N/A'}</span></p>
                <p><i class="fas fa-weight-hanging w-4"></i> Insumo: <span class="font-medium text-gray-800 dark:text-gray-200">${formatQuantity(item.Qtde_Insumo)} Kg</span></p>
                <p><i class="fas fa-user w-4"></i> ResponsÃ¡vel: <span class="font-medium text-gray-800 dark:text-gray-200">${item.Emaf_Equipe?.Nome || 'N/A'}</span></p>
            </div>
            ${detailsHTML ? `<div class="text-xs text-gray-500 dark:text-gray-400 space-y-1 py-3 border-t border-b border-gray-200 dark:border-gray-600 my-3">${detailsHTML}</div>` : ''}
            ${actionButtonHTML ? `<div class="pt-2">${actionButtonHTML}</div>` : ''}
        </div>
    `;
}
function renderProducaoList(data) {
    const tbody = document.getElementById('producao-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const getStatusClass = (status) => {
        switch (status) {
            case 'Processamento': return 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-100';
            case 'Em LiofilizaÃ§Ã£o': return 'bg-yellow-200 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100';
            case 'Finalizado': return 'bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100';
            default: return 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-100';
        }
    };

    const statusPriority = { 'Processamento': 1, 'Em LiofilizaÃ§Ã£o': 2, 'Finalizado': 3 };

    const sortedData = [...data].sort((a, b) => {
        const priorityA = statusPriority[a.Status] || 99;
        const priorityB = statusPriority[b.Status] || 99;
        if (priorityA !== priorityB) return priorityA - priorityB;
        switch (a.Status) {
            case 'Processamento': return (a.Inicio_Preparo && b.Inicio_Preparo) ? new Date(a.Inicio_Preparo) - new Date(b.Inicio_Preparo) : 0;
            case 'Em LiofilizaÃ§Ã£o': return (a.Inicio_Producao && b.Inicio_Producao) ? new Date(a.Inicio_Producao) - new Date(b.Inicio_Producao) : 0;
            case 'Finalizado': return (a.Finalizado && b.Finalizado) ? new Date(b.Finalizado) - new Date(a.Finalizado) : 0;
            default: return 0;
        }
    });

    const thead = document.querySelector('#producao-list-container thead tr');
    if (thead) {
        thead.innerHTML = `
            <th scope="col" class="px-6 py-3">Status</th>
            <th scope="col" class="px-6 py-3">Cliente / Produto</th>
            <th scope="col" class="px-6 py-3">Lote Estoque</th>
            <th scope="col" class="px-6 py-3">Lote Batelada</th>
            <th scope="col" class="px-6 py-3">InÃ­cio Preparo</th>
            <th scope="col" class="px-6 py-3">InÃ­cio ProduÃ§Ã£o</th>
            <th scope="col" class="px-6 py-3">Finalizado</th>
            <th scope="col" class="px-6 py-3">ResponsÃ¡vel / Turno</th>
            <th scope="col" class="px-6 py-3">AÃ§Ãµes</th>
        `;
    }

    if (sortedData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-gray-500 dark:text-gray-400">Nenhum registro encontrado.</td></tr>`;
        return;
    }

    // NOVO: Define se o usuÃ¡rio pode gerenciar (editar/apagar)
    const canManageProducao = ['Admin', 'GestÃ£o'].includes(loggedInUser.Role);

    sortedData.forEach(item => {
        let actionsHTML = `<button class="action-btn text-gray-500" data-action="details" data-type="producao" title="Ver Detalhes"><i class="fas fa-eye"></i></button>`;
        
        // Permite editar/excluir apenas se estiver em Processamento e tiver a permissÃ£o
        if (item.Status === 'Processamento' && canManageProducao) {
            actionsHTML += `
                <button class="action-btn-producao-crud text-blue-500" data-action="edit" data-id="${item.Id}" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="action-btn-producao-crud text-red-500" data-action="delete" data-id="${item.Id}" title="Apagar"><i class="fas fa-trash"></i></button>
            `;
        }

        tbody.innerHTML += `
            <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600" data-id="${item.Id}" data-type="producao">
                <td class="px-6 py-4 whitespace-nowrap"><span class="text-xs font-semibold px-2 py-0.5 rounded-full ${getStatusClass(item.Status)}">${item.Status || 'N/A'}</span></td>
                <td class="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    ${item.Emaf_Clientes?.Cliente || 'N/A'}<br>
                    <span class="text-xs text-gray-500 dark:text-gray-400">${item.Emaf_Produto?.Produto || 'N/A'}</span>
                </td>
                <td class="px-6 py-4">${item.Emaf_Estoque?.Lote || 'N/A'}</td>
                <td class="px-6 py-4">${item.Lote_Batelada || 'N/A'}</td>                
                <td class="px-6 py-4">${formatTimestamp(item.Inicio_Preparo)}</td>
                <td class="px-6 py-4">${formatTimestamp(item.Inicio_Producao)}</td>
                <td class="px-6 py-4">${formatTimestamp(item.Finalizado)}</td>
                <td class="px-6 py-4">
                    ${item.Emaf_Equipe?.Nome || 'N/A'}<br>
                    <span class="text-xs text-gray-500 dark:text-gray-400">${item.Turno || 'N/A'}</span>
                </td>
                <td class="px-6 py-4 space-x-2 whitespace-nowrap">${actionsHTML}</td>
            </tr>
        `;
    });
}
// =================================================================================
    // --- ManipulaÃ§Ã£o de FormulÃ¡rios e Modais ---
    
    // FunÃ§Ã£o para controlar a visibilidade da lista e do formulÃ¡rio
    function setupFormAndListVisibility(type, showForm) {
        const listContainer = document.getElementById(`${type}-list-container`);
        const formContainer = document.getElementById(`${type}-form-container`);

        if (showForm) {
            listContainer.classList.add('hidden');
            formContainer.classList.remove('hidden');
        } else {
            listContainer.classList.remove('hidden');
            formContainer.classList.add('hidden');
        }
    }
async function handleQtdFinalFormSubmit(e) {
    e.preventDefault();
    if (!activeProducaoItem) return;

    const form = e.target;
    const userInput = form.querySelector('#qtd-final-input').value;
    const sanitizedValue = userInput.replace(/\./g, '').replace(',', '.');
    const finalQuantity = parseFloat(sanitizedValue);

    if (isNaN(finalQuantity) || finalQuantity <= 0) {
        alert('Valor invÃ¡lido. Por favor, insira um nÃºmero positivo.');
        return;
    }

    showLoadingOverlay('Salvando...');
    const result = await nocoFetch(`${TABLE_NAME_MAP.producao}/${activeProducaoItem.Id}`, {
        method: 'PATCH',
        body: JSON.stringify({ Qtde_Final: finalQuantity })
    });
    
    if (result) {
        hideModal(document.getElementById('qtd-final-modal'));
        await refreshCurrentView(); // Atualiza os dados e redesenha a tela
    }
    
    hideLoadingOverlay();
}

function setupForm(type, id = null) {
    setupFormAndListVisibility(type, true);

    const form = document.getElementById(`${type}-form`);
    const title = document.getElementById(`${type}-form-title`);
    form.reset();
    form.querySelectorAll('img[id$="-preview"]').forEach(img => {
        img.src = "https://placehold.co/100x100/e2e8f0/cbd5e0?text=Foto";
        if (!img.classList.contains('hidden')) {
            img.classList.add('hidden');
        }
    });
    
    document.getElementById(`${type}-Id`).value = id || '';
    title.textContent = id ? `Editar ${capitalize(type)}` : `Novo ${capitalize(type)}`;
    
    const item = id ? { equipe: equipeData, clientes: clientesData, produtos: produtosData, estoque: estoqueData }[type].find(d => d.Id == id) : null;

// --- LÃ“GICA DE CONTAINER (SEM TRAVA) ---
    if (type === 'estoque') {
        const containerSelect = form.querySelector('#estoque-Container');
        
        // Popula o select com TODOS os containers disponÃ­veis, sem filtrar os ocupados
        let optionsHTML = '<option value="">Selecione</option>';
        TODOS_CONTAINERS.forEach(c => {
            optionsHTML += `<option value="${c}">${c}</option>`;
        });
        containerSelect.innerHTML = optionsHTML;
    }

    if (item) {
        populateForm(form, item);
    } else {
         if(type === 'estoque') {
            const dataInput = form.querySelector('#estoque-Data');
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            dataInput.value = now.toISOString().slice(0, 16);
            form.querySelector('#estoque-Emaf_Equipe').value = loggedInUser.Id;
        }
    }
    
    if (type === 'estoque') {
        toggleRecusadoFields();
    }
}

    function populateForm(form, data) {
        for(const key in data) {
            const inputId = `${form.id.replace('-form','')}-${key}`;
            const input = document.getElementById(inputId);
            if(input) {
                if(input.type === 'file') {
                    const preview = document.getElementById(`${inputId}-preview`);
                    if(data[key] && data[key][0]?.signedPath) {
                        preview.src = `${NOCODB_HOST_URL}/${data[key][0].signedPath}`;
                        preview.classList.remove('hidden');
                    }
                } else if(input.tagName === 'SELECT') {
                    input.value = data[key]?.Id ?? data[key];
                } else if(input.type === 'datetime-local') {
                    if (data[key]) {
                        const d = new Date(data[key]);
                        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                        input.value = d.toISOString().slice(0, 16);
                    }
                } else {
                    if (input.id === 'estoque-Quantidade' && typeof data[key] === 'number') {
                         input.value = data[key].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
                    } else {
                         input.value = data[key] ?? '';
                    }
                }
            }
        }
    }
function setupProducaoForm() {
    const form = document.getElementById('producao-form');
    form.reset();
    document.getElementById('producao-Id').value = '';
    
    // Limpa o box de informaÃ§Ãµes do lote e reseta a variÃ¡vel global
    document.getElementById('producao-estoque-info').innerHTML = '<p>Selecione um cliente e produto para ver o lote ativo.</p>';
    activeLoteProducao = null;
    document.getElementById('producao-Produto').innerHTML = '<option value="">Selecione um cliente primeiro</option>';
    document.getElementById('producao-Produto').disabled = true;
    // Preenche o responsÃ¡vel com o usuÃ¡rio logado e desabilita
    const responsavelSelect = document.getElementById('producao-Equipe');
    responsavelSelect.value = loggedInUser.Id;
    responsavelSelect.disabled = true;

    showModal(document.getElementById('producao-modal'));
}

async function handleProducaoSelectChange(event) {
    const clienteId = document.getElementById('producao-Cliente').value;
    const produtoId = document.getElementById('producao-Produto').value;
    const produtoSelect = document.getElementById('producao-Produto');
    const infoBox = document.getElementById('producao-estoque-info');
    
    activeLoteProducao = null;
    infoBox.innerHTML = '<p>Selecione um cliente e produto para ver o lote ativo.</p>';

    if (event.target.id === 'producao-Cliente') {
        produtoSelect.innerHTML = '<option value="">Carregando produtos...</option>';
        produtoSelect.disabled = true;

        if (!clienteId) {
            produtoSelect.innerHTML = '<option value="">Selecione um cliente</option>';
            return;
        }

        // Busca todos os lotes com status 'Recebido' para o cliente selecionado
        const whereClause = `(Emaf_Clientes_id,eq,${clienteId})~and(Status,eq,Recebido)`;
        const nestedClause = `nested[Emaf_Produto][fields]=Id,Produto`;
        const endpoint = `${TABLE_NAME_MAP.estoque}?where=${encodeURIComponent(whereClause)}&${nestedClause}`;
        
        const result = await nocoFetch(endpoint);

        if (result && result.list && result.list.length > 0) {
            const produtosDisponiveis = result.list.reduce((acc, item) => {
                if (item.Emaf_Produto && !acc.some(p => p.Id === item.Emaf_Produto.Id)) {
                    acc.push(item.Emaf_Produto);
                }
                return acc;
            }, []);
            
            if (produtosDisponiveis.length > 0) {
                let options = '<option value="">Selecione um produto...</option>';
                produtosDisponiveis.sort((a, b) => a.Produto.localeCompare(b.Produto)).forEach(produto => {
                    options += `<option value="${produto.Id}">${produto.Produto}</option>`;
                });
                produtoSelect.innerHTML = options;
                produtoSelect.disabled = false;
            } else {
                 produtoSelect.innerHTML = '<option value="">Nenhum produto com lote disponÃ­vel</option>';
            }
        } else {
            produtoSelect.innerHTML = '<option value="">Nenhum produto com lote disponÃ­vel</option>';
        }
        return; 
    }

    if (clienteId && produtoId) {
        showLoadingOverlay('Verificando saldo do lote...');

        // 1. Pega todas as entradas "Recebidas" para o cliente/produto, ordenadas pela data (FIFO)
        const whereClause = `(Emaf_Clientes_id,eq,${clienteId})~and(Emaf_Produto_id,eq,${produtoId})~and(Status,eq,Recebido)`;
        const endpoint = `${TABLE_NAME_MAP.estoque}?where=${encodeURIComponent(whereClause)}&sort=Data`;
        const result = await nocoFetch(endpoint);

        if (!result || !result.list || result.list.length === 0) {
            infoBox.innerHTML = '<p class="text-red-500 font-semibold">Nenhum lote de matÃ©ria-prima encontrado.</p>';
            hideLoadingOverlay();
            return;
        }

        const allEntries = result.list;
        
        // 2. Agrupa as entradas por nÃºmero de lote
        const lotesAgrupados = allEntries.reduce((acc, entry) => {
            const loteNum = entry.Lote;
            if (!acc[loteNum]) {
                acc[loteNum] = {
                    totalRecebido: 0,
                    totalConsumido: 0,
                    entries: []
                };
            }
            acc[loteNum].totalRecebido += (entry.Quantidade || 0);
            acc[loteNum].entries.push({ id: entry.Id, data: entry.Data });
            return acc;
        }, {});

        // 3. Calcula o consumo para cada lote
        const allEntryIds = allEntries.map(e => e.Id);
        const producoesRelacionadas = producaoData.filter(p => p.Emaf_Estoque && allEntryIds.includes(p.Emaf_Estoque.Id));

        producoesRelacionadas.forEach(prod => {
            const entryId = prod.Emaf_Estoque.Id;
            const entry = allEntries.find(e => e.Id === entryId);
            if (entry && lotesAgrupados[entry.Lote]) {
                lotesAgrupados[entry.Lote].totalConsumido += (prod.Qtde_Insumo || 0);
            }
        });

        // 4. Encontra o primeiro lote (mais antigo) com saldo disponÃ­vel
        let loteAtivoEncontrado = null;
        for (const entry of allEntries) {
            const loteNum = entry.Lote;
            const saldoLote = lotesAgrupados[loteNum].totalRecebido - lotesAgrupados[loteNum].totalConsumido;
            
            // Usamos uma pequena margem para evitar problemas com ponto flutuante
            if (saldoLote > 0.01) {
                loteAtivoEncontrado = {
                    lote: loteNum,
                    saldo: saldoLote,
                    quantidadeInicial: lotesAgrupados[loteNum].totalRecebido,
                    // Armazenamos o ID da entrada especÃ­fica que serÃ¡ usada (a mais antiga do lote)
                    entryId: lotesAgrupados[loteNum].entries[0].id 
                };
                break; // Para o loop assim que encontrar o primeiro lote com saldo
            }
        }

        // 5. Atualiza a UI
        if (loteAtivoEncontrado) {
            activeLoteProducao = loteAtivoEncontrado; // Armazena as informaÃ§Ãµes do lote ativo
            infoBox.innerHTML = `
                <p><strong>Lote Ativo:</strong> <span class="font-semibold text-brand-gold">${loteAtivoEncontrado.lote}</span></p>
                <p><strong>Quantidade Inicial (Total do Lote):</strong> ${loteAtivoEncontrado.quantidadeInicial.toLocaleString('pt-BR')} Kg</p>
                <p class="text-lg"><strong>Saldo DisponÃ­vel:</strong> <span class="font-bold text-green-500">${loteAtivoEncontrado.saldo.toLocaleString('pt-BR')} Kg</span></p>
            `;
        } else {
            infoBox.innerHTML = '<p class="text-red-500 font-semibold">Todos os lotes para este produto estÃ£o esgotados.</p>';
        }

        hideLoadingOverlay();
    }
}

async function checkAndFinalizeLote(loteNumber) {
    if (!loteNumber) return;

    // 1. Encontrar todas as entradas para este nÃºmero de lote
    const loteEntries = estoqueData.filter(e => e.Lote === loteNumber && e.Status === 'Recebido');
    if (loteEntries.length === 0) return;

    const loteEntryIds = loteEntries.map(e => e.Id);

    // 2. Calcular o total recebido para este lote
    const totalRecebido = loteEntries.reduce((sum, entry) => sum + (entry.Quantidade || 0), 0);
    
    // 3. Calcular o total consumido deste lote
    const producoesDoLote = producaoData.filter(p => p.Emaf_Estoque && loteEntryIds.includes(p.Emaf_Estoque.Id));
    const totalConsumido = producoesDoLote.reduce((sum, prod) => sum + (prod.Qtde_Insumo || 0), 0);

    // 4. Verificar o saldo e atualizar se necessÃ¡rio
    if (totalRecebido - totalConsumido <= 0.01) { // Usamos uma pequena tolerÃ¢ncia para evitar problemas com ponto flutuante
        console.log(`Lote ${loteNumber} esgotado. Finalizando todas as suas entradas.`);
        
        // Prepara uma lista de promises para atualizar todos os registros de uma vez
        const updatePromises = loteEntryIds.map(id => {
            return nocoFetch(`${TABLE_NAME_MAP.estoque}/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ Status_Lote: 'Finalizado' })
            });
        });

        try {
            await Promise.all(updatePromises);
            console.log(`Lote ${loteNumber} finalizado com sucesso.`);
            // A atualizaÃ§Ã£o dos dados locais serÃ¡ feita pelo refreshCurrentView()
        } catch (error) {
            console.error(`Falha ao finalizar o lote ${loteNumber}:`, error);
        }
    }
}


async function handleLiofilizacaoFormSubmit(e) {
    e.preventDefault();
    if (!activeProducaoItem) return;

    const form = e.target;
    const estufa = form.querySelector('#liofilizacao-Estufa').value;
    const bandeja = parseInt(form.querySelector('#liofilizacao-Bandeja').value);

    if (!estufa || isNaN(bandeja) || bandeja <= 0) {
        alert("Por favor, preencha todos os campos corretamente.");
        return;
    }
    
    showLoadingOverlay('Iniciando ProduÃ§Ã£o...');
    
    const inicioProducaoDate = new Date(); // Data e hora do clique no botÃ£o
    
    // GeraÃ§Ã£o do Lote Batelada
    const datePart = inicioProducaoDate.toLocaleDateString('pt-BR', { year: '2-digit', month: '2-digit', day: '2-digit' }).replace(/\//g, '');
    const timePart = inicioProducaoDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const loteBatelada = `${datePart}/${timePart}-${estufa}`;

    const body = {
        Estufa: estufa,
        Bandeja: bandeja,
        Status: 'Em LiofilizaÃ§Ã£o',
        Inicio_Producao: inicioProducaoDate.toISOString(),
        Lote_Batelada: loteBatelada
        // NÃ£o precisamos mais definir o Turno aqui, pois ele jÃ¡ foi salvo na criaÃ§Ã£o.
    };
    
    const result = await nocoFetch(`${TABLE_NAME_MAP.producao}/${activeProducaoItem.Id}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
    });
    
    if (result) {
        hideModal(document.getElementById('liofilizacao-details-modal'));
        await refreshCurrentView();
    }
    
    hideLoadingOverlay();
}

async function setupProducaoFormForEdit(item) {
    if (!item) return;

    setupProducaoForm(); // Reutiliza a funÃ§Ã£o de setup para limpar e mostrar o modal

    document.getElementById('producao-modal-title').textContent = `Editar Ordem de ProduÃ§Ã£o #${String(item.Id).padStart(4, '0')}`;
    document.getElementById('producao-Id').value = item.Id;

    // Preenche os campos do formulÃ¡rio
    document.getElementById('producao-Cliente').value = item.Emaf_Clientes.Id;
    
    // Dispara a lÃ³gica de carregamento de produtos para o cliente
    await handleProducaoSelectChange({ target: { id: 'producao-Cliente' } });

    // Agora que os produtos estÃ£o carregados, seleciona o correto
    document.getElementById('producao-Produto').value = item.Emaf_Produto.Id;

    // Dispara a lÃ³gica de carregamento do lote para o produto
    await handleProducaoSelectChange({ target: { id: 'producao-Produto' } });
    
    document.getElementById('producao-Qtde_Insumo').value = item.Qtde_Insumo.toLocaleString('pt-BR');
    document.getElementById('producao-Observacao').value = item.Observacao || '';
    document.getElementById('producao-Equipe').value = item.Emaf_Equipe.Id;
}

async function handleProducaoDelete() {
    if (!activeProducaoItem) return;

    showLoadingOverlay('Apagando registro...');

    const result = await nocoFetch(`${TABLE_NAME_MAP.producao}/${activeProducaoItem.Id}`, { method: 'DELETE' });

    if (result && result.success) {
        // A lÃ³gica de recalcular o estoque Ã© automÃ¡tica, pois a "saÃ­da" foi removida.
        await refreshCurrentView();
    } else {
        alert('Falha ao apagar o registro.');
    }

    hideModal(document.getElementById('delete-confirm-modal'));
    hideLoadingOverlay();
    activeProducaoItem = null;
}


async function handleProducaoFormSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const id = form.querySelector('#producao-Id').value;
    const method = id ? 'PATCH' : 'POST';

    // ValidaÃ§Ã£o do Lote Ativo
    if (!activeLoteProducao || !activeLoteProducao.entryId) {
        alert("Erro: Nenhum lote de MatÃ©ria-Prima vÃ¡lido foi selecionado. Por favor, verifique o cliente e o produto.");
        return;
    }

    // ValidaÃ§Ã£o da Quantidade
    const qtdeInsumoInput = form.querySelector('#producao-Qtde_Insumo');
    const qtdeInsumoValue = qtdeInsumoInput.value.replace(/\./g, '').replace(',', '.');
    const qtdeInsumo = parseFloat(qtdeInsumoValue);

    if (isNaN(qtdeInsumo) || qtdeInsumo <= 0) {
        alert("Por favor, insira uma quantidade de insumo vÃ¡lida.");
        return;
    }

    // Calcula o saldo disponÃ­vel, considerando se Ã© uma ediÃ§Ã£o
    const saldoDisponivel = id ? (activeLoteProducao.saldo + (activeProducaoItem?.Qtde_Insumo || 0)) : activeLoteProducao.saldo;
    
    if (qtdeInsumo > saldoDisponivel) {
        alert(`Erro: A quantidade a utilizar (${qtdeInsumo.toLocaleString('pt-BR')} Kg) Ã© maior que o saldo disponÃ­vel no lote (${saldoDisponivel.toLocaleString('pt-BR')} Kg).`);
        return;
    }

    showLoadingOverlay(id ? 'Atualizando...' : 'Criando...');
    
    const nowISO = new Date().toISOString();

    // Monta o corpo da requisiÃ§Ã£o
    const body = {
        Qtde_Insumo: qtdeInsumo,
        Observacao: form.querySelector('#producao-Observacao').value,
    };

    if (method === 'POST') {
        body.Emaf_Clientes = { Id: parseInt(form.querySelector('#producao-Cliente').value) };
        body.Emaf_Produto = { Id: parseInt(form.querySelector('#producao-Produto').value) };
        body.Emaf_Equipe = { Id: parseInt(form.querySelector('#producao-Equipe').value) };
        // AQUI USAMOS O 'entryId' ARMAZENADO PARA LIGAR Ã€ ENTRADA DE ESTOQUE CORRETA
        body.Emaf_Estoque = { Id: activeLoteProducao.entryId };
        body.Status = 'Processamento';
        body.Inicio_Preparo = nowISO;
        body.Turno = getTurno(nowISO);
    } else { // PATCH
        body.Emaf_Clientes_id = parseInt(form.querySelector('#producao-Cliente').value);
        body.Emaf_Produto_id = parseInt(form.querySelector('#producao-Produto').value);
        body.Emaf_Equipe_id = parseInt(form.querySelector('#producao-Equipe').value);
        body.Emaf_Estoque_id = activeLoteProducao.entryId;
    }

    const endpoint = id ? `${TABLE_NAME_MAP.producao}/${id}` : TABLE_NAME_MAP.producao;

    const result = await nocoFetch(endpoint, { 
        method: method, 
        body: JSON.stringify(body) 
    });

    if (result) {
        hideModal(document.getElementById('producao-modal'));
        
        // Atualiza a lista de produÃ§Ã£o ANTES de checar o lote, para ter o dado mais recente
        await fetchProducao();
        
        // Checa e finaliza o lote se necessÃ¡rio
        await checkAndFinalizeLote(activeLoteProducao.lote);
        
        // Atualiza a visÃ£o completa
        await refreshCurrentView(); 
    }
    
    hideLoadingOverlay();
}
async function handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const type = form.id.replace('-form', ''); 
    const id = document.getElementById(`${type}-Id`).value;
    const method = id ? 'PATCH' : 'POST';

    const tableName = TABLE_NAME_MAP[type];
    if (!tableName) {
        alert(`Erro interno: Tipo de formulÃ¡rio desconhecido "${type}".`);
        return;
    }
    const endpoint = id ? `${tableName}/${id}` : tableName;
    
    showLoadingOverlay(id ? 'Atualizando...' : 'Salvando...');
    
    let body = {};
    try {
        const equipeInput = form.querySelector('#estoque-Emaf_Equipe');
        const dataInput = form.querySelector('#estoque-Data');
        const wereDisabled = { equipe: equipeInput?.disabled, data: dataInput?.disabled };
        if (equipeInput) equipeInput.disabled = false;
        if (dataInput) dataInput.disabled = false;

        const formElements = form.querySelectorAll('input, select, textarea');
        for (const el of formElements) {
            if (!el.id || el.type === 'file' || el.type === 'hidden') continue;

            const key = el.id.replace(`${type}-`, '');
            let value = el.value.trim();

            if (el.required && !value) {
                throw new Error(`O campo "${el.labels[0]?.textContent || key}" Ã© obrigatÃ³rio.`);
            }
            
            if (el.id === 'estoque-Quantidade') {
                if (value) {
                    const sanitizedValue = value.replace(/\./g, '').replace(',', '.');
                    const numericValue = parseFloat(sanitizedValue);
                    if (isNaN(numericValue)) {
                        throw new Error('O valor do campo "Quantidade" Ã© invÃ¡lido.');
                    }
                    body[key] = numericValue;
                } else {
                    body[key] = 0;
                }
            } else if (el.tagName === 'SELECT' && key.startsWith('Emaf_')) {
                const relationId = parseInt(value);
                if (!relationId && el.required) throw new Error(`O campo "${el.labels[0]?.textContent || key}" Ã© obrigatÃ³rio.`);
                
                if (relationId) {
                    if(id) { body[`${key}_id`] = relationId; } 
                    else { body[key] = { "Id": relationId }; }
                }
            } else if(el.type === 'datetime-local') {
                body[key] = value ? new Date(value).toISOString() : null;
            } else {
                body[key] = value;
            }
        }
        
        if (equipeInput) equipeInput.disabled = wereDisabled.equipe;
        if (dataInput) dataInput.disabled = wereDisabled.data;

        if (type === 'estoque') {
            if (body.Status === 'Recusado') {
                body.Container = ''; 
            }
            if (method === 'POST' && body.Status === 'Recebido') {
                body.Status_Lote = 'Ativo';
            }
        }

        const fileInputs = form.querySelectorAll('input[type="file"]');
        for (const fileInput of fileInputs) {
            if (fileInput.files.length > 0) {
                const columnName = fileInput.id.replace(`${type}-`, '');
                const uploadTableName = TABLE_NAME_MAP[type];
                const fileData = await uploadFile(uploadTableName, columnName, fileInput.files[0]);
                if (fileData) body[columnName] = [fileData];
            } else if (fileInput.required) {
                 throw new Error(`O campo "${fileInput.labels[0]?.textContent || fileInput.id}" Ã© obrigatÃ³rio.`);
            }
        }

        if(type === 'equipe' && id && (body.Senha === '' || typeof body.Senha === 'undefined')) {
            delete body.Senha;
        } else if (type === 'equipe' && !id && !body.Senha) {
            throw new Error("O campo Senha Ã© obrigatÃ³rio para novos membros.");
        }

        const result = await nocoFetch(endpoint, { method, body: JSON.stringify(body) });
        
        if (result) {
            setupFormAndListVisibility(type, false); // Esconde o formulÃ¡rio
            await refreshCurrentView(); // Atualiza os dados e redesenha a tela
        }
    } catch (error) {
        alert(`Erro ao salvar: ${error.message}`);
    } finally {
        hideLoadingOverlay();
    }
}
// FunÃ§Ã£o do modal de detalhes, atualizada para incluir a 'producaoData'
function openDetailsModal(element) {
    const id = element.dataset.id;
    const type = element.dataset.type;
    const dataArray = { equipe: equipeData, clientes: clientesData, produtos: produtosData, estoque: estoqueData, producao: producaoData }[type];
    const data = dataArray.find(d => d.Id == id);
    if (!data) return;

    activeDeleteItem = { id, type, element };
    
    // Mostra/esconde botÃµes de aÃ§Ã£o com base na role e no tipo de item
    const isGestaoOrAdmin = ['Admin', 'GestÃ£o'].includes(loggedInUser.Role);
    const actionsContainer = document.getElementById('details-modal-actions');
    if (isGestaoOrAdmin && (type === 'equipe' || type === 'clientes' || type === 'produtos')) {
        actionsContainer.classList.remove('hidden');
    } else {
        actionsContainer.classList.add('hidden');
    }
    
    document.getElementById('modal-title').textContent = `Detalhes de ${capitalize(type)}`;
    
    let contentHTML = '';
    
    const formatValue = (key, value) => {
        const keyLower = key.toLowerCase();
        if (key === 'Id' || key.startsWith('nc_') || key.endsWith('_id') || keyLower === 'senha' || keyLower === 'createdat' || keyLower === 'updatedat' || keyLower === 'cliente_estoque') return '';

        const label = GLOBAL_LABEL_MAP[keyLower] || key;
        let displayValue = value;

        if (typeof value === 'object' && value !== null) {
            if(Array.isArray(value) && value.length > 0 && value[0]?.signedPath) {
                const images = value.map(file => 
                    `<img src="${NOCODB_HOST_URL}/${file.signedPath}" class="w-24 h-24 object-cover inline-block m-1 border rounded cursor-pointer" onclick="showImageModal(this.src)" alt="${label}">`
                ).join('');
                return `<div class="mt-2"><p class="font-bold">${label}:</p>${images}</div>`;
            } else {
                displayValue = value.Nome || value.Cliente || value.Produto || value.Lote || 'N/A';
            }
        }

        if (keyLower === 'cnpj' && displayValue) {
             displayValue = formatCNPJ(displayValue);
        }

        if (['data', 'inicio_preparo', 'inicio_producao', 'finalizado'].includes(keyLower)) {
            if (displayValue && displayValue !== 'N/A') {
                displayValue = formatTimestamp(displayValue);
            }
        }
         if (['quantidade', 'qtde_insumo', 'qtde_final'].includes(keyLower) && (typeof displayValue === 'number')) {
             displayValue = displayValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
        }

        return `<p><strong>${label}:</strong> ${displayValue || 'N/A'}</p>`;
    };
    
    if (type === 'estoque' || type === 'producao') {
        const order = type === 'estoque'
            ? ['Data', 'Emaf_Clientes', 'Emaf_Equipe', 'Emaf_Produto', 'Lote', 'Container', 'Quantidade', 'Status_Lote', 'Status', 'Observacao', 'Etiqueta', 'Foto_Produto', 'Foto_Local', 'Foto_Veiculo']
            : ['Status', 'Emaf_Clientes', 'Emaf_Produto', 'Emaf_Estoque', 'Lote_Batelada', 'Turno', 'Qtde_Insumo', 'Qtde_Final', 'Inicio_Preparo', 'Inicio_Producao', 'Finalizado', 'Emaf_Equipe', 'Estufa', 'Bandeja', 'Observacao'];
        
        order.forEach(key => {
            if (data.hasOwnProperty(key)) {
                contentHTML += formatValue(key, data[key]);
            }
        });
    } else {
        contentHTML = Object.entries(data).map(([key, value]) => formatValue(key, value)).join('');
    }
    
    document.getElementById('modal-content').innerHTML = contentHTML;
    showModal(document.getElementById('details-modal'));
}

async function handleDelete() {
    if (!activeDeleteItem) return;
    const { id, type } = activeDeleteItem;
    const tableName = TABLE_NAME_MAP[type];
    if(!tableName) return;
    const endpoint = `${tableName}/${id}`;

    showLoadingOverlay('Apagando...');
    const result = await nocoFetch(endpoint, { method: 'DELETE' });
    
    if (result && result.success) {
        await refreshCurrentView(); // Atualiza os dados e redesenha a tela
    } else {
        alert('Falha ao apagar o registro.');
    }
    
    hideLoadingOverlay();
    hideModal(document.getElementById('delete-confirm-modal'));
    hideModal(document.getElementById('details-modal'));
    activeDeleteItem = null;
}

    function capitalize(s) {
        if (s === 'clientes') return 'Clientes';
        if (s === 'produtos') return 'Produto';
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
    // --- Listeners de Eventos ---
function setupEventListeners() {
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    document.getElementById('logout-button')?.addEventListener('click', () => showModal(document.getElementById('logout-confirm-modal')));
    document.getElementById('cancel-logout-btn')?.addEventListener('click', () => hideModal(document.getElementById('logout-confirm-modal')));
    document.getElementById('confirm-logout-btn')?.addEventListener('click', () => { clearSessionState(); location.reload(); });
    
    document.getElementById('sidebar-toggle')?.addEventListener('click', toggleMobileSidebar);
    document.getElementById('sidebar-overlay')?.addEventListener('click', toggleMobileSidebar);

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.target);
            if (window.innerWidth < 1024) toggleMobileSidebar();
        });
    });

    ['equipe', 'clientes', 'produtos', 'estoque'].forEach(type => {
        document.getElementById(`show-${type}-form`)?.addEventListener('click', () => setupForm(type));
        document.getElementById(`cancel-${type}-form`)?.addEventListener('click', () => setupFormAndListVisibility(type, false));
        const form = document.getElementById(`${type}-form`);
        if (form) form.addEventListener('submit', handleFormSubmit);
    });

    // Listeners especÃ­ficos da tela de ProduÃ§Ã£o
    document.getElementById('show-producao-form')?.addEventListener('click', setupProducaoForm);
    document.getElementById('close-producao-modal')?.addEventListener('click', () => hideModal(document.getElementById('producao-modal')));
    document.getElementById('cancel-producao-form')?.addEventListener('click', () => hideModal(document.getElementById('producao-modal')));
    document.getElementById('producao-Cliente')?.addEventListener('change', (event) => handleProducaoSelectChange(event));
    document.getElementById('producao-Produto')?.addEventListener('change', (event) => handleProducaoSelectChange(event));
    document.getElementById('producao-form')?.addEventListener('submit', handleProducaoFormSubmit);
    
    // Listeners do modal de LiofilizaÃ§Ã£o
    document.getElementById('liofilizacao-form')?.addEventListener('submit', handleLiofilizacaoFormSubmit);
    document.getElementById('cancel-liofilizacao-form')?.addEventListener('click', () => hideModal(document.getElementById('liofilizacao-details-modal')));
    document.getElementById('cancel-action-btn')?.addEventListener('click', () => hideModal(document.getElementById('action-confirm-modal')));

    // Listeners do modal de Quantidade Final
    document.getElementById('qtd-final-form')?.addEventListener('submit', handleQtdFinalFormSubmit);
    document.getElementById('cancel-qtd-final-form')?.addEventListener('click', () => hideModal(document.getElementById('qtd-final-modal')));

    document.getElementById('close-modal')?.addEventListener('click', () => hideModal(document.getElementById('details-modal')));
    document.getElementById('edit-btn')?.addEventListener('click', () => {
         if (activeDeleteItem) {
            hideModal(document.getElementById('details-modal'));
            setupForm(activeDeleteItem.type, activeDeleteItem.id);
         }
    });
    document.getElementById('delete-btn')?.addEventListener('click', () => {
        hideModal(document.getElementById('details-modal'));
        showModal(document.getElementById('delete-confirm-modal'));
    });
    document.getElementById('cancel-delete-btn')?.addEventListener('click', () => {
        hideModal(document.getElementById('delete-confirm-modal'));
        if(activeDeleteItem) showModal(document.getElementById('details-modal'));
    });
    document.getElementById('confirm-delete-btn')?.addEventListener('click', handleDelete);
    
    document.body.addEventListener('click', function(e) {
        const actionBtn = e.target.closest('.action-btn');
        if (actionBtn) {
            const dataContainer = actionBtn.closest('[data-id]');
            if (!dataContainer) return;

            const id = dataContainer.dataset.id;
            const type = dataContainer.dataset.type;
            const action = actionBtn.dataset.action;

            if (action === 'details') openDetailsModal(dataContainer);
            else if (action === 'edit') setupForm(type, id);
            else if (action === 'delete') {
                activeDeleteItem = { id, type, element: dataContainer };
                showModal(document.getElementById('delete-confirm-modal'));
            }
        }
        
        const actionBtnProducao = e.target.closest('.action-btn-producao');
        if (actionBtnProducao) {
            e.preventDefault();
            const id = actionBtnProducao.dataset.id;
            const action = actionBtnProducao.dataset.action;
            activeProducaoItem = producaoData.find(p => p.Id == id);
            
            if (!activeProducaoItem) return;

            if (action === 'start-liofilizacao') {
                const estufasOcupadas = producaoData
                    .filter(p => p.Status === 'Em LiofilizaÃ§Ã£o' && p.Estufa)
                    .map(p => p.Estufa);

                const estufasDisponiveis = TODAS_ESTUFAS.filter(e => !estufasOcupadas.includes(e));
                
                const estufaSelect = document.getElementById('liofilizacao-Estufa');
                const submitButton = document.querySelector('#liofilizacao-form button[type="submit"]');
                
                estufaSelect.innerHTML = ''; 

                if (estufasDisponiveis.length > 0) {
                    estufaSelect.innerHTML = '<option value="">Selecione...</option>';
                    estufasDisponiveis.forEach(estufa => {
                        estufaSelect.innerHTML += `<option value="${estufa}">Estufa ${estufa}</option>`;
                    });
                    submitButton.disabled = false;
                    submitButton.textContent = 'Confirmar e Iniciar';
                } else {
                    estufaSelect.innerHTML = '<option value="">Nenhuma estufa disponÃ­vel</option>';
                    submitButton.disabled = true;
                    submitButton.textContent = 'Aguardando Estufa';
                }

                document.getElementById('liofilizacao-Bandeja').value = '';

                showModal(document.getElementById('liofilizacao-details-modal'));

           } else if (action === 'finish-producao') {
                const modal = document.getElementById('action-confirm-modal');
                document.getElementById('action-confirm-modal-title').textContent = 'Finalizar ProduÃ§Ã£o';
                document.getElementById('action-confirm-modal-content').textContent = `Deseja realmente finalizar a produÃ§Ã£o #${String(id).padStart(4, '0')}? Esta aÃ§Ã£o registrarÃ¡ a data e hora atuais.`;
                
                const confirmBtn = document.getElementById('confirm-action-btn');
                
                const newConfirmBtn = confirmBtn.cloneNode(true);
                newConfirmBtn.textContent = 'Sim, Finalizar';
                confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

                newConfirmBtn.addEventListener('click', async () => {
                    showLoadingOverlay('Finalizando...');
                    const result = await nocoFetch(`${TABLE_NAME_MAP.producao}/${id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                            Status: 'Finalizado',
                            Finalizado: new Date().toISOString()
                        })
                    });
                    if (result) {
                        hideModal(modal);
                        await refreshCurrentView(); // Atualiza os dados e redesenha a tela
                    }
                    hideLoadingOverlay();
                }, { once: true });

                showModal(modal);
            } else if (action === 'add-qtd-final') {
                const modal = document.getElementById('qtd-final-modal');
                const title = document.getElementById('qtd-final-modal-title');
                const form = document.getElementById('qtd-final-form');
                
                title.textContent = `Informar Rendimento (kg) (#${String(activeProducaoItem.Id).padStart(4, '0')})`;
                form.reset();

                showModal(modal);
            }
        }
        
        const actionBtnCrudProducao = e.target.closest('.action-btn-producao-crud');
        if (actionBtnCrudProducao) {
            e.preventDefault();
            const id = actionBtnCrudProducao.dataset.id;
            const action = actionBtnCrudProducao.dataset.action;
            activeProducaoItem = producaoData.find(p => p.Id == id);
            
            if (!activeProducaoItem) return;

            if (action === 'edit') {
                setupProducaoFormForEdit(activeProducaoItem);
            } else if (action === 'delete') {
                document.getElementById('confirm-delete-btn').onclick = handleProducaoDelete;
                showModal(document.getElementById('delete-confirm-modal'));
            }
        }
    });

    document.querySelectorAll('.dash-filter').forEach(filter => {
        filter.addEventListener('change', updateDashboard);
    });
    document.getElementById('clear-dash-filters')?.addEventListener('click', () => {
        document.getElementById('dash-start-date').value = '';
        document.getElementById('dash-end-date').value = '';
        document.getElementById('dash-cliente').value = '';
        document.getElementById('dash-produto').value = '';
        updateDashboard();
    });
    window.showImageModal = showImageModal; 
    document.getElementById('estoque-Status')?.addEventListener('change', toggleRecusadoFields);
    document.getElementById('equipe-search')?.addEventListener('input', applyAndRenderEquipe);
    document.getElementById('clientes-search')?.addEventListener('input', applyAndRenderClientes);
    document.getElementById('produtos-search')?.addEventListener('input', applyAndRenderProdutos);
    document.querySelectorAll('#estoque-list-container .grid input, #estoque-list-container .grid select').forEach(el => {
        const eventType = (el.tagName === 'INPUT' && el.type === 'text') ? 'input' : 'change';
        el.addEventListener(eventType, applyAndRenderEstoque);
    });
     // Listeners para os filtros da tela de ProduÃ§Ã£o
    document.querySelectorAll('.producao-filter').forEach(filter => {
        const eventType = (filter.tagName === 'INPUT' && filter.type === 'text') ? 'input' : 'change';
        filter.addEventListener(eventType, applyAndRenderProducao);
    });

    document.getElementById('clear-producao-filters')?.addEventListener('click', () => {
        document.getElementById('filter-producao-start-date').value = '';
        document.getElementById('filter-producao-end-date').value = '';
        document.getElementById('filter-producao-lote').value = '';
        document.getElementById('filter-producao-responsavel').value = '';
        document.getElementById('filter-producao-estufa').value = '';
        document.getElementById('filter-producao-status').value = '';
        document.getElementById('filter-producao-turno').value = '';
        applyAndRenderProducao();
    });

    // Listeners para as abas do Dashboard
    const tabs = document.querySelectorAll('.dashboard-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            currentDashboardTab = tab.dataset.tab;
            syncDashboardTabUI();
            updateDashboard();
        });
    });
    // Listeners para os filtros do Dashboard de ProduÃ§Ã£o
    document.querySelectorAll('.dash-prod-filter').forEach(filter => {
        filter.addEventListener('change', updateProducaoDashboard);
    });
    document.getElementById('clear-dash-prod-filters')?.addEventListener('click', () => {
        document.getElementById('dash-prod-start-date').value = '';
        document.getElementById('dash-prod-end-date').value = '';
        document.getElementById('dash-prod-cliente').value = '';
        document.getElementById('dash-prod-produto').value = '';
        document.getElementById('dash-prod-responsavel').value = '';
        updateProducaoDashboard();
    });
    // Listeners para alternar a visualizaÃ§Ã£o da tela de ProduÃ§Ã£o
    document.getElementById('toggle-kanban-view')?.addEventListener('click', () => toggleProducaoView('kanban'));
    document.getElementById('toggle-list-view')?.addEventListener('click', () => toggleProducaoView('list'));
    document.getElementById('generate-producao-report')?.addEventListener('click', generateProducaoPDF);
    
    // Garante que o botÃ£o da view padrÃ£o (kanban) comece ativo
    document.getElementById('toggle-kanban-view')?.classList.add('bg-brand-gold', 'text-white');    
}

    // --- InicializaÃ§Ã£o ---
    setupEventListeners();
    checkSession();
});


