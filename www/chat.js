function OMGMusicChat(rt, onready) {
    this.rt = rt
    this.pianoDiv = document.getElementById("big-piano")
    this.piano = new PianoSurface(this.pianoDiv)
    this.piano.setupEvents(key => this.noteOn(key.note, 60, this.user),
                           key => this.noteOff(key.note, this.user))
}

OMGMusicChat.prototype.setupPlayer = function () {
    this.visibleMeters = []
    this.updateMeters()

    if (typeof OMusicPlayer === "undefined") {
        omg.util.loadScripts(
            ["/apps/music/js/omusic_player.js"],
            () => {
                this.whenPlayersReady()
            }
        )
    }
    else {
        this.whenPlayersReady()
    }
}

OMGMusicChat.prototype.setupKeyboard = function () {

    var keyMap = {
        "a": 48, "s": 50, "d": 52, "f": 53, "g": 55, "h": 57, "j": 59, "k": 60, "l": 62, ";": 64,
        "q": 47, "w": 49, "e": 51, "r": 52, "t": 54, "y": 56, "u": 58, "i": 60, "o": 61, "p": 63,
        "z": 36, "x": 38, "c": 40, "v": 41, "b": 43, "n": 45, "m": 47
    }

    var keys = {}

    document.body.onkeydown = e => {
        let note = keyMap[e.key]
        if (note && !keys[e.key]) {
            this.noteOn(note, 66, this.user)
            keys[e.key] = true
        }
    }
    document.body.onkeyup = e => {
        let note = keyMap[e.key]
        if (note) {
            this.noteOff(note, this.user)
            keys[e.key] = false
        }
    }
}


OMGMusicChat.prototype.whenPlayersReady = function () {
    this.player = new OMusicPlayer()
    this.player.loadFullSoundSets = true
    this.section = new OMGSection()

    this.player.prepareSong(this.section.song)

    this.setupKeyboard()
    this.setupCommands()

    var selectInstrument = document.getElementById("select-instrument")
    for (var instrument in this.INSTRUMENTS) {
        selectInstrument.innerHTML += `<option value=${instrument}>${this.INSTRUMENTS[instrument].name}</option>`
    }
    selectInstrument.onchange = e => {
        var instrument = selectInstrument.value
        this.changeSoundSet(instrument, this.part)

        this.sendChangeSoundSet(instrument)
        this.user.data.instrument = instrument
        this.rt.updateLocalUserData(this.user.data)
    }
}

OMGMusicChat.prototype.setupLocalUser = function (user) {
    user.data = {}
    this.setupUser(user, true)
    this.user = user
    this.part = user.part

    user.data.instrument = user.part.data.name
    this.rt.updateLocalUserData(user.data)

    this.setupMIDI()
}

OMGMusicChat.prototype.setupUser = function (user, local) {

    user.pressed = []
    this.makePianoCanvas(user)

    if (!local) {
        var instrumentDiv = document.createElement("span")
        instrumentDiv.innerHTML = user.data ? user.data.instrument : Object.values(this.INSTRUMENTS)[0].name
        instrumentDiv.className = "user-instrument"
        user.div.appendChild(instrumentDiv)
        user.instrumentDiv = instrumentDiv
    }

    var volumeSlider = document.createElement("input")
    volumeSlider.type = "RANGE"
    user.div.appendChild(volumeSlider)
    volumeSlider.onchange = e => {
        
        //todo shouldn't the player be able to handle this?
        user.part.data.audioParams.gain = volumeSlider.value/100
        user.part.gain.gain.setValueAtTime(volumeSlider.value/100, 0)
    }

    var soundSet = Object.values(this.INSTRUMENTS)[0]
    if (user.data && user.data.instrument) {
        soundSet = this.INSTRUMENTS[user.data.instrument]
    }
    
    user.part = new OMGPart(null, {name: user.name, audioParams: {gain: 0.3}, soundSet: soundSet}, this.section)
    volumeSlider.value = 30
    this.player.loadPart(user.part)


    this.makeMeter(user)
}

