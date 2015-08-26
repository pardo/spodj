$(function(){
	SearchWidget = (function(){
		var that = this;
		this.$el = $(".search-widget");
		this.$input = this.$el.find("input");
		this.$results = $(".search-results");
		this.$searchBtn = $(".start-search");
		
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
						tracks: response.tracks,
					},
					function(err, res) {
						that.$results.html(res);
					}
				);	
			});			
		};
		
		this.playTrackUri = function(uri){
			$.ajax({
				url: "/play/",
				type: "post",
				data: {
					uri: uri
				}
			});
		};

		this.$el.on("click", '[data-track-uri]', function(){
			that.playTrackUri($(this).data("track-uri"));
		});

		this.$searchBtn.click(function(e){
			e.preventDefault();
			that.search(that.$input.val());
		});

		
		
		return this;
	})();

	

});