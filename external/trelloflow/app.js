/* TrelloFlow - Lógica do Aplicativo */

// ==========================================
// 1. Definições de Cores e Gradientes
// ==========================================
const BOARD_BG_PRESETS = [
  { class: 'bg-gradient-blue', value: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' },
  { class: 'bg-gradient-purple', value: 'linear-gradient(135deg, #3f2b96 0%, #a8c0ff 100%)' },
  { class: 'bg-gradient-sunset', value: 'linear-gradient(135deg, #e65c00 0%, #f9d423 100%)' },
  { class: 'bg-gradient-ocean', value: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)' },
  { class: 'bg-gradient-forest', value: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { class: 'bg-gradient-dark', value: 'linear-gradient(135deg, #1f1f2e 0%, #111116 100%)' }
];

const CARD_COVER_PRESETS = [
  { name: 'Nenhum', color: 'transparent' },
  { name: 'Azul', color: '#5865f2' },
  { name: 'Verde', color: '#23a55a' },
  { name: 'Amarelo', color: '#f0b232' },
  { name: 'Laranja', color: '#e65c00' },
  { name: 'Vermelho', color: '#f23f43' },
  { name: 'Roxo', color: '#9b5de5' },
  { name: 'Rosa', color: '#f15bb5' },
  { name: 'Gradiente Noite', color: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)' },
  { name: 'Gradiente Neon', color: 'linear-gradient(135deg, #f72585, #7209b7)' },
  { name: 'Gradiente Aurora', color: 'linear-gradient(135deg, #70e000, #38b000, #007200)' }
];

const LABEL_COLORS = [
  '#23a55a', // Verde
  '#f0b232', // Amarelo
  '#e65c00', // Laranja
  '#f23f43', // Vermelho
  '#9b5de5', // Roxo
  '#5865f2', // Azul
  '#00f5d4', // Ciano
  '#f15bb5', // Rosa
  '#495057'  // Cinza
];

// ==========================================
// 2. Modelo de Estado e Persistência
// ==========================================
let state = {
  boards: [],
  activeBoardId: null,
  labels: [],
  filterQuery: ''
};

// Dados de Demonstração Iniciais
const INITIAL_LABELS = [
  { id: 'lbl-1', name: 'Urgente', color: '#f23f43' },
  { id: 'lbl-2', name: 'Design', color: '#9b5de5' },
  { id: 'lbl-3', name: 'Desenvolvimento', color: '#5865f2' },
  { id: 'lbl-4', name: 'Planejamento', color: '#f0b232' },
  { id: 'lbl-5', name: 'Finalizado', color: '#23a55a' }
];

const getDemoData = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 5);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  return {
    boards: [
      {
        id: 'board-demo-1',
        title: '🚀 Projeto Kanban',
        background: 'bg-gradient-blue',
        lists: [
          {
            id: 'list-1',
            title: 'A Fazer 📋',
            cards: [
              {
                id: 'card-1',
                title: 'Pesquisa de mercado',
                description: 'Realizar levantamento das principais necessidades dos clientes no setor financeiro e criar documento de síntese.',
                cover: '#5865f2',
                labels: ['lbl-4', 'lbl-3'],
                checklist: [
                  { id: 'chk-1', text: 'Definir o questionário da pesquisa', checked: true },
                  { id: 'chk-2', text: 'Entrevistar 10 potenciais clientes', checked: false },
                  { id: 'chk-3', text: 'Elaborar relatório com principais aprendizados', checked: false }
                ],
                comments: [
                  { id: 'c-1', author: 'TF', text: 'Excelente ponto de partida. Vamos focar no público de 18-30 anos inicialmente.', timestamp: new Date(Date.now() - 3600000 * 2).toISOString() }
                ],
                dueDate: tomorrowStr + 'T14:00',
                dueComplete: false
              },
              {
                id: 'card-2',
                title: 'Definir requisitos mínimos (MVP)',
                description: 'Reunir com os stakeholders para alinhar o escopo mínimo viável do produto final.',
                cover: 'transparent',
                labels: ['lbl-4'],
                checklist: [],
                comments: [],
                dueDate: null,
                dueComplete: false
              }
            ]
          },
          {
            id: 'list-2',
            title: 'Em Progresso ⚡',
            cards: [
              {
                id: 'card-3',
                title: 'Design da Interface Principal',
                description: 'Estruturar o fluxo de navegação e desenhar telas de alta fidelidade para as principais jornadas.',
                cover: 'linear-gradient(135deg, #f72585, #7209b7)',
                labels: ['lbl-2'],
                checklist: [
                  { id: 'chk-4', text: 'Wireframes das telas de login', checked: true },
                  { id: 'chk-5', text: 'Mockups em alta fidelidade no Figma', checked: false }
                ],
                comments: [],
                dueDate: nextWeekStr + 'T18:00',
                dueComplete: false
              }
            ]
          },
          {
            id: 'list-3',
            title: 'Em Revisão 🔍',
            cards: [
              {
                id: 'card-4',
                title: 'Revisão jurídica dos termos',
                description: 'Validar os termos de uso e as políticas de privacidade com a assessoria jurídica externa.',
                cover: 'transparent',
                labels: ['lbl-1'],
                checklist: [],
                comments: [
                  { id: 'c-2', author: 'ADV', text: 'Documento inicial recebido. Retornarei com as revisões até amanhã.', timestamp: new Date(Date.now() - 3600000 * 5).toISOString() }
                ],
                dueDate: yesterdayStr + 'T12:00',
                dueComplete: false
              }
            ]
          },
          {
            id: 'list-4',
            title: 'Concluído ✅',
            cards: [
              {
                id: 'card-5',
                title: 'Configurar ambiente de teste',
                description: 'Provisionar recursos em nuvem para staging e pipeline de CI/CD.',
                cover: '#23a55a',
                labels: ['lbl-3', 'lbl-5'],
                checklist: [
                  { id: 'chk-6', text: 'Criar repositório e configurar git', checked: true },
                  { id: 'chk-7', text: 'Configurar deploy automático no staging', checked: true }
                ],
                comments: [],
                dueDate: yesterdayStr + 'T17:00',
                dueComplete: true
              }
            ]
          }
        ]
      },
      {
        id: 'board-demo-2',
        title: '🏠 Planejamento Pessoal',
        background: 'bg-gradient-sunset',
        lists: [
          {
            id: 'list-p1',
            title: 'Ideias 💡',
            cards: [
              {
                id: 'card-p1',
                title: 'Ler livro novo por mês',
                description: 'Meta de leitura para desenvolvimento pessoal.',
                cover: 'transparent',
                labels: [],
                checklist: [],
                comments: [],
                dueDate: null,
                dueComplete: false
              }
            ]
          }
        ]
      }
    ],
    activeBoardId: 'board-demo-1',
    labels: INITIAL_LABELS,
    filterQuery: ''
  };
};

