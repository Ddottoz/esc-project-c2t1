const changePasswordBtn = document.getElementById('changePasswordBtn');
const passwordFields = document.getElementById('passwordFields');

// Show or hide the two new password boxes.
changePasswordBtn.addEventListener('click', function () {
    passwordFields.classList.toggle('hidden');
});
