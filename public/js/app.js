window.currentUser = null; 
window.isLoginMode = true;
window.currentMode = 'game'; 
window.currentAdminType = 'game';
window.lab3Type = 'game';

window.onload = () => {
    const saved = localStorage.getItem('expertUserSession');
    if (saved) { window.currentUser = JSON.parse(saved); showHome(); }
};

function showHome() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('main-nav').classList.add('hidden');
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.getElementById('home-section').classList.remove('hidden');
    if (window.currentUser.role === 'admin') {
        document.getElementById('admin-card').classList.remove('hidden');
        document.getElementById('lab4-card').classList.remove('hidden');
    }
}

function setMode(mode) {
    if(mode === 'admin') {
        document.getElementById('main-nav').classList.remove('hidden');
        document.getElementById('nav-admin').classList.remove('hidden');
        document.getElementById('nav-lab4').classList.remove('hidden');
        tab('results-section'); return;
    }
    if(mode === 'lab3') {
        document.getElementById('main-nav').classList.remove('hidden');
        if (window.currentUser.role === 'admin') {
            document.getElementById('nav-admin').classList.remove('hidden');
            document.getElementById('nav-lab4').classList.remove('hidden');
        }
        tab('lab3-section'); return;
    }
    if(mode === 'lab4') {
        document.getElementById('main-nav').classList.remove('hidden');
        document.getElementById('nav-admin').classList.remove('hidden');
        document.getElementById('nav-lab4').classList.remove('hidden');
        tab('lab4-section'); return;
    }
    window.currentMode = mode;
    document.getElementById('vote-title').innerText = mode === 'game' ? "ЛР1: Оцінка Ігор" : "ЛР2: Вибір Евристик";
    document.getElementById('podium-title').innerText = mode === 'game' ? "Результати ЛР1" : "Результати ЛР2";
    document.getElementById('score-header').innerText = mode === 'game' ? "Сума балів" : "К-сть голосів";
    
    if (mode === 'heuristic') {
        document.getElementById('label-1').innerText = "📌 Вибір 1"; document.getElementById('label-2').innerText = "📌 Вибір 2"; document.getElementById('label-3').innerText = "📌 Вибір 3";
    } else {
        document.getElementById('label-1').innerText = "🥇 1 Місце (3 бали)"; document.getElementById('label-2').innerText = "🥈 2 Місце (2 бали)"; document.getElementById('label-3').innerText = "🥉 3 Місце (1 бал)";
    }
    
    document.getElementById('main-nav').classList.remove('hidden');
    if (window.currentUser.role === 'admin') {
        document.getElementById('nav-admin').classList.remove('hidden');
        document.getElementById('nav-lab4').classList.remove('hidden');
    }
    tab('vote-section');
}

function tab(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if(id === 'podium-section' && typeof loadResults === 'function') loadResults();
    if(id === 'results-section' && typeof loadAdminData === 'function') loadAdminData('game');
    if(id === 'vote-section' && typeof loadItems === 'function') loadItems();
}

function toggleAuthMode() {
    window.isLoginMode = !window.isLoginMode;
    document.querySelector('#auth-section h1').innerText = window.isLoginMode ? 'Вхід у систему' : 'Реєстрація';
    document.getElementById('pib-container').classList.toggle('hidden', window.isLoginMode);
}

async function handleAuth() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const pib = document.getElementById('pib').value.trim();
    if(!username || !password) return alert('Заповніть поля');
    const res = await fetch(window.isLoginMode ? '/api/login' : '/api/register', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username, password, pib}) });
    const data = await res.json();
    if(data.success) {
        if(!window.isLoginMode) { alert('Успішно! Увійдіть.'); toggleAuthMode(); return; }
        window.currentUser = data.user; localStorage.setItem('expertUserSession', JSON.stringify(window.currentUser)); showHome();
    } else alert(data.error);
}

function logout() { localStorage.removeItem('expertUserSession'); location.reload(); }