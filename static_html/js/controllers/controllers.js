PlayerApp.controller('InitController', ['$scope', 'PlayerApi', 'PubSub', 'SocketApi', function() { console.log("Starting App") }]);

PlayerApp.controller('AppController', [ '$scope', function () {} ]);



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
            $timeout(function () {
                $scope.currentTrack = currentTrack;
            });
        });

        PubSub.subscribe("PlayerApi.currentTrack", function (currentTrack) {
            $timeout(function () {
                $scope.currentTrack = currentTrack;
            });
        });

        PubSub.subscribe("PlayerApi.currentTrack.timePlayed", function (currentTrack) {
            $timeout(function () {
                $scope.currentTrack = currentTrack;
            });
        });

    }]
);


PlayerApp
    .controller('PlaylistController',
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

    }]
);