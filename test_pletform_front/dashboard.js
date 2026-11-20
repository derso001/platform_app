const authToken = localStorage.getItem('auth_token');
if (!authToken) {
    window.location.href = 'login.html';
}

function getAuthHeaders(withContentType = false) {
    const headers = {
        'Authorization': `Bearer ${authToken}`
    };
    if (withContentType) {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
}

function handleUnauthorized(status) {
    if (status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
        window.location.href = 'login.html';
        return true;
    }
    return false;
}

function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    window.location.href = 'login.html';
}

// Відображення імені та аватарки у шапці при завантаженні
document.addEventListener('DOMContentLoaded', () => {
    const userInfoRaw = localStorage.getItem('user_info');
    if (userInfoRaw) {
        const user = JSON.parse(userInfoRaw);
        const nameEl = document.getElementById('user-name');
        const avatarEl = document.getElementById('user-avatar');
        
        if (nameEl) nameEl.innerText = user.name || user.email;
        if (avatarEl && user.avatar) {
            avatarEl.src = user.avatar;
            avatarEl.classList.remove('hidden');
        }
    }
});

// Головний масив, який зберігає структуру нашого тесту
let testData = [];
let editingTestId = null;

// ==========================================
// 1. ШАБЛОНИ ТА ПРОМПТ ШІ
// ==========================================
const templates = {
    radio: { type: "radio", title: "Тестові завдання (Один варіант)", theme: { bg: "bg-cyan-500/20", text: "text-cyan-400" }, points: 5, data: [ { q: "Нове запитання?", opts: ["Варіант 1", "Варіант 2", "Варіант 3"], ans: 0 } ] },
    pairs: { type: "pairs", title: "Логічні пари", theme: { bg: "bg-purple-500/20", text: "text-purple-400" }, points: 3, data: [ { ext: "Термін 1", type: "key1", desc: "Опис 1" }, { ext: "Термін 2", type: "key2", desc: "Опис 2" } ] },
    ordering: { type: "ordering", title: "Впорядкування", theme: { bg: "bg-pink-500/20", text: "text-pink-400" }, points: 10, lists: [ { id: "list1", name: "Розставте по порядку:", items: [ { id: "1", text: "Крок 1" }, { id: "2", text: "Крок 2" } ], correct: ["1", "2"] } ] },
    sorting: { type: "sorting", title: "Сортування", theme: { bg: "bg-emerald-500/20", text: "text-emerald-400" }, points: 3, folders: [ { id: "cat1", name: "Категорія 1", color: "text-blue-400" }, { id: "cat2", name: "Категорія 2", color: "text-pink-400" } ], files: [ { id: "f1", n: "Файл 1", t: "cat1" }, { id: "f2", n: "Файл 2", t: "cat2" } ] },
    mistakes: { type: "mistakes", title: "Знайдіть помилки", subtitle: "Відмітьте правильні твердження:", theme: { bg: "bg-orange-500/20", text: "text-orange-400" }, points: 2, data: [ { n: "Правильне твердження", bad: false }, { n: "Хибне твердження", bad: true } ] },
    fillIn: { type: "fill-in", title: "Пропуски в тексті", theme: { bg: "bg-indigo-500/20", text: "text-indigo-400" }, points: 5, data: [ { pre: "Початок ", placeholder: "підказка", post: " кінець.", ans: "відповідь" } ] },
    open: { type: "open", title: "Вільна відповідь", subtitle: "Дайте розгорнуту відповідь:", theme: { bg: "bg-teal-500/20", text: "text-teal-400" }, data: [ { id: "q1", q: "Ваше запитання...", type: "textarea", points: 5 } ] },
    typing: { type: "typing", title: "Тренажер швидкості", theme: { bg: "bg-rose-500/20", text: "text-rose-400" }, text: "Введіть цей текст без помилок." }
};

