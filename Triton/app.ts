/// <reference path="Scripts/typings/jquery/jquery.d.ts" />
/// <reference path="signal.ts" />
declare var bootbox;

interface String {
    format: (...args: any[]) => string;
}   

String.prototype.format = function (...args: any[]): string {
    return this.replace(/{(\d+)}/g, (match, idx) => {
        return typeof args[idx] != 'undefined'
            ? args[idx]
            : match
            ;
    });
};

class Api {
    private url: string;
    private key: string;

    onUrlNotFound: ISignal;

    constructor(url: string, key: string) {
        this.url = 'http://api.tumblr.com/v2/blog/{0}/'.format(url);
        this.key = key;

        this.onUrlNotFound = new Signal();
    }
    
    make(path: string, args: any, callback: (res: any) => void) {
        var data = {
            api_key: this.key
        };
        $.extend(data, args);
        $.ajax({
            url: this.url + path,
            data: data,
            dataType: 'jsonp',
            success: res => {
                if (res.meta.status == 404) {
                    this.onUrlNotFound.trigger();
                    return;
                }

                callback(res);
            },
            error: () => {
                alert('Error');
            }
        });  
    }
}

class Song {
    name: string;
    artist: string;
    url: string;
    albumArt: string;
    postUrl: string;
}

class SongPlayer {
    song: Song;
    private playing: boolean;

    private player: JQuery;
    private audio: HTMLAudioElement;

    onPlay: ISignal;
    onPause: ISignal;
    onEnd: ISignal;

    constructor(player: JQuery) {
        this.song = null;
        this.playing = false;

        this.player = player;
        this.audio = <HTMLAudioElement> this.player[0];

        this.onPlay = new Signal();
        this.onPause = new Signal();
        this.onEnd = new Signal();
        
        this.audio.onended = () => {
            this.playing = false;
            this.onEnd.trigger();
        };
    }

    get isPlaying(): boolean {
        return this.playing;
    }

    get time(): number {
        return this.audio.currentTime;
    }

    set time(pos: number) {
        this.audio.currentTime = pos;
    }

    play(song: Song = null) {
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
    }

    pause() {
        this.audio.pause();
        this.playing = false;
        this.onPause.trigger();
    }
}

interface ISongCountSignal extends ISignal {
    add(listener: (count: number, total: number) => void): void;
    remove(listener: (count: number, total: number) => void): void;
    trigger(count: number, total: number): void;
}

interface ISongSelectedSignal extends ISignal {
    add(listener: (song: Song) => void): void;
    remove(listener: (song: Song) => void): void;
    trigger(song: Song): void;
}

class SongTable {
    private api: Api;
    private table: JQuery;
    private offset: number;
    private total: number;

    private busy: boolean;
    private row: JQuery;

    onSongCount: ISongCountSignal;
    onSongSelected: ISongSelectedSignal;

    constructor(api: Api, table: JQuery) {        
        this.api = api;
        this.table = table.find('tbody:last');
        
        this.offset = 0;
        this.total = -1;

        this.busy = false;
        this.row = null;

        this.onSongCount = new Signal();
        this.onSongSelected = new Signal();
    }

    get prevSong(): Song {
        var prev = !this.row ? this.table.find('tr').last() : this.row.prev();

        if (!prev) {
            return null;
        }

        this.updateRow(prev);
        return <Song> this.row.data('song');
    }

    get nextSong(): Song {
        var next = !this.row ? this.table.find('tr').first() : this.row.next();

        if (!next) {
            return null;
        }

        this.updateRow(next);
        return <Song> this.row.data('song');
    }

    private updateRow(row: JQuery) {
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
    }
    
    loadSongs(): boolean {
        if (this.busy) {
            return true;
        }

        if (this.offset == this.total) {
            return false;
        }

        this.busy = true;

        this.api.make('posts/audio', {offset: this.offset}, (res) => {
            if (res.meta.status != 200) {
                alert(res.meta.status);
                return;
            }
            var posts = res.response.posts;

            this.offset += posts.length;

            this.total = res.response.total_posts;
            this.onSongCount.trigger(this.offset, this.total);        

            console.log('loaded (+{2}): {0} / {1}'.format(this.offset, this.total, posts.length));

            $.each(posts, (idx, json) => {
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

                row.click(ev => this.updateRow(row));

                var timer;
                row.on('mousedown', () => timer = setTimeout(() => {
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
                                callback: () => { }
                            }
                        }
                    });
                }, 1000));
                row.on('mouseup mouseleave', () => clearTimeout(timer));

                this.table.append(row);
            });

            this.busy = false;
        });  

        return true;
    }
}

function urlParam(param: string): string {
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
        callback: result => {
            if (!result) {
                promptTumblrName();
                return;
            }

            window.location.replace('?name=' + result);
        }
    });
}

function confirmUnload(e: BeforeUnloadEvent) {
    e = e || <BeforeUnloadEvent> window.event;
    var message = 'Triton is currently running...';

    if (e) {
        e.returnValue = message;
    }

    return message;
};

window.onload = () => {

    var tumblrName = urlParam('name');

    if (!tumblrName) {
        promptTumblrName();
        return;
    }
    window.onbeforeunload = confirmUnload;

    var api = new Api(tumblrName, 'zX9bNvZitC1NNZpqaViJN0jV7wDgQj9kEEZiKBp9UTJB0tHcyJ');
    api.onUrlNotFound.add(() => {
        bootbox.alert('Your Tumblr blog could not be found :(', () => {
            window.onbeforeunload = null;
            window.location.replace(window.location.href.split('?')[0]);
        });
    });
    
    var player = new SongPlayer($('#audio-player'));
    var table = new SongTable(api, $('#songsTable'));
    
    var prevButton = $('#prev-button');
    var playButton = $('#play-button');
    var nextButton = $('#next-button');

    player.onPlay.add(() => {
        document.title = 'Triton - {0} by {1}'.format(player.song.name, player.song.artist);
        playButton.find('.glyphicon').removeClass('glyphicon-play');
        playButton.find('.glyphicon').addClass('glyphicon-pause');
    });

    player.onPause.add(() => {
        playButton.find('.glyphicon').removeClass('glyphicon-pause');
        playButton.find('.glyphicon').addClass('glyphicon-play');
    });

    player.onEnd.add(() => nextButton.click());

    playButton.click(e => {
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
    
    prevButton.click(e => {
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
    
    nextButton.click(e => {
        var next = table.nextSong;

        if (next) {
            player.play(next);
        }
    });
    
    $(window).scroll(() => {
        if ($(window).scrollTop() + $(window).height() > $(document).height() - 100) {
            if (!table.loadSongs()) {
                $('#loadingText').hide();
            }
        }
    });

    var badged = false;
    table.onSongCount.add((count, total) => {

        if (count == total) {
            $('#loadingText').hide();
            $('#songsNav').html('Songs&nbsp;<span class="badge">{0}</span>'.format(total));
        } else {
            $('#songsNav').html('Songs&nbsp;<span class="badge">{0}+</span>'.format(count));
        }


    });

    table.onSongSelected.add(url => player.play(url));
    table.loadSongs();
};