document.addEventListener('DOMContentLoaded', async () => {
    await loadComponents();
    initKatilOyunEkrani();
});

async function loadComponents() {
    const sidebarContainer = document.getElementById('sidebar-container');
    try {
        const sidebarRes = await fetch('../components/sidebar.html');
        sidebarContainer.innerHTML = await sidebarRes.text();

        const sidebarTitle = document.getElementById('sidebarTitle');
        if (sidebarTitle) sidebarTitle.textContent = 'Katil Kim Oyun Ekranı';

        // Katil Kim ekranına özel quiz linklerini gizle
        const quizLinks = document.querySelectorAll('.quiz-only-link');
        quizLinks.forEach(link => {
            link.style.display = 'none';
        });

    } catch (error) {
        console.error("Bileşenler yüklenirken hata oluştu!", error);
    }
}

function initKatilOyunEkrani() {
    let teamsArray = [];
    const BASE_URL = 'https://murdergame-backend-production.up.railway.app';
    const token = localStorage.getItem('accessToken');

    // --- Zamanlayıcı (Timer) Ayarları ---
    let totalSeconds = 10 * 60; // 10 Dakika
    let timerInterval = null;

    function updateTimerDisplay() {
        const timerDisplay = document.getElementById('gameTimer');
        if(!timerDisplay) return;
        let m = Math.floor(totalSeconds / 60);
        let s = totalSeconds % 60;
        m = m < 10 ? '0' + m : m;
        s = s < 10 ? '0' + s : s;
        timerDisplay.textContent = `${m}:${s}`;
    }

    function startTimer() {
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (totalSeconds <= 0) {
                clearInterval(timerInterval);
                return;
            }
            totalSeconds--;
            updateTimerDisplay();
        }, 1000);
    }

    // Takımları çek
    async function fetchTeams() {
        if (!token) return;
        try {
        const roomId = localStorage.getItem('currentRoomId') || '1';
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
                // Şimdilik mock tahmin ekleyelim test amaçlı (Backend hazır olana kadar)
                guess: t.id % 2 === 0 ? "Bence katil Ahmet! O saatte bahçedeydi ve şüpheli görünüyordu." : null 
            }));
            
            renderTeamsGrid();
        } catch (error) {
            console.error("Takımlar yüklenemedi: ", error);
            const grid = document.getElementById('teamsGrid');
            grid.innerHTML = `<p style="color:#ff5555; padding: 20px;">Bağlantı Hatası: ${error.message}</p>`;
        }
    }

    function renderTeamsGrid() {
        const grid = document.getElementById('teamsGrid');
        grid.innerHTML = '';

        if (teamsArray.length === 0) {
            grid.innerHTML = '<p style="color:#888; padding: 20px;">Sistemde kayıtlı takım bulunmuyor.</p>';
            return;
        }

        teamsArray.forEach((team, index) => {
            // Eğer tahmini varsa butonu yeşil yapmak için CSS class ekleyelim
            const btnClass = team.guess ? 'view-guess-btn has-guess' : 'view-guess-btn';
            const btnText = team.guess ? 'Tahmini Gör' : 'Tahmin Bekleniyor';
            const disabledAttr = team.guess ? '' : 'disabled';

            grid.innerHTML += `
                <div class="team-card">
                    <h3>${team.no}</h3>
                    <button class="${btnClass}" data-index="${index}" ${disabledAttr}>${btnText}</button>
                </div>
            `;
        });
    }

    // Modal aç/kapat ve Değerlendirme işlemleri
    document.addEventListener('click', (e) => {
        
        // --- SÜRE EKLEME BUTONU ---
        if (e.target.id === 'addTimeBtn') {
            const wasZero = totalSeconds <= 0;
            totalSeconds += 10 * 60;
            updateTimerDisplay();
            
            // Eğer süre tamamen bitip sıfırlanmışsa, 10 dk eklenince tekrar başlat
            if (wasZero) {
                startTimer();
            }
        }
        // Tahmini Gör Butonu
        if (e.target.classList.contains('view-guess-btn') && !e.target.disabled) {
            const index = e.target.getAttribute('data-index');
            const team = teamsArray[index];
            
            document.getElementById('modalTeamName').textContent = `${team.no} Takımının Tahmini`;
            
            const guessContent = document.getElementById('modalGuessContent');
            const evalPanel = document.querySelector('.evaluation-panel');
            
            if (team.guess) {
                guessContent.textContent = team.guess;
                guessContent.style.fontStyle = 'normal';
                guessContent.style.color = '#fff';
                evalPanel.style.display = 'block'; // Değerlendirme panelini göster
            } else {
                guessContent.textContent = "Bu takım henüz bir tahmin göndermedi.";
                guessContent.style.fontStyle = 'italic';
                guessContent.style.color = '#888';
                evalPanel.style.display = 'none'; // Değerlendirme panelini gizle
            }

            // Mesaj kutusunu sıfırla
            const msgBox = document.getElementById('evalMsg');
            msgBox.style.display = 'none';
            msgBox.textContent = '';

            document.getElementById('guessModal').classList.add('active');
        }

        // Değerlendirme Butonları (Doğru, Kısmen, Yanlış)
        if (e.target.classList.contains('eval-btn')) {
            const points = e.target.getAttribute('data-points');
            const teamName = document.getElementById('modalTeamName').textContent.replace(' Takımının Tahmini', '');
            
            // Backend olmadığı için şimdilik sadece görsel mesaj gösterelim
            const msgBox = document.getElementById('evalMsg');
            msgBox.style.display = 'block';
            
            if (points === "100") {
                msgBox.style.color = "#4CAF50";
                msgBox.textContent = `${teamName} takımına 100 Puan verildi! (Veritabanına kaydedildi)`;
            } else if (points === "50") {
                msgBox.style.color = "#FF9800";
                msgBox.textContent = `${teamName} takımına 50 Puan verildi! (Veritabanına kaydedildi)`;
            } else {
                msgBox.style.color = "#f44336";
                msgBox.textContent = `${teamName} takımı yanlış tahmin yaptı. 0 Puan!`;
            }

            // Backend bağlantısı yapıldığında burada fetch ile POST/PUT isteği atılacak.
            
            // İşlem tamamlandıktan 2 saniye sonra modalı kapat
            setTimeout(() => {
                document.getElementById('guessModal').classList.remove('active');
            }, 2000);
        }

        // Modal kapat
        if (e.target.id === 'closeGuessModal' || e.target.classList.contains('modal-overlay')) {
            document.getElementById('guessModal').classList.remove('active');
        }

        // Sidebar kapat
        if (e.target.closest('#menuToggleBtn')) document.getElementById('sidebar').classList.add('active');
        if (e.target.closest('#closeSidebarBtn')) document.getElementById('sidebar').classList.remove('active');
    });

    // İlk açılışta verileri çek ve sayacı başlat
    fetchTeams();
    updateTimerDisplay();
    startTimer();
}

