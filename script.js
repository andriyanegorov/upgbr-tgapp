const itemsGrid = document.querySelector('.items-grid');
const itemsJsonPath = 'items.json';
const placeholderImage = './data/items/item-placeholder.png';

function normalizeRarity(rarity) {
    if (!rarity) {
        return 'gray';
    }
    return rarity.toLowerCase();
}

function getRarityClass(rarity) {
    const normalized = normalizeRarity(rarity);
    const available = new Set(['gray', 'green', 'blue', 'purple', 'pink', 'red', 'gold']);
    return available.has(normalized) ? `rarity-${normalized}` : 'rarity-gray';
}

function formatPrice(value) {
    if (value === '-' || value === undefined || value === null) {
        return '—';
    }
    const number = Number(value);
    if (Number.isNaN(number)) {
        return value;
    }
    return new Intl.NumberFormat('ru-RU').format(number);
}

function createItemCard(item) {
    const rarityClass = getRarityClass(item.rarity);
    const price = formatPrice(item.value);
    const imgSrc = item.image || placeholderImage;
    const itemName = item.name || 'Без названия';
    const itemType = item.type ? `<div class="item-type">${item.type}</div>` : '';

    return `
        <div class="item-card ${rarityClass}">
            <div class="item-price">${price} <img src="./data/assets/icon.png" class="currency-icon-small" alt="" loading="lazy"></div>
            <div class="item-image-wrapper">
                <img src="${imgSrc}" alt="${itemName}" class="item-image" loading="lazy" onerror="this.onerror=null; this.src='${placeholderImage}';">
            </div>
            <div class="item-name">${itemName}</div>
            ${itemType}
        </div>`;
}

function renderItems(items) {
    if (!itemsGrid) {
        console.error('Контейнер для предметов не найден');
        return;
    }

    if (!Array.isArray(items) || items.length === 0) {
        itemsGrid.innerHTML = '<div class="empty-state">Нет доступных предметов</div>';
        return;
    }

    const cards = items.map(createItemCard).join('');
    itemsGrid.innerHTML = cards;
}

async function loadItems() {
    try {
        const response = await fetch(itemsJsonPath, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Не удалось загрузить items.json: ${response.status} ${response.statusText}`);
        }

        const items = await response.json();
        renderItems(items);
    } catch (error) {
        console.error(error);
        if (itemsGrid) {
            itemsGrid.innerHTML = `<div class="empty-state">Ошибка загрузки предметов: ${error.message}</div>`;
        }
    }
}

loadItems();