const aiPromptText = `Ти — досвідчений викладач та експерт зі створення інтерактивних тестів.
Твоє завдання — згенерувати навчальний тест на задану тему у строго визначеному форматі JSON. Цей JSON буде використано для рендеру тестів на кастомній веб-платформі.

ОБОВ'ЯЗКОВІ ПРАВИЛА:
1. Відповідь має містити ЛИШЕ валідний JSON-масив (починається з [ і закінчується ]). 
2. Обов'язково форматуй код "драбинкою" (pretty-print з відступами 2 пробіли). Кожен об'єкт та властивість мають бути з нового рядка. Не пиши код в один суцільний рядок!
3. Жодних вступних чи завершальних слів, форматування Markdown (без \`\`\`json) не використовувати, видавай лише чистий код.
4. Не змінюй ключі (type, title, theme, points, data, lists, folders, files).
5. Теми оформлення (theme) залишай як у прикладі або використовуй кольори з палітри Tailwind CSS (cyan, purple, pink, emerald, orange, indigo, teal, rose).
6. КРИТИЧНО ВАЖЛИВО: ЗАБОРОНЕНО використовувати подвійні лапки (") всередині текстових значень запитань, відповідей, описів чи тверджень! Для виділення слів, назв чи цитат усередині тексту використовуй ВИКЛЮЧНО одинарні лапки ('), наприклад: Що означає фразеологізм 'ловити ґав'? Порушення цього правила зламає парсер JSON.

ОПИС ТИПІВ ЗАВДАНЬ (використовуй їх для розуміння логіки):
- "radio": Класичний тест. Один правильний варіант (ans — це індекс правильного варіанту, починається з 0). Створи від 4 до 8 таких питань.
- "pairs": Логічні пари. Треба з'єднати термін (ext) із його описом (desc). Від 4 до 6 пар.
- "ordering": Алгоритм або хронологія. Елементи (items) треба розставити у правильному порядку, який вказано у масиві correct. Від 1 до 3 списків (lists), кожен з 3–5 елементами.
- "sorting": Сортування. Розподілити файли (files) по відповідних папках (folders) за допомогою ідентифікаторів. Від 2 до 4 папок, кожна з 3–5 файлами.
- "mistakes": Пошук помилок. Чекбокси, де хибне твердження має значення "bad": true. Від 5 до 7 тверджень, з яких 1–3 хибні.
- "fill-in": Пропуски в тексті. Учень вписує слово (ans) у пропуск між текстом pre та post. Від 2 до 5 пропусків.
- "open": Вільна відповідь. type: "text" для короткої, type: "textarea" для розгорнутої.

ЕТАЛОННА СТРУКТУРА JSON (використовуй її як шаблон, але наповни контентом на потрібну тему):
[
  {
    "type": "radio",
    "title": "Тестові завдання (Один варіант)",
    "theme": { "bg": "bg-cyan-500/20", "text": "text-cyan-400" },
    "points": 5,
    "data": [
      { "q": "1. Ваше перше запитання зі словом у 'одинарних лапках'?", "opts": ["Неправильно", "Правильно", "Неправильно"], "ans": 1 },
      { "q": "2. Ваше друге запитання?", "opts": ["Правильно", "Неправильно", "Неправильно"], "ans": 0 }
    ]
  },
  {
    "type": "pairs",
    "title": "Логічні пари",
    "theme": { "bg": "bg-purple-500/20", "text": "text-purple-400" },
    "points": 3,
    "data": [
      { "ext": "Термін 1", "type": "key1", "desc": "Пояснення 1" },
      { "ext": "Термін 2", "type": "key2", "desc": "Пояснення 2" }
    ]
  },
  {
    "type": "ordering",
    "title": "Впорядкування (хронологія/алгоритм)",
    "theme": { "bg": "bg-pink-500/20", "text": "text-pink-400" },
    "points": 10,
    "lists": [
      {
        "id": "list1",
        "name": "Розставте у правильному порядку:",
        "items": [
          { "id": "1", "text": "Перша подія/крок" },
          { "id": "3", "text": "Третя подія/крок" },
          { "id": "2", "text": "Друга подія/крок" }
        ],
        "correct": ["1", "2", "3"]
      }
    ]
  },
  {
    "type": "sorting",
    "title": "Сортування по категоріях",
    "theme": { "bg": "bg-emerald-500/20", "text": "text-emerald-400" },
    "points": 3,
    "folders": [
      { "id": "cat1", "name": "Категорія 1", "color": "text-blue-400" },
      { "id": "cat2", "name": "Категорія 2", "color": "text-pink-400" }
    ],
    "files": [
      { "id": "f1", "n": "Елемент 1", "t": "cat1" },
      { "id": "f2", "n": "Елемент 2", "t": "cat2" },
      { "id": "f3", "n": "Інший елемент для категорії 1", "t": "cat1" }
    ]
  },
  {
    "type": "mistakes",
    "title": "Знайдіть помилкові твердження",
    "subtitle": "Відмітьте ті варіанти, які є неправильними:",
    "theme": { "bg": "bg-orange-500/20", "text": "text-orange-400" },
    "points": 2,
    "data": [
      { "n": "Це правильне твердження (його не треба виділяти)", "bad": false },
      { "n": "Це твердження містить помилку (його треба виділити)", "bad": true }
    ]
  },
  {
    "type": "fill-in",
    "title": "Пропуски в тексті",
    "theme": { "bg": "bg-indigo-500/20", "text": "text-indigo-400" },
    "points": 5,
    "data": [
      { "pre": "Столиця України — це місто ", "placeholder": "назва", "post": ".", "ans": "київ" }
    ]
  },
  {
    "type": "open",
    "title": "Вільна відповідь",
    "subtitle": "Дайте розгорнуту відповідь:",
    "theme": { "bg": "bg-teal-500/20", "text": "text-teal-400" },
    "data": [
      { "id": "q1", "q": "Поясніть, чому...", "type": "textarea", "points": 5 }
    ]
  }
]

ТЕМА ТЕСТУ ДЛЯ ГЕНЕРАЦІЇ: `;

// ==========================================
// 2. МОДАЛЬНЕ ВІКНО ШІ
// ==========================================
function openAIModal() {
    document.getElementById('ai-json-input').value = '';
    document.getElementById('ai-json-error').classList.add('hidden');
    document.getElementById('ai-import-modal').classList.remove('hidden');
}

function closeAIModal() {
    document.getElementById('ai-import-modal').classList.add('hidden');
}

function copyAIPrompt() {
    navigator.clipboard.writeText(aiPromptText).then(() => {
        alert("✨ Промпт скопійовано! Вставте його в ChatGPT.");
    });
}

function importAIJson() {
    const input = document.getElementById('ai-json-input').value.trim();
    const errorMsg = document.getElementById('ai-json-error');
    try {
        const parsed = JSON.parse(input || "[]");
        if (!Array.isArray(parsed)) throw new Error("JSON має бути масивом");
        
        testData = parsed; // Записуємо дані з ШІ в наш головний масив
        closeAIModal();
        renderVisualEditor(); // Малюємо картки
    } catch (e) {
        errorMsg.classList.remove('hidden');
    }
}

// ==========================================
// 3. ВІЗУАЛЬНИЙ КОНСТРУКТОР (Генерація карток)
// ==========================================

function addModule(type) {
    // Глибоко клонуємо шаблон, щоб уникнути багів з посиланнями на об'єкт
    const newMod = JSON.parse(JSON.stringify(templates[type]));
    testData.push(newMod);
    renderVisualEditor();
}

function removeModule(index) {
    if(confirm("Точно видалити цей блок?")) {
        testData.splice(index, 1);
        renderVisualEditor();
    }
}

function addQuestionItem(modIndex, type) {
    const mod = testData[modIndex];
    if (type === 'radio') mod.data.push({ q: "Нове запитання?", opts: ["Варіант 1", "Варіант 2", "Варіант 3"], ans: 0 });
    if (type === 'pairs') mod.data.push({ ext: "Новий термін", type: "key" + (mod.data.length + 1), desc: "Новий опис" });
    if (type === 'mistakes') mod.data.push({ n: "Нове твердження", bad: false });
    if (type === 'fillIn' || type === 'fill-in') mod.data.push({ pre: "Текст ", placeholder: "...", post: " текст.", ans: "відповідь" });
    if (type === 'open') mod.data.push({ id: "q" + Date.now(), q: "Нове запитання", type: "text", points: 2 });
    
    renderVisualEditor();
}

function removeItem(modIndex, itemIndex) {
    testData[modIndex].data.splice(itemIndex, 1);
    renderVisualEditor();
}

function removeSortingFile(modIndex, fileIndex) {
    testData[modIndex].files.splice(fileIndex, 1);
    renderVisualEditor();
}

function removeSortingFolder(modIndex, folderIndex) {
    if (testData[modIndex].folders.length <= 1) {
        alert("Має залишитись хоча б одна категорія!");
        return;
    }
    const removedId = testData[modIndex].folders[folderIndex].id;
    testData[modIndex].folders.splice(folderIndex, 1);
    
    // Переприв'язуємо файли зі стертої папки на першу доступну
    const fallbackId = testData[modIndex].folders[0].id;
    testData[modIndex].files.forEach(f => {
        if (f.t === removedId) f.t = fallbackId;
    });
    renderVisualEditor();
}

function addOrderingItem(modIndex, listIndex) {
    const list = testData[modIndex].lists[listIndex];
    const newId = String(Date.now()).slice(-4);
    list.items.push({ id: newId, text: "Новий крок" });
    list.correct.push(newId);
    renderVisualEditor();
}

