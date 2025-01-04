const {simpleWebServer, mimeTypes} = require('../simpleWebServer');

const Config = {
    host: 'localhost',
    httpPort: 8080,
    httpsPort: 8443,
    sslCert: null,
    sslKey: null,
    sslCA: null,
}

const ws = new simpleWebServer(Config);

const simpleRoute = async (request, response) => {
    const text_data = "Welcome to Super Simple Web Server\n"
    console.log("simple route requested\n");
    response.statusCode = 200;
    response.setHeader("Content-Type", mimeTypes['txt']);
    response.end(text_data);
}

ws.addRoute("GET", "/", simpleRoute);
ws.start();
