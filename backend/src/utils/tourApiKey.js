function normalizeServiceKey(serviceKey) {
    const key = String(serviceKey || "").trim();
    if (!key.includes("%")) return key;
    try {
        return decodeURIComponent(key);
    } catch (error) {
        return key;
    }
}

module.exports = { normalizeServiceKey };