function removeOrderingItem(modIndex, listIndex, itemIndex) {
    const list = testData[modIndex].lists[listIndex];
    const removedId = list.items[itemIndex].id;
    list.items.splice(itemIndex, 1);
    list.correct = list.correct.filter(id => id !== removedId);
    renderVisualEditor();
}

function addFolder(modIndex) {
    const mod = testData[modIndex];
    const newId = "cat" + (mod.folders.length + 1);
    mod.folders.push({ id: newId, name: "Нова категорія", color: "text-blue-400" });
    renderVisualEditor();
}

function addSortingItem(modIndex) {
    const mod = testData[modIndex];
    const defaultFolderId = mod.folders.length > 0 ? mod.folders[0].id : "cat1";
    mod.files.push({ id: "f" + (mod.files.length + 1), n: "Новий елемент", t: defaultFolderId });
    renderVisualEditor();
}

function renderVisualEditor() {
    const container = document.getElementById('visual-editor-content');
    container.innerHTML = '';

    if (testData.length === 0) {
        container.innerHTML = `<div class="text-center py-10 text-slate-500 text-sm font-medium border-2 border-dashed border-slate-700 rounded-xl">Тест поки порожній. Згенеруйте через ШІ або додайте перший блок кнопками!</div>`;
        return;
    }

    testData.forEach((mod, modIndex) => {
        let html = `
        <div class="bg-slate-900/80 border border-slate-700/60 p-4 sm:p-5 rounded-xl shadow-sm relative group">
            <button onclick="removeModule(${modIndex})" class="absolute top-4 right-4 text-slate-500 hover:text-red-400 transition-colors" title="Видалити блок">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
            
            <div class="flex flex-col sm:flex-row gap-4 mb-5 pb-4 border-b border-slate-700/50 pr-8">
                <div class="flex-1">
                    <label class="block text-[10px] text-slate-400 mb-1 font-bold uppercase tracking-wider">Заголовок блоку (${mod.type})</label>
                    <input type="text" class="w-full bg-slate-950 border border-slate-600 rounded px-3 py-2 text-sm text-cyan-400 font-medium focus:border-cyan-400 outline-none transition-colors" value="${mod.title.replace(/"/g, '&quot;')}" onchange="testData[${modIndex}].title = this.value">
                </div>
                <div class="w-full sm:w-24">
                    <label class="block text-[10px] text-slate-400 mb-1 font-bold uppercase tracking-wider">Бали</label>
                    <input type="number" class="w-full bg-slate-950 border border-slate-600 rounded px-3 py-2 text-sm text-emerald-400 font-bold focus:border-emerald-400 outline-none transition-colors" value="${mod.points || 0}" onchange="testData[${modIndex}].points = Number(this.value)">
                </div>
            </div>
            
            <div class="space-y-4">
        `;

        // Рендеринг внутрішніх завдань (карток)
        if (mod.data) {
            mod.data.forEach((item, itemIndex) => {
                html += `<div class="bg-slate-950/50 p-3 rounded-lg border border-slate-700/50 relative pr-10">
                            <button onclick="removeItem(${modIndex}, ${itemIndex})" class="absolute top-3 right-3 text-slate-600 hover:text-red-400 text-lg leading-none" title="Видалити запитання">&times;</button>`;
                
                if (item.q !== undefined) { 
                    // ТЕСТИ З ВАРІАНТАМИ
                    html += `
                        <label class="block text-[10px] text-slate-500 mb-1">Завдання ${itemIndex + 1}</label>
                        <input type="text" class="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 focus:border-purple-400 outline-none mb-2" value="${item.q.replace(/"/g, '&quot;')}" onchange="testData[${modIndex}].data[${itemIndex}].q = this.value">
                    `;
                    if (mod.type === 'radio' && item.opts) {
                        html += `<div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">`;
                        item.opts.forEach((opt, optIndex) => {
                            let isAns = (item.ans === optIndex) ? 'border-emerald-500 text-emerald-400 bg-emerald-900/10' : 'border-slate-700 text-slate-400 bg-slate-800';
                            html += `
                                <div class="flex items-center gap-2">
                                    <input type="radio" title="Позначити як правильну відповідь" name="radio_${modIndex}_${itemIndex}" ${item.ans === optIndex ? 'checked' : ''} onchange="testData[${modIndex}].data[${itemIndex}].ans = ${optIndex}; renderVisualEditor();">
                                    <input type="text" class="w-full border ${isAns} rounded px-2 py-1.5 text-[11px] outline-none focus:border-cyan-400 transition-colors" value="${opt.replace(/"/g, '&quot;')}" onchange="testData[${modIndex}].data[${itemIndex}].opts[${optIndex}] = this.value">
                                </div>
                            `;
                        });
                        html += `</div>`;
                    }
                } else if (item.ext !== undefined) { 
                    // ЛОГІЧНІ ПАРИ
                    html += `
                        <div class="flex flex-col sm:flex-row gap-2">
                            <input type="text" class="w-full sm:w-1/3 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-cyan-300 font-mono outline-none focus:border-cyan-400" value="${item.ext.replace(/"/g, '&quot;')}" onchange="testData[${modIndex}].data[${itemIndex}].ext = this.value" placeholder="Термін/Код">
                            <input type="text" class="w-full sm:w-2/3 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-purple-400" value="${item.desc.replace(/"/g, '&quot;')}" onchange="testData[${modIndex}].data[${itemIndex}].desc = this.value" placeholder="Опис/Пояснення">
                        </div>
                    `;
                } else if (item.n !== undefined) { 
                    // ЗНАЙТИ ПОМИЛКИ
                    html += `
                        <div class="flex items-center gap-3">
                            <label class="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer hover:text-orange-400 transition-colors">
                                <input type="checkbox" ${item.bad ? 'checked' : ''} onchange="testData[${modIndex}].data[${itemIndex}].bad = this.checked">
                            </label>
                            <input type="text" class="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-orange-400" value="${item.n.replace(/"/g, '&quot;')}" onchange="testData[${modIndex}].data[${itemIndex}].n = this.value">
                        </div>
                    `;
                } else if (item.pre !== undefined) {
                    // ПРОПУСКИ В ТЕКСТІ
                     html += `
                        <div class="flex flex-wrap items-center gap-2">
                            <input type="text" class="w-auto bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300 outline-none" value="${item.pre.replace(/"/g, '&quot;')}" onchange="testData[${modIndex}].data[${itemIndex}].pre = this.value" placeholder="Початок...">
                            <input type="text" class="w-24 bg-slate-800 border border-indigo-500 text-indigo-400 font-bold rounded px-2 py-1.5 text-xs outline-none text-center" placeholder="Відповідь" value="${item.ans.replace(/"/g, '&quot;')}" onchange="testData[${modIndex}].data[${itemIndex}].ans = this.value">
                            <input type="text" class="w-auto bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300 outline-none" value="${item.post.replace(/"/g, '&quot;')}" onchange="testData[${modIndex}].data[${itemIndex}].post = this.value" placeholder="...кінець">
                        </div>
                    `;
                }
                html += `</div>`;
            });
            
            // Кнопка додати елемент (запитання/пару)
            if (['radio', 'pairs', 'mistakes', 'fill-in', 'fillIn', 'open'].includes(mod.type)) {
                html += `<button onclick="addQuestionItem(${modIndex}, '${mod.type}')" class="mt-2 text-[11px] font-bold text-cyan-600 border border-cyan-700/50 border-dashed rounded py-2 px-4 hover:bg-cyan-900/20 hover:text-cyan-400 transition-colors w-full text-center">+ Додати завдання сюди</button>`;
            }
        } else if (mod.type === 'ordering' && mod.lists) {
            // ВПОРЯДКУВАННЯ (ORDERING)
            mod.lists.forEach((list, listIndex) => {
                html += `
                    <div class="bg-slate-950/50 p-3 rounded-lg border border-slate-700/50 mb-3">
                        <label class="block text-[10px] text-slate-500 mb-1">Назва списку (завдання)</label>
                        <input type="text" class="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 focus:border-pink-400 outline-none mb-3" value="${list.name.replace(/"/g, '&quot;')}" onchange="testData[${modIndex}].lists[${listIndex}].name = this.value">
                        
                        <label class="block text-[10px] font-bold text-slate-400 mb-2">Елементи списку (в правильному порядку):</label>
                        <div class="space-y-2">
                `;
                
                list.items.forEach((item, itemIndex) => {
                    html += `
                        <div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/50 relative pr-10 flex items-center gap-2">
                            <div class="flex items-center justify-center bg-slate-800 border border-slate-700 rounded w-7 h-7 text-[10px] font-bold text-pink-400 flex-shrink-0">${itemIndex + 1}</div>
                            <input type="text" class="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-pink-400" value="${item.text.replace(/"/g, '&quot;')}" onchange="testData[${modIndex}].lists[${listIndex}].items[${itemIndex}].text = this.value">
                            <button onclick="removeOrderingItem(${modIndex}, ${listIndex}, ${itemIndex})" class="absolute top-3 right-3 text-slate-600 hover:text-red-400 text-lg leading-none" title="Видалити крок">&times;</button>
                        </div>
                    `;
                });
                
                html += `
                        </div>
                        <button onclick="addOrderingItem(${modIndex}, ${listIndex})" class="mt-3 text-[11px] font-bold text-pink-500 border border-pink-700/50 border-dashed rounded py-2 px-4 hover:bg-pink-900/20 hover:text-pink-400 transition-colors w-full text-center">+ Додати крок сюди</button>
                    </div>
                `;
            });

        } else if (mod.type === 'sorting') {
            // СОРТУВАННЯ ПО ПАПКАХ (SORTING)
            html += `<div class="space-y-4">`;
            
            // 1. Блок категорій
            html += `
                <div>
                    <label class="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">1. Категорії (Папки):</label>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            `;
            mod.folders.forEach((folder, fIndex) => {
                html += `
                    <div class="bg-slate-950/50 p-3 rounded-lg border border-slate-700/50 relative pr-10 flex items-center gap-2">
                        <span class="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[10px] font-mono text-emerald-400">${folder.id}</span>
                        <input type="text" class="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-emerald-400" value="${folder.name.replace(/"/g, '&quot;')}" onchange="testData[${modIndex}].folders[${fIndex}].name = this.value">
                        <button onclick="removeSortingFolder(${modIndex}, ${fIndex})" class="absolute top-3.5 right-3 text-slate-600 hover:text-red-400 text-lg leading-none" title="Видалити категорію">&times;</button>
                    </div>
                `;
            });
            html += `
                    </div>
                    <button onclick="addFolder(${modIndex})" class="mt-2 text-[11px] font-bold text-emerald-500 border border-emerald-700/50 border-dashed rounded py-2 px-4 hover:bg-emerald-900/20 hover:text-emerald-400 transition-colors w-full text-center">+ Додати категорію</button>
                </div>
            `;

            // 2. Блок елементів для сортування
            html += `
                <div class="pt-2 border-t border-slate-800">
                    <label class="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">2. Елементи для сортування:</label>
                    <div class="space-y-2">
            `;
            mod.files.forEach((file, fileIndex) => {
                let folderOptions = mod.folders.map(f => `<option value="${f.id}" ${file.t === f.id ? 'selected' : ''}>${f.name} (${f.id})</option>`).join('');
                
                html += `
                    <div class="bg-slate-950/50 p-3 rounded-lg border border-slate-700/50 relative pr-10">
                        <div class="flex flex-col sm:flex-row gap-2">
                            <input type="text" class="w-full sm:w-2/3 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-emerald-400" value="${file.n.replace(/"/g, '&quot;')}" onchange="testData[${modIndex}].files[${fileIndex}].n = this.value" placeholder="Назва елемента">
                            <select class="w-full sm:w-1/3 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-emerald-400 font-medium outline-none focus:border-emerald-400" onchange="testData[${modIndex}].files[${fileIndex}].t = this.value">
                                ${folderOptions}
                            </select>
                        </div>
                        <button onclick="removeSortingFile(${modIndex}, ${fileIndex})" class="absolute top-3.5 right-3 text-slate-600 hover:text-red-400 text-lg leading-none" title="Видалити елемент">&times;</button>
                    </div>
                `;
            });
            html += `
                    </div>
                    <button onclick="addSortingItem(${modIndex})" class="mt-2 text-[11px] font-bold text-emerald-500 border border-emerald-700/50 border-dashed rounded py-2 px-4 hover:bg-emerald-900/20 hover:text-emerald-400 transition-colors w-full text-center">+ Додати елемент сюди</button>
                </div>
            </div>`;

        } else if (mod.type === 'typing') {
            // ТРЕНАЖЕР ДРУКУ (TYPING)
            html += `
                <div class="bg-slate-950/50 p-3 rounded-lg border border-slate-700/50">
                    <label class="block text-[10px] text-slate-500 mb-1">Текст для перевірки швидкості друку</label>
                    <textarea class="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-xs text-slate-300 outline-none focus:border-rose-400 font-mono transition-colors" rows="4" onchange="testData[${modIndex}].text = this.value">${(mod.text || '').replace(/"/g, '&quot;')}</textarea>
                </div>
            `;
        }

        html += `</div></div>`;
        container.innerHTML += html;
    });
}

