document.addEventListener("DOMContentLoaded", () => {
    if (!localStorage.getItem("usuarios")) {
        localStorage.setItem("usuarios", JSON.stringify([]));
    }

    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const forgotPasswordForm = document.getElementById("forgotPasswordForm");

    const loginBox = document.getElementById("loginBox");
    const registerBox = document.getElementById("registerBox");
    const forgotPasswordBox = document.getElementById("forgotPasswordBox");

    document.getElementById("showRegister").addEventListener('click', (e) => { e.preventDefault(); switchForm('loginBox', 'registerBox'); });
    document.getElementById("showForgotPassword").addEventListener('click', (e) => { e.preventDefault(); switchForm('loginBox', 'forgotPasswordBox'); });
    document.getElementById("backToLoginFromRegister").addEventListener('click', (e) => { e.preventDefault(); switchForm('registerBox', 'loginBox'); });
    document.getElementById("backToLoginFromForgot").addEventListener('click', (e) => { e.preventDefault(); switchForm('forgotPasswordBox', 'loginBox'); });
    document.getElementById("closeRegister").addEventListener('click', () => { switchForm('registerBox', 'loginBox'); });
    document.getElementById("closeForgotPassword").addEventListener('click', () => { switchForm('forgotPasswordBox', 'loginBox'); });

    function showNotification(message, type) {
        const notificationEl = document.getElementById(type === 'success' ? 'successNotification' : 'errorNotification');
        const messageEl = document.getElementById(type === 'success' ? 'successMessage' : 'errorMessage');
        
        messageEl.textContent = message;
        notificationEl.classList.add('show');

        setTimeout(() => {
            notificationEl.classList.remove('show');
        }, 3000);
    }

    function switchForm(hideId, showId) {
        document.getElementById(hideId).classList.add('hidden-form');
        document.getElementById(hideId).classList.remove('show');
        
        const showBox = document.getElementById(showId);
        showBox.classList.remove('hidden-form');
        setTimeout(() => { showBox.classList.add('show'); }, 10);
    }

    document.querySelectorAll('.toggle-password').forEach(toggle => {
        toggle.addEventListener('click', function () {
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const icon = this.querySelector('i');

            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('bi-eye-slash');
                icon.classList.add('bi-eye');
            } else {
                input.type = 'password';
                icon.classList.remove('bi-eye');
                icon.classList.add('bi-eye-slash');
            }
        });
    });

    loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const userType = document.getElementById("userType").value;
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;

        const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
        const usuarioEncontrado = usuarios.find(u => u.tipo === userType && u.nombre === username && u.clave === password);

        if (usuarioEncontrado) {
            sessionStorage.setItem("isLoggedIn", "true");
            sessionStorage.setItem("usuarioActivo", username);
            sessionStorage.setItem("tipoUsuarioActivo", userType);
            
            showNotification('¡Inicio de sesión exitoso!', 'success');
            setTimeout(() => { window.location.href = "ingreso.html"; }, 1500);
        } else {
            showNotification('Usuario o clave incorrectos.', 'error');
        }
    });

    registerForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const userType = document.getElementById("regUserType").value;
        const username = document.getElementById("regUsername").value.trim();
        const password = document.getElementById("regPassword").value;
        const confirmPassword = document.getElementById("regConfirmPassword").value;

        if (password !== confirmPassword) {
            showNotification('Las contraseñas no coinciden.', 'error');
            return;
        }

        const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
        const usuarioExistente = usuarios.find(u => u.nombre === username && u.tipo === userType);

        if (usuarioExistente) {
            showNotification('Este usuario ya está registrado.', 'error');
            return;
        }

        usuarios.push({ tipo: userType, nombre: username, clave: password });
        localStorage.setItem("usuarios", JSON.stringify(usuarios));

        showNotification('Usuario registrado correctamente.', 'success');
        registerForm.reset();
        setTimeout(() => { switchForm('registerBox', 'loginBox'); }, 1500);
    });

    forgotPasswordForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const userType = document.getElementById("forgotUserType").value;
        const username = document.getElementById("forgotUsername").value.trim();
        const newPassword = document.getElementById("newPassword").value;
        const confirmNewPassword = document.getElementById("confirmNewPassword").value;

        if (newPassword !== confirmNewPassword) {
            showNotification('Las nuevas contraseñas no coinciden.', 'error');
            return;
        }

        const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
        const userIndex = usuarios.findIndex(u => u.nombre === username && u.tipo === userType);

        if (userIndex === -1) {
            showNotification('No se encontró un usuario con esos datos.', 'error');
            return;
        }

        usuarios[userIndex].clave = newPassword;
        localStorage.setItem("usuarios", JSON.stringify(usuarios));

        showNotification('Contraseña actualizada correctamente.', 'success');
        forgotPasswordForm.reset();
        setTimeout(() => { switchForm('forgotPasswordBox', 'loginBox'); }, 1500);
    });
});