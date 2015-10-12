define(["require", "exports"], function(require, exports) {
    var Event = (function () {
        function Event() {
            this.listeners = [];
        }
        Event.prototype.add = function (listener) {
            this.listeners.push(listener);
        };
        Event.prototype.remove = function (listener) {
            if (typeof listener === 'function') {
                for (var i = 0, l = this.listeners.length; i < l; l++) {
                    if (this.listeners[i] === listener) {
                        this.listeners.splice(i, 1);
                        break;
                    }
                }
            } else {
                this.listeners = [];
            }
        };

        Event.prototype.trigger = function () {
            var a = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                a[_i] = arguments[_i + 0];
            }
            var context = {};
            var listeners = this.listeners.slice(0);
            for (var i = 0, l = listeners.length; i < l; i++) {
                listeners[i].apply(context, a || []);
            }
        };
        return Event;
    })();
    exports.Event = Event;
});