// ==========================================
// 4. ЗБЕРЕЖЕННЯ В БАЗУ ДАНИХ
// ==========================================

document.getElementById('saveBtn').addEventListener('click', async () => {
    if (testData.length === 0) {
        alert("Додайте хоча б один блок завдань у конструкторі!");
        return;
    }

    const metaData = {
        titleHighlight: document.getElementById('meta-highlight').value.trim(),
        titleMain: document.getElementById('meta-main').value.trim(),
        subtitle: document.getElementById('meta-subtitle').value.trim(),
        pageTitle: "Платформа тестувань | OS Explorer"
    };

    const payload = {
        meta: metaData,
        modules: testData
    };

    const saveBtn = document.getElementById('saveBtn');
    const isUpdating = Boolean(editingTestId);
    const url = isUpdating 
        ? `http://127.0.0.1:8000/api/tests/${editingTestId}` 
        : 'http://127.0.0.1:8000/api/tests/';
    const method = isUpdating ? 'PUT' : 'POST';

    saveBtn.innerText = isUpdating ? "Оновлення..." : "Збереження...";
    saveBtn.disabled = true;

    try {
        const response = await fetch(url, {
            method: method,
            headers: getAuthHeaders(true),
            body: JSON.stringify(payload)
        });

        if (handleUnauthorized(response.status)) return;

        const result = await response.json();

        if (response.ok && result.status === 'success') {
            const savedId = isUpdating ? editingTestId : result.test_id;
            const finalLink = `${window.location.origin}/index.html?id=${savedId}`;
            
            document.getElementById('generated-link').value = finalLink;
            document.getElementById('result-box').classList.remove('hidden');
            document.getElementById('result-box').scrollIntoView({ behavior: 'smooth' });
        } else {
            alert("Помилка на сервері: " + JSON.stringify(result));
        }
    } catch (err) {
        alert("Не вдалося підключитися до бази даних. Перевірте, чи працює FastAPI (uvicorn).");
        console.error(err);
    } finally {
        saveBtn.innerText = isUpdating ? "Оновити тест у базі" : "Зберегти тест у базу";
        saveBtn.disabled = false;
    }
});

