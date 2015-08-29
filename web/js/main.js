$(function(){

	var template = nunjucks.configure('/templates');	
	Filters = {
		msToSec: function(ms){  	
	  		ms = parseInt(ms/1000);
			return parseInt(ms/60)+":"+(("000"+ms%60).slice(-2));
		}
	};	
	template.addFilter("msToSec", Filters.msToSec);

	Playlist = function(doc){
		var that = this;

		//for the moment this object duplicates funtions method
		
		this.setDoc = function(doc) {							
			this._id = doc._id;
			this.name = doc.name;
			this.tracks = doc.tracks;			
		};

		this.getDoc = function() {
			return {				
				name: this.name,
				tracks: this.tracks
			}
		};

		this.save = function() {
			var url = "/playlist/"
			if (this._id != undefined) {
				url += this._id+"/";
			}
			var p = $.ajax({ url: url, type: "post", data: this.getDoc() });
			p.done(function(doc){
				that.setDoc(doc);
			});
			return p
		};

		this.addTrack = function(uri) {
			if (this._id == undefined) {
				this.save().done(function(){
					that.addTrack(uri);
				});
			}
			var p = $.ajax({
				url: "/playlist/"+this._id+"/add/",
				type: "post",
				data: { track: uri }
			});
			p.done(function(doc){
				that.setDoc(doc);
			});
			return p
		};

		if (doc != undefined) {
			this.setDoc(doc);
		} else {
			this.name = "";
			this.tracks = [];
		}
		return this;
	};
	
	Playlist.all = function(){
		var d = $.Deferred();
		$.ajax({ url: "/playlist/" }).done(function(r){
			d.resolve(r.map(function(doc){
				var p = new Playlist();
				p.setDoc(doc);
				return p
			}));
		});
		return d
	};

	Playlist.get = function(id){
		var d = $.Deferred();
		$.ajax({
			url: "/playlist/"+id+"/"			
		}).done(function(doc){
			var p = new Playlist();
			p.setDoc(doc);
			d.resolve(p);
		});
		return d
	};	


	AppWidget = (function(){
		var that = this;
		this.$el = $(".app-widget");
		this.$input = this.$el.find("input");
		this.$results = $(".search-results");
		this.$albumResults = $(".album-results");
		this.$searchBtn = $(".start-search");
		this.$refreshQueueBtn = $('[data-resfresh-queue]');
		this.$playerQueue = $('.player-queue');
		

		this.currentTrack = null;
		this.currentTrackUri = null;
		
		this.syncCurrentTrack = function(){
			var d = $.Deferred();			
			$.ajax({
				url: "/track/"
			}).done(function(data){
				if (!data.uri) {
					d.reject();
				} else {
					that.syncCurrentTrackUri(data.uri);	
				}				
			});
			return d;
		};

		this.syncCurrentTrackUri = function(uri){
			var d = $.Deferred();
			this.currentTrackUri = uri;
			this.getTracks([this.uriToId(uri)])
			.done(function(tracks){
    			that.currentTrack = tracks.tracks[0];
				d.resolve(that.currentTrack);
			});
			return d;
		};	

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
			if (ids == null || ids.length == 0) {
				var d = $.Deferred();
				d.reject();
				return d;
			}

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
				response.albums.items = response.albums.items.filter(function(d){
					return d.available_markets.indexOf("AR") != -1;
				});
				response.tracks.items = response.tracks.items.filter(function(d){
					return d.available_markets.indexOf("AR") != -1;
				});

				template.render('search_result.html',
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
		
		this.getQueue = function(){
			return $.ajax({ url: "/queue/", type: "get" })
		};

		this.getQueueTracks = function(){
			var d = $.Deferred();
			this.getQueue().done(function(r){
				that.getTracks(r.map(that.uriToId)).then(d.resolve, d.reject);
			});
			return d;
		};

		this.refreshQueue = function(){
			this.getQueueTracks().done(function(tracks){
				template.render('queue.html', {
					tracks: tracks.tracks
				},
				function(err, res) {
					if (err) throw err;
					this.$playerQueue.html(res);
				});
			});
		};

		this.saveQueueToPlaylist = function(playlist){
			this.getQueue().done(function(r){
				playlist.tracks = r;
				playlist.save();
			});
		};

		this.saveQueueToNewPlaylist = function(name){			
			this.getQueue().done(function(r){
				var p = new Playlist();
				p.name = name;
				p.tracks = r;
				p.save();
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
				template.render('album.html', {
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
			that.refreshQueue();
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
	  		that.syncCurrentTrackUri(data.uri).done(function(track){
                $(".current").html(that.currentTrack.name +" - "+ that.currentTrack.album.name +" - "+ that.currentTrack.artists[0].name +" - "+ Filters.msToSec(that.currentTrack.duration_ms) +" -> 0:00");
            })
	  	});

	  	socket.on('player.time', function (data) {
	  		if (!that.currentTrack) { return }
  			$(".current").html(that.currentTrack.name +" - "+ that.currentTrack.album.name +" - "+ that.currentTrack.artists[0].name +" - "+ Filters.msToSec(that.currentTrack.duration_ms) +" -> "+Filters.msToSec(data.timePlayed));	  		
	  	});

		socket.on('queue.removed', function(){ that.refreshQueue() });
		socket.on('queue.added', function(){ that.refreshQueue() });


		setTimeout(function(){
			that.syncCurrentTrack().fail(function(){
				setTimeout(function(){that.syncCurrentTrack()}, 1000);
			});
		}, 1000);
	  	
		return this;
	})();

	

});