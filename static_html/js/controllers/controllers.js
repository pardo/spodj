PlayerApp.controller('InitController', ['$scope', 'PlayerApi', 'PubSub', 'SocketApi', function() { console.log("Starting App") }]);

PlayerApp.controller('AppController', [ '$scope', '$timeout', 'PlayerApi', 'PubSub', 'Utils', function ($scope, $timeout, PlayerApi, PubSub, Utils) {
    $scope.$el = $('[ng-controller="AppController"]');

    $scope.currentTrack = null;
    $scope.playlists = [];

    $scope.initAutocomplete = function () {
        var $input = $("#search input");
        var suggestionSource = new Bloodhound({
            datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            rateLimitWait: 400,
            remote: {
                url: '/suggestion/?search=%QUERY',
                wildcard: '%QUERY'
            }
        });

        $input.typeahead(null, {
            source: suggestionSource
        });

        var goSearch = Utils.debounce(function(s){
            if (s.trim().length>0) {
                window.location.hash = "/search/"+encodeURIComponent(s);
            }
        }, 222);

        $input.bind("typeahead:select", function(e, suggestion){
            goSearch(suggestion);
        });

        $input.on("keydown", function(e){
            if (e.which==13) { goSearch($input.val()); }
        });
    };

    $scope.saveQueueToPlaylist = function () {
        var name = prompt("Nombre de la Playlist").trim();
        if (name !="") {
            PlayerApi.saveQueueToNewPlaylist(name).then(function () {
                $scope.refreshPlaylistList();
            });
        }
    };

    $scope.refreshPlaylistList = function () {
        PlayerApi.Playlist.all().then(function (playlists) {
            $scope.playlists = playlists;
            $timeout();
        });
    };

    PlayerApi.getCurrentTrack().then(function(currentTrack){
        $scope.currentTrack = currentTrack;
        $timeout();
    });

    PubSub.subscribe("PlayerApi.currentTrack", function (currentTrack) {
        $scope.currentTrack = currentTrack;
        $timeout();
    });

    PubSub.subscribe("PlayerApi.currentTrack.timePlayed", function (currentTrack) {
        $scope.currentTrack = currentTrack;
        $timeout();
    });

    $scope.refreshPlaylistList();

} ]);



PlayerApp
    .controller('QueueController',
    ['$scope', '$timeout', 'PlayerApi', 'PubSub', function ($scope, $timeout, PlayerApi, PubSub) {
        $scope.tracks = [];
        $scope.currentTrack = null;

        PlayerApi.getCurrentTrack().then(function(currentTrack){
            $timeout(function () {
                $scope.currentTrack = currentTrack;
            });
        });

        PlayerApi.getQueueTracks().then(function(tracks){
            $timeout(function () {
                $scope.tracks = tracks;
            });
        });

        PubSub.subscribe("PlayerApi.currentTrack", function (currentTrack) {
            $timeout(function () {
                $scope.currentTrack = currentTrack;
            });
        });

        PubSub.subscribe("PlayerApi.queue", function (tracks) {
            $timeout(function () {
                $scope.tracks = tracks;
            });
        });

        $scope.removeTrack = function (track) {
            PlayerApi.unqueueTrackUri(track.uri);
        };

        $scope.queueChangeTo = function (position) {
            PlayerApi.queueChangeTo(position);
        };
    }]
);


PlayerApp
    .controller('PlayingNowController',
    ['$scope', '$timeout', 'PlayerApi', 'PubSub', function ($scope, $timeout, PlayerApi, PubSub) {
        $scope.currentTrack = null;

        PlayerApi.getCurrentTrack().then(function(currentTrack){
            $scope.currentTrack = currentTrack;
            $timeout();
        });

        PubSub.subscribe("PlayerApi.currentTrack", function (currentTrack) {
            $scope.currentTrack = currentTrack;
            $timeout();
        });

        PubSub.subscribe("PlayerApi.currentTrack.timePlayed", function (currentTrack) {
            $scope.currentTrack = currentTrack;
            $timeout();
        });

    }]
);


PlayerApp
    .controller('PlaylistViewController',
    ['$scope', '$timeout', '$routeParams', 'PlayerApi', 'PubSub', function ($scope, $timeout, $routeParams, PlayerApi, PubSub) {
        $scope.playlist = null;
        $scope.playlistTracks = [];

        PlayerApi.Playlist.get($routeParams.playlistId).then(function (playlist) {
            $scope.playlist = playlist;
            $scope.playlistTracks = null;

            PlayerApi.SpotifyApi.getTracks($scope.playlist.tracks.map(PlayerApi.SpotifyApi.uriToId)).then(function (tracks) {
                $scope.playlistTracks = tracks;
                $timeout();
            });
        });

        $scope.queuePlaylist = function (playlist) {
            PlayerApi.queueTracksFromPlaylist(playlist);
        };

    }]
);


PlayerApp
    .controller('SearchController',
    ['$scope', '$timeout', '$routeParams', 'PlayerApi', 'PubSub', function ($scope, $timeout, $routeParams, PlayerApi, PubSub) {
        $scope.search = {};


        if ($routeParams.artistId) {
            PlayerApi.SpotifyApi.getArtistAndAlbums($routeParams.artistId).done(function(artist, albums){
                $scope.search = {
                    albums: albums.albums,
                    artist: artist
                };
                $timeout();
            });

        }

        if ($routeParams.albumId) {
            PlayerApi.SpotifyApi.getAlbum($routeParams.albumId).then(function (album) {
                $scope.search.album = album;
                $timeout();
            });
        }

        if ($routeParams.query) {
            PlayerApi.SpotifyApi.apiSearchExpanded($routeParams.query).then(function(search) {
                $scope.search = search;
                $timeout();
            });
        }

        $scope.queueAlbum = function (album) {
            PlayerApi.queueAlbumUri(album.uri);
        };

        $scope.queueTrack = function (track) {
            PlayerApi.queueTrackUri(track.uri);
        };
    }]
);
