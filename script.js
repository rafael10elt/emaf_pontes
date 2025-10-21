document.addEventListener('DOMContentLoaded', function() {
    // --- Configuração da API ---
    // !!! IMPORTANTE: Substitua 'SEU_TOKEN_AQUI' pelo seu token de API do NocoDB !!!
    const API_TOKEN = '7R5Yye4OCWOamPHtGItYUjd4EL8H90dLP4HUsYzv'; 
    const NOCODB_BASE_URL = 'https://lumitechia-nocodb.aeenwc.easypanel.host';
    const NOCODB_PROJECT_PATH = '/api/v1/db/data/noco/Consultoria_DB';
    
    // --- Variáveis Globais de Dados ---
    let equipeData = [];
    let clientesData = [];
    let produtosData = [];
    let estoqueData = [];
    let loggedInUser = null;

    // --- Variáveis de Estado da UI ---
    let activeDeleteItem = { id: null, type: null, element: null };

    // --- Mapeamento de Nomes de Tabela ---
    const TABLE_NAME_MAP = {
        equipe: 'Emaf_Equipe',
        clientes: 'Emaf_Clientes',
        produtos: 'Emaf_Produto',
        estoque: 'Emaf_Estoque'
    };

    // --- Mapeamento de Nomes de Campos para Rótulos Amigáveis ---
    const GLOBAL_LABEL_MAP = {
        nome: 'Nome',
        login: 'Login',
        senha: 'Senha',
        role: 'Função',
        foto: 'Foto',
        cliente: 'Cliente',
        cnpj: 'CNPJ',
        razao_social: 'Razão Social',
        produto: 'Produto',
        emaf_equipe: 'Responsável',
        emaf_clientes: 'Cliente',
        emaf_produto: 'Produto',
        data: 'Data e Hora',
        lote: 'Lote',
        etiqueta: 'Foto da Etiqueta',
        quantidade: 'Quantidade (Kg)',
        container: 'Container',
        status: 'Status',
        observacao: 'Observação',
        foto_produto: 'Foto do Produto',
        foto_local: 'Foto do Local',
        foto_veiculo: 'Foto do Veículo',
        createdat: 'Criado em',
        updatedat: 'Alterado em'
    };

    // --- Funções de API e Utilitários ---
    function showModal(modalElement) {
        modalElement?.classList.replace('hidden', 'flex');
    }

    function hideModal(modalElement) {
        modalElement?.classList.replace('flex', 'hidden');
    }

    // --- ADICIONE A FUNÇÃO ABAIXO ---
    function showImageModal(src) {
        // Remove qualquer modal de imagem que já esteja aberto
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
        if (!API_TOKEN || API_TOKEN === 'SEU_TOKEN_AQUI') {
             alert('ERRO: Token da API não configurado no arquivo script.js. Por favor, adicione seu token do NocoDB.');
             hideLoadingOverlay();
             return null;
        }
        try {
            const separator = endpoint.includes('?') ? '&' : '?';
            const fullUrl = `${NOCODB_BASE_URL}${NOCODB_PROJECT_PATH}/${endpoint}${separator}limit=2000`;

            const response = await fetch(fullUrl, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    'xc-token': API_TOKEN,
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
            alert(`Ocorreu um erro de comunicação com o servidor. Verifique o console (F12) para mais detalhes.\n\nDetalhes: ${error.message}`);
            hideLoadingOverlay(); 
            return null;
        }
    }

     async function uploadFile(tableName, columnName, file) {
         const formData = new FormData();
         formData.append('file', file);
         const uploadUrl = `${NOCODB_BASE_URL}/api/v1/db/storage/upload?path=Consultoria_DB/${tableName}/${columnName}`;
         try {
             const response = await fetch(uploadUrl, {
                 method: 'POST',
                 headers: { 'xc-token': API_TOKEN },
                 body: formData
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

    // --- Funções de Carregamento de Dados ---
    async function fetchAllData() {
        showLoadingOverlay('Carregando dados do sistema...');
        await Promise.all([
            fetchEquipe(),
            fetchClientes(),
            fetchProdutos(),
            fetchEstoque()
        ]);
        
        populateSelects();
        applyAndRenderEquipe();
        applyAndRenderClientes();
        applyAndRenderProdutos();
        applyAndRenderEstoque();
        hideLoadingOverlay();
    }

    async function fetchEquipe() {
        const result = await nocoFetch('Emaf_Equipe?nested[all]=true');
        equipeData = (result && result.list) ? result.list.sort((a, b) => a.Nome.localeCompare(b.Nome)) : [];
    }
    async function fetchClientes() {
        const result = await nocoFetch('Emaf_Clientes');
        clientesData = (result && result.list) ? result.list.sort((a, b) => a.Cliente.localeCompare(b.Cliente)) : [];
    }
    async function fetchProdutos() {
        const result = await nocoFetch('Emaf_Produto');
        produtosData = (result && result.list) ? result.list.sort((a, b) => a.Produto.localeCompare(b.Produto)) : [];
    }
    async function fetchEstoque() {
        const result = await nocoFetch('Emaf_Estoque?nested[all]=true');
        estoqueData = (result && result.list) ? result.list.sort((a, b) => new Date(b.Data) - new Date(a.Data)) : [];
    }

    // --- Autenticação e Sessão ---
    async function handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        if (!username || !password) return alert('Por favor, preencha usuário e senha.');

        showLoadingOverlay('Autenticando...');
        
        const endpoint = `Emaf_Equipe?where=(Login,eq,${username})~and(Senha,eq,${password})`;
        const result = await nocoFetch(endpoint);
        
        hideLoadingOverlay();

        if (result && result.list && result.list.length > 0) {
            const user = result.list[0];
            sessionStorage.setItem('loggedInUser', JSON.stringify(user));
            await initializeUserSession(user);
        } else {
            alert('Usuário ou senha inválidos.');
        }
    }
    
    async function initializeUserSession(user) {
        loggedInUser = user;
        document.getElementById('logged-user-name').textContent = loggedInUser.Nome;
        document.getElementById('logged-user-role').textContent = loggedInUser.Role;

        const userAvatar = document.querySelector('#main-app header img');
        if (userAvatar && loggedInUser.Foto && loggedInUser.Foto.length > 0 && loggedInUser.Foto[0]?.signedPath) {
            userAvatar.src = `${NOCODB_BASE_URL}/${loggedInUser.Foto[0].signedPath}`;
        } else {
            userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(loggedInUser.Nome)}&background=BFA16A&color=fff`;
        }

        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');

        const isGestaoOrAdmin = ['Admin', 'Gestão'].includes(loggedInUser.Role);
        document.querySelectorAll('#show-equipe-form, #show-clientes-form, #show-produtos-form').forEach(btn => {
            btn.style.display = isGestaoOrAdmin ? 'block' : 'none';
        });
        document.getElementById('show-estoque-form').style.display = 'block';

        await fetchAllData();
        navigateTo(sessionStorage.getItem('currentPage') || 'estoque');
    }

    async function checkSession() {
        const userString = sessionStorage.getItem('loggedInUser');
        if (userString) {
            await initializeUserSession(JSON.parse(userString));
        }
    }

    // --- Funções de Navegação e UI ---
    function navigateTo(targetId) {
        document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));
        document.getElementById(targetId)?.classList.remove('hidden');
        
        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.remove('bg-brand-gold', 'text-white');
            l.classList.add('text-gray-400', 'hover:bg-brand-gold', 'hover:text-white');
        });
        const navLink = document.querySelector(`.nav-link[data-target="${targetId}"]`);
        navLink?.classList.add('bg-brand-gold', 'text-white');
        navLink?.classList.remove('text-gray-400');
        sessionStorage.setItem('currentPage', targetId);
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
        
        // Etiqueta é sempre obrigatória na criação, mas não na edição se já existir
        const estoqueId = document.getElementById('estoque-Id').value;
        const currentItem = estoqueId ? estoqueData.find(d => d.Id == estoqueId) : null;
        etiquetaInput.required = !currentItem || !(currentItem.Etiqueta && currentItem.Etiqueta.length > 0);

        if (statusSelect.value === 'Recusado') {
            fotosContainer.classList.remove('hidden');
            // Torna obrigatório apenas se não estiver editando um item que já tem a foto
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

        document.querySelectorAll('.equipe-select').forEach(el => el.innerHTML = createOptions(equipeData, 'Id', 'Nome', 'Selecione...'));
        document.querySelectorAll('.cliente-select').forEach(el => el.innerHTML = createOptions(clientesData, 'Id', 'Cliente', 'Todos'));
        document.querySelectorAll('.produto-select').forEach(el => el.innerHTML = createOptions(produtosData, 'Id', 'Produto', 'Todos'));
    }

    // --- Renderização de Conteúdo ---
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
                fotoUrl = (item.Foto && item.Foto[0]?.signedPath) ? `${NOCODB_BASE_URL}/${item.Foto[0].signedPath}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(item.Nome)}&background=BFA16A&color=fff`;
                break;
            case 'clientes':
                title = item.Cliente;
                subtitle = item.Cnpj || 'Sem CNPJ';
                fotoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.Cliente)}&background=BFA16A&color=fff`;
                break;
            case 'produtos':
                title = item.Produto;
                subtitle = `ID: ${item.Id}`;
                fotoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.Produto)}&background=373737&color=fff`;
                break;
        }

        const isGestaoOrAdmin = ['Admin', 'Gestão'].includes(loggedInUser.Role);
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
                    <button class="action-btn text-gray-500 hover:text-gray-700" data-action="details" title="Ver Detalhes"><i class="fas fa-eye"></i></button>
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

        data.forEach(item => {
            const statusClass = getStatusClass(item.Status);
            const dataFormatada = item.Data ? new Date(item.Data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short'}) : 'N/A';
            const isGestaoOrAdmin = ['Admin', 'Gestão'].includes(loggedInUser.Role);
            const actionsHTML = `
                <button class="action-btn text-gray-500" data-action="details" title="Ver Detalhes"><i class="fas fa-eye"></i></button>
                ${isGestaoOrAdmin ? `
                <button class="action-btn text-blue-500" data-action="edit" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="action-btn text-red-500" data-action="delete" title="Apagar"><i class="fas fa-trash"></i></button>
                ` : ''}
            `;
            
            // Tabela com nova ordem de colunas
            tbody.innerHTML += `
                <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700" data-id="${item.Id}" data-type="estoque">
                    <td class="px-6 py-4">${dataFormatada}</td>
                    <td class="px-6 py-4">${item.Emaf_Clientes?.Cliente || 'N/A'}</td>
                    <td class="px-6 py-4">${item.Emaf_Equipe?.Nome || 'N/A'}</td>
                    <td class="px-6 py-4">${item.Emaf_Produto?.Produto || 'N/A'}</td>
                    <td class="px-6 py-4">${item.Lote || 'N/A'}</td>
                    <td class="px-6 py-4">${item.Container || 'N/A'}</td>
                    <td class="px-6 py-4">${formatQuantity(item.Quantidade)}</td>
                    <td class="px-6 py-4"><span class="text-xs font-semibold px-2 py-0.5 rounded-full ${statusClass}">${item.Status}</span></td>
                    <td class="px-6 py-4 space-x-2">${actionsHTML}</td>
                </tr>`;

            // Cards com nova ordem de informações
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
                        <p><strong>Responsável:</strong> ${item.Emaf_Equipe?.Nome || 'N/A'}</p>
                        <p><strong>Lote:</strong> ${item.Lote || 'N/A'} | <strong>Container:</strong> ${item.Container || 'N/A'}</p>
                        <p><strong>Quantidade:</strong> ${formatQuantity(item.Quantidade)} Kg</p>
                    </div>
                    <div class="flex justify-end pt-2 mt-2 border-t dark:border-gray-600 space-x-2">${actionsHTML}</div>
                </div>`;
        });
    }

    // --- Manipulação de Formulários e Modais ---
    
    // **NOVA FUNÇÃO ADICIONADA**
    // Função para controlar a visibilidade da lista e do formulário
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

   function setupForm(type, id = null) {
        // Esconde o container da lista/tabela e mostra o container do formulário.
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
        
        if (id) {
            const dataArray = { equipe: equipeData, clientes: clientesData, produtos: produtosData, estoque: estoqueData }[type];
            const item = dataArray.find(d => d.Id == id);
            if(item) populateForm(form, item);
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
                        preview.src = `${NOCODB_BASE_URL}/${data[key][0].signedPath}`;
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

   async function handleFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const type = form.id.replace('-form', ''); 
        const id = document.getElementById(`${type}-Id`).value;
        const method = id ? 'PATCH' : 'POST';

        const tableName = TABLE_NAME_MAP[type];
        if (!tableName) {
            alert(`Erro interno: Tipo de formulário desconhecido "${type}".`);
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
                    throw new Error(`O campo "${el.labels[0]?.textContent || key}" é obrigatório.`);
                }
                
                if (el.id === 'estoque-Quantidade') {
                    if (value) {
                        const sanitizedValue = value.replace(/\./g, '').replace(',', '.');
                        const numericValue = parseFloat(sanitizedValue);
                        if (isNaN(numericValue)) {
                            throw new Error('O valor do campo "Quantidade" é inválido.');
                        }
                        body[key] = numericValue;
                    } else {
                        body[key] = 0;
                    }
                } else if (el.tagName === 'SELECT' && key.startsWith('Emaf_')) {
                    const relationId = parseInt(value);
                    if (!relationId && el.required) throw new Error(`O campo "${el.labels[0]?.textContent || key}" é obrigatório.`);
                    
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

            const fileInputs = form.querySelectorAll('input[type="file"]');
            for (const fileInput of fileInputs) {
                if (fileInput.files.length > 0) {
                    const columnName = fileInput.id.replace(`${type}-`, '');
                    const uploadTableName = TABLE_NAME_MAP[type];
                    const fileData = await uploadFile(uploadTableName, columnName, fileInput.files[0]);
                    if (fileData) body[columnName] = [fileData];
                } else if (fileInput.required) {
                     throw new Error(`O campo "${fileInput.labels[0]?.textContent || fileInput.id}" é obrigatório.`);
                }
            }
            if(type === 'equipe' && id && (body.Senha === '' || typeof body.Senha === 'undefined')) {
                delete body.Senha;
            } else if (type === 'equipe' && !id && !body.Senha) {
                throw new Error("O campo Senha é obrigatório para novos membros.");
            }

            const result = await nocoFetch(endpoint, { method, body: JSON.stringify(body) });
            
            if (result) {
                await fetchAllData();
                setupFormAndListVisibility(type, false);
            }
        } catch (error) {
            alert(`Erro ao salvar: ${error.message}`);
        } finally {
            hideLoadingOverlay();
        }
    }
   function openDetailsModal(element) {
        const id = element.dataset.id;
        const type = element.dataset.type;
        const dataArray = { equipe: equipeData, clientes: clientesData, produtos: produtosData, estoque: estoqueData }[type];
        const data = dataArray.find(d => d.Id == id);
        if (!data) return;

        activeDeleteItem = { id, type, element };
        document.getElementById('details-modal-actions').classList.add('hidden'); // Botões já estão ocultos via HTML, mas isso garante.
        
        document.getElementById('modal-title').textContent = `Detalhes de ${type}`;
        
        let contentHTML = '';
        
        const formatValue = (key, value) => {
            const keyLower = key.toLowerCase();
            if (key === 'Id' || key.startsWith('nc_') || key.endsWith('_id') || keyLower === 'senha' || keyLower === 'createdat' || keyLower === 'updatedat') return '';

            const label = GLOBAL_LABEL_MAP[keyLower] || key;
            let displayValue = value;

            if (typeof value === 'object' && value !== null) {
                if(Array.isArray(value) && value.length > 0 && value[0]?.signedPath) {
                    // --- CORREÇÃO AQUI ---
                    // Adiciona o onclick="showImageModal(this.src)" e a classe cursor-pointer
                    const images = value.map(file => 
                        `<img src="${NOCODB_BASE_URL}/${file.signedPath}" class="w-24 h-24 object-cover inline-block m-1 border rounded cursor-pointer" onclick="showImageModal(this.src)" alt="${label}">`
                    ).join('');
                    return `<div class="mt-2"><p class="font-bold">${label}:</p>${images}</div>`;
                } else {
                    displayValue = value.Nome || value.Cliente || value.Produto || 'N/A';
                }
            }
            if (key.toLowerCase().includes('data') && displayValue && displayValue !== 'N/A') {
                displayValue = new Date(displayValue).toLocaleString('pt-BR');
            }
             if (keyLower === 'quantidade' && (typeof displayValue === 'number')) {
                 displayValue = displayValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
            }

            return `<p><strong>${label}:</strong> ${displayValue || 'N/A'}</p>`;
        };

        if (type === 'estoque') {
            const order = ['Data', 'Emaf_Clientes', 'Emaf_Equipe', 'Emaf_Produto', 'Lote', 'Container', 'Quantidade', 'Status', 'Observacao', 'Etiqueta', 'Foto_Produto', 'Foto_Local', 'Foto_Veiculo'];
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
            await fetchAllData();
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
        document.getElementById('confirm-logout-btn')?.addEventListener('click', () => { sessionStorage.clear(); location.reload(); });
        
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
            if (!actionBtn) return;
            
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
    }

    // --- Inicialização ---
    setupEventListeners();
    checkSession();
});