OMGMusicChat.prototype.noteOn = function (noteNumber, velocity, user) {

    if (user === this.user) {
        this.sendNoteOn(noteNumber, velocity, user.part)
    }

    this._non = user.part.data.soundSet.chromatic ? noteNumber : noteNumber % user.part.soundSet.data.length

    if (user.part.data.surface.url === "PRESET_SEQUENCER") {
        this.player.playSound(user.part.data.tracks[this._non].sound, user.part,
            user.part.data.tracks[this._non].audioParams, velocity / 120)
    }
    else {
        this.player.noteOn(this._non, user.part, velocity)
    }

    if (user.pressed.indexOf(noteNumber) === -1) {
        user.pressed.push(noteNumber)
    }
    user.piano.drawPressed(user.pressed)
}

OMGMusicChat.prototype.noteOff = function (noteNumber, user) {
    if (user.part.data.surface.url === "PRESET_VERTICAL") {
        this.player.noteOff(noteNumber, user.part)
    }

    if (user === this.user) {
        this.sendNoteOff(noteNumber, user.part)
    }
    
    this._noi = user.pressed.indexOf(noteNumber)
    if (this._noi > -1) {
        user.pressed.splice(this._noi, 1)
    }
    user.piano.drawPressed(user.pressed)
}

OMGMusicChat.prototype.INSTRUMENTS = {
    //PERCUSSION: {"data":[{"url":"bongol.mp3","name":"bongol"},{"url":"bongoh.mp3","name":"bongoh"},{"url":"clickl.mp3","name":"clickl"},{"url":"clickh.mp3","name":"clickh"},{"url":"clav.mp3","name":"clav"},{"url":"shhk.mp3","name":"shhk"},{"url":"scrape.mp3","name":"scrape"},{"url":"whoop.mp3","name":"whoop"},{"url":"chimes.mp3","name":"chimes"}],"name":"Precussion","type":"SOUNDSET","prefix":"https://openmedia.gallery/uploads/1/1753/","lowNote":72,"postfix":"","user_id":"1","username":"m                   ","chromatic":false,"created_at":1601816482033,"omgVersion":1,"last_modified":1601816482033,"defaultSurface":"PRESET_SEQUENCER","id":1753},
    TD_DRUMKIT: {"data":[{"url":"https://cwilso.github.io/MIDIDrums/sounds/drum-samples/acoustic-kit/kick.wav","name":"Kick"},{"url":"https://cwilso.github.io/MIDIDrums/sounds/drum-samples/acoustic-kit/snare.wav","name":"X Stick"},{"url":"https://cwilso.github.io/MIDIDrums/sounds/drum-samples/acoustic-kit/snare.wav","name":"Snare"},{"url":"https://cwilso.github.io/MIDIDrums/sounds/drum-samples/TheCheebacabra1/tom3.wav","name":"Tom 4 Rim"},{"url":"https://cwilso.github.io/MIDIDrums/sounds/drum-samples/TheCheebacabra1/snare.wav","name":"Snare Rim"},{"url":"https://cwilso.github.io/MIDIDrums/sounds/drum-samples/TheCheebacabra1/tom3.wav","name":"Tom 4"},{"url":"https://mikehelland.com/omg/drums/rock_hihat_closed.mp3","name":"Closed HH"},{"url":"https://cwilso.github.io/MIDIDrums/sounds/drum-samples/acoustic-kit/tom3.wav","name":"Tom 3"},{"url":"https://mikehelland.com/omg/drums/hh_hihat.mp3","name":"Pedal HH"},{"url":"https://cwilso.github.io/MIDIDrums/sounds/drum-samples/acoustic-kit/tom2.wav","name":"Tom 2"},{"url":"https://mikehelland.com/omg/drums/rock_hihat_open.mp3","name":"Open HH"},{"url":"https://cwilso.github.io/MIDIDrums/sounds/drum-samples/TheCheebacabra1/tom2.wav","name":"Tom 2 Rim"},{"url":"https://cwilso.github.io/MIDIDrums/sounds/drum-samples/acoustic-kit/tom1.wav","name":"Tom 1"},{"url":"https://mikehelland.com/omg/drums/rock_crash.mp3","name":"Crash 1"},{"url":"https://cwilso.github.io/MIDIDrums/sounds/drum-samples/TheCheebacabra1/tom1.wav","name":"Tom 1 Rim"},{"url":"https://mikehelland.com/omg/drums/ride.wav","name":"Ride"},{"url":"https://mikehelland.com/omg/drums/rock_crash.mp3","name":"Crash 2 Rim"},{"url":"https://mikehelland.com/omg/drums/ride2.wav","name":"Ride Rim"},{"url":"","name":"-"},{"url":"https://mikehelland.com/omg/drums/rock_crash.mp3","name":"Crash 1 Rim"},{"url":"","name":"-"},{"url":"https://mikehelland.com/omg/drums/rock_crash.mp3","name":"Crash 2"},{"url":"https://cwilso.github.io/MIDIDrums/sounds/drum-samples/TheCheebacabra1/tom3.wav","name":"Tom 3 Rim"},{"url":"https://mikehelland.com/omg/drums/ride2.wav","name":"Ride Edge Rim"}],"name":"TD KIT","type":"SOUNDSET","prefix":"","lowNote":24,"postfix":"","user_id":"1","approved":true,"username":"m                   ","chromatic":false,"created_at":1586541415888,"omgVersion":1,"last_modified":1586548042206,"defaultSurface":"PRESET_SEQUENCER","id":1652},
    MARIMBA: {"data":[{"url":"A3.mp3","name":"A3"},{"url":"Bf3.mp3","name":"Bf3"},{"url":"B3.mp3","name":"B3"},{"url":"C3.mp3","name":"C3"},{"url":"Cs3.mp3","name":"Cs3"},{"url":"D3.mp3","name":"D3"},{"url":"Ds3.mp3","name":"Ds3"},{"url":"E3.mp3","name":"E3"},{"url":"F3.mp3","name":"F3"},{"url":"Fs3.mp3","name":"Fs3"},{"url":"G3.mp3","name":"G3"},{"url":"Gs3.mp3","name":"Gs3"},{"url":"A5.mp3","name":"A5"},{"url":"Bf5.mp3","name":"Bf5"},{"url":"B5.mp3","name":"B5"},{"url":"C5.mp3","name":"C5"},{"url":"Cs5.mp3","name":"Cs5"},{"url":"D5.mp3","name":"D5"},{"url":"Ds5.mp3","name":"Ds5"},{"url":"E5.mp3","name":"E5"},{"url":"F5.mp3","name":"F5"},{"url":"Fs5.mp3","name":"Fs5"},{"url":"G5.mp3","name":"G5"},{"url":"Gs5.mp3","name":"Gs5"},{"url":"A6.mp3","name":"A6"}],"name":"MARIMBA","type":"SOUNDSET","prefix":"http://www.mikehelland.com/omg/joe/MARIMBA/","lowNote":45,"postfix":"","user_id":"1","approved":true,"username":"m                   ","chromatic":true,"created_at":1513315862817,"last_modified":1520375628138,"defaultSurface":"PRESET_VERTICAL","id":417},
    GUITAR: {"data":[{"url":"e","name":"E2"},{"url":"f","name":"F2"},{"url":"fs","name":"F#2"},{"url":"g","name":"G2"},{"url":"gs","name":"G#2"},{"url":"a","name":"A2"},{"url":"bf","name":"Bb2"},{"url":"b","name":"B2"},{"url":"c","name":"C3"},{"url":"cs","name":"C#3"},{"url":"d","name":"D3"},{"url":"ds","name":"D#3"},{"url":"e2","name":"E3"},{"url":"f2","name":"F3"},{"url":"fs2","name":"F#2"},{"url":"g2","name":"G2"},{"url":"gs2","name":"G#2"},{"url":"a2","name":"A3"},{"url":"bf2","name":"Bb3"},{"url":"b2","name":"B3"},{"url":"c2","name":"C4"},{"url":"cs2","name":"C#4"},{"url":"d2","name":"D4"},{"url":"ds2","name":"D#4"},{"url":"e3","name":"E4"},{"url":"f3","name":"F4"},{"url":"fs3","name":"F#4"},{"url":"g3","name":"G4"},{"url":"gs3","name":"G#4"},{"url":"a3","name":"A4"},{"url":"bf3","name":"Bb4"},{"url":"b3","name":"B4"},{"url":"c3","name":"C5"},{"url":"cs3","name":"C#5"},{"url":"d3","name":"D5"},{"url":"ds3","name":"D#5"},{"url":"e4","name":"E5"},{"url":"f4","name":"F5"},{"url":"fs4","name":"F#5"},{"url":"g4","name":"G5"},{"url":"gs4","name":"G#5"},{"url":"a4","name":"A5"},{"url":"bf4","name":"Bb5"},{"url":"b4","name":"B5"},{"url":"c4","name":"C6"},{"url":"cs4","name":"C#6"}],"name":"Electric Guitar","tags":"melody","type":"SOUNDSET","prefix":"http://mikehelland.com/omg/electric/electric_","lowNote":40,"postfix":".mp3","user_id":"1","approved":true,"username":"m                   ","chromatic":true,"created_at":1513199866864,"last_modified":1520375591557,"defaultSurface":"PRESET_VERTICAL","id":396},
    BASS: {"data":[{"url":"e","name":"E2"},{"url":"f","name":"F2"},{"url":"fs","name":"F#2"},{"url":"g","name":"G2"},{"url":"gs","name":"G#2"},{"url":"a","name":"A2"},{"url":"bf","name":"Bb2"},{"url":"b","name":"B2"},{"url":"c","name":"C3"},{"url":"cs","name":"C#3"},{"url":"d","name":"D3"},{"url":"ds","name":"Eb3"},{"url":"e2","name":"E3"},{"url":"f2","name":"F3"},{"url":"fs2","name":"F#3"},{"url":"g2","name":"G3"},{"url":"gs2","name":"G#3"},{"url":"a2","name":"A3"},{"url":"bf2","name":"Bb3"},{"url":"b2","name":"B3"},{"url":"c2","name":"C4"}],"name":"Electric Bass","tags":"bassline","type":"SOUNDSET","prefix":"http://mikehelland.com/omg/bass1/bass_","lowNote":28,"postfix":".mp3","user_id":"1","approved":true,"username":"m                   ","chromatic":true,"created_at":1513199637025,"last_modified":1520375581690,"defaultSurface":"PRESET_VERTICAL","id":395}

}