// Funções de Storage
const saveState = () => {
  localStorage.setItem('trelloflow_state', JSON.stringify(state));
};

const loadState = () => {
  const local = localStorage.getItem('trelloflow_state');
  if (local) {
    try {
      state = JSON.parse(local);
      state.filterQuery = ''; // Reseta pesquisa ao carregar
    } catch (e) {
      console.error('Erro ao analisar estado do localStorage, usando dados padrão.', e);
      state = getDemoData();
      saveState();
    }
  } else {
    state = getDemoData();
    saveState();
  }
};

// ==========================================
// 3. Seletores DOM Principais
// ==========================================
const sidebarEl = document.getElementById('sidebar');
const boardsListEl = document.getElementById('boards-list');
const collapseSidebarBtn = document.getElementById('collapse-sidebar-btn');
const expandSidebarBtn = document.getElementById('expand-sidebar-btn');

const addBoardTrigger = document.getElementById('add-board-trigger');
const addBoardForm = document.getElementById('add-board-form');
const cancelBoardBtn = document.getElementById('cancel-board-btn');
const newBoardTitleInput = document.getElementById('new-board-title');
const newBoardBgOptions = document.getElementById('new-board-bg-options');

const boardWrapperEl = document.getElementById('board-wrapper');
const boardTitleEl = document.getElementById('board-title');
const deleteBoardBtn = document.getElementById('delete-board-btn');
const bgGridOptions = document.getElementById('bg-grid-options');

const listsContainerEl = document.getElementById('lists-container');
const addListTrigger = document.getElementById('add-list-trigger');
const addListForm = document.getElementById('add-list-form');
const cancelListBtn = document.getElementById('cancel-list-btn');
const newListTitleInput = document.getElementById('new-list-title');

const searchCardsInput = document.getElementById('search-cards-input');
const clearSearchBtn = document.getElementById('clear-search-btn');

// Elementos do Modal de Cartão
const cardModal = document.getElementById('card-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCardCover = document.getElementById('modal-card-cover');
const modalCardTitle = document.getElementById('modal-card-title');
const modalListName = document.getElementById('modal-list-name');
const modalLabelsSection = document.getElementById('modal-labels-section');
const modalLabelsContainer = document.getElementById('modal-labels-container');
const modalDueDateSection = document.getElementById('modal-due-date-section');
const dueDateCheckbox = document.getElementById('due-date-checkbox');
const dueDateBadge = document.getElementById('due-date-badge');
const dueDateText = document.getElementById('due-date-text');
const dueDateStatus = document.getElementById('due-date-status');

const descView = document.getElementById('desc-view');
const descPlaceholder = document.getElementById('desc-placeholder');
const descTextContent = document.getElementById('desc-text-content');
const descEditForm = document.getElementById('desc-edit-form');
const descTextarea = document.getElementById('desc-textarea');
const saveDescBtn = document.getElementById('save-desc-btn');
const cancelDescBtn = document.getElementById('cancel-desc-btn');

const checklistSection = document.getElementById('checklist-section');
const deleteChecklistBtn = document.getElementById('delete-checklist-btn');
const checklistProgressPercentage = document.getElementById('checklist-progress-percentage');
const checklistProgressFill = document.getElementById('checklist-progress-fill');
const checklistItemsContainer = document.getElementById('checklist-items-container');
const addItemTrigger = document.getElementById('add-item-trigger');
const addItemForm = document.getElementById('add-item-form');
const newItemTextInput = document.getElementById('new-item-text');
const saveItemBtn = document.getElementById('save-item-btn');
const cancelItemBtn = document.getElementById('cancel-item-btn');

const commentTextarea = document.getElementById('comment-textarea');
const saveCommentBtn = document.getElementById('save-comment-btn');
const commentsListContainer = document.getElementById('comments-list-container');

// Ações no Modal (Coluna Direita)
const cardCoverBtn = document.getElementById('card-cover-btn');
const coverPopover = document.getElementById('cover-popover');
const coverOptionsGrid = document.getElementById('cover-options-grid');
const removeCoverBtn = document.getElementById('remove-cover-btn');

const cardLabelsBtn = document.getElementById('card-labels-btn');
const labelsPopover = document.getElementById('labels-popover');
const labelsSelectorList = document.getElementById('labels-selector-list');
const createLabelTrigger = document.getElementById('create-label-trigger');
const createLabelForm = document.getElementById('create-label-form');
const newLabelNameInput = document.getElementById('new-label-name');
const labelColorsPick = document.getElementById('label-colors-pick');
const saveNewLabelBtn = document.getElementById('save-new-label-btn');
const cancelNewLabelBtn = document.getElementById('cancel-new-label-btn');

const cardDateBtn = document.getElementById('card-date-btn');
const datePopover = document.getElementById('date-popover');
const dateForm = document.getElementById('date-form');
const dueDateInput = document.getElementById('due-date-input');
const dueTimeInput = document.getElementById('due-time-input');
const removeDateBtn = document.getElementById('remove-date-btn');

const cardChecklistBtn = document.getElementById('card-checklist-btn');
const deleteCardBtn = document.getElementById('delete-card-btn');

// Estado Local do Modal Ativo
let activeModalCardId = null;
let selectedNewLabelColor = LABEL_COLORS[0];

// ==========================================
// 4. Mecanismo de Renderização e UI
// ==========================================

const getActiveBoard = () => {
  return state.boards.find(b => b.id === state.activeBoardId) || state.boards[0];
};

const renderAll = () => {
  renderSidebar();
  renderBoard();
  lucide.createIcons();
};

// Renderização da Sidebar
const renderSidebar = () => {
  boardsListEl.innerHTML = '';
  
  state.boards.forEach(board => {
    const isActive = board.id === state.activeBoardId;
    const item = document.createElement('div');
    item.className = `board-nav-item ${isActive ? 'active' : ''}`;
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.dataset.boardId = board.id;
    
    // Encontrar fundo para indicador
    const bgPreset = BOARD_BG_PRESETS.find(p => p.class === board.background);
    const bgStyle = bgPreset ? bgPreset.value : 'var(--color-primary)';
    
    item.innerHTML = `
      <div class="board-item-details">
        <span class="board-color-indicator" style="background: ${bgStyle}"></span>
        <span class="board-item-title">${escapeHTML(board.title)}</span>
      </div>
    `;
    
    // Clique para alternar quadro
    const selectBoard = () => {
      state.activeBoardId = board.id;
      saveState();
      renderAll();
    };
    
    item.addEventListener('click', selectBoard);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectBoard();
      }
    });
    
    boardsListEl.appendChild(item);
  });
};

