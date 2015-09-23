PlayerApp.controller('InitController', ['$scope', 'PlayerApi', 'PubSub', 'SocketApi', function() { console.log("Starting App") }]);

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

        PlayerApi.getQueueTracks().then(function(response){
            $timeout(function () {
                $scope.tracks = response.tracks;
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
    }]
);