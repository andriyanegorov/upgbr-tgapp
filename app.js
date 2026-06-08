const USER_PROFILE_KEY = 'upgrader_user_profile';

function getLocalProfile() {
    try {
        return JSON.parse(localStorage.getItem(USER_PROFILE_KEY)) || null;
    } catch (error) {
        console.error('Ошибка чтения профиля из localStorage', error);
        return null;
    }
}

function setLocalProfile(profile) {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
}

function applyProfileToHeader(profile) {
    if (!profile) {
        return;
    }

    const avatarElements = document.querySelectorAll('.profile-picture');
    avatarElements.forEach((img) => {
        if (profile.avatar_url) {
            img.src = profile.avatar_url;
        }
    });
}

function initAppProfile() {
    const profile = getLocalProfile();
    applyProfileToHeader(profile);
}

document.addEventListener('DOMContentLoaded', initAppProfile);
