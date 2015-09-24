$(function(){
    var template = nunjucks.configure('/templates');

    debounce = function (func, wait, immediate) {
        var timeout, args, context, timestamp, result;

        var later = function() {
            var last = Date.now() - timestamp;

            if (last < wait && last >= 0) {
                timeout = setTimeout(later, wait - last);
            } else {
                timeout = null;
                if (!immediate) {
                    result = func.apply(context, args);
                    if (!timeout) context = args = null;
                }
            }
        };

        return function() {
            context = this;
            args = arguments;
            timestamp = Date.now();
            var callNow = immediate && !timeout;
            if (!timeout) timeout = setTimeout(later, wait);
            if (callNow) {
                result = func.apply(context, args);
                context = args = null;
            }

            return result;
        };
    };

    throttle = function (func, wait, options) {
        var context, args, result;
        var timeout = null;
        var previous = 0;
        if (!options) options = {};
        var later = function() {
            previous = options.leading === false ? 0 : Date.now();
            timeout = null;
            result = func.apply(context, args);
            if (!timeout) context = args = null;
        };
        return function() {
            var now = Date.now();
            if (!previous && options.leading === false) previous = now;
            var remaining = wait - (now - previous);
            context = this;
            args = arguments;
            if (remaining <= 0 || remaining > wait) {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                previous = now;
                result = func.apply(context, args);
                if (!timeout) context = args = null;
            } else if (!timeout && options.trailing !== false) {
                timeout = setTimeout(later, remaining);
            }
            return result;
        };
    };

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





    AppWidget = (function(){
        var that = this;
        this.$el = $(".app-widget");
        this.$input = $("#search input");
        this.$searchForm = $("#search form");

        this.$results = $("[search-results-el]");
        this.$albumResults = $("[album-results-el]");
        this.$artistResults = $("[artist-results-el]");

        this.$refreshQueueBtn = $('[data-resfresh-queue]');

        this.$playerQueue = $('[player-queue-el]');
        this.$playerNow = $('[playing-now-el]');

        this.$playBtn = $("[play-btn-el]");
        this.$pauseBtn = $("[pause-btn-el]");

        this.$saveQueueToNewPlaylistEl = $("[save-to-new-playlist-el]");

        this.cachedQueueTracks = [];
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

            var idsSlice = ids.splice(0,20);
            var promises = [];
            var response = {
                tracks: []
            };
            while (idsSlice.length > 0) {
                promises.push($.ajax({
                    url: "https://api.spotify.com/v1/tracks",
                    data: {
                        "ids": idsSlice.join(",")
                    }
                }));
                idsSlice = ids.splice(0,20);
            }
            var d = $.Deferred();
            if (promises.length == 1) { return promises[0] }
            $.when.apply($, promises).done(function(){
                for( var i=0; i < arguments.length; i++) {
                    response.tracks.push.apply(response.tracks, arguments[i][0].tracks);
                }
                d.resolve(response);
            });
            return d

        };

        this.getArtist = function(artistId) {
            return $.ajax({
                url: "https://api.spotify.com/v1/artists/"+artistId
            });
        };

        this.getArtistAlbums = function(artistId, offset) {
            offset = offset || 0;
            return $.ajax({
                url: "https://api.spotify.com/v1/artists/"+artistId+"/albums",
                data: {
                    "album_type": "album,compilation",
                    "limit": "50",
                    "market": "AR",
                    "offset": offset
                }
            });
        };

        this.getAlbums = function(ids) {
            if (ids == null || ids.length == 0) {
                var d = $.Deferred();
                d.reject();
                return d;
            }

            return $.ajax({
                url: "https://api.spotify.com/v1/albums",
                data: {
                    "ids": ids.join(","),
                    "market": "AR"
                }
            });
        };

        this.getArtistAndAlbums = function(artistId) {
            var d = $.Deferred();
            $.when(
                this.getArtist(artistId),
                this.getArtistAlbums(artistId)
            ).done(function(artist, albums){
                    //artist and albums contains all the args from the deferred callback > [0]
                    that.getAlbums(albums[0].items.map(function(d){ return d.id }))
                        .done(function(response){
                            d.resolve(artist[0], response);
                        });
                });
            return d;
        };

        this.apiSearch = function(query, offset) {
            offset = offset || 0;
            return $.ajax({
                url: "https://api.spotify.com/v1/search",
                data: {
                    "type": "album,artist,track",
                    "limit": "20",
                    "market": "AR",
                    "offset": offset,
                    "q": query
                }
            });
        };

        this.hideMainContent = function() {
            this.$results.hide();
            this.$artistResults.hide();
            this.$albumResults.hide();
        };

        this.search = function(query){
            this.apiSearch(query).done(function(response){
                response.albums.items = response.albums.items.filter(function(d){
                    return d.available_markets.indexOf("AR") != -1;
                });
                response.tracks.items = response.tracks.items.filter(function(d){
                    return d.available_markets.indexOf("AR") != -1;
                });

                template.render('search_results.html',
                    {
                        albums: response.albums,
                        artists: response.artists,
                        tracks: response.tracks
                    },
                    function(err, res) {
                        if (err) throw err;
                        that.$results.html(res);
                        that.hideMainContent();
                        that.$results.show();
                    }
                );
            });
        };

        this.showArtist = function(artistId) {
            this.getArtistAndAlbums(artistId).done(function(artist, albums){
                template.render('search_artist.html', {
                        albums: albums.albums,
                        artist: artist
                    },
                    function(err, res) {
                        if (err) throw err;
                        that.$artistResults.html(res);
                        that.hideMainContent();
                        that.$artistResults.show();
                    });
            });
        };

        this.showAlbum = function(albumId) {
            this.getAlbum(albumId).done(function(r){
                template.render('search_album.html', {
                        album: r
                    },
                    function(err, res) {
                        if (err) throw err;
                        that.$albumResults.html(res);
                        that.hideMainContent();
                        that.$albumResults.show();
                    });
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

        this.unqueueTrackUri = function(uri){
            $.ajax({
                url: "/unqueue/",
                type: "post",
                data: {
                    uri: uri
                }
            });
        };

        this.queueTracksFromPlaylist = function(playlist){
            for (var i = 0; i < playlist.tracks.length; i++) {
                this.queueTrackUri(playlist.tracks[i]);
            };
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
                that.cachedQueueTracks = tracks.tracks;
                that.renderQueue();
            });
        };

        this.renderQueue = function(){
            template.render('queue.html', {
                    tracks: this.cachedQueueTracks,
                    currentTrack: this.currentTrack
                },
                function(err, res) {
                    if (err) throw err;
                    this.$playerQueue.html(res);
                });
        };

        this.renderPlayingNow = function(){


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


        this.getSuggestion = function(q){
            return $.ajax({
                url: "/suggestion/",
                data: {
                    search: q
                }
            });
        };


        this.$el.on("click", '[data-track-uri]', function(){
            that.queueTrackUri($(this).data("track-uri"));
        });

        this.$el.on("click", '[data-album-uri]', function(){
            that.queueAlbumUri($(this).data("album-uri"));
        });

        this.$el.on("click", '[data-album-id]', function(e){
            e.preventDefault();
            page("/album/"+$(this).data("album-id"));
        });

        this.$el.on("click", '[data-artist-id]', function(e){
            e.preventDefault();
            page("/artist/"+$(this).data("artist-id"));
        });

        this.$saveQueueToNewPlaylistEl.click(function(e){
            e.preventDefault();
            var name = prompt("Playlist name").trim();
            if (name !="") {
                that.saveQueueToNewPlaylist(name);
            }
        });

        this.$refreshQueueBtn.click(function(e){
            e.preventDefault();
            that.refreshQueue();
        });

        this.$searchForm.submit(function(e){
            e.preventDefault();
            page("/search/"+encodeURIComponent(that.$input.val()));
        });

        this.$pauseBtn.click(function(e){
            e.preventDefault();
            $.ajax({ url: "/pause/", type: "post" });
        });

        this.$playBtn.click(function(e){
            e.preventDefault();
            $.ajax({ url: "/resume/", type: "post" });
        });

        $("[data-player-next]").click(function(e){
            e.preventDefault();
            $.ajax({ url: "/next/", type: "post" });
        });

        $("[data-player-prev]").click(function(e){
            e.preventDefault();
            $.ajax({ url: "/prev/", type: "post" });
        });

        this.$el.on("click", "[play-playlist]", function(e){
            e.preventDefault();
            $.ajax({ url: "/playlist/"+$(this).attr("play-playlist")+"/play/", type: "post" });
        });

        this.$el.on("click", "[data-play-queue-position]", function(e){
            $.ajax({
                url: "/queue/changeto/",
                type: "post",
                data: {
                    position: $(this).data("play-queue-position")
                }
            });
        });

        var suggestionSource = new Bloodhound({
            datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            rateLimitWait: 600,
            remote: {
                url: '/suggestion/?search=%QUERY',
                wildcard: '%QUERY'
            }
        });

        this.$input.typeahead(null, {
            source: suggestionSource
        });

        var goSearch = debounce(function(s){
            if (s.trim().length==0) {
                page("/");
            } else {
                page("/search/"+encodeURIComponent(s));
            }
        }, 222);

        this.$input.bind("typeahead:select", function(e, suggestion){
            goSearch(suggestion);
        });

        this.$input.on("keydown", function(e){
            if (e.which==13) { goSearch(that.$input.val()); }
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
                    that.renderPlayingNow();
                    that.renderQueue();
                })
            });

            socket.on('player.time', function (data) {
                if (!that.currentTrack) { return }
                $('[played-time-el]').css('width', (data.timePlayed*100/that.currentTrack.duration_ms)+'%');
                //data.timePlayed
            });

            socket.on('player.pause', function(){
                that.$pauseBtn.hide();
                that.$playBtn.show();
            });

            socket.on('player.resume', function(){
                that.$playBtn.hide();
                that.$pauseBtn.show();
            });
        }

        // init

        that.$playBtn.hide();
        that.$pauseBtn.show();

        function firstTimeSync(){
            that.syncCurrentTrack().fail(function(){
                setTimeout(firstTimeSync, 1000);
            }).done(function(track){
                that.renderPlayingNow();
            });
        }

        firstTimeSync();

        this.refreshQueue();

        //PATHs
        return this;
    })();

    page('/search/:query', function(context){
        AppWidget.search(context.params.query);
    });

    page('/album/:albumId', function(context){
        AppWidget.showAlbum(context.params.albumId);
    });

    page('/artist/:artistId', function(context){
        AppWidget.showArtist(context.params.artistId);
    });

    page();


});
