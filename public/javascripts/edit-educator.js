const passwordInput = document.getElementById('password');
const showPasswordBtn = document.getElementById('showPasswordBtn');
const changePasswordBtn = document.getElementById('changePasswordBtn');
const passwordFields = document.getElementById('passwordFields');

showPasswordBtn.addEventListener('click', function () {
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        showPasswordBtn.textContent = 'Hide';
    } else {
        passwordInput.type = 'password';
        showPasswordBtn.textContent = 'Show';
    }
});

changePasswordBtn.addEventListener('click', function () {
    passwordFields.classList.toggle('hidden');
});
