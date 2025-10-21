document.addEventListener('DOMContentLoaded', function() {
    // --- Configuração da API ---
    // Substitua pela sua URL da função Netlify e URL base do NocoDB
    const API_URL = '/.netlify/functions/api';
    const API_TOKEN = null; // O token será tratado pela função Netlify
    const NocoDB_BaseURL = 'https://lumitechia-nocodb.aeenwc.easypanel.host';

    // --- Variáveis Globais de Dados ---
    let equipeData = [];
    let clientesData = [];
    let produtosData = [];
    let estoqueData = [];
    let loggedInUser = null;

    // --- Variáveis de Estado da UI ---
    let activeCard = null; // Para cards de Equipe, Clientes, Produtos
    let activeTableRow = null; // Para linhas da tabela de Estoque
    let activeDeleteItem = { id: null, type: null, element: null };

    // --- Mapeamento de Nomes de Campos para Rótulos Amigáveis ---
    const GLOBAL_LABEL_MAP = {
        nome: 'Nome',
        login: 'Login',
        role: 'Função',
        cliente: 'Cliente',
        cnpj: 'CNPJ',
        razao_social: 'Razão Social',
        produto: 'Produto',
        emaf_equipe: 'Responsável',
        emaf_clientes: 'Cliente',
        emaf_produto: 'Produto',
        data: 'Data',
        lote: 'Lote',
        etiqueta: 'Etiqueta',
        qtde: 'Quantidade (Kg)',
        container: 'Container',
        status: 'Status',
        observacao: 'Observação',
        foto_produto: 'Foto do Produto',
        foto_local: 'Foto do Local',
        foto_veiculo: 'Foto do Veículo'
    };


    // --- Funções de API e Utilitários ---

    async function nocoFetch(endpoint, options = {}) {
        try {
            const separator = endpoint.includes('?') ? '&' : '?';
            const urlWithLimit = `${API_URL}/${endpoint}${separator}limit=2000`; // Aumentado o limite

            const response = await fetch(urlWithLimit, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });
            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData.msg || (Array.isArray(errorData) && errorData[0] ? errorData[0].msg : response.statusText);
                throw new Error(errorMessage);
            }
            if (options.method === 'DELETE' || response.status === 204) {
                return { success: true };
            }
            return await response.json();
        } catch (error) {
            console.error(`Falha no fetch para ${endpoint}:`, error);
            alert(`Ocorreu um erro de comunicação com o servidor. Detalhes: ${error.message}`);
            return null;
        }
    }

    async function uploadFile(tableName, columnName, file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                try {
                    const base64File = reader.result.split(',')[1];
                    const projectPath = 'Consultoria_DB';
                    const path = `${projectPath}/${tableName}/${columnName}`;

                    const response = await fetch('/.netlify/functions/upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            file: base64File,
                            fileName: file.name,
                            fileType: file.type,
                            path: path,
                        }),
                    });

                    if (!response.ok) throw new Error('Falha no upload do servidor.');
                    const result = await response.json();
                    resolve(Array.isArray(result) ? result[0] : result);
                } catch (err) {
                    console.error("Erro no upload: ", err);
                    reject(err);
                }
            };
            reader.onerror = error => reject(error);
        });
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
        
        // Popula os selects dos filtros e formulários
        populateSelects();

        // Renderiza as telas
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
        const result = await nocoFetch('Emaf_Clientes?nested[all]=true');
        clientesData = (result && result.list) ? result.list.sort((a, b) => a.Cliente.localeCompare(b.Cliente)) : [];
    }
    async function fetchProdutos() {
        const result = await nocoFetch('Emaf_Produto?nested[all]=true');
        produtosData = (result && result.list) ? result.list.sort((a, b) => a.Produto.localeCompare(b.Produto)) : [];
    }
    async function fetchEstoque() {
        const result = await nocoFetch('Emaf_Estoque?nested[all]=true');
        estoqueData = (result && result.list) ? result.list : [];
    }

    // --- Autenticação e Sessão ---

    async function handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        if (!username || !password) {
            alert('Por favor, preencha usuário e senha.');
            return;
        }
        showLoadingOverlay('Autenticando...');
        
        const endpoint = `Emaf_Equipe?where=(Login,eq,${username})~and(Senha,eq,${password})`;
        const result = await nocoFetch(endpoint);
        const user = (result && result.list && result.list.length > 0) ? result.list[0] : null;

        if (user) {
            sessionStorage.setItem('loggedInUser', JSON.stringify(user));
            await initializeUserSession(user);
        } else {
            hideLoadingOverlay();
            alert('Usuário ou senha inválidos.');
        }
    }
    
    async function initializeUserSession(user) {
        loggedInUser = user;
        document.getElementById('logged-user-name').textContent = loggedInUser.Nome;
        document.getElementById('logged-user-role').textContent = loggedInUser.Role;

        const userAvatar = document.querySelector('#main-app header img');
        if (userAvatar && loggedInUser.Foto && loggedInUser.Foto[0]?.signedPath) {
            userAvatar.src = `${NocoDB_BaseURL}/${loggedInUser.Foto[0].signedPath}`;
        }

        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');

        // Controle de acesso a funcionalidades
        const isGestaoOrAdmin = ['Admin', 'Gestão'].includes(loggedInUser.Role);
        document.querySelectorAll('#show-equipe-form, #show-clientes-form, #show-produtos-form').forEach(btn => {
            btn.style.display = isGestaoOrAdmin ? 'block' : 'none';
        });

        await fetchAllData();
        navigateTo(sessionStorage.getItem('currentPage') || 'estoque');
        hideLoadingOverlay();
    }

    async function checkSession() {
        const userString = sessionStorage.getItem('loggedInUser');
        if (userString) {
            showLoadingOverlay('Restaurando sessão...');
            await initializeUserSession(JSON.parse(userString));
        }
    }

    // --- Funções de Navegação e UI ---

    function navigateTo(targetId) {
        document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));
        document.getElementById(targetId)?.classList.remove('hidden');
        
        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.remove('bg-brand-gold', 'text-white');
            l.classList.add('text-gray-400');
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
    
    function populateSelects() {
        const createOptions = (data, valueField, textField, defaultText) => {
            let options = `<option value="">${defaultText}</option>`;
            data.forEach(item => {
                options += `<option value="${item[valueField]}">${item[textField]}</option>`;
            });
            return options;
        };

        document.querySelectorAll('.equipe-select').forEach(el => el.innerHTML = createOptions(equipeData, 'Id', 'Nome', 'Selecione...'));
        document.querySelectorAll('.cliente-select').forEach(el => el.innerHTML = createOptions(clientesData, 'Id', 'Cliente', 'Selecione...'));
        document.querySelectorAll('.produto-select').forEach(el => el.innerHTML = createOptions(produtosData, 'Id', 'Produto', 'Selecione...'));
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

        const filtered = estoqueData.filter(item => 
            (!startDate || item.Data.slice(0, 10) >= startDate) &&
            (!endDate || item.Data.slice(0, 10) <= endDate) &&
            (!clienteId || item.Emaf_Clientes?.Id == clienteId) &&
            (!produtoId || item.Emaf_Produto?.Id == produtoId) &&
            (!status || item.Status === status)
        );

        renderEstoque(filtered);
    }

    function renderCards(type, data) {
        const container = document.getElementById(`${type}-cards-container`);
        if (!container) return;

        container.innerHTML = data.map(item => {
            let title, subtitle, fotoUrl;
            switch(type) {
                case 'equipe':
                    title = item.Nome;
                    subtitle = item.Role;
                    fotoUrl = (item.Foto && item.Foto[0]?.signedPath) ? `${NocoDB_BaseURL}/${item.Foto[0].signedPath}` : `https://i.pravatar.cc/150?u=${item.Login}`;
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
                <button class="card-edit-btn text-blue-500" data-type="${type}" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="card-delete-btn text-red-500" data-type="${type}" title="Apagar"><i class="fas fa-trash"></i></button>
            ` : '';

            return `
                <div class="generic-card bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col items-center text-center" data-id="${item.Id}" data-type="${type}">
                    <img src="${fotoUrl}" class="w-24 h-24 rounded-full object-cover mb-4">
                    <h4 class="font-bold text-lg text-gray-800 dark:text-white">${title}</h4>
                    <p class="text-sm text-gray-500 dark:text-gray-400">${subtitle}</p>
                    <div class="flex space-x-4 mt-auto pt-4">
                        <button class="card-details-btn text-gray-500" data-type="${type}" title="Ver Detalhes"><i class="fas fa-eye"></i></button>
                        ${actionsHTML}
                    </div>
                </div>`;
        }).join('');
    }

    function renderEstoque(data) {
        const tbody = document.getElementById('estoque-table-body');
        const cardsContainer = document.getElementById('estoque-cards-container');
        tbody.innerHTML = '';
        cardsContainer.innerHTML = '';

        const getStatusClass = (status) => status === 'Recebido' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800';
        
        data.forEach(item => {
            const statusClass = getStatusClass(item.Status);
            const dataFormatada = new Date(item.Data).toLocaleString('pt-BR');
            const isGestaoOrAdmin = ['Admin', 'Gestão'].includes(loggedInUser.Role);
            const actionsHTML = isGestaoOrAdmin ? `
                <button class="table-details-btn text-gray-500" data-type="estoque" title="Ver Detalhes"><i class="fas fa-eye"></i></button>
                <button class="table-edit-btn text-blue-500" data-type="estoque" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="table-delete-btn text-red-500" data-type="estoque" title="Apagar"><i class="fas fa-trash"></i></button>
            ` : `<button class="table-details-btn text-gray-500" data-type="estoque" title="Ver Detalhes"><i class="fas fa-eye"></i></button>`;

            // Tabela
            tbody.innerHTML += `
                <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700" data-id="${item.Id}">
                    <td class="px-6 py-4">${item.Emaf_Produto?.Produto || 'N/A'}</td>
                    <td class="px-6 py-4">${item.Emaf_Clientes?.Cliente || 'N/A'}</td>
                    <td class="px-6 py-4">${item.Emaf_Equipe?.Nome || 'N/A'}</td>
                    <td class="px-6 py-4">${dataFormatada}</td>
                    <td class="px-6 py-4">${item.Qtde}</td>
                    <td class="px-6 py-4"><span class="text-xs font-semibold px-2 py-0.5 rounded-full ${statusClass}">${item.Status}</span></td>
                    <td class="px-6 py-4 space-x-2">${actionsHTML}</td>
                </tr>`;

            // Cards
            cardsContainer.innerHTML += `
                <div class="p-4 bg-white rounded-lg shadow dark:bg-gray-800 border dark:border-gray-700" data-id="${item.Id}">
                    <div class="flex justify-between items-start">
                        <p class="text-lg font-semibold text-gray-900 dark:text-white">${item.Emaf_Produto?.Produto || 'N/A'}</p>
                        <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${statusClass}">${item.Status}</span>
                    </div>
                    <div class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        <p><strong>Cliente:</strong> ${item.Emaf_Clientes?.Cliente || 'N/A'}</p>
                        <p><strong>Data:</strong> ${dataFormatada}</p>
                        <p><strong>Quantidade:</strong> ${item.Qtde} Kg</p>
                    </div>
                    <div class="flex justify-end pt-2 mt-2 border-t dark:border-gray-600 space-x-2">${actionsHTML}</div>
                </div>`;
        });
    }

    // --- Manipulação de Formulários e Modais ---

    function setupForm(type, id = null) {
        const formContainer = document.getElementById(`${type}-form-container`);
        const cardsContainer = document.getElementById(`${type}-cards-container`);
        const form = document.getElementById(`${type}-form`);
        const title = document.getElementById(`${type}-form-title`);
        
        form.reset();
        document.getElementById(`${type}-id`).value = id || '';
        title.textContent = id ? `Editar ${type.charAt(0).toUpperCase() + type.slice(1)}` : `Novo ${type.charAt(0).toUpperCase() + type.slice(1)}`;

        if (id) {
            let item;
            if (type === 'equipe') item = equipeData.find(d => d.Id == id);
            else if (type === 'clientes') item = clientesData.find(d => d.Id == id);
            else if (type === 'produtos') item = produtosData.find(d => d.Id == id);
            else if (type === 'estoque') item = estoqueData.find(d => d.Id == id);
            
            if (item) {
                Object.keys(item).forEach(key => {
                    const input = form.querySelector(`#${type}-${key.toLowerCase()}`);
                    if (input) {
                        if (key.startsWith('Foto') || key === 'Etiqueta') {
                            const preview = form.querySelector(`#${type}-${key.toLowerCase()}-preview`);
                            if (item[key] && item[key][0]?.signedPath) {
                                preview.src = `${NocoDB_BaseURL}/${item[key][0].signedPath}`;
                                preview.classList.remove('hidden');
                            } else {
                                preview.classList.add('hidden');
                            }
                        } else if (key.startsWith('Emaf_')) {
                           input.value = item[key]?.Id || '';
                        } else {
                           input.value = item[key];
                        }
                    }
                });
                 if (type === 'estoque') { // Formatação especial para datetime-local
                    const dataInput = document.getElementById('estoque-data');
                    if (item.Data) {
                        const d = new Date(item.Data);
                        // Ajusta para o fuso horário local antes de formatar
                        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                        dataInput.value = d.toISOString().slice(0, 16);
                    }
                }
            }
        }
        
        cardsContainer.classList.add('hidden');
        formContainer.classList.remove('hidden');
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const type = form.id.replace('-form', '');
        const id = document.getElementById(`${type}-id`).value;
        const method = id ? 'PATCH' : 'POST';
        const endpoint = id ? `Emaf_${capitalize(type)}/${id}` : `Emaf_${capitalize(type)}`;
        
        showLoadingOverlay('Salvando...');
        
        let body = {};
        const formData = new FormData(form);

        for (let [key, value] of formData.entries()) {
             body[key] = value;
        }

        // Mapeamento específico para cada formulário
        try {
            if (type === 'equipe') {
                body = {
                    Nome: form.querySelector('#equipe-nome').value,
                    Login: form.querySelector('#equipe-login').value,
                    Role: form.querySelector('#equipe-role').value
                };
                const senha = form.querySelector('#equipe-senha').value;
                if (senha) body.Senha = senha;
                
                const fileInput = form.querySelector('#equipe-foto');
                if (fileInput.files[0]) {
                    const fileData = await uploadFile('Emaf_Equipe', 'Foto', fileInput.files[0]);
                    if (fileData) body.Foto = [fileData];
                }
            } else if (type === 'clientes') {
                body = {
                    Cliente: form.querySelector('#clientes-cliente').value,
                    Cnpj: form.querySelector('#clientes-cnpj').value,
                    Razao_Social: form.querySelector('#clientes-razao').value,
                };
            } else if (type === 'produtos') {
                body = { Produto: form.querySelector('#produtos-produto').value };
            } else if (type === 'estoque') {
                const dataValue = form.querySelector('#estoque-data').value;
                body = {
                    Data: new Date(dataValue).toISOString(),
                    Lote: form.querySelector('#estoque-lote').value,
                    Qtde: parseFloat(form.querySelector('#estoque-qtde').value),
                    Container: form.querySelector('#estoque-container').value,
                    Status: form.querySelector('#estoque-status').value,
                    Observacao: form.querySelector('#estoque-observacao').value
                };

                // Tratamento de chaves estrangeiras
                const equipeId = parseInt(form.querySelector('#estoque-equipe').value);
                const clienteId = parseInt(form.querySelector('#estoque-cliente').value);
                const produtoId = parseInt(form.querySelector('#estoque-produto').value);
                
                if (id) { // Edição
                    body.Emaf_Equipe_id = equipeId;
                    body.Emaf_Clientes_id = clienteId;
                    body.Emaf_Produto_id = produtoId;
                } else { // Criação
                    body.Emaf_Equipe = { "Id": equipeId };
                    body.Emaf_Clientes = { "Id": clienteId };
                    body.Emaf_Produto = { "Id": produtoId };
                }

                // Upload de arquivos
                const fileInputs = [
                    { id: 'estoque-etiqueta', col: 'Etiqueta' },
                    { id: 'estoque-foto-produto', col: 'Foto_Produto' },
                    { id: 'estoque-foto-local', col: 'Foto_Local' },
                    { id: 'estoque-foto-veiculo', col: 'Foto_Veiculo' }
                ];
                for (const inputInfo of fileInputs) {
                    const fileInput = form.querySelector(`#${inputInfo.id}`);
                    if (fileInput.files[0]) {
                        const fileData = await uploadFile('Emaf_Estoque', inputInfo.col, fileInput.files[0]);
                        if (fileData) body[inputInfo.col] = [fileData];
                    }
                }
            }

            const result = await nocoFetch(endpoint, { method, body: JSON.stringify(body) });
            if (result) {
                await fetchAllData();
                document.getElementById(`${type}-form-container`).classList.add('hidden');
                document.getElementById(`${type === 'estoque' ? 'estoque-table-body' : type + '-cards-container'}`).closest('.page').querySelector('div:first-child + div').classList.remove('hidden');
                if (type === 'estoque') {
                   document.getElementById('estoque-cards-container').classList.remove('hidden');
                   document.querySelector('#estoque .relative.overflow-x-auto').classList.remove('hidden');
                }
            }
        } catch (error) {
            alert(`Erro ao salvar: ${error.message}`);
        } finally {
            hideLoadingOverlay();
            // Garante que o formulário é escondido e a lista/tabela reaparece
            document.getElementById(`${type}-form-container`).classList.add('hidden');
            const listContainer = document.getElementById(`${type === 'estoque' ? 'estoque' : type}-cards-container`)?.parentElement;
            listContainer?.querySelector('div:not([id*="form-container"])')?.classList.remove('hidden');
            if (type === 'estoque') applyAndRenderEstoque();
        }
    }

    function openDetailsModal(element) {
        const id = element.dataset.id;
        const type = element.dataset.type;
        let data, dataArray;

        switch(type) {
            case 'equipe': dataArray = equipeData; break;
            case 'clientes': dataArray = clientesData; break;
            case 'produtos': dataArray = produtosData; break;
            case 'estoque': dataArray = estoqueData; break;
            default: return;
        }

        data = dataArray.find(d => d.Id == id);
        if (!data) return;

        activeDeleteItem = { id, type, element };
        document.getElementById('modal-title').textContent = `Detalhes de ${type}`;
        
        let contentHTML = '';
        for (const key in data) {
            if (key === 'Id' || key.startsWith('nc_') || key.endsWith('_id')) continue;
            
            const label = GLOBAL_LABEL_MAP[key.toLowerCase()] || key;
            let value = data[key];

            if (typeof value === 'object' && value !== null) {
                if(Array.isArray(value) && value.length > 0 && value[0]?.signedPath) {
                    contentHTML += `<p><strong>${label}:</strong></p>`;
                    value.forEach(file => {
                        contentHTML += `<a href="${NocoDB_BaseURL}/${file.signedPath}" target="_blank"><img src="${NocoDB_BaseURL}/${file.signedPath}" class="w-24 h-24 object-cover inline-block m-1 border rounded"></a>`;
                    });
                    continue; // Pula o parágrafo padrão
                } else {
                    value = value.Nome || value.Cliente || value.Produto || JSON.stringify(value);
                }
            }
            if (key.toLowerCase().includes('data')) {
                value = new Date(value).toLocaleString('pt-BR');
            }
            contentHTML += `<p><strong>${label}:</strong> ${value || 'N/A'}</p>`;
        }
        
        document.getElementById('modal-content').innerHTML = contentHTML;
        showModal(document.getElementById('details-modal'));
    }

    async function handleDelete() {
        if (!activeDeleteItem) return;

        const { id, type, element } = activeDeleteItem;
        const endpoint = `Emaf_${capitalize(type)}/${id}`;

        showLoadingOverlay('Apagando...');
        const result = await nocoFetch(endpoint, { method: 'DELETE' });
        hideLoadingOverlay();
        
        if (result && result.success) {
            element?.remove();
            await fetchAllData(); // Recarrega tudo para garantir consistência
        } else {
            alert('Falha ao apagar o registro.');
        }

        hideModal(document.getElementById('delete-confirm-modal'));
        hideModal(document.getElementById('details-modal'));
        activeDeleteItem = null;
    }

    function capitalize(s) {
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

        // Forms
        document.querySelectorAll('form[id$="-form"]').forEach(form => {
             if (form.id !== 'login-form') form.addEventListener('submit', handleFormSubmit);
        });

        // Botões de "Novo"
        document.getElementById('show-equipe-form')?.addEventListener('click', () => setupForm('equipe'));
        document.getElementById('show-clientes-form')?.addEventListener('click', () => setupForm('clientes'));
        document.getElementById('show-produtos-form')?.addEventListener('click', () => setupForm('produtos'));
        document.getElementById('show-estoque-form')?.addEventListener('click', () => setupForm('estoque'));

        // Botões de "Cancelar" dos formulários
        document.querySelectorAll('button[id^="cancel-"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.id.split('-')[1];
                const formContainer = document.getElementById(`${type}-form-container`);
                const listContainer = document.getElementById(`${type === 'estoque' ? 'estoque' : type}-cards-container`)?.parentElement;
                
                formContainer.classList.add('hidden');
                listContainer.querySelector('div:not([id*="form-container"])')?.classList.remove('hidden');
                if (type === 'estoque') {
                   document.querySelector('#estoque .relative.overflow-x-auto').classList.remove('hidden');
                }
            });
        });

        // Modals
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
            showModal(document.getElementById('details-modal'));
        });
        document.getElementById('confirm-delete-btn')?.addEventListener('click', handleDelete);
        
        // Listeners em containers para delegação de eventos
        document.body.addEventListener('click', function(e) {
            const cardDetailsBtn = e.target.closest('.card-details-btn');
            const cardEditBtn = e.target.closest('.card-edit-btn');
            const cardDeleteBtn = e.target.closest('.card-delete-btn');
            const tableDetailsBtn = e.target.closest('.table-details-btn');
            const tableEditBtn = e.target.closest('.table-edit-btn');
            const tableDeleteBtn = e.target.closest('.table-delete-btn');

            if (cardDetailsBtn) {
                const card = cardDetailsBtn.closest('.generic-card');
                openDetailsModal(card);
            } else if (cardEditBtn) {
                const card = cardEditBtn.closest('.generic-card');
                setupForm(card.dataset.type, card.dataset.id);
            } else if (cardDeleteBtn) {
                const card = cardDeleteBtn.closest('.generic-card');
                activeDeleteItem = { id: card.dataset.id, type: card.dataset.type, element: card };
                showModal(document.getElementById('delete-confirm-modal'));
            } else if (tableDetailsBtn) {
                const row = tableDetailsBtn.closest('tr');
                openDetailsModal(row);
            } else if (tableEditBtn) {
                const row = tableEditBtn.closest('tr');
                setupForm(row.dataset.type, row.dataset.id);
            } else if (tableDeleteBtn) {
                const row = tableDeleteBtn.closest('tr');
                activeDeleteItem = { id: row.dataset.id, type: tableDeleteBtn.dataset.type, element: row };
                showModal(document.getElementById('delete-confirm-modal'));
            }
        });

        // Filtros e buscas
        document.getElementById('equipe-search')?.addEventListener('input', applyAndRenderEquipe);
        document.getElementById('clientes-search')?.addEventListener('input', applyAndRenderClientes);
        document.getElementById('produtos-search')?.addEventListener('input', applyAndRenderProdutos);
        document.querySelectorAll('#estoque .grid select, #estoque .grid input[type="date"]').forEach(el => {
            el.addEventListener('change', applyAndRenderEstoque);
        });
    }

    // --- Inicialização ---
    setupEventListeners();
    checkSession();
});