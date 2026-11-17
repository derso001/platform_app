// Головний масив, який зберігає структуру нашого тесту
let testData = [];

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
    saveBtn.innerText = "Збереження...";
    saveBtn.disabled = true;

    try {
        const response = await fetch('http://127.0.0.1:8000/api/tests/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok && result.status === 'success') {
            const currentHost = window.location.origin; 
            const finalLink = `${currentHost}/index.html?id=${result.test_id}`;
            
            document.getElementById('generated-link').value = finalLink;
            document.getElementById('result-box').classList.remove('hidden');
            document.getElementById('result-box').scrollIntoView({ behavior: 'smooth' });
            
            saveBtn.innerText = "Зберегти тест у базу";
            saveBtn.disabled = false;
        } else {
            alert("Помилка на сервері: " + JSON.stringify(result));
            saveBtn.innerText = "Зберегти тест у базу";
            saveBtn.disabled = false;
        }

    } catch (err) {
        alert("Не вдалося підключитися до бази даних. Перевірте, чи працює FastAPI (uvicorn).");
        saveBtn.innerText = "Зберегти тест у базу";
        saveBtn.disabled = false;
        console.error(err);
    }
});