document.addEventListener('DOMContentLoaded', () => {

    // --- GERÇEK VERİ HAVUZLARI ---
    let teamsArray = []; 
    let availablePlayersPool = []; 

    let currentEditingTeamIndex = null;

    const BASE_URL = 'https://murdergame-backend-production.up.railway.app';

    async function fetchTeams() {
        const container = document.getElementById('teamsGrid');
        container.innerHTML = '<p style="color:#888; font-size:16px; padding:20px;">Takımlar yükleniyor...</p>';
        
        const token = localStorage.getItem('accessToken');
        if (!token) {
            container.innerHTML = '<p style="color:#ff5555; font-size:16px; padding:20px;">Yetkisiz işlem! Lütfen giriş yapın.</p>';
            return;
        }

        try {
            const response = await fetch(`${BASE_URL}/api/team/all`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) throw new Error("Veriler sunucudan çekilemedi.");
            
            const data = await response.json();
            
            teamsArray = data.map(t => ({
                id: t.id,
                no: t.teamNo,
                active: t.active,
                users: [] 
            }));
            
            // Eğer oyuncular daha önce yüklendiyse takımlara dağıt
            if (availablePlayersPool.length > 0) {
                teamsArray.forEach(team => {
                    team.users = availablePlayersPool.filter(p => p.teamId === team.id).map(p => p.username);
                });
            }
            
            renderTeams();
        } catch (error) {
            container.innerHTML = `<p style="color:#ff5555; font-size:16px; padding:20px;">Bağlantı hatası: ${error.message}</p>`;
        }
    }

    async function fetchPlayers() {
        const token = localStorage.getItem('accessToken');
        if (!token) return;

        try {
            const response = await fetch(`${BASE_URL}/api/auth/users`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) throw new Error("Oyuncular çekilemedi.");
            
            availablePlayersPool = await response.json();
            
            // Oyuncular gelince takımların 'users' dizilerini güncelle ve ekranı yenile
            if (teamsArray.length > 0) {
                teamsArray.forEach(team => {
                    team.users = availablePlayersPool.filter(p => p.teamId === team.id).map(p => p.username);
                });
                renderTeams();
            }
        } catch (error) {
            console.error("Oyuncular yüklenemedi:", error);
        }
    }

    // --- EKRANA TAKIMLARI BASTIRMA ---
    function renderTeams() {
        const container = document.getElementById('teamsGrid');
        container.innerHTML = '';

        // Takım yoksa gösterilecek boş durum tasarımı
        if(teamsArray.length === 0) {
            container.innerHTML = '<p style="color:#888; font-size:16px; padding:20px;">Sistemde henüz kayıtlı takım bulunmuyor. Yönetim paneli üzerinden yeni takımlar ekleyebilirsiniz.</p>';
            return;
        }

        teamsArray.forEach((team, index) => {
            const statusColor = team.active ? '#4CAF50' : '#e74c3c';
            const statusText = team.active ? 'Aktif' : 'Pasif';

            container.innerHTML += `
                <div class="team-card">
                    <div class="team-header">
                        <h3>Takım Adı: ${team.no}</h3>
                        <button class="delete-btn" data-index="${index}">Sil</button>
                    </div>
                    <ul class="team-details">
                        <li><strong>Takım ID:</strong> ${team.id}</li>
                        <li><strong>Durum:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></li>
                        <li><strong>Oyuncu Sayısı:</strong> ${team.users.length}</li>
                        <li><strong>Oyuncular:</strong> ${team.users.join(', ') || 'Yok'}</li>
                    </ul>
                    <div class="card-actions">
                        <button class="add-player-btn" data-index="${index}">+ Oyuncu Ekle</button>
                        <button class="remove-player-btn" data-index="${index}">- Oyuncu Sil</button>
                        <button class="spokesperson-btn" data-index="${index}">Sözcü Ekle</button>
                    </div>
                </div>
            `;
        });
    }

    // --- TIKLAMA OLAYLARI (Event Delegation) ---
    document.addEventListener('click', async (e) => {
        
        // 1. Oyuncu Ekle Butonuna Tıklandığında
        if (e.target.classList.contains('add-player-btn')) {
            currentEditingTeamIndex = e.target.getAttribute('data-index');
            const targetTeam = teamsArray[currentEditingTeamIndex];
            
            // Paneli göster
            document.getElementById('playerRemovePanel').classList.add('hidden');
            document.getElementById('spokespersonPanel').classList.add('hidden');
            document.getElementById('playerSelectionPanel').classList.remove('hidden');
            document.getElementById('selectedTeamName').textContent = targetTeam.no;
            document.getElementById('actionMessage').className = 'message-box'; 
            
            // Oyuncu Listesini Doldur
            const listContainer = document.getElementById('playersList');
            listContainer.innerHTML = '';

            // Eğer hiç kayıtlı oyuncu yoksa bilgi mesajı göster
            if (availablePlayersPool.length === 0) {
                listContainer.innerHTML = '<li style="color:#888; padding:10px;">Sistemde henüz kayıtlı oyuncu bulunmuyor.</li>';
            } else {
                availablePlayersPool.forEach(player => {
                    const isAlreadyInThisTeam = player.teamId === targetTeam.id;
                    const isAssignedToOtherTeam = player.teamId !== null && player.teamId !== targetTeam.id;
                    
                    let statusText = '';
                    let disabledAttr = '';
                    let labelColor = 'color: #ddd;';

                    if (isAlreadyInThisTeam) {
                        statusText = '<span style="font-size:12px; float:right; color:#4CAF50;">(Bu Takımda)</span>';
                        disabledAttr = 'checked disabled';
                        labelColor = 'color: #666;';
                    } else if (isAssignedToOtherTeam) {
                        statusText = `<span style="font-size:12px; float:right; color:#e74c3c;">(Başka Takımda)</span>`;
                        disabledAttr = 'disabled';
                        labelColor = 'color: #666;';
                    }

                    listContainer.innerHTML += `
                        <li class="player-item">
                            <input type="checkbox" id="p_${player.userId}" value="${player.userId}" class="player-checkbox" ${disabledAttr} style="width: 18px; height: 18px;">
                            <label for="p_${player.userId}" style="${labelColor}">
                                ${player.username} ${statusText}
                            </label>
                        </li>
                    `;
                });
            }
        }

        // 2. Paneli Kapat Butonuna Tıklandığında
        if (e.target.id === 'closePanelBtn') {
            document.getElementById('playerSelectionPanel').classList.add('hidden');
        }

        // 3. Takım Sil Butonuna Tıklandığında
        if (e.target.classList.contains('delete-btn')) {
            const index = e.target.getAttribute('data-index');
            const targetTeam = teamsArray[index];
            if (confirm(`Takım ${targetTeam.no}'i silmek istediğinize emin misiniz?`)) {
                
                const btn = e.target;
                const originalText = btn.textContent;
                btn.textContent = 'Siliniyor...';
                btn.disabled = true;

                try {
                    const token = localStorage.getItem('accessToken');
                    const response = await fetch(`${BASE_URL}/api/team/admin/${targetTeam.id}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (!response.ok) {
                        throw new Error('Sunucuda silme işlemi başarısız oldu.');
                    }

                    // Başarılı ise yerel diziden sil ve arayüzü güncelle
                    teamsArray.splice(index, 1);
                    document.getElementById('playerSelectionPanel').classList.add('hidden'); 
                    renderTeams();
                } catch (error) {
                    alert(`Hata: ${error.message}`);
                    btn.textContent = originalText;
                    btn.disabled = false;
                }
            }
        }

        // 4. Seçili Oyuncuları Ekle Butonuna Tıklandığında
        if (e.target.id === 'savePlayersBtn') {
            const checkboxes = document.querySelectorAll('.player-checkbox:checked:not(:disabled)');
            if (currentEditingTeamIndex === null || !teamsArray[currentEditingTeamIndex]) return;

            const team = teamsArray[currentEditingTeamIndex];
            const msgBox = document.getElementById('actionMessage');
            
            if (checkboxes.length === 0) {
                msgBox.textContent = 'Yeni oyuncu seçilmedi.';
                msgBox.className = 'message-box error';
                msgBox.style.display = 'block';
                return;
            }

            const btn = e.target;
            const originalText = btn.textContent;
            btn.textContent = 'Ekleniyor...';
            btn.disabled = true;

            try {
                const token = localStorage.getItem('accessToken');
                
                // Seçilen her oyuncu için sırayla POST isteği at
                for (let cb of checkboxes) {
                    const userId = parseInt(cb.value);
                    const response = await fetch(`${BASE_URL}/api/team/admin/add-user/${team.id}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ userId: userId })
                    });
                    
                    if (!response.ok) {
                        console.error(`ID: ${userId} olan kullanıcı eklenemedi.`);
                    }
                }
                
                msgBox.textContent = `${checkboxes.length} oyuncu başarıyla eklendi!`;
                msgBox.className = 'message-box success';
                msgBox.style.display = 'block';
                
                // Verileri güncelle
                await fetchPlayers();
                
            } catch(err) {
                msgBox.textContent = `Hata: ${err.message}`;
                msgBox.className = 'message-box error';
                msgBox.style.display = 'block';
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }

        // --- OYUNCU SİLME MANTIĞI ---

        // 5. Oyuncu Sil Butonuna Tıklandığında (Takım Kartı Üzerindeki)
        if (e.target.classList.contains('remove-player-btn')) {
            currentEditingTeamIndex = e.target.getAttribute('data-index');
            const targetTeam = teamsArray[currentEditingTeamIndex];
            
            // Ekle panelini gizle, Sil panelini göster
            document.getElementById('playerSelectionPanel').classList.add('hidden');
            document.getElementById('spokespersonPanel').classList.add('hidden');
            document.getElementById('playerRemovePanel').classList.remove('hidden');
            document.getElementById('selectedTeamNameRemove').textContent = targetTeam.no;
            
            const msgBox = document.getElementById('actionMessageRemove');
            if(msgBox) msgBox.style.display = 'none';
            
            // Sadece bu takımdaki oyuncuları listele
            const listContainer = document.getElementById('playersRemoveList');
            listContainer.innerHTML = '';

            const teamPlayers = availablePlayersPool.filter(p => p.teamId === targetTeam.id);

            if (teamPlayers.length === 0) {
                listContainer.innerHTML = '<li style="color:#888; padding:10px;">Bu takımda henüz oyuncu bulunmuyor.</li>';
            } else {
                teamPlayers.forEach(player => {
                    listContainer.innerHTML += `
                        <li class="player-item">
                            <input type="checkbox" id="r_${player.userId}" value="${player.userId}" class="player-remove-checkbox" style="width: 18px; height: 18px;">
                            <label for="r_${player.userId}">
                                ${player.username}
                            </label>
                        </li>
                    `;
                });
            }
        }

        // 6. Paneli Kapat Butonuna Tıklandığında (Silme Paneli)
        if (e.target.id === 'closeRemovePanelBtn') {
            document.getElementById('playerRemovePanel').classList.add('hidden');
        }

        // 7. Seçili Oyuncuları Çıkar Butonuna Tıklandığında
        if (e.target.id === 'removePlayersBtn') {
            const checkboxes = document.querySelectorAll('.player-remove-checkbox:checked');
            if (currentEditingTeamIndex === null || !teamsArray[currentEditingTeamIndex]) return;

            const team = teamsArray[currentEditingTeamIndex];
            const msgBox = document.getElementById('actionMessageRemove');
            
            if (checkboxes.length === 0) {
                msgBox.textContent = 'Çıkarılacak oyuncu seçilmedi.';
                msgBox.className = 'message-box error';
                msgBox.style.display = 'block';
                return;
            }

            const btn = e.target;
            const originalText = btn.textContent;
            btn.textContent = 'Çıkarılıyor...';
            btn.disabled = true;

            try {
                const token = localStorage.getItem('accessToken');
                
                // Seçilen her oyuncu için sırayla POST isteği at
                for (let cb of checkboxes) {
                    const userId = parseInt(cb.value);
                    const response = await fetch(`${BASE_URL}/api/team/admin/remove-user/${userId}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    if (!response.ok) {
                        console.error(`ID: ${userId} olan kullanıcı takımdan çıkarılamadı.`);
                    }
                }
                
                msgBox.textContent = `${checkboxes.length} oyuncu başarıyla takımdan çıkarıldı!`;
                msgBox.className = 'message-box success';
                msgBox.style.display = 'block';
                
                // Verileri güncelle
                await fetchPlayers();
                
                // Eğer hala açıksa listeyi güncellemek için paneli yenile veya manuel gizle
                // setTimeout(() => { document.getElementById('playerRemovePanel').classList.add('hidden'); }, 2000);
                
            } catch(err) {
                msgBox.textContent = `Hata: ${err.message}`;
                msgBox.className = 'message-box error';
                msgBox.style.display = 'block';
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }

        // --- SÖZCÜ EKLEME MANTIĞI ---

        // 8. Sözcü Ekle Butonuna Tıklandığında (Takım Kartı Üzerindeki)
        if (e.target.classList.contains('spokesperson-btn')) {
            currentEditingTeamIndex = e.target.getAttribute('data-index');
            const targetTeam = teamsArray[currentEditingTeamIndex];
            
            // Diğer panelleri gizle, Sözcü panelini göster
            document.getElementById('playerSelectionPanel').classList.add('hidden');
            document.getElementById('playerRemovePanel').classList.add('hidden');
            document.getElementById('spokespersonPanel').classList.remove('hidden');
            document.getElementById('selectedTeamNameSpokesperson').textContent = targetTeam.no;
            
            const msgBox = document.getElementById('actionMessageSpokesperson');
            if(msgBox) msgBox.style.display = 'none';
            
            // Sadece bu takımdaki oyuncuları listele
            const listContainer = document.getElementById('spokespersonList');
            listContainer.innerHTML = '';

            const teamPlayers = availablePlayersPool.filter(p => p.teamId === targetTeam.id);

            if (teamPlayers.length === 0) {
                listContainer.innerHTML = '<li style="color:#888; padding:10px;">Bu takımda henüz oyuncu bulunmuyor. Önce oyuncu ekleyin.</li>';
            } else {
                teamPlayers.forEach(player => {
                    listContainer.innerHTML += `
                        <li class="player-item">
                            <input type="radio" name="spokesperson" id="s_${player.userId}" value="${player.userId}" class="spokesperson-radio" style="width: 18px; height: 18px;">
                            <label for="s_${player.userId}">
                                ${player.username}
                            </label>
                        </li>
                    `;
                });
            }
        }

        // 9. Paneli Kapat Butonuna Tıklandığında (Sözcü Paneli)
        if (e.target.id === 'closeSpokespersonPanelBtn') {
            document.getElementById('spokespersonPanel').classList.add('hidden');
        }

        // 10. Seçili Oyuncuyu Sözcü Yap Butonuna Tıklandığında
        if (e.target.id === 'setSpokespersonBtn') {
            const selectedRadio = document.querySelector('.spokesperson-radio:checked');
            if (currentEditingTeamIndex === null || !teamsArray[currentEditingTeamIndex]) return;

            const team = teamsArray[currentEditingTeamIndex];
            const msgBox = document.getElementById('actionMessageSpokesperson');
            
            if (!selectedRadio) {
                msgBox.textContent = 'Lütfen bir sözcü seçin.';
                msgBox.className = 'message-box error';
                msgBox.style.display = 'block';
                return;
            }

            const userId = parseInt(selectedRadio.value);
            const btn = e.target;
            const originalText = btn.textContent;
            btn.textContent = 'Atanıyor...';
            btn.disabled = true;

            try {
                const token = localStorage.getItem('accessToken');
                
                const response = await fetch(`${BASE_URL}/api/team/admin/${team.id}/set-spokesperson/${userId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error('Sözcü atama işlemi başarısız oldu.');
                }
                
                const responseData = await response.json();
                
                msgBox.textContent = responseData.message || 'Kullanıcı başarıyla takım sözcüsü olarak atandı.';
                msgBox.className = 'message-box success';
                msgBox.style.display = 'block';
                
            } catch(err) {
                msgBox.textContent = `Hata: ${err.message}`;
                msgBox.className = 'message-box error';
                msgBox.style.display = 'block';
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }
    });

    // Sayfa açıldığında verileri çek
    fetchTeams();
    fetchPlayers();
});