const {simpleHTTPserver, mimeTypes} = require('../simpleHTTPserver');

const ws = new simpleHTTPserver();

const simpleRoute = async (request, response) => {
    const text_data = "Welcome to Super Simple Web Server\n"
    console.log("simple route requested\n");
    response.statusCode = 200;
    response.setHeader("Content-Type", mimeTypes['txt']);
    response.end(text_data);
}

ws.addRoute("GET", "/", simpleRoute);
ws.start(8001);
