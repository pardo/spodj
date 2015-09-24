angular.module('PlayerAppFilters', []).filter('msToSec', function() {
    return function (ms) {
        ms = parseInt(ms/1000);
        return parseInt(ms/60)+":"+(("000"+ms%60).slice(-2));
    }
});
PlayerApp = angular.module("PlayerApp", ['PlayerAppFilters', 'ngAnimate', 'ngRoute' ]);



PlayerApp.config(['$routeProvider',
    function($routeProvider) {
        $routeProvider.
            when('/playlist/:playlistId', {
                templateUrl: '/templates/partials/playlist-view.html',
                controller: 'PlaylistController'
            });
    }]);


/*
          otherwise({
                redirectTo: '/playlist/'
            })
* */
