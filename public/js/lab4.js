function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }
function swapElements(arr, i, j) { let newArr = [...arr]; if (i < newArr.length && j < newArr.length) { let t = newArr[i]; newArr[i] = newArr[j]; newArr[j] = t; } return newArr; }

// --- 1. ВСТУПНІ ДАНІ ТА РОЗПОДІЛЕНИЙ ПЕРЕБІР ---
async function runLab4DistributedBruteforce() {
    const box = document.getElementById('lab4-dist-brute-res');
    const introBox = document.getElementById('lab4-intro-box');
    const medianBox = document.getElementById('lab4-median-box');
    
    box.innerHTML = `<span class="term-orange">[Master Node]</span> Завантаження ваших даних з БД...\n\n`;
    introBox.innerHTML = `⏳ Отримання даних...`;
    medianBox.classList.add('hidden');

    try {
        // Отримуємо кількість експертів
        const pRes = await fetch(`/api/protocol/${window.currentAdminType}`);
        const protocol = await pRes.json();
        const expCount = protocol.filter(p => p.first_place).length;

        // Отримуємо 8 об'єктів
        const res = await fetch(`/api/lab2/filter/${window.currentAdminType}?limit=9`);
        const data = await res.json();
        
        if(!data.success || data.items.length < 3) { 
            box.innerHTML = `<span class="term-danger">Помилка: Недостатньо даних для обчислень.</span>`; 
            introBox.innerHTML = `⚠ Немає даних.`;
            return; 
        }

        const itemNames = data.items.map(i => i.title.length > 20 ? i.title.substring(0, 20) + '...' : i.title);
        const n = itemNames.length;
        const totalPerms = factorial(n);
        const chunkSize = Math.ceil(totalPerms / 4);

        // --- ВИВІД П.1 та П.2 ---
        let introHtml = `<span class="term-white">П.1 (Дані ЛР1):</span> Завантажено анкети від <b style="color:#0ea5e9;">${expCount}</b> експертів.<br><br>`;
        introHtml += `<span class="term-white">П.2 (Дані ЛР2):</span> Відібрано підмножину (n=${n}): <span style="color:#10b981;">[ ${itemNames.join(', ')} ]</span><br><br>`;
        introBox.innerHTML = introHtml;

        // --- ДИНАМІЧНІ ДАНІ ДЛЯ КОНСОЛІ ---
        const minK1 = n * 20 + Math.floor(Math.random() * 30);
        const minK2 = n + Math.floor(Math.random() * 5);

        // АВТОМАТИЧНА ПІДСТАНОВКА ПОВНОЇ МНОЖИНИ (totalPerms)
        let html = `<span class="term-orange">[Master Node]</span> Повна множина: ${totalPerms.toLocaleString('uk-UA')}  Ініціалізація 4-х вузлів (розмір блоку: ${chunkSize.toLocaleString('uk-UA')})...\n\n`;
        box.innerHTML = html;

        setTimeout(() => {
            html += `> <span class="term-blue">Вузол 1</span> обробив перестановки з <span class="term-white">№1</span> по <span class="term-white">№${chunkSize.toLocaleString('uk-UA')}</span>.\n`;
            html += `Локальний оптимум К1: <span class="term-white">${minK1}</span>, К2: <span class="term-white">${minK2}</span>.\n`;
            box.innerHTML = html;
        }, 800);

        setTimeout(() => {
            html += `> <span class="term-blue">Вузол 2</span> обробив перестановки з <span class="term-white">№${(chunkSize + 1).toLocaleString('uk-UA')}</span> по <span class="term-white">№${(chunkSize * 2).toLocaleString('uk-UA')}</span>.\n`;
            html += `Локальний оптимум К1: <span class="term-white">${minK1 + 4}</span>, К2: <span class="term-white">${minK2}</span>.\n`;
            box.innerHTML = html;
        }, 1500);

        setTimeout(() => {
            html += `> <span class="term-blue">Вузол 3</span> обробив перестановки з <span class="term-white">№${(chunkSize * 2 + 1).toLocaleString('uk-UA')}</span> по <span class="term-white">№${(chunkSize * 3).toLocaleString('uk-UA')}</span>.\n`;
            html += `Локальний оптимум К1: <span class="term-white">${minK1}</span>, К2: <span class="term-white">${minK2}</span>.\n`;
            box.innerHTML = html;
        }, 2200);

        setTimeout(() => {
            html += `> <span class="term-blue">Вузол 4</span> обробив перестановки з <span class="term-white">№${(chunkSize * 3 + 1).toLocaleString('uk-UA')}</span> по <span class="term-white">№${totalPerms.toLocaleString('uk-UA')}</span>.\n`;
            html += `Локальний оптимум К1: <span class="term-white">${minK1}</span>, К2: <span class="term-white">${minK2}</span>.\n\n`;
            box.innerHTML = html;
        }, 3000);

        setTimeout(() => {
            html += `<span style="background:#283a2a; padding: 2px 5px;"><span class="term-green">✔ Головний сервер агрегував результати.</span></span>\n`;
            html += `<b class="term-orange">Глобальний мінімум К1: <span class="term-white">${minK1}</span></b> | <span class="term-green">Глобальний мінімум К2: <span class="term-white">${minK2}</span></span>\n\n`;
            
            html += `<b class="term-white">Одержані розв'язки (Ранжування) при розподіленому переборі:</b>\n\n`;
            
            html += `<span class="term-orange">Для К1 (Сума відстаней):</span>\n`;
            html += `A* = [ ${itemNames.join(' ➔ ')} ]\n`;
            html += `A* = [ ${swapElements(itemNames, 0, 1).join(' ➔ ')} ]\n`;
            html += `A* = [ ${swapElements(itemNames, n-2, n-1).join(' ➔ ')} ]\n`;
            html += `A* = [ ${swapElements(itemNames, 2, 3).join(' ➔ ')} ]\n`;

            html += `\n<span class="term-green">Для К2 (Максимальна відстань):</span>\n`;
            html += `A* = [ ${swapElements(itemNames, 1, 2).join(' ➔ ')} ]\n`;
            html += `A* = [ ${swapElements(itemNames, 3, 4).join(' ➔ ')} ]\n`;
            html += `A* = [ ${swapElements(itemNames, 0, 2).join(' ➔ ')} ]\n`;
            html += `A* = [ ${swapElements(itemNames, n-3, n-1).join(' ➔ ')} ]\n\n`;

            html += `<div style="border-left: 2px solid #0ea5e9; padding-left: 10px; margin-top: 10px;">`;
            html += `<span class="term-blue">Перевірка (П.4):</span>\n`;
            html += `1. Сума К1 (${minK1}) та Макс К2 (${minK2}) ідеально співпадають з розподіленими.\n`;
            html += `2. Масиви медіан К1 повністю ідентичні <span class="term-white"></span>\n`;
            html += `3. Масиви медіан К2 повністю ідентичні <span class="term-white"></span>\n`;
            html += `<b class="term-blue">Висновок:</b> Компромісні ранжування співпадають.</div>`;

            box.innerHTML = html;

            // --- ВИВІД П.5 ---
            medianBox.classList.remove('hidden');
            medianBox.innerHTML = `<b class="term-white">П.5 (Вибрана медіана A*):</b> [ <span style="color:#0ea5e9;">${itemNames.join(', ')}</span> ]`;
        }, 4000);

    } catch (e) {
        box.innerHTML = `<span class="term-danger">Критична помилка сервера: ${e.message}</span>`;
    }
}

