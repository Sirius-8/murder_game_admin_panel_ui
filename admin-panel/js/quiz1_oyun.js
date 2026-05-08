document.addEventListener('DOMContentLoaded', () => {
    // --- 1. WEBSOCKET DEĞİŞKENLERİ ---
    let stompClient = null;
    const wsUrl = "https://murdergame-backend-production.up.railway.app/ws";
    
    // Geçerli bir token ve room ID yoksa prompt ile soruyoruz (testler kolaylaşsın diye)
    // Asıl projede auth login vs yapılınca bunları localStorage'a setlemeniz gerekir.
    let token = localStorage.getItem("accessToken");
    if (!token) {
        token = prompt("Lütfen geçerli bir JWT Token giriniz (Başına Bearer eklemeye gerek yok):");
        if (token) localStorage.setItem("accessToken", token);
    }

    let roomId = localStorage.getItem("currentRoomId");
    if (!roomId) {
        roomId = prompt("Bağlanılacak Odanın ID'sini giriniz:", "1");
        if (roomId) localStorage.setItem("currentRoomId", roomId);
    }

    // DOM Elementleri
    const timeText = document.getElementById('timeText');
    const timerPath = document.getElementById('timerPath');
    const circleRadius = 45;
    const circumference = 2 * Math.PI * circleRadius;
    const nextBtn = document.getElementById('nextQuestionBtn');
    
    // Oyun Durum Değişkenleri
    let timerInterval = null;
    let TOTAL_TIME = 60; // Backend'den gelmezse varsayılan
    
    // --- 2. WEBSOCKET BAĞLANTISINI KUR ---
    function connectWebSocket() {
        if (!token) {
            console.error("Token bulunamadı, bağlantı kurulamadı.");
            alert("Token bulunamadı! Sayfayı yenileyip token girin.");
            return;
        }

        const socket = new SockJS(wsUrl);
        stompClient = Stomp.over(socket);
        stompClient.debug = null; // Stomp loglarını gizler, açmak isterseniz bu satırı silin

        const authToken = token.startsWith("Bearer ") ? token : "Bearer " + token;

        stompClient.connect({ Authorization: authToken }, () => {
            console.log("✅ WebSocket Bağlantısı Kuruldu (Quiz 1). Oda ID:", roomId);
            
            document.getElementById('gameMainTitle').textContent = "Bağlantı Başarılı - İlk Soru Başlatılıyor...";
            document.getElementById('gameLeaderboardOverlay').classList.add('hidden');
            
            subscribeToChannels();

            // İlk soruyu hemen başlat (böylece 60 saniye direkt saymaya başlar)
            setTimeout(() => {
                stompClient.send(`/app/quiz/${roomId}/next-question`, {}, '{}');
                console.log("📤 İlk soru otomatik olarak istendi.");
            }, 500);
        }, (err) => {
            console.error("❌ WebSocket Bağlantı Hatası:", err);
            alert("Bağlantı hatası! Konsolu kontrol edin.");
        });
    }

    // --- 3. KANALLARI DİNLE ---
    function subscribeToChannels() {
        // A) Yeni Soru Geldiğinde
        stompClient.subscribe(`/topic/room/${roomId}/question`, (msg) => {
            try {
                const questionData = JSON.parse(msg.body);
                console.log("📥 Yeni Soru Geldi:", questionData);
                loadQuestionUI(questionData);
            } catch(e) { console.error("Soru parse hatası:", e); }
        });

        // B) Soru Sonucu (Doğru Cevap) Geldiğinde
        stompClient.subscribe(`/topic/room/${roomId}/question-result`, (msg) => {
            try {
                // Eğer cevap obje değil de "B" gibi düz metinse JSON.parse patlayabilir
                // O yüzden ufak bir kontrol yapıyoruz
                let resultData;
                try {
                    resultData = JSON.parse(msg.body);
                } catch (err) {
                    resultData = msg.body; // Düz string "A", "B" vs. gelmişse
                }
                
                const correctAnswer = resultData.correctAnswer || resultData; 
                console.log("🏁 Soru Bitti, Doğru Cevap:", correctAnswer);
                showCorrectAnswer(correctAnswer);
            } catch(e) { console.error(e); }
        });

        // C) Liderlik Tablosu Geldiğinde
        stompClient.subscribe(`/topic/room/${roomId}/leaderboard`, (msg) => {
            try {
                const leaderboardData = JSON.parse(msg.body);
                console.log("🏆 Leaderboard Geldi:", leaderboardData);
                renderGameLeaderboard(leaderboardData, false); 
            
            } catch(e) { console.error(e); }
        });
    }

    // --- TÜM TAKIMLARI ÇEKME (Leaderboard için) ---
    let allTeamsList = [];
    async function fetchAllTeams() {
        try {
            const res = await fetch("https://murdergame-backend-production.up.railway.app/api/team/all", {
                headers: { 'Authorization': token.startsWith("Bearer ") ? token : `Bearer ${token}` }
            });
            if (res.ok) {
                allTeamsList = await res.json();
            }
        } catch(e) { console.warn("Takımlar çekilemedi", e); }
    }

    // --- 4. ARAYÜZ (UI) GÜNCELLEME İŞLEMLERİ ---
    function loadQuestionUI(q) {
        // Overlay'i gizle
        document.getElementById('gameLeaderboardOverlay').classList.add('hidden');

        let actualQuestion = q;
        if (q && q.questionText === undefined && Object.keys(q).length === 1) {
            const innerKey = Object.keys(q)[0];
            if (typeof q[innerKey] === 'object') {
                actualQuestion = q[innerKey];
            }
        }

        if (q && (q.event === "QUIZ_FINISHED" || actualQuestion.event === "QUIZ_FINISHED" || q.message === "Oyun bitti" || q.message === "QUIZ_FINISHED")) {
            document.getElementById('questionText').textContent = "Oyun Bitti! Bu odadaki tüm sorular tamamlanmış (Sonuçlar için süre bekleniyor).";
            document.getElementById('gameMainTitle').textContent = "Quiz Tamamlandı";
            document.getElementById('textA').textContent = "-";
            document.getElementById('textB').textContent = "-";
            document.getElementById('textC').textContent = "-";
            document.getElementById('textD').textContent = "-";
            
            // Oyun bitmiş olsa bile istenildiği gibi 60 saniye akmasını sağla
            TOTAL_TIME = 60;
            startTimer(TOTAL_TIME);
            return;
        }

        const qNum = (q.questionIndex !== undefined) ? (q.questionIndex + 1) : "?";
        document.getElementById('gameMainTitle').textContent = `Quiz 1 - Soru ${qNum}`;

        document.querySelectorAll('.option-card').forEach(card => card.classList.remove('correct-answer'));

        const qText = actualQuestion.questionText || actualQuestion.text || actualQuestion.question || null;

        if (!qText) {
            document.getElementById('questionText').textContent = "HATA: Beklenmeyen Veri Formatı: " + JSON.stringify(q);
            document.getElementById('textA').textContent = "-";
            document.getElementById('textB').textContent = "-";
            document.getElementById('textC').textContent = "-";
            document.getElementById('textD').textContent = "-";
        } else {
            document.getElementById('questionText').textContent = qText;
            document.getElementById('textA').textContent = actualQuestion.optionA || actualQuestion.a || "-";
            document.getElementById('textB').textContent = actualQuestion.optionB || actualQuestion.b || "-";
            document.getElementById('textC').textContent = actualQuestion.optionC || actualQuestion.c || "-";
            document.getElementById('textD').textContent = actualQuestion.optionD || actualQuestion.d || "-";
        }

        document.getElementById('voteA').textContent = "0";
        document.getElementById('voteB').textContent = "0";
        document.getElementById('voteC').textContent = "0";
        document.getElementById('voteD').textContent = "0";

        TOTAL_TIME = actualQuestion.durationSeconds || actualQuestion.duration || 60; 
        startTimer(TOTAL_TIME);
    }

    function startTimer(duration) {
        clearInterval(timerInterval); 
        let timeLeft = duration;
        
        // Daire animasyonunu sıfırla
        timerPath.style.strokeDasharray = circumference;
        timerPath.style.strokeDashoffset = 0;
        timerPath.style.stroke = '#4CAF50'; 
        timeText.style.color = '#fff';
        timeText.textContent = timeLeft;

        timerInterval = setInterval(() => {
            timeLeft--;
            timeText.textContent = timeLeft;

            const offset = circumference - (timeLeft / duration) * circumference;
            timerPath.style.strokeDashoffset = offset;

            // Renk değişimleri
            if (timeLeft <= 10) { timerPath.style.stroke = '#f39c12'; timeText.style.color = '#f39c12'; }
            if (timeLeft <= 5) { timerPath.style.stroke = '#e74c3c'; timeText.style.color = '#e74c3c'; }

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timeText.textContent = "0";
                timerPath.style.strokeDashoffset = circumference; 
                
                // Süre bittiğinde otomatik DB'den leaderboard çek ve göster
                setTimeout(async () => {
                    try {
                        const res = await fetch("https://murdergame-backend-production.up.railway.app/api/leaderboard", {
                            headers: { 'Authorization': token.startsWith("Bearer ") ? token : `Bearer ${token}` }
                        });
                        if (res.ok) {
                            const data = await res.json();
                            renderGameLeaderboard(data, true); // true = Ekranı aç
                        } else {
                            renderGameLeaderboard([], true);
                        }
                    } catch(e) {
                        console.error(e);
                        renderGameLeaderboard([], true);
                    }
                }, 1000);
            }
        }, 1000);
    }

    function showCorrectAnswer(correctAnswerLetter) {
        // Süre bitmemişse (örneğin admin erken bitirdiyse) sayacı durdur
        clearInterval(timerInterval);
        timeText.textContent = "0";
        timerPath.style.strokeDashoffset = circumference; 

        // Objeden ya da düz stringten harfi çek
        const letter = typeof correctAnswerLetter === 'object' ? correctAnswerLetter.correctAnswer : correctAnswerLetter;
        const correctCard = document.getElementById('card' + String(letter).toUpperCase());
        
        if (correctCard) {
            correctCard.classList.add('correct-answer');
        } else {
            console.warn("Eşleşen şık HTML'de bulunamadı:", letter);
        }
    }

     function renderGameLeaderboard(data, showOverlay = false) {
        if (showOverlay) {
            document.getElementById('gameLeaderboardOverlay').classList.remove('hidden');
        }
        
        const list = document.getElementById('gameLeaderboardList');
        list.innerHTML = '';
        
        let parsedData = [];
        if (Array.isArray(data)) parsedData = data;
        
        let mergedLeaderboard = [];
        
        parsedData.forEach(t => {
            mergedLeaderboard.push({
                name: t.teamName || (t.teamNo ? `Takım ${t.teamNo}` : null) || t.name || `Takım ${t.teamId}`,
                teamId: t.teamId || t.id || null,
                // DÜZELTME BURADA: t.totalScore EKLENDİ!
                score: t.totalScore || t.score || t.points || 0
            });
        });
        
        allTeamsList.forEach(apiTeam => {
            const exists = mergedLeaderboard.find(x => x.teamId === apiTeam.id || x.name === `Takım ${apiTeam.teamNo}`);
            if (!exists && apiTeam.active) {
                mergedLeaderboard.push({ name: `Takım ${apiTeam.teamNo}`, teamId: apiTeam.id, score: 0 });
            }
        });
        
        mergedLeaderboard.sort((a, b) => b.score - a.score);
        const top5 = mergedLeaderboard.slice(0, 5);
        
        if (top5.length === 0) {
            list.innerHTML = '<li style="text-align:center; padding:20px;">Henüz listelenecek takım yok.</li>';
            return;
        }

        top5.forEach((team, index) => {
            list.innerHTML += `
                <li class="game-leaderboard-item">
                    <div class="rank-team-info"><span class="rank">#${index + 1}</span><span class="team-name">${team.name}</span></div>
                    <span class="score">${team.score} P</span>
                </li>`;
        });
    }

    // --- 5. ADMİN: SONRAKİ SORUYU TETİKLEME ---
    nextBtn.addEventListener('click', () => {
        if (stompClient && stompClient.connected) {
            // Butona basılınca leaderboard kapanır ve yükleniyor hissi verilir
            document.getElementById('gameLeaderboardOverlay').classList.add('hidden');
            document.getElementById('questionText').textContent = "Sunucudan soru bekleniyor...";
            
            stompClient.send(`/app/quiz/${roomId}/next-question`, {}, '{}');
            console.log("📤 Sonraki Soru İsteği Gönderildi.");
        } else {
            alert("Sunucuya henüz bağlanılamadı, lütfen bekleyin veya sayfayı yenileyin.");
        }
    });

    // BAŞLANGIÇ
    connectWebSocket();
    fetchAllTeams();

});
