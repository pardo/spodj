$(function(){
	AppWidget = (function(){
		var that = this;
		this.$el = $(".app-widget");
		this.$input = this.$el.find("input");
		this.$results = $(".search-results");
		this.$albumResults = $(".album-results");
		this.$searchBtn = $(".start-search");
		this.$refreshQueueBtn = $('[data-resfresh-queue]');
		this.$playerQueue = $('.player-queue');
		
		
		this.uriToId = function(uri){
			return uri.split(":")[2];
		};

		this.getAlbum = function(id){
			return $.ajax({ 
				url: "https://api.spotify.com/v1/albums/"+id
			});
		};

		this.getAlbumTracks = function(id){
			return $.ajax({ 
				url: "https://api.spotify.com/v1/albums/"+id+"/tracks",
				data: {
					"ids": ids.join(",")
				}
			});			
		};

		this.getTracks = function(ids){
			return $.ajax({ 
				url: "https://api.spotify.com/v1/tracks",
				data: {
					"ids": ids.join(",")
				}
			});			
		};

		this.apiSearch = function(query, offset){
			offset = offset || 0;			
			return $.ajax({ 
				url: "https://api.spotify.com/v1/search",
				data: {
					"type": "album,artist,track",
					"limit": "20",
					"offset": offset,
					"q": query
				}
			});			
		};

		this.search = function(query){
			this.apiSearch(query).done(function(response){
				nunjucks.render('templates/search_result.html',
					{
						albums: response.albums,
						artists: response.artists,
						tracks: response.tracks
					},
					function(err, res) {
						if (err) throw err;
						that.$results.html(res);
					}
				);	
			});			
		};

		this.queueAlbumUri = function(uri){
			this.getAlbum(this.uriToId(uri)).done(function(album){				
				for (var i = 0; i < album.tracks.items.length; i++) {
					that.queueTrackUri(album.tracks.items[i].uri);
				}
			});
		};

		this.queueTrackUri = function(uri){
			$.ajax({
				url: "/queue/",
				type: "post",
				data: {
					uri: uri
				}
			});
		};

		this.$el.on("click", '[data-track-uri]', function(){
			that.queueTrackUri($(this).data("track-uri"));
		});
		this.$el.on("click", '[data-album-uri]', function(){
			that.queueAlbumUri($(this).data("album-uri"));
		});

		this.$el.on("click", '[data-album-id]', function(){
			that.getAlbum($(this).data("album-id")).done(function(r){
				nunjucks.render('templates/album.html', {
					album: r
				},
				function(err, res) {
					if (err) throw err;
					that.$albumResults.html(res);
				});
			});			
		});

		this.$refreshQueueBtn.click(function(e){
			e.preventDefault();
			$.ajax({ url: "/queue/", type: "get" }).done(function(r){
				that.getTracks(r.map(that.uriToId)).done(function(tracks){					
					nunjucks.render('templates/queue.html', {
						tracks: tracks.tracks
					},
					function(err, res) {
						if (err) throw err;
						this.$playerQueue.html(res);						
					});
				});				
			});
		});

		this.$searchBtn.click(function(e){
			e.preventDefault();
			that.search(that.$input.val());
		});

		this.$input.on("keydown", function(e){
			if (e.which == 13) {
				e.preventDefault();
				that.search(that.$input.val());
			}
		});

        $("[data-player-pause]").click(function(e){
            e.preventDefault();
            $.ajax({ url: "/pause/", type: "post" });
        });
        $("[data-player-resume]").click(function(e){
            e.preventDefault();
            $.ajax({ url: "/resume/", type: "post" });
        });
        $("[data-player-next]").click(function(e){
            e.preventDefault();
            $.ajax({ url: "/next/", type: "post" });
        });

	  	var socket = io.connect(window.location.origin);
	  	socket.on('player.play', function (data) {
		    AppWidget.getTracks(AppWidget.uriToId(data.uri)).done(function(tracks){
                var track = tracks.tracks[0];
                $(".current").html(track.name +" - "+ track.album.name +" - "+ track.artists[0].name);
            })
	  	});


		return this;
	
	})();

	

});