// Renderização do Quadro Ativo
const renderBoard = () => {
  const activeBoard = getActiveBoard();
  if (!activeBoard) {
    // Caso todos quadros tenham sido excluídos
    boardWrapperEl.innerHTML = `
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; text-align: center;">
        <i data-lucide="layout" style="width: 64px; height: 64px; color: var(--text-muted); margin-bottom: 16px;"></i>
        <h2>Nenhum Quadro Encontrado</h2>
        <p style="color: var(--text-muted); margin-top: 8px; margin-bottom: 24px;">Crie um novo quadro no menu lateral para começar.</p>
      </div>
    `;
    return;
  }
  
  // Sincronizar título e fundo
  boardTitleEl.textContent = activeBoard.title;
  
  // Limpar classes de gradiente antigas
  BOARD_BG_PRESETS.forEach(p => {
    boardWrapperEl.classList.remove(p.class);
  });
  
  if (activeBoard.background.startsWith('bg-')) {
    boardWrapperEl.classList.add(activeBoard.background);
    boardWrapperEl.style.backgroundImage = '';
  } else {
    boardWrapperEl.style.backgroundImage = `url(${activeBoard.background})`;
  }
  
  renderLists();
};

// Renderização das Listas e Cartões
const renderLists = () => {
  const activeBoard = getActiveBoard();
  listsContainerEl.innerHTML = '';
  
  if (!activeBoard) return;
  
  activeBoard.lists.forEach((list, listIndex) => {
    const listWrapper = document.createElement('div');
    listWrapper.className = 'list-wrapper';
    listWrapper.dataset.listId = list.id;
    listWrapper.dataset.index = listIndex;
    listWrapper.setAttribute('draggable', 'true');
    
    // Filtrar cartões por busca
    const filteredCards = list.cards.filter(card => {
      if (!state.filterQuery) return true;
      const query = state.filterQuery.toLowerCase();
      const titleMatch = card.title.toLowerCase().includes(query);
      
      // Filtrar também por nome de etiqueta
      const labelMatch = card.labels.some(labelId => {
        const label = state.labels.find(l => l.id === labelId);
        return label && label.name.toLowerCase().includes(query);
      });
      
      return titleMatch || labelMatch;
    });
    
    listWrapper.innerHTML = `
      <header class="list-header" dataset-list-id="${list.id}">
        <div class="list-header-title-container">
          <h2 class="list-title" contenteditable="true" spellcheck="false" title="Clique para editar">${escapeHTML(list.title)}</h2>
        </div>
        <div class="list-header-actions">
          <span class="cards-count">${filteredCards.length}</span>
          <button class="icon-btn delete-list-btn" title="Excluir lista">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </header>
      <div class="cards-list" id="cards-list-${list.id}" dataset-list-id="${list.id}">
        <!-- Cartões renderizados dinamicamente -->
      </div>
      <footer class="list-footer">
        <button class="add-card-trigger-btn">
          <i data-lucide="plus"></i> Adicionar um cartão
        </button>
        <form class="add-card-form hidden">
          <textarea placeholder="Insira um título para este cartão..." required></textarea>
          <div class="form-actions">
            <button type="submit" class="primary-btn">Adicionar cartão</button>
            <button type="button" class="cancel-btn cancel-card-btn">
              <i data-lucide="x"></i>
            </button>
          </div>
        </form>
      </footer>
    `;
    
    const cardsListContainer = listWrapper.querySelector(`.cards-list`);
    
    // Renderizar cartões dentro desta lista
    filteredCards.forEach(card => {
      const cardItem = document.createElement('div');
      cardItem.className = 'card-item';
      cardItem.dataset.cardId = card.id;
      cardItem.dataset.listId = list.id;
      cardItem.setAttribute('draggable', 'true');
      
      // Cover bar
      let coverBarHTML = '';
      if (card.cover && card.cover !== 'transparent') {
        coverBarHTML = `<div class="card-cover-bar" style="background: ${card.cover}"></div>`;
      }
      
      // Labels
      let labelsHTML = '';
      if (card.labels && card.labels.length > 0) {
        labelsHTML = '<div class="card-labels">';
        card.labels.forEach(lblId => {
          const lbl = state.labels.find(l => l.id === lblId);
          if (lbl) {
            labelsHTML += `<span class="card-label-badge" style="background-color: ${lbl.color}" title="${escapeHTML(lbl.name)}">${escapeHTML(lbl.name)}</span>`;
          }
        });
        labelsHTML += '</div>';
      }
      
      // Indicators (checklist, comments, due date)
      let indicatorsHTML = '<div class="card-badges-row">';
      let hasIndicators = false;
      
      // Description Indicator
      if (card.description && card.description.trim() !== '') {
        indicatorsHTML += `<span class="card-badge" title="Este cartão tem uma descrição."><i data-lucide="align-left"></i></span>`;
        hasIndicators = true;
      }
      
      // Comments count
      if (card.comments && card.comments.length > 0) {
        indicatorsHTML += `
          <span class="card-badge" title="Comentários">
            <i data-lucide="message-square"></i> ${card.comments.length}
          </span>`;
        hasIndicators = true;
      }
      
      // Checklist progress
      if (card.checklist && card.checklist.length > 0) {
        const total = card.checklist.length;
        const checked = card.checklist.filter(item => item.checked).length;
        const allDone = checked === total;
        indicatorsHTML += `
          <span class="card-badge ${allDone ? 'due-complete' : ''}" style="${allDone ? 'background-color: var(--color-success); color: white; padding: 1px 4px; border-radius: 3px;' : ''}" title="Checklist: ${checked}/${total}">
            <i data-lucide="check-square"></i> ${checked}/${total}
          </span>`;
        hasIndicators = true;
      }
      
      // Due Date Badge
      if (card.dueDate) {
        const { text, statusClass, statusText } = getDueDateDetails(card.dueDate, card.dueComplete);
        indicatorsHTML += `
          <span class="card-badge due-badge ${statusClass}" title="Prazo: ${text} (${statusText})">
            <i data-lucide="clock"></i> ${text.split(' de ')[0] + ' ' + (text.split(' de ')[1] || '').substring(0, 3)}
          </span>`;
        hasIndicators = true;
      }
      
      indicatorsHTML += '</div>';
      
      cardItem.innerHTML = `
        ${coverBarHTML}
        ${labelsHTML}
        <span class="card-item-title">${escapeHTML(card.title)}</span>
        ${hasIndicators ? indicatorsHTML : ''}
      `;
      
      // Abrir modal ao clicar no cartão (sem arrastar)
      cardItem.addEventListener('click', (e) => {
        // Se clicar em um badge/botão interno, evita re-triggers
        if (e.target.closest('a') || e.target.closest('button')) return;
        openCardDetail(card.id);
      });
      
      // Eventos Drag and Drop para Cartões
      cardItem.addEventListener('dragstart', handleCardDragStart);
      cardItem.addEventListener('dragend', handleCardDragEnd);
      
      cardsListContainer.appendChild(cardItem);
    });
    
    // Eventos Drag and Drop para Listas como colunas
    listWrapper.addEventListener('dragstart', handleListDragStart);
    listWrapper.addEventListener('dragover', handleListDragOver);
    listWrapper.addEventListener('dragleave', handleListDragLeave);
    listWrapper.addEventListener('drop', handleListDrop);
    listWrapper.addEventListener('dragend', handleListDragEnd);
    
    // Configura container de cartões como Drop Zone para Cartões
    cardsListContainer.addEventListener('dragover', handleCardDragOver);
    cardsListContainer.addEventListener('dragleave', handleCardDragLeave);
    cardsListContainer.addEventListener('drop', handleCardDrop);
    
    // Ações dos botões da Lista
    
    // Renomear Lista
    const listTitleEl = listWrapper.querySelector('.list-title');
    listTitleEl.addEventListener('focus', () => {
      // Salva título original
      listTitleEl.dataset.original = listTitleEl.textContent;
    });
    
    listTitleEl.addEventListener('blur', () => {
      const newTitle = listTitleEl.textContent.trim();
      if (newTitle && newTitle !== listTitleEl.dataset.original) {
        list.title = newTitle;
        saveState();
        renderSidebar(); // Atualiza contador/títulos se aplicável
      } else {
        listTitleEl.textContent = list.title;
      }
    });
    
    listTitleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        listTitleEl.blur();
      }
    });
    
    // Excluir Lista
    listWrapper.querySelector('.delete-list-btn').addEventListener('click', () => {
      if (confirm(`Tem certeza de que deseja excluir a lista "${list.title}"?`)) {
        activeBoard.lists.splice(listIndex, 1);
        saveState();
        renderBoard();
        lucide.createIcons();
      }
    });
    
    // Mostrar Form de Cartão
    const addCardTriggerBtn = listWrapper.querySelector('.add-card-trigger-btn');
    const addCardFormEl = listWrapper.querySelector('.add-card-form');
    const cancelCardBtnEl = listWrapper.querySelector('.cancel-card-btn');
    const cardTextarea = listWrapper.querySelector('.add-card-form textarea');
    
    addCardTriggerBtn.addEventListener('click', () => {
      addCardTriggerBtn.classList.add('hidden');
      addCardFormEl.classList.remove('hidden');
      cardTextarea.focus();
    });
    
    cancelCardBtnEl.addEventListener('click', () => {
      addCardFormEl.classList.add('hidden');
      addCardTriggerBtn.classList.remove('hidden');
      cardTextarea.value = '';
    });
    
    // Criar Novo Cartão
    addCardFormEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const cardTitle = cardTextarea.value.trim();
      if (cardTitle) {
        const newCard = {
          id: 'card-' + Date.now() + Math.random().toString(36).substring(2, 7),
          title: cardTitle,
          description: '',
          cover: 'transparent',
          labels: [],
          checklist: [],
          comments: [],
          dueDate: null,
          dueComplete: false
        };
        
        list.cards.push(newCard);
        saveState();
        renderBoard();
        lucide.createIcons();
      }
    });
    
    listsContainerEl.appendChild(listWrapper);
  });
};

