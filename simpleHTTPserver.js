const http = require("node:http");
const url = require("node:url");
const path = require("node:path");
const fs = require("node:fs/promises");
const querystring = require('node:querystring');

const defaultConfig = {
    host: 'localhost',
    port: 8080,
    documentRoot: path.join(process.cwd(), '/docs'),
    defaultFile: "index.html",
    enableDirList: true,
    notFoundHTML: "<html><title>Not found</title><body><h1>Not found !</h1></html>",
}

const mimeTypes = {
    txt:    "text/plain",
    html:   "text/html",
    htm:    "text/html",
    css:    "text/css",
    js:     "text/javascript",
    json:   "application/json",
    csv:    "text/csv",
    ico:    "image/x-icon",
    jpg:    "image/jpeg",
    jpeg:   "image/jpeg",
    png:    "image/png",
};

const methods = ["GET", "PUT", "POST"];

// https://javascript.plainenglish.io/here-are-2-javascript-approaches-to-encode-decode-html-entities-52989bb12031
function encodeHTML(rawStr) {
    return rawStr.replace(/[\u00A0-\u9999<>\&]/g, ((i) => `&#${i.charCodeAt(0)};`));
}
// https://javascript.plainenglish.io/here-are-2-javascript-approaches-to-encode-decode-html-entities-52989bb12031
function decodeHTML(rawStr) {
    return rawStr.replace(/&#(\d+);/g, ((match, dec) => `${String.fromCharCode(dec)}`));
}

function fetchHeader(request, headerName) {
    const { rawHeaders } = request;
    let headerContent = [];
    for (i = 0; i < rawHeaders.length; i += 2) {
        if (rawHeaders[i].toLowerCase() === headerName.toLowerCase()) {
            headerContent.push(request.rawHeaders[i+1]);
        }
    }
    return headerContent;
}

class simpleHTTPserver {
    constructor(config) {
        this.config = defaultConfig;
        this.setConfig(config);
        this.server = http.createServer();
        this.routes = [];
        this.cors = [];

        this.server.on('request', (request, response) => {
            const reqPath = querystring.unescape(url.parse(request.url).pathname);            
            let requestRouted = false;
            let body = [];
            
            // check for cors
            for (let entry of this.cors) {                
                if (entry.host.toLowerCase() === "*" ||
                    entry.host.toLowerCase() === request.headers.host.toLowerCase() ) {
                    // emit cors headers if a match found
                    response.setHeader('Access-Control-Allow-Origin', entry.host);
                    response.setHeader('Access-Control-Allow-Methods', entry.methods);
                    response.setHeader('Access-Control-Allow-Headers', entry.headers);
                    break;
                }
            }
            console.log(request.method, request.url);
            // process request
            request
                .on('data', (chunk) => {
                    body.push(chunk);
                })
                .on('end', () => {
                    request.body = Buffer.concat(body).toString();                   
                    //check endpoints
                    for (let route of this.routes) {
                    if (request.method === route.method && reqPath === route.path) {
                        requestRouted = true;                        
                        route.handler(request, response);
                }
            }    
            if (!requestRouted) {
                this.serveFile(request, response);
            }             
                })
                .on('error', (err) => {
                    console.log(err);
                });
            response
                .on('error', (err) => {
                    console.log(err);
                });
        });
    }

    setConfig = (config) => {
        //overwrite default config with options in config
        this.config = {...this.config, ...config};
    }

    serveDirList = (request, response) => {
        const { documentRoot, notFoundHTML } = this.config;
        const dirPath = querystring.unescape(url.parse(request.url).pathname);
    
        fs.readdir(path.join(documentRoot, dirPath), {withFileTypes: true})
        .then((dirEnts) => {
            let fileListHTML=`<html><title>Directory of ${encodeHTML(dirPath)}</title><body>`
            if (request.url != '/') {
                //if not root dir
                const parentDir = path.normalize(dirPath + '..');
                fileListHTML += `<a href=${encodeHTML(parentDir)}>..</a><br>`;
            }
            console.log(`List of ${dirPath}`);
            for (let dirEnt of dirEnts) {
                const dirSep = (dirEnt.isDirectory()) ? path.sep : '';
                const fileName = dirEnt.name + dirSep;
                const filePath = path.join(dirPath, fileName);
                fileListHTML += `<a href=${encodeHTML(filePath)}>${encodeHTML(fileName)}</a><br>`;
            }
            fileListHTML += `</body></html>`
            response.statusCode = 200;
            response.setHeader("Content-Type", mimeTypes['html']);        
            response.end(fileListHTML);  
        })
        .catch((err) => {
            console.log(err);
            response.statusCode = 404;
            response.setHeader("Content-Type", mimeTypes['html']);        
            response.end(notFoundHTML); 
        });
    };
    
    serveDefaultFile = (request, response) => {
        const { documentRoot, defaultFile, notFoundHTML, enableDirList } = this.config;
        const dirPath = querystring.unescape(url.parse(request.url).pathname);        
    
        fs.readFile(path.join(documentRoot, dirPath, defaultFile))
        .then(content => {
            response.statusCode = 200;
            response.setHeader("Content-Type", mimeTypes['html']);        
            response.end(content);    
        })
        .catch((err) => {
            //check for no such file err.errno=-2 || err.code='ENOENT'
            if (enableDirList && err.code === 'ENOENT') {
                this.serveDirList(request, response);
            } else {
                console.log("Error: ", err);
                response.statusCode = 404;
                response.setHeader("Content-Type", mimeTypes['html']);        
                response.end(notFoundHTML);
            }    
        });
    };
    
    serveFile = (request, response) => {
        const { documentRoot, notFoundHTML } = this.config; 
        const filePath = querystring.unescape(url.parse(request.url).pathname);
        const fileExt = path.extname(filePath).slice(1);
        let mimeType = mimeTypes[fileExt];
        mimeType = mimeType || mimeTypes["txt"]; //not found ? use txt    
    
        fs.readFile(path.join(documentRoot, filePath))
        .then(content => {
            response.statusCode = 200;
            response.setHeader("Content-Type", mimeType);        
            response.end(content);    
        })
        .catch((err) => {
            //check for directory err.errno=-21 || err.code='EISDIR'
            if (err.code === 'EISDIR') {
                this.serveDefaultFile(request, response);
            } else {
                console.log("Error: ", err);
                response.statusCode = 404;
                response.setHeader("Content-Type", mimeTypes['html']);        
                response.end(notFoundHTML);
            }    
        });
    };
    
    addCors = (host, methods = "POST, GET, OPTIONS", headers = "*") => {
        this.cors.push({host, methods, headers});
    }

    addRoute = (method, path, handler) => {
        if (methods.filter((m) => m === method).length === 0) {
            throw(`Unknown method ${method} !\nSupported methods are: ${methods}`);
        }        
        if (typeof(path) !== "string") {
            throw("Path is not string !");
        }
        if (typeof(handler) !== "function") {
            throw("handler must be a function !");
        }
        for (let route of this.routes) {
            if (method === route.method && path === route.path) {
                throw("EndPoint already defined !");
            }
        }
        this.routes.push({method, path, handler});
    };
          
    start = (listenPort, listenHost) => {
        if (listenPort) {
            this.config.port = listenPort;
            this.config.host = listenHost;
        }
        const { host, port, documentRoot } = this.config;
        this.server.listen(port, host, () => {
            console.log(`Server listening at http://${host}:${port}`);
            console.log(`Document root: ${documentRoot}`);
        });    
    };

    stop = () => {
        const { host, port } = this.config;
        if (this.server.listening) {
            this.server.close(() => {
                console.log(`Closed server at http://${host}:${port}`);
            });
        } else {
            console.log("Server not started !");
        } 
    };
}

module.exports = {
    simpleHTTPserver,
    mimeTypes,
    encodeHTML,
    decodeHTML,
    fetchHeader,
};
