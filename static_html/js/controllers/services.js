PlayerApp.factory('player', ['$timeout', function($timeout) {

}]);



PlayerApi = (function() {
    var that = this;

    this.cachedQueueTracks = [];
    this.currentTrack = null;
    this.currentTrackUri = null;

    this.syncCurrentTrack = function () {
        var d = $.Deferred();
        $.ajax({
            url: "/track/"
        }).done(function (data) {
            if (!data.uri) {
                d.reject();
            } else {
                that.syncCurrentTrackUri(data.uri).then(d.resolve, d.reject);
            }
        });
        return d;
    };

    this.syncCurrentTrackUri = function (uri) {
        var d = $.Deferred();
        this.currentTrackUri = uri;
        this.getTracks([this.uriToId(uri)])
            .done(function (tracks) {
                that.currentTrack = tracks.tracks[0];
                d.resolve(that.currentTrack);
            });
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
        //batch load tracks
        if (ids == null || ids.length == 0) {
            var d = $.Deferred();
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
        var d = $.Deferred();
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

    this.getQueueTracks = function () {
        //return spotify tracks
        var d = $.Deferred();
        this.getQueue().done(function (r) {
            that.getTracks(r.map(that.uriToId)).then(d.resolve, d.reject);
        });
        return d;
    };

    this.refreshQueue = function () {
        this.getQueueTracks().done(function (tracks) {
            that.cachedQueueTracks = tracks.tracks;
        });
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

    this.queueChangeTo = function (position) {
        $.ajax({
            url: "/queue/changeto/",
            type: "post",
            data: {
                position: position
            }
        });
    };
})();