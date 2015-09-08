var http = require('http');
var request = require('request');
var express = require('express');
var bodyParser = require('body-parser');
var playlistRoutes = require('./routes/playlist.js');
var lyricSearch = require("./lyric_search");
var playlists = require("./models.js").playlists;

var app = express();
app.set('port', 9000);
//app.use(express.static('web'));
app.use(express.static('static_html'));
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


debounce = function (func, wait, immediate) {
  var timeout, args, context, timestamp, result;

  var later = function() {
    var last = Date.now() - timestamp;

    if (last < wait && last >= 0) {
      timeout = setTimeout(later, wait - last);
    } else {
      timeout = null;
      if (!immediate) {
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      }
    }
  };

  return function() {
    context = this;
    args = arguments;
    timestamp = Date.now();
    var callNow = immediate && !timeout;
    if (!timeout) timeout = setTimeout(later, wait);
    if (callNow) {
      result = func.apply(context, args);
      context = args = null;
    }

    return result;
  };
};

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

  this.lame.on('format', console.log);
  
  
  this.lame.on('data', function(data){    
      console.log(Math.max.apply(null,data),"  <>  ", Math.min.apply(null,data))
  
  
    
  })
  
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
    }, 700);
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
    } else {
      that.currentTrack = null;
    }
    
    this.trackTimePlayed = 0;
    that.lastTime = null;
    this.spotifyStream = null;
    this.throttledStream = null;
  };
 
          

  this._syncTimePlayer = function(){
    io.emit("player.time", {
      uri: that.currentTrack,
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

    this.replaceQueue = function(uriList){        
        this.tracksUris = uriList;
        this.queueIndex = -1;
        io.emit("queue.replaced");
    };

    this.pushTrackUri = function(uri){
        this.tracksUris.push(uri);
        io.emit("queue.added", { uri: uri });
    };

    this.removeTrackUri = function(uri){
        var index = this.tracksUris.indexOf(uri);
        if (index > -1) {
            this.tracksUris.splice(index, 1);
            if (index<this.queueIndex) {
              //when removing from the queue go back one if removed from behind the current track
              this.queueIndex -= 1;
            }
            io.emit("queue.removed", { uri: uri });
        }
    };

    this.getQueue = function(){
        return this.tracksUris;
    };

    this.next = function(){
        if (this.tracksUris.length == 0) return null;
        this.queueIndex = (this.queueIndex+1) % this.tracksUris.length;
        if (isNaN(this.queueIndex)) {
          this.queueIndex = 0;
        } 
        console.log("Current Track %s", this.queueIndex);          
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

app.post('/queue/changeto/', function(req, res){
  TracksQueue.queueIndex = parseInt(req.body.position)-1;
  res.send("OK");
  SpotifyPlayer.skip(true);
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

app.get('/suggestion/wikipedia/', function(req, res){  
  var q = req.query.search;  
  request({
    url: "https://en.wikipedia.org/w/api.php",
    qs: {
      action: "opensearch",
      limit: "10",
      namespace: 0,
      format: "json",
      search: q
    }
  }, function (error, response, body){
    try {
      res.send(JSON.parse(body)[1]);
    } catch(e) {
      console.log(e);
      res.status(404).send('Not found');
    }    
  });
});


app.get('/suggestion/', function(req, res){  
  var q = req.query.search;  
  request({
    url: "https://www.musixmatch.com/ws/1.1/macro.search?app_id=community-app-v1.0&format=json&part=artist_image&page_size=10&q="+q,
    //url: "https://www.musixmatch.com/ws/1.1/macro.search",
    strictSSL: false,
  }, function (error, response, body){
    
    try {
      var r = JSON.parse(body).message.body.macro_result_list.artist_list.reduce(function(a, d){
           if (d.artist.artist_name < 65 || d.artist.artist_rating > 0){
               a.push(d.artist.artist_name);
           }
           return a          
      }, []);
      res.send(r);
    } catch(e) {
      console.log(e);
      res.status(404).send('Not found');
    }    
  });
});


app.post('/playlist/:id/play/', function(req, res){  
  playlists.findOne({ _id: req.params.id }, function (err, doc) {
    if (doc) {        
      TracksQueue.replaceQueue(doc.tracks);
      res.send("OK");
    } else {
      res.status(404).send('Not found');
    }    
  });
});

app.get('/player/', function(req, res){  
  res.sendFile(__dirname + '/static_html/templates/player.html');
});

app.get('/', function(req, res){  
  res.sendFile(__dirname + '/static_html/templates/playerL.html');
});


app.get(/\/.*/, function(req, res){
  res.sendFile(__dirname + '/static_html/templates/playerL.html');
});

var server = http.createServer(app);
var io = require('socket.io')();
io.attach(server);

//not reciving event yet
io.on('connection', function (socket) { });

server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});