// ==========================================
// 5. Drag and Drop Nativo (Lógica)
// ==========================================

let draggedCardId = null;
let sourceListId = null;
let draggedListId = null;

// drag and drop de Cartões
function handleCardDragStart(e) {
  draggedCardId = this.dataset.cardId;
  sourceListId = this.dataset.listId;
  draggedListId = null; // Garante que não mistura com colunas
  
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedCardId);
  
  // Evita conflito com o drag da lista pai
  e.stopPropagation();
}

function handleCardDragEnd(e) {
  this.classList.remove('dragging');
  document.querySelectorAll('.cards-list').forEach(l => l.classList.remove('drag-over'));
}

function handleCardDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  const container = this;
  container.classList.add('drag-over');
  
  // Feedback visual de inserção ordenada
  const afterElement = getDragAfterElement(container, e.clientY);
  const draggingCard = document.querySelector('.card-item.dragging');
  if (draggingCard) {
    if (afterElement == null) {
      container.appendChild(draggingCard);
    } else {
      container.insertBefore(draggingCard, afterElement);
    }
  }
}

function handleCardDragLeave(e) {
  this.classList.remove('drag-over');
}

function handleCardDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');
  
  if (!draggedCardId) return;
  
  const targetListId = this.dataset.listId;
  const container = this;
  
  const activeBoard = getActiveBoard();
  const sourceList = activeBoard.lists.find(l => l.id === sourceListId);
  const targetList = activeBoard.lists.find(l => l.id === targetListId);
  
  if (!sourceList || !targetList) return;
  
  // Localizar cartão
  const cardIndex = sourceList.cards.findIndex(c => c.id === draggedCardId);
  if (cardIndex === -1) return;
  
  const [draggedCard] = sourceList.cards.splice(cardIndex, 1);
  
  // Descobrir a nova posição
  const afterElement = getDragAfterElement(container, e.clientY);
  if (afterElement == null) {
    targetList.cards.push(draggedCard);
  } else {
    const targetCardId = afterElement.dataset.cardId;
    const targetIndex = targetList.cards.findIndex(c => c.id === targetCardId);
    targetList.cards.splice(targetIndex, 0, draggedCard);
  }
  
  // Atualizar o ID da lista no cartão
  draggedCard.listId = targetListId;
  
  saveState();
  
  // Limpa estados de drag
  draggedCardId = null;
  sourceListId = null;
  
  // Renderizar o quadro novamente para organizar dados
  renderBoard();
  lucide.createIcons();
}

