var Signal = (function () {
    function Signal() {
        this.listeners = [];
    }
    Signal.prototype.add = function (listener) {
        this.listeners.push(listener);
    };
    Signal.prototype.remove = function (listener) {
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

    Signal.prototype.trigger = function () {
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
    return Signal;
})();
/// <reference path="Scripts/typings/jquery/jquery.d.ts" />
/// <reference path="signal.ts" />

String.prototype.format = function () {
    var args = [];
    for (var _i = 0; _i < (arguments.length - 0); _i++) {
        args[_i] = arguments[_i + 0];
    }
    return this.replace(/{(\d+)}/g, function (match, idx) {
        return typeof args[idx] != 'undefined' ? args[idx] : match;
    });
};

var Api = (function () {
    function Api(url, key) {
        this.url = 'http://api.tumblr.com/v2/blog/{0}/'.format(url);
        this.key = key;

        this.onUrlNotFound = new Signal();
    }
    Api.prototype.make = function (path, args, callback) {
        var _this = this;
        var data = {
            api_key: this.key
        };
        $.extend(data, args);
        $.ajax({
            url: this.url + path,
            data: data,
            dataType: 'jsonp',
            success: function (res) {
                if (res.meta.status == 404) {
                    _this.onUrlNotFound.trigger();
                    return;
                }

                callback(res);
            },
            error: function () {
                alert('Error');
            }
        });
    };
    return Api;
})();

var Song = (function () {
    function Song() {
    }
    return Song;
})();

var SongPlayer = (function () {
    function SongPlayer(player) {
        var _this = this;
        this.song = null;
        this.playing = false;

        this.player = player;
        this.audio = this.player[0];

        this.onPlay = new Signal();
        this.onPause = new Signal();
        this.onEnd = new Signal();

        this.audio.onended = function () {
            _this.playing = false;
            _this.onEnd.trigger();
        };
    }
    Object.defineProperty(SongPlayer.prototype, "isPlaying", {
        get: function () {
            return this.playing;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(SongPlayer.prototype, "time", {
        get: function () {
            return this.audio.currentTime;
        },
        set: function (pos) {
            this.audio.currentTime = pos;
        },
        enumerable: true,
        configurable: true
    });


    SongPlayer.prototype.play = function (song) {
        if (typeof song === "undefined") { song = null; }
        if (song) {
            if (song === this.song) {
                return;
            }

            this.song = song;
            this.player.attr('src', song.url);
        } else if (!this.song) {
            return;
        }

        this.audio.play();
        this.playing = true;
        this.onPlay.trigger();
    };

    SongPlayer.prototype.pause = function () {
        this.audio.pause();
        this.playing = false;
        this.onPause.trigger();
    };
    return SongPlayer;
})();

var SongTable = (function () {
    function SongTable(api, table) {
        this.api = api;
        this.table = table.find('tbody:last');

        this.offset = 0;
        this.total = -1;

        this.busy = false;
        this.row = null;

        this.onSongCount = new Signal();
        this.onSongSelected = new Signal();
    }
    Object.defineProperty(SongTable.prototype, "prevSong", {
        get: function () {
            var prev = !this.row ? this.table.find('tr').last() : this.row.prev();

            if (!prev) {
                return null;
            }

            this.updateRow(prev);
            return this.row.data('song');
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(SongTable.prototype, "nextSong", {
        get: function () {
            var next = !this.row ? this.table.find('tr').first() : this.row.next();

            if (!next) {
                return null;
            }

            this.updateRow(next);
            return this.row.data('song');
        },
        enumerable: true,
        configurable: true
    });

    SongTable.prototype.updateRow = function (row) {
        if (this.row) {
            if (this.row === row) {
                return;
            }

            this.row.removeClass('success');
            this.row.find('.song-by').addClass('text-muted');
            this.row.find('.glyphicon').css('visibility', 'hidden');
        }
        row.addClass('success');
        row.find('.song-by').removeClass('text-muted');
        row.find('.glyphicon').css('visibility', 'visible');

        this.row = row;
        this.onSongSelected.trigger(this.row.data('song'));
    };

    SongTable.prototype.loadSongs = function () {
        var _this = this;
        if (this.busy) {
            return true;
        }

        if (this.offset == this.total) {
            return false;
        }

        this.busy = true;

        this.api.make('posts/audio', { offset: this.offset }, function (res) {
            if (res.meta.status != 200) {
                alert(res.meta.status);
                return;
            }
            var posts = res.response.posts;

            _this.offset += posts.length;

            _this.total = res.response.total_posts;
            _this.onSongCount.trigger(_this.offset, _this.total);

            console.log('loaded (+{2}): {0} / {1}'.format(_this.offset, _this.total, posts.length));

            $.each(posts, function (idx, json) {
                var row = $('<tr></tr>');
                var title = [];
                var song = new Song();

                song.name = json.hasOwnProperty('track_name') ? json.track_name : '(unknown)';
                song.artist = json.hasOwnProperty('artist') ? json.artist : '(unknown)';

                title.push('<strong>' + song.name + '</strong>');
                title.push(' ');

                title.push('<span class="song-by text-muted">by ');
                title.push(song.artist);
                title.push('</span>');

                row.append($('<td><span class="glyphicon glyphicon-music" aria-hidden="true"></span>&nbsp;' + title.join('') + '</td>'));
                row.find('.glyphicon').css('visibility', 'hidden');

                song.url = json.audio_url;
                song.albumArt = json.hasOwnProperty('album_art') ? json.album_art : '';
                song.postUrl = json.hasOwnProperty('post_url') ? json.post_url : '';

                if (song.url.indexOf('www.tumblr.com') >= 0) {
                    var id = song.url.substr(song.url.lastIndexOf('/') + 1);
                    song.url = 'https://a.tumblr.com/{0}o1.mp3'.format(id);
                }

                row.data('song', song);

                row.click(function (ev) {
                    return _this.updateRow(row);
                });

                var timer;
                row.on('mousedown', function () {
                    return timer = setTimeout(function () {
                        $('#song-modal #name').text(song.name);
                        $('#song-modal #artist').text(song.artist);
                        $('#song-modal #album-art').attr('src', song.albumArt);
                        $('#song-modal #post-url').attr('href', song.postUrl);
                        bootbox.dialog({
                            message: $('#song-modal').html(),
                            title: song.name,
                            buttons: {
                                close: {
                                    label: 'Close',
                                    className: 'btn-primary',
                                    callback: function () {
                                    }
                                }
                            }
                        });
                    }, 1000);
                });
                row.on('mouseup mouseleave', function () {
                    return clearTimeout(timer);
                });

                _this.table.append(row);
            });

            _this.busy = false;
        });

        return true;
    };
    return SongTable;
})();

function urlParam(param) {
    var pageUrl = window.location.search.substring(1);
    var urlVars = pageUrl.split('&');
    for (var i = 0; i < urlVars.length; i++) {
        var name = urlVars[i].split('=');
        if (name[0] == param) {
            return name[1];
        }
    }

    return null;
}

function promptTumblrName() {
    bootbox.prompt({
        title: 'What is your Tumblr address?',
        value: 'my-url.tumblr.com',
        callback: function (result) {
            if (!result) {
                promptTumblrName();
                return;
            }

            window.location.replace('?name=' + result);
        }
    });
}

function confirmUnload(e) {
    e = e || window.event;
    var message = 'Triton is currently running...';

    if (e) {
        e.returnValue = message;
    }

    return message;
}
;

window.onload = function () {
    var tumblrName = urlParam('name');

    if (!tumblrName) {
        promptTumblrName();
        return;
    }
    window.onbeforeunload = confirmUnload;

    var api = new Api(tumblrName, 'zX9bNvZitC1NNZpqaViJN0jV7wDgQj9kEEZiKBp9UTJB0tHcyJ');
    api.onUrlNotFound.add(function () {
        bootbox.alert('Your Tumblr blog could not be found :(', function () {
            window.onbeforeunload = null;
            window.location.replace(window.location.href.split('?')[0]);
        });
    });

    var player = new SongPlayer($('#audio-player'));
    var table = new SongTable(api, $('#songsTable'));

    var prevButton = $('#prev-button');
    var playButton = $('#play-button');
    var nextButton = $('#next-button');

    player.onPlay.add(function () {
        document.title = 'Triton - {0} by {1}'.format(player.song.name, player.song.artist);
        playButton.find('.glyphicon').removeClass('glyphicon-play');
        playButton.find('.glyphicon').addClass('glyphicon-pause');
    });

    player.onPause.add(function () {
        playButton.find('.glyphicon').removeClass('glyphicon-pause');
        playButton.find('.glyphicon').addClass('glyphicon-play');
    });

    player.onEnd.add(function () {
        return nextButton.click();
    });

    playButton.click(function (e) {
        if (!player.song) {
            nextButton.click();
            return;
        }

        if (player.isPlaying) {
            player.pause();
        } else {
            player.play();
        }
    });

    prevButton.click(function (e) {
        if (player.time > 5) {
            player.time = 0;

            if (!player.isPlaying) {
                player.play();
            }

            return;
        }

        var prev = table.prevSong;

        if (prev) {
            player.play(prev);
            return;
        }

        if (player.isPlaying) {
            player.pause();
            player.time = 0;
        }

        playButton.find('.glyphicon').removeClass('glyphicon-pause');
        playButton.find('.glyphicon').addClass('glyphicon-play');
    });

    nextButton.click(function (e) {
        var next = table.nextSong;

        if (next) {
            player.play(next);
        }
    });

    $(window).scroll(function () {
        if ($(window).scrollTop() + $(window).height() > $(document).height() - 100) {
            if (!table.loadSongs()) {
                $('#loadingText').hide();
            }
        }
    });

    var badged = false;
    table.onSongCount.add(function (count, total) {
        if (count == total) {
            $('#loadingText').hide();
            $('#songsNav').html('Songs&nbsp;<span class="badge">{0}</span>'.format(total));
        } else {
            $('#songsNav').html('Songs&nbsp;<span class="badge">{0}+</span>'.format(count));
        }
    });

    table.onSongSelected.add(function (url) {
        return player.play(url);
    });
    table.loadSongs();
};
//# sourceMappingURL=app.js.map
