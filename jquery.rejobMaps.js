/*!
 * jquery.rejobMaps.js
 * https://github.com/rejob/jquery-rejob-maps
 * Koji Iwasaki, REJOB Co., Ltd.
 */
(function rejobMaps(global) {
  var $ = global.jQuery;
  var google = global.google;
  var MAP_DATA_KEY = 'rejob_madps_map';
  var store = {};

  function MapMarker(map, position, options_) {
    var options = $.extend({}, {
      position: position,
      map: map._map
    }, options_ || {});

    this.map = map;
    this._marker = new google.maps.Marker(options);
  }
  MapMarker.prototype.on = function on(eventName, callback) {
    var self = this;

    google.maps.event.addListener(self._marker, eventName, function onListener() {
      callback.apply(self.map.target, arguments);
    });

    return self;
  };
  MapMarker.prototype.setInfoWindow = function setInfoWindow(infoWindow) {
    var self = this;

    google.maps.event.addListener(self._marker, 'click', function clickListener() {
      $.each(self.map.infoWindows, function each() {
        if (this._infoWindow !== infoWindow._infoWindow) {
          this._infoWindow.close();
        }
      });

      infoWindow._infoWindow.open(self.map._map, self._marker);
    });
  };
  MapMarker.prototype.setPosition = function setPosition(lat, lng_) {
    var _pos = (lat.lat && lat.lng) ? lat : new google.maps.LatLng(lat, lng_);
    this._marker.setPosition(_pos);
  };
  MapMarker.prototype.getPosition = function getPosition() {
    return this._marker.getPosition();
  };
  MapMarker.prototype.lat = function lat() {
    return this.getPosition().lat();
  };
  MapMarker.prototype.lng = function lng() {
    return this.getPosition().lng();
  };

  function InfoWindow(content, marker, options_) {
    var options = $.extend({}, {
      content: content
    }, options_ || {});

    this._infoWindow = new google.maps.InfoWindow(options);

    if (marker) {
      marker.setInfoWindow(this);
    }
  }

  function Map(target, options_, mapOptions_) {
    var defaults = {
      options: {
        maxZoom: 16,
        autoZoom: true
      },
      map: {
        options: {
          center: new google.maps.LatLng(35.681382, 139.766084),
          zoom: 8,
          mapTypeId: google.maps.MapTypeId.ROADMAP
        }
      }
    };

    this.target = target;
    this.options = $.extend({}, defaults.options, options_ || {});
    this._map = new google.maps.Map(this.target, $.extend({}, defaults.map.options, mapOptions_ || {}));
    this.markers = [];
    this.infoWindows = [];
  }
  Map.prototype.on = function on(eventName, callback) {
    var self = this;

    google.maps.event.addListener(self._map, eventName, function onListener() {
      callback.apply(self.target, arguments);
    });

    return self;
  };
  Map.prototype.addMarker = function addMarker(lat, lng_, options_, autoZoom_) {
    var self = this;
    var _pos;
    var autoZoom = autoZoom_;
    var options = options_;
    var marker;

    if (lat.lat && lat.lng) {
      _pos = lat;
      autoZoom = options_;
      options = lng_;
    } else {
      _pos = new google.maps.LatLng(lat, lng_);
    }

    marker = new MapMarker(self, _pos, options || {});
    self.markers.push(marker);

    autoZoom = typeof autoZoom === 'boolean' ? autoZoom : self.options.autoZoom;
    if (autoZoom) {
      self.fitBounds();
    }

    return marker;
  };
  Map.prototype.fitBounds = function fitBounds() {
    var self = this;
    var _markerBounds = new google.maps.LatLngBounds();
    var listener;

    // マーカーが描画範囲に収まるように調整
    $.each(self.markers, function each() {
      var marker = this;
      _markerBounds.extend(marker.getPosition());
    });

    if (!_markerBounds.isEmpty()) {
      self._map.fitBounds(_markerBounds);
      listener = google.maps.event.addListener(self._map, 'idle', function idleListner() {
        if (self._map.getZoom() > self.options.maxZoom) {
          self._map.setZoom(self.options.maxZoom);
        }

        google.maps.event.removeListener(listener);
      });
    }
  };
  Map.prototype.addInfoWindow = function addInfoWindow(content, marker, options_) {
    var self = this;
    var infoWindow = new InfoWindow(content, marker, options_ || {});

    self.infoWindows.push(infoWindow);
    return infoWindow;
  };

  function geocode(text, callback) {
    if (!store.geocoder) {
      store.geocoder = new google.maps.Geocoder();
    }

    store.geocoder.geocode({address: text}, function listener(results, status) {
      if (status === google.maps.GeocoderStatus.OK) {
        callback(results[0].geometry.location);
      } else {
        callback(false);
      }
    });
  }

  function checkMapsAPI() {
    if (!(google && google.maps)) {
      throw new Error('cannot get google.maps object');
    }

    return true;
  }

  $.rejobMap = function rejobMap(action, text, callback) {
    checkMapsAPI();

    if (action === 'geocode') {
      geocode(text, callback);
    }
  };

  /** @enum {string} */
  store.actions = {
    init: function init(map, options_, mapOptions_) {
      $(this).data(MAP_DATA_KEY, new Map(this, options_, mapOptions_));
    },
    getMap: function getMap(map) {
      return map;
    },
    fitBounds: function fitBounds(map) {
      return map.fitBounds();
    },
    addMarker: function addMarker(map, lat, lng, options_, autoZoom_) {
      return map.addMarker(lat, lng, options_, autoZoom_);
    },
    addInfoWindow: function addInfoWindow(map, content, marker, options_) {
      return map.addInfoWindow(content, marker, options_);
    }
  };

  $.fn.rejobMap = function rejobMap(action) {
    var result = this;
    var params = Array.prototype.slice.call(arguments);

    params.shift();

    checkMapsAPI();

    if (!action) {
      throw new Error('param action is required');
    }

    this.each(function each() {
      var map = $(this).data(MAP_DATA_KEY);
      var tempResult;

      if (!store.actions[action]) {
        throw new Error('action not found: ' + action);
      }

      tempResult = store.actions[action].apply(this, [map].concat(params || []));
      if (tempResult) {
        result = tempResult;
        return false;
      }
    });

    return result;
  };

  $(function initialize() {
    // initializer
    $('[data-rejob-map]').each(function eachMap() {
      var $map = $(this);
      var $points = $map.find('[data-lat][data-lng]');

      $map.rejobMap('init', {
        autoZoom: !$map.is('[data-rejob-map-auto-zoom-disable]')
      });

      $points.each(function eachPoint() {
        var $item = $(this);
        var marker = $map.rejobMap('addMarker', $item.data('lat'), $item.data('lng'));
        $map.rejobMap('addInfoWindow', $item.html(), marker);
      });
    });
  });
})((this || 0).self || global);
