async function loadItems() {
    const res = await fetch(`/api/items/${window.currentMode}`); const items = await res.json();
    ['vote-1', 'vote-2', 'vote-3'].forEach(id => {
        document.getElementById(id).innerHTML = '<option value="">-- Оберіть --</option>' + items.map(i => `<option value="${i.id}">${i.title}</option>`).join('');
    });
    document.getElementById('user-info').innerText = `Експерт: ${window.currentUser.username}`;
}

async function submitVote() {
    const v = [document.getElementById('vote-1').value, document.getElementById('vote-2').value, document.getElementById('vote-3').value];
    if(!v[0] || !v[1] || !v[2] || new Set(v).size !== 3) return alert('Оберіть 3 РІЗНІ позиції!');
    const res = await fetch('/api/vote', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({userId: window.currentUser.id, type: window.currentMode, votes: [{itemId:v[0], priority:1},{itemId:v[1], priority:2},{itemId:v[2], priority:3}]}) });
    if((await res.json()).success) tab('podium-section'); else alert('Ви вже голосували!');
}

async function loadResults() {
    const res = await fetch(`/api/results/${window.currentMode}`); const d = await res.json();
    document.getElementById('full-ranking').innerHTML = d.map((g, i) => `<tr><td>#${i+1}</td><td><b>${g.title}</b></td><td class="text-right">${g.score}</td></tr>`).join('');
}