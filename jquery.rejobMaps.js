(function($, win) {
  var initialized = false;
  var doc = win.document;
  var MAP_DATA_KEY = 'rejob_madps_map';

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
  Map.prototype.on = function (eventName, callback) {
    var self = this;

    google.maps.event.addListener(self._map, eventName, function(e) {
      callback.apply(self.target, arguments);
    });

    return self;
  };
  Map.prototype.addMarker = function (lat, lng_, options_, autoZoom_) {
    var self = this;
    var _pos;

    if (lat.lat && lat.lng) {
      _pos = lat;
      autoZoom_ = options_;
      options_ = lng_;
    } else {
      _pos = new google.maps.LatLng(lat, lng_);
    }

    var marker = new MapMarker(self, _pos, options_ || {});
    self.markers.push(marker);

    var autoZoom = typeof autoZoom_ === 'boolean' ? autoZoom_ : self.options.autoZoom;
    if (autoZoom) {
      self.fitBounds();
    }

    return marker;
  };
  Map.prototype.fitBounds = function() {
    var self = this;
    var _markerBounds = new google.maps.LatLngBounds();

    // マーカーが描画範囲に収まるように調整
    $.each(self.markers, function() {
      var marker = this;
      _markerBounds.extend(marker.getPosition());
    });

    if (!_markerBounds.isEmpty()) {
      self._map.fitBounds(_markerBounds);
      var listener = google.maps.event.addListener(self._map, 'idle', function() {
        if (self._map.getZoom() > self.options.maxZoom) {
          self._map.setZoom(self.options.maxZoom);
        }

        google.maps.event.removeListener(listener);
      });
    }
  };
  Map.prototype.addInfoWindow = function (content, marker, options_) {
    var self = this;
    var infoWindow = new InfoWindow(content, marker, options_ || {});

    self.infoWindows.push(infoWindow);
    return infoWindow;
  };

  function MapMarker(map, position, options_) {
    var options = $.extend({}, {
      position: position,
      map: map._map
    }, options_ || {});

    this.map = map;
    this._marker = new google.maps.Marker(options);
  };
  MapMarker.prototype.on = function (eventName, callback) {
    var self = this;

    google.maps.event.addListener(self._marker, eventName, function(e) {
      callback.apply(self.map.target, arguments);
    });

    return self;
  };
  MapMarker.prototype.setInfoWindow = function(infoWindow) {
    var self = this;

    google.maps.event.addListener(self._marker, 'click', function() {
      $.each(self.map.infoWindows, function() {
        if (this._infoWindow != infoWindow._infoWindow) {
          this._infoWindow.close();
        }
      });

      infoWindow._infoWindow.open(self.map._map, self._marker);
    });
  };
  MapMarker.prototype.setPosition = function (lat, lng_) {
    var _pos = (lat.lat && lat.lng) ? lat : new google.maps.LatLng(lat, lng_);
    this._marker.setPosition(_pos);
  };
  MapMarker.prototype.getPosition = function() {
    return this._marker.getPosition();
  };
  MapMarker.prototype.lat = function() {
    return this.getPosition().lat();
  };
  MapMarker.prototype.lng = function() {
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

  var geocoder;
  function geocode(text, callback) {
    if (!geocoder) {
      geocoder = new google.maps.Geocoder();
    }

    geocoder.geocode({address: text}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        callback(results[0].geometry.location);
      } else {
        callback(false);
      }
    });
  }

  $.rejobMap = function(action, text, callback) {
    if (action == 'geocode') {
      geocode(text, callback);
    }
  };

  /** @enum {string} */
  var actions = {
    init: function (map, options_, mapOptions_) {
      var $this = $(this);

      map = new Map(this, options_, mapOptions_);
      $this.data(MAP_DATA_KEY, map);
    },
    getMap: function (map) {
      return map;
    },
    fitBounds: function(map) {
      return map.fitBounds();
    },
    addMarker: function (map, lat, lng, options_, autoZoom_) {
      return map.addMarker(lat, lng, options_, autoZoom_);
    },
    addInfoWindow: function (map, content, marker, options_) {
      return map.addInfoWindow(content, marker, options_);
    }

  };

  $.fn.rejobMap = function(action) {
    if (!action) {
      throw new Error('param action is required');
    }

    var params = Array.prototype.slice.call(arguments);
    params.shift();

    var result = this;
    this.each(function() {
      var map = $(this).data(MAP_DATA_KEY);

      if (!actions[action]) {
        throw new Error('action not found: ' + action);
      }

      var tempResult = actions[action].apply(this, [map].concat(params || []));
      if (tempResult) {
        result = tempResult;
        return false;
      }
    });

    return result;
  };

  $(function(){
    // initializer
    $('[data-rejob-map]').each(function() {
      var $map = $(this);
      var $points = $map.find('[data-lat][data-lng]');

      $map.rejobMap('init', {
        autoZoom: !$map.is('[data-rejob-map-auto-zoom-disable]')
      });

      $points.each(function() {
        var $item = $(this);
        var marker = $map.rejobMap('addMarker', $item.data('lat'), $item.data('lng'));
        $map.rejobMap('addInfoWindow', $item.html(), marker);
      });
    });
  });
})(jQuery, this);