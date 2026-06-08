const avatarInput = document.getElementById('avatarInput');
const uploadAvatarBtn = document.getElementById('uploadAvatarBtn');
const avatarPreview = document.getElementById('avatarPreview');
const profileUsernameEl = document.getElementById('profileUsername');
const profileIdEl = document.getElementById('profileId');
const syncStatusEl = document.getElementById('syncStatus');
const settingsModal = document.getElementById('settingsModal');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const profileMessageEl = document.getElementById('profileMessage');
const inventoryListEl = document.getElementById('inventoryList');
const inventoryCountEl = document.getElementById('inventoryCount');

function setMessage(text, isError = false) {
    if (!profileMessageEl) return;
    profileMessageEl.textContent = text;
    profileMessageEl.style.color = isError ? '#ff6b6b' : '#a8d565';
}

function openSettingsModal() {
    if (settingsModal) {
        settingsModal.classList.remove('hidden');
    }
}

function closeSettingsModal() {
    if (settingsModal) {
        settingsModal.classList.add('hidden');
    }
}

function initializeModalHandlers() {
    if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', openSettingsModal);
    }
    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', closeSettingsModal);
    }
    if (settingsModal) {
        settingsModal.addEventListener('click', (event) => {
            if (event.target === settingsModal) {
                closeSettingsModal();
            }
        });
    }
}

function updateProfileUI(profile) {
    if (!profile) {
        return;
    }

    const avatarUrl = profile.avatar_url || './data/assets/user.png';
    avatarPreview.src = avatarUrl;
    profileUsernameEl.textContent = profile.username || 'Не указано';
    profileIdEl.textContent = profile.telegram_id ? `ID ${profile.telegram_id}` : 'ID не получен';

    syncStatusEl.textContent = profile.telegram_id
        ? 'Синхронизировано через Mini-App'
        : 'Telegram Mini-App не передал данные';

    setMessage('');
    if (profile.avatar_url) {
        const allAvatars = document.querySelectorAll('.profile-picture');
        allAvatars.forEach((img) => {
            img.src = profile.avatar_url;
        });
    }
}

function renderInventory(items) {
    if (!inventoryListEl) {
        return;
    }

    if (!Array.isArray(items) || items.length === 0) {
        inventoryListEl.innerHTML = '<div class="inventory-empty">Инвентарь пуст</div>';
        if (inventoryCountEl) {
            inventoryCountEl.textContent = '0 предметов';
        }
        return;
    }

    const cards = items.map((item) => {
        const imageUrl = item.image_url || './data/items/item-placeholder.png';
        const itemName = item.item_name || item.name || 'Предмет';
        const rarity = item.rarity ? `rarity-${item.rarity.toLowerCase()}` : 'rarity-gray';
        const quantity = item.quantity || 1;
        const value = item.value != null && item.value !== '' ? Number(item.value).toLocaleString('ru-RU') : '-';

        return `
            <div class="inventory-item-card ${rarity}">
                <div class="inventory-item-image-wrapper">
                    <img src="${imageUrl}" alt="${itemName}" class="inventory-item-image" loading="lazy" onerror="this.onerror=null; this.src='./data/items/item-placeholder.png';">
                </div>
                <div class="inventory-item-info">
                    <div class="inventory-item-name">${itemName}</div>
                    <div class="inventory-item-meta">${item.item_type || ''}</div>
                    <div class="inventory-item-details">${quantity} шт • ${value} <img src="./data/assets/icon.png" class="currency-icon-small" alt=""></div>
                </div>
            </div>`;
    }).join('');

    inventoryListEl.innerHTML = cards;
    if (inventoryCountEl) {
        inventoryCountEl.textContent = `${items.length} предмет${items.length === 1 ? '' : 'ов'}`;
    }
}

async function loadInventory(profile) {
    if (!profile || !profile.telegram_id) {
        renderInventory([]);
        return;
    }

    try {
        const items = await getInventoryFromDb(profile.telegram_id);
        renderInventory(items);
    } catch (error) {
        console.error('Ошибка загрузки инвентаря:', error);
        renderInventory([]);
    }
}

function getTelegramProfileFromParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        telegram_id: params.get('telegram_id') || params.get('tg_id') || null,
        username: params.get('telegram_username') || params.get('tg_username') || null,
        avatar_url: params.get('telegram_avatar') || params.get('tg_avatar') || null,
    };
}

async function initializeProfilePage() {
    const localProfile = getLocalProfile() || {};
    const telegramProfile = getTelegramProfileFromParams();
    const mergedProfile = {
        ...localProfile,
        ...telegramProfile,
    };

    const syncedProfile = await syncProfile(mergedProfile);
    saveLocalProfile(syncedProfile);
    updateProfileUI(syncedProfile);
    await loadInventory(syncedProfile);
}

initializeModalHandlers();

uploadAvatarBtn.addEventListener('click', async () => {
    const file = avatarInput.files?.[0];
    if (!file) {
        setMessage('Выберите изображение для загрузки.', true);
        return;
    }

    try {
        setMessage('Загружаем аватарку...');
        const profile = getSavedProfile();
        if (!profile || !profile.username) {
            throw new Error('Нужен ник Telegram. Синхронизируйте, пожалуйста, Mini-App.');
        }

        const avatarUrl = await uploadAvatarFile(file, profile);
        profile.avatar_url = avatarUrl;
        await upsertProfile(profile);
        saveLocalProfile(profile);
        updateProfileUI(profile);
        setMessage('Аватарка успешно загружена.');
    } catch (error) {
        console.error(error);
        setMessage(error.message || 'Ошибка загрузки.', true);
    }
});

initializeProfilePage();
