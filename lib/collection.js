var WatchableCollection  = require("watchable-collection");
var watchProperty        = require("./watch-property");
var Model                = require("./model").createClass();
var extend               = require("xtend/mutable");
var missingPropertyMixin = require("./missing-property-mixin");
var _mixin               = require("./_mixin");

function Collection(sourceOrProperties) {

  var properties = {};
  var source;

  if (!sourceOrProperties) sourceOrProperties = {};

  if (Object.prototype.toString.call(sourceOrProperties) === "[object Array]") {
    properties.source = sourceOrProperties;
  } else {
    properties = sourceOrProperties;
  }

  if (this.getInitialProperties) {
    properties = extend({}, this.getInitialProperties(), properties);
  }

  WatchableCollection.call(this);

  this.setProperties(properties);

  this.createModel   = this.createModel.bind(this);

  var self = this;

  watchProperty(this, "data", this.onDataChange, true).trigger();

  this.initialize();

  if (this.onChange) this.watch(function() {
    self.onChange();
  });

}

WatchableCollection.extend(Collection, {

  /**
   */

  __isCollection: true,

  /**
   */

  modelClass: Model,

  /**
   */

  initialize: function() { },

  /**
   */

  createModel: function(properties) {
    var model = new this.modelClass(properties);
    this.onCreateModel(model);
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
    return this.source.map(function(model) {
      return model.toData();
    });
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

  onCreateModel: function(model) {
    // do stuff
  },

  /**
   */

  get: missingPropertyMixin.get,

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
    WatchableCollection.prototype._watchModels.call(this);
    this._unwatchModels();
    this._modelListeners = [];
    var self = this;
    var onChange = function() {
      self._onChange();
    };

    this.source.forEach(function(model) {
      self._modelListeners.push(model.once("dispose", function() {
        self.splice(self.indexOf(model), 1);
      }));
    });
  },

  /**
   */

  _unwatchModels: function() {
    if (!this._modelListeners) return;
    for (var i = this._modelListeners.length; i--;) {
      this._modelListeners[i].dispose();
    }
    this._modelListeners = void 0;
  },

  /**
   */

  dispose: function() {
    WatchableCollection.prototype.dispose.call(this);
    this.emit("dispose");
  }
});

var oldExtend = Collection.extend;
Collection.extend = function(properties) {

  var self = this;

  function ChildCollection(properties) {

    if (!(this instanceof self)) {
      return new ChildCollection(properties);
    }

    self.call(this, properties);
  }

  if (properties && properties.mixins) {
    properties = _mixin([properties].concat(properties.mixins));
  }

  oldExtend.call(self, ChildCollection, properties);
  ChildCollection.extend = Collection.extend;
  return ChildCollection;
};

Collection.createClass = Collection.extend.bind(Collection);

module.exports = Collection;
