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
  this.spotifyStream = null;
  this.throttledStream = null;

  this.BIT_RATE = 160000; // Spotify web standard bit rate
  // Lame decoder & speaker objects
  this.lame = new Lame.Decoder();
  // pipe() returns destination stream
  this.speaker = this.lame.pipe(new Speaker());

  this.spotify = Spotify.login(username, password, function (err, spotify) {
    if (err) throw err;
    this.initialized = true;
    console.log("Spotify Initialized");
  });

  this.pause = function(){
    if (this.throttledStream != null) { this.throttledStream.pause() }
  };

  this.resume = function(){
    if (this.throttledStream != null) { this.throttledStream.resume() }
  };

  this.stop = function(){
    if (this.spotifyStream != null) {
      this.spotifyStream.abort();
      this.spotifyStream.unpipe();
    }
    if (this.throttledStream != null) {
      this.throttledStream.pause();
      this.throttledStream.removeAllListeners("data");
      this.throttledStream.unpipe();
    }
    this.spotifyStream = null;
    this.throttledStream = null;
  };

  this.playTrackUri = function(uri){
    console.log("Querying %s", uri);
    this.spotify.get(uri, function (err, track) {
      if (err) throw err;
      console.log('Playing: %s - %s', track.artist[0].name, track.name);
      // play() returns a readable stream of MP3 audio data
      that.stop();
      that.spotifyStream = track.play();
      that.throttledStream = that.spotifyStream.pipe(new Throttle(that.BIT_RATE/8)); // convert to bytes per second
      // manually write data to the decoder stream,
      // which is a writeable stream
      that.throttledStream.on('data', function (chunk) {
        that.lame.write(chunk);
      });

      //.on('finish', function () {
      //  spotify.disconnect();
      //});

    });
  };

  return this;
})();


app.post('/play/', function(req, res){
  var uri = req.body.uri;
  SpotifyPlayer.playTrackUri(uri);
  res.send("OK");
});

app.post('/pause/', function(req, res){  
  SpotifyPlayer.pause();
  res.send("OK");
});

app.post('/stop/', function(req, res){
  SpotifyPlayer.stop();
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