OMGMusicChat.prototype.makeMeter = function (user) {
    user.meterDiv = document.createElement("div")
    user.meterDiv.className = "volume-meter"
    user.div.appendChild(user.meterDiv)

    var meter = new BasicPeakMeter(user.part.postFXGain, user.meterDiv, this.player.context);
    this.visibleMeters.push(meter);
}

OMGMusicChat.prototype.updateMeters = function () {
    for (this._update_j = 0; 
            this._update_j < this.visibleMeters.length; 
            this._update_j++) {
        this.visibleMeters[this._update_j].updateMeter();
    }

    window.requestAnimationFrame(() => this.updateMeters());
};

OMGMusicChat.prototype.sendNoteOn = function (note, velocity) {
    this.rt.sendCommandToRoom({action: "noteon", note: note, velocity: velocity})         
}
OMGMusicChat.prototype.sendNoteOff = function (note) {
    this.rt.sendCommandToRoom({action: "noteoff", note: note})
}
OMGMusicChat.prototype.sendChangeSoundSet = function (instrument) {
    this.rt.sendCommandToRoom({action: "changeSoundSet", instrument: instrument})
}

OMGMusicChat.prototype.setupCommands = function () {
    this.rt.oncommand = (data) => {
        this._cmdFrom = this.rt.remoteUsers[data.from]
        if (!this._cmdFrom) {
            return
        }
        this._cmdPart = this._cmdFrom.part
            
        if (data.command.action === "noteon") {
            this.noteOn(data.command.note, data.command.velocity, this._cmdFrom)
        }
        else if (data.command.action === "noteoff") {
            this.noteOff(data.command.note, this._cmdFrom)
        }
        else if (data.command.action === "changeSoundSet") {
            this.changeSoundSet(data.command.instrument, this._cmdPart)
            this._cmdFrom.instrumentDiv.innerHTML = this.INSTRUMENTS[data.command.instrument].name
        }
    }
}

OMGMusicChat.prototype.changeSoundSet = function (instrument, part) {

    part.data.surface.url = this.INSTRUMENTS[instrument].defaultSurface
    part.setSoundSet(this.INSTRUMENTS[instrument])
    this.player.loadPart(part)

}

OMGMusicChat.prototype.setupMIDI = function () {
    this.midi = new OMGMIDI()
    this.midi.onnoteon  = (note, velocity) => this.noteOn(note, velocity, this.user)
    this.midi.onnoteoff = (note) => this.noteOff(note, this.user)
}

OMGMusicChat.prototype.makePianoCanvas = function (user) {
    user.pianoCanvas = document.createElement("div")
    user.pianoCanvas.className = "piano-canvas"
    user.div.appendChild(user.pianoCanvas)

    user.piano = new PianoSurface(user.pianoCanvas)

}


// todo 
/*

pan
fx

more soundsets


disable login button till ready

*/