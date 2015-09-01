var request = require('request');
var cheerio = require('cheerio');


function searchLyric(query, resolve, reject) {
  resolve = resolve || function(){}
  reject = reject || function(){}
  
  request({
    url: 'https://ajax.googleapis.com/ajax/services/search/web?v=1.0&q=site:azlyrics.com ' + query    
  }, function (error, response, body){
      if (error || response.statusCode != 200){ reject(error) }      
      request({
        url: JSON.parse(response.body).responseData.results[0].url
      }, function (error, response, body){
        debugger;
        if (error || response.statusCode != 200){ reject(error) }
        var $ = cheerio.load(body);
        resolve($(".ringtone ++++ div").text());
      });
  });
}

module.exports = searchLyric;