interface ISignal {
    add(listener: () => void): void;
    remove(listener: () => void): void;
    trigger(...a: any[]): void;
}

class Signal implements ISignal {
    private listeners: any[] = [];

    public add(listener: () => void): void {
        this.listeners.push(listener);
    }
    public remove(listener?: () => void): void {
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
    }

    public trigger(...a: any[]): void {
        var context = {};
        var listeners = this.listeners.slice(0);
        for (var i = 0, l = listeners.length; i < l; i++) {
            listeners[i].apply(context, a || []);
        }
    }
}