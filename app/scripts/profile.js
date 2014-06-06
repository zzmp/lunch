'use strict';

angular.module('Lunch.profile', ['openfb', 'Lunch.factory.Geo', 'Lunch.factory.requests', 'Lunch.service.matchData'])
.config(function($stateProvider) {
  $stateProvider
  .state('app.profile', {
    url: '/profile',
    views: {
      'menuContent' :{
        templateUrl: 'templates/profile.html',
        controller: 'ProfileCtrl'
      }
    }
  });
})

.controller('ProfileCtrl', function($q, $rootScope, $scope, $ionicSlideBoxDelegate, $window, storedUserData, OpenFB, Geo, localStore, requests, matchData) {
  // Store data in scope
  $scope.userData = storedUserData;

  $scope.getLikes = function() {
    OpenFB.get('/me/likes') 
      .success(function(fbLikeObj){
        // need to keep track of old ids
        var idTrack = {};
        angular.forEach(fbLikeObj.data, function(value){
          //if a new like / id 
         if(!$scope.userData.likes[value.id] && value.name){
            //inform the database if a new id
            //add the new id and like data locally
            $scope.userData.likes[value.id] = value.name;
    
            postLikes(value);
          }
          //track id
          idTrack[value.id] = true;
        });
        //check ids fetched from fb to local ids.  if like stored locally no longer
        //avaiable from fb, inform the db and (then) delete locally
        for(var like in $scope.userData.likes) {
          if(!idTrack[like]){
            console.info('Deleteing like: ' + like + '; no longer in facebook');
            requests.deleteLike(like.id, {'userId': $scope.userData.id});
            delete $scope.userData.likes[like]; // since the like no longer exists
            //inform database using like.id and user.id and like.name ($scope.userData.likes[likeId])
          }
        }
      $rootScope.$emit('userDataChanged', $scope.userData);
      });
  };

  var postLikes = function(like) {
    requests.postLike({
      'userId' : $scope.userData.id,
      'id': like.id,
      'name': like.name
    });
  };

  var postTags = function() {
    angular.forEach($scope.userData.tags, function(value, key){
      if(value){ // only posts if tag is selected
        requests.postTag({
          'userId' : $scope.userData.id,
          'id': key,
          'name': key
        });
      }
    });
  };

  var getPicture = function() {
    OpenFB.get('/me/picture?redirect=0&height=133&type=normal&width=100')//'/me/picture')
    .success(function(data){
      if(data !== $scope.userData.photo_url){
        var image = "<div class='userimage'><img src='" + data.data.url + "'/></div>";
        angular.element(document.querySelector('#userimage')).html(image);
        $scope.userData.photo_url = data.data.url;
        //tell the database the image associated with the user has changed
        postUser();
        $rootScope.$emit('userDataChanged', $scope.userData);
      }
    });
  };

  var getDetails = function() {
    var deferredPost = $q.defer();

    if ($scope.userData.id) {
      deferredPost.resolve();
    } else {
      OpenFB.get('/me')
      .success(function(data){
        angular.extend($scope.userData, data);
        //store updates to data locally
        $rootScope.$emit('userDataChanged', $scope.userData);
        deferredPost.resolve();
      })
      .error(function(err){
        $window.alert('Unable to reach Facebook');
        deferredPost.reject();
      });
    }

    return deferredPost.promise;
  };

  $scope.tagClick = function(e){
    var clickedText = e.toElement.innerText;
    var pressed = $scope.userData.tags[clickedText];
    if(pressed){
      //toggle
      $scope.userData.tags[clickedText] = false;
    } else {
      $scope.userData.tags[clickedText] = true;
    }
    $rootScope.$emit('userDataChanged', $scope.userData);
  };

  var postUser = function(){
    return getDetails().then(function() {
      return requests.postBasicDetails({
        'id' : $scope.userData.id,
        'firstname': $scope.userData.first_name,
        'lastname': $scope.userData.last_name,
        'profileImage': $scope.userData.photo_url
      });
    });
  };

  var postLocation = function(pos) {
    $scope.userData.geolocation = pos.coords;
      OpenFB.checkLogin().then(function(id) {
        requests.postLocation({
          'userId': id,
          'lat': pos.coords.latitude,
          'lng': pos.coords.longitude
        }).then(function(res) {
          console.info('You are in ' + angular.fromJson(res).data.city);
          $scope.userData.location = angular.fromJson(res).data.city;
          $rootScope.$emit('userDataChanged', $scope.userData);
        });
    });
  };

  $scope.$on('$stateChangeSuccess', function(e, state) { // this triggers every time we go to the profile page, may need something else
    postUser().then(function() {
      getPicture();
      $scope.getLikes();

      Geo.getCurrentPosition()
        .then(function(pos) { postLocation(pos); })
        .catch(function(err) { console.error(err); });
    });

  });
});
