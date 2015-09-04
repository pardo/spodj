$(function(){

	var template = nunjucks.configure();
	Filters = {
		msToSec: function(ms){
	  		ms = parseInt(ms/1000);
			return parseInt(ms/60)+":"+(("000"+ms%60).slice(-2));
		},
		albumDate: function(date){
			return date.split("-")[0];
		}
	};

	for ( k in Filters ) {
		template.addFilter(k, Filters[k]);
	}

	PlayerWidget = (function(){
		var that = this;
		this.$el = $(".player-widget");

		this.currentTrack = null;
		this.currentTrackUri = null;
		this.timePlayed = 0;
		this.playerTemplate = $("#player-template").html();

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

		this.syncCurrentTrack = function(){
			var d = $.Deferred();
			$.ajax({
				url: "/track/"
			}).done(function(data){
				if (!data.uri) {
					d.reject();
				} else {
					that.syncCurrentTrackUri(data.uri).then(d.resolve, d.reject);
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

		this.renderPlayer = function(){
			this.$el.html(template.renderString(this.playerTemplate,{
				track: this.currentTrack
			}));
		};

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


        try{
        	io;
        } catch(e){
        	io = null;
        }

        if (io) {
		  	var socket = io.connect(window.location.origin);
		  	socket.on('player.play', function (data) {
		  		that.syncCurrentTrackUri(data.uri).done(function(track){
	                that.renderPlayer();
	            });
		  	});

		  	socket.on('player.time', function (data) {
		  		if (!that.currentTrack) { return }
	  			$(".time span").html(Filters.msToSec(data.timePlayed));
                $('.progress .color').css('width', (data.timePlayed*100/that.currentTrack.duration_ms)+'%');	  			
		  	});
        }

        function firstTimeSync(){
        	that.syncCurrentTrack().fail(function(){
				setTimeout(firstTimeSync, 1000);
			}).done(function(track){
                that.renderPlayer();
            });
        }
        firstTimeSync();

		return this;
	})();

});