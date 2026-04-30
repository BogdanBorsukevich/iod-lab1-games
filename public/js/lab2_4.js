async function runLab2Filter() {
    const box = document.getElementById('filter-res'); box.innerHTML = '⏳ Аналіз евристик та послідовне відсіювання...';
    const res = await fetch(`/api/lab2/filter/${window.currentAdminType}?limit=10`); const data = await res.json();
    if(!data.success) return box.innerHTML = data.error;
    let html = `<b>Каскадне відсіювання об'єктів:</b><br><br>`;
    data.steps.forEach(step => {
        html += `<div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid var(--info);"><span style="color:var(--info); font-weight:bold;">Крок ${step.step}:</span> Застосовуємо <i style="color:#a855f7;">"${step.heuristic}"</i><br><small>Залишилось об'єктів: <b>${step.count}</b>. (${step.items.join(', ')})</small></div>`;
    });
    html += `<b style="color:var(--success);">✅ Фінальний Топ-${data.items.length} передано до ЛР3 та ЛР4.</b>`;
    box.innerHTML = html;
}

async function runLab3Matrices() {
    const box = document.getElementById('matrices-res'); box.innerHTML = '⏳ Завантаження...';
    const res = await fetch(`/api/lab3/matrices/${window.currentAdminType}?limit=10`); const data = await res.json();
    if(!data.success) return box.innerHTML = data.error;
    let html = `<b>Аналіз відсіяних об'єктів (Топ-10):</b><br><small>${data.items.map((it, i)=> `${i+1}. ${it}`).join('<br>')}</small><br><br>`;
    html += `<b>Матриця статистики (i > j):</b><br><table border="1" style="width:100%; border-color:var(--border);">${data.statMatrix.map(row => `<tr>${row.map(c => `<td class="matrix-cell">${c}</td>`).join('')}</tr>`).join('')}</table><br>`;
    html += `<b>Знакова матриця:</b><br><table border="1" style="width:100%; border-color:var(--border);">${data.signMatrix.map(row => `<tr>${row.map(c => `<td class="matrix-cell">${c}</td>`).join('')}</tr>`).join('')}</table>`;
    box.innerHTML = html;
}

async function runLab3Bruteforce() {
    const box = document.getElementById('bruteforce-res'); box.innerHTML = '⏳ Перебір 3 628 800 перестановок... Зачекайте (може зайняти час).';
    const res = await fetch(`/api/lab3/bruteforce/${window.currentAdminType}?limit=10`); const data = await res.json();
    if(!data.success) return box.innerHTML = data.error;
    box.innerHTML = `<b>Всього перестановок (n!):</b> ${data.total}<br><br><b>🥇 Медіана Кемені (Min Сума відстаней: ${data.medianSum.distance})</b><br><small style="color:var(--success)">${data.medianSum.ranking.join('<br>')}</small>`;
}

async function runLab3Annealing() {
    const box = document.getElementById('annealing-res'); box.innerHTML = '⏳ Охолодження металу... Шукаємо багатокритеріальні компроміси...';
    const res = await fetch(`/api/lab3/annealing/${window.currentAdminType}?limit=10`); const data = await res.json();
    if(!data.success) return box.innerHTML = data.error;
    let html = `<h3 style="color: #d946ef; text-align: left; font-size: 16px; margin-bottom: 10px; margin-top:0;">Знайдені незалежні розв'язки:</h3>`;
    html += `<div style="overflow-x:auto;"><table class="sa-table"><thead><tr><th style="width: 5%;">#</th><th style="width: 47%;"><span class="sa-k1-title">Колонка 1: Оптимальні за К1</span><br><small style="font-weight:normal; color:var(--text-muted);">(Мінімізована сума відстаней)</small></th><th style="width: 47%;"><span class="sa-k2-title">Колонка 2: Оптимальні за К2</span><br><small style="font-weight:normal; color:var(--text-muted);">(Мінімізований максимум)</small></th></tr></thead><tbody>`;
    const maxRows = Math.max(data.k1Solutions.length, data.k2Solutions.length);
    for(let i=0; i<maxRows; i++) {
        const sol1 = data.k1Solutions[i]; const sol2 = data.k2Solutions[i];
        let cell1 = sol1 ? `[${sol1.ranking.join(', ')}]<br><br><span class="sa-k1-title">Мінімум Суми (К1): ${sol1.k1}</span><br><small style="color:var(--text-muted);">(При цьому Максимум К2 = ${sol1.k2})</small>` : `-`;
        let cell2 = sol2 ? `[${sol2.ranking.join(', ')}]<br><br><span class="sa-k2-title">Мінімум Максимуму (К2): ${sol2.k2}</span><br><small style="color:var(--text-muted);">(При цьому Сума К1 = ${sol2.k1})</small>` : `-`;
        html += `<tr><td><b style="color:white;">${i+1}</b></td><td>${cell1}</td><td>${cell2}</td></tr>`;
    }
    html += `</tbody></table></div>`;
    box.innerHTML = html;
}

async function runLab4Satisfaction() {
    const tbody = document.getElementById('lab4-table-body'); tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">⏳ Розрахунок...</td></tr>';
    const res = await fetch(`/api/lab4/satisfaction/${window.currentAdminType}?limit=10`); const data = await res.json();
    if(!data.success) return tbody.innerHTML = `<tr><td colspan="4" style="color:var(--danger); text-align: center;">${data.error}</td></tr>`;
    document.getElementById('lab4-avg').innerText = `${data.average}%`;
    document.getElementById('lab4-var').innerText = data.variance;
    tbody.innerHTML = data.experts.map(e => `<tr><td><b>${e.name}</b></td><td class="text-right">${e.dj}</td><td class="text-right" style="color: ${e.dropped > 0 ? 'var(--danger)' : 'var(--text-muted)'}">${e.dropped > 0 ? '+ ' + (e.dropped*(data.n-3)) + ' штрафу' : '0'}</td><td class="text-right">${e.sj}%<div class="progress-bar"><div class="progress-fill" style="width: ${e.sj}%; background-color: ${e.sj < 50 ? 'var(--danger)' : 'var(--success)'}"></div></div></td></tr>`).join('');
}

async function runLab3Simulation() {
    const size = document.getElementById('sim-size').value;
    const box = document.getElementById('sim-res'); box.innerHTML = `⏳ Симуляція Імітації Відпалу для ${size} об'єктів...`;
    const res = await fetch(`/api/lab3/simulate?itemsCount=${size}&expertsCount=20`); const data = await res.json();
    box.innerHTML = `<span style="color:var(--warning)"><b>✅ Симуляцію завершено!</b></span><br>Об'єктів: ${data.items}<br>Експертів (віртуальних): ${data.experts}<br><br><b>Час виконання (SA):</b> ${data.timeMs} мс.<br><i>Примітка: Прямий перебір ${size}! зайняв би століття.</i><br><b>Найкраща знайдена відстань:</b> ${data.bestDistance}`;
}

async function loadAdminData(type) {
    window.currentAdminType = type;
    document.getElementById('proto-title').innerText = type === 'game' ? '📊 Протокол (Ігри)' : '📋 Протокол (Евристики)';
    loadUsers(); 
    const res = await fetch(`/api/protocol/${type}`); const d = await res.json();
    document.getElementById('protocol-table-body').innerHTML = d.map(p => `<tr><td>${p.username}</td><td>${p.first_place || '-'}</td><td>${p.second_place || '-'}</td><td>${p.third_place || '-'}</td><td class="text-right"><button class="btn-small btn-danger" onclick="resetVote(${p.id})">Скинути</button></td></tr>`).join('');
}

async function loadUsers() {
    const res = await fetch('/api/users'); const users = await res.json();
    document.getElementById('users-table-body').innerHTML = users.map(u => `<tr><td>${u.id}</td><td><b>${u.username}</b></td><td class="text-right"><button class="btn-small btn-danger" onclick="delUser(${u.id})">Видалити</button></td></tr>`).join('');
}

async function delUser(id) { if(confirm('Видалити?')) { await fetch(`/api/users/${id}`, {method:'DELETE'}); loadAdminData(window.currentAdminType); } }
async function resetVote(id) { await fetch(`/api/votes/${id}/${window.currentAdminType}`, {method:'DELETE'}); loadAdminData(window.currentAdminType); }