import { closeCreateTeamModal, attachCreateTeamFormListener } from './utils/helpers.js';

document.addEventListener('DOMContentLoaded', async () => {
    await loadComponents();
    initQuizSystem();
});

// --- BİLEŞEN YÜKLEYİCİ FONKSİYON ---
async function loadComponents() {
    const sidebarContainer = document.getElementById('sidebar-container');
    const modalsContainer = document.getElementById('modals-container');

    try {
        const sidebarRes = await fetch('../components/sidebar.html');
        sidebarContainer.innerHTML = await sidebarRes.text();

        const sidebarTitle = document.getElementById('sidebarTitle');
        if (sidebarTitle) sidebarTitle.textContent = 'Quiz 1 Menü';

        const modals = [
            'modal-create-team.html',
            'modal-select-players.html',
            'modal-show-teams.html',
            'modal-add-question.html',
            'modal-show-questions.html'
        ];

        let modalsHtml = '';
        for (const modal of modals) {
            const res = await fetch(`../components/${modal}`);
            modalsHtml += await res.text();
        }
        modalsContainer.innerHTML = modalsHtml;

        // Modal başlangıçta gizli olsun
        const createTeamModal = document.getElementById('createTeamModal');
        if (createTeamModal) createTeamModal.style.display = 'none';

        // Form submit listener'ını bağla
        attachCreateTeamFormListener();

    } catch (error) {
        console.error("Bileşenler yüklenirken hata oluştu!", error);
    }
}

