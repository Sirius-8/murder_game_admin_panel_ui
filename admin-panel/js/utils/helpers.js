// --- ORTAK YARDIMCI FONKSİYONLAR ---
// Bu dosya, tüm sayfalarda tekrar eden modal işlemlerini tek bir yerden yönetir.

const BASE_URL = 'https://murdergame-backend-production.up.railway.app';

// ----------------------------------------------------------------
// TAKIM OLUŞTURMA MODALI
// ----------------------------------------------------------------

/**
 * Takım oluşturma modalını kapatır ve formu/mesajları sıfırlar.
 */
export function closeCreateTeamModal() {
    const modal = document.getElementById('createTeamModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('createTeamForm')?.reset();
        const msgBox = document.getElementById('teamMsg');
        if (msgBox) msgBox.innerHTML = '';
    }
}

// HTML onclick="closeCreateTeamModal()" çağrısı için global'e aç
window.closeCreateTeamModal = closeCreateTeamModal;


/**
 * Takım oluşturma formuna submit listener'ı bağlar.
 * Çift bağlamayı önlemek için data-listenerAttached bayrağı kullanır.
 */
export function attachCreateTeamFormListener() {
    const form = document.getElementById('createTeamForm');
    if (!form || form.dataset.listenerAttached) return;
    form.dataset.listenerAttached = 'true';
    form.addEventListener('submit', handleTeamSubmit);
}

/**
 * Takım oluşturma formunun submit olayını backend'e göndererek işler.
 */
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

        setTimeout(() => closeCreateTeamModal(), 1500);

    } catch (error) {
        msgBox.innerHTML = `<span style="color:#e74c3c">✗ ${error.message}</span>`;
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Kaydet';
    }
}
