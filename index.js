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
//var uri = process.argv[2] || 'spotify:track:6tdp8sdXrXlPV6AZZN2PE8';

// Spotify credentials...
var login = require('./login.js');
var username = login.username;
var password = login.password;




var spotify = Spotify.login(username, password, function (err, spotify) {
  if (err) throw err;
});
var currentTrack = null;


app.get('/api/', function (req, res) {
  res.send('Hello World!');
});


app.post('/play/', function(req, res){
  var uri = req.body.uri;
  spotify.get(uri, function (err, track) {    
    if (err) throw err;
    res.send("OK");
    //if (currentTrack) { currentTrack.abort() }
    
    currentTrack = track;
    console.log('Playing: %s - %s', track.artist[0].name, track.name);
    // play() returns a readable stream of MP3 audio data
    track.play()
      .pipe(new lame.Decoder())
      .pipe(new Speaker());
      //.on('finish', function () {
      //  spotify.disconnect();
      //});
  });
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