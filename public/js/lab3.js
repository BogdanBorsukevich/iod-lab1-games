function lab3SetType(type) {
    window.lab3Type = type;
    document.getElementById('lab3-type-label').innerHTML = `Активний тип: <b style="color:var(--primary)">${type === 'game' ? 'Ігри' : 'Евристики'}</b>`;
    document.getElementById('lab3-mc-table').innerHTML = 'Натисніть «Завантажити дані»';
    document.getElementById('lab3-stat-table').innerHTML = 'Завантажте дані вище';
    document.getElementById('lab3-rank-tables').innerHTML = 'Завантажте дані вище';
    document.getElementById('lab3-bf-result').innerHTML = 'Завантажте дані та натисніть кнопку';
    document.getElementById('lab3-medians').innerHTML = 'З\'явиться після прямого перебору';
    document.getElementById('lab3-annealing-res').innerHTML = 'Оберіть кількість початкових перестановок і натисніть кнопку';
}

async function lab3LoadData() {
    document.getElementById('lab3-mc-table').innerHTML = '⏳ Завантаження...';
    document.getElementById('lab3-stat-table').innerHTML = '⏳...';
    document.getElementById('lab3-rank-tables').innerHTML = '⏳...';

    const pRes = await fetch(`/api/protocol/${window.lab3Type}`);
    const protocol = await pRes.json();
    const activeExperts = protocol.filter(p => p.first_place);

    const itemsRes = await fetch(`/api/items/${window.lab3Type}`);
    const allItems = await itemsRes.json();
    if(!allItems || allItems.length < 2) { document.getElementById('lab3-mc-table').innerHTML = '⚠ Недостатньо даних.'; return; }
    
    const itemToNumberMap = {};
    allItems.forEach((item, index) => { itemToNumberMap[item.title] = index + 1; });

    // --- П.1.1 МНОЖИННІ ПОРІВНЯННЯ ---
    let mc = `<table class="mc-table"><thead><tr><th class="mc-row-label" style="text-transform: none;">Місце \\ Експерти</th>`;
    activeExperts.forEach((_, i) => { mc += `<th style="color:#6366f1;">${i+1}</th>`; });
    mc += `</tr></thead><tbody>`;

    const places = [ { key: 'first_place', label: '1', color: '#f59e0b' }, { key: 'second_place', label: '2', color: '#94a3b8' }, { key: 'third_place', label: '3', color: '#cd7c2d' } ];

    places.forEach(place => {
        mc += `<tr><td class="mc-row-label">${place.label}</td>`;
        activeExperts.forEach(exp => {
            const gameName = exp[place.key];
            const gameNumber = itemToNumberMap[gameName];
            const displayVal = gameNumber ? gameNumber : '<span style="color:var(--border)">-</span>';
            mc += `<td style="color:${place.color};">${displayVal}</td>`;
        });
        mc += `</tr>`;
    });
    mc += `</tbody></table>`;

    mc += `<br><small style="color:var(--text-muted)"><b>Легенда (Усі об'єкти):</b><br>`;
    allItems.forEach((item, i) => {
        mc += `<span style="display:inline-block; width:150px; margin-right:10px;">${i+1} = ${item.title.substring(0,20)}</span>`;
        if((i+1)%3===0) mc += `<br>`;
    });
    mc += `</small>`;
    document.getElementById('lab3-mc-table').innerHTML = mc;

    // --- П.1.2 СТАТИСТИКА (ЧАСТОТА) ---
    const n = allItems.length;
    const posCount = Array.from({length: n}, () => [0,0,0]);
    activeExperts.forEach(exp => {
        places.forEach((place, posIdx) => {
            const gameName = exp[place.key];
            if(gameName) {
                const objIdx = allItems.findIndex(t => t.title === gameName);
                if(objIdx >= 0) posCount[objIdx][posIdx]++;
            }
        });
    });

    let st = `<div style="display:flex; justify-content:flex-start; overflow-x:auto;">`;
    st += `<table class="academic-table"><thead><tr><th>Місце \\ Об'єкт</th>`;
    allItems.forEach((_, i) => { st += `<th>${i+1}</th>`; });
    st += `</tr></thead><tbody>`;

    for(let place = 0; place < 3; place++) {
        st += `<tr><td class="academic-header-col">${place + 1}</td>`;
        for(let obj = 0; obj < n; obj++) { st += `<td>${posCount[obj][place]}</td>`; }
        st += `</tr>`;
    }

    st += `<tr class="academic-sum-row"><td>Сума</td>`;
    const sums = [];
    for(let obj = 0; obj < n; obj++) {
        const sum = posCount[obj][0] + posCount[obj][1] + posCount[obj][2];
        sums.push(sum);
        st += `<td>${sum}</td>`;
    }
    st += `</tr></tbody></table></div>`;

    const maxSum = Math.max(...sums, 1);
    st += `<div style="margin-top: 20px;"><b style="color:var(--text-main);">Візуалізація частоти вибору:</b></div>`;
    st += `<div class="chart-container" style="overflow-x: auto; justify-content: flex-start; gap: 15px; padding-bottom: 20px;">`;
    
    for(let obj = 0; obj < n; obj++) {
        const total = sums[obj];
        const h1 = (posCount[obj][0] / maxSum) * 100;
        const h2 = (posCount[obj][1] / maxSum) * 100;
        const h3 = (posCount[obj][2] / maxSum) * 100;

        st += `<div class="chart-col" style="min-width: 30px;">
                  ${total > 0 ? `<div class="chart-sum">${total}</div>` : ''}
                  <div class="chart-bar-segment" style="height: ${h3}%; background: #cd7c2d;" title="3 місце"></div>
                  <div class="chart-bar-segment" style="height: ${h2}%; background: #94a3b8;" title="2 місце"></div>
                  <div class="chart-bar-segment" style="height: ${h1}%; background: #f59e0b;" title="1 місце"></div>
                  <div class="chart-label">${obj+1}</div>
               </div>`;
    }
    st += `</div>`;
    document.getElementById('lab3-stat-table').innerHTML = st;

    // --- П.1.3 РАНГИ ---
    const rankMatrix = Array.from({length: n}, () => Array(activeExperts.length).fill(0));
    activeExperts.forEach((exp, expIdx) => {
        places.forEach((place, posIdx) => {
            const gameName = exp[place.key];
            if(gameName) {
                const objIdx = allItems.findIndex(t => t.title === gameName);
                if(objIdx >= 0) rankMatrix[objIdx][expIdx] = posIdx + 1; 
            }
        });
    });

    let rt = `<div style="display:flex; justify-content:flex-start; overflow-x:auto;">`;
    rt += `<table class="academic-table"><thead><tr><th style="color:#10b981;">Об'єкт \\ Експ.</th>`;
    activeExperts.forEach((_, i) => { rt += `<th style="color:#ef4444;">${i+1}</th>`; });
    rt += `</tr></thead><tbody>`;

    rankMatrix.forEach((row, objIdx) => {
        rt += `<tr><td class="academic-header-col">${objIdx + 1}</td>`;
        row.forEach(val => {
            const vStyle = val === 0 ? 'color:var(--text-muted);' : 'font-weight:bold;';
            rt += `<td style="${vStyle}">${val}</td>`;
        });
        rt += `</tr>`;
    });
    rt += `</tbody></table></div>`;
    document.getElementById('lab3-rank-tables').innerHTML = rt;
}

