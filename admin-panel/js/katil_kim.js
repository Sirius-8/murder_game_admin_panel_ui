import { closeCreateTeamModal, attachCreateTeamFormListener } from './utils/helpers.js';

document.addEventListener('DOMContentLoaded', async () => {
    await loadComponents();
    initKatilKimSystem();
});

// --- BİLEŞEN YÜKLEYİCİ FONKSİYON ---
async function loadComponents() {
    const sidebarContainer = document.getElementById('sidebar-container');
    const modalsContainer = document.getElementById('modals-container');

    try {
        // Menüyü (Sidebar) çekiyoruz
        const sidebarRes = await fetch('../components/sidebar.html');
        sidebarContainer.innerHTML = await sidebarRes.text();

        // Başlığı 'Katil Kim Menü' olarak güncelliyoruz
        const sidebarTitle = document.getElementById('sidebarTitle');
        if (sidebarTitle) sidebarTitle.textContent = 'Katil Kim Menü';

        // --- YENİ EKLENEN KISIM: Quiz'e özel linkleri gizle ---
        const quizLinks = document.querySelectorAll('.quiz-only-link');
        quizLinks.forEach(link => {
            link.style.display = 'none';
        });

        // İhtiyacımız olan modalları yüklüyoruz (Örn: Takım Oluştur)
        const modals = [
            'modal-create-team.html'
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

// --- KATİL KİM ANA SİSTEM MANTIĞI ---
function initKatilKimSystem() {

    let currentRoomId = prompt("Lütfen yönetmek istediğiniz Odanın ID'sini giriniz:", "1") || "1";
    localStorage.setItem("currentRoomId", currentRoomId);

    // Backend gelene kadar takımları tutacak boş dizi
    let teamsArray = []; 

    // --- YÖNETİM EKRANI LİDERLİK TABLOSU ---
    function renderAdminLeaderboard() {
        const leaderboardList = document.getElementById('leaderboardList');
        if(!leaderboardList) return;
        
        leaderboardList.innerHTML = ''; 

        // Eğer takım yoksa uyarı ver
        if (teamsArray.length === 0) {
            leaderboardList.innerHTML = '<li style="color:#888; text-align:center; padding: 20px; list-style:none;">Sistemde henüz kayıtlı takım bulunmuyor. Yönetim menüsünden takım ekleyebilirsiniz.</li>';
            return;
        }

        // Takımları puanlarına göre sırala (Hepsi 0 başlayacak)
        const sortedTeams = [...teamsArray].sort((a, b) => (b.score || 0) - (a.score || 0));

        sortedTeams.forEach((team, index) => {
            const score = team.score || 0;
            const li = document.createElement('li');
            li.className = 'leaderboard-item';
            li.innerHTML = `
                <div class="rank-team">
                    <span class="rank">${index + 1}.</span>
                    <span class="team-name">Takım Adı: ${team.no}</span>
                </div>
                <span class="team-score">${score} P</span>
            `;
            leaderboardList.appendChild(li);
        });
    }

    // --- GLOBAL TIKLAMA DİNLEYİCİSİ ---
    document.addEventListener('click', async (e) => {
        
        // Hamburger menü aç/kapat
        if (e.target.closest('#menuToggleBtn')) document.getElementById('sidebar').classList.add('active');
        if (e.target.closest('#closeSidebarBtn')) document.getElementById('sidebar').classList.remove('active');

        // Takım Oluşturma Modalı
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

        // Takımları Gör Butonuna Tıklanınca yeni sayfaya at
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

                // \u00d6nce t\u00fcm tak\u0131mlar\u0131 \u00e7ek
                const teamsRes = await fetch(`${BASE_URL}/api/team/all`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!teamsRes.ok) throw new Error('Tak\u0131mlar al\u0131namad\u0131');
                const allTeams = await teamsRes.json();
                const teamIds = allTeams.map(t => t.id);

                // T\u00fcm tak\u0131m ID'lerini odaya ekle
                const addRes = await fetch(`${BASE_URL}/api/game-room/${currentRoomId}/add-teams`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ teamIds })
                });

                if (!addRes.ok) throw new Error('Tak\u0131mlar eklenemedi');

                alert(`${teamIds.length} tak\u0131m odaya ba\u015far\u0131yla eklendi!`);
            } catch (err) {
                alert(`Hata: ${err.message}`);
            } finally {
                link.textContent = originalText;
            }
        }

        // --- OYUNU BAŞLAT BUTONUNA TIKLANINCA ---
        if (e.target.closest('#startGameBtn')) {
            e.preventDefault();
            const btn = e.target.closest('#startGameBtn');
            const originalText = btn.textContent;
            btn.textContent = 'Başlatılıyor...';
            btn.disabled = true;

            try {
                const ROOM_ID = currentRoomId;
                const BASE_URL = 'https://murdergame-backend-production.up.railway.app';
                const token = localStorage.getItem('accessToken');
                
                const response = await fetch(`${BASE_URL}/api/admin/clue-game/start/${ROOM_ID}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Oyunu başlatma işlemi sunucu tarafından reddedildi.');
                }
                
                // Başarılıysa oyun ekranına yönlendir
                window.location.href = 'katil_oyun_ekrani.html';
            } catch (error) {
                alert(`Hata: ${error.message}`);
                btn.textContent = originalText;
                btn.disabled = false;
            }
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
                    body: JSON.stringify({ state: "CLUEGAME" })
                });

                if (!response.ok) {
                    throw new Error('Durum değiştirme başarısız!');
                }
                
                alert('Arka planda odanın durumu başarıyla CLUEGAME olarak güncellendi!');
            } catch (error) {
                alert(`Hata: ${error.message}`);
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }

        // Modalları kapatma
        if (e.target.classList.contains('close-modal-btn')) {
            const targetId = e.target.getAttribute('data-target');
            if(targetId) document.getElementById(targetId).classList.remove('active');
        }
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('active');
        }
    });



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

    // Sayfa açılışında leaderboardı çek ve tabloyu çiz
    fetchLeaderboard();
}