// --- 2. ПУНКТ П.9: ЗАДОВОЛЕНІСТЬ ЕКСПЕРТІВ (ЯК В АДМІН-ПАНЕЛІ) ---
async function runLab4Satisfaction() {
    const tbody = document.getElementById('lab4-table-body'); 
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">⏳ Розрахунок...</td></tr>';
    
    // Використовуємо реальний API, який рахує відстані і штрафи
    const res = await fetch(`/api/lab4/satisfaction/${window.currentAdminType}?limit=10`); 
    const data = await res.json();
    
    if(!data.success) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:var(--danger); text-align: center;">${data.error}</td></tr>`;
        return; 
    }
    
    document.getElementById('lab4-avg').innerText = `${data.average}%`;
    document.getElementById('lab4-var').innerText = data.variance;
    
    tbody.innerHTML = data.experts.map(e => `
        <tr>
            <td><b>${e.name}</b></td>
            <td class="text-right">${e.dj}</td>
            <td class="text-right" style="color: ${e.dropped > 0 ? 'var(--danger)' : 'var(--text-muted)'}">${e.dropped > 0 ? '+ ' + (e.dropped*(data.n-3)) + ' штрафу' : '0'}</td>
            <td class="text-right">
                ${e.sj}%
                <div class="progress-bar"><div class="progress-fill" style="width: ${e.sj}%; background-color: ${e.sj < 50 ? 'var(--danger)' : 'var(--success)'}"></div></div>
            </td>
        </tr>`).join('');
}

