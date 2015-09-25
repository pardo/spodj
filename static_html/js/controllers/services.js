PlayerApp.factory('Utils', function() {
    var debounce = function (func, wait, immediate) {
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
    var throttle = function (func, wait, options) {
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

    return {
        debounce: debounce,
        throttle: throttle
    }
});

PlayerApp.factory('PubSub', function () {
    console.log("--PubSub--");

    //https://github.com/tjlav5/angular-pubsub
    var idCounter = 0;
    var uniqueId = function(prefix) {
        var id = ++idCounter + '';
        return prefix ? prefix + id : id;
    };

    var PubSub = function (config) {
        config = config || {};
        this.evCache = {};
        this.cbCache = {};
        this.debug = config.debug || false;
    };

    PubSub.prototype.publish = function(eventName, data) {
        if (this.debug) { console.log('PUBLISH', eventName, data); }

        this.evCache[eventName] = this.evCache[eventName] || {
                cache: undefined,
                uids: []
            };

        this.evCache[eventName].uids.map(function (uid) {
            this.cbCache[uid].fn(data, this.evCache[eventName].cache)
        }.bind(this));

        this.evCache[eventName].cache = data;
    };

    PubSub.prototype.subscribe = function(eventName, callback) {
        if (this.debug) { console.log('SUBSCRIBE', eventName, callback); }

        if (!(eventName && callback)) {
            throw new Error();
        }

        var uid = uniqueId(eventName);

        this.evCache[eventName] = this.evCache[eventName] || {
                cache: undefined,
                uids: []
            };
        this.evCache[eventName].uids.push(uid);
        this.cbCache[uid] = {fn: callback, eventName: eventName};

        return uid;

    };

    PubSub.prototype.unsubscribe = function(uid) {
        if (this.debug) { console.log('UNSUBSCRIBE', uid); }

        if (!uid) {
            throw new Error();
        }

        var eventName = this.cbCache[uid] && this.cbCache[uid].eventName;

        this.evCache[eventName].uids = this.evCache[eventName].uids.filter(function (_uid) {
            return _uid !== uid;
        });
        delete this.cbCache[uid];
    };

    PubSub.prototype.getCache = function(eventName) {
        if (this.debug) { console.log('GETCACHE', eventName); }

        if (!eventName) {
            throw new Error();
        }
        return this.evCache[eventName] && this.evCache[eventName].cache;
    };

    return new PubSub();
});


PlayerApp.factory('PlayerApi', ['PubSub', function (PubSub) {
    console.log("--PlayerApp--");

    var Playlist = function(doc){
        if (doc != undefined) {
            this.setDoc(doc);
        } else {
            this.name = "";
            this.tracks = [];
        }
    };

    Playlist.prototype.setDoc = function(doc) {
        this._id = doc._id;
        this.name = doc.name;
        this.tracks = doc.tracks;
    };


    Playlist.prototype.getDoc = function() {
        return {
            name: this.name,
            tracks: this.tracks
        }
    };

    Playlist.prototype.play = function() {
        $.ajax({ url: "/playlist/"+this._id+"/play/", type: "post" });
    };

    Playlist.prototype.save = function() {
        var url = "/playlist/";
        if (this._id !== undefined) {
            url += this._id+"/";
        }
        var p = $.ajax({ url: url, type: "post", data: this.getDoc() });
        p.done(function(doc){
            this.setDoc(doc);
        }.bind(this));
        return p
    };

    Playlist.prototype.addTrack = function(uri) {
        if (this._id === undefined) {
            this.save().done(function(){
                this.addTrack(uri);
            }.bind(this));
        }
        var p = $.ajax({
            url: "/playlist/"+this._id+"/add/",
            type: "post",
            data: { track: uri }
        });
        p.done(function(doc){
            this.setDoc(doc);
        }.bind(this));
        return p
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

    var SpotifyApi = function () {
    };

    SpotifyApi.prototype.uriToId = function (uri) {
        return uri.split(":")[2];
    };



    SpotifyApi.prototype.getAlbum = function (id) {
        return $.ajax({
            url: "https://api.spotify.com/v1/albums/" + id
        });
    };

    SpotifyApi.prototype.getAlbumTracks = function (id) {
        return $.ajax({
            url: "https://api.spotify.com/v1/albums/" + id + "/tracks",
            data: {
                "ids": ids.join(",")
            }
        });
    };

    SpotifyApi.prototype.getTracks = function (ids) {
        /*
         returns promised
         [tracks]
         */
        //batch load tracks
        var deferred;

        if (ids == null || ids.length == 0) {
            deferred = $.Deferred();
            deferred.reject();
            return deferred;
        }

        var idsSlice = ids.splice(0, 20);
        var promises = [];
        var tracks = [];

        while (idsSlice.length > 0) {
            promises.push($.ajax({
                url: "https://api.spotify.com/v1/tracks",
                data: {
                    "ids": idsSlice.join(",")
                }
            }));
            idsSlice = ids.splice(0, 20);
        }

        deferred = $.Deferred();

        if (promises.length == 1) {
            promises[0].done(function (response) {
                deferred.resolve(response.tracks);
            });
            return deferred;
        }

        $.when.apply($, promises).done(function () {
            for (var i = 0; i < arguments.length; i++) {
                tracks.push.apply(tracks, arguments[i][0].tracks);
            }
            deferred.resolve(tracks);
        });

        return deferred
    };

    SpotifyApi.prototype.getArtist = function (artistId) {
        return $.ajax({
            url: "https://api.spotify.com/v1/artists/" + artistId
        });
    };

    SpotifyApi.prototype.getArtistAlbums = function (artistId, offset) {
        offset = offset || 0;
        return $.ajax({
            url: "https://api.spotify.com/v1/artists/" + artistId + "/albums",
            data: {
                "album_type": "album,compilation",
                "limit": "50",
                "market": "AR",
                "offset": offset
            }
        });
    };

    SpotifyApi.prototype.getAlbums = function (ids) {
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

    SpotifyApi.prototype.getArtistAndAlbums = function (artistId) {
        var d = $.Deferred();
        $.when(
            this.getArtist(artistId),
            this.getArtistAlbums(artistId)
        ).done(function (artist, albums) {
                //artist and albums contains all the args from the deferred callback > [0]
                this.getAlbums(albums[0].items.map(function (d) {
                    return d.id
                })).done(function (response) {
                    d.resolve(artist[0], response);
                });
            }.bind(this));
        return d;
    };

    SpotifyApi.prototype.apiSearch = function (query, offset) {
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

    SpotifyApi.prototype.apiSearchExpanded = function (query) {
        var deferred = $.Deferred();

        this.apiSearch(query).then(function(response){
            response.albums.items = response.albums.items.filter(function(d){
                return d.available_markets.indexOf("AR") != -1;
            });
            response.tracks.items = response.tracks.items.filter(function(d){
                return d.available_markets.indexOf("AR") != -1;
            });

            deferred.resolve({
                albums: response.albums,
                artists: response.artists,
                tracks: response.tracks
            });

        }, deferred.reject);

        return deferred;
    };

    SpotifyApi = new SpotifyApi();

    return new function PlayerApi() {
        var that = this;
        this.Playlist = Playlist;
        this.SpotifyApi = SpotifyApi;

        this.cachedQueueTracks = null;
        this.cachedCurrentTrack = null;
        this.cachedCurrentTrackUri = null;

        PubSub.subscribe("player.time", function (data, old_data) {
            if (!that.cachedCurrentTrack) { that.getCurrentTrack(true); return }
            if (that.cachedCurrentTrack.uri != data.uri) {
                that.getCurrentTrack(true); return
            }
            that.cachedCurrentTrack.timePlayed = data.timePlayed;
            that.cachedCurrentTrack.timePlayedPercentage = parseInt(data.timePlayed*100/that.cachedCurrentTrack.duration_ms);
            PubSub.publish('PlayerApi.currentTrack.timePlayed', that.cachedCurrentTrack);
        });

        //data.timePlayed

        this.changedCurrentTrack = function () {
            PubSub.publish('PlayerApi.currentTrack', this.cachedCurrentTrack);
        };

        this.changedQueue = function () {
            PubSub.publish('PlayerApi.queue', this.cachedQueueTracks);
        };

        this.getCurrentTrack = function (refreshCache) {
            //prevent multiple calls to the server but allow multiple responses
            if (this.getCurrentTrack_loading) { return this.getCurrentTrack_loading }

            var deferred = $.Deferred();

            if (refreshCache || !this.cachedCurrentTrack) {
                this.getCurrentTrack_loading = deferred;
                deferred.always(function () {
                    this.getCurrentTrack_loading = false;
                }.bind(this));

                $.ajax({
                    url: "/track/"
                }).done(function (data) {
                    if (!data.uri) {
                        deferred.reject();
                    } else {
                        this.cachedCurrentTrackUri = data.uri;
                        SpotifyApi.getTracks([SpotifyApi.uriToId(data.uri)]).then(function (tracks) {
                            this.cachedCurrentTrack = tracks[0];
                            this.cachedCurrentTrack.timePlayed = 0;
                            this.cachedCurrentTrack.timePlayedPercentage = 0;
                            deferred.resolve(tracks[0]);
                            this.changedCurrentTrack();
                        }.bind(this), deferred.reject);
                    }
                }.bind(this));
            } else {
                deferred.resolve(this.cachedCurrentTrack);
            }
            return deferred;
        };

        this.queueAlbumUri = function (uri) {
            SpotifyApi.getAlbum(SpotifyApi.uriToId(uri)).done(function (album) {
                for (var i = 0; i < album.tracks.items.length; i++) {
                    this.queueTrackUri(album.tracks.items[i].uri);
                }
            }.bind(this));
        };

        this.queueTrackUri = function (uri) {
            $.ajax({
                url: "/queue/",
                type: "post",
                data: {
                    uri: uri
                }
            });
        };

        this.unqueueTrackUri = function (uri) {
            $.ajax({
                url: "/unqueue/",
                type: "post",
                data: {
                    uri: uri
                }
            });
        };

        this.queueTracksFromPlaylist = function (playlist) {
            for (var i = 0; i < playlist.tracks.length; i++) {
                this.queueTrackUri(playlist.tracks[i]);
            }
        };

        this.getQueue = function () {
            //return uri
            return $.ajax({url: "/queue/", type: "get"});
        };

        this.getQueueTracks = function (refreshCache) {
            console.log("GET QUEUES");
            //prevent multiple calls to the server but allow multiple responses
            if (this.getQueueTracks_loading) { return this.getQueueTracks_loading }

            //return spotify tracks
            var deferred = $.Deferred();

            if (refreshCache || !this.cachedQueueTracks) {
                this.getQueueTracks_loading = deferred;
                deferred.always(function () {
                    this.getQueueTracks_loading = false;
                }.bind(this));

                this.getQueue().done(function (queueTracksUris) {
                    SpotifyApi
                        .getTracks(queueTracksUris.map(SpotifyApi.uriToId))
                        .then(deferred.resolve, deferred.reject);
                });

                deferred.done(function (tracks) {
                    this.cachedQueueTracks = tracks;
                    this.changedQueue();
                }.bind(this));

            } else {
                deferred.resolve(this.cachedQueueTracks);
            }

            return deferred;
        };

        this.saveQueueToPlaylist = function (playlist) {
            this.getQueue().done(function (r) {
                playlist.tracks = r;
                playlist.save();
            });
        };

        this.saveQueueToNewPlaylist = function (name) {
            var d = $.Deferred();
            this.getQueue().done(function (r) {
                var p = new Playlist();
                p.name = name;
                p.tracks = r;
                p.save().then(d.resolve, d.reject);
            });
            return d;
        };

        this.getSuggestion = function (q) {
            return $.ajax({
                url: "/suggestion/",
                data: {
                    search: q
                }
            });
        };

        this.play = function () {
            $.ajax({url: "/resume/", type: "post"});
        };

        this.pause = function () {
            $.ajax({url: "/pause/", type: "post"});
        };

        this.nextTrack = function () {
            $.ajax({url: "/next/", type: "post"});
        };

        this.prevTrack = function () {
            $.ajax({url: "/prev/", type: "post"});
        };

        this.queueChangeTo = function (queuePosition) {
            $.ajax({
                url: "/queue/changeto/",
                type: "post",
                data: {
                    position: queuePosition
                }
            });
        };

        return this
    };
}]);


PlayerApp.factory('SocketApi', ['PubSub', 'PlayerApi', function (PubSub, PlayerApi) {
    console.log("--SocketApi--");
    var socket = io.connect(window.location.origin);

    socket.on('player.play', function (data) {
        PubSub.publish('player.play', data);
        PlayerApi.getCurrentTrack(true);
    });

    socket.on('player.time', function (data) {
        PubSub.publish('player.time', data);
    });

    socket.on('queue.replaced', function(){ PlayerApi.getQueueTracks(true) });
    socket.on('queue.removed', function(){ PlayerApi.getQueueTracks(true) });
    socket.on('queue.added', function(){ PlayerApi.getQueueTracks(true) });
    socket.on('player.pause', function(){
        //that.$pauseBtn.hide();
        //that.$playBtn.show();
    });

    socket.on('player.resume', function(){
        //that.$playBtn.hide();
        //that.$pauseBtn.show();
    });
    return socket;
}]);