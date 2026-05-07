document.addEventListener('DOMContentLoaded', async () => {
    // 1. Componentleri (Parçaları) Yükle
    await loadComponents();

    // 2. Componentler yüklendikten sonra anasayfa sistemini başlat
    initHomeSystem();
});

// --- BİLEŞEN YÜKLEYİCİ FONKSİYON ---
async function loadComponents() {
    // index.html / home.html içerisinde bu ID'lere sahip boş div'ler olmalı
    const sidebarContainer = document.getElementById('sidebar-container');
    const modalsContainer = document.getElementById('modals-container');

    try {
        // 1. Sidebar'ı Yükle
        const sidebarRes = await fetch('../components/sidebar.html');
        sidebarContainer.innerHTML = await sidebarRes.text();

        const sidebarTitle = document.getElementById('sidebarTitle');
        if (sidebarTitle) sidebarTitle.textContent = 'Ana Menü';

        // Anasayfada oda yönetimi linklerini gizle
        const quizLinks = document.querySelectorAll('.quiz-only-link');
        quizLinks.forEach(link => link.style.display = 'none');
        
        const addTeamsBtnLi = document.getElementById('addTeamsToRoomBtn')?.parentElement;
        if (addTeamsBtnLi) addTeamsBtnLi.style.display = 'none';

        // 2. Sadece Ana Sayfada İhtiyacımız Olan Modalları Yükle
        // (Takımları gör vb. diğer sayfalara yönlendirdiği için modalı yüklemeye gerek yok)
        const modals = ['modal-create-team.html'];
        
        let modalsHtml = '';
        for (const modal of modals) {
            const res = await fetch(`../components/${modal}`);
            modalsHtml += await res.text();
        }
        modalsContainer.innerHTML = modalsHtml;

        // Modalı başlangıçta gizle
        const createTeamModal = document.getElementById('createTeamModal');
        if (createTeamModal) createTeamModal.style.display = 'none';

        // Modal yüklendikten sonra Form dinleyicisini bağla
        attachCreateTeamFormListener();

    } catch (error) {
        console.error("Bileşenler yüklenirken hata oluştu!", error);
        alert("SİSTEM HATASI: Bileşenler yüklenemedi. Live Server kullandığınızdan emin olun.");
    }
}

// --- ANA SAYFA SİSTEMİ MANTIĞI (TIKLAMALAR VE YÖNLENDİRMELER) ---
function initHomeSystem() {

    // --- GLOBAL TIKLAMA DİNLEYİCİSİ (EVENT DELEGATION) ---
    document.addEventListener('click', (e) => {
        
        const sidebar = document.getElementById('sidebar');

        // 1. Sidebar (Hamburger Menü) Aç / Kapat
        if (e.target.closest('#menuToggleBtn')) {
            if(sidebar) sidebar.classList.add('active');
        }
        if (e.target.closest('#closeSidebarBtn')) {
            if(sidebar) sidebar.classList.remove('active');
        }

        // 2. Takım Oluştur Butonuna Tıklanırsa (Modal Açar)
        if (e.target.closest('#openCreateTeamBtn')) {
            e.preventDefault();
            if(sidebar) sidebar.classList.remove('active'); // Menüyü kapat

            // Varsa eski mesajları temizle
            const msgBox = document.getElementById('teamMsg');
            if (msgBox) msgBox.innerHTML = '';
            
            // Modalı görünür yap
            const modal = document.getElementById('createTeamModal');
            if (modal) {
                modal.style.display = 'flex';
                modal.classList.add('active');
            }
        }

        // 3. Takımları Gör Butonuna Tıklanırsa (Sayfaya Yönlendirir)
        if (e.target.closest('#openShowTeamsBtn')) {
            e.preventDefault();
            // Takımları listelediğin asıl sayfaya yönlendiriyoruz
            window.location.href = 'takimlar.html'; 
        }

        // 4. Modalın Dışındaki Siyah Kısma Tıklanınca Modalı Kapatma
        if (e.target.classList.contains('modal-overlay')) {
            e.target.style.display = 'none';
            e.target.classList.remove('active');
        }
    });
}

// --- TAKIM OLUŞTURMA MODALI VE BACKEND BAĞLANTISI ---
const BASE_URL = 'https://murdergame-backend-production.up.railway.app';

// Modal içindeki İptal/Çarpı butonuna basınca (HTML'deki onclick ile tetiklenir)
window.closeCreateTeamModal = function() {
    const modal = document.getElementById('createTeamModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
        document.getElementById('createTeamForm')?.reset();
        const msgBox = document.getElementById('teamMsg');
        if (msgBox) msgBox.innerHTML = '';
    }
};

// Form dinleyicisini modal yüklendikten sonra bağlar
function attachCreateTeamFormListener() {
    const form = document.getElementById('createTeamForm');
    if (!form || form.dataset.listenerAttached) return;
    
    form.dataset.listenerAttached = 'true';
    form.addEventListener('submit', handleTeamSubmit);
}

// Form verilerini alıp API'ye POST eden fonksiyon
async function handleTeamSubmit(e) {
    e.preventDefault();

    const teamNo = document.getElementById('teamNo').value.trim();
    const teamPassword = document.getElementById('teamPassword').value.trim();
    const msgBox = document.getElementById('teamMsg');
    const saveBtn = document.getElementById('saveTeamBtn');

    const token = localStorage.getItem('accessToken');

    if (!token) {
        msgBox.innerHTML = '<span style="color:#e74c3c">Yetkisiz işlem! Lütfen tekrar giriş yapın.</span>';
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Kaydediliyor...';
    msgBox.innerHTML = '';

    try {
        const response = await fetch(`${BASE_URL}/api/team/admin/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ teamNo, teamPassword })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Bu takım zaten mevcut veya bir hata oluştu!');
        }

        msgBox.innerHTML = `<span style="color:#2ecc71">✓ Başarılı! "${data.teamNo || teamNo}" veritabanına eklendi.</span>`;
        document.getElementById('createTeamForm').reset();

        // İşlem başarılı olunca 1.5 saniye sonra modalı kapat
        setTimeout(() => window.closeCreateTeamModal(), 1500);

    } catch (error) {
        msgBox.innerHTML = `<span style="color:#e74c3c">✗ ${error.message}</span>`;
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Kaydet';
    }
}