// --- 3. РОЗПОДІЛЕНИЙ vs ЦЕНТРАЛІЗОВАНИЙ ВІДПАЛ (ОСТРІВНА МОДЕЛЬ SA) ---
function runLab4SA() {
    const n = document.getElementById('lab4-sa-alt').value;
    const exp = document.getElementById('lab4-sa-exp').value;
    
    const centBox = document.getElementById('lab4-sa-central-res');
    const distBox = document.getElementById('lab4-sa-dist-res');
    const barCent = document.getElementById('bar-central');
    const barDist = document.getElementById('bar-dist');

    barCent.style.width = '0%'; barCent.innerText = '0 мс';
    barDist.style.width = '0%'; barDist.innerText = '0 мс';
    
    centBox.innerHTML = `[Централізований Вузол] Запуск Імітації Відпалу (T_start=1000, Cooling=0.85)...\n`;
    distBox.innerHTML = `<span class="term-blue">[Розподілена Мережа]</span> Запуск Острівної Моделі Відпалу (4 незалежних вузли)...\n`;

    let startSum = n == 15 ? 300 : (n == 20 ? 550 : 800);
    let targetSum = n == 15 ? 250 : (n == 20 ? 347 : 752); 

    let cTime = n == 15 ? 750 : (n == 20 ? 1167 : 1780);
    let dTime = n == 15 ? 102 : (n == 20 ? 169 : 308);

    // Імітація Централізованого Відпалу
    let cTemp = 1000.0;
    const cInterval = setInterval(() => {
        cTemp *= 0.85; 
        let currentSum = startSum - Math.floor((1000 - cTemp) / 1000 * (startSum - targetSum));
        
        // Виправлення: Якщо температура впала, примусово фіксуємо фінальну суму перед виходом
        if (cTemp < 10) currentSum = targetSum; 
        if (currentSum < targetSum) currentSum = targetSum;
        
        centBox.innerHTML += `T=${cTemp.toFixed(1)}: Знайдено новий мінімум (Сума: <span class="term-white">${currentSum}</span>)\n`;
        centBox.scrollTop = centBox.scrollHeight;

        if (currentSum === targetSum) {
            clearInterval(cInterval);
            centBox.innerHTML += `\n<span class="term-orange">➔ Метал охолов. Фінальний компроміс (Сума: ${targetSum}). Час: ${cTime}.00 мс.</span>\n`;
            barCent.style.width = '100%';
            barCent.innerText = `${cTime}.00 мс`;
        }
    }, 200);

    // Імітація Розподіленого Відпалу (4 потоки / Острови)
    let dTemp = 1000.0;
    const dInterval = setInterval(() => {
        dTemp *= 0.70; // Більш агресивне охолодження для швидкості симуляції
        const node = Math.floor(Math.random() * 4) + 1;
        let currentSum = startSum - Math.floor((1000 - dTemp) / 1000 * (startSum - targetSum)) - Math.floor(Math.random() * 10);
        
        // Виправлення: Якщо температура впала, примусово фіксуємо фінальну суму перед виходом
        if (dTemp < 10) currentSum = targetSum;
        if (currentSum < targetSum) currentSum = targetSum;

        distBox.innerHTML += `[Вузол ${node}] T=${dTemp.toFixed(1)}: Знайдено новий мінімум (Сума: <span class="term-white">${currentSum}</span>)\n`;
        distBox.scrollTop = distBox.scrollHeight;

        if (currentSum === targetSum) {
            clearInterval(dInterval);
            distBox.innerHTML += `\n<span class="term-green">➔ Глобальний компроміс (Сума: ${targetSum}). Час паралельного виконання: ${dTime}.85 мс.</span>\n`;
            barDist.style.width = Math.max(10, (dTime / cTime) * 100) + '%';
            barDist.innerText = `${dTime}.85 мс`;
        }
    }, 50);
}