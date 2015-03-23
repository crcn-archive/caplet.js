
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
    },

    /**
     */

    _watch: function() {
        this._unwatch();
        this._watchers = [];
        this._watchDict(this.props);
        this._watchDict(this.state);
    }
}