// --- ANA QUİZ SİSTEMİ MANTIĞI ---
function initQuizSystem() {

    let currentRoomId = prompt("Lütfen yönetmek istediğiniz Odanın ID'sini giriniz:", "1") || "1";
    localStorage.setItem("currentRoomId", currentRoomId);

    let questionsArray = []; 
    let teamsArray = []; 
    const MAX_QUESTIONS = 20;
    
    let availablePlayersPool = ["Ali Yılmaz", "Ayşe Kaya", "Mehmet Demir", "Fatma Şahin", "Can Özkan", "Zeynep Çelik", "Burak Yılmaz", "Merve Yücel", "Kerem Aktürkoğlu", "Arda Güler"];
    let currentEditingTeamIndex = null; 

    const topQuestionCount = document.getElementById('topQuestionCount');

    function renderAdminLeaderboard() {
        const leaderboardList = document.getElementById('leaderboardList');
        if(!leaderboardList) return;
        leaderboardList.innerHTML = ''; 
        if (teamsArray.length === 0) {
            leaderboardList.innerHTML = '<li style="color:#888; text-align:center; padding: 20px; list-style:none;">Henüz takım eklenmedi.</li>';
            return;
        }
        const sortedTeams = [...teamsArray].sort((a, b) => (b.score || 0) - (a.score || 0));
        sortedTeams.forEach((team, index) => {
            const score = team.score || 0;
            leaderboardList.innerHTML += `
                <li class="leaderboard-item">
                    <div class="rank-team"><span class="rank">${index + 1}.</span><span class="team-name">Takım Adı: ${team.no}</span></div>
                    <span class="team-score">${score} P</span>
                </li>`;
        });
    }

    // --- GLOBAL TIKLAMA DİNLEYİCİSİ ---
    document.addEventListener('click', async (e) => {
        
        if (e.target.closest('#menuToggleBtn')) document.getElementById('sidebar').classList.add('active');
        if (e.target.closest('#closeSidebarBtn')) document.getElementById('sidebar').classList.remove('active');

        if (e.target.closest('#openCreateTeamBtn')) {
            e.preventDefault();
            document.getElementById('sidebar').classList.remove('active');
            const msgBox = document.getElementById('teamMsg');
            if (msgBox) msgBox.innerHTML = '';
            const modal = document.getElementById('createTeamModal');
            if (modal) {
                modal.style.display = 'flex';
                modal.classList.add('active');
            }
        }

        if (e.target.closest('#openShowTeamsBtn')) {
            e.preventDefault();
            window.location.href = 'takimlar.html';
        }

        // --- TAKIMLARI ODAYA EKLE ---
        if (e.target.closest('#addTeamsToRoomBtn')) {
            e.preventDefault();
            document.getElementById('sidebar').classList.remove('active');
            const link = e.target.closest('#addTeamsToRoomBtn');
            const originalText = link.textContent;
            link.textContent = 'Ekleniyor...';

            try {
                const BASE_URL = 'https://murdergame-backend-production.up.railway.app';
                const token = localStorage.getItem('accessToken');

                // Önce tüm takımları çek
                const teamsRes = await fetch(`${BASE_URL}/api/team/all`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!teamsRes.ok) throw new Error('Takımlar alınamadı');
                const allTeams = await teamsRes.json();
                const teamIds = allTeams.map(t => t.id);

                // Tüm takım ID'lerini odaya ekle
                const addRes = await fetch(`${BASE_URL}/api/game-room/${currentRoomId}/add-teams`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ teamIds })
                });

                if (!addRes.ok) throw new Error('Takımlar eklenemedi');

                alert(`${teamIds.length} takım odaya başarıyla eklendi!`);
            } catch (err) {
                alert(`Hata: ${err.message}`);
            } finally {
                link.textContent = originalText;
            }
        }

        if (e.target.closest('#openAddQuestionBtn')) {
            e.preventDefault();
            document.getElementById('sidebar').classList.remove('active');
            document.getElementById('addQuestionMsg').textContent = '';
            document.getElementById('addQuestionForm').reset();
            checkLimitAndDisableForm();
            document.getElementById('addQuestionModal').classList.add('active');
        }

        if (e.target.closest('#openShowQuestionsBtn')) {
            e.preventDefault();
            document.getElementById('sidebar').classList.remove('active');
            renderQuestions();
            document.getElementById('showQuestionsModal').classList.add('active');
        }

        // --- ODA DURUMUNU DEĞİŞTİRME ---
        if (e.target.classList.contains('status-btn')) {
            e.preventDefault();
            const btn = e.target;
            const originalText = btn.textContent;
            btn.textContent = 'Değiştiriliyor...';
            btn.disabled = true;

            try {
                const ROOM_ID = currentRoomId;
                const BASE_URL = 'https://murdergame-backend-production.up.railway.app';
                const token = localStorage.getItem('accessToken');
                
                const response = await fetch(`${BASE_URL}/api/game-room/${ROOM_ID}/state`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ state: "QUIZ1" })
                });

                if (!response.ok) {
                    throw new Error('Durum değiştirme başarısız!');
                }
                
                alert('Arka planda odanın durumu başarıyla QUIZ1 olarak güncellendi!');
            } catch (error) {
                alert(`Hata: ${error.message}`);
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }

        // --- YENİ EKLENEN: Modalları Kapatırken Pozisyonları Sıfırlama ---
        if (e.target.classList.contains('close-modal-btn')) {
            const targetId = e.target.getAttribute('data-target');
            if(targetId) {
                document.getElementById(targetId).classList.remove('active');
                
                if (targetId === 'selectPlayersModal') {
                    const teamsBox = document.querySelector('#showTeamsModal .modal-box');
                    if(teamsBox) {
                        teamsBox.style.transform = 'translateX(0)';
                        teamsBox.style.width = ''; // Genişliği normale döndür
                    }
                }
            }
        }

        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('active');
            if (e.target.id === 'selectPlayersModal') {
                const teamsBox = document.querySelector('#showTeamsModal .modal-box');
                if(teamsBox) {
                    teamsBox.style.transform = 'translateX(0)';
                    teamsBox.style.width = ''; // Genişliği normale döndür
                }
            }
        }

        // Arka plana tıklayarak kapatma
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('active');
            if (e.target.id === 'selectPlayersModal') {
                const teamsBox = document.querySelector('#showTeamsModal .modal-box');
                if(teamsBox) teamsBox.style.transform = 'translateX(0)';
            }
        }

        if (e.target.classList.contains('delete-question-btn')) {
            const index = e.target.getAttribute('data-index');
            const targetQuestion = questionsArray[index];
            if (confirm(`${parseInt(index) + 1}. Soruyu silmek istediğinize emin misiniz?`)) {
                
                const btn = e.target;
                const originalText = btn.textContent;
                btn.textContent = 'Siliniyor...';
                btn.disabled = true;

                try {
                    const token = localStorage.getItem('accessToken');
                    const BASE_URL = 'https://murdergame-backend-production.up.railway.app';
                    
                    const response = await fetch(`${BASE_URL}/api/quiz/questions/${targetQuestion.id}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (!response.ok) {
                        const errText = await response.text();
                        throw new Error(`Silme başarısız: ${errText}`);
                    }
                    
                    questionsArray.splice(index, 1); 
                    renderQuestions(); 
                    checkLimitAndDisableForm(); 
                } catch (error) {
                    alert(`Hata: ${error.message}`);
                } finally {
                    if (document.body.contains(btn)) {
                        btn.textContent = originalText;
                        btn.disabled = false;
                    }
                }
            }
        }

        if (e.target.classList.contains('delete-team-btn')) {
            const index = e.target.getAttribute('data-index');
            if (confirm(`Takım ${teamsArray[index].no}'i sistemden silmek istediğinize emin misiniz?`)) {
                teamsArray.splice(index, 1); 
                renderTeams(); 
                renderAdminLeaderboard(); 
            }
        }

        // --- YENİ EKLENEN: "Oyuncu Ekle" Butonuna Tıklanınca Sola Kaydırma Efekti ---
        if (e.target.classList.contains('add-player-btn')) {
            e.preventDefault();
            currentEditingTeamIndex = e.target.getAttribute('data-index');
            const targetTeam = teamsArray[currentEditingTeamIndex];
            
            document.getElementById('addingToTeamName').textContent = targetTeam.no;
            document.getElementById('selectPlayersMsg').textContent = '';
            document.getElementById('selectPlayersMsg').className = 'message-box';
            
            const listContainer = document.getElementById('availablePlayersList');
            listContainer.innerHTML = '';
            
            availablePlayersPool.forEach(player => {
                let assignedTeam = null;
                teamsArray.forEach(t => {
                    if (t.users.includes(player)) assignedTeam = t.no;
                });

                const isAlreadyInThisTeam = assignedTeam === targetTeam.no;
                const isAssignedToOtherTeam = assignedTeam !== null && assignedTeam !== targetTeam.no;
                
                let statusText = '';
                let disabledAttr = '';
                let labelColor = 'color: #ddd;';

                if (isAlreadyInThisTeam) {
                    statusText = '<span style="font-size:12px; float:right; color:#4CAF50;">(Bu Takımda)</span>';
                    disabledAttr = 'checked disabled';
                    labelColor = 'color: #666;';
                } else if (isAssignedToOtherTeam) {
                    statusText = `<span style="font-size:12px; float:right; color:#e74c3c;">(Takım ${assignedTeam}'de)</span>`;
                    disabledAttr = 'disabled';
                    labelColor = 'color: #666;';
                }

                listContainer.innerHTML += `
                    <li style="display: flex; align-items: center; gap: 10px; background: #1a1a1a; padding: 10px; border-radius: 6px; border: 1px solid #333;">
                        <input type="checkbox" id="player_${player.replace(/\s/g, '')}" value="${player}" class="player-checkbox" ${disabledAttr} style="width: 18px; height: 18px; cursor: pointer;">
                        <label for="player_${player.replace(/\s/g, '')}" style="cursor: pointer; font-size: 16px; ${labelColor} flex-grow: 1;">
                            ${player} ${statusText}
                        </label>
                    </li>
                `;
            });

            // Modalı aç
            document.getElementById('selectPlayersModal').classList.add('active');
            
            // "Takımları Gör" ekranını sola kaydır ki yan yana görünsünler!
            const teamsBox = document.querySelector('#showTeamsModal .modal-box');
            if(teamsBox) {
                teamsBox.style.transform = 'translateX(-35%)';
                teamsBox.style.transition = 'transform 0.3s ease';
            }
        }

        // --- Seçili Oyuncuları Kaydet İşlemi ---
        if (e.target.id === 'saveSelectedPlayersBtn') {
            const checkboxes = document.querySelectorAll('.player-checkbox:checked:not(:disabled)');
            const team = teamsArray[currentEditingTeamIndex];
            
            let addedCount = 0;
            checkboxes.forEach(cb => {
                team.users.push(cb.value);
                addedCount++;
            });

            const msgBox = document.getElementById('selectPlayersMsg');
            if (addedCount > 0) {
                msgBox.textContent = `${addedCount} oyuncu başarıyla eklendi!`;
                msgBox.className = 'message-box success';
                renderTeams(); 
                
                // Başarılı olunca paneli kapat ve Takımlar menüsünü geri ortaya al
                setTimeout(() => {
                    document.getElementById('selectPlayersModal').classList.remove('active');
                    const teamsBox = document.querySelector('#showTeamsModal .modal-box');
                    if(teamsBox) teamsBox.style.transform = 'translateX(0)';
                }, 1500);
            } else {
                msgBox.textContent = 'Lütfen eklenecek yeni oyuncuları seçin.';
                msgBox.className = 'message-box error';
            }
        }
    });

    // --- GLOBAL FORM DİNLEYİCİSİ ---
    document.addEventListener('submit', async (e) => {
        e.preventDefault();

        // --- GERÇEK BACKEND BAĞLANTISI İLE SORU EKLEME ---
        if (e.target.id === 'addQuestionForm') {
            if (checkLimitAndDisableForm()) return;
            const form = e.target;
            const msgBox = document.getElementById('addQuestionMsg');
            
            // Form verilerini alıyoruz
            const data = Object.fromEntries(new FormData(form).entries());
            
            msgBox.textContent = 'Veritabanına kaydediliyor...';
            msgBox.className = 'message-box';
            document.getElementById('submitQuestionBtn').disabled = true;

            try {
                const ROOM_ID = currentRoomId; 
                const token = localStorage.getItem('accessToken'); 
                const BASE_URL = 'https://murdergame-backend-production.up.railway.app';

                const payload = {
                    questionText: data.questionText,
                    optionA: data.optionA,
                    optionB: data.optionB,
                    optionC: data.optionC,
                    optionD: data.optionD,
                    correctAnswer: data.correctAnswer,
                    points: parseInt(data.questionPoints, 10) 
                };

                const response = await fetch(`${BASE_URL}/api/quiz/room/${ROOM_ID}/questions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`Durum kodu: ${response.status}. Detay: ${errText}`);
                }

                // İşlem Başarılıysa:
                msgBox.textContent = 'Soru başarıyla eklendi!';
                msgBox.classList.add('success');
                form.reset(); 
                
                await fetchQuestions(); 
                
            } catch (err) {
                console.error(err);
                msgBox.textContent = 'Hata oluştu: ' + err.message;
                msgBox.classList.add('error');
            } finally {
                // Hata olsa da olmasa da butonu tekrar aktif et
                document.getElementById('submitQuestionBtn').disabled = false;
            }
        }

    });


    function checkLimitAndDisableForm() {
        const form = document.getElementById('addQuestionForm');
        const submitBtn = document.getElementById('submitQuestionBtn');
        const msgBox = document.getElementById('addQuestionMsg');
        if(!form) return false;
        if (questionsArray.length >= MAX_QUESTIONS) {
            msgBox.textContent = `Maksimum limit doldu.`;
            msgBox.classList.add('error');
            Array.from(form.elements).forEach(el => el.disabled = true);
            submitBtn.style.backgroundColor = '#444';
            return true;
        } else {
            Array.from(form.elements).forEach(el => el.disabled = false);
            submitBtn.style.backgroundColor = '';
            return false;
        }
    }

    function renderQuestions() {
        const container = document.getElementById('questionsContainer');
        if(!container) return;
        container.innerHTML = '';
        if(topQuestionCount) topQuestionCount.textContent = `${questionsArray.length} / ${MAX_QUESTIONS}`;

        if (questionsArray.length === 0) {
            container.innerHTML = '<p style="color:#888; text-align:center; grid-column: span 2;">Henüz soru eklenmedi.</p>';
            return;
        }

        questionsArray.forEach((q, index) => {
            const isA = q.correct === 'A' ? 'correct' : '';
            const isB = q.correct === 'B' ? 'correct' : '';
            const isC = q.correct === 'C' ? 'correct' : '';
            const isD = q.correct === 'D' ? 'correct' : '';

            container.innerHTML += `
                <div class="question-card">
                    <div class="question-card-header">
                        <div class="header-info"><h3>Soru ${index + 1}</h3><span class="point-badge">${q.points} Puan</span></div>
                        <button class="delete-btn delete-question-btn" data-index="${index}">Sil</button>
                    </div>
                    <p class="question-text">${q.text}</p>
                    <ul class="options-list">
                        <li class="option-item ${isA}"><strong>A)</strong> ${q.A}</li>
                        <li class="option-item ${isB}"><strong>B)</strong> ${q.B}</li>
                        <li class="option-item ${isC}"><strong>C)</strong> ${q.C}</li>
                        <li class="option-item ${isD}"><strong>D)</strong> ${q.D}</li>
                    </ul>
                </div>
            `;
        });
    }

    function renderTeams() {
        const container = document.getElementById('teamsContainer');
        if(!container) return;
        container.innerHTML = '';
        
        if (teamsArray.length === 0) {
            container.innerHTML = '<p style="color:#888; text-align:center; grid-column: span 2; font-size: 16px; padding: 20px;">Henüz takım eklenmedi.</p>';
            return;
        }

        teamsArray.forEach((team, index) => {
            container.innerHTML += `
                <div class="team-card">
                    <div class="question-card-header">
                        <div class="header-info"><h3>Takım Adı: ${team.no}</h3></div>
                        <div style="display:flex; gap:10px;">
                            <button class="add-player-btn" style="background-color: #4CAF50; border: none; color: white; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; transition: 0.3s;" data-index="${index}">Oyuncu Ekle</button>
                            <button class="delete-btn delete-team-btn" data-index="${index}">Sil</button>
                        </div>
                    </div>
                    <ul class="team-info-list">
                        <li><strong>Toplam Oyuncu Sayısı:</strong> ${team.users.length}</li>
                        <li><strong>Takım Şifresi:</strong> ${team.password}</li>
                        <li><strong>Kayıtlı Oyuncular:</strong> ${team.users.join(', ') || 'Yok'}</li>
                    </ul>
                </div>
            `;
        });
    }

    async function fetchQuestions() {
        const ROOM_ID = currentRoomId;
        const BASE_URL = 'https://murdergame-backend-production.up.railway.app';
        const token = localStorage.getItem('accessToken');
        if(!token) return;

        try {
            const response = await fetch(`${BASE_URL}/api/quiz/room/${ROOM_ID}/questions`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error("Sorular çekilemedi");
            
            const data = await response.json();
            
            questionsArray = data.map(q => ({
                id: q.id,
                text: q.question,
                A: q.optionA,
                B: q.optionB,
                C: q.optionC,
                D: q.optionD,
                correct: q.correctAnswer || '', // JSON'da yoktu ama ihtimale karşı eklendi
                points: q.points
            }));
            
            renderQuestions();
        } catch(error) {
            console.error("Sorular yüklenemedi: ", error);
        }
    }


    // Takımlar modalı için — /api/team/all
    async function fetchTeams() {
        const BASE_URL = 'https://murdergame-backend-production.up.railway.app';
        const token = localStorage.getItem('accessToken');
        if(!token) return;

        try {
            const response = await fetch(`${BASE_URL}/api/team/all`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error("Takımlar çekilemedi");
            
            const data = await response.json();
            
            teamsArray = data.map(t => ({
                id: t.id,
                no: t.teamNo,
                active: t.active,
                score: t.score || t.points || 0,
                users: t.users || [],
                password: t.password || '-'
            }));
            
            renderTeams();
        } catch(error) {
            console.error("Takımlar yüklenemedi: ", error);
        }
    }

    // Leaderboard için — /api/leaderboard
    async function fetchLeaderboard() {
        const BASE_URL = 'https://murdergame-backend-production.up.railway.app';
        const token = localStorage.getItem('accessToken');
        if(!token) return;

        try {
            const response = await fetch(`${BASE_URL}/api/leaderboard`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error("Leaderboard çekilemedi");
            
            const data = await response.json();
            
            // Leaderboard verisini teamsArray formatına dönüştür
            teamsArray = (Array.isArray(data) ? data : []).map(t => ({
                id: t.id || t.teamId,
                no: t.teamNo || t.name || t.teamName || `Takım ${t.id}`,
                score: t.score || t.points || 0
            }));
            
            renderAdminLeaderboard();
        } catch(error) {
            console.error("Leaderboard yüklenemedi: ", error);
        }
    }

    fetchQuestions();
    fetchTeams();
    fetchLeaderboard();
}