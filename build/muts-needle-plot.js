require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var events = require("backbone-events-standalone");

events.onAll = function(callback,context){
  this.on("all", callback,context);
  return this;
};

// Mixin utility
events.oldMixin = events.mixin;
events.mixin = function(proto) {
  events.oldMixin(proto);
  // add custom onAll
  var exports = ['onAll'];
  for(var i=0; i < exports.length;i++){
    var name = exports[i];
    proto[name] = this[name];
  }
  return proto;
};

module.exports = events;

},{"backbone-events-standalone":3}],2:[function(require,module,exports){
/**
 * Standalone extraction of Backbone.Events, no external dependency required.
 * Degrades nicely when Backone/underscore are already available in the current
 * global context.
 *
 * Note that docs suggest to use underscore's `_.extend()` method to add Events
 * support to some given object. A `mixin()` method has been added to the Events
 * prototype to avoid using underscore for that sole purpose:
 *
 *     var myEventEmitter = BackboneEvents.mixin({});
 *
 * Or for a function constructor:
 *
 *     function MyConstructor(){}
 *     MyConstructor.prototype.foo = function(){}
 *     BackboneEvents.mixin(MyConstructor.prototype);
 *
 * (c) 2009-2013 Jeremy Ashkenas, DocumentCloud Inc.
 * (c) 2013 Nicolas Perriault
 */
/* global exports:true, define, module */
(function() {
  var root = this,
      nativeForEach = Array.prototype.forEach,
      hasOwnProperty = Object.prototype.hasOwnProperty,
      slice = Array.prototype.slice,
      idCounter = 0;

  // Returns a partial implementation matching the minimal API subset required
  // by Backbone.Events
  function miniscore() {
    return {
      keys: Object.keys || function (obj) {
        if (typeof obj !== "object" && typeof obj !== "function" || obj === null) {
          throw new TypeError("keys() called on a non-object");
        }
        var key, keys = [];
        for (key in obj) {
          if (obj.hasOwnProperty(key)) {
            keys[keys.length] = key;
          }
        }
        return keys;
      },

      uniqueId: function(prefix) {
        var id = ++idCounter + '';
        return prefix ? prefix + id : id;
      },

      has: function(obj, key) {
        return hasOwnProperty.call(obj, key);
      },

      each: function(obj, iterator, context) {
        if (obj == null) return;
        if (nativeForEach && obj.forEach === nativeForEach) {
          obj.forEach(iterator, context);
        } else if (obj.length === +obj.length) {
          for (var i = 0, l = obj.length; i < l; i++) {
            iterator.call(context, obj[i], i, obj);
          }
        } else {
          for (var key in obj) {
            if (this.has(obj, key)) {
              iterator.call(context, obj[key], key, obj);
            }
          }
        }
      },

      once: function(func) {
        var ran = false, memo;
        return function() {
          if (ran) return memo;
          ran = true;
          memo = func.apply(this, arguments);
          func = null;
          return memo;
        };
      }
    };
  }

  var _ = miniscore(), Events;

  // Backbone.Events
  // ---------------

  // A module that can be mixed in to *any object* in order to provide it with
  // custom events. You may bind with `on` or remove with `off` callback
  // functions to an event; `trigger`-ing an event fires all callbacks in
  // succession.
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
  Events = {

    // Bind an event to a `callback` function. Passing `"all"` will bind
    // the callback to all events fired.
    on: function(name, callback, context) {
      if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
      this._events || (this._events = {});
      var events = this._events[name] || (this._events[name] = []);
      events.push({callback: callback, context: context, ctx: context || this});
      return this;
    },

    // Bind an event to only be triggered a single time. After the first time
    // the callback is invoked, it will be removed.
    once: function(name, callback, context) {
      if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
      var self = this;
      var once = _.once(function() {
        self.off(name, once);
        callback.apply(this, arguments);
      });
      once._callback = callback;
      return this.on(name, once, context);
    },

    // Remove one or many callbacks. If `context` is null, removes all
    // callbacks with that function. If `callback` is null, removes all
    // callbacks for the event. If `name` is null, removes all bound
    // callbacks for all events.
    off: function(name, callback, context) {
      var retain, ev, events, names, i, l, j, k;
      if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
      if (!name && !callback && !context) {
        this._events = {};
        return this;
      }

      names = name ? [name] : _.keys(this._events);
      for (i = 0, l = names.length; i < l; i++) {
        name = names[i];
        if (events = this._events[name]) {
          this._events[name] = retain = [];
          if (callback || context) {
            for (j = 0, k = events.length; j < k; j++) {
              ev = events[j];
              if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                  (context && context !== ev.context)) {
                retain.push(ev);
              }
            }
          }
          if (!retain.length) delete this._events[name];
        }
      }

      return this;
    },

    // Trigger one or many events, firing all bound callbacks. Callbacks are
    // passed the same arguments as `trigger` is, apart from the event name
    // (unless you're listening on `"all"`, which will cause your callback to
    // receive the true name of the event as the first argument).
    trigger: function(name) {
      if (!this._events) return this;
      var args = slice.call(arguments, 1);
      if (!eventsApi(this, 'trigger', name, args)) return this;
      var events = this._events[name];
      var allEvents = this._events.all;
      if (events) triggerEvents(events, args);
      if (allEvents) triggerEvents(allEvents, arguments);
      return this;
    },

    // Tell this object to stop listening to either specific events ... or
    // to every object it's currently listening to.
    stopListening: function(obj, name, callback) {
      var listeners = this._listeners;
      if (!listeners) return this;
      var deleteListener = !name && !callback;
      if (typeof name === 'object') callback = this;
      if (obj) (listeners = {})[obj._listenerId] = obj;
      for (var id in listeners) {
        listeners[id].off(name, callback, this);
        if (deleteListener) delete this._listeners[id];
      }
      return this;
    }

  };

  // Regular expression used to split event strings.
  var eventSplitter = /\s+/;

  // Implement fancy features of the Events API such as multiple event
  // names `"change blur"` and jQuery-style event maps `{change: action}`
  // in terms of the existing API.
  var eventsApi = function(obj, action, name, rest) {
    if (!name) return true;

    // Handle event maps.
    if (typeof name === 'object') {
      for (var key in name) {
        obj[action].apply(obj, [key, name[key]].concat(rest));
      }
      return false;
    }

    // Handle space separated event names.
    if (eventSplitter.test(name)) {
      var names = name.split(eventSplitter);
      for (var i = 0, l = names.length; i < l; i++) {
        obj[action].apply(obj, [names[i]].concat(rest));
      }
      return false;
    }

    return true;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args);
    }
  };

  var listenMethods = {listenTo: 'on', listenToOnce: 'once'};

  // Inversion-of-control versions of `on` and `once`. Tell *this* object to
  // listen to an event in another object ... keeping track of what it's
  // listening to.
  _.each(listenMethods, function(implementation, method) {
    Events[method] = function(obj, name, callback) {
      var listeners = this._listeners || (this._listeners = {});
      var id = obj._listenerId || (obj._listenerId = _.uniqueId('l'));
      listeners[id] = obj;
      if (typeof name === 'object') callback = this;
      obj[implementation](name, callback, this);
      return this;
    };
  });

  // Aliases for backwards compatibility.
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  // Mixin utility
  Events.mixin = function(proto) {
    var exports = ['on', 'once', 'off', 'trigger', 'stopListening', 'listenTo',
                   'listenToOnce', 'bind', 'unbind'];
    _.each(exports, function(name) {
      proto[name] = this[name];
    }, this);
    return proto;
  };

  // Export Events as BackboneEvents depending on current context
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = Events;
    }
    exports.BackboneEvents = Events;
  }else if (typeof define === "function") {
    define(function() {
      return Events;
    });
  } else {
    root.BackboneEvents = Events;
  }
})(this);

},{}],3:[function(require,module,exports){
module.exports = require('./backbone-events-standalone');

},{"./backbone-events-standalone":2}],4:[function(require,module,exports){
// d3.tip
// Copyright (c) 2013 Justin Palmer
//
// Tooltips for d3.js SVG visualizations

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module with d3 as a dependency.
    define(['d3'], factory)
  } else if (typeof module === 'object' && module.exports) {
    // CommonJS
    module.exports = function(d3) {
      d3.tip = factory(d3)
      return d3.tip
    }
  } else {
    // Browser global.
    root.d3.tip = factory(root.d3)
  }
}(this, function (d3) {

  // Public - contructs a new tooltip
  //
  // Returns a tip
  return function() {
    var direction = d3_tip_direction,
        offset    = d3_tip_offset,
        html      = d3_tip_html,
        node      = initNode(),
        svg       = null,
        point     = null,
        target    = null

    function tip(vis) {
      svg = getSVGNode(vis)
      point = svg.createSVGPoint()
      document.body.appendChild(node)
    }

    // Public - show the tooltip on the screen
    //
    // Returns a tip
    tip.show = function() {
      var args = Array.prototype.slice.call(arguments)
      if(args[args.length - 1] instanceof SVGElement) target = args.pop()

      var content = html.apply(this, args),
          poffset = offset.apply(this, args),
          dir     = direction.apply(this, args),
          nodel   = d3.select(node),
          i       = directions.length,
          coords,
          scrollTop  = document.documentElement.scrollTop || document.body.scrollTop,
          scrollLeft = document.documentElement.scrollLeft || document.body.scrollLeft

      nodel.html(content)
        .style({ opacity: 1, 'pointer-events': 'all' })

      while(i--) nodel.classed(directions[i], false)
      coords = direction_callbacks.get(dir).apply(this)
      nodel.classed(dir, true).style({
        top: (coords.top +  poffset[0]) + scrollTop + 'px',
        left: (coords.left + poffset[1]) + scrollLeft + 'px'
      })

      return tip
    }

    // Public - hide the tooltip
    //
    // Returns a tip
    tip.hide = function() {
      var nodel = d3.select(node)
      nodel.style({ opacity: 0, 'pointer-events': 'none' })
      return tip
    }

    // Public: Proxy attr calls to the d3 tip container.  Sets or gets attribute value.
    //
    // n - name of the attribute
    // v - value of the attribute
    //
    // Returns tip or attribute value
    tip.attr = function(n, v) {
      if (arguments.length < 2 && typeof n === 'string') {
        return d3.select(node).attr(n)
      } else {
        var args =  Array.prototype.slice.call(arguments)
        d3.selection.prototype.attr.apply(d3.select(node), args)
      }

      return tip
    }

    // Public: Proxy style calls to the d3 tip container.  Sets or gets a style value.
    //
    // n - name of the property
    // v - value of the property
    //
    // Returns tip or style property value
    tip.style = function(n, v) {
      if (arguments.length < 2 && typeof n === 'string') {
        return d3.select(node).style(n)
      } else {
        var args =  Array.prototype.slice.call(arguments)
        d3.selection.prototype.style.apply(d3.select(node), args)
      }

      return tip
    }

    // Public: Set or get the direction of the tooltip
    //
    // v - One of n(north), s(south), e(east), or w(west), nw(northwest),
    //     sw(southwest), ne(northeast) or se(southeast)
    //
    // Returns tip or direction
    tip.direction = function(v) {
      if (!arguments.length) return direction
      direction = v == null ? v : d3.functor(v)

      return tip
    }

    // Public: Sets or gets the offset of the tip
    //
    // v - Array of [x, y] offset
    //
    // Returns offset or
    tip.offset = function(v) {
      if (!arguments.length) return offset
      offset = v == null ? v : d3.functor(v)

      return tip
    }

    // Public: sets or gets the html value of the tooltip
    //
    // v - String value of the tip
    //
    // Returns html value or tip
    tip.html = function(v) {
      if (!arguments.length) return html
      html = v == null ? v : d3.functor(v)

      return tip
    }

    function d3_tip_direction() { return 'n' }
    function d3_tip_offset() { return [0, 0] }
    function d3_tip_html() { return ' ' }

    var direction_callbacks = d3.map({
      n:  direction_n,
      s:  direction_s,
      e:  direction_e,
      w:  direction_w,
      nw: direction_nw,
      ne: direction_ne,
      sw: direction_sw,
      se: direction_se
    }),

    directions = direction_callbacks.keys()

    function direction_n() {
      var bbox = getScreenBBox()
      return {
        top:  bbox.n.y - node.offsetHeight,
        left: bbox.n.x - node.offsetWidth / 2
      }
    }

    function direction_s() {
      var bbox = getScreenBBox()
      return {
        top:  bbox.s.y,
        left: bbox.s.x - node.offsetWidth / 2
      }
    }

    function direction_e() {
      var bbox = getScreenBBox()
      return {
        top:  bbox.e.y - node.offsetHeight / 2,
        left: bbox.e.x
      }
    }

    function direction_w() {
      var bbox = getScreenBBox()
      return {
        top:  bbox.w.y - node.offsetHeight / 2,
        left: bbox.w.x - node.offsetWidth
      }
    }

    function direction_nw() {
      var bbox = getScreenBBox()
      return {
        top:  bbox.nw.y - node.offsetHeight,
        left: bbox.nw.x - node.offsetWidth
      }
    }

    function direction_ne() {
      var bbox = getScreenBBox()
      return {
        top:  bbox.ne.y - node.offsetHeight,
        left: bbox.ne.x
      }
    }

    function direction_sw() {
      var bbox = getScreenBBox()
      return {
        top:  bbox.sw.y,
        left: bbox.sw.x - node.offsetWidth
      }
    }

    function direction_se() {
      var bbox = getScreenBBox()
      return {
        top:  bbox.se.y,
        left: bbox.e.x
      }
    }

    function initNode() {
      var node = d3.select(document.createElement('div'))
      node.style({
        position: 'absolute',
        top: 0,
        opacity: 0,
        'pointer-events': 'none',
        'box-sizing': 'border-box'
      })

      return node.node()
    }

    function getSVGNode(el) {
      el = el.node()
      if(el.tagName.toLowerCase() === 'svg')
        return el

      return el.ownerSVGElement
    }

    // Private - gets the screen coordinates of a shape
    //
    // Given a shape on the screen, will return an SVGPoint for the directions
    // n(north), s(south), e(east), w(west), ne(northeast), se(southeast), nw(northwest),
    // sw(southwest).
    //
    //    +-+-+
    //    |   |
    //    +   +
    //    |   |
    //    +-+-+
    //
    // Returns an Object {n, s, e, w, nw, sw, ne, se}
    function getScreenBBox() {
      var targetel   = target || d3.event.target;

      while ('undefined' === typeof targetel.getScreenCTM && 'undefined' === targetel.parentNode) {
          targetel = targetel.parentNode;
      }

      var bbox       = {},
          matrix     = targetel.getScreenCTM(),
          tbbox      = targetel.getBBox(),
          width      = tbbox.width,
          height     = tbbox.height,
          x          = tbbox.x,
          y          = tbbox.y

      point.x = x
      point.y = y
      bbox.nw = point.matrixTransform(matrix)
      point.x += width
      bbox.ne = point.matrixTransform(matrix)
      point.y += height
      bbox.se = point.matrixTransform(matrix)
      point.x -= width
      bbox.sw = point.matrixTransform(matrix)
      point.y -= height / 2
      bbox.w  = point.matrixTransform(matrix)
      point.x += width
      bbox.e = point.matrixTransform(matrix)
      point.x -= width / 2
      point.y -= height / 2
      bbox.n = point.matrixTransform(matrix)
      point.y += height
      bbox.s = point.matrixTransform(matrix)

      return bbox
    }

    return tip
  };

}));

},{}],5:[function(require,module,exports){
/**
 *
 * Mutations Needle Plot (muts-needle-plot)
 *
 * Creates a needle plot (a.k.a stem plot, lollipop-plot and soon also balloon plot ;-)
 * This class uses the npm-require module to load dependencies d3, d3-tip
 *
 * @author Michael P Schroeder
 * @class
 */

//Set the margin of the y axis 
var yborder = -20;
//Allow unique head size
var uniqueHeadSize = true;

function MutsNeedlePlot (config) {

    // INITIALIZATION

    var self = this;        // self = MutsNeedlePlot

    // X-coordinates
    this.maxCoord = config.maxCoord || -1;             // The maximum coord (x-axis)
    if (this.maxCoord < 0) { throw new Error("'maxCoord' must be defined initiation config!"); }
    this.minCoord = config.minCoord || 1;               // The minimum coord (x-axis)

    // data
    mutationData = config.mutationData || -1;          // .json file or dict
    if (this.maxCoord < 0) { throw new Error("'mutationData' must be defined initiation config!"); }
    regionData = config.regionData || -1;              // .json file or dict
    if (this.maxCoord < 0) { throw new Error("'regionData' must be defined initiation config!"); }
    this.totalCategCounts = {};
    this.categCounts = {};
    this.selectedNeedles = [];

    // Plot dimensions & target
    var targetElement = document.getElementById(config.targetElement) || config.targetElement || document.body   // Where to append the plot (svg)

    var width = this.width = config.width || targetElement.offsetWidth || 1000;
    var height = this.height = config.height || targetElement.offsetHeight || 500;

    // Color scale & map
    this.colorMap = config.colorMap || {};              // dict
    var colors = Object.keys(this.colorMap).map(function (key) {
        return self.colorMap[key];
    });
    this.colorScale = d3.scale.category20()
        .domain(Object.keys(this.colorMap))
        .range(colors.concat(d3.scale.category20().range()));
    this.legends = config.legends || {
        "y": "Value",
        "x": "Coordinate"
    };

    this.svgClasses = "mutneedles";
    this.buffer = 0;

    var maxCoord = this.maxCoord;

    var buffer = 0;
    if (width >= height) {
      buffer = height / 8;
    } else {
      buffer = width / 8;
    }

    this.buffer = buffer;

    // IIMPORT AND CONFIGURE TIPS
    var d3tip = require('d3-tip');
    d3tip(d3);


    this.tip = d3.tip()
      .attr('class', 'd3-tip d3-tip-needle')
      .offset([-10, 0])
      .html(function(d) {
        return "<span>" + d.value + " " + d.category +  " at coord. " + d.coordString + "</span>";
      });

    this.selectionTip = d3.tip()
        .attr('class', 'd3-tip d3-tip-selection')
        .offset([-50, 0])
        .html(function(d) {
            return "<span> Selected coordinates<br/>" + Math.round(d.left) + " - " + Math.round(d.right) + "</span>";
        })
        .direction('n');

    // INIT SVG
    var svg;
    var topnode;
    if (config.responsive == 'resize') {
        topnode  = d3.select(targetElement).append("svg")
            .attr("width", '100%')
            .attr("height", '100%')
            .attr('viewBox','0 0 '+Math.min(width)+' '+Math.min(height))
            .attr('class', 'brush');
        svg = topnode
            .append("g")
            .attr("class", this.svgClasses)
            .attr("transform", "translate(0,0)");
    } else  {

        var svg = d3.select(targetElement).append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("class", this.svgClasses + " brush");
        topnode = svg;
    }


    svg.call(this.tip);
    svg.call(this.selectionTip);

    // DEFINE SCALES

    var x = d3.scale.linear()
      .domain([this.minCoord, this.maxCoord])
      .range([buffer * 1.5 , width - buffer])
      .nice();
    this.x = x;

    var y = d3.scale.linear()
      .domain([1,20])
      .range([height - buffer * 1.5, buffer])
      .nice();
    this.y = y;

    // CONFIGURE BRUSH
    self.selector = d3.svg.brush()
        .x(x)
        .on("brush", brushmove)
        .on("brushend", brushend);
    var selector = self.selector;

    var selectionRect = topnode
        .call(selector)
        .selectAll('.extent')
        .attr('height', 50)
        .attr('y', height-50)
        .attr('opacity', 0.2);

    selectionRect.on("mouseenter", function() {
        var selection = selector.extent();
        self.selectionTip.show({left: selection[0], right: selection[1]}, selectionRect.node());
    })
        .on("mouseout", function(){
            d3.select(".d3-tip-selection")
                .transition()
                .delay(3000)
                .duration(1000)
                .style("opacity",0)
                .style('pointer-events', 'none');
        });

    function brushmove() {

        var extent = selector.extent();
        needleHeads = d3.selectAll(".needle-head");
        selectedNeedles = [];
        categCounts = {};
        for (key in Object.keys(self.totalCategCounts)) {
            categCounts[key] = 0;
        }

        needleHeads.classed("selected", function(d) {
            is_brushed = extent[0] <= d.coord && d.coord <= extent[1];
            if (is_brushed) {
                selectedNeedles.push(d);
                categCounts[d.category] = (categCounts[d.category] || 0) + d.value;
            }
            return is_brushed;
        });

        self.trigger('needleSelectionChange', {
        selected : selectedNeedles,
            categCounts: categCounts,
            coords: extent
        });
    }

    function brushend() {
        get_button = d3.select(".clear-button");
        self.trigger('needleSelectionChangeEnd', {
            selected : selectedNeedles,
            categCounts: categCounts,
            coords: selector.extent()
        });
    }

    /// DRAW
    this.drawNeedles(svg, mutationData, regionData);


    self.on("needleSelectionChange", function (edata) {
        self.categCounts = edata.categCounts;
        self.selectedNeedles = edata.selected;
        svg.call(verticalLegend);
    });

    self.on("needleSelectionChangeEnd", function (edata) {
        self.categCounts = edata.categCounts;
        self.selectedNeedles = edata.selected;
        svg.call(verticalLegend);
    });

    self.on("needleSelectionChange", function(edata) {
            selection = edata.coords;
            if (selection[1] - selection[0] > 0) {
                self.selectionTip.show({left: selection[0], right: selection[1]}, selectionRect.node());
                d3.select(".d3-tip-selection")
                    .transition()
                    .delay(3000)
                    .duration(1000)
                    .style("opacity",0)
                    .style('pointer-events', 'none');
            } else {
                self.selectionTip.hide();
            }
        });



}

MutsNeedlePlot.prototype.drawLegend = function(svg) {

    // LEGEND
    self = this;

    // prepare legend categories (correct order)
    mutCategories = [];
    categoryColors = [];
    allcategs = Object.keys(self.totalCategCounts); // random order
    orderedDeclaration = self.colorScale.domain();  // wanted order
    for (idx in orderedDeclaration) {
        c = orderedDeclaration[idx];
        if (allcategs.indexOf(c) > -1) {
            mutCategories.push(c);
            categoryColors.push(self.colorScale(c))
        }
    }

    // create scale with correct order of categories
    mutsScale = self.colorScale.domain(mutCategories).range(categoryColors);


    var domain = self.x.domain();
    xplacement = (self.x(domain[1]) - self.x(domain[0])) * 0.75 + self.x(domain[0]);


    var sum = 0;
    for (var c in self.totalCategCounts) {
        sum += self.totalCategCounts[c];
    }

    legendLabel = function(categ) {
        var count = (self.categCounts[categ] || (self.selectedNeedles.length == 0 && self.totalCategCounts[categ]) || 0);
        return  categ + (count > 0 ? ": "+count+" (" + Math.round(count/sum*100) + "%)" : "");
    };

    legendClass = function(categ) {
        var count = (self.categCounts[categ] || (self.selectedNeedles.length == 0 && self.totalCategCounts[categ]) || 0);
        return (count > 0) ? "" : "nomuts";
    };

    self.noshow = [];
    var needleHeads = d3.selectAll(".needle-head");
    showNoShow = function(categ){
        if (_.contains(self.noshow, categ)) {
            self.noshow = _.filter(self.noshow, function(s) { return s != categ });
        } else {
            self.noshow.push(categ);
        }
        needleHeads.classed("noshow", function(d) {
            return _.contains(self.noshow, d.category);
        });
        var legendCells = d3.selectAll("g.legendCells");
        legendCells.classed("noshow", function(d) {
            return _.contains(self.noshow, d.stop[0]);
        });
    };


    verticalLegend = d3.svg.legend()
        .labelFormat(legendLabel)
        .labelClass(legendClass)
        .onLegendClick(showNoShow)
        .cellPadding(4)
        .orientation("vertical")
        .units(sum + " Mutations")
        .cellWidth(20)
        .cellHeight(12)
        .inputScale(mutsScale)
        .cellStepping(4)
        .place({x: xplacement, y: 50});

    svg.call(verticalLegend);

};

MutsNeedlePlot.prototype.drawRegions = function(svg, regionData) {

    var maxCoord = this.maxCoord;
    var minCoord = this.minCoord;
    var buffer = this.buffer;
    var colors = this.colorMap;
    var y = this.y;
    var x = this.x;

    var below = false;


    getRegionStart = function(region) {
        return parseInt(region.split("-")[0])
    };

    getRegionEnd = function(region) {
        return parseInt(region.split("-")[1])
    };

    getColor = this.colorScale;

    var bg_offset = 0;
    var region_offset = bg_offset-3
    var text_offset = bg_offset + 20;
    if (below != true) {
        text_offset = bg_offset+8;
    }


    function draw(regionList) {

        var regionsBG = d3.select(".mutneedles").selectAll()
            .data(["dummy"]).enter()
            .insert("g", ":first-child")
            .attr("class", "regionsBG")
            .append("rect")
            .attr("x", x(minCoord) )
            .attr("y", y(0) + bg_offset )
            .attr("width", x(maxCoord) - x(minCoord) )
            .attr("height", 18)
            .attr("fill", "lightgrey");


        d3.select(".extent")
            .attr("y", y(0) + region_offset - 10);


        var regions = regionsBG = d3.select(".mutneedles").selectAll()
            .data(regionList)
            .enter()
            .append("g")
            .attr("class", "regionGroup");

        regions.append("rect")
            .attr("x", function (r) {
                return x(r.start);
            })
            .attr("y", y(0) + region_offset )
            .attr("ry", "3")
            .attr("rx", "3")
            .attr("width", function (r) {
                return x(r.end) - x(r.start)
            })
            .attr("height", 24)
            .style("fill", function (data) {
                return data.color
            })
            .style("stroke", function (data) {
                return d3.rgb(data.color).darker()
            });

        regions
            .attr('pointer-events', 'all')
            .attr('cursor', 'pointer')
            .on("click",  function(r) {
            // set custom selection extent
            self.selector.extent([r.start, r.end]);
            // call the extent to change with transition
            self.selector(d3.select(".brush").transition());
            // call extent (selection) change listeners
            self.selector.event(d3.select(".brush").transition().delay(300));

        });

        // Place and label location
        var labels = [];

        var repeatedRegion = {};
        var getRegionClass = function(region) {
            var c = "regionName";
            var repeatedClass = "RR_"+region.name;
            if(_.has(repeatedRegion, region.name)) {
                c = "repeatedName noshow " + repeatedClass;
            }
            repeatedRegion[region.name] = repeatedClass;
            return c;
        };
        regions.append("text")
            .attr("class", getRegionClass)
            .attr("text-anchor", "middle")
            .attr("fill", "black")
            .attr("opacity", 0.5)
            .attr("x", function (r) {
                r.x = x(r.start) + (x(r.end) - x(r.start)) / 2;
                return r.x;
            })
            .attr("y", function(r) {r.y = y(0) + text_offset; return r.y; } )
            .attr("dy", "0.35em")
            .style("font-size", "12px")
            .style("text-decoration", "bold")
            .text(function (data) {
                return data.name
            });

        var regionNames = d3.selectAll(".regionName");
        regionNames.each(function(d, i) {
            var interactionLength = this.getBBox().width / 2;
            labels.push({x: d.x, y: d.y, label: d.name, weight: d.name.length, radius: interactionLength});
        });

        var force = d3.layout.force()
            .chargeDistance(5)
            .nodes(labels)
            .charge(-10)
            .gravity(0);

        var minX = x(minCoord);
        var maxX = x(maxCoord);
        var withinBounds = function(x) {
            return d3.min([
                d3.max([
                    minX,
                    x]),
                maxX
            ]);
        };
        function collide(node) {
            var r = node.radius + 3,
                nx1 = node.x - r,
                nx2 = node.x + r,
                ny1 = node.y - r,
                ny2 = node.y + r;
            return function(quad, x1, y1, x2, y2) {
                if (quad.point && (quad.point !== node)) {
                    var l = node.x - quad.point.x,
                        x = l;
                    r = node.radius + quad.point.radius;
                    if (Math.abs(l) < r) {
                        l = (l - r) / l * .005;
                        x *= l;
                        x =  (node.x > quad.point.x && x < 0) ? -x : x;
                        node.x += x;
                        quad.point.x -= x;
                    }
                }
                return x1 > nx2
                    || x2 < nx1
                    || y1 > ny2
                    || y2 < ny1;
            };
        }
        var moveRepeatedLabels = function(label, x) {
            var name = repeatedRegion[label];
            svg.selectAll("text."+name)
                .attr("x", newx);
        };
        force.on("tick", function(e) {
            var q = d3.geom.quadtree(labels),
                i = 0,
                n = labels.length;
            while (++i < n) {
                q.visit(collide(labels[i]));
            }
            // Update the position of the text element
            var i = 0;
            svg.selectAll("text.regionName")
                .attr("x", function(d) {
                    newx = labels[i++].x;
                    moveRepeatedLabels(d.name, newx);
                    return newx;
                }
            );
        });
        force.start();
    }

    function formatRegions(regions) {
        for (key in Object.keys(regions)) {

            regions[key].start = getRegionStart(regions[key].coord);
            regions[key].end = getRegionEnd(regions[key].coord);
            regions[key].color = getColor(regions[key].name);
            /*regionList.push({
                'name': key,
                'start': getRegionStart(regions[key]),
                'end': getRegionEnd(regions[key]),
                'color': getColor(key)
            });*/
        }
        return regions;
    }

    if (typeof regionData == "string") {
        // assume data is in a file
        d3.json(regionData, function(error, regions) {
            if (error) {return console.debug(error)}
            regionList = formatRegions(regions);
            draw(regionList);
        });
    } else {
        regionList = formatRegions(regionData);
        draw(regionList);
    }

};


MutsNeedlePlot.prototype.drawAxes = function(svg) {

    var y = this.y;
    var x = this.x;

    xAxis = d3.svg.axis().scale(x).orient("bottom");

    svg.append("svg:g")
      .attr("class", "x-axis axis")
      .attr("transform", "translate(0," + (this.height - this.buffer) + ")")
      .call(xAxis);

    yAxis = d3.svg.axis().scale(y).orient("left");


    svg.append("svg:g")
      .attr("class", "y-axis axis")
      //Set height of y-axis a little bit higher 
      .attr("transform", "translate(" + (this.buffer * 1.2 + - 10)  + "," + yborder + ")")
      .call(yAxis);

    // appearance for x and y legend
    d3.selectAll(".axis path")
        .attr('fill', 'none');
    d3.selectAll(".domain")
        .attr('stroke', 'black')
        .attr('stroke-width', 1);

    svg.append("text")
        .attr("class", "y-label")
        .attr("text-anchor", "middle")
        .attr("transform", "translate(" + (this.buffer / 3) + "," + (this.height / 2 + yborder) + "), rotate(-90)")
        .text(this.legends.y)
        .attr('font-weight', 'bold')
        .attr('font-size', 12);

    svg.append("text")
          .attr("class", "x-label")
          .attr("text-anchor", "middle")
          .attr("transform", "translate(" + (this.width / 2) + "," + (this.height - this.buffer / 3) + ")")
          .text(this.legends.x)
        .attr('font-weight', 'bold')
        .attr('font-size', 12);
    
};



MutsNeedlePlot.prototype.drawNeedles = function(svg, mutationData, regionData) {

    var y = this.y;
    var x = this.x;
    var self = this;

    getYAxis = function() {
        return y;
    };

    formatCoord = function(coord) {
       if (coord.indexOf("-") > -1) {
           coords = coord.split("-");

           // place needle at middle of affected region
           coord = Math.floor((parseInt(coords[0]) + parseInt(coords[1])) / 2);

           // check for splice sites: "?-9" or "9-?"
           if (isNaN(coord)) {
               if (coords[0] == "?") { coord = parseInt(coords[1]) }
               else if (coords [1] == "?") { coord = parseInt(coords[0]) }
           }
        } else {
            coord = parseInt(coord);
        }
        return coord;
    };

    tip = this.tip;

    // stack needles at same pos
    needlePoint = {};
    highest = 0;

    stackNeedle = function(pos,value,pointDict) {
      stickHeight = 0;
      pos = "p"+String(pos);
      if (pos in pointDict) {
         stickHeight = pointDict[pos];
         newHeight = stickHeight + value;
         pointDict[pos] = newHeight;
      } else {
         pointDict[pos] = value;
      }
      return stickHeight;
    };

    function formatMutationEntry(d) {

        coordString = d.coord;
        numericCoord = formatCoord(d.coord);
        numericValue = Number(d.value);
        stickHeight = stackNeedle(numericCoord, numericValue, needlePoint);
        category = d.category || "other";

        if (stickHeight + numericValue > highest) {
            // set Y-Axis always to highest available
            highest = stickHeight + numericValue;
            getYAxis().domain([0, highest + 2]);
        }


        if (numericCoord > 0) {

            // record and count categories
            self.totalCategCounts[category] = (self.totalCategCounts[category] || 0) + numericValue;

            return {
                category: category,
                coordString: coordString,
                coord: numericCoord,
                value: numericValue,
                stickHeight: stickHeight,
                color: self.colorScale(category)
            }
        } else {
            console.debug("discarding " + d.coord + " " + d.category + "("+ numericCoord +")");
        }
    }

    var muts = [];


    if (typeof mutationData == "string") {
        d3.json(mutationData, function(error, unformattedMuts) {
            if (error) {
                 throw new Error(error);
            }
            muts = prepareMuts(unformattedMuts);
            paintMuts(muts);
        });
    } else {
        muts = prepareMuts(mutationData);
        paintMuts(muts);
    }

    function prepareMuts(unformattedMuts) {
        for (key in unformattedMuts) {
            formatted = formatMutationEntry(unformattedMuts[key]);
            if (formatted != undefined) {
                muts.push(formatted);
            }
        }
        return muts;
    }


    function paintMuts(muts) {

        minSize = 4;
        maxSize = 10;
        headSizeScale = d3.scale.log().range([minSize,maxSize]).domain([1, highest/2]);
        
        if(!uniqueHeadSize) {
            var headSize = function(n) {
                return d3.min([d3.max([headSizeScale(n),minSize]), maxSize]);
            };
        }else {
            //Unique Head Sizes
            var headSize = function(n) {
                return 5;
            }
        }


        var needles = d3.select(".mutneedles").selectAll()
            .data(muts).enter()
            .append("line")
            .attr("y1", function(data) { return y(data.stickHeight + data.value) + headSize(data.value) + yborder ; } )
            .attr("y2", function(data) { return y(data.stickHeight) })
            .attr("x1", function(data) { return x(data.coord) })
            .attr("x2", function(data) { return x(data.coord) })
            .attr("class", "needle-line")
            .attr("stroke", "black")
            .attr("stroke-width", 1);

        var needleHeads = d3.select(".mutneedles").selectAll()
            .data(muts)
            .enter().append("circle")
            .attr("cy", function(data) { return y(data.stickHeight+data.value) + yborder } )
            .attr("cx", function(data) { return x(data.coord) } )
            .attr("r", function(data) { return headSize(data.value) })
            .attr("class", "needle-head")
            .style("fill", function(data) { return data.color })
            .style("stroke", function(data) {return d3.rgb(data.color).darker()})
            .on('mouseover',  function(d){ d3.select(this).moveToFront(); tip.show(d); })
            .on('mouseout', tip.hide);

        d3.selection.prototype.moveToFront = function() {
            return this.each(function(){
                this.parentNode.appendChild(this);
            });
        };

        // adjust y-scale according to highest value an draw the rest
        if (regionData != undefined) {
            self.drawRegions(svg, regionData);
        }
        self.drawLegend(svg);
        self.drawAxes(svg);

        /* Bring needle heads in front of regions */
        needleHeads.each(function() {
            this.parentNode.appendChild(this);
        });
    }

};



var Events = require('biojs-events');
Events.mixin(MutsNeedlePlot.prototype);

module.exports = MutsNeedlePlot;


},{"biojs-events":1,"d3-tip":4}],"muts-needle-plot":[function(require,module,exports){
module.exports = require("./src/js/MutsNeedlePlot.js");

},{"./src/js/MutsNeedlePlot.js":5}]},{},["muts-needle-plot"])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvRGF2aWQvbXV0cy1uZWVkbGUtcGxvdC9ub2RlX21vZHVsZXMvYmlvanMtZXZlbnRzL2luZGV4LmpzIiwiL1VzZXJzL0RhdmlkL211dHMtbmVlZGxlLXBsb3Qvbm9kZV9tb2R1bGVzL2Jpb2pzLWV2ZW50cy9ub2RlX21vZHVsZXMvYmFja2JvbmUtZXZlbnRzLXN0YW5kYWxvbmUvYmFja2JvbmUtZXZlbnRzLXN0YW5kYWxvbmUuanMiLCIvVXNlcnMvRGF2aWQvbXV0cy1uZWVkbGUtcGxvdC9ub2RlX21vZHVsZXMvYmlvanMtZXZlbnRzL25vZGVfbW9kdWxlcy9iYWNrYm9uZS1ldmVudHMtc3RhbmRhbG9uZS9pbmRleC5qcyIsIi9Vc2Vycy9EYXZpZC9tdXRzLW5lZWRsZS1wbG90L25vZGVfbW9kdWxlcy9kMy10aXAvaW5kZXguanMiLCIvVXNlcnMvRGF2aWQvbXV0cy1uZWVkbGUtcGxvdC9zcmMvanMvTXV0c05lZWRsZVBsb3QuanMiLCIuL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BSQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaFRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3h1QkE7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgZXZlbnRzID0gcmVxdWlyZShcImJhY2tib25lLWV2ZW50cy1zdGFuZGFsb25lXCIpO1xuXG5ldmVudHMub25BbGwgPSBmdW5jdGlvbihjYWxsYmFjayxjb250ZXh0KXtcbiAgdGhpcy5vbihcImFsbFwiLCBjYWxsYmFjayxjb250ZXh0KTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBNaXhpbiB1dGlsaXR5XG5ldmVudHMub2xkTWl4aW4gPSBldmVudHMubWl4aW47XG5ldmVudHMubWl4aW4gPSBmdW5jdGlvbihwcm90bykge1xuICBldmVudHMub2xkTWl4aW4ocHJvdG8pO1xuICAvLyBhZGQgY3VzdG9tIG9uQWxsXG4gIHZhciBleHBvcnRzID0gWydvbkFsbCddO1xuICBmb3IodmFyIGk9MDsgaSA8IGV4cG9ydHMubGVuZ3RoO2krKyl7XG4gICAgdmFyIG5hbWUgPSBleHBvcnRzW2ldO1xuICAgIHByb3RvW25hbWVdID0gdGhpc1tuYW1lXTtcbiAgfVxuICByZXR1cm4gcHJvdG87XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGV2ZW50cztcbiIsIi8qKlxuICogU3RhbmRhbG9uZSBleHRyYWN0aW9uIG9mIEJhY2tib25lLkV2ZW50cywgbm8gZXh0ZXJuYWwgZGVwZW5kZW5jeSByZXF1aXJlZC5cbiAqIERlZ3JhZGVzIG5pY2VseSB3aGVuIEJhY2tvbmUvdW5kZXJzY29yZSBhcmUgYWxyZWFkeSBhdmFpbGFibGUgaW4gdGhlIGN1cnJlbnRcbiAqIGdsb2JhbCBjb250ZXh0LlxuICpcbiAqIE5vdGUgdGhhdCBkb2NzIHN1Z2dlc3QgdG8gdXNlIHVuZGVyc2NvcmUncyBgXy5leHRlbmQoKWAgbWV0aG9kIHRvIGFkZCBFdmVudHNcbiAqIHN1cHBvcnQgdG8gc29tZSBnaXZlbiBvYmplY3QuIEEgYG1peGluKClgIG1ldGhvZCBoYXMgYmVlbiBhZGRlZCB0byB0aGUgRXZlbnRzXG4gKiBwcm90b3R5cGUgdG8gYXZvaWQgdXNpbmcgdW5kZXJzY29yZSBmb3IgdGhhdCBzb2xlIHB1cnBvc2U6XG4gKlxuICogICAgIHZhciBteUV2ZW50RW1pdHRlciA9IEJhY2tib25lRXZlbnRzLm1peGluKHt9KTtcbiAqXG4gKiBPciBmb3IgYSBmdW5jdGlvbiBjb25zdHJ1Y3RvcjpcbiAqXG4gKiAgICAgZnVuY3Rpb24gTXlDb25zdHJ1Y3Rvcigpe31cbiAqICAgICBNeUNvbnN0cnVjdG9yLnByb3RvdHlwZS5mb28gPSBmdW5jdGlvbigpe31cbiAqICAgICBCYWNrYm9uZUV2ZW50cy5taXhpbihNeUNvbnN0cnVjdG9yLnByb3RvdHlwZSk7XG4gKlxuICogKGMpIDIwMDktMjAxMyBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgSW5jLlxuICogKGMpIDIwMTMgTmljb2xhcyBQZXJyaWF1bHRcbiAqL1xuLyogZ2xvYmFsIGV4cG9ydHM6dHJ1ZSwgZGVmaW5lLCBtb2R1bGUgKi9cbihmdW5jdGlvbigpIHtcbiAgdmFyIHJvb3QgPSB0aGlzLFxuICAgICAgbmF0aXZlRm9yRWFjaCA9IEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLFxuICAgICAgaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LFxuICAgICAgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UsXG4gICAgICBpZENvdW50ZXIgPSAwO1xuXG4gIC8vIFJldHVybnMgYSBwYXJ0aWFsIGltcGxlbWVudGF0aW9uIG1hdGNoaW5nIHRoZSBtaW5pbWFsIEFQSSBzdWJzZXQgcmVxdWlyZWRcbiAgLy8gYnkgQmFja2JvbmUuRXZlbnRzXG4gIGZ1bmN0aW9uIG1pbmlzY29yZSgpIHtcbiAgICByZXR1cm4ge1xuICAgICAga2V5czogT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24gKG9iaikge1xuICAgICAgICBpZiAodHlwZW9mIG9iaiAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2Ygb2JqICE9PSBcImZ1bmN0aW9uXCIgfHwgb2JqID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImtleXMoKSBjYWxsZWQgb24gYSBub24tb2JqZWN0XCIpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBrZXksIGtleXMgPSBbXTtcbiAgICAgICAgZm9yIChrZXkgaW4gb2JqKSB7XG4gICAgICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICBrZXlzW2tleXMubGVuZ3RoXSA9IGtleTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGtleXM7XG4gICAgICB9LFxuXG4gICAgICB1bmlxdWVJZDogZnVuY3Rpb24ocHJlZml4KSB7XG4gICAgICAgIHZhciBpZCA9ICsraWRDb3VudGVyICsgJyc7XG4gICAgICAgIHJldHVybiBwcmVmaXggPyBwcmVmaXggKyBpZCA6IGlkO1xuICAgICAgfSxcblxuICAgICAgaGFzOiBmdW5jdGlvbihvYmosIGtleSkge1xuICAgICAgICByZXR1cm4gaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSk7XG4gICAgICB9LFxuXG4gICAgICBlYWNoOiBmdW5jdGlvbihvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuO1xuICAgICAgICBpZiAobmF0aXZlRm9yRWFjaCAmJiBvYmouZm9yRWFjaCA9PT0gbmF0aXZlRm9yRWFjaCkge1xuICAgICAgICAgIG9iai5mb3JFYWNoKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICAgICAgfSBlbHNlIGlmIChvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCkge1xuICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gb2JqLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmpbaV0sIGksIG9iaik7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmhhcyhvYmosIGtleSkpIHtcbiAgICAgICAgICAgICAgaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmpba2V5XSwga2V5LCBvYmopO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgb25jZTogZnVuY3Rpb24oZnVuYykge1xuICAgICAgICB2YXIgcmFuID0gZmFsc2UsIG1lbW87XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAocmFuKSByZXR1cm4gbWVtbztcbiAgICAgICAgICByYW4gPSB0cnVlO1xuICAgICAgICAgIG1lbW8gPSBmdW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgZnVuYyA9IG51bGw7XG4gICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIHZhciBfID0gbWluaXNjb3JlKCksIEV2ZW50cztcblxuICAvLyBCYWNrYm9uZS5FdmVudHNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gQSBtb2R1bGUgdGhhdCBjYW4gYmUgbWl4ZWQgaW4gdG8gKmFueSBvYmplY3QqIGluIG9yZGVyIHRvIHByb3ZpZGUgaXQgd2l0aFxuICAvLyBjdXN0b20gZXZlbnRzLiBZb3UgbWF5IGJpbmQgd2l0aCBgb25gIG9yIHJlbW92ZSB3aXRoIGBvZmZgIGNhbGxiYWNrXG4gIC8vIGZ1bmN0aW9ucyB0byBhbiBldmVudDsgYHRyaWdnZXJgLWluZyBhbiBldmVudCBmaXJlcyBhbGwgY2FsbGJhY2tzIGluXG4gIC8vIHN1Y2Nlc3Npb24uXG4gIC8vXG4gIC8vICAgICB2YXIgb2JqZWN0ID0ge307XG4gIC8vICAgICBfLmV4dGVuZChvYmplY3QsIEJhY2tib25lLkV2ZW50cyk7XG4gIC8vICAgICBvYmplY3Qub24oJ2V4cGFuZCcsIGZ1bmN0aW9uKCl7IGFsZXJ0KCdleHBhbmRlZCcpOyB9KTtcbiAgLy8gICAgIG9iamVjdC50cmlnZ2VyKCdleHBhbmQnKTtcbiAgLy9cbiAgRXZlbnRzID0ge1xuXG4gICAgLy8gQmluZCBhbiBldmVudCB0byBhIGBjYWxsYmFja2AgZnVuY3Rpb24uIFBhc3NpbmcgYFwiYWxsXCJgIHdpbGwgYmluZFxuICAgIC8vIHRoZSBjYWxsYmFjayB0byBhbGwgZXZlbnRzIGZpcmVkLlxuICAgIG9uOiBmdW5jdGlvbihuYW1lLCBjYWxsYmFjaywgY29udGV4dCkge1xuICAgICAgaWYgKCFldmVudHNBcGkodGhpcywgJ29uJywgbmFtZSwgW2NhbGxiYWNrLCBjb250ZXh0XSkgfHwgIWNhbGxiYWNrKSByZXR1cm4gdGhpcztcbiAgICAgIHRoaXMuX2V2ZW50cyB8fCAodGhpcy5fZXZlbnRzID0ge30pO1xuICAgICAgdmFyIGV2ZW50cyA9IHRoaXMuX2V2ZW50c1tuYW1lXSB8fCAodGhpcy5fZXZlbnRzW25hbWVdID0gW10pO1xuICAgICAgZXZlbnRzLnB1c2goe2NhbGxiYWNrOiBjYWxsYmFjaywgY29udGV4dDogY29udGV4dCwgY3R4OiBjb250ZXh0IHx8IHRoaXN9KTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvLyBCaW5kIGFuIGV2ZW50IHRvIG9ubHkgYmUgdHJpZ2dlcmVkIGEgc2luZ2xlIHRpbWUuIEFmdGVyIHRoZSBmaXJzdCB0aW1lXG4gICAgLy8gdGhlIGNhbGxiYWNrIGlzIGludm9rZWQsIGl0IHdpbGwgYmUgcmVtb3ZlZC5cbiAgICBvbmNlOiBmdW5jdGlvbihuYW1lLCBjYWxsYmFjaywgY29udGV4dCkge1xuICAgICAgaWYgKCFldmVudHNBcGkodGhpcywgJ29uY2UnLCBuYW1lLCBbY2FsbGJhY2ssIGNvbnRleHRdKSB8fCAhY2FsbGJhY2spIHJldHVybiB0aGlzO1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgdmFyIG9uY2UgPSBfLm9uY2UoZnVuY3Rpb24oKSB7XG4gICAgICAgIHNlbGYub2ZmKG5hbWUsIG9uY2UpO1xuICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgfSk7XG4gICAgICBvbmNlLl9jYWxsYmFjayA9IGNhbGxiYWNrO1xuICAgICAgcmV0dXJuIHRoaXMub24obmFtZSwgb25jZSwgY29udGV4dCk7XG4gICAgfSxcblxuICAgIC8vIFJlbW92ZSBvbmUgb3IgbWFueSBjYWxsYmFja3MuIElmIGBjb250ZXh0YCBpcyBudWxsLCByZW1vdmVzIGFsbFxuICAgIC8vIGNhbGxiYWNrcyB3aXRoIHRoYXQgZnVuY3Rpb24uIElmIGBjYWxsYmFja2AgaXMgbnVsbCwgcmVtb3ZlcyBhbGxcbiAgICAvLyBjYWxsYmFja3MgZm9yIHRoZSBldmVudC4gSWYgYG5hbWVgIGlzIG51bGwsIHJlbW92ZXMgYWxsIGJvdW5kXG4gICAgLy8gY2FsbGJhY2tzIGZvciBhbGwgZXZlbnRzLlxuICAgIG9mZjogZnVuY3Rpb24obmFtZSwgY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgICAgIHZhciByZXRhaW4sIGV2LCBldmVudHMsIG5hbWVzLCBpLCBsLCBqLCBrO1xuICAgICAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIWV2ZW50c0FwaSh0aGlzLCAnb2ZmJywgbmFtZSwgW2NhbGxiYWNrLCBjb250ZXh0XSkpIHJldHVybiB0aGlzO1xuICAgICAgaWYgKCFuYW1lICYmICFjYWxsYmFjayAmJiAhY29udGV4dCkge1xuICAgICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9XG5cbiAgICAgIG5hbWVzID0gbmFtZSA/IFtuYW1lXSA6IF8ua2V5cyh0aGlzLl9ldmVudHMpO1xuICAgICAgZm9yIChpID0gMCwgbCA9IG5hbWVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICBuYW1lID0gbmFtZXNbaV07XG4gICAgICAgIGlmIChldmVudHMgPSB0aGlzLl9ldmVudHNbbmFtZV0pIHtcbiAgICAgICAgICB0aGlzLl9ldmVudHNbbmFtZV0gPSByZXRhaW4gPSBbXTtcbiAgICAgICAgICBpZiAoY2FsbGJhY2sgfHwgY29udGV4dCkge1xuICAgICAgICAgICAgZm9yIChqID0gMCwgayA9IGV2ZW50cy5sZW5ndGg7IGogPCBrOyBqKyspIHtcbiAgICAgICAgICAgICAgZXYgPSBldmVudHNbal07XG4gICAgICAgICAgICAgIGlmICgoY2FsbGJhY2sgJiYgY2FsbGJhY2sgIT09IGV2LmNhbGxiYWNrICYmIGNhbGxiYWNrICE9PSBldi5jYWxsYmFjay5fY2FsbGJhY2spIHx8XG4gICAgICAgICAgICAgICAgICAoY29udGV4dCAmJiBjb250ZXh0ICE9PSBldi5jb250ZXh0KSkge1xuICAgICAgICAgICAgICAgIHJldGFpbi5wdXNoKGV2KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIXJldGFpbi5sZW5ndGgpIGRlbGV0ZSB0aGlzLl9ldmVudHNbbmFtZV07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8vIFRyaWdnZXIgb25lIG9yIG1hbnkgZXZlbnRzLCBmaXJpbmcgYWxsIGJvdW5kIGNhbGxiYWNrcy4gQ2FsbGJhY2tzIGFyZVxuICAgIC8vIHBhc3NlZCB0aGUgc2FtZSBhcmd1bWVudHMgYXMgYHRyaWdnZXJgIGlzLCBhcGFydCBmcm9tIHRoZSBldmVudCBuYW1lXG4gICAgLy8gKHVubGVzcyB5b3UncmUgbGlzdGVuaW5nIG9uIGBcImFsbFwiYCwgd2hpY2ggd2lsbCBjYXVzZSB5b3VyIGNhbGxiYWNrIHRvXG4gICAgLy8gcmVjZWl2ZSB0aGUgdHJ1ZSBuYW1lIG9mIHRoZSBldmVudCBhcyB0aGUgZmlyc3QgYXJndW1lbnQpLlxuICAgIHRyaWdnZXI6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIGlmICghdGhpcy5fZXZlbnRzKSByZXR1cm4gdGhpcztcbiAgICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgaWYgKCFldmVudHNBcGkodGhpcywgJ3RyaWdnZXInLCBuYW1lLCBhcmdzKSkgcmV0dXJuIHRoaXM7XG4gICAgICB2YXIgZXZlbnRzID0gdGhpcy5fZXZlbnRzW25hbWVdO1xuICAgICAgdmFyIGFsbEV2ZW50cyA9IHRoaXMuX2V2ZW50cy5hbGw7XG4gICAgICBpZiAoZXZlbnRzKSB0cmlnZ2VyRXZlbnRzKGV2ZW50cywgYXJncyk7XG4gICAgICBpZiAoYWxsRXZlbnRzKSB0cmlnZ2VyRXZlbnRzKGFsbEV2ZW50cywgYXJndW1lbnRzKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvLyBUZWxsIHRoaXMgb2JqZWN0IHRvIHN0b3AgbGlzdGVuaW5nIHRvIGVpdGhlciBzcGVjaWZpYyBldmVudHMgLi4uIG9yXG4gICAgLy8gdG8gZXZlcnkgb2JqZWN0IGl0J3MgY3VycmVudGx5IGxpc3RlbmluZyB0by5cbiAgICBzdG9wTGlzdGVuaW5nOiBmdW5jdGlvbihvYmosIG5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xuICAgICAgaWYgKCFsaXN0ZW5lcnMpIHJldHVybiB0aGlzO1xuICAgICAgdmFyIGRlbGV0ZUxpc3RlbmVyID0gIW5hbWUgJiYgIWNhbGxiYWNrO1xuICAgICAgaWYgKHR5cGVvZiBuYW1lID09PSAnb2JqZWN0JykgY2FsbGJhY2sgPSB0aGlzO1xuICAgICAgaWYgKG9iaikgKGxpc3RlbmVycyA9IHt9KVtvYmouX2xpc3RlbmVySWRdID0gb2JqO1xuICAgICAgZm9yICh2YXIgaWQgaW4gbGlzdGVuZXJzKSB7XG4gICAgICAgIGxpc3RlbmVyc1tpZF0ub2ZmKG5hbWUsIGNhbGxiYWNrLCB0aGlzKTtcbiAgICAgICAgaWYgKGRlbGV0ZUxpc3RlbmVyKSBkZWxldGUgdGhpcy5fbGlzdGVuZXJzW2lkXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICB9O1xuXG4gIC8vIFJlZ3VsYXIgZXhwcmVzc2lvbiB1c2VkIHRvIHNwbGl0IGV2ZW50IHN0cmluZ3MuXG4gIHZhciBldmVudFNwbGl0dGVyID0gL1xccysvO1xuXG4gIC8vIEltcGxlbWVudCBmYW5jeSBmZWF0dXJlcyBvZiB0aGUgRXZlbnRzIEFQSSBzdWNoIGFzIG11bHRpcGxlIGV2ZW50XG4gIC8vIG5hbWVzIGBcImNoYW5nZSBibHVyXCJgIGFuZCBqUXVlcnktc3R5bGUgZXZlbnQgbWFwcyBge2NoYW5nZTogYWN0aW9ufWBcbiAgLy8gaW4gdGVybXMgb2YgdGhlIGV4aXN0aW5nIEFQSS5cbiAgdmFyIGV2ZW50c0FwaSA9IGZ1bmN0aW9uKG9iaiwgYWN0aW9uLCBuYW1lLCByZXN0KSB7XG4gICAgaWYgKCFuYW1lKSByZXR1cm4gdHJ1ZTtcblxuICAgIC8vIEhhbmRsZSBldmVudCBtYXBzLlxuICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGZvciAodmFyIGtleSBpbiBuYW1lKSB7XG4gICAgICAgIG9ialthY3Rpb25dLmFwcGx5KG9iaiwgW2tleSwgbmFtZVtrZXldXS5jb25jYXQocmVzdCkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIEhhbmRsZSBzcGFjZSBzZXBhcmF0ZWQgZXZlbnQgbmFtZXMuXG4gICAgaWYgKGV2ZW50U3BsaXR0ZXIudGVzdChuYW1lKSkge1xuICAgICAgdmFyIG5hbWVzID0gbmFtZS5zcGxpdChldmVudFNwbGl0dGVyKTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbmFtZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIG9ialthY3Rpb25dLmFwcGx5KG9iaiwgW25hbWVzW2ldXS5jb25jYXQocmVzdCkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG4gIC8vIEEgZGlmZmljdWx0LXRvLWJlbGlldmUsIGJ1dCBvcHRpbWl6ZWQgaW50ZXJuYWwgZGlzcGF0Y2ggZnVuY3Rpb24gZm9yXG4gIC8vIHRyaWdnZXJpbmcgZXZlbnRzLiBUcmllcyB0byBrZWVwIHRoZSB1c3VhbCBjYXNlcyBzcGVlZHkgKG1vc3QgaW50ZXJuYWxcbiAgLy8gQmFja2JvbmUgZXZlbnRzIGhhdmUgMyBhcmd1bWVudHMpLlxuICB2YXIgdHJpZ2dlckV2ZW50cyA9IGZ1bmN0aW9uKGV2ZW50cywgYXJncykge1xuICAgIHZhciBldiwgaSA9IC0xLCBsID0gZXZlbnRzLmxlbmd0aCwgYTEgPSBhcmdzWzBdLCBhMiA9IGFyZ3NbMV0sIGEzID0gYXJnc1syXTtcbiAgICBzd2l0Y2ggKGFyZ3MubGVuZ3RoKSB7XG4gICAgICBjYXNlIDA6IHdoaWxlICgrK2kgPCBsKSAoZXYgPSBldmVudHNbaV0pLmNhbGxiYWNrLmNhbGwoZXYuY3R4KTsgcmV0dXJuO1xuICAgICAgY2FzZSAxOiB3aGlsZSAoKytpIDwgbCkgKGV2ID0gZXZlbnRzW2ldKS5jYWxsYmFjay5jYWxsKGV2LmN0eCwgYTEpOyByZXR1cm47XG4gICAgICBjYXNlIDI6IHdoaWxlICgrK2kgPCBsKSAoZXYgPSBldmVudHNbaV0pLmNhbGxiYWNrLmNhbGwoZXYuY3R4LCBhMSwgYTIpOyByZXR1cm47XG4gICAgICBjYXNlIDM6IHdoaWxlICgrK2kgPCBsKSAoZXYgPSBldmVudHNbaV0pLmNhbGxiYWNrLmNhbGwoZXYuY3R4LCBhMSwgYTIsIGEzKTsgcmV0dXJuO1xuICAgICAgZGVmYXVsdDogd2hpbGUgKCsraSA8IGwpIChldiA9IGV2ZW50c1tpXSkuY2FsbGJhY2suYXBwbHkoZXYuY3R4LCBhcmdzKTtcbiAgICB9XG4gIH07XG5cbiAgdmFyIGxpc3Rlbk1ldGhvZHMgPSB7bGlzdGVuVG86ICdvbicsIGxpc3RlblRvT25jZTogJ29uY2UnfTtcblxuICAvLyBJbnZlcnNpb24tb2YtY29udHJvbCB2ZXJzaW9ucyBvZiBgb25gIGFuZCBgb25jZWAuIFRlbGwgKnRoaXMqIG9iamVjdCB0b1xuICAvLyBsaXN0ZW4gdG8gYW4gZXZlbnQgaW4gYW5vdGhlciBvYmplY3QgLi4uIGtlZXBpbmcgdHJhY2sgb2Ygd2hhdCBpdCdzXG4gIC8vIGxpc3RlbmluZyB0by5cbiAgXy5lYWNoKGxpc3Rlbk1ldGhvZHMsIGZ1bmN0aW9uKGltcGxlbWVudGF0aW9uLCBtZXRob2QpIHtcbiAgICBFdmVudHNbbWV0aG9kXSA9IGZ1bmN0aW9uKG9iaiwgbmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIHZhciBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnMgfHwgKHRoaXMuX2xpc3RlbmVycyA9IHt9KTtcbiAgICAgIHZhciBpZCA9IG9iai5fbGlzdGVuZXJJZCB8fCAob2JqLl9saXN0ZW5lcklkID0gXy51bmlxdWVJZCgnbCcpKTtcbiAgICAgIGxpc3RlbmVyc1tpZF0gPSBvYmo7XG4gICAgICBpZiAodHlwZW9mIG5hbWUgPT09ICdvYmplY3QnKSBjYWxsYmFjayA9IHRoaXM7XG4gICAgICBvYmpbaW1wbGVtZW50YXRpb25dKG5hbWUsIGNhbGxiYWNrLCB0aGlzKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG4gIH0pO1xuXG4gIC8vIEFsaWFzZXMgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LlxuICBFdmVudHMuYmluZCAgID0gRXZlbnRzLm9uO1xuICBFdmVudHMudW5iaW5kID0gRXZlbnRzLm9mZjtcblxuICAvLyBNaXhpbiB1dGlsaXR5XG4gIEV2ZW50cy5taXhpbiA9IGZ1bmN0aW9uKHByb3RvKSB7XG4gICAgdmFyIGV4cG9ydHMgPSBbJ29uJywgJ29uY2UnLCAnb2ZmJywgJ3RyaWdnZXInLCAnc3RvcExpc3RlbmluZycsICdsaXN0ZW5UbycsXG4gICAgICAgICAgICAgICAgICAgJ2xpc3RlblRvT25jZScsICdiaW5kJywgJ3VuYmluZCddO1xuICAgIF8uZWFjaChleHBvcnRzLCBmdW5jdGlvbihuYW1lKSB7XG4gICAgICBwcm90b1tuYW1lXSA9IHRoaXNbbmFtZV07XG4gICAgfSwgdGhpcyk7XG4gICAgcmV0dXJuIHByb3RvO1xuICB9O1xuXG4gIC8vIEV4cG9ydCBFdmVudHMgYXMgQmFja2JvbmVFdmVudHMgZGVwZW5kaW5nIG9uIGN1cnJlbnQgY29udGV4dFxuICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgICBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBFdmVudHM7XG4gICAgfVxuICAgIGV4cG9ydHMuQmFja2JvbmVFdmVudHMgPSBFdmVudHM7XG4gIH1lbHNlIGlmICh0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBkZWZpbmUoZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gRXZlbnRzO1xuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIHJvb3QuQmFja2JvbmVFdmVudHMgPSBFdmVudHM7XG4gIH1cbn0pKHRoaXMpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2JhY2tib25lLWV2ZW50cy1zdGFuZGFsb25lJyk7XG4iLCIvLyBkMy50aXBcbi8vIENvcHlyaWdodCAoYykgMjAxMyBKdXN0aW4gUGFsbWVyXG4vL1xuLy8gVG9vbHRpcHMgZm9yIGQzLmpzIFNWRyB2aXN1YWxpemF0aW9uc1xuXG4oZnVuY3Rpb24gKHJvb3QsIGZhY3RvcnkpIHtcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIC8vIEFNRC4gUmVnaXN0ZXIgYXMgYW4gYW5vbnltb3VzIG1vZHVsZSB3aXRoIGQzIGFzIGEgZGVwZW5kZW5jeS5cbiAgICBkZWZpbmUoWydkMyddLCBmYWN0b3J5KVxuICB9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgLy8gQ29tbW9uSlNcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGQzKSB7XG4gICAgICBkMy50aXAgPSBmYWN0b3J5KGQzKVxuICAgICAgcmV0dXJuIGQzLnRpcFxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbC5cbiAgICByb290LmQzLnRpcCA9IGZhY3Rvcnkocm9vdC5kMylcbiAgfVxufSh0aGlzLCBmdW5jdGlvbiAoZDMpIHtcblxuICAvLyBQdWJsaWMgLSBjb250cnVjdHMgYSBuZXcgdG9vbHRpcFxuICAvL1xuICAvLyBSZXR1cm5zIGEgdGlwXG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICB2YXIgZGlyZWN0aW9uID0gZDNfdGlwX2RpcmVjdGlvbixcbiAgICAgICAgb2Zmc2V0ICAgID0gZDNfdGlwX29mZnNldCxcbiAgICAgICAgaHRtbCAgICAgID0gZDNfdGlwX2h0bWwsXG4gICAgICAgIG5vZGUgICAgICA9IGluaXROb2RlKCksXG4gICAgICAgIHN2ZyAgICAgICA9IG51bGwsXG4gICAgICAgIHBvaW50ICAgICA9IG51bGwsXG4gICAgICAgIHRhcmdldCAgICA9IG51bGxcblxuICAgIGZ1bmN0aW9uIHRpcCh2aXMpIHtcbiAgICAgIHN2ZyA9IGdldFNWR05vZGUodmlzKVxuICAgICAgcG9pbnQgPSBzdmcuY3JlYXRlU1ZHUG9pbnQoKVxuICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChub2RlKVxuICAgIH1cblxuICAgIC8vIFB1YmxpYyAtIHNob3cgdGhlIHRvb2x0aXAgb24gdGhlIHNjcmVlblxuICAgIC8vXG4gICAgLy8gUmV0dXJucyBhIHRpcFxuICAgIHRpcC5zaG93ID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cylcbiAgICAgIGlmKGFyZ3NbYXJncy5sZW5ndGggLSAxXSBpbnN0YW5jZW9mIFNWR0VsZW1lbnQpIHRhcmdldCA9IGFyZ3MucG9wKClcblxuICAgICAgdmFyIGNvbnRlbnQgPSBodG1sLmFwcGx5KHRoaXMsIGFyZ3MpLFxuICAgICAgICAgIHBvZmZzZXQgPSBvZmZzZXQuYXBwbHkodGhpcywgYXJncyksXG4gICAgICAgICAgZGlyICAgICA9IGRpcmVjdGlvbi5hcHBseSh0aGlzLCBhcmdzKSxcbiAgICAgICAgICBub2RlbCAgID0gZDMuc2VsZWN0KG5vZGUpLFxuICAgICAgICAgIGkgICAgICAgPSBkaXJlY3Rpb25zLmxlbmd0aCxcbiAgICAgICAgICBjb29yZHMsXG4gICAgICAgICAgc2Nyb2xsVG9wICA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxUb3AgfHwgZG9jdW1lbnQuYm9keS5zY3JvbGxUb3AsXG4gICAgICAgICAgc2Nyb2xsTGVmdCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0IHx8IGRvY3VtZW50LmJvZHkuc2Nyb2xsTGVmdFxuXG4gICAgICBub2RlbC5odG1sKGNvbnRlbnQpXG4gICAgICAgIC5zdHlsZSh7IG9wYWNpdHk6IDEsICdwb2ludGVyLWV2ZW50cyc6ICdhbGwnIH0pXG5cbiAgICAgIHdoaWxlKGktLSkgbm9kZWwuY2xhc3NlZChkaXJlY3Rpb25zW2ldLCBmYWxzZSlcbiAgICAgIGNvb3JkcyA9IGRpcmVjdGlvbl9jYWxsYmFja3MuZ2V0KGRpcikuYXBwbHkodGhpcylcbiAgICAgIG5vZGVsLmNsYXNzZWQoZGlyLCB0cnVlKS5zdHlsZSh7XG4gICAgICAgIHRvcDogKGNvb3Jkcy50b3AgKyAgcG9mZnNldFswXSkgKyBzY3JvbGxUb3AgKyAncHgnLFxuICAgICAgICBsZWZ0OiAoY29vcmRzLmxlZnQgKyBwb2Zmc2V0WzFdKSArIHNjcm9sbExlZnQgKyAncHgnXG4gICAgICB9KVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljIC0gaGlkZSB0aGUgdG9vbHRpcFxuICAgIC8vXG4gICAgLy8gUmV0dXJucyBhIHRpcFxuICAgIHRpcC5oaWRlID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbm9kZWwgPSBkMy5zZWxlY3Qobm9kZSlcbiAgICAgIG5vZGVsLnN0eWxlKHsgb3BhY2l0eTogMCwgJ3BvaW50ZXItZXZlbnRzJzogJ25vbmUnIH0pXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBQcm94eSBhdHRyIGNhbGxzIHRvIHRoZSBkMyB0aXAgY29udGFpbmVyLiAgU2V0cyBvciBnZXRzIGF0dHJpYnV0ZSB2YWx1ZS5cbiAgICAvL1xuICAgIC8vIG4gLSBuYW1lIG9mIHRoZSBhdHRyaWJ1dGVcbiAgICAvLyB2IC0gdmFsdWUgb2YgdGhlIGF0dHJpYnV0ZVxuICAgIC8vXG4gICAgLy8gUmV0dXJucyB0aXAgb3IgYXR0cmlidXRlIHZhbHVlXG4gICAgdGlwLmF0dHIgPSBmdW5jdGlvbihuLCB2KSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIgJiYgdHlwZW9mIG4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBkMy5zZWxlY3Qobm9kZSkuYXR0cihuKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGFyZ3MgPSAgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKVxuICAgICAgICBkMy5zZWxlY3Rpb24ucHJvdG90eXBlLmF0dHIuYXBwbHkoZDMuc2VsZWN0KG5vZGUpLCBhcmdzKVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBQcm94eSBzdHlsZSBjYWxscyB0byB0aGUgZDMgdGlwIGNvbnRhaW5lci4gIFNldHMgb3IgZ2V0cyBhIHN0eWxlIHZhbHVlLlxuICAgIC8vXG4gICAgLy8gbiAtIG5hbWUgb2YgdGhlIHByb3BlcnR5XG4gICAgLy8gdiAtIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eVxuICAgIC8vXG4gICAgLy8gUmV0dXJucyB0aXAgb3Igc3R5bGUgcHJvcGVydHkgdmFsdWVcbiAgICB0aXAuc3R5bGUgPSBmdW5jdGlvbihuLCB2KSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIgJiYgdHlwZW9mIG4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBkMy5zZWxlY3Qobm9kZSkuc3R5bGUobilcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBhcmdzID0gIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cylcbiAgICAgICAgZDMuc2VsZWN0aW9uLnByb3RvdHlwZS5zdHlsZS5hcHBseShkMy5zZWxlY3Qobm9kZSksIGFyZ3MpXG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IFNldCBvciBnZXQgdGhlIGRpcmVjdGlvbiBvZiB0aGUgdG9vbHRpcFxuICAgIC8vXG4gICAgLy8gdiAtIE9uZSBvZiBuKG5vcnRoKSwgcyhzb3V0aCksIGUoZWFzdCksIG9yIHcod2VzdCksIG53KG5vcnRod2VzdCksXG4gICAgLy8gICAgIHN3KHNvdXRod2VzdCksIG5lKG5vcnRoZWFzdCkgb3Igc2Uoc291dGhlYXN0KVxuICAgIC8vXG4gICAgLy8gUmV0dXJucyB0aXAgb3IgZGlyZWN0aW9uXG4gICAgdGlwLmRpcmVjdGlvbiA9IGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGRpcmVjdGlvblxuICAgICAgZGlyZWN0aW9uID0gdiA9PSBudWxsID8gdiA6IGQzLmZ1bmN0b3IodilcblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogU2V0cyBvciBnZXRzIHRoZSBvZmZzZXQgb2YgdGhlIHRpcFxuICAgIC8vXG4gICAgLy8gdiAtIEFycmF5IG9mIFt4LCB5XSBvZmZzZXRcbiAgICAvL1xuICAgIC8vIFJldHVybnMgb2Zmc2V0IG9yXG4gICAgdGlwLm9mZnNldCA9IGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIG9mZnNldFxuICAgICAgb2Zmc2V0ID0gdiA9PSBudWxsID8gdiA6IGQzLmZ1bmN0b3IodilcblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogc2V0cyBvciBnZXRzIHRoZSBodG1sIHZhbHVlIG9mIHRoZSB0b29sdGlwXG4gICAgLy9cbiAgICAvLyB2IC0gU3RyaW5nIHZhbHVlIG9mIHRoZSB0aXBcbiAgICAvL1xuICAgIC8vIFJldHVybnMgaHRtbCB2YWx1ZSBvciB0aXBcbiAgICB0aXAuaHRtbCA9IGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGh0bWxcbiAgICAgIGh0bWwgPSB2ID09IG51bGwgPyB2IDogZDMuZnVuY3Rvcih2KVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZDNfdGlwX2RpcmVjdGlvbigpIHsgcmV0dXJuICduJyB9XG4gICAgZnVuY3Rpb24gZDNfdGlwX29mZnNldCgpIHsgcmV0dXJuIFswLCAwXSB9XG4gICAgZnVuY3Rpb24gZDNfdGlwX2h0bWwoKSB7IHJldHVybiAnICcgfVxuXG4gICAgdmFyIGRpcmVjdGlvbl9jYWxsYmFja3MgPSBkMy5tYXAoe1xuICAgICAgbjogIGRpcmVjdGlvbl9uLFxuICAgICAgczogIGRpcmVjdGlvbl9zLFxuICAgICAgZTogIGRpcmVjdGlvbl9lLFxuICAgICAgdzogIGRpcmVjdGlvbl93LFxuICAgICAgbnc6IGRpcmVjdGlvbl9udyxcbiAgICAgIG5lOiBkaXJlY3Rpb25fbmUsXG4gICAgICBzdzogZGlyZWN0aW9uX3N3LFxuICAgICAgc2U6IGRpcmVjdGlvbl9zZVxuICAgIH0pLFxuXG4gICAgZGlyZWN0aW9ucyA9IGRpcmVjdGlvbl9jYWxsYmFja3Mua2V5cygpXG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fbigpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94Lm4ueSAtIG5vZGUub2Zmc2V0SGVpZ2h0LFxuICAgICAgICBsZWZ0OiBiYm94Lm4ueCAtIG5vZGUub2Zmc2V0V2lkdGggLyAyXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX3MoKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5zLnksXG4gICAgICAgIGxlZnQ6IGJib3gucy54IC0gbm9kZS5vZmZzZXRXaWR0aCAvIDJcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fZSgpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94LmUueSAtIG5vZGUub2Zmc2V0SGVpZ2h0IC8gMixcbiAgICAgICAgbGVmdDogYmJveC5lLnhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fdygpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94LncueSAtIG5vZGUub2Zmc2V0SGVpZ2h0IC8gMixcbiAgICAgICAgbGVmdDogYmJveC53LnggLSBub2RlLm9mZnNldFdpZHRoXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX253KCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3gubncueSAtIG5vZGUub2Zmc2V0SGVpZ2h0LFxuICAgICAgICBsZWZ0OiBiYm94Lm53LnggLSBub2RlLm9mZnNldFdpZHRoXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX25lKCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3gubmUueSAtIG5vZGUub2Zmc2V0SGVpZ2h0LFxuICAgICAgICBsZWZ0OiBiYm94Lm5lLnhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fc3coKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5zdy55LFxuICAgICAgICBsZWZ0OiBiYm94LnN3LnggLSBub2RlLm9mZnNldFdpZHRoXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX3NlKCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3guc2UueSxcbiAgICAgICAgbGVmdDogYmJveC5lLnhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpbml0Tm9kZSgpIHtcbiAgICAgIHZhciBub2RlID0gZDMuc2VsZWN0KGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpKVxuICAgICAgbm9kZS5zdHlsZSh7XG4gICAgICAgIHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuICAgICAgICB0b3A6IDAsXG4gICAgICAgIG9wYWNpdHk6IDAsXG4gICAgICAgICdwb2ludGVyLWV2ZW50cyc6ICdub25lJyxcbiAgICAgICAgJ2JveC1zaXppbmcnOiAnYm9yZGVyLWJveCdcbiAgICAgIH0pXG5cbiAgICAgIHJldHVybiBub2RlLm5vZGUoKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFNWR05vZGUoZWwpIHtcbiAgICAgIGVsID0gZWwubm9kZSgpXG4gICAgICBpZihlbC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdzdmcnKVxuICAgICAgICByZXR1cm4gZWxcblxuICAgICAgcmV0dXJuIGVsLm93bmVyU1ZHRWxlbWVudFxuICAgIH1cblxuICAgIC8vIFByaXZhdGUgLSBnZXRzIHRoZSBzY3JlZW4gY29vcmRpbmF0ZXMgb2YgYSBzaGFwZVxuICAgIC8vXG4gICAgLy8gR2l2ZW4gYSBzaGFwZSBvbiB0aGUgc2NyZWVuLCB3aWxsIHJldHVybiBhbiBTVkdQb2ludCBmb3IgdGhlIGRpcmVjdGlvbnNcbiAgICAvLyBuKG5vcnRoKSwgcyhzb3V0aCksIGUoZWFzdCksIHcod2VzdCksIG5lKG5vcnRoZWFzdCksIHNlKHNvdXRoZWFzdCksIG53KG5vcnRod2VzdCksXG4gICAgLy8gc3coc291dGh3ZXN0KS5cbiAgICAvL1xuICAgIC8vICAgICstKy0rXG4gICAgLy8gICAgfCAgIHxcbiAgICAvLyAgICArICAgK1xuICAgIC8vICAgIHwgICB8XG4gICAgLy8gICAgKy0rLStcbiAgICAvL1xuICAgIC8vIFJldHVybnMgYW4gT2JqZWN0IHtuLCBzLCBlLCB3LCBudywgc3csIG5lLCBzZX1cbiAgICBmdW5jdGlvbiBnZXRTY3JlZW5CQm94KCkge1xuICAgICAgdmFyIHRhcmdldGVsICAgPSB0YXJnZXQgfHwgZDMuZXZlbnQudGFyZ2V0O1xuXG4gICAgICB3aGlsZSAoJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiB0YXJnZXRlbC5nZXRTY3JlZW5DVE0gJiYgJ3VuZGVmaW5lZCcgPT09IHRhcmdldGVsLnBhcmVudE5vZGUpIHtcbiAgICAgICAgICB0YXJnZXRlbCA9IHRhcmdldGVsLnBhcmVudE5vZGU7XG4gICAgICB9XG5cbiAgICAgIHZhciBiYm94ICAgICAgID0ge30sXG4gICAgICAgICAgbWF0cml4ICAgICA9IHRhcmdldGVsLmdldFNjcmVlbkNUTSgpLFxuICAgICAgICAgIHRiYm94ICAgICAgPSB0YXJnZXRlbC5nZXRCQm94KCksXG4gICAgICAgICAgd2lkdGggICAgICA9IHRiYm94LndpZHRoLFxuICAgICAgICAgIGhlaWdodCAgICAgPSB0YmJveC5oZWlnaHQsXG4gICAgICAgICAgeCAgICAgICAgICA9IHRiYm94LngsXG4gICAgICAgICAgeSAgICAgICAgICA9IHRiYm94LnlcblxuICAgICAgcG9pbnQueCA9IHhcbiAgICAgIHBvaW50LnkgPSB5XG4gICAgICBiYm94Lm53ID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnggKz0gd2lkdGhcbiAgICAgIGJib3gubmUgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueSArPSBoZWlnaHRcbiAgICAgIGJib3guc2UgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueCAtPSB3aWR0aFxuICAgICAgYmJveC5zdyA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC55IC09IGhlaWdodCAvIDJcbiAgICAgIGJib3gudyAgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueCArPSB3aWR0aFxuICAgICAgYmJveC5lID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnggLT0gd2lkdGggLyAyXG4gICAgICBwb2ludC55IC09IGhlaWdodCAvIDJcbiAgICAgIGJib3gubiA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC55ICs9IGhlaWdodFxuICAgICAgYmJveC5zID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcblxuICAgICAgcmV0dXJuIGJib3hcbiAgICB9XG5cbiAgICByZXR1cm4gdGlwXG4gIH07XG5cbn0pKTtcbiIsIi8qKlxuICpcbiAqIE11dGF0aW9ucyBOZWVkbGUgUGxvdCAobXV0cy1uZWVkbGUtcGxvdClcbiAqXG4gKiBDcmVhdGVzIGEgbmVlZGxlIHBsb3QgKGEuay5hIHN0ZW0gcGxvdCwgbG9sbGlwb3AtcGxvdCBhbmQgc29vbiBhbHNvIGJhbGxvb24gcGxvdCA7LSlcbiAqIFRoaXMgY2xhc3MgdXNlcyB0aGUgbnBtLXJlcXVpcmUgbW9kdWxlIHRvIGxvYWQgZGVwZW5kZW5jaWVzIGQzLCBkMy10aXBcbiAqXG4gKiBAYXV0aG9yIE1pY2hhZWwgUCBTY2hyb2VkZXJcbiAqIEBjbGFzc1xuICovXG5cbi8vU2V0IHRoZSBtYXJnaW4gb2YgdGhlIHkgYXhpcyBcbnZhciB5Ym9yZGVyID0gLTIwO1xuLy9BbGxvdyB1bmlxdWUgaGVhZCBzaXplXG52YXIgdW5pcXVlSGVhZFNpemUgPSB0cnVlO1xuXG5mdW5jdGlvbiBNdXRzTmVlZGxlUGxvdCAoY29uZmlnKSB7XG5cbiAgICAvLyBJTklUSUFMSVpBVElPTlxuXG4gICAgdmFyIHNlbGYgPSB0aGlzOyAgICAgICAgLy8gc2VsZiA9IE11dHNOZWVkbGVQbG90XG5cbiAgICAvLyBYLWNvb3JkaW5hdGVzXG4gICAgdGhpcy5tYXhDb29yZCA9IGNvbmZpZy5tYXhDb29yZCB8fCAtMTsgICAgICAgICAgICAgLy8gVGhlIG1heGltdW0gY29vcmQgKHgtYXhpcylcbiAgICBpZiAodGhpcy5tYXhDb29yZCA8IDApIHsgdGhyb3cgbmV3IEVycm9yKFwiJ21heENvb3JkJyBtdXN0IGJlIGRlZmluZWQgaW5pdGlhdGlvbiBjb25maWchXCIpOyB9XG4gICAgdGhpcy5taW5Db29yZCA9IGNvbmZpZy5taW5Db29yZCB8fCAxOyAgICAgICAgICAgICAgIC8vIFRoZSBtaW5pbXVtIGNvb3JkICh4LWF4aXMpXG5cbiAgICAvLyBkYXRhXG4gICAgbXV0YXRpb25EYXRhID0gY29uZmlnLm11dGF0aW9uRGF0YSB8fCAtMTsgICAgICAgICAgLy8gLmpzb24gZmlsZSBvciBkaWN0XG4gICAgaWYgKHRoaXMubWF4Q29vcmQgPCAwKSB7IHRocm93IG5ldyBFcnJvcihcIidtdXRhdGlvbkRhdGEnIG11c3QgYmUgZGVmaW5lZCBpbml0aWF0aW9uIGNvbmZpZyFcIik7IH1cbiAgICByZWdpb25EYXRhID0gY29uZmlnLnJlZ2lvbkRhdGEgfHwgLTE7ICAgICAgICAgICAgICAvLyAuanNvbiBmaWxlIG9yIGRpY3RcbiAgICBpZiAodGhpcy5tYXhDb29yZCA8IDApIHsgdGhyb3cgbmV3IEVycm9yKFwiJ3JlZ2lvbkRhdGEnIG11c3QgYmUgZGVmaW5lZCBpbml0aWF0aW9uIGNvbmZpZyFcIik7IH1cbiAgICB0aGlzLnRvdGFsQ2F0ZWdDb3VudHMgPSB7fTtcbiAgICB0aGlzLmNhdGVnQ291bnRzID0ge307XG4gICAgdGhpcy5zZWxlY3RlZE5lZWRsZXMgPSBbXTtcblxuICAgIC8vIFBsb3QgZGltZW5zaW9ucyAmIHRhcmdldFxuICAgIHZhciB0YXJnZXRFbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY29uZmlnLnRhcmdldEVsZW1lbnQpIHx8IGNvbmZpZy50YXJnZXRFbGVtZW50IHx8IGRvY3VtZW50LmJvZHkgICAvLyBXaGVyZSB0byBhcHBlbmQgdGhlIHBsb3QgKHN2ZylcblxuICAgIHZhciB3aWR0aCA9IHRoaXMud2lkdGggPSBjb25maWcud2lkdGggfHwgdGFyZ2V0RWxlbWVudC5vZmZzZXRXaWR0aCB8fCAxMDAwO1xuICAgIHZhciBoZWlnaHQgPSB0aGlzLmhlaWdodCA9IGNvbmZpZy5oZWlnaHQgfHwgdGFyZ2V0RWxlbWVudC5vZmZzZXRIZWlnaHQgfHwgNTAwO1xuXG4gICAgLy8gQ29sb3Igc2NhbGUgJiBtYXBcbiAgICB0aGlzLmNvbG9yTWFwID0gY29uZmlnLmNvbG9yTWFwIHx8IHt9OyAgICAgICAgICAgICAgLy8gZGljdFxuICAgIHZhciBjb2xvcnMgPSBPYmplY3Qua2V5cyh0aGlzLmNvbG9yTWFwKS5tYXAoZnVuY3Rpb24gKGtleSkge1xuICAgICAgICByZXR1cm4gc2VsZi5jb2xvck1hcFtrZXldO1xuICAgIH0pO1xuICAgIHRoaXMuY29sb3JTY2FsZSA9IGQzLnNjYWxlLmNhdGVnb3J5MjAoKVxuICAgICAgICAuZG9tYWluKE9iamVjdC5rZXlzKHRoaXMuY29sb3JNYXApKVxuICAgICAgICAucmFuZ2UoY29sb3JzLmNvbmNhdChkMy5zY2FsZS5jYXRlZ29yeTIwKCkucmFuZ2UoKSkpO1xuICAgIHRoaXMubGVnZW5kcyA9IGNvbmZpZy5sZWdlbmRzIHx8IHtcbiAgICAgICAgXCJ5XCI6IFwiVmFsdWVcIixcbiAgICAgICAgXCJ4XCI6IFwiQ29vcmRpbmF0ZVwiXG4gICAgfTtcblxuICAgIHRoaXMuc3ZnQ2xhc3NlcyA9IFwibXV0bmVlZGxlc1wiO1xuICAgIHRoaXMuYnVmZmVyID0gMDtcblxuICAgIHZhciBtYXhDb29yZCA9IHRoaXMubWF4Q29vcmQ7XG5cbiAgICB2YXIgYnVmZmVyID0gMDtcbiAgICBpZiAod2lkdGggPj0gaGVpZ2h0KSB7XG4gICAgICBidWZmZXIgPSBoZWlnaHQgLyA4O1xuICAgIH0gZWxzZSB7XG4gICAgICBidWZmZXIgPSB3aWR0aCAvIDg7XG4gICAgfVxuXG4gICAgdGhpcy5idWZmZXIgPSBidWZmZXI7XG5cbiAgICAvLyBJSU1QT1JUIEFORCBDT05GSUdVUkUgVElQU1xuICAgIHZhciBkM3RpcCA9IHJlcXVpcmUoJ2QzLXRpcCcpO1xuICAgIGQzdGlwKGQzKTtcblxuXG4gICAgdGhpcy50aXAgPSBkMy50aXAoKVxuICAgICAgLmF0dHIoJ2NsYXNzJywgJ2QzLXRpcCBkMy10aXAtbmVlZGxlJylcbiAgICAgIC5vZmZzZXQoWy0xMCwgMF0pXG4gICAgICAuaHRtbChmdW5jdGlvbihkKSB7XG4gICAgICAgIHJldHVybiBcIjxzcGFuPlwiICsgZC52YWx1ZSArIFwiIFwiICsgZC5jYXRlZ29yeSArICBcIiBhdCBjb29yZC4gXCIgKyBkLmNvb3JkU3RyaW5nICsgXCI8L3NwYW4+XCI7XG4gICAgICB9KTtcblxuICAgIHRoaXMuc2VsZWN0aW9uVGlwID0gZDMudGlwKClcbiAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ2QzLXRpcCBkMy10aXAtc2VsZWN0aW9uJylcbiAgICAgICAgLm9mZnNldChbLTUwLCAwXSlcbiAgICAgICAgLmh0bWwoZnVuY3Rpb24oZCkge1xuICAgICAgICAgICAgcmV0dXJuIFwiPHNwYW4+IFNlbGVjdGVkIGNvb3JkaW5hdGVzPGJyLz5cIiArIE1hdGgucm91bmQoZC5sZWZ0KSArIFwiIC0gXCIgKyBNYXRoLnJvdW5kKGQucmlnaHQpICsgXCI8L3NwYW4+XCI7XG4gICAgICAgIH0pXG4gICAgICAgIC5kaXJlY3Rpb24oJ24nKTtcblxuICAgIC8vIElOSVQgU1ZHXG4gICAgdmFyIHN2ZztcbiAgICB2YXIgdG9wbm9kZTtcbiAgICBpZiAoY29uZmlnLnJlc3BvbnNpdmUgPT0gJ3Jlc2l6ZScpIHtcbiAgICAgICAgdG9wbm9kZSAgPSBkMy5zZWxlY3QodGFyZ2V0RWxlbWVudCkuYXBwZW5kKFwic3ZnXCIpXG4gICAgICAgICAgICAuYXR0cihcIndpZHRoXCIsICcxMDAlJylcbiAgICAgICAgICAgIC5hdHRyKFwiaGVpZ2h0XCIsICcxMDAlJylcbiAgICAgICAgICAgIC5hdHRyKCd2aWV3Qm94JywnMCAwICcrTWF0aC5taW4od2lkdGgpKycgJytNYXRoLm1pbihoZWlnaHQpKVxuICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ2JydXNoJyk7XG4gICAgICAgIHN2ZyA9IHRvcG5vZGVcbiAgICAgICAgICAgIC5hcHBlbmQoXCJnXCIpXG4gICAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIHRoaXMuc3ZnQ2xhc3NlcylcbiAgICAgICAgICAgIC5hdHRyKFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKDAsMClcIik7XG4gICAgfSBlbHNlICB7XG5cbiAgICAgICAgdmFyIHN2ZyA9IGQzLnNlbGVjdCh0YXJnZXRFbGVtZW50KS5hcHBlbmQoXCJzdmdcIilcbiAgICAgICAgICAgIC5hdHRyKFwid2lkdGhcIiwgd2lkdGgpXG4gICAgICAgICAgICAuYXR0cihcImhlaWdodFwiLCBoZWlnaHQpXG4gICAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIHRoaXMuc3ZnQ2xhc3NlcyArIFwiIGJydXNoXCIpO1xuICAgICAgICB0b3Bub2RlID0gc3ZnO1xuICAgIH1cblxuXG4gICAgc3ZnLmNhbGwodGhpcy50aXApO1xuICAgIHN2Zy5jYWxsKHRoaXMuc2VsZWN0aW9uVGlwKTtcblxuICAgIC8vIERFRklORSBTQ0FMRVNcblxuICAgIHZhciB4ID0gZDMuc2NhbGUubGluZWFyKClcbiAgICAgIC5kb21haW4oW3RoaXMubWluQ29vcmQsIHRoaXMubWF4Q29vcmRdKVxuICAgICAgLnJhbmdlKFtidWZmZXIgKiAxLjUgLCB3aWR0aCAtIGJ1ZmZlcl0pXG4gICAgICAubmljZSgpO1xuICAgIHRoaXMueCA9IHg7XG5cbiAgICB2YXIgeSA9IGQzLnNjYWxlLmxpbmVhcigpXG4gICAgICAuZG9tYWluKFsxLDIwXSlcbiAgICAgIC5yYW5nZShbaGVpZ2h0IC0gYnVmZmVyICogMS41LCBidWZmZXJdKVxuICAgICAgLm5pY2UoKTtcbiAgICB0aGlzLnkgPSB5O1xuXG4gICAgLy8gQ09ORklHVVJFIEJSVVNIXG4gICAgc2VsZi5zZWxlY3RvciA9IGQzLnN2Zy5icnVzaCgpXG4gICAgICAgIC54KHgpXG4gICAgICAgIC5vbihcImJydXNoXCIsIGJydXNobW92ZSlcbiAgICAgICAgLm9uKFwiYnJ1c2hlbmRcIiwgYnJ1c2hlbmQpO1xuICAgIHZhciBzZWxlY3RvciA9IHNlbGYuc2VsZWN0b3I7XG5cbiAgICB2YXIgc2VsZWN0aW9uUmVjdCA9IHRvcG5vZGVcbiAgICAgICAgLmNhbGwoc2VsZWN0b3IpXG4gICAgICAgIC5zZWxlY3RBbGwoJy5leHRlbnQnKVxuICAgICAgICAuYXR0cignaGVpZ2h0JywgNTApXG4gICAgICAgIC5hdHRyKCd5JywgaGVpZ2h0LTUwKVxuICAgICAgICAuYXR0cignb3BhY2l0eScsIDAuMik7XG5cbiAgICBzZWxlY3Rpb25SZWN0Lm9uKFwibW91c2VlbnRlclwiLCBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNlbGVjdGlvbiA9IHNlbGVjdG9yLmV4dGVudCgpO1xuICAgICAgICBzZWxmLnNlbGVjdGlvblRpcC5zaG93KHtsZWZ0OiBzZWxlY3Rpb25bMF0sIHJpZ2h0OiBzZWxlY3Rpb25bMV19LCBzZWxlY3Rpb25SZWN0Lm5vZGUoKSk7XG4gICAgfSlcbiAgICAgICAgLm9uKFwibW91c2VvdXRcIiwgZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIGQzLnNlbGVjdChcIi5kMy10aXAtc2VsZWN0aW9uXCIpXG4gICAgICAgICAgICAgICAgLnRyYW5zaXRpb24oKVxuICAgICAgICAgICAgICAgIC5kZWxheSgzMDAwKVxuICAgICAgICAgICAgICAgIC5kdXJhdGlvbigxMDAwKVxuICAgICAgICAgICAgICAgIC5zdHlsZShcIm9wYWNpdHlcIiwwKVxuICAgICAgICAgICAgICAgIC5zdHlsZSgncG9pbnRlci1ldmVudHMnLCAnbm9uZScpO1xuICAgICAgICB9KTtcblxuICAgIGZ1bmN0aW9uIGJydXNobW92ZSgpIHtcblxuICAgICAgICB2YXIgZXh0ZW50ID0gc2VsZWN0b3IuZXh0ZW50KCk7XG4gICAgICAgIG5lZWRsZUhlYWRzID0gZDMuc2VsZWN0QWxsKFwiLm5lZWRsZS1oZWFkXCIpO1xuICAgICAgICBzZWxlY3RlZE5lZWRsZXMgPSBbXTtcbiAgICAgICAgY2F0ZWdDb3VudHMgPSB7fTtcbiAgICAgICAgZm9yIChrZXkgaW4gT2JqZWN0LmtleXMoc2VsZi50b3RhbENhdGVnQ291bnRzKSkge1xuICAgICAgICAgICAgY2F0ZWdDb3VudHNba2V5XSA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBuZWVkbGVIZWFkcy5jbGFzc2VkKFwic2VsZWN0ZWRcIiwgZnVuY3Rpb24oZCkge1xuICAgICAgICAgICAgaXNfYnJ1c2hlZCA9IGV4dGVudFswXSA8PSBkLmNvb3JkICYmIGQuY29vcmQgPD0gZXh0ZW50WzFdO1xuICAgICAgICAgICAgaWYgKGlzX2JydXNoZWQpIHtcbiAgICAgICAgICAgICAgICBzZWxlY3RlZE5lZWRsZXMucHVzaChkKTtcbiAgICAgICAgICAgICAgICBjYXRlZ0NvdW50c1tkLmNhdGVnb3J5XSA9IChjYXRlZ0NvdW50c1tkLmNhdGVnb3J5XSB8fCAwKSArIGQudmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gaXNfYnJ1c2hlZDtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgc2VsZi50cmlnZ2VyKCduZWVkbGVTZWxlY3Rpb25DaGFuZ2UnLCB7XG4gICAgICAgIHNlbGVjdGVkIDogc2VsZWN0ZWROZWVkbGVzLFxuICAgICAgICAgICAgY2F0ZWdDb3VudHM6IGNhdGVnQ291bnRzLFxuICAgICAgICAgICAgY29vcmRzOiBleHRlbnRcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYnJ1c2hlbmQoKSB7XG4gICAgICAgIGdldF9idXR0b24gPSBkMy5zZWxlY3QoXCIuY2xlYXItYnV0dG9uXCIpO1xuICAgICAgICBzZWxmLnRyaWdnZXIoJ25lZWRsZVNlbGVjdGlvbkNoYW5nZUVuZCcsIHtcbiAgICAgICAgICAgIHNlbGVjdGVkIDogc2VsZWN0ZWROZWVkbGVzLFxuICAgICAgICAgICAgY2F0ZWdDb3VudHM6IGNhdGVnQ291bnRzLFxuICAgICAgICAgICAgY29vcmRzOiBzZWxlY3Rvci5leHRlbnQoKVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLy8gRFJBV1xuICAgIHRoaXMuZHJhd05lZWRsZXMoc3ZnLCBtdXRhdGlvbkRhdGEsIHJlZ2lvbkRhdGEpO1xuXG5cbiAgICBzZWxmLm9uKFwibmVlZGxlU2VsZWN0aW9uQ2hhbmdlXCIsIGZ1bmN0aW9uIChlZGF0YSkge1xuICAgICAgICBzZWxmLmNhdGVnQ291bnRzID0gZWRhdGEuY2F0ZWdDb3VudHM7XG4gICAgICAgIHNlbGYuc2VsZWN0ZWROZWVkbGVzID0gZWRhdGEuc2VsZWN0ZWQ7XG4gICAgICAgIHN2Zy5jYWxsKHZlcnRpY2FsTGVnZW5kKTtcbiAgICB9KTtcblxuICAgIHNlbGYub24oXCJuZWVkbGVTZWxlY3Rpb25DaGFuZ2VFbmRcIiwgZnVuY3Rpb24gKGVkYXRhKSB7XG4gICAgICAgIHNlbGYuY2F0ZWdDb3VudHMgPSBlZGF0YS5jYXRlZ0NvdW50cztcbiAgICAgICAgc2VsZi5zZWxlY3RlZE5lZWRsZXMgPSBlZGF0YS5zZWxlY3RlZDtcbiAgICAgICAgc3ZnLmNhbGwodmVydGljYWxMZWdlbmQpO1xuICAgIH0pO1xuXG4gICAgc2VsZi5vbihcIm5lZWRsZVNlbGVjdGlvbkNoYW5nZVwiLCBmdW5jdGlvbihlZGF0YSkge1xuICAgICAgICAgICAgc2VsZWN0aW9uID0gZWRhdGEuY29vcmRzO1xuICAgICAgICAgICAgaWYgKHNlbGVjdGlvblsxXSAtIHNlbGVjdGlvblswXSA+IDApIHtcbiAgICAgICAgICAgICAgICBzZWxmLnNlbGVjdGlvblRpcC5zaG93KHtsZWZ0OiBzZWxlY3Rpb25bMF0sIHJpZ2h0OiBzZWxlY3Rpb25bMV19LCBzZWxlY3Rpb25SZWN0Lm5vZGUoKSk7XG4gICAgICAgICAgICAgICAgZDMuc2VsZWN0KFwiLmQzLXRpcC1zZWxlY3Rpb25cIilcbiAgICAgICAgICAgICAgICAgICAgLnRyYW5zaXRpb24oKVxuICAgICAgICAgICAgICAgICAgICAuZGVsYXkoMzAwMClcbiAgICAgICAgICAgICAgICAgICAgLmR1cmF0aW9uKDEwMDApXG4gICAgICAgICAgICAgICAgICAgIC5zdHlsZShcIm9wYWNpdHlcIiwwKVxuICAgICAgICAgICAgICAgICAgICAuc3R5bGUoJ3BvaW50ZXItZXZlbnRzJywgJ25vbmUnKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2VsZi5zZWxlY3Rpb25UaXAuaGlkZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuXG5cbn1cblxuTXV0c05lZWRsZVBsb3QucHJvdG90eXBlLmRyYXdMZWdlbmQgPSBmdW5jdGlvbihzdmcpIHtcblxuICAgIC8vIExFR0VORFxuICAgIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gcHJlcGFyZSBsZWdlbmQgY2F0ZWdvcmllcyAoY29ycmVjdCBvcmRlcilcbiAgICBtdXRDYXRlZ29yaWVzID0gW107XG4gICAgY2F0ZWdvcnlDb2xvcnMgPSBbXTtcbiAgICBhbGxjYXRlZ3MgPSBPYmplY3Qua2V5cyhzZWxmLnRvdGFsQ2F0ZWdDb3VudHMpOyAvLyByYW5kb20gb3JkZXJcbiAgICBvcmRlcmVkRGVjbGFyYXRpb24gPSBzZWxmLmNvbG9yU2NhbGUuZG9tYWluKCk7ICAvLyB3YW50ZWQgb3JkZXJcbiAgICBmb3IgKGlkeCBpbiBvcmRlcmVkRGVjbGFyYXRpb24pIHtcbiAgICAgICAgYyA9IG9yZGVyZWREZWNsYXJhdGlvbltpZHhdO1xuICAgICAgICBpZiAoYWxsY2F0ZWdzLmluZGV4T2YoYykgPiAtMSkge1xuICAgICAgICAgICAgbXV0Q2F0ZWdvcmllcy5wdXNoKGMpO1xuICAgICAgICAgICAgY2F0ZWdvcnlDb2xvcnMucHVzaChzZWxmLmNvbG9yU2NhbGUoYykpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjcmVhdGUgc2NhbGUgd2l0aCBjb3JyZWN0IG9yZGVyIG9mIGNhdGVnb3JpZXNcbiAgICBtdXRzU2NhbGUgPSBzZWxmLmNvbG9yU2NhbGUuZG9tYWluKG11dENhdGVnb3JpZXMpLnJhbmdlKGNhdGVnb3J5Q29sb3JzKTtcblxuXG4gICAgdmFyIGRvbWFpbiA9IHNlbGYueC5kb21haW4oKTtcbiAgICB4cGxhY2VtZW50ID0gKHNlbGYueChkb21haW5bMV0pIC0gc2VsZi54KGRvbWFpblswXSkpICogMC43NSArIHNlbGYueChkb21haW5bMF0pO1xuXG5cbiAgICB2YXIgc3VtID0gMDtcbiAgICBmb3IgKHZhciBjIGluIHNlbGYudG90YWxDYXRlZ0NvdW50cykge1xuICAgICAgICBzdW0gKz0gc2VsZi50b3RhbENhdGVnQ291bnRzW2NdO1xuICAgIH1cblxuICAgIGxlZ2VuZExhYmVsID0gZnVuY3Rpb24oY2F0ZWcpIHtcbiAgICAgICAgdmFyIGNvdW50ID0gKHNlbGYuY2F0ZWdDb3VudHNbY2F0ZWddIHx8IChzZWxmLnNlbGVjdGVkTmVlZGxlcy5sZW5ndGggPT0gMCAmJiBzZWxmLnRvdGFsQ2F0ZWdDb3VudHNbY2F0ZWddKSB8fCAwKTtcbiAgICAgICAgcmV0dXJuICBjYXRlZyArIChjb3VudCA+IDAgPyBcIjogXCIrY291bnQrXCIgKFwiICsgTWF0aC5yb3VuZChjb3VudC9zdW0qMTAwKSArIFwiJSlcIiA6IFwiXCIpO1xuICAgIH07XG5cbiAgICBsZWdlbmRDbGFzcyA9IGZ1bmN0aW9uKGNhdGVnKSB7XG4gICAgICAgIHZhciBjb3VudCA9IChzZWxmLmNhdGVnQ291bnRzW2NhdGVnXSB8fCAoc2VsZi5zZWxlY3RlZE5lZWRsZXMubGVuZ3RoID09IDAgJiYgc2VsZi50b3RhbENhdGVnQ291bnRzW2NhdGVnXSkgfHwgMCk7XG4gICAgICAgIHJldHVybiAoY291bnQgPiAwKSA/IFwiXCIgOiBcIm5vbXV0c1wiO1xuICAgIH07XG5cbiAgICBzZWxmLm5vc2hvdyA9IFtdO1xuICAgIHZhciBuZWVkbGVIZWFkcyA9IGQzLnNlbGVjdEFsbChcIi5uZWVkbGUtaGVhZFwiKTtcbiAgICBzaG93Tm9TaG93ID0gZnVuY3Rpb24oY2F0ZWcpe1xuICAgICAgICBpZiAoXy5jb250YWlucyhzZWxmLm5vc2hvdywgY2F0ZWcpKSB7XG4gICAgICAgICAgICBzZWxmLm5vc2hvdyA9IF8uZmlsdGVyKHNlbGYubm9zaG93LCBmdW5jdGlvbihzKSB7IHJldHVybiBzICE9IGNhdGVnIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2VsZi5ub3Nob3cucHVzaChjYXRlZyk7XG4gICAgICAgIH1cbiAgICAgICAgbmVlZGxlSGVhZHMuY2xhc3NlZChcIm5vc2hvd1wiLCBmdW5jdGlvbihkKSB7XG4gICAgICAgICAgICByZXR1cm4gXy5jb250YWlucyhzZWxmLm5vc2hvdywgZC5jYXRlZ29yeSk7XG4gICAgICAgIH0pO1xuICAgICAgICB2YXIgbGVnZW5kQ2VsbHMgPSBkMy5zZWxlY3RBbGwoXCJnLmxlZ2VuZENlbGxzXCIpO1xuICAgICAgICBsZWdlbmRDZWxscy5jbGFzc2VkKFwibm9zaG93XCIsIGZ1bmN0aW9uKGQpIHtcbiAgICAgICAgICAgIHJldHVybiBfLmNvbnRhaW5zKHNlbGYubm9zaG93LCBkLnN0b3BbMF0pO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG5cbiAgICB2ZXJ0aWNhbExlZ2VuZCA9IGQzLnN2Zy5sZWdlbmQoKVxuICAgICAgICAubGFiZWxGb3JtYXQobGVnZW5kTGFiZWwpXG4gICAgICAgIC5sYWJlbENsYXNzKGxlZ2VuZENsYXNzKVxuICAgICAgICAub25MZWdlbmRDbGljayhzaG93Tm9TaG93KVxuICAgICAgICAuY2VsbFBhZGRpbmcoNClcbiAgICAgICAgLm9yaWVudGF0aW9uKFwidmVydGljYWxcIilcbiAgICAgICAgLnVuaXRzKHN1bSArIFwiIE11dGF0aW9uc1wiKVxuICAgICAgICAuY2VsbFdpZHRoKDIwKVxuICAgICAgICAuY2VsbEhlaWdodCgxMilcbiAgICAgICAgLmlucHV0U2NhbGUobXV0c1NjYWxlKVxuICAgICAgICAuY2VsbFN0ZXBwaW5nKDQpXG4gICAgICAgIC5wbGFjZSh7eDogeHBsYWNlbWVudCwgeTogNTB9KTtcblxuICAgIHN2Zy5jYWxsKHZlcnRpY2FsTGVnZW5kKTtcblxufTtcblxuTXV0c05lZWRsZVBsb3QucHJvdG90eXBlLmRyYXdSZWdpb25zID0gZnVuY3Rpb24oc3ZnLCByZWdpb25EYXRhKSB7XG5cbiAgICB2YXIgbWF4Q29vcmQgPSB0aGlzLm1heENvb3JkO1xuICAgIHZhciBtaW5Db29yZCA9IHRoaXMubWluQ29vcmQ7XG4gICAgdmFyIGJ1ZmZlciA9IHRoaXMuYnVmZmVyO1xuICAgIHZhciBjb2xvcnMgPSB0aGlzLmNvbG9yTWFwO1xuICAgIHZhciB5ID0gdGhpcy55O1xuICAgIHZhciB4ID0gdGhpcy54O1xuXG4gICAgdmFyIGJlbG93ID0gZmFsc2U7XG5cblxuICAgIGdldFJlZ2lvblN0YXJ0ID0gZnVuY3Rpb24ocmVnaW9uKSB7XG4gICAgICAgIHJldHVybiBwYXJzZUludChyZWdpb24uc3BsaXQoXCItXCIpWzBdKVxuICAgIH07XG5cbiAgICBnZXRSZWdpb25FbmQgPSBmdW5jdGlvbihyZWdpb24pIHtcbiAgICAgICAgcmV0dXJuIHBhcnNlSW50KHJlZ2lvbi5zcGxpdChcIi1cIilbMV0pXG4gICAgfTtcblxuICAgIGdldENvbG9yID0gdGhpcy5jb2xvclNjYWxlO1xuXG4gICAgdmFyIGJnX29mZnNldCA9IDA7XG4gICAgdmFyIHJlZ2lvbl9vZmZzZXQgPSBiZ19vZmZzZXQtM1xuICAgIHZhciB0ZXh0X29mZnNldCA9IGJnX29mZnNldCArIDIwO1xuICAgIGlmIChiZWxvdyAhPSB0cnVlKSB7XG4gICAgICAgIHRleHRfb2Zmc2V0ID0gYmdfb2Zmc2V0Kzg7XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBkcmF3KHJlZ2lvbkxpc3QpIHtcblxuICAgICAgICB2YXIgcmVnaW9uc0JHID0gZDMuc2VsZWN0KFwiLm11dG5lZWRsZXNcIikuc2VsZWN0QWxsKClcbiAgICAgICAgICAgIC5kYXRhKFtcImR1bW15XCJdKS5lbnRlcigpXG4gICAgICAgICAgICAuaW5zZXJ0KFwiZ1wiLCBcIjpmaXJzdC1jaGlsZFwiKVxuICAgICAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcInJlZ2lvbnNCR1wiKVxuICAgICAgICAgICAgLmFwcGVuZChcInJlY3RcIilcbiAgICAgICAgICAgIC5hdHRyKFwieFwiLCB4KG1pbkNvb3JkKSApXG4gICAgICAgICAgICAuYXR0cihcInlcIiwgeSgwKSArIGJnX29mZnNldCApXG4gICAgICAgICAgICAuYXR0cihcIndpZHRoXCIsIHgobWF4Q29vcmQpIC0geChtaW5Db29yZCkgKVxuICAgICAgICAgICAgLmF0dHIoXCJoZWlnaHRcIiwgMTgpXG4gICAgICAgICAgICAuYXR0cihcImZpbGxcIiwgXCJsaWdodGdyZXlcIik7XG5cblxuICAgICAgICBkMy5zZWxlY3QoXCIuZXh0ZW50XCIpXG4gICAgICAgICAgICAuYXR0cihcInlcIiwgeSgwKSArIHJlZ2lvbl9vZmZzZXQgLSAxMCk7XG5cblxuICAgICAgICB2YXIgcmVnaW9ucyA9IHJlZ2lvbnNCRyA9IGQzLnNlbGVjdChcIi5tdXRuZWVkbGVzXCIpLnNlbGVjdEFsbCgpXG4gICAgICAgICAgICAuZGF0YShyZWdpb25MaXN0KVxuICAgICAgICAgICAgLmVudGVyKClcbiAgICAgICAgICAgIC5hcHBlbmQoXCJnXCIpXG4gICAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIFwicmVnaW9uR3JvdXBcIik7XG5cbiAgICAgICAgcmVnaW9ucy5hcHBlbmQoXCJyZWN0XCIpXG4gICAgICAgICAgICAuYXR0cihcInhcIiwgZnVuY3Rpb24gKHIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geChyLnN0YXJ0KTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuYXR0cihcInlcIiwgeSgwKSArIHJlZ2lvbl9vZmZzZXQgKVxuICAgICAgICAgICAgLmF0dHIoXCJyeVwiLCBcIjNcIilcbiAgICAgICAgICAgIC5hdHRyKFwicnhcIiwgXCIzXCIpXG4gICAgICAgICAgICAuYXR0cihcIndpZHRoXCIsIGZ1bmN0aW9uIChyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHgoci5lbmQpIC0geChyLnN0YXJ0KVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5hdHRyKFwiaGVpZ2h0XCIsIDI0KVxuICAgICAgICAgICAgLnN0eWxlKFwiZmlsbFwiLCBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBkYXRhLmNvbG9yXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnN0eWxlKFwic3Ryb2tlXCIsIGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGQzLnJnYihkYXRhLmNvbG9yKS5kYXJrZXIoKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgcmVnaW9uc1xuICAgICAgICAgICAgLmF0dHIoJ3BvaW50ZXItZXZlbnRzJywgJ2FsbCcpXG4gICAgICAgICAgICAuYXR0cignY3Vyc29yJywgJ3BvaW50ZXInKVxuICAgICAgICAgICAgLm9uKFwiY2xpY2tcIiwgIGZ1bmN0aW9uKHIpIHtcbiAgICAgICAgICAgIC8vIHNldCBjdXN0b20gc2VsZWN0aW9uIGV4dGVudFxuICAgICAgICAgICAgc2VsZi5zZWxlY3Rvci5leHRlbnQoW3Iuc3RhcnQsIHIuZW5kXSk7XG4gICAgICAgICAgICAvLyBjYWxsIHRoZSBleHRlbnQgdG8gY2hhbmdlIHdpdGggdHJhbnNpdGlvblxuICAgICAgICAgICAgc2VsZi5zZWxlY3RvcihkMy5zZWxlY3QoXCIuYnJ1c2hcIikudHJhbnNpdGlvbigpKTtcbiAgICAgICAgICAgIC8vIGNhbGwgZXh0ZW50IChzZWxlY3Rpb24pIGNoYW5nZSBsaXN0ZW5lcnNcbiAgICAgICAgICAgIHNlbGYuc2VsZWN0b3IuZXZlbnQoZDMuc2VsZWN0KFwiLmJydXNoXCIpLnRyYW5zaXRpb24oKS5kZWxheSgzMDApKTtcblxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBQbGFjZSBhbmQgbGFiZWwgbG9jYXRpb25cbiAgICAgICAgdmFyIGxhYmVscyA9IFtdO1xuXG4gICAgICAgIHZhciByZXBlYXRlZFJlZ2lvbiA9IHt9O1xuICAgICAgICB2YXIgZ2V0UmVnaW9uQ2xhc3MgPSBmdW5jdGlvbihyZWdpb24pIHtcbiAgICAgICAgICAgIHZhciBjID0gXCJyZWdpb25OYW1lXCI7XG4gICAgICAgICAgICB2YXIgcmVwZWF0ZWRDbGFzcyA9IFwiUlJfXCIrcmVnaW9uLm5hbWU7XG4gICAgICAgICAgICBpZihfLmhhcyhyZXBlYXRlZFJlZ2lvbiwgcmVnaW9uLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgYyA9IFwicmVwZWF0ZWROYW1lIG5vc2hvdyBcIiArIHJlcGVhdGVkQ2xhc3M7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXBlYXRlZFJlZ2lvbltyZWdpb24ubmFtZV0gPSByZXBlYXRlZENsYXNzO1xuICAgICAgICAgICAgcmV0dXJuIGM7XG4gICAgICAgIH07XG4gICAgICAgIHJlZ2lvbnMuYXBwZW5kKFwidGV4dFwiKVxuICAgICAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBnZXRSZWdpb25DbGFzcylcbiAgICAgICAgICAgIC5hdHRyKFwidGV4dC1hbmNob3JcIiwgXCJtaWRkbGVcIilcbiAgICAgICAgICAgIC5hdHRyKFwiZmlsbFwiLCBcImJsYWNrXCIpXG4gICAgICAgICAgICAuYXR0cihcIm9wYWNpdHlcIiwgMC41KVxuICAgICAgICAgICAgLmF0dHIoXCJ4XCIsIGZ1bmN0aW9uIChyKSB7XG4gICAgICAgICAgICAgICAgci54ID0geChyLnN0YXJ0KSArICh4KHIuZW5kKSAtIHgoci5zdGFydCkpIC8gMjtcbiAgICAgICAgICAgICAgICByZXR1cm4gci54O1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5hdHRyKFwieVwiLCBmdW5jdGlvbihyKSB7ci55ID0geSgwKSArIHRleHRfb2Zmc2V0OyByZXR1cm4gci55OyB9IClcbiAgICAgICAgICAgIC5hdHRyKFwiZHlcIiwgXCIwLjM1ZW1cIilcbiAgICAgICAgICAgIC5zdHlsZShcImZvbnQtc2l6ZVwiLCBcIjEycHhcIilcbiAgICAgICAgICAgIC5zdHlsZShcInRleHQtZGVjb3JhdGlvblwiLCBcImJvbGRcIilcbiAgICAgICAgICAgIC50ZXh0KGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRhdGEubmFtZVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgdmFyIHJlZ2lvbk5hbWVzID0gZDMuc2VsZWN0QWxsKFwiLnJlZ2lvbk5hbWVcIik7XG4gICAgICAgIHJlZ2lvbk5hbWVzLmVhY2goZnVuY3Rpb24oZCwgaSkge1xuICAgICAgICAgICAgdmFyIGludGVyYWN0aW9uTGVuZ3RoID0gdGhpcy5nZXRCQm94KCkud2lkdGggLyAyO1xuICAgICAgICAgICAgbGFiZWxzLnB1c2goe3g6IGQueCwgeTogZC55LCBsYWJlbDogZC5uYW1lLCB3ZWlnaHQ6IGQubmFtZS5sZW5ndGgsIHJhZGl1czogaW50ZXJhY3Rpb25MZW5ndGh9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmFyIGZvcmNlID0gZDMubGF5b3V0LmZvcmNlKClcbiAgICAgICAgICAgIC5jaGFyZ2VEaXN0YW5jZSg1KVxuICAgICAgICAgICAgLm5vZGVzKGxhYmVscylcbiAgICAgICAgICAgIC5jaGFyZ2UoLTEwKVxuICAgICAgICAgICAgLmdyYXZpdHkoMCk7XG5cbiAgICAgICAgdmFyIG1pblggPSB4KG1pbkNvb3JkKTtcbiAgICAgICAgdmFyIG1heFggPSB4KG1heENvb3JkKTtcbiAgICAgICAgdmFyIHdpdGhpbkJvdW5kcyA9IGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiBkMy5taW4oW1xuICAgICAgICAgICAgICAgIGQzLm1heChbXG4gICAgICAgICAgICAgICAgICAgIG1pblgsXG4gICAgICAgICAgICAgICAgICAgIHhdKSxcbiAgICAgICAgICAgICAgICBtYXhYXG4gICAgICAgICAgICBdKTtcbiAgICAgICAgfTtcbiAgICAgICAgZnVuY3Rpb24gY29sbGlkZShub2RlKSB7XG4gICAgICAgICAgICB2YXIgciA9IG5vZGUucmFkaXVzICsgMyxcbiAgICAgICAgICAgICAgICBueDEgPSBub2RlLnggLSByLFxuICAgICAgICAgICAgICAgIG54MiA9IG5vZGUueCArIHIsXG4gICAgICAgICAgICAgICAgbnkxID0gbm9kZS55IC0gcixcbiAgICAgICAgICAgICAgICBueTIgPSBub2RlLnkgKyByO1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHF1YWQsIHgxLCB5MSwgeDIsIHkyKSB7XG4gICAgICAgICAgICAgICAgaWYgKHF1YWQucG9pbnQgJiYgKHF1YWQucG9pbnQgIT09IG5vZGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBsID0gbm9kZS54IC0gcXVhZC5wb2ludC54LFxuICAgICAgICAgICAgICAgICAgICAgICAgeCA9IGw7XG4gICAgICAgICAgICAgICAgICAgIHIgPSBub2RlLnJhZGl1cyArIHF1YWQucG9pbnQucmFkaXVzO1xuICAgICAgICAgICAgICAgICAgICBpZiAoTWF0aC5hYnMobCkgPCByKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsID0gKGwgLSByKSAvIGwgKiAuMDA1O1xuICAgICAgICAgICAgICAgICAgICAgICAgeCAqPSBsO1xuICAgICAgICAgICAgICAgICAgICAgICAgeCA9ICAobm9kZS54ID4gcXVhZC5wb2ludC54ICYmIHggPCAwKSA/IC14IDogeDtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGUueCArPSB4O1xuICAgICAgICAgICAgICAgICAgICAgICAgcXVhZC5wb2ludC54IC09IHg7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHgxID4gbngyXG4gICAgICAgICAgICAgICAgICAgIHx8IHgyIDwgbngxXG4gICAgICAgICAgICAgICAgICAgIHx8IHkxID4gbnkyXG4gICAgICAgICAgICAgICAgICAgIHx8IHkyIDwgbnkxO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbW92ZVJlcGVhdGVkTGFiZWxzID0gZnVuY3Rpb24obGFiZWwsIHgpIHtcbiAgICAgICAgICAgIHZhciBuYW1lID0gcmVwZWF0ZWRSZWdpb25bbGFiZWxdO1xuICAgICAgICAgICAgc3ZnLnNlbGVjdEFsbChcInRleHQuXCIrbmFtZSlcbiAgICAgICAgICAgICAgICAuYXR0cihcInhcIiwgbmV3eCk7XG4gICAgICAgIH07XG4gICAgICAgIGZvcmNlLm9uKFwidGlja1wiLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICB2YXIgcSA9IGQzLmdlb20ucXVhZHRyZWUobGFiZWxzKSxcbiAgICAgICAgICAgICAgICBpID0gMCxcbiAgICAgICAgICAgICAgICBuID0gbGFiZWxzLmxlbmd0aDtcbiAgICAgICAgICAgIHdoaWxlICgrK2kgPCBuKSB7XG4gICAgICAgICAgICAgICAgcS52aXNpdChjb2xsaWRlKGxhYmVsc1tpXSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSBwb3NpdGlvbiBvZiB0aGUgdGV4dCBlbGVtZW50XG4gICAgICAgICAgICB2YXIgaSA9IDA7XG4gICAgICAgICAgICBzdmcuc2VsZWN0QWxsKFwidGV4dC5yZWdpb25OYW1lXCIpXG4gICAgICAgICAgICAgICAgLmF0dHIoXCJ4XCIsIGZ1bmN0aW9uKGQpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3eCA9IGxhYmVsc1tpKytdLng7XG4gICAgICAgICAgICAgICAgICAgIG1vdmVSZXBlYXRlZExhYmVscyhkLm5hbWUsIG5ld3gpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3eDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuICAgICAgICB9KTtcbiAgICAgICAgZm9yY2Uuc3RhcnQoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBmb3JtYXRSZWdpb25zKHJlZ2lvbnMpIHtcbiAgICAgICAgZm9yIChrZXkgaW4gT2JqZWN0LmtleXMocmVnaW9ucykpIHtcblxuICAgICAgICAgICAgcmVnaW9uc1trZXldLnN0YXJ0ID0gZ2V0UmVnaW9uU3RhcnQocmVnaW9uc1trZXldLmNvb3JkKTtcbiAgICAgICAgICAgIHJlZ2lvbnNba2V5XS5lbmQgPSBnZXRSZWdpb25FbmQocmVnaW9uc1trZXldLmNvb3JkKTtcbiAgICAgICAgICAgIHJlZ2lvbnNba2V5XS5jb2xvciA9IGdldENvbG9yKHJlZ2lvbnNba2V5XS5uYW1lKTtcbiAgICAgICAgICAgIC8qcmVnaW9uTGlzdC5wdXNoKHtcbiAgICAgICAgICAgICAgICAnbmFtZSc6IGtleSxcbiAgICAgICAgICAgICAgICAnc3RhcnQnOiBnZXRSZWdpb25TdGFydChyZWdpb25zW2tleV0pLFxuICAgICAgICAgICAgICAgICdlbmQnOiBnZXRSZWdpb25FbmQocmVnaW9uc1trZXldKSxcbiAgICAgICAgICAgICAgICAnY29sb3InOiBnZXRDb2xvcihrZXkpXG4gICAgICAgICAgICB9KTsqL1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZWdpb25zO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgcmVnaW9uRGF0YSA9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIC8vIGFzc3VtZSBkYXRhIGlzIGluIGEgZmlsZVxuICAgICAgICBkMy5qc29uKHJlZ2lvbkRhdGEsIGZ1bmN0aW9uKGVycm9yLCByZWdpb25zKSB7XG4gICAgICAgICAgICBpZiAoZXJyb3IpIHtyZXR1cm4gY29uc29sZS5kZWJ1ZyhlcnJvcil9XG4gICAgICAgICAgICByZWdpb25MaXN0ID0gZm9ybWF0UmVnaW9ucyhyZWdpb25zKTtcbiAgICAgICAgICAgIGRyYXcocmVnaW9uTGlzdCk7XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJlZ2lvbkxpc3QgPSBmb3JtYXRSZWdpb25zKHJlZ2lvbkRhdGEpO1xuICAgICAgICBkcmF3KHJlZ2lvbkxpc3QpO1xuICAgIH1cblxufTtcblxuXG5NdXRzTmVlZGxlUGxvdC5wcm90b3R5cGUuZHJhd0F4ZXMgPSBmdW5jdGlvbihzdmcpIHtcblxuICAgIHZhciB5ID0gdGhpcy55O1xuICAgIHZhciB4ID0gdGhpcy54O1xuXG4gICAgeEF4aXMgPSBkMy5zdmcuYXhpcygpLnNjYWxlKHgpLm9yaWVudChcImJvdHRvbVwiKTtcblxuICAgIHN2Zy5hcHBlbmQoXCJzdmc6Z1wiKVxuICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcIngtYXhpcyBheGlzXCIpXG4gICAgICAuYXR0cihcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZSgwLFwiICsgKHRoaXMuaGVpZ2h0IC0gdGhpcy5idWZmZXIpICsgXCIpXCIpXG4gICAgICAuY2FsbCh4QXhpcyk7XG5cbiAgICB5QXhpcyA9IGQzLnN2Zy5heGlzKCkuc2NhbGUoeSkub3JpZW50KFwibGVmdFwiKTtcblxuXG4gICAgc3ZnLmFwcGVuZChcInN2ZzpnXCIpXG4gICAgICAuYXR0cihcImNsYXNzXCIsIFwieS1heGlzIGF4aXNcIilcbiAgICAgIC8vU2V0IGhlaWdodCBvZiB5LWF4aXMgYSBsaXR0bGUgYml0IGhpZ2hlciBcbiAgICAgIC5hdHRyKFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKFwiICsgKHRoaXMuYnVmZmVyICogMS4yICsgLSAxMCkgICsgXCIsXCIgKyB5Ym9yZGVyICsgXCIpXCIpXG4gICAgICAuY2FsbCh5QXhpcyk7XG5cbiAgICAvLyBhcHBlYXJhbmNlIGZvciB4IGFuZCB5IGxlZ2VuZFxuICAgIGQzLnNlbGVjdEFsbChcIi5heGlzIHBhdGhcIilcbiAgICAgICAgLmF0dHIoJ2ZpbGwnLCAnbm9uZScpO1xuICAgIGQzLnNlbGVjdEFsbChcIi5kb21haW5cIilcbiAgICAgICAgLmF0dHIoJ3N0cm9rZScsICdibGFjaycpXG4gICAgICAgIC5hdHRyKCdzdHJva2Utd2lkdGgnLCAxKTtcblxuICAgIHN2Zy5hcHBlbmQoXCJ0ZXh0XCIpXG4gICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJ5LWxhYmVsXCIpXG4gICAgICAgIC5hdHRyKFwidGV4dC1hbmNob3JcIiwgXCJtaWRkbGVcIilcbiAgICAgICAgLmF0dHIoXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoXCIgKyAodGhpcy5idWZmZXIgLyAzKSArIFwiLFwiICsgKHRoaXMuaGVpZ2h0IC8gMiArIHlib3JkZXIpICsgXCIpLCByb3RhdGUoLTkwKVwiKVxuICAgICAgICAudGV4dCh0aGlzLmxlZ2VuZHMueSlcbiAgICAgICAgLmF0dHIoJ2ZvbnQtd2VpZ2h0JywgJ2JvbGQnKVxuICAgICAgICAuYXR0cignZm9udC1zaXplJywgMTIpO1xuXG4gICAgc3ZnLmFwcGVuZChcInRleHRcIilcbiAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIFwieC1sYWJlbFwiKVxuICAgICAgICAgIC5hdHRyKFwidGV4dC1hbmNob3JcIiwgXCJtaWRkbGVcIilcbiAgICAgICAgICAuYXR0cihcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZShcIiArICh0aGlzLndpZHRoIC8gMikgKyBcIixcIiArICh0aGlzLmhlaWdodCAtIHRoaXMuYnVmZmVyIC8gMykgKyBcIilcIilcbiAgICAgICAgICAudGV4dCh0aGlzLmxlZ2VuZHMueClcbiAgICAgICAgLmF0dHIoJ2ZvbnQtd2VpZ2h0JywgJ2JvbGQnKVxuICAgICAgICAuYXR0cignZm9udC1zaXplJywgMTIpO1xuICAgIFxufTtcblxuXG5cbk11dHNOZWVkbGVQbG90LnByb3RvdHlwZS5kcmF3TmVlZGxlcyA9IGZ1bmN0aW9uKHN2ZywgbXV0YXRpb25EYXRhLCByZWdpb25EYXRhKSB7XG5cbiAgICB2YXIgeSA9IHRoaXMueTtcbiAgICB2YXIgeCA9IHRoaXMueDtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBnZXRZQXhpcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4geTtcbiAgICB9O1xuXG4gICAgZm9ybWF0Q29vcmQgPSBmdW5jdGlvbihjb29yZCkge1xuICAgICAgIGlmIChjb29yZC5pbmRleE9mKFwiLVwiKSA+IC0xKSB7XG4gICAgICAgICAgIGNvb3JkcyA9IGNvb3JkLnNwbGl0KFwiLVwiKTtcblxuICAgICAgICAgICAvLyBwbGFjZSBuZWVkbGUgYXQgbWlkZGxlIG9mIGFmZmVjdGVkIHJlZ2lvblxuICAgICAgICAgICBjb29yZCA9IE1hdGguZmxvb3IoKHBhcnNlSW50KGNvb3Jkc1swXSkgKyBwYXJzZUludChjb29yZHNbMV0pKSAvIDIpO1xuXG4gICAgICAgICAgIC8vIGNoZWNrIGZvciBzcGxpY2Ugc2l0ZXM6IFwiPy05XCIgb3IgXCI5LT9cIlxuICAgICAgICAgICBpZiAoaXNOYU4oY29vcmQpKSB7XG4gICAgICAgICAgICAgICBpZiAoY29vcmRzWzBdID09IFwiP1wiKSB7IGNvb3JkID0gcGFyc2VJbnQoY29vcmRzWzFdKSB9XG4gICAgICAgICAgICAgICBlbHNlIGlmIChjb29yZHMgWzFdID09IFwiP1wiKSB7IGNvb3JkID0gcGFyc2VJbnQoY29vcmRzWzBdKSB9XG4gICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvb3JkID0gcGFyc2VJbnQoY29vcmQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb29yZDtcbiAgICB9O1xuXG4gICAgdGlwID0gdGhpcy50aXA7XG5cbiAgICAvLyBzdGFjayBuZWVkbGVzIGF0IHNhbWUgcG9zXG4gICAgbmVlZGxlUG9pbnQgPSB7fTtcbiAgICBoaWdoZXN0ID0gMDtcblxuICAgIHN0YWNrTmVlZGxlID0gZnVuY3Rpb24ocG9zLHZhbHVlLHBvaW50RGljdCkge1xuICAgICAgc3RpY2tIZWlnaHQgPSAwO1xuICAgICAgcG9zID0gXCJwXCIrU3RyaW5nKHBvcyk7XG4gICAgICBpZiAocG9zIGluIHBvaW50RGljdCkge1xuICAgICAgICAgc3RpY2tIZWlnaHQgPSBwb2ludERpY3RbcG9zXTtcbiAgICAgICAgIG5ld0hlaWdodCA9IHN0aWNrSGVpZ2h0ICsgdmFsdWU7XG4gICAgICAgICBwb2ludERpY3RbcG9zXSA9IG5ld0hlaWdodDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICBwb2ludERpY3RbcG9zXSA9IHZhbHVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0aWNrSGVpZ2h0O1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiBmb3JtYXRNdXRhdGlvbkVudHJ5KGQpIHtcblxuICAgICAgICBjb29yZFN0cmluZyA9IGQuY29vcmQ7XG4gICAgICAgIG51bWVyaWNDb29yZCA9IGZvcm1hdENvb3JkKGQuY29vcmQpO1xuICAgICAgICBudW1lcmljVmFsdWUgPSBOdW1iZXIoZC52YWx1ZSk7XG4gICAgICAgIHN0aWNrSGVpZ2h0ID0gc3RhY2tOZWVkbGUobnVtZXJpY0Nvb3JkLCBudW1lcmljVmFsdWUsIG5lZWRsZVBvaW50KTtcbiAgICAgICAgY2F0ZWdvcnkgPSBkLmNhdGVnb3J5IHx8IFwib3RoZXJcIjtcblxuICAgICAgICBpZiAoc3RpY2tIZWlnaHQgKyBudW1lcmljVmFsdWUgPiBoaWdoZXN0KSB7XG4gICAgICAgICAgICAvLyBzZXQgWS1BeGlzIGFsd2F5cyB0byBoaWdoZXN0IGF2YWlsYWJsZVxuICAgICAgICAgICAgaGlnaGVzdCA9IHN0aWNrSGVpZ2h0ICsgbnVtZXJpY1ZhbHVlO1xuICAgICAgICAgICAgZ2V0WUF4aXMoKS5kb21haW4oWzAsIGhpZ2hlc3QgKyAyXSk7XG4gICAgICAgIH1cblxuXG4gICAgICAgIGlmIChudW1lcmljQ29vcmQgPiAwKSB7XG5cbiAgICAgICAgICAgIC8vIHJlY29yZCBhbmQgY291bnQgY2F0ZWdvcmllc1xuICAgICAgICAgICAgc2VsZi50b3RhbENhdGVnQ291bnRzW2NhdGVnb3J5XSA9IChzZWxmLnRvdGFsQ2F0ZWdDb3VudHNbY2F0ZWdvcnldIHx8IDApICsgbnVtZXJpY1ZhbHVlO1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGNhdGVnb3J5OiBjYXRlZ29yeSxcbiAgICAgICAgICAgICAgICBjb29yZFN0cmluZzogY29vcmRTdHJpbmcsXG4gICAgICAgICAgICAgICAgY29vcmQ6IG51bWVyaWNDb29yZCxcbiAgICAgICAgICAgICAgICB2YWx1ZTogbnVtZXJpY1ZhbHVlLFxuICAgICAgICAgICAgICAgIHN0aWNrSGVpZ2h0OiBzdGlja0hlaWdodCxcbiAgICAgICAgICAgICAgICBjb2xvcjogc2VsZi5jb2xvclNjYWxlKGNhdGVnb3J5KVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5kZWJ1ZyhcImRpc2NhcmRpbmcgXCIgKyBkLmNvb3JkICsgXCIgXCIgKyBkLmNhdGVnb3J5ICsgXCIoXCIrIG51bWVyaWNDb29yZCArXCIpXCIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIG11dHMgPSBbXTtcblxuXG4gICAgaWYgKHR5cGVvZiBtdXRhdGlvbkRhdGEgPT0gXCJzdHJpbmdcIikge1xuICAgICAgICBkMy5qc29uKG11dGF0aW9uRGF0YSwgZnVuY3Rpb24oZXJyb3IsIHVuZm9ybWF0dGVkTXV0cykge1xuICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBtdXRzID0gcHJlcGFyZU11dHModW5mb3JtYXR0ZWRNdXRzKTtcbiAgICAgICAgICAgIHBhaW50TXV0cyhtdXRzKTtcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbXV0cyA9IHByZXBhcmVNdXRzKG11dGF0aW9uRGF0YSk7XG4gICAgICAgIHBhaW50TXV0cyhtdXRzKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcmVwYXJlTXV0cyh1bmZvcm1hdHRlZE11dHMpIHtcbiAgICAgICAgZm9yIChrZXkgaW4gdW5mb3JtYXR0ZWRNdXRzKSB7XG4gICAgICAgICAgICBmb3JtYXR0ZWQgPSBmb3JtYXRNdXRhdGlvbkVudHJ5KHVuZm9ybWF0dGVkTXV0c1trZXldKTtcbiAgICAgICAgICAgIGlmIChmb3JtYXR0ZWQgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgbXV0cy5wdXNoKGZvcm1hdHRlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG11dHM7XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBwYWludE11dHMobXV0cykge1xuXG4gICAgICAgIG1pblNpemUgPSA0O1xuICAgICAgICBtYXhTaXplID0gMTA7XG4gICAgICAgIGhlYWRTaXplU2NhbGUgPSBkMy5zY2FsZS5sb2coKS5yYW5nZShbbWluU2l6ZSxtYXhTaXplXSkuZG9tYWluKFsxLCBoaWdoZXN0LzJdKTtcbiAgICAgICAgXG4gICAgICAgIGlmKCF1bmlxdWVIZWFkU2l6ZSkge1xuICAgICAgICAgICAgdmFyIGhlYWRTaXplID0gZnVuY3Rpb24obikge1xuICAgICAgICAgICAgICAgIHJldHVybiBkMy5taW4oW2QzLm1heChbaGVhZFNpemVTY2FsZShuKSxtaW5TaXplXSksIG1heFNpemVdKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICAgIC8vVW5pcXVlIEhlYWQgU2l6ZXNcbiAgICAgICAgICAgIHZhciBoZWFkU2l6ZSA9IGZ1bmN0aW9uKG4pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gNTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG5cbiAgICAgICAgdmFyIG5lZWRsZXMgPSBkMy5zZWxlY3QoXCIubXV0bmVlZGxlc1wiKS5zZWxlY3RBbGwoKVxuICAgICAgICAgICAgLmRhdGEobXV0cykuZW50ZXIoKVxuICAgICAgICAgICAgLmFwcGVuZChcImxpbmVcIilcbiAgICAgICAgICAgIC5hdHRyKFwieTFcIiwgZnVuY3Rpb24oZGF0YSkgeyByZXR1cm4geShkYXRhLnN0aWNrSGVpZ2h0ICsgZGF0YS52YWx1ZSkgKyBoZWFkU2l6ZShkYXRhLnZhbHVlKSArIHlib3JkZXIgOyB9IClcbiAgICAgICAgICAgIC5hdHRyKFwieTJcIiwgZnVuY3Rpb24oZGF0YSkgeyByZXR1cm4geShkYXRhLnN0aWNrSGVpZ2h0KSB9KVxuICAgICAgICAgICAgLmF0dHIoXCJ4MVwiLCBmdW5jdGlvbihkYXRhKSB7IHJldHVybiB4KGRhdGEuY29vcmQpIH0pXG4gICAgICAgICAgICAuYXR0cihcIngyXCIsIGZ1bmN0aW9uKGRhdGEpIHsgcmV0dXJuIHgoZGF0YS5jb29yZCkgfSlcbiAgICAgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJuZWVkbGUtbGluZVwiKVxuICAgICAgICAgICAgLmF0dHIoXCJzdHJva2VcIiwgXCJibGFja1wiKVxuICAgICAgICAgICAgLmF0dHIoXCJzdHJva2Utd2lkdGhcIiwgMSk7XG5cbiAgICAgICAgdmFyIG5lZWRsZUhlYWRzID0gZDMuc2VsZWN0KFwiLm11dG5lZWRsZXNcIikuc2VsZWN0QWxsKClcbiAgICAgICAgICAgIC5kYXRhKG11dHMpXG4gICAgICAgICAgICAuZW50ZXIoKS5hcHBlbmQoXCJjaXJjbGVcIilcbiAgICAgICAgICAgIC5hdHRyKFwiY3lcIiwgZnVuY3Rpb24oZGF0YSkgeyByZXR1cm4geShkYXRhLnN0aWNrSGVpZ2h0K2RhdGEudmFsdWUpICsgeWJvcmRlciB9IClcbiAgICAgICAgICAgIC5hdHRyKFwiY3hcIiwgZnVuY3Rpb24oZGF0YSkgeyByZXR1cm4geChkYXRhLmNvb3JkKSB9IClcbiAgICAgICAgICAgIC5hdHRyKFwiclwiLCBmdW5jdGlvbihkYXRhKSB7IHJldHVybiBoZWFkU2l6ZShkYXRhLnZhbHVlKSB9KVxuICAgICAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcIm5lZWRsZS1oZWFkXCIpXG4gICAgICAgICAgICAuc3R5bGUoXCJmaWxsXCIsIGZ1bmN0aW9uKGRhdGEpIHsgcmV0dXJuIGRhdGEuY29sb3IgfSlcbiAgICAgICAgICAgIC5zdHlsZShcInN0cm9rZVwiLCBmdW5jdGlvbihkYXRhKSB7cmV0dXJuIGQzLnJnYihkYXRhLmNvbG9yKS5kYXJrZXIoKX0pXG4gICAgICAgICAgICAub24oJ21vdXNlb3ZlcicsICBmdW5jdGlvbihkKXsgZDMuc2VsZWN0KHRoaXMpLm1vdmVUb0Zyb250KCk7IHRpcC5zaG93KGQpOyB9KVxuICAgICAgICAgICAgLm9uKCdtb3VzZW91dCcsIHRpcC5oaWRlKTtcblxuICAgICAgICBkMy5zZWxlY3Rpb24ucHJvdG90eXBlLm1vdmVUb0Zyb250ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnROb2RlLmFwcGVuZENoaWxkKHRoaXMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gYWRqdXN0IHktc2NhbGUgYWNjb3JkaW5nIHRvIGhpZ2hlc3QgdmFsdWUgYW4gZHJhdyB0aGUgcmVzdFxuICAgICAgICBpZiAocmVnaW9uRGF0YSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHNlbGYuZHJhd1JlZ2lvbnMoc3ZnLCByZWdpb25EYXRhKTtcbiAgICAgICAgfVxuICAgICAgICBzZWxmLmRyYXdMZWdlbmQoc3ZnKTtcbiAgICAgICAgc2VsZi5kcmF3QXhlcyhzdmcpO1xuXG4gICAgICAgIC8qIEJyaW5nIG5lZWRsZSBoZWFkcyBpbiBmcm9udCBvZiByZWdpb25zICovXG4gICAgICAgIG5lZWRsZUhlYWRzLmVhY2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0aGlzLnBhcmVudE5vZGUuYXBwZW5kQ2hpbGQodGhpcyk7XG4gICAgICAgIH0pO1xuICAgIH1cblxufTtcblxuXG5cbnZhciBFdmVudHMgPSByZXF1aXJlKCdiaW9qcy1ldmVudHMnKTtcbkV2ZW50cy5taXhpbihNdXRzTmVlZGxlUGxvdC5wcm90b3R5cGUpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE11dHNOZWVkbGVQbG90O1xuXG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCIuL3NyYy9qcy9NdXRzTmVlZGxlUGxvdC5qc1wiKTtcbiJdfQ==
