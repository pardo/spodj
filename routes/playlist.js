var express = require('express');
var router = express.Router();
var playlists = require("../models.js").playlists;


function findAndReturn(id, res){
  playlists.findOne({ _id: id }, function (err, doc) {
    if (doc) {
      res.send(doc);
    } else {
      res.status(404).send('Not found');
    }
  });
}

router.get('/playlist/', function(req, res){
  playlists.find({}, function(err, data){
    res.send(data);
  });
});

router.get('/playlist/:id/', function(req, res){
  findAndReturn(req.params.id, res);
});

router.post('/playlist/', function(req, res){
    doc = {};
    doc.name = req.body.name;
    doc.tracks = req.body.tracks || [];
    playlists.insert(doc, function (err, doc) {
      res.send(doc);
    });      
});

router.post('/playlist/:id/', function(req, res){
  playlists.findOne({ _id: req.params.id }, function (err, doc) {
    if (doc) {
      doc.name = req.body.name;
      doc.tracks = req.body.tracks || [];
      playlists.update({ _id: req.params.id }, { $set: doc }, function (err, numReplaced) {
        findAndReturn(req.params.id, res);
      });
    } else {
      res.status(404).send('Not found');
    }    
  });
});

router.post('/playlist/:id/add/', function(req, res){
  if (!req.body.track) {
    res.status(404).send('Not found');
  }
  playlists.update({ _id: req.params.id }, { $push: { tracks: req.body.track } }, function (err, numReplaced) {    
    findAndReturn(req.params.id, res);
  });  
});

module.exports = router;