// Auxiliar para detectar onde enfiar o cartão no meio da lista
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.card-item:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}


// Drag and drop de Listas (Colunas)
function handleListDragStart(e) {
  if (e.target.closest('.card-item')) {
    e.preventDefault();
    return; // Evita iniciar drag de coluna se clicou no cartão
  }
  
  draggedListId = this.dataset.listId;
  draggedCardId = null;
  
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleListDragEnd(e) {
  this.classList.remove('dragging');
  document.querySelectorAll('.list-wrapper').forEach(w => w.classList.remove('drag-over'));
}

function handleListDragOver(e) {
  e.preventDefault();
  if (!draggedListId) return; // Se arrastando cartão, ignora
  
  this.classList.add('drag-over');
}

function handleListDragLeave(e) {
  this.classList.remove('drag-over');
}

function handleListDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');
  
  if (!draggedListId) return;
  
  const targetListId = this.dataset.listId;
  if (draggedListId === targetListId) return;
  
  const activeBoard = getActiveBoard();
  const sourceIndex = activeBoard.lists.findIndex(l => l.id === draggedListId);
  const targetIndex = activeBoard.lists.findIndex(l => l.id === targetListId);
  
  if (sourceIndex === -1 || targetIndex === -1) return;
  
  // Reordenar
  const [draggedList] = activeBoard.lists.splice(sourceIndex, 1);
  activeBoard.lists.splice(targetIndex, 0, draggedList);
  
  saveState();
  draggedListId = null;
  renderBoard();
  lucide.createIcons();
}

// ==========================================
// 6. Modal de Detalhes do Cartão (Lógica)
// ==========================================

const getCardById = (cardId) => {
  const activeBoard = getActiveBoard();
  if (!activeBoard) return null;
  for (let list of activeBoard.lists) {
    const card = list.cards.find(c => c.id === cardId);
    if (card) return { card, list };
  }
  return null;
};

const openCardDetail = (cardId) => {
  const result = getCardById(cardId);
  if (!result) return;
  
  const { card, list } = result;
  activeModalCardId = cardId;
  
  // Preencher título e lista
  modalCardTitle.value = card.title;
  modalListName.textContent = list.title;
  
  // Capa
  updateModalCoverUI(card.cover);
  
  // Descrição
  descTextarea.value = card.description || '';
  if (card.description && card.description.trim() !== '') {
    descTextContent.textContent = card.description;
    descPlaceholder.classList.add('hidden');
    descTextContent.classList.remove('hidden');
  } else {
    descPlaceholder.classList.remove('hidden');
    descTextContent.classList.add('hidden');
  }
  descEditForm.classList.add('hidden');
  descView.classList.remove('hidden');
  
  // Etiquetas
  renderModalLabels(card.labels);
  
  // Prazo (Due Date)
  renderModalDueDate(card.dueDate, card.dueComplete);
  
  // Checklist
  renderModalChecklist(card.checklist);
  
  // Comentários
  renderModalComments(card.comments);
  
  // Mostrar o diálogo modal nativo
  cardModal.showModal();
  lucide.createIcons();
};

// Fechar Modal
const closeCardModal = () => {
  cardModal.close();
  activeModalCardId = null;
  renderBoard(); // Salva estado visual no grid principal
  lucide.createIcons();
};

modalCloseBtn.addEventListener('click', closeCardModal);

// Salvar Título do Cartão no Modal
modalCardTitle.addEventListener('blur', () => {
  const newTitle = modalCardTitle.value.trim();
  if (newTitle && activeModalCardId) {
    const result = getCardById(activeModalCardId);
    if (result) {
      result.card.title = newTitle;
      saveState();
    }
  }
});

modalCardTitle.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    modalCardTitle.blur();
  }
});

// Lógica de Descrição
descView.addEventListener('click', () => {
  descView.classList.add('hidden');
  descEditForm.classList.remove('hidden');
  descTextarea.focus();
});

cancelDescBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  descEditForm.classList.add('hidden');
  descView.classList.remove('hidden');
});

saveDescBtn.addEventListener('click', () => {
  if (activeModalCardId) {
    const result = getCardById(activeModalCardId);
    if (result) {
      const newDesc = descTextarea.value.trim();
      result.card.description = newDesc;
      saveState();
      
      // UI update
      if (newDesc !== '') {
        descTextContent.textContent = newDesc;
        descPlaceholder.classList.add('hidden');
        descTextContent.classList.remove('hidden');
      } else {
        descPlaceholder.classList.remove('hidden');
        descTextContent.classList.add('hidden');
      }
      descEditForm.classList.add('hidden');
      descView.classList.remove('hidden');
    }
  }
});

// Renderizar Etiquetas no Modal
const renderModalLabels = (cardLabels) => {
  modalLabelsContainer.innerHTML = '';
  
  if (cardLabels && cardLabels.length > 0) {
    cardLabels.forEach(lblId => {
      const lbl = state.labels.find(l => l.id === lblId);
      if (lbl) {
        const item = document.createElement('span');
        item.className = 'modal-label-item';
        item.style.backgroundColor = lbl.color;
        item.textContent = lbl.name;
        modalLabelsContainer.appendChild(item);
      }
    });
    modalLabelsSection.classList.remove('hidden');
  } else {
    modalLabelsSection.classList.add('hidden');
  }
};

// Renderizar Data de Entrega no Modal
const renderModalDueDate = (dueDateVal, dueCompleteVal) => {
  if (dueDateVal) {
    dueDateCheckbox.checked = dueCompleteVal;
    
    const { text, statusClass, statusText } = getDueDateDetails(dueDateVal, dueCompleteVal);
    dueDateText.textContent = text;
    dueDateStatus.className = `due-status-badge ${statusClass}`;
    dueDateStatus.textContent = statusText;
    
    modalDueDateSection.classList.remove('hidden');
  } else {
    modalDueDateSection.classList.add('hidden');
  }
};

dueDateCheckbox.addEventListener('change', () => {
  if (activeModalCardId) {
    const result = getCardById(activeModalCardId);
    if (result) {
      result.card.dueComplete = dueDateCheckbox.checked;
      saveState();
      renderModalDueDate(result.card.dueDate, result.card.dueComplete);
    }
  }
});

// Detalhes da Data de Entrega
function getDueDateDetails(dateStr, isComplete) {
  const d = new Date(dateStr);
  const now = new Date();
  
  // Formatador
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const formatted = `${d.getDate()} de ${months[d.getMonth()]} às ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  
  if (isComplete) {
    return { text: formatted, statusClass: 'complete', statusText: 'Concluído' };
  }
  
  // Verificar atrasos
  const diffTime = d - now;
  if (diffTime < 0) {
    return { text: formatted, statusClass: 'overdue', statusText: 'Atrasado' };
  }
  
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 1) {
    return { text: formatted, statusClass: 'warning', statusText: 'Entrega breve' };
  }
  
  return { text: formatted, statusClass: 'normal', statusText: 'No prazo' };
}

// Renderizar Checklist no Modal
const renderModalChecklist = (checklist) => {
  checklistItemsContainer.innerHTML = '';
  
  if (checklist && checklist.length > 0) {
    checklistSection.classList.remove('hidden');
    
    let checkedCount = 0;
    checklist.forEach(item => {
      if (item.checked) checkedCount++;
      
      const itemEl = document.createElement('div');
      itemEl.className = `checklist-item ${item.checked ? 'checked' : ''}`;
      
      itemEl.innerHTML = `
        <div class="checklist-item-left">
          <label class="checkbox-container">
            <input type="checkbox" ${item.checked ? 'checked' : ''}>
            <span class="checkmark"></span>
          </label>
          <span class="checklist-item-text">${escapeHTML(item.text)}</span>
        </div>
        <button class="delete-item-btn" title="Excluir item">
          <i data-lucide="x" style="width: 14px; height: 14px;"></i>
        </button>
      `;
      
      // Toggle check
      itemEl.querySelector('input').addEventListener('change', () => {
        item.checked = !item.checked;
        saveState();
        renderModalChecklist(checklist);
      });
      
      // Excluir item
      itemEl.querySelector('.delete-item-btn').addEventListener('click', () => {
        const index = checklist.indexOf(item);
        if (index > -1) {
          checklist.splice(index, 1);
          saveState();
          renderModalChecklist(checklist);
        }
      });
      
      checklistItemsContainer.appendChild(itemEl);
    });
    
    // Atualizar Barra de Progresso
    const percentage = Math.round((checkedCount / checklist.length) * 100) || 0;
    checklistProgressPercentage.textContent = `${percentage}%`;
    checklistProgressFill.style.width = `${percentage}%`;
    
    lucide.createIcons();
  } else {
    checklistSection.classList.add('hidden');
  }
};

// Adicionar Item ao Checklist UI
addItemTrigger.addEventListener('click', () => {
  addItemTrigger.classList.add('hidden');
  addItemForm.classList.remove('hidden');
  newItemTextInput.focus();
});

cancelItemBtn.addEventListener('click', () => {
  addItemForm.classList.add('hidden');
  addItemTrigger.classList.remove('hidden');
  newItemTextInput.value = '';
});

saveItemBtn.addEventListener('click', () => {
  const text = newItemTextInput.value.trim();
  if (text && activeModalCardId) {
    const result = getCardById(activeModalCardId);
    if (result) {
      if (!result.card.checklist) result.card.checklist = [];
      result.card.checklist.push({
        id: 'chk-i-' + Date.now(),
        text: text,
        checked: false
      });
      saveState();
      renderModalChecklist(result.card.checklist);
      
      newItemTextInput.value = '';
      newItemTextInput.focus();
    }
  }
});

// Adicionar Checklist Inteiro a um Cartão
cardChecklistBtn.addEventListener('click', () => {
  if (activeModalCardId) {
    const result = getCardById(activeModalCardId);
    if (result) {
      if (!result.card.checklist || result.card.checklist.length === 0) {
        result.card.checklist = [
          { id: 'chk-i-init', text: 'Minha primeira tarefa', checked: false }
        ];
        saveState();
        renderModalChecklist(result.card.checklist);
      }
      checklistSection.classList.remove('hidden');
    }
  }
});

// Deletar Checklist Completo
deleteChecklistBtn.addEventListener('click', () => {
  if (activeModalCardId && confirm('Deseja realmente excluir este checklist?')) {
    const result = getCardById(activeModalCardId);
    if (result) {
      result.card.checklist = [];
      saveState();
      renderModalChecklist([]);
    }
  }
});

// Renderizar Comentários no Modal
const renderModalComments = (comments) => {
  commentsListContainer.innerHTML = '';
  
  if (comments && comments.length > 0) {
    // Ordena do mais recente para o mais antigo
    const sorted = [...comments].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    sorted.forEach(comment => {
      const timeLabel = formatRelativeTime(comment.timestamp);
      
      const item = document.createElement('div');
      item.className = 'comment-item';
      item.innerHTML = `
        <div class="user-avatar">${escapeHTML(comment.author)}</div>
        <div class="comment-item-content">
          <div class="comment-header">
            <span class="comment-author">${escapeHTML(comment.author)}</span>
            <span class="comment-time">${timeLabel}</span>
          </div>
          <div class="comment-text">${escapeHTML(comment.text)}</div>
        </div>
      `;
      
      commentsListContainer.appendChild(item);
    });
  }
};

commentTextarea.addEventListener('input', () => {
  saveCommentBtn.disabled = commentTextarea.value.trim() === '';
});

saveCommentBtn.addEventListener('click', () => {
  const text = commentTextarea.value.trim();
  if (text && activeModalCardId) {
    const result = getCardById(activeModalCardId);
    if (result) {
      if (!result.card.comments) result.card.comments = [];
      result.card.comments.push({
        id: 'comment-' + Date.now(),
        author: 'TF', // Usuário ativo
        text: text,
        timestamp: new Date().toISOString()
      });
      saveState();
      renderModalComments(result.card.comments);
      
      commentTextarea.value = '';
      saveCommentBtn.disabled = true;
      commentTextarea.style.height = '40px'; // Reseta altura
    }
  }
});

// Excluir Cartão
deleteCardBtn.addEventListener('click', () => {
  if (activeModalCardId && confirm('Tem certeza de que deseja excluir este cartão definitivamente?')) {
    const result = getCardById(activeModalCardId);
    if (result) {
      const { card, list } = result;
      const index = list.cards.indexOf(card);
      if (index > -1) {
        list.cards.splice(index, 1);
        saveState();
        closeCardModal();
      }
    }
  }
});

// ==========================================
// 7. Popovers de Detalhe (Capa, Etiquetas, Prazo)
// ==========================================

// Configurar Capa
const updateModalCoverUI = (coverVal) => {
  if (coverVal && coverVal !== 'transparent') {
    modalCardCover.style.background = coverVal;
    modalCardCover.classList.add('active');
  } else {
    modalCardCover.style.background = 'transparent';
    modalCardCover.classList.remove('active');
  }
};

const renderCoverPresets = () => {
  coverOptionsGrid.innerHTML = '';
  
  CARD_COVER_PRESETS.forEach(preset => {
    const box = document.createElement('div');
    box.className = 'cover-option-box';
    box.style.background = preset.color;
    box.title = preset.name;
    
    if (activeModalCardId) {
      const { card } = getCardById(activeModalCardId);
      if (card && card.cover === preset.color) {
        box.classList.add('selected');
      }
    }
    
    box.addEventListener('click', () => {
      if (activeModalCardId) {
        const { card } = getCardById(activeModalCardId);
        card.cover = preset.color;
        saveState();
        updateModalCoverUI(card.cover);
        
        // Atualiza marcação selecionada
        document.querySelectorAll('.cover-option-box').forEach(b => b.classList.remove('selected'));
        box.classList.add('selected');
      }
    });
    
    coverOptionsGrid.appendChild(box);
  });
};

removeCoverBtn.addEventListener('click', () => {
  if (activeModalCardId) {
    const { card } = getCardById(activeModalCardId);
    card.cover = 'transparent';
    saveState();
    updateModalCoverUI(card.cover);
    
    document.querySelectorAll('.cover-option-box').forEach(b => b.classList.remove('selected'));
  }
});

// Configurar Etiquetas
const renderLabelsPopover = () => {
  labelsSelectorList.innerHTML = '';
  
  if (!activeModalCardId) return;
  const { card } = getCardById(activeModalCardId);
  
  state.labels.forEach(lbl => {
    const isSelected = card.labels.includes(lbl.id);
    const item = document.createElement('div');
    item.className = `label-selector-item ${isSelected ? 'selected' : ''}`;
    
    item.innerHTML = `
      <div class="label-color-bar" style="background-color: ${lbl.color}">
        <span>${escapeHTML(lbl.name)}</span>
        <i data-lucide="check" class="check-icon"></i>
      </div>
    `;
    
    item.addEventListener('click', () => {
      if (isSelected) {
        card.labels = card.labels.filter(id => id !== lbl.id);
      } else {
        card.labels.push(lbl.id);
      }
      saveState();
      renderLabelsPopover();
      renderModalLabels(card.labels);
      lucide.createIcons();
    });
    
    labelsSelectorList.appendChild(item);
  });
};

createLabelTrigger.addEventListener('click', () => {
  createLabelTrigger.classList.add('hidden');
  createLabelForm.classList.remove('hidden');
  renderLabelColorsSelection();
});

cancelNewLabelBtn.addEventListener('click', () => {
  createLabelForm.classList.add('hidden');
  createLabelTrigger.classList.remove('hidden');
  newLabelNameInput.value = '';
});

// Renderizar círculos de cor para criação de etiquetas
const renderLabelColorsSelection = () => {
  labelColorsPick.innerHTML = '';
  LABEL_COLORS.forEach(color => {
    const dot = document.createElement('div');
    dot.className = `label-color-dot ${color === selectedNewLabelColor ? 'selected' : ''}`;
    dot.style.backgroundColor = color;
    
    dot.addEventListener('click', () => {
      selectedNewLabelColor = color;
      document.querySelectorAll('.label-color-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
    });
    
    labelColorsPick.appendChild(dot);
  });
};

saveNewLabelBtn.addEventListener('click', () => {
  const name = newLabelNameInput.value.trim();
  if (name && activeModalCardId) {
    const newId = 'lbl-' + Date.now();
    const newLabel = {
      id: newId,
      name: name,
      color: selectedNewLabelColor
    };
    
    state.labels.push(newLabel);
    // Atribui ao cartão automaticamente
    const { card } = getCardById(activeModalCardId);
    card.labels.push(newId);
    
    saveState();
    
    // Reseta form
    newLabelNameInput.value = '';
    createLabelForm.classList.add('hidden');
    createLabelTrigger.classList.remove('hidden');
    
    // Atualiza
    renderLabelsPopover();
    renderModalLabels(card.labels);
  }
});

// Configurar Prazo (DueDate)
dateForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const dateVal = dueDateInput.value;
  const timeVal = dueTimeInput.value || '12:00';
  
  if (dateVal && activeModalCardId) {
    const { card } = getCardById(activeModalCardId);
    card.dueDate = `${dateVal}T${timeVal}`;
    card.dueComplete = false; // Reseta conclusão ao mudar data
    
    saveState();
    renderModalDueDate(card.dueDate, card.dueComplete);
    
    // Fechar popover
    datePopover.hidePopover();
  }
});

removeDateBtn.addEventListener('click', () => {
  if (activeModalCardId) {
    const { card } = getCardById(activeModalCardId);
    card.dueDate = null;
    card.dueComplete = false;
    saveState();
    renderModalDueDate(null, false);
    datePopover.hidePopover();
  }
});

// Adicionar ouvintes para preencher popovers ao abrir
cardCoverBtn.addEventListener('click', renderCoverPresets);
cardLabelsBtn.addEventListener('click', renderLabelsPopover);
cardDateBtn.addEventListener('click', () => {
  if (activeModalCardId) {
    const { card } = getCardById(activeModalCardId);
    if (card && card.dueDate) {
      const parts = card.dueDate.split('T');
      dueDateInput.value = parts[0];
      dueTimeInput.value = parts[1] || '12:00';
    } else {
      dueDateInput.value = '';
      dueTimeInput.value = '12:00';
    }
  }
});

// ==========================================
// 8. Controles de Fundo do Quadro (Popovers)
// ==========================================

const renderBgOptions = () => {
  bgGridOptions.innerHTML = '';
  
  BOARD_BG_PRESETS.forEach(preset => {
    const box = document.createElement('div');
    box.className = `bg-option-box ${preset.class}`;
    
    const activeBoard = getActiveBoard();
    if (activeBoard && activeBoard.background === preset.class) {
      box.classList.add('selected');
    }
    
    box.addEventListener('click', () => {
      const b = getActiveBoard();
      if (b) {
        b.background = preset.class;
        saveState();
        renderBoard();
        
        document.querySelectorAll('.bg-option-box').forEach(el => el.classList.remove('selected'));
        box.classList.add('selected');
      }
    });
    
    bgGridOptions.appendChild(box);
  });
};

document.getElementById('change-bg-btn').addEventListener('click', renderBgOptions);

// ==========================================
// 9. Lógica das Ações Globais de Quadros e Listas
// ==========================================

// Criar Quadro Sidebar
addBoardTrigger.addEventListener('click', () => {
  addBoardTrigger.classList.add('hidden');
  addBoardForm.classList.remove('hidden');
  newBoardTitleInput.focus();
  renderNewBoardBgOptions();
});

cancelBoardBtn.addEventListener('click', () => {
  addBoardForm.classList.add('hidden');
  addBoardTrigger.classList.remove('hidden');
  newBoardTitleInput.value = '';
});

let selectedNewBoardBg = BOARD_BG_PRESETS[0].class;

const renderNewBoardBgOptions = () => {
  newBoardBgOptions.innerHTML = '';
  BOARD_BG_PRESETS.forEach(preset => {
    const dot = document.createElement('div');
    dot.className = `bg-picker-dot ${preset.class} ${preset.class === selectedNewBoardBg ? 'selected' : ''}`;
    
    dot.addEventListener('click', () => {
      selectedNewBoardBg = preset.class;
      document.querySelectorAll('.bg-picker-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
    });
    
    newBoardBgOptions.appendChild(dot);
  });
};

addBoardForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = newBoardTitleInput.value.trim();
  if (title) {
    const newBoard = {
      id: 'board-' + Date.now(),
      title: title,
      background: selectedNewBoardBg,
      lists: [
        { id: 'list-' + Date.now() + '-1', title: 'A Fazer 📋', cards: [] },
        { id: 'list-' + Date.now() + '-2', title: 'Em Progresso ⚡', cards: [] },
        { id: 'list-' + Date.now() + '-3', title: 'Concluído ✅', cards: [] }
      ]
    };
    
    state.boards.push(newBoard);
    state.activeBoardId = newBoard.id;
    saveState();
    
    // Reset Form
    newBoardTitleInput.value = '';
    addBoardForm.classList.add('hidden');
    addBoardTrigger.classList.remove('hidden');
    
    renderAll();
  }
});

// Renomear Quadro no Header
boardTitleEl.addEventListener('focus', () => {
  boardTitleEl.dataset.original = boardTitleEl.textContent;
});

boardTitleEl.addEventListener('blur', () => {
  const activeBoard = getActiveBoard();
  const newTitle = boardTitleEl.textContent.trim();
  if (activeBoard && newTitle && newTitle !== boardTitleEl.dataset.original) {
    activeBoard.title = newTitle;
    saveState();
    renderSidebar();
  } else {
    boardTitleEl.textContent = activeBoard ? activeBoard.title : '';
  }
});

boardTitleEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    boardTitleEl.blur();
  }
});

// Excluir Quadro Ativo
deleteBoardBtn.addEventListener('click', () => {
  const activeBoard = getActiveBoard();
  if (!activeBoard) return;
  
  if (confirm(`Tem certeza de que deseja excluir o quadro "${activeBoard.title}" e todas as suas listas?`)) {
    const index = state.boards.findIndex(b => b.id === activeBoard.id);
    if (index > -1) {
      state.boards.splice(index, 1);
      
      // Escolher outro ativo
      if (state.boards.length > 0) {
        state.activeBoardId = state.boards[0].id;
      } else {
        state.activeBoardId = null;
      }
      
      saveState();
      renderAll();
    }
  }
});

// Criar Nova Lista
addListTrigger.addEventListener('click', () => {
  addListTrigger.classList.add('hidden');
  addListForm.classList.remove('hidden');
  newListTitleInput.focus();
});

cancelListBtn.addEventListener('click', () => {
  addListForm.classList.add('hidden');
  addListTrigger.classList.remove('hidden');
  newListTitleInput.value = '';
});

addListForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = newListTitleInput.value.trim();
  const activeBoard = getActiveBoard();
  if (title && activeBoard) {
    const newList = {
      id: 'list-' + Date.now(),
      title: title,
      cards: []
    };
    
    activeBoard.lists.push(newList);
    saveState();
    
    newListTitleInput.value = '';
    addListForm.classList.add('hidden');
    addListTrigger.classList.remove('hidden');
    
    renderBoard();
    lucide.createIcons();
  }
});

// ==========================================
// 10. Sidebar Expandir / Recolher
// ==========================================

collapseSidebarBtn.addEventListener('click', () => {
  sidebarEl.classList.add('collapsed');
  expandSidebarBtn.classList.remove('hidden');
});

expandSidebarBtn.addEventListener('click', () => {
  sidebarEl.classList.remove('collapsed');
  expandSidebarBtn.classList.add('hidden');
});

// ==========================================
// 11. Barra de Busca / Filtro de Cartões
// ==========================================

searchCardsInput.addEventListener('input', () => {
  const val = searchCardsInput.value.trim();
  state.filterQuery = val;
  
  if (val !== '') {
    clearSearchBtn.classList.remove('hidden');
  } else {
    clearSearchBtn.classList.add('hidden');
  }
  
  renderLists();
  lucide.createIcons();
});

clearSearchBtn.addEventListener('click', () => {
  searchCardsInput.value = '';
  state.filterQuery = '';
  clearSearchBtn.classList.add('hidden');
  renderLists();
  lucide.createIcons();
});

// ==========================================
// 12. Diálogos / Popovers Polyfills & Fallbacks
// ==========================================

// Fallback do clique fora no Dialog (Backdrop Light Dismiss)
if (!('closedBy' in HTMLDialogElement.prototype)) {
  cardModal.addEventListener('click', (event) => {
    if (event.target !== cardModal) return;
    
    const rect = cardModal.getBoundingClientRect();
    const isDialogContent = (
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width
    );
    
    if (isDialogContent) return;
    
    closeCardModal();
  });
}

// ==========================================
// 13. Helpers Auxiliares (Sanitização e Tempo)
// ==========================================

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatRelativeTime(isoString) {
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now - d;
  
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'agora mesmo';
  if (diffMins < 60) return `há ${diffMins} min`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `há ${diffHours} h`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'ontem';
  if (diffDays < 7) return `há ${diffDays} dias`;
  
  return d.toLocaleDateString('pt-BR');
}

// ==========================================
// 14. Inicialização do App
// ==========================================

loadState();
renderAll();
