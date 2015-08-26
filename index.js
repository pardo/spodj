//Api 
var express = require('express');
var bodyParser = require('body-parser');

var app = express();

app.use(express.static('web'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); 

//Spotify Player
var lame = require('lame');
var Speaker = require('speaker');
var Spotify = require('spotify-web');

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
  this.speakerStream = null;

  this.spotify = Spotify.login(username, password, function (err, spotify) {
    if (err) throw err;
    this.initialized = true;
    console.log("Spotify Initialized");
  });

  this.stopPlayback = function(){
    if (this.spotifyStream) {
      spotifyStream.abort();
      //spotifyStream.pause();
    }
    
    //if (this.speakerStream) { speakerStream.close() }
  };

  this.playTrackUri = function(uri){
    console.log("Querying %s", uri);
    this.spotify.get(uri, function (err, track) {
      if (err) throw err;
      console.log('Playing: %s - %s', track.artist[0].name, track.name);
      // play() returns a readable stream of MP3 audio data
      that.stopPlayback();
      that.spotifyStream = track.play();
      that.speakerStream = that.spotifyStream.pipe(new lame.Decoder()).pipe(new Speaker());
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