// ==========================================
// 5. КЕРУВАННЯ СПИСКОМ ТЕСТІВ (CRUD)
// ==========================================

function switchTab(tab) {
    const builderSec = document.getElementById('builder-section');
    const listSec = document.getElementById('tests-list-section');
    const builderBtn = document.getElementById('tab-builder-btn');
    const listBtn = document.getElementById('tab-list-btn');

    if (tab === 'builder') {
        builderSec.classList.remove('hidden');
        listSec.classList.add('hidden');
        builderBtn.className = "bg-cyan-600 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-[0_0_12px_rgba(0,242,254,0.3)] transition-all";
        listBtn.className = "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-5 py-2 rounded-lg text-xs font-bold transition-all";
    } else {
        builderSec.classList.add('hidden');
        listSec.classList.remove('hidden');
        listBtn.className = "bg-cyan-600 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-[0_0_12px_rgba(0,242,254,0.3)] transition-all";
        builderBtn.className = "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-5 py-2 rounded-lg text-xs font-bold transition-all";
        loadTestsList();
    }
}

function startNewTest() {
    editingTestId = null;
    testData = [];
    document.getElementById('meta-highlight').value = "OS Explorer";
    document.getElementById('meta-main').value = "Практикум";
    document.getElementById('meta-subtitle').value = "";
    document.getElementById('saveBtn').innerText = "Зберегти тест у базу";
    document.getElementById('result-box').classList.add('hidden');
    renderVisualEditor();
    switchTab('builder');
}

