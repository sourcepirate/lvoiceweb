(function (wnd) {
    /*
     Try to record voice using get usermedia
   */

    var chunks = [],
        defaultRecordingTimeout = 7000,
        recorder = null,
        grainSize = 1024,
        minPitch = 0.8,
        maxPitch = 1.5,
        overLapRatio = 0.5,
        p = document.createElement('p');
    
    document.body.appendChild(p);

    // create a hann window to transform
    function hann(length) {
        var wdo = new Float32Array(length);
        for (var i = 0; i < length; i++) {
            wdo[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (length - 1)));
        }
        return wdo;
    }

    // interpolate the next sequence
    function linearInterPol(a, b, t) {
        return a + (b - a) * t;
    }

    function getStream() {
        return new Promise((resolve, reject) => {
            navigator.getUserMedia({
                audio: true
            }, resolve, reject);
        });
    }

    function getArrayBuffer(blob) {
        return new Promise((res, rej) => {
            var reader = new FileReader();
            reader.onload = (e) => res(e.target.result);
            reader.readAsArrayBuffer(blob);
        });
    }

    function lvoiceConvertor(ctx, primebuffer) {
        var audioCtx = ctx;
        var buf = primebuffer;
        var source = audioCtx.createBufferSource();
        var filter = audioCtx.createScriptProcessor(grainSize, 1, 1);
        filter.grainWindow = hann(grainSize);
        filter.buffer = new Float32Array(grainSize * 2);
        filter.onaudioprocess = function (audioProcessingEvent) {
            // The input buffer is the song we loaded earlier
            var inputBuffer = audioProcessingEvent.inputBuffer;
            var outputBuffer = audioProcessingEvent.outputBuffer;

            var inputData = inputBuffer.getChannelData(0);
            var outputData = outputBuffer.getChannelData(0);

            for (i = 0; i < inputData.length; i++) {

                // Apply the window to the input buffer
                inputData[i] *= this.grainWindow[i];

                // Shift half of the buffer
                this.buffer[i] = this.buffer[i + grainSize];

                // Empty the buffer tail
                this.buffer[i + grainSize] = 0.0;
            }

            var grainData = new Float32Array(grainSize * 2);
            var grainDataLow = new Float32Array(grainSize * 2);
            var grainDataHigh = new Float32Array(grainSize * 2);

            for (var i = 0, j = 0.0; i < grainSize; i++, j += minPitch) {
                var index = Math.floor(j) % grainSize;
                var a = inputData[index];
                var b = inputData[(index + 1) % grainSize];
                grainDataLow[i] += linearInterPol(a, b, j % 1.5) * this.grainWindow[i];
            }

            for (var i = 0, j = 0.0; i < grainSize; i++, j += maxPitch) {
                var index = Math.floor(j) % grainSize;
                var a = inputData[index];
                var b = inputData[(index + 1) % grainSize];
                grainDataHigh[i] += linearInterPol(a, b, j % 1.5) * this.grainWindow[i];
            }

            for (i = 0; i < grainSize; i += Math.round(grainSize * (1 - overLapRatio))) {
                for (j = 0; j <= grainSize; j++) {
                    this.buffer[i + j] += grainDataLow[j] / 3.0 + (3 * grainDataHigh[j]);
                }
            }

            // Output the first half of the buffer
            for (i = 0; i < grainSize; i++) {
                outputData[i] = this.buffer[i];
            }
        }

        source.buffer = buf;
        source.connect(filter);
        filter.connect(audioCtx.destination);
        source.start();
    }

    if ('MediaRecorder' in wnd) {
        // start recording

        
        getStream().then((stream) => {

            // initialize the recorder

            p.innerHTML = "Recording what you are speaking....";
            recorder = new MediaRecorder(stream);
            recorder.start();
            recorder.ondataavailable = (e) => {
                chunks.push(e.data)
            }
            // export the stored data into audio clip
            recorder.onstop = (e) => {
                var audioBlob = new Blob(chunks, {'type': 'audio/ogg; codecs=opus'});
                var audioContext = new AudioContext();
                getArrayBuffer(audioBlob).then((buffer) => {
                    return new Promise((res, rej) => {
                        audioContext.decodeAudioData(buffer, res, rej);
                    });
                }).then((buf) => {
                    p.innerHTML = "playing L's voice";
                    lvoiceConvertor(audioContext, buf);
                });
            };

            setTimeout(() => {
                p.innerHTML = "Stopped the recording.... Playing with L voice";
                recorder.stop()
            }, defaultRecordingTimeout);

        }).catch((err) => console.log(err));

    } else {
        p.innerHTML = "Browser doesn't support mediarecorder";
        document
            .body
            .appendChild(p);
    }

})(window);