// --- П.2 ПРЯМИЙ ПЕРЕБІР З ВИЯВЛЕННЯМ УСІХ МЕДІАН ТА ГЛОБАЛЬНОГО МАКСИМУМУ ---
async function lab3RunBruteforceDetailed() {
    const statusEl = document.getElementById('lab3-bf-status');
    const resultEl = document.getElementById('lab3-bf-result');
    const mediansEl = document.getElementById('lab3-medians');

    statusEl.style.display = 'block';
    statusEl.innerHTML = '⏳ Лексикографічний прямий перебір... Обчислюємо 3.6 млн варіантів.';
    resultEl.innerHTML = '';
    mediansEl.innerHTML = '';

    await new Promise(resolve => setTimeout(resolve, 50)); 

    try {
        const fRes = await fetch(`/api/lab2/filter/${window.lab3Type}?limit=10`);
        const filtered = await fRes.json();
        if(!filtered.success || filtered.items.length < 2) { statusEl.innerHTML = '⚠ Помилка даних.'; return; }
        const items = filtered.items;
        const n = items.length;

        const pRes = await fetch(`/api/protocol/${window.lab3Type}`);
        const experts = (await pRes.json()).filter(p => p.first_place);
        const E = experts.length;

        const itemsRes = await fetch(`/api/items/${window.lab3Type}`);
        const allItems = await itemsRes.json();
        const idToNumber = {};
        allItems.forEach((it, idx) => idToNumber[it.title] = idx + 1);

        const titles = items.map(i => i.title);
        const expPrefs = Array(E).fill(0).map(() => Array(n).fill(0).map(()=>Array(n).fill(0)));

        for(let e=0; e<E; e++) {
            const exp = experts[e];
            for(let i=0; i<n; i++) {
                for(let j=0; j<n; j++) {
                    if (i===j) continue;
                    let rankI = exp.first_place === titles[i] ? 1 : (exp.second_place === titles[i] ? 2 : (exp.third_place === titles[i] ? 3 : 99));
                    let rankJ = exp.first_place === titles[j] ? 1 : (exp.second_place === titles[j] ? 2 : (exp.third_place === titles[j] ? 3 : 99));
                    if(rankI !== 99 || rankJ !== 99) expPrefs[e][i][j] = rankI < rankJ ? 1 : (rankI > rankJ ? -1 : 0);
                }
            }
        }

        let sampleResults = []; // Для таблиці П.2 (випадковий зріз)
        let absoluteMedians = []; // Для таблиці П.3-4 (всі з min сумою)
        let totalCount = 0;
        let minSumDist = Infinity;
        
        let perm = Array.from({length: n}, (_, i) => i);

        function getNextPermutation(arr) {
            let i = arr.length - 2;
            while (i >= 0 && arr[i] >= arr[i + 1]) i--;
            if (i < 0) return false;
            let j = arr.length - 1;
            while (arr[j] <= arr[i]) j--;
            let temp = arr[i]; arr[i] = arr[j]; arr[j] = temp;
            let left = i + 1; let right = arr.length - 1;
            while (left < right) {
                let t = arr[left]; arr[left] = arr[right]; arr[right] = t;
                left++; right--;
            }
            return true;
        }

        const processPerm = () => {
            totalCount++;
            let totalSum = 0; let maxDist = 0;
            let dists = Array(E);

            for(let e=0; e<E; e++) {
                let dist = 0;
                for(let i=0; i<n; i++) {
                    for(let j=i+1; j<n; j++) {
                        dist += Math.abs(1 - expPrefs[e][perm[i]][perm[j]]);
                    }
                }
                dists[e] = dist;
                totalSum += dist;
                if(dist > maxDist) maxDist = dist;
            }

            // ШУКАЄМО ВСІ МЕДІАНИ
            if (totalSum < minSumDist) {
                minSumDist = totalSum;
                absoluteMedians = [{ ranking: perm.map(idx => titles[idx]), sum: totalSum, k2: maxDist }];
            } else if (totalSum === minSumDist) {
                absoluteMedians.push({ ranking: perm.map(idx => titles[idx]), sum: totalSum, k2: maxDist });
            }

            // ЗБЕРІГАЄМО ЗРІЗ ДЛЯ ТАБЛИЦІ П.2
            if (totalCount % 180000 === 0 && sampleResults.length < 20) {
                sampleResults.push({ permIds: perm.map(idx => idToNumber[titles[idx]]), dists: [...dists], sum: totalSum, max: maxDist });
            }
        };

        processPerm();
        while (getNextPermutation(perm)) processPerm();

        statusEl.style.display = 'none';

        // --- ВИВІД ТАБЛИЦІ П.2 ---
        let html2 = `<b style="color:var(--primary)">Всього перебрано: ${totalCount.toLocaleString()}</b><br><br>`;
        html2 += `<div style="background:white; padding:10px; border-radius:8px; overflow-x:auto;"><table class="academic-table brute-table" style="margin:0; width:100%;"><thead><tr>`;
        html2 += `<th style="color:black;">РАНГИ (Об'єкти)</th>`;
        for(let ex = 0; ex < E; ex++) { html2 += `<th style="color:black;">${ex+1}</th>`; }
        html2 += `<th style="color:#0ea5e9;">Сума (К1)</th><th style="color:#f59e0b;">Макс (К2)</th></tr></thead><tbody>`;
        sampleResults.forEach(row => {
            html2 += `<tr><td style="letter-spacing: 2px; font-weight:bold; color:black;">${row.permIds.join(' ')}</td>`;
            row.dists.forEach(d => { html2 += `<td style="color:black;">${d}</td>`; });
            html2 += `<td style="color:#0ea5e9; font-weight:bold;">${row.sum}</td><td style="color:#f59e0b; font-weight:bold;">${row.max}</td></tr>`;
        });
        html2 += `</tbody></table></div>`;
        resultEl.innerHTML = html2;

        // --- ВИВІД ТАБЛИЦІ П.3-4 (АЛЬТЕРНАТИВНІ МЕДІАНИ) ---
        let htmlMed = `<h3 style="color:#10b981; margin-top:0;">Знайдені Медіани Кемені (Оптимальні ранжування)</h3>`;
        htmlMed += `<p style="font-size:13px; color:var(--text-muted)">Всі перестановки нижче мають однакову мінімальну суму відстаней (К1 = ${minSumDist}).</p>`;
        
        htmlMed += `<div style="overflow-x:auto;"><table class="academic-table" style="width:100%;">
            <thead><tr>
                <th style="width:50px;">#</th>
                <th>Ранжування (Об'єкти)</th>
                <th style="color:#0ea5e9;">Сума (K1)</th>
                <th style="color:#ef4444;">Глобальний Макс (K2)</th>
            </tr></thead><tbody>`;

        absoluteMedians.forEach((med, idx) => {
            htmlMed += `<tr>
                <td>${idx+1}</td>
                <td style="text-align:left; font-size:13px;">${med.ranking.join(' → ')}</td>
                <td style="font-weight:bold; color:#0ea5e9;">${med.sum}</td>
                <td style="font-weight:bold; color:#ef4444;">${med.k2}</td>
            </tr>`;
        });
        htmlMed += `</tbody></table></div>`;
        
        // Порада для захисту
        if(absoluteMedians.length > 1) {
            htmlMed += `<p style="font-size:12px; background:rgba(16,185,129,0.1); padding:10px; border-radius:6px; border:1px solid #10b981;">
                💡 <b>Аналіз:</b> Знайдено ${absoluteMedians.length} рівноцінних медіан за критерієм суми. 
                Рекомендується обрати варіант №${absoluteMedians.indexOf(absoluteMedians.reduce((prev, curr) => prev.k2 < curr.k2 ? prev : curr)) + 1}, 
                оскільки він має найменший <b>Глобальний Максимум (K2)</b>, що забезпечує більшу "справедливість" для опонентів.
            </p>`;
        }

        mediansEl.innerHTML = htmlMed;

    } catch (error) { statusEl.innerHTML = `⚠ Помилка: ${error.message}`; }
}

