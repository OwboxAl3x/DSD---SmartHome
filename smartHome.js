var http = require("http");
var url = require("url");
var fs = require("fs");
var path = require("path");
var socketio = require("socket.io");
var MongoClient = require('mongodb').MongoClient;
var MongoServer = require('mongodb').Server;
var mimeTypes = { "html": "text/html", "jpeg": "image/jpeg", "jpg": "image/jpeg", "png": "image/png", "js": "text/javascript", "css": "text/css", "swf": "application/x-shockwave-flash"};

var temp;
var lumi;
var persi = false;
var ac = false;
var primera = true;

var httpServer = http.createServer(
	function(request, response) {
		var uri = url.parse(request.url).pathname;
		if (request.url === '/favicon.ico') {
            response.writeHead(200, {'Content-Type': 'image/x-icon'} );
            response.end();
            return;
        }else if (uri=="/"){
            uri = "/smartHome.html";
        }else if(uri=="/sensores"){
            uri = "/smartHomeSensores.html";
        }else if(uri=="/agente"){
            uri = "/agente.html";
        }
		var fname = path.join(process.cwd(), uri);
		fs.exists(fname, function(exists) {
			if (exists) {
				fs.readFile(fname, function(err, data){
					if (!err) {
						var extension = path.extname(fname).split(".")[1];
						var mimeType = mimeTypes[extension];
						response.writeHead(200, mimeType);
						response.write(data);
						response.end();
					}
					else {
						response.writeHead(200, {"Content-Type": "text/plain"});
						response.write('Error de lectura en el fichero: '+uri);
						response.end();
					}
				});
			}
			else{
                console.log("Peticion invalida: "+uri);
                response.writeHead(200, {"Content-Type": "text/plain"});
                response.write('404 Not Found\n');
                response.end();
			}
		});
	}
);

var mongoClient = new MongoClient(new MongoServer('localhost', 27017));
mongoClient.connect("mongodb://localhost:27017/smartBD", function(err, db) {
	httpServer.listen(8080);
	var io = socketio.listen(httpServer);
    
    if(primera){
        var bienvenida = 'Bienvenido al cerebro de tu casa inteligente!';
        temp = '30';
        lumi = '1';
        primera = false;
    }
	
	db.createCollection("test", function(err, collection){
    	io.sockets.on('connection', function(datos) {
            
            console.log('Usuario conectado');
            
            datos.on('new', function (data) {
                datos.emit('new', {bienvenida, temp, lumi});
            });
            
            datos.on('cambiaTempLumi', function (data) {
                collection.insert({cambio:'temperatura', cuanto:data.temp, time:data.d}, {safe:true}, function(err, result) {});
                collection.insert({cambio:'luminosa', cuanto:data.lumi, time:data.d}, {safe:true}, function(err, result) {});
                io.emit('temp', data.temp);
                io.emit('persi', data.lumi);
                var luminosidad = data.lumi;
                var temperatura = data.temp;
                io.emit('cambiaTempLumiAgente', {temperatura, luminosidad, persi, ac});
            });
            
            datos.on('cambiaTemp', function (data) {
                collection.insert({cambio:'temperatura', cuanto:data.temp, time:data.d}, {safe:true}, function(err, result) {});
                io.emit('temp', data.temp);
                var temperatura = data.temp;
                io.emit('cambiaTempAgente', {temperatura, persi, ac});
            });
            
            datos.on('cambiaLumi', function (data) {
                collection.insert({cambio:'luminosa', cuanto:data.lumi, time:data.d}, {safe:true}, function(err, result) {});
                io.emit('persi', data.lumi);
                var luminosidad = data.lumi;
                io.emit('cambiaLumiAgente', {luminosidad, persi, ac});
            });
            
            datos.on('alert', function (data) {
                persi = data.persi;
                ac = data.ac;
                io.emit('alert', data.mensaje);
            });
            
			datos.on('ac', function (data) {
                if(data.accion == 'Enciende el A/C'){
                    collection.insert({cambio:'temperatura', cuanto:'18', time:data.d}, {safe:true}, function(err, result) {});
                    ac = true;
                    datos.emit('temp', '18');
                }else{
                    collection.insert({cambio:'temperatura', cuanto:'30', time:data.d}, {safe:true}, function(err, result) {});
                    datos.emit('temp', '30');
                    ac = false;
                }
                console.log(data);

			});
            
            datos.on('persiana', function (data) {
                
                if(data.accion == 'Abre la persiana'){ 
                    collection.insert({cambio:'luminosa', cuanto:'10', time:data.d}, {safe:true}, function(err, result) {});
                    datos.emit('persi', '10');
                    persi = true;
                }else{ 
                    collection.insert({cambio:'luminosa', cuanto:'1', time:data.d}, {safe:true}, function(err, result) {});
                    datos.emit('persi', '1');
                    persi = false;
                }
                console.log(data);

			});
            
            datos.on('disconnect', function(){
                console.log('Usuario desconectado');
            });
		});
    });
    
});

console.log("Servicio SmartHome iniciado");