async function loadTestsList() {
    const container = document.getElementById('tests-list-container');
    container.innerHTML = `<p class="text-cyan-400 text-xs font-mono animate-pulse text-center py-6">Завантаження тестів...</p>`;

    try {
        const res = await fetch('http://127.0.0.1:8000/api/tests/', {
            headers: getAuthHeaders()
        });
        if (handleUnauthorized(res.status)) return;
        const json = await res.json();

        if (!res.ok || json.status !== 'success') throw new Error("Помилка отримання списку");

        if (json.data.length === 0) {
            container.innerHTML = `<p class="text-slate-500 text-sm text-center py-8">У базі поки немає жодного тесту.</p>`;
            return;
        }

        container.innerHTML = json.data.map(test => {
            const title = `${test.meta?.titleHighlight || ''} ${test.meta?.titleMain || 'Без назви'}`.trim();
            const subtitle = test.meta?.subtitle || 'Без опису';
            const date = test.created_at ? new Date(test.created_at).toLocaleDateString('uk-UA') : '';

            return `
                <div class="bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="text-sm font-bold text-white">${title}</h3>
                            <span class="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">${date}</span>
                        </div>
                        <p class="text-xs text-slate-400 mt-1">${subtitle}</p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button onclick="copyTestUrl('${test.id}')" class="bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors" title="Скопіювати посилання для учнів">
                            🔗 Посилання
                        </button>
                        <button onclick="editExistingTest('${test.id}', false)" class="bg-indigo-900/40 hover:bg-indigo-800/60 text-indigo-300 border border-indigo-700/60 px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors">
                            ✏️ Редагувати
                        </button>
                        <button onclick="editExistingTest('${test.id}', true)" class="bg-purple-900/40 hover:bg-purple-800/60 text-purple-300 border border-purple-700/60 px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors">
                            📋 Копіювати
                        </button>
                        <button onclick="openTestResults('${test.id}')" style="background-color: rgba(6, 78, 59, 0.4); border-color: rgba(4, 120, 87, 0.6); color: #6ee7b7;" class="hover:opacity-80 border px-2.5 py-1.5 rounded text-[11px] font-medium transition-all" title="Переглянути оцінки учнів">
                            📊 Результати
                        </button>
                        <button onclick="exportTestToPDF('${test.id}')" class="bg-amber-900/40 hover:bg-amber-800/60 text-amber-300 border border-amber-700/60 px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors" title="Завантажити PDF для друку">
                            🖨️ PDF
                        </button>
                        <button onclick="deleteExistingTest('${test.id}')" class="bg-red-900/30 hover:bg-red-800/50 text-red-400 border border-red-800/60 px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = `<p class="text-red-400 text-xs text-center py-6">Не вдалося завантажити список тестів. Перевірте бекенд.</p>`;
        console.error(err);
    }
}

function copyTestUrl(testId) {
    const url = `${window.location.origin}/index.html?id=${testId}`;
    navigator.clipboard.writeText(url).then(() => {
        alert("🔗 Посилання для учнів скопійовано!");
    });
}

async function editExistingTest(testId, isDuplicate = false) {
    try {
        const res = await fetch(`http://127.0.0.1:8000/api/tests/${testId}`);
        const json = await res.json();

        if (!res.ok || json.status !== 'success') {
            alert("Не вдалося завантажити тест");
            return;
        }

        const { meta, modules } = json.data;
        document.getElementById('meta-highlight').value = meta.titleHighlight || '';
        document.getElementById('meta-main').value = isDuplicate ? `${meta.titleMain || ''} (Копія)`.trim() : (meta.titleMain || '');
        document.getElementById('meta-subtitle').value = meta.subtitle || '';

        testData = modules || [];
        document.getElementById('result-box').classList.add('hidden');

        if (isDuplicate) {
            editingTestId = null;
            document.getElementById('saveBtn').innerText = "Зберегти копію як новий тест";
        } else {
            editingTestId = testId;
            document.getElementById('saveBtn').innerText = "Оновити тест у базі";
        }

        renderVisualEditor();
        switchTab('builder');
    } catch (err) {
        alert("Помилка підключення до сервера");
        console.error(err);
    }
}

async function deleteExistingTest(testId) {
    if (!confirm("Точно видалити цей тест назавжди?")) return;

    try {
        const res = await fetch(`http://127.0.0.1:8000/api/tests/${testId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
if (handleUnauthorized(res.status)) return;
        if (res.ok) {
            if (editingTestId === testId) startNewTest();
            loadTestsList();
        } else {
            alert("Помилка при видаленні тесту");
        }
    } catch (err) {
        alert("Помилка з'єднання з сервером");
        console.error(err);
    }
}

// ==========================================
// 6. ЕКСПОРТ ТЕСТУ В PDF ДЛЯ ДРУКУ (А4)
// ==========================================

async function exportTestToPDF(testId) {
    try {
        const res = await fetch(`http://127.0.0.1:8000/api/tests/${testId}`);
        const json = await res.json();

        if (!res.ok || json.status !== 'success') {
            alert("Не вдалося завантажити тест для експорту");
            return;
        }

        const { meta, modules, author } = json.data;
        const fullTitle = `${meta.titleHighlight || ''} ${meta.titleMain || 'Тестова робота'}`.trim();
        const subtitle = meta.subtitle || '';
        const authorName = author?.name || '';

        // Функція, щоб не дублювати номер, якщо він вже є в тексті питання (напр. "1. Питання")
        const formatQuestionText = (idx, rawText) => {
            const text = (rawText || '').trim();
            if (/^\d+[\.\)]\s*/.test(text)) {
                return text.replace(/^(\d+[\.\)])/, '<strong>$1</strong>');
            }
            return `<strong>${idx + 1}.</strong> ${text}`;
        };

        const modulesHtml = modules.map((mod, mIdx) => {
            const modTitle = mod.title || `Завдання ${mIdx + 1}`;
            const modSub = mod.subtitle || '';
            let bodyHtml = '';

            // 1. Одиночний вибір (radio)
            if (mod.type === 'radio' && Array.isArray(mod.data)) {
                bodyHtml = `<div class="radio-columns">` + mod.data.map((item, qIdx) => `
                    <div class="question-item">
                        <p class="q-text">${formatQuestionText(qIdx, item.q)}</p>
                        <div class="options-grid">
                            ${(item.opts || []).map(opt => `
                                <div class="option-line"><span class="checkbox-circle"></span> <span>${opt}</span></div>
                            `).join('')}
                        </div>
                    </div>
                `).join('') + `</div>`;
            }
            // 2. Логічні пари (pairs)
            else if (mod.type === 'pairs' && Array.isArray(mod.data)) {
                const leftCol = mod.data.map((item, i) => `
                    <div class="pair-item"><strong>${i + 1}.</strong> <code>${item.ext}</code></div>
                `).join('');
                
                const shuffledRight = [...mod.data]
                    .sort(() => Math.random() - 0.5)
                    .map((item, i) => `
                        <div class="pair-item"><strong>${String.fromCharCode(1040 + i)})</strong> ${item.desc}</div>
                    `).join('');

                bodyHtml = `
                    <div class="pairs-table">
                        <div>${leftCol}</div>
                        <div>${shuffledRight}</div>
                    </div>
                    <div class="answer-strip">Відповідність: ${mod.data.map((_, i) => `${i + 1} — [ &nbsp;&nbsp; ]`).join(' &nbsp;&nbsp; ')}</div>
                `;
            }
            // 3. Послідовність (ordering)
            else if (mod.type === 'ordering' && Array.isArray(mod.lists)) {
                bodyHtml = `<div class="ordering-grid">` + mod.lists.map(list => {
                    const shuffledItems = [...list.items].sort(() => Math.random() - 0.5);
                    return `
                        <div class="ordering-col">
                            <div class="sub-header">${list.name}</div>
                            ${shuffledItems.map(item => `
                                <div class="order-row"><span class="box-square"></span> ${item.text}</div>
                            `).join('')}
                        </div>
                    `;
                }).join('') + `</div>`;
            }
            // 4. Сортування по папках (sorting)
            else if (mod.type === 'sorting' && Array.isArray(mod.files) && Array.isArray(mod.folders)) {
                const shuffledFiles = [...mod.files].sort(() => Math.random() - 0.5);
                bodyHtml = `
                    <div class="files-pool">
                        <strong>Елементи:</strong> ${shuffledFiles.map(f => `<span class="file-chip">${f.n}</span>`).join(' ')}
                    </div>
                    <div class="folders-grid" style="grid-template-columns: repeat(${Math.min(mod.folders.length, 4)}, 1fr);">
                        ${mod.folders.map(folder => `
                            <div class="folder-box">
                                <div class="folder-title">${folder.name}</div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
            // 5. Пошук помилок (mistakes)
            else if (mod.type === 'mistakes' && Array.isArray(mod.data)) {
                bodyHtml = mod.data.map(item => `
                    <div class="mistake-row">
                        <span class="box-square"></span> <code>${item.n}</code>
                    </div>
                `).join('');
            }
            // 6. Заповнення пропусків (fill-in)
            else if (mod.type === 'fill-in' && Array.isArray(mod.data)) {
                bodyHtml = mod.data.map((item, i) => `
                    <p class="fill-row">
                        <strong>${i + 1}.</strong> ${item.pre} <span class="blank-line"></span> ${item.post}
                    </p>
                `).join('');
            }
            // 7. Відкриті питання (open)
            else if (mod.type === 'open' && Array.isArray(mod.data)) {
                bodyHtml = mod.data.map((item, i) => `
                    <div class="open-item">
                        <p class="q-text">${formatQuestionText(i, item.q)}</p>
                        <div class="write-lines">
                            <div class="line"></div>
                            ${item.type !== 'text' ? '<div class="line"></div>' : ''}
                        </div>
                    </div>
                `).join('');
            }
            // 8. Клавіатурний тренажер / текст (typing)
            else if (mod.type === 'typing' && mod.text) {
                bodyHtml = `<div class="typing-box">${mod.text}</div>`;
            }

            return `
                <div class="module-block">
                    <div class="module-header">Блок ${mIdx + 1}. ${modTitle}</div>
                    ${modSub ? `<div class="module-desc">${modSub}</div>` : ''}
                    ${bodyHtml}
                </div>
            `;
        }).join('');

        const printWindow = window.open('', '_blank', 'width=900,height=1100');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="uk">
            <head>
                <meta charset="UTF-8">
                <title>${fullTitle} — PDF</title>
                <style>
                    @page {
                        size: A4 portrait;
                        margin: 10mm 12mm;
                    }
                    * {
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Segoe UI', Arial, sans-serif;
                        color: #111;
                        line-height: 1.32;
                        font-size: 10.5px;
                        margin: 0;
                        background: #e2e8f0;
                    }
                    /* Контейнер листа А4 для прев'ю на екрані */
                    .sheet {
                        width: 210mm;
                        min-height: 297mm;
                        margin: 15px auto;
                        padding: 10mm 12mm;
                        background: #fff;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                    }
                    @media print {
                        body { background: #fff; }
                        .sheet {
                            width: 100%;
                            min-height: auto;
                            margin: 0;
                            padding: 0;
                            box-shadow: none;
                        }
                    }
                    code {
                        font-family: Consolas, 'Courier New', monospace;
                        background: #f1f5f9;
                        padding: 1px 4px;
                        border-radius: 3px;
                        font-size: 10px;
                    }
                    .header-box {
                        border-bottom: 1.5px solid #111;
                        padding-bottom: 6px;
                        margin-bottom: 10px;
                    }
                    .title { font-size: 16px; font-weight: 700; margin: 0 0 2px 0; }
                    .subtitle { font-size: 10.5px; color: #444; margin: 0 0 6px 0; }
                    .student-meta {
                        display: flex;
                        justify-content: space-between;
                        gap: 12px;
                        font-size: 10.5px;
                        margin-top: 6px;
                    }
                    .student-meta span { flex: 1; border-bottom: 1px solid #333; padding-bottom: 1px; }
                    .module-block {
                        margin-bottom: 10px;
                    }
                    .module-header {
                        font-weight: 700;
                        font-size: 11.5px;
                        background: #f1f5f9;
                        padding: 3px 7px;
                        border-left: 3px solid #0f172a;
                        margin-bottom: 5px;
                        page-break-after: avoid;
                    }
                    .module-desc { font-style: italic; color: #333; margin-bottom: 5px; font-size: 10px; }
                    
                    /* Компактна двоколонкова сітка для тестів з вибором */
                    .radio-columns {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 6px 14px;
                    }
                    .question-item {
                        break-inside: avoid;
                        padding: 3px 5px;
                        border-bottom: 1px dashed #e2e8f0;
                    }
                    .q-text { margin: 0 0 3px 0; font-size: 10.5px; }
                    .options-grid { display: flex; flex-direction: column; gap: 2px; padding-left: 8px; }
                    .option-line { display: flex; align-items: flex-start; gap: 5px; font-size: 10px; }
                    .checkbox-circle {
                        display: inline-block; width: 9px; height: 9px; margin-top: 2px;
                        border: 1.2px solid #222; border-radius: 50%; flex-shrink: 0;
                    }
                    .box-square {
                        display: inline-block; width: 10px; height: 10px; margin-top: 1px;
                        border: 1.2px solid #222; margin-right: 6px; flex-shrink: 0;
                    }
                    .pairs-table { display: grid; grid-template-columns: 0.8fr 1.6fr; gap: 12px; margin-bottom: 5px; }
                    .pair-item { margin-bottom: 3px; font-size: 10px; }
                    .answer-strip { font-weight: 600; margin-top: 4px; font-size: 10.5px; }
                    .ordering-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                    .sub-header { font-weight: 600; margin-bottom: 3px; color: #333; font-size: 10.5px; }
                    .order-row { margin-bottom: 3px; display: flex; align-items: flex-start; font-size: 10px; }
                    .files-pool { margin-bottom: 6px; line-height: 1.6; }
                    .file-chip {
                        display: inline-block; border: 1px solid #64748b; border-radius: 3px;
                        padding: 0 5px; margin-right: 3px; font-family: Consolas, monospace; font-size: 10px;
                    }
                    .folders-grid { display: grid; gap: 6px; }
                    .folder-box { border: 1.2px solid #334155; border-radius: 4px; padding: 4px; min-height: 55px; }
                    .folder-title { font-weight: 700; text-align: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; font-size: 10.5px; }
                    .mistake-row { margin-bottom: 3px; display: flex; align-items: flex-start; font-size: 10px; }
                    .fill-row { margin-bottom: 5px; line-height: 1.5; }
                    .blank-line { display: inline-block; width: 95px; border-bottom: 1.2px solid #111; }
                    .open-item { margin-bottom: 6px; }
                    .write-lines .line { border-bottom: 1px solid #888; height: 17px; }
                    .typing-box { border: 1px solid #94a3b8; padding: 6px; font-family: Consolas, monospace; background: #f8fafc; font-size: 10px; }
                    .footer {
                        margin-top: 12px; padding-top: 4px; border-top: 1px solid #ccc;
                        font-size: 9px; color: #666; display: flex; justify-content: space-between;
                    }
                </style>
            </head>
            <body>
                <div class="sheet">
                    <div class="header-box">
                        <h1 class="title">${fullTitle}</h1>
                        ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
                        <div class="student-meta">
                            <span>Прізвище та ім'я:</span>
                            <span style="max-width: 130px;">Клас / Група:</span>
                            <span style="max-width: 110px;">Дата:</span>
                        </div>
                    </div>

                    ${modulesHtml}

                    <div class="footer">
                        <span>OS Explorer • Платформа тестувань</span>
                        <span>${authorName ? `Автор: ${authorName}` : ''}</span>
                    </div>
                </div>

                <script>
                    window.onload = () => {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    } catch (err) {
        alert("Помилка при формуванні PDF");
        console.error(err);
    }
}

// ==========================================
// 7. ЖУРНАЛ РЕЗУЛЬТАТІВ УЧНІВ ТА ДЕТАЛЬНИЙ РОЗБІР
// ==========================================
let currentOpenedTestId = null;

async function openTestResults(testId) {
    currentOpenedTestId = testId;
    const modal = document.getElementById('results-modal');
    const body = document.getElementById('results-modal-body');
    const sub = document.getElementById('results-modal-subtitle');

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    sub.innerText = "Завантаження...";
    body.innerHTML = `<p class="text-xs text-slate-400 text-center py-8 animate-pulse">Отримання даних з бази...</p>`;

    try {
        const res = await fetch(`http://127.0.0.1:8000/api/tests/${testId}/results`, {
            headers: getAuthHeaders()
        });
        if (handleUnauthorized(res.status)) return;

        const json = await res.json();
        if (!res.ok || json.status !== 'success') {
            body.innerHTML = `<p class="text-xs text-red-400 text-center py-6">${json.detail || 'Помилка завантаження'}</p>`;
            return;
        }

        sub.innerText = `${json.test_title} • Всього робіт: ${json.data.length} (натисніть на рядок для перегляду відповідей)`;

        if (json.data.length === 0) {
            body.innerHTML = `<p class="text-xs text-slate-400 text-center py-8">Ще жоден учень не пройшов цей тест.</p>`;
            return;
        }

        const rows = json.data.map((r, i) => {
            const dateStr = new Date(r.submitted_at + 'Z').toLocaleString('uk-UA', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            });
            const scoreStyle = r.score >= 85 
                ? 'color: #34d399; border-color: rgba(16, 185, 129, 0.4); background: rgba(6, 78, 59, 0.3);'
                : r.score >= 60 
                ? 'color: #fbbf24; border-color: rgba(245, 158, 11, 0.4); background: rgba(120, 53, 15, 0.3);'
                : 'color: #f87171; border-color: rgba(239, 68, 68, 0.4); background: rgba(127, 29, 29, 0.3);';

            return `
                <tr onclick="openResultDetails('${r.id}')" class="border-b border-slate-800/80 hover:bg-slate-800/60 cursor-pointer transition-colors text-xs group">
                    <td class="py-2.5 px-3 text-slate-500 font-mono">${i + 1}</td>
                    <td class="py-2.5 px-3 font-medium text-white group-hover:text-cyan-400 transition-colors">${r.student_name}</td>
                    <td class="py-2.5 px-3 text-center">
                        <span style="${scoreStyle}" class="px-2.5 py-0.5 rounded border font-mono font-bold inline-block">${r.score} / ${r.max_score}</span>
                    </td>
                    <td class="py-2.5 px-3 text-right text-slate-400 font-mono text-[11px]">
                        ${dateStr} <span class="ml-2 text-cyan-400 opacity-60 group-hover:opacity-100">→</span>
                    </td>
                </tr>
            `;
        }).join('');

        body.innerHTML = `
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="border-b border-slate-700 text-[11px] text-slate-400 uppercase">
                        <th class="py-2 px-3">#</th>
                        <th class="py-2 px-3">Учень</th>
                        <th class="py-2 px-3 text-center">Результат</th>
                        <th class="py-2 px-3 text-right">Дата і час</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    } catch (err) {
        body.innerHTML = `<p class="text-xs text-red-400 text-center py-6">Помилка з'єднання із сервером</p>`;
    }
}

async function openResultDetails(resultId) {
    const body = document.getElementById('results-modal-body');
    const sub = document.getElementById('results-modal-subtitle');

    body.innerHTML = `<p class="text-xs text-slate-400 text-center py-8 animate-pulse">Завантаження відповідей учня...</p>`;

    try {
        const res = await fetch(`http://127.0.0.1:8000/api/results/${resultId}`, {
            headers: getAuthHeaders()
        });
        if (handleUnauthorized(res.status)) return;

        const json = await res.json();
        if (!res.ok || json.status !== 'success') {
            body.innerHTML = `<p class="text-xs text-red-400 text-center py-6">${json.detail || 'Помилка завантаження'}</p>`;
            return;
        }

        const data = json.data;
        const dateStr = new Date(data.submitted_at + 'Z').toLocaleString('uk-UA', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        sub.innerText = `${data.student_name} • Оцінка: ${data.score}/${data.max_score} • ${dateStr}`;

        let detailsHtml = `
            <div class="mb-4">
                <button onclick="openTestResults('${data.test_id}')" class="bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 px-3 py-1 rounded text-xs font-medium transition-colors">
                    ← Назад до списку учнів
                </button>
            </div>
        `;

        if (!data.details || !Array.isArray(data.details.modules) || data.details.modules.length === 0) {
            detailsHtml += `<p class="text-xs text-slate-400 text-center py-6">Детальні відповіді для цієї спроби не збережені (старий формат запису).</p>`;
            body.innerHTML = detailsHtml;
            return;
        }

        detailsHtml += `<div class="space-y-4">`;
        data.details.modules.forEach((mod, mIdx) => {
            const itemsHtml = mod.items.map((item, iIdx) => {
                const statusBadge = item.isCorrect 
                    ? `<span style="color: #34d399;" class="font-bold">✅ Вірно</span>` 
                    : `<span style="color: #f87171;" class="font-bold">❌ Помилка</span>`;
                const borderStyle = item.isCorrect 
                    ? 'border-color: rgba(16, 185, 129, 0.3); background: rgba(6, 78, 59, 0.15);' 
                    : 'border-color: rgba(239, 68, 68, 0.3); background: rgba(127, 29, 29, 0.15);';

                return `
                    <div style="${borderStyle}" class="p-2.5 rounded border text-xs mb-2">
                        <div class="flex justify-between items-start gap-2 mb-1">
                            <span class="font-medium text-slate-200">${iIdx + 1}. ${item.question}</span>
                            <span class="flex-shrink-0 text-[11px]">${statusBadge}</span>
                        </div>
                        <div class="text-[11px] text-slate-300 mt-1">
                            <span class="text-slate-400">Відповідь учня:</span> <strong>${item.userAnswer}</strong>
                        </div>
                        ${!item.isCorrect ? `
                            <div class="text-[11px] text-slate-400 mt-0.5">
                                <span>Правильна відповідь:</span> <span style="color: #34d399;">${item.correctAnswer}</span>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');

            detailsHtml += `
                <div class="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                    <h4 class="text-xs font-bold text-cyan-400 mb-2.5">Блок ${mIdx + 1}. ${mod.title}</h4>
                    ${itemsHtml}
                </div>
            `;
        });
        detailsHtml += `</div>`;

        body.innerHTML = detailsHtml;
    } catch (err) {
        body.innerHTML = `<p class="text-xs text-red-400 text-center py-6">Помилка завантаження деталей</p>`;
    }
}

function closeResultsModal() {
    const modal = document.getElementById('results-modal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}