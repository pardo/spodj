function getLyricsFromRawHtml(data){
  var filter = function(){
    // filters all text nodes and some inline elements out
    return this.nodeType === Node.TEXT_NODE || $(this).is('p, br, i, b, strong, em');
  };
  
  // create a div,
  // append .lyricsbox's direct children to it
  // and filter all unnecessary elements out
  // get the html and remove the div.
  return $('<div>').append($(data).find('.lyricbox').contents().filter(filter)).remove().html();
}

function getSongInfoFromRawHtml(data){
  return $(data).find('#WikiaPageHeader h1').text();
}

function getLyrics(title, callback) {
  var lyrics;

  $.ajax({
    url: 'https://ajax.googleapis.com/ajax/services/search/web',
    data: {
      v:'1.0',
      q: 'site:lyrics.wikia.com ' + title + ' -"Page Ranking Information"'
    },
    dataType: 'jsonp',
    type: 'GET',
    success: function(googleData, status){
      try {
      
        // Check if XHR completed succesfully
        if(status !== 'success'){
          throw('Could not connect with Google Search');
        }

        if(googleData.responseData.results.length == 0){
          throw('No results via Google');
        }

        // Grab lyrics wikia song url
        var songURL = googleData.responseData.results[0].unescapedUrl;

        if(!songURL){
          throw('Could not find a song URL');
        }

        $.ajax({
          url: songURL,
          type: 'GET',
          success: function (songData, songStatus) {

            if(songStatus !== 'success'){
              throw('Could not connect with Lyrics Wikia');
            }

            lyrics = getLyricsFromRawHtml(songData);
            
            if(lyrics.length === 0){
              throw('No lyrics found');
            }                        
            
            // Locally track number of songs found
            localStorage['found'] = +localStorage['found']+1;
            
            // Send lyrics back
            callback({
              success: true,
              lyrics: lyrics,
              providerTitle: getSongInfoFromRawHtml(songData),
              showNewPopupNotification: (+localStorage['found'] < 25 && localStorage['showNewPopupNotification'] === 'true' && localStorage['showLyricsType'] !== 'popup')
            });
          }
        });
      } catch(err) {       
        // Error in request
        callback({
          success: false,
          errorMsg: err
        });            
      }
    }
  });
} 
