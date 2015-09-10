var gulp = require('gulp');
var less = require('gulp-less');
var path = require('path');
var sourcemaps = require('gulp-sourcemaps');
var lessDependents = require('gulp-less-dependents');
var watch = require('gulp-watch');

var baseLess = "./less";
var baseCss = "./css";

baseLess+'/**/*.less'


gulp.task('less', function () {
  return gulp
    .src([
        "./less/style.less"
    ])
    .pipe(sourcemaps.init())
    .pipe(less())
    .pipe(sourcemaps.write('./maps'))
    .pipe(gulp.dest(baseCss));
});


gulp.task('watch', function () {    
    gulp.watch(baseLess+'/**/*.less', ['less']);
});

gulp.task('default', ['less'], function() { });