async function lab3RunAnnealingDetailed(numStarts) {
    const box = document.getElementById('lab3-annealing-res');
    box.innerHTML = `⏳ Запуск Імітації Відпалу...`;
    const res = await fetch(`/api/lab3/annealing/${window.lab3Type}?all=true`);
    const data = await res.json();
    if(!data.success) { box.innerHTML = `<span style="color:var(--danger)">${data.error}</span>`; return; }

    let html = `<h3 style="color:#d946ef; font-size:15px; margin-bottom:14px;">Результати (ВСІ ОБ'ЄКТИ):</h3>`;
    html += `<div style="overflow-x:auto;"><table class="sa-table"><thead><tr><th style="width:4%">#</th><th style="width:48%"><span class="sa-k1-title">К1 — Мінімальна сума відстаней</span></th><th style="width:48%"><span class="sa-k2-title">К2 — Мінімальний максимум відстаней</span></th></tr></thead><tbody>`;

    const maxRows = Math.max(data.k1Solutions.length, data.k2Solutions.length);
    for(let i = 0; i < maxRows; i++) {
        const s1 = data.k1Solutions[i]; const s2 = data.k2Solutions[i];
        const renderRanking = (sol) => {
            if(!sol) return '—';
            return sol.ranking.map((name, pos) => `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="min-width:24px;font-size:13px;color:var(--text-muted)">${pos+1}.</span><span style="font-size:12px;flex:1;">${name}</span></div>`).join('');
        };
        const metaK1 = s1 ? `<div style="margin-top:8px; padding:6px 10px; background:rgba(59,130,246,0.1); border-radius:6px; font-size:11px;"><span class="sa-k1-title">Сума (К1): ${s1.k1}</span> &nbsp;|&nbsp; <span style="color:var(--text-muted)">Макс (К2): ${s1.k2}</span></div>` : '';
        const metaK2 = s2 ? `<div style="margin-top:8px; padding:6px 10px; background:rgba(236,72,153,0.1); border-radius:6px; font-size:11px;"><span class="sa-k2-title">Макс (К2): ${s2.k2}</span> &nbsp;|&nbsp; <span style="color:var(--text-muted)">Сума (К1): ${s2.k1}</span></div>` : '';
        html += `<tr><td><b style="color:white">${i+1}</b></td><td>${renderRanking(s1)}${metaK1}</td><td>${renderRanking(s2)}${metaK2}</td></tr>`;
    }
    html += `</tbody></table></div>`;
    box.innerHTML = html;
}