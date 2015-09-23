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

    return new function () {
        var that = this;

        this.cachedQueueTracks = null;
        this.cachedCurrentTrack = null;
        this.cachedCurrentTrackUri = null;

        PubSub.subscribe("player.time", function (data, old_data) {
            if (!that.cachedCurrentTrack) { that.getCurrentTrack(true); return }
            if (that.cachedCurrentTrack.uri != data.uri) {
                that.getCurrentTrack(true); return
            }
            that.cachedCurrentTrack.timePlayed = data.timePlayed;
            that.cachedCurrentTrack.timePercentage = parseInt(data.timePlayed*100/that.cachedCurrentTrack.duration_ms);
            PubSub.publish('PlayerApi.currentTrack.timePlayed', this.cachedCurrentTrack);
        });

        //data.timePlayed

        this.changedCurrentTrack = function () {
            PubSub.publish('PlayerApi.currentTrack', this.cachedCurrentTrack);
        };

        this.changedQueue = function () {
            PubSub.publish('PlayerApi.queue', this.cachedQueueTracks.tracks);
        };

        this.getCurrentTrack = function (refreshCache) {
            //prevent multiple calls to the server but allow multiple responses
            if (this.getCurrentTrack_loading) { return this.getCurrentTrack_loading }

            var d = $.Deferred();

            if (refreshCache || !that.cachedCurrentTrack) {
                this.getCurrentTrack_loading = d;
                d.always(function () {
                    that.getCurrentTrack_loading = false;
                });
                $.ajax({
                    url: "/track/"
                }).done(function (data) {
                    if (!data.uri) {
                        d.reject();
                    } else {
                        that.cachedCurrentTrackUri = data.uri;
                        that.getTracks([that.uriToId(data.uri)]).then(function (tracks) {
                            that.cachedCurrentTrack = tracks.tracks[0];
                            that.cachedCurrentTrack.timePlayed = 0;
                            that.cachedCurrentTrack.timePercentage = 0;

                            d.resolve(tracks.tracks[0]);
                            that.changedCurrentTrack();
                        }, d.reject);
                    }
                });
            } else {
                d.resolve(that.cachedCurrentTrack);
            }

            return d;
        };

        this.uriToId = function (uri) {
            return uri.split(":")[2];
        };

        this.getAlbum = function (id) {
            return $.ajax({
                url: "https://api.spotify.com/v1/albums/" + id
            });
        };

        this.getAlbumTracks = function (id) {
            return $.ajax({
                url: "https://api.spotify.com/v1/albums/" + id + "/tracks",
                data: {
                    "ids": ids.join(",")
                }
            });
        };

        this.getTracks = function (ids) {
            /*
             returns promised
             response = {
             tracks: []
             };
             */
            //batch load tracks
            var d;
            if (ids == null || ids.length == 0) {
                d = $.Deferred();
                d.reject();
                return d;
            }

            var idsSlice = ids.splice(0, 20);
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
                idsSlice = ids.splice(0, 20);
            }
            d = $.Deferred();
            if (promises.length == 1) {
                return promises[0]
            }
            $.when.apply($, promises).done(function () {
                for (var i = 0; i < arguments.length; i++) {
                    response.tracks.push.apply(response.tracks, arguments[i][0].tracks);
                }
                d.resolve(response);
            });
            return d
        };

        this.getArtist = function (artistId) {
            return $.ajax({
                url: "https://api.spotify.com/v1/artists/" + artistId
            });
        };

        this.getArtistAlbums = function (artistId, offset) {
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

        this.getAlbums = function (ids) {
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

        this.getArtistAndAlbums = function (artistId) {
            var d = $.Deferred();
            $.when(
                this.getArtist(artistId),
                this.getArtistAlbums(artistId)
            ).done(function (artist, albums) {
                    //artist and albums contains all the args from the deferred callback > [0]
                    that.getAlbums(albums[0].items.map(function (d) {
                        return d.id
                    }))
                        .done(function (response) {
                            d.resolve(artist[0], response);
                        });
                });
            return d;
        };

        this.apiSearch = function (query, offset) {
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

        this.queueAlbumUri = function (uri) {
            this.getAlbum(this.uriToId(uri)).done(function (album) {
                for (var i = 0; i < album.tracks.items.length; i++) {
                    that.queueTrackUri(album.tracks.items[i].uri);
                }
            });
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
            console.log("GET QUEUE S");
            //prevent multiple calls to the server but allow multiple responses
            if (this.getQueueTracks_loading) { return this.getQueueTracks_loading }

            //return spotify tracks
            var d = $.Deferred();

            if (refreshCache || !that.cachedQueueTracks) {
                this.getQueueTracks_loading = d;
                d.always(function () {
                    that.getQueueTracks_loading = false;
                });


                this.getQueue().done(function (r) {
                    that.getTracks(r.map(that.uriToId)).then(d.resolve, d.reject);
                });

                d.done(function (tracks) {
                    that.cachedQueueTracks = tracks;
                    that.changedQueue();
                });
            } else {
                d.resolve(that.cachedQueueTracks);
            }

            return d;
        };

        this.saveQueueToPlaylist = function (playlist) {
            this.getQueue().done(function (r) {
                playlist.tracks = r;
                playlist.save();
            });
        };

        this.saveQueueToNewPlaylist = function (name) {
            this.getQueue().done(function (r) {
                var p = new Playlist();
                p.name = name;
                p.tracks = r;
                p.save();
            });
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