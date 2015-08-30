var http = require('http');
var express = require('express');
var bodyParser = require('body-parser');
var playlistRoutes = require('./routes/playlist.js');

var app = express();
app.set('port', 9000);
app.use(express.static('web'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); 

//Spotify Player
var Lame = require('lame');
var Speaker = require('speaker');
var Spotify = require('spotify-web');
var Throttle = require('throttle');


// Spotify credentials...
var login = require('./login.js');
var username = login.username;
var password = login.password;



throttle = function (func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : Date.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = Date.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
};

SpotifyPlayer = (function(){
  var that = this;
  this.initialized = false;
  this.currentTrack = null;
  this.spotifyStream = null;
  this.throttledStream = null;
  this.trackTimePlayed = null;
  this.playLoopId = null;
  this.tracksQueue = null;

  this.BIT_RATE = 160000; // Spotify web standard bit rate
  // Lame decoder & speaker objects
  this.lame = new Lame.Decoder();
  // pipe() returns destination stream
  this.speaker = this.lame.pipe(new Speaker());

  this.login = function(){
    this.spotify = Spotify.login(username, password, function (err, spotify) {
      if (err) throw err;
      that.initialized = true;
      console.log("Spotify Initialized");
    });
  };
  

  this.isPlaying = function() {
    return this.currentTrack != null;
  };

  this.checkAndPlay = function() {
    if (!this.isPlaying() && this.initialized) {
      var uri = this.tracksQueue.next();
      if (uri != null) {
        io.emit("player.start.uri", {
            uri: uri,
            queueIndex: TracksQueue.queueIndex,
            timePlayed: 0
        });

        this.playTrackUri(uri);
      }
    }
  };

  this.startPlayLoop = function() {
    this.playLoopId = setInterval(function(){
      that.checkAndPlay()
    }, 400);
  };

  this.pause = function(){
    if (this.throttledStream != null) { this.throttledStream.pause() }
    that.lastTime = null;
    io.emit("player.pause");
  };

  this.resume = function(){
    if (this.throttledStream != null) { this.throttledStream.resume() }
    that.lastTime = null;
    io.emit("player.resume");
  };

  this.skip = function(abort){
    console.log("SKIP");
    if (this.throttledStream != null) {
      this.throttledStream.pause();
      this.throttledStream.removeAllListeners("data");
      this.throttledStream.unpipe();
    }

    if (this.spotifyStream != null) {
      this.spotifyStream.removeAllListeners("finish");
      if (abort) {
        this.spotifyStream.abort();
      }
      this.spotifyStream.unpipe();
    }
    if (abort) {
      // when aborting delay song chage to flush out Lame
      setTimeout(function(){
        that.currentTrack = null;
      }, 1500);
    }
    
    this.trackTimePlayed = 0;
    that.lastTime = null;
    this.spotifyStream = null;
    this.throttledStream = null;
  };
 
          

  this._syncTimePlayer = function(){
    io.emit("player.time", {
      timePlayed: that.trackTimePlayed
    });
  };

  this.syncTimePlayer = throttle(this._syncTimePlayer, 1000);

  this.playTrackUri = function(uri){
    if (this.isPlaying() || !this.initialized) return;    
    console.log("Querying %s", uri);
    this.currentTrack = uri;
    this.spotify.get(uri, function (err, track) {
      if (err) throw err;

      io.emit("player.play", {
        uri: uri,
        queueIndex: TracksQueue.queueIndex,
        timePlayed: 0
      });

      console.log('Playing: %s - %s', track.artist[0].name, track.name);
      
      if (this.spotifyStream != null) {
        this.skip(true);
      }
      that.spotifyStream = track.play();
      that.throttledStream = that.spotifyStream.pipe(new Throttle(that.BIT_RATE/8)); // convert to bytes per second
      // manually write data to the decoder stream,
      // which is a writeable stream      

      that.throttledStream.on('data', function (chunk) {
        if (that.lastTime==null) {        
          that.lastTime = (new Date()).getTime();
        } else {
          that.trackTimePlayed += (new Date()).getTime() - that.lastTime;
          that.lastTime = (new Date()).getTime();
          //console.log("Time played %s", that.trackTimePlayed/1000 );
        }       
        that.syncTimePlayer();
        that.lame.write(chunk);
      }).on('finish', function () {
        console.log("END THROLLED");
        setTimeout(function(){
          that.skip();  
        }, 2000);      
      });
    });
  };

  return this;
})();

TracksQueue = (function(){
    var that = this;
    this.tracksUris = [];
    //trackUris index
    this.queueIndex = -1;

    this.shuffle = function(){};

    this.pushTrackUriAfterCurrent = function(uri){
        this.tracksUris.splice(this.queueIndex+1, 0, uri);
    };

    this.pushTrackUri = function(uri){
        this.tracksUris.push(uri);
        io.emit("queue.added", { uri: uri });
    };

    this.removeTrackUri = function(uri){
        var index = this.tracksUris.indexOf(uri);
        if (index > -1) {
            this.tracksUris.splice(index, 1);
            io.emit("queue.removed", { uri: uri });
        }
    };

    this.getQueue = function(){
        return this.tracksUris;
    };

    this.next = function(){
        this.queueIndex = (this.queueIndex+1) % this.tracksUris.length;
        if (isNaN(this.queueIndex)) {
          this.queueIndex = 0;
        } else {
          console.log("Current Track %s", this.queueIndex);  
        }        
        return this.tracksUris[this.queueIndex];
    };

    return this
})();

SpotifyPlayer.tracksQueue = TracksQueue;
SpotifyPlayer.login();
SpotifyPlayer.startPlayLoop();


app.use(playlistRoutes);

app.post('/play/', function(req, res){
  var uri = req.body.uri;
  SpotifyPlayer.playTrackUri(uri);
  res.send("OK");
});

app.get('/track/', function(req, res){  
  res.send({
    uri: SpotifyPlayer.currentTrack,
    queueIndex: TracksQueue.queueIndex,
    timePlayed: SpotifyPlayer.trackTimePlayed
  });
});

app.get('/queue/', function(req, res){  
  res.send(TracksQueue.getQueue());
});

app.post('/queue/', function(req, res){
  var uri = req.body.uri;
  TracksQueue.pushTrackUri(uri);
  res.send("OK");
});

app.post('/unqueue/', function(req, res){
  var uri = req.body.uri;
  TracksQueue.removeTrackUri(uri);
  res.send("OK");
});

app.post('/pause/', function(req, res){  
  SpotifyPlayer.pause();
  res.send("OK");
});

app.post('/next/', function(req, res){
  SpotifyPlayer.skip(true);
  res.send("OK");
});

app.post('/resume/', function(req, res){  
  SpotifyPlayer.resume();
  res.send("OK");
});

app.get(/\/.*/, function(req, res){
  res.sendFile(__dirname + '/web/index.html');
});

var server = http.createServer(app);
var io = require('socket.io')();
io.attach(server);

//not reciving event yet
io.on('connection', function (socket) { });

server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});




