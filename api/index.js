const { createNestApp } = require('../dist/server');

let cachedApp = null;

async function getServer() {
    if (!cachedApp) {
        cachedApp = await createNestApp();
        await cachedApp.init();
    }

    return cachedApp.getHttpAdapter().getInstance();
}

module.exports = async function handler(request, response) {
    const server = await getServer();
    return server(request, response);
};
