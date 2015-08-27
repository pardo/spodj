//Api 
var express = require('express');
var bodyParser = require('body-parser');

var app = express();

app.use(express.static('web'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); 

//Spotify Player
var Lame = require('lame');
var Speaker = require('speaker');
var Spotify = require('spotify-web');
var Throttle = require('throttle');

//var uri = "spotify:track:4uB28m7RAflobYpnLMb6A2"
//var uri = "spotify:track:5XhMeCYrRhQjL4sUoOmUCE"

// Spotify credentials...
var login = require('./login.js');
var username = login.username;
var password = login.password;



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

  this.spotify = Spotify.login(username, password, function (err, spotify) {
    if (err) throw err;
    that.initialized = true;
    console.log("Spotify Initialized");
  });

  this.isPlaying = function() {
    return this.currentTrack != null;
  };

  this.checkAndPlay = function() {
    if (!this.isPlaying() && this.initialized) {
      var uri = this.tracksQueue.next();
      if (uri != null) {
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
  };

  this.resume = function(){
    if (this.throttledStream != null) { this.throttledStream.resume() }
    that.lastTime = null;
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
    this.currentTrack = null;
    this.trackTimePlayed = null;
    that.lastTime = null;
    this.spotifyStream = null;
    this.throttledStream = null;
  };
 
  this.playTrackUri = function(uri){
    if (this.isPlaying() || !this.initialized) return;    
    console.log("Querying %s", uri);
    this.currentTrack = uri;
    this.spotify.get(uri, function (err, track) {
      if (err) throw err;            
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
        that.lame.write(chunk);
      }).on('finish', function () {      
        setTimeout(function(){
          that.skip();  
        }, 100);      
      });;
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
    };

    this.removeTrackUri = function(uri){
        var index = this.tracksUris.indexOf(uri);
        if (index > -1) {
            this.tracksUris.splice(index, 1);
        }
    };

    this.getQueue = function(){
        return this.tracksUris;
    };

    this.next = function(){
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
SpotifyPlayer.startPlayLoop();

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


var server = app.listen(8080, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Example app listening at http://%s:%s', host, port);
});

/*
Spotify.login(username, password, function (err, spotify) {
  if (err) throw err;

  // first get a "Track" instance from the track URI
  spotify.get(uri, function (err, track) {
    if (err) throw err;
    console.log('Playing: %s - %s', track.artist[0].name, track.name);

    // play() returns a readable stream of MP3 audio data
    track.play()
      .pipe(new lame.Decoder())
      .pipe(new Speaker())
      .on('finish', function () {
        spotify.disconnect();
      });
  });

});
*/
