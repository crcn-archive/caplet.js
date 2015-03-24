(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (process,global){
exports.Model                 = require("./model").createClass();
exports.Collection            = require("./collection").createClass();
exports.createModelClass      = require("./model").createClass;
exports.createCollectionClass = require("./collection").createClass;
exports.setVirtuals           = require("./set-virtuals");
exports.load                  = require("./load");
exports.singleton             = require("./singleton");
exports.save                  = require("./save");
exports.watchProperty         = require("./watch-property");
exports.bindProperty          = require("./bind-property");
exports.watchModelsMixin      = require("./watch-models-mixin");

if (process.browser) {
  global.Caplet = module.exports;
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./bind-property":2,"./collection":3,"./load":4,"./model":5,"./save":6,"./set-virtuals":7,"./singleton":8,"./watch-models-mixin":9,"./watch-property":10,"_process":11}],2:[function(require,module,exports){
var watchProperty = require("./watch-property");

module.exports = function(fromTarget, fromProperty, toTarget, toProperty) {

  if (!toProperty) toProperty = fromProperty;

  if (typeof toTarget === "string") {
    toProperty = toTarget;
    toTarget   = fromTarget;
  }

  var watcher = watchProperty(fromTarget, fromProperty, function(value) {
    toTarget.set(toProperty, value);
  });

  return watcher;
};

},{"./watch-property":10}],3:[function(require,module,exports){
var WatchableCollection = require("watchable-collection");
var FastEventEmitter    = require("fast-event-emitter");
var watchProperty       = require("./watch-property");
var Model               = require("./model").createClass();
var extend              = require("xtend");

function Collection(sourceOrProperties) {

  var properties = {};

  if (!sourceOrProperties) sourceOrProperties = {};

  if (Object.prototype.toString.call(sourceOrProperties) === "[object Array]") {
    properties.source = sourceOrProperties;
  } else {
    properties = sourceOrProperties;
  }

  if (this.getInitialProperties) properties = extend({}, this.getInitialProperties(), properties);

  WatchableCollection.call(this);
  this.setProperties(properties);
  this.createModel   = this.createModel.bind(this);
  this.onDataChange  = this.onDataChange.bind(this);
  this._emitter      = new FastEventEmitter();

  watchProperty(this, "data", this.onDataChange).trigger();
  this.watch(this._watchModels.bind(this));
  this.initialize();
  if (this.onChange) this.watch(this.onChange.bind(this));
  this._watchModels();

}

WatchableCollection.extend(Collection, {

  /**
   */

  modelClass: Model,

  /**
   */

  initialize: function() {
  },

  /**
   */

  createModel: function(properties) {
    return new this.modelClass(properties);
  },

  /**
   */

  create: function(properties) {
    var model = this.createModel(properties);

    if (!properties.waitUntilSave) {
      this.push(model);
    }

    return model;
  },

  /**
   * deserialize data from the this.data
   */

  fromData: function(data) {
    var self = this;
    return {
      source: this.castModels(data)
    };
  },

  /**
   */

  toData: function() {
    return this.source;
  },

  /**
   */

  toJSON: function() {
    return this.toData();
  },

  /**
   */

  onDataChange: function(data) {
    var properties = this.fromData(data);
    properties.source = this.mergeSource(properties.source);
    this.setProperties(properties);
  },

  /**
   */

  mergeSource: function(nsource) {
    var mergedSource = nsource.concat();

    var csource    = this.source;

    for (var i = nsource.length; i--;) {
      var amodel = nsource[i];

      for (var j = csource.length; j--;) {
        var bmodel = csource[j];
        if (amodel.equals(bmodel)) {
          bmodel.set("data", amodel.toData());
          mergedSource.splice(i, 1, bmodel); // use existing model - resort
          break;
        }
      }
    }

    return mergedSource;
  },

  /**
   */

  castModels: function(source) {
    var self = this;
    return (source || []).map(function(data) {
      return self.createModel({ data: data });
    });
  },

  /**
   */

  _watchModels: function() {
    this._unwatchModels();
    this._modelListeners = [];
    var onChange = this._onChange.bind(this);

    this.source.forEach(function(model) {
      this._modelListeners.push(model.watch(onChange));
      this._modelListeners.push(model._emitter.once("dispose", function() {
        this.splice(this.indexOf(model), 1);
      }.bind(this)));
    }.bind(this));
  },

  /**
   */

  _unwatchModels: function() {
    if (!this._modelListeners) return;
    for (var i = this._modelListeners.length; i--;) {
      this._modelListeners[i].dispose();
    }
    this._modelListeners = void 0;
  }
});

Collection.createClass = function(properties) {

  function ChildCollection(properties) {

    if (!(this instanceof Collection)) {
      return new ChildCollection(properties);
    }

    Collection.call(this, properties);
  }

  Collection.extend(ChildCollection, properties);
  return ChildCollection;
};

module.exports = Collection;

},{"./model":5,"./watch-property":10,"fast-event-emitter":12,"watchable-collection":14,"xtend":17}],4:[function(require,module,exports){
var singleton = require("./singleton");

module.exports = function(target, load, onLoad) {
  singleton(target, "load", load, function(err, data) {
    if (err) return onLoad(err);
    target.set("data", data);
    onLoad(null, target);
  });
};

},{"./singleton":8}],5:[function(require,module,exports){
var WatchableObject  = require("watchable-object");
var FastEventEmitter = require("fast-event-emitter");
var watchProperty    = require("./watch-property");
var extend           = require("xtend");

/**
 */

function isObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

/**
 */

function Model(properties) {

  // only set props

  properties = isObject(properties) ? properties : { data: properties };
  if (this.getInitialProperties) properties = extend({}, this.getInitialProperties(), properties);

  WatchableObject.call(this, properties);

  this._emitter = new FastEventEmitter();

  watchProperty(this, "data", this.onDataChange.bind(this)).trigger();
  this.initialize();

  if (this.onChange) this.watch(this.onChange.bind(this));
}

/**
 */

WatchableObject.extend(Model, {

  /**
   */

  initialize: function() {
  },

  /**
   * deserialize data from the this.data
   */

  fromData: function(data) {
    return isObject(data) ? data : {};
  },

  /**
   * serialize this model back into a data object
   */

  toData: function() {
    var data   = {};
    var target = this.data ? this.data : this;

    if (!isObject(target)) {
      return target;
    }

    for (var key in target) {
      data[key] = target[key];
    }

    return data;
  },

  /**
   */

  equals: function(model) {
    return (this.uid && this.uid === model.uid) || this.data === model.data;
  },

  /**
   */

  toJSON: function() {
    return this.toData();
  },

  /**
   */

  onDataChange: function(data) {
    this.setProperties(this.fromData(data));
  },

  /**
   * asynchronous
   */

  get: function(keypath) {
    var ret = WatchableObject.prototype.get.call(this, keypath);
    if (ret != void 0) return ret;
    var missingProperty = (typeof keypath === "string" ? keypath.split(".") : keypath)[0];
    if (!this._missingProperties) this._missingProperties = {};
    if (this._missingProperties[missingProperty]) return;
    this._emitter.emit("missingProperty", this._missingProperties[missingProperty] = missingProperty);
  },

  /**
   */

  dispose: function() {
    WatchableObject.prototype.dispose.call(this);
    this._emitter.emit("dispose");
  }
});

Model.createClass = function(properties) {

  function ChildModel(properties) {

    if (!(this instanceof Model)) {
      return new ChildModel(properties);
    }

    Model.call(this, properties);
  }

  Model.extend(ChildModel, properties);
  return ChildModel;
};

module.exports = Model;

},{"./watch-property":10,"fast-event-emitter":12,"watchable-object":16,"xtend":17}],6:[function(require,module,exports){
module.exports = function(target, create, update) {
  if (target.uid) {
    return update.call(target);
  } else {
    return create.call(target);
  }
};

},{}],7:[function(require,module,exports){
(function (process){
var extend = require("xtend");

module.exports = function(target, virtuals) {

  if (target.virtuals) {
    return extend(target.virtuals, virtuals);
  }

  target.virtuals = virtuals;

  target._emitter.on("missingProperty", function(property) {
    if (!(property in target.virtuals)) return;
    target.virtuals[property].call(target, function(err, value) {
      if (err) return target._emitter.emit("error", err);

      // for testing
      if (!process.browser) return target.set(property, value);

      // enforce async
      process.nextTick(function() {
        target.set(property, value);
      });
    });
  });
};

}).call(this,require('_process'))
},{"_process":11,"xtend":17}],8:[function(require,module,exports){
module.exports = function(target, property, load, onLoad) {
  if (!target._singletons) target._singletons = {};
  var event = "singleton:" + property;
  target._emitter.once(event, onLoad || function() { });
  var singleton = target._singletons[property];
  if (singleton != void 0) return singleton;

  target._singletons[property] = singleton = {
    dispose: function() {
      target._singletons[property] = void 0;
    }
  };

  load(function(err, value) {
    target._emitter.emit.apply(target._emitter, [event, err, value]);
  });

  return singleton;
};

},{}],9:[function(require,module,exports){

function _hasChanged(from, to) {
  for (var key in from) {
    if (from[key] !== to[key]) return true;
  }
  return false;
}

module.exports = {

  /**
   */

  componentDidMount: function() {
    this._watch();
  },

  /**
   */

  componentWillUpdate: function() {
    this._watch();
  },

  /**
   */

  shouldComponentUpdate: function(nextProps, nextState) {
    return _hasChanged(this.props, nextProps) ||
    _hasChanged(nextProps, this.props)        ||
    _hasChanged(this.state, nextState)        ||
    _hasChanged(nextState, this.state);
  },

  /**
   */

  componentWillUnmount: function() {
    this._unwatch();
  },

  /**
   */

  _watch: function() {
    this._unwatch();
    this._watchers = [];
    this._watchDict(this.props);
    this._watchDict(this.state);
  },

  /**
   */

  _watchDict: function(dict) {
    var forceUpdate = this.forceUpdate.bind(this);
    for (var key in dict) {
      var value = dict[key];
      if (value && value.watch) {
        this._watchers.push(dict[key].watch(forceUpdate));
      }
    }
  },

  /**
   */

  _unwatch: function() {
    if (this._watchers)
    for (var i = this._watchers.length; i--;) {
      this._watchers[i].dispose();
    }
    this._watchers = void 0;
  }
};

},{}],10:[function(require,module,exports){

module.exports = function(target, property, listener) {

  var oldValue;
  var disposable;

  var watcher = {
    trigger: function() {
      var currentValue = target.get(property);
      if (oldValue === currentValue) {
        return watcher;
      }
      oldValue = currentValue;
      listener(currentValue, oldValue);
      return watcher;
    },
    dispose: function() {
      disposable.dispose();
      return watcher;
    }
  };

  disposable = target.watch(watcher.trigger);

  return watcher;
};

},{}],11:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;

function drainQueue() {
    if (draining) {
        return;
    }
    draining = true;
    var currentQueue;
    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        var i = -1;
        while (++i < len) {
            currentQueue[i]();
        }
        len = queue.length;
    }
    draining = false;
}
process.nextTick = function (fun) {
    queue.push(fun);
    if (!draining) {
        setTimeout(drainQueue, 0);
    }
};

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],12:[function(require,module,exports){
"use strict";
var protoclass = require("protoclass");

/**
 * @module mojo
 * @submodule mojo-core
 */

/**
 * @class EventEmitter
 */

function EventEmitter () {
  this.__events = {};
}

/**
 * adds a listener on the event emitter
 *
 * @method on
 * @param {String} event event to listen on
 * @param {Function} listener to callback when `event` is emitted.
 * @returns {Disposable}
 */


EventEmitter.prototype.on = function (event, listener) {

  if (typeof listener !== "function") {
    throw new Error("listener must be a function for event '"+event+"'");
  }

  var listeners;
  if (!(listeners = this.__events[event])) {
    this.__events[event] = listener;
  } else if (typeof listeners === "function") {
    this.__events[event] = [listeners, listener];
  } else {
    listeners.push(listener);
  }

  var self = this;

  return {
    dispose: function() {
      self.off(event, listener);
    }
  };
};

/**
 * removes an event emitter
 * @method off
 * @param {String} event to remove
 * @param {Function} listener to remove
 */

EventEmitter.prototype.off = function (event, listener) {

  var listeners;

  if(!(listeners = this.__events[event])) {
    return;
  }

  if (typeof listeners === "function") {
    this.__events[event] = undefined;
  } else {
    var i = listeners.indexOf(listener);
    if (~i) listeners.splice(i, 1);
    if (!listeners.length) {
      this.__events[event] = undefined;
    }
  }
};

/**
 * adds a listener on the event emitter
 * @method once
 * @param {String} event event to listen on
 * @param {Function} listener to callback when `event` is emitted.
 * @returns {Disposable}
 */


EventEmitter.prototype.once = function (event, listener) {

  if (typeof listener !== "function") {
    throw new Error("listener must be a function for event '"+event+"'");
  }

  function listener2 () {
    disp.dispose();
    listener.apply(this, arguments);
  }

  var disp = this.on(event, listener2);
  disp.target = this;
  return disp;
};

/**
 * emits an event
 * @method emit
 * @param {String} event
 * @param {String}, `data...` data to emit
 */


EventEmitter.prototype.emit = function (event) {

  if (this.__events[event] === undefined) return;

  var listeners = this.__events[event],
  n = arguments.length,
  args,
  i,
  j;

  if (typeof listeners === "function") {
    if (n === 1) {
      listeners();
    } else {
      switch(n) {
        case 2:
          listeners(arguments[1]);
          break;
        case 3:
          listeners(arguments[1], arguments[2]);
          break;
        case 4:
          listeners(arguments[1], arguments[2], arguments[3]);
          break;
        default:
          args = new Array(n - 1);
          for(i = 1; i < n; i++) args[i-1] = arguments[i];
          listeners.apply(this, args);
    }
  }
  } else {
    args = new Array(n - 1);
    for(i = 1; i < n; i++) args[i-1] = arguments[i];
    for(j = listeners.length; j--;) {
      if(listeners[j]) listeners[j].apply(this, args);
    }
  }
};

/**
 * removes all listeners
 * @method removeAllListeners
 * @param {String} event (optional) removes all listeners of `event`. Omitting will remove everything.
 */

EventEmitter.prototype.removeAllListeners = function (event) {
  if (arguments.length === 1) {
    this.__events[event] = undefined;
  } else {
    this.__events = {};
  }
};

module.exports = EventEmitter;

},{"protoclass":13}],13:[function(require,module,exports){
function _copy (to, from) {

  for (var i = 0, n = from.length; i < n; i++) {

    var target = from[i];

    for (var property in target) {
      to[property] = target[property];
    }
  }

  return to;
}

function protoclass (parent, child) {

  var mixins = Array.prototype.slice.call(arguments, 2);

  if (typeof child !== "function") {
    if(child) mixins.unshift(child); // constructor is a mixin
    child   = parent;
    parent  = function() { };
  }

  _copy(child, parent); 

  function ctor () {
    this.constructor = child;
  }

  ctor.prototype  = parent.prototype;
  child.prototype = new ctor();
  child.__super__ = parent.prototype;
  child.parent    = child.superclass = parent;

  _copy(child.prototype, mixins);

  protoclass.setup(child);

  return child;
}

protoclass.setup = function (child) {


  if (!child.extend) {
    child.extend = function(constructor) {

      var args = Array.prototype.slice.call(arguments, 0);

      if (typeof constructor !== "function") {
        args.unshift(constructor = function () {
          constructor.parent.apply(this, arguments);
        });
      }

      return protoclass.apply(this, [this].concat(args));
    }

    child.mixin = function(proto) {
      _copy(this.prototype, arguments);
    }

    child.create = function () {
      var obj = Object.create(child.prototype);
      child.apply(obj, arguments);
      return obj;
    }
  }

  return child;
}


module.exports = protoclass;
},{}],14:[function(require,module,exports){
var WatchableObject = require("watchable-object");
var watchProperty   = require("./watchProperty");

function WatchableCollection(source) {
    WatchableObject.call(this);
    this.source = source || [];
    this.length = this.source.length;
    var self = this;
    watchProperty(this, "source", function() {
        self._onChange();
    }).trigger();
}

WatchableObject.extend(WatchableCollection, {

    /**
     */

    at: function(index) {
        return index < this.length ? this.source[index] : void 0;
    },

    /**
     */

    map: function(fn) {
        return this.source.map(fn);
    },

    /**
     */

    filter: function(fn) {
        return this.source.filter(fn);
    },

    /**
     */

    forEach: function(fn) {
        return this.source.forEach(fn);
    },

    /**
     */

    join: function(fn) {
        return this.source.join(fn);
    },

    /**
     */

    pop: function() {
        return this.splice(this.source.length - 1, 1).pop();
    },

    /**
     */

    shift: function() {
        return this.splice(0, 1).pop();
    },

    /**
     */

    push: function() {
        this.source.push.apply(this.source, arguments);
        this._onChange();
    },

    /**
     */

    unshift: function() {
        this.source.unshift.apply(this.source, arguments);
        this._onChange();
    },


    /**
     */

    indexOf: function(value) {
        return this.source.indexOf(value);
    },

    /**
     */

    splice: function(start, index) {
        var repl = Array.prototype.splice.apply(2, arguments);
        var ret = this.source.splice.apply(this.source, arguments);
        this._onChange();
        return ret;
    },

    /**
     */

    _onChange: function() {

        // trigger change
        this.setProperties({
            length: this.source.length
        });
    }
});

module.exports = WatchableCollection;
},{"./watchProperty":15,"watchable-object":16}],15:[function(require,module,exports){


module.exports = function(target, property, listener) {

    var oldValue, disposable;

     var watcher = {
        trigger: function() {
            var currentValue = target.get(property);
            if (oldValue === currentValue) {
                return;
            }
            oldValue = currentValue;
            listener(currentValue, oldValue);
        },
        dispose: function() {
            disposable.dispose();
        }
    };

    disposable = target.watch(watcher.trigger);

    return watcher;
}
},{}],16:[function(require,module,exports){
var protoclass = require("protoclass");

/**
 */

function WatchableObject(properties) {
  this.__watchable = {};
  if (properties) {
    for (var key in properties) {
      this._watchProperty(key, this[key] = properties[key]);
    }
  }
}

/**
 */

protoclass(WatchableObject, {

  /**
   */

  watch: function(listener) {

    if (!this._listeners) {
      this._listeners = listener;
    } else if (typeof this._listeners === "function") {
      this._listeners = [this._listeners, listener];
    } else {
      this._listeners.push(listener);
    }

    var self = this;

    return {
      dispose: function() {
        var i = 0;
        if (!self._listeners) return;
        if (typeof self._listeners !== "function" && ~(i = self._listeners.indexOf(listener))) {
          self._listeners.splice(i, 1);
          if (self._listeners.length === 0) self._listeners = void 0;
        } else {
          self._listeners = void 0;
        }
      }
    };
  },

  /**
   */

  get: function(property) {

    var isString;

    // optimal
    if ((isString = (typeof property === "string")) && !~property.indexOf(".")) {
      return this[property];
    }

    // avoid split if possible
    var chain = isString ? property.split(".") : property;
    var cv    = this;

    // go through all the properties
    for (var i = 0, n = chain.length - 1; i < n; i++) {

      cv    = cv[chain[i]];

      if (!cv) return;

      if (cv.get) return cv.get(property);
    }

    // might be a bindable objectc
    return cv[chain[i]];
  },

  /**
   */

  set: function(property, value, trigger) {
    var keypath;

    if (typeof property === "string") {
      keypath = property.split(".");
    } else {
      keypath = property;
    }

    var cv = this;
    var hasChanged = this.get(keypath) !== value;
    var nv;

    for (var i = 0, n = keypath.length - 1; i < n; i++) {
      nv = cv[keypath[i]];
      if (nv && nv.set) {
        return nv.set(keypath.slice(i + 1), value);
      } else if (!nv) {
        nv = cv[keypath[i]] = {};
      }

      cv = nv;
    }

    cv[keypath[i]] = value;

    this._watchProperty(property, value);
    if (trigger !== false) this._triggerChange();
  },

  /**
   */

  _watchProperty: function(property, value) {

    if (value === this) return;

    if (!value || !value.watch) {
      if (this.__watchable[property]) this.__watchable[property].dispose();
      this.__watchable[property] = void 0;
      var tov = Object.prototype.toString.call(value);
      if (tov === "[object Object]") {
        for (var key in value) {
          this._watchProperty(property + "." + key, value[key]);
        }
      }
      return;
    }

    var self = this;

    this.__watchable[property] = value.watch(function() {
      if (!self.get(property)) {
        return self._watchProperty(property, void 0);
      }
      self._triggerChange();
    });
  },

  /**
   */

  setProperties: function(properties) {
    for (var key in properties) {
      this.set(key, properties[key], false);
    }
    this._triggerChange();
  },

  /**
   */

  _triggerChange: function() {
    if (this._changing) return;
    this._changing = true;

    if (this._listeners) {
      if (typeof this._listeners === "function") {
        this._listeners();
      } else {
        for (var i = this._listeners.length; i--;) {
          this._listeners[i]();
        }
      }
    }
    this._changing = false;
  },

  /**
   */

  dispose: function() {
    for (var key in this.__watchable) {
      if (this.__watchable[key]) this.__watchable[key].dispose();
    }
    this.__watchable = {};
    this._listeners  = void 0;
  }
});

module.exports = WatchableObject;

},{"protoclass":13}],17:[function(require,module,exports){
module.exports = extend

function extend() {
    var target = {}

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}]},{},[1]);