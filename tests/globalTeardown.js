module.exports = async () => {
    if (global.__SERVER__ && typeof global.__SERVER__.close === 'function') {
        await new Promise((resolve) => global.__SERVER__.close(resolve));
    }
};
