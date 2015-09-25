angular.module('PlayerAppFilters', [])
    .filter('msToSec', function() {
        return function (ms) {
            ms = parseInt(ms/1000);
            return parseInt(ms/60)+":"+(("000"+ms%60).slice(-2));
        }
    }).filter('albumDate', function() {
        return function(date){
            return date.split("-")[0];
        }
    });


PlayerApp = angular.module("PlayerApp", ['PlayerAppFilters', 'ngAnimate', 'ngRoute' ]);


PlayerApp.config(['$routeProvider',
    function($routeProvider) {
        $routeProvider.
            when('/playlist/:playlistId', {
                templateUrl: '/templates/partials/playlist-view.html',
                controller: 'PlaylistViewController'
            }).
            when('/artist/:artistId', {
                templateUrl: '/templates/partials/search_artist.html',
                controller: 'SearchController'
            }).
            when('/album/:albumId', {
                templateUrl: '/templates/partials/search_album.html',
                controller: 'SearchController'
            }).
            when('/search/:query', {
                templateUrl: '/templates/partials/search_results.html',
                controller: 'SearchController'
            });
    }]);


/*
 otherwise({
 redirectTo: '/playlist/'
 })
 * */
