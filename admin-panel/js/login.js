document.addEventListener("DOMContentLoaded", () => {
  // Backend sunucu adresi
  const BASE_URL = "https://murdergame-backend-production.up.railway.app";

  const loginForm = document.getElementById("adminLoginForm");
  const errorMsg = document.getElementById("errorMsg");
  const loginBtn = document.getElementById("loginBtn");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault(); // Sayfanın yenilenmesini engelle

      // Hata mesajını gizle ve butonu beklemeye al
      errorMsg.style.display = "none";
      loginBtn.disabled = true;
      loginBtn.textContent = "Giriş Yapılıyor...";

      const username = document.getElementById("adminUsername").value;
      const password = document.getElementById("adminPassword").value;

      try {
        // Backend'in bizden beklediği formatta (AdminLoginRequest) isteği atıyoruz[cite: 1]
        const response = await fetch(`${BASE_URL}/api/auth/admin/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
        });

        // Eğer sunucu hata döndürürse (örn: 401 Unauthorized)[cite: 1]
        if (!response.ok) {
          throw new Error("Kullanıcı adı veya şifre hatalı!");
        }

        // Backend'den gelen cevabı (AuthResponse) alıyoruz[cite: 1]
        const data = await response.json();

        // Gelen Token ve rol bilgilerini tarayıcıya (localStorage) kaydediyoruz[cite: 1]
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("role", data.role); // "ADMIN" olarak gelecek[cite: 1]
        localStorage.setItem("username", data.username);
        localStorage.setItem("userId", data.userId);

        // İşlem başarılı, admin paneline yönlendir
        window.location.href = "pages/home.html";
      } catch (error) {
        // Hata mesajını ekrana bas
        errorMsg.textContent = error.message;
        errorMsg.style.display = "block";
      } finally {
        // İşlem bitince butonu tekrar aktif et
        loginBtn.disabled = false;
        loginBtn.textContent = "Giriş Yap";
      }
    });
  }
});

