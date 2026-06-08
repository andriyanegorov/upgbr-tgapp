const SUPABASE_URL = 'https://aequaoagibnoxtabwiho.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlcXVhb2FnaWJub3h0YWJ3aWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MDM1NTEsImV4cCI6MjA5NjQ3OTU1MX0.9v-NAyfH7pOHZQCYJjkW4DGmCJY4UFEWtCR3oedsA88';

if (SUPABASE_URL.includes('YOUR_PROJECT_ID') || SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY')) {
    console.warn('Supabase не настроен. Откройте supabase.js и пропишите SUPABASE_URL и SUPABASE_ANON_KEY.');
}

const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/supabase.min.js';
let supabaseClient = null;
let supabaseClientPromise = null;

function loadSupabaseLibrary() {
    const existing = window.supabase || window.Supabase;
    if (existing) {
        return Promise.resolve(existing);
    }

    const script = document.querySelector(`script[src="${SUPABASE_CDN}"]`);
    if (script) {
        return new Promise((resolve, reject) => {
            if (window.supabase || window.Supabase) {
                resolve(window.supabase || window.Supabase);
                return;
            }
            script.addEventListener('load', () => resolve(window.supabase || window.Supabase));
            script.addEventListener('error', () => reject(new Error('Не удалось загрузить библиотеку Supabase.')));
        });
    }

    return new Promise((resolve, reject) => {
        const fallback = document.createElement('script');
        fallback.src = SUPABASE_CDN;
        fallback.onload = () => {
            const lib = window.supabase || window.Supabase;
            if (!lib) {
                reject(new Error('Supabase JS library загружена, но глобальная переменная не найдена.'));
                return;
            }
            resolve(lib);
        };
        fallback.onerror = () => reject(new Error('Не удалось загрузить библиотеку Supabase.'));
        document.head.appendChild(fallback);
    });
}

function getSupabaseClient() {
    if (supabaseClient) {
        return Promise.resolve(supabaseClient);
    }
    if (supabaseClientPromise) {
        return supabaseClientPromise;
    }

    supabaseClientPromise = loadSupabaseLibrary().then((supabaseGlobal) => {
        supabaseClient = supabaseGlobal.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return supabaseClient;
    });

    return supabaseClientPromise;
}

function parseTelegramParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        telegram_id: params.get('telegram_id') || params.get('tg_id') || null,
        username: params.get('telegram_username') || params.get('tg_username') || null,
        avatar_url: params.get('telegram_avatar') || params.get('tg_avatar') || null,
    };
}

function getSavedProfile() {
    try {
        return JSON.parse(localStorage.getItem('upgrader_user_profile')) || null;
    } catch (error) {
        console.error('Не удалось прочитать профиль из localStorage', error);
        return null;
    }
}

function saveLocalProfile(profile) {
    localStorage.setItem('upgrader_user_profile', JSON.stringify(profile));
}

async function getProfileFromDb(telegramId) {
    if (!telegramId) {
        return null;
    }

    const client = await getSupabaseClient();
    const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Ошибка загрузки профиля из Supabase', error);
    }

    return data || null;
}

async function uploadAvatarFile(file, profile) {
    if (!file) {
        throw new Error('Выберите файл для загрузки.');
    }

    const client = await getSupabaseClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-_]/g, '_');
    const folder = profile.telegram_id || profile.username || `guest-${Date.now()}`;
    const filePath = `avatars/${folder}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await client.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

    if (uploadError) {
        throw uploadError;
    }

    const { data: publicUrlData, error: urlError } = client.storage
        .from('avatars')
        .getPublicUrl(filePath);

    if (urlError) {
        throw urlError;
    }

    return publicUrlData.publicUrl;
}

async function upsertProfile(profile) {
    if (!profile || !profile.username) {
        throw new Error('Для синхронизации нужен ник Telegram.');
    }

    const profileData = {
        telegram_id: profile.telegram_id,
        username: profile.username,
        avatar_url: profile.avatar_url || null,
        updated_at: new Date().toISOString(),
    };

    const onConflict = profile.telegram_id ? 'telegram_id' : 'username';

    const client = await getSupabaseClient();
    const { data, error } = await client
        .from('profiles')
        .upsert(profileData, { onConflict })
        .select()
        .single();

    if (error) {
        console.error('Ошибка записи профиля в Supabase', error);
        throw error;
    }

    return data;
}

async function syncProfile(profile) {
    const saved = getSavedProfile() || {};
    const merged = {
        ...saved,
        ...profile,
    };

    if (merged.telegram_id || merged.username) {
        const dbProfile = await getProfileFromDb(merged.telegram_id);
        if (dbProfile) {
            merged = {
                ...dbProfile,
                ...merged,
            };
        }

        saveLocalProfile(merged);
        return merged;
    }

    return merged;
}

async function getInventoryFromDb(telegramId) {
    const profile = await getProfileFromDb(telegramId);
    if (!profile || !profile.id) {
        return [];
    }

    const client = await getSupabaseClient();
    const { data, error } = await client
        .from('inventories')
        .select('id,item_name,item_type,rarity,value,image_url,quantity')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Ошибка загрузки инвентаря из Supabase', error);
        return [];
    }

    return data || [];
}
