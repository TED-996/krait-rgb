/// <reference path="../node_modules/@types/jquery/index.d.ts" />
// websocketsConn defined in rgb-utils.ts
// stopRequested defined in rgb-utils.ts
// gamma and invGamma defined in rgb-utils.ts
$(function () {
    clearOut();
    $('#music-btn-play').on('click', function (e) { onMusicPlay(); e.preventDefault(); return false; });
    $('#music-btn-pause').on('click', function (e) { onMusicPause(); e.preventDefault(); return false; });
    $('#music-btn-stop').on('click', function (e) { onMusicStop(); e.preventDefault(); return false; });
});
let lastMusicSource;
let analyserNode;
var MusicStatus;
(function (MusicStatus) {
    MusicStatus[MusicStatus["Playing"] = 0] = "Playing";
    MusicStatus[MusicStatus["Paused"] = 1] = "Paused";
    MusicStatus[MusicStatus["Stopped"] = 2] = "Stopped";
})(MusicStatus || (MusicStatus = {}));
;
let musicStatus = MusicStatus.Stopped;
let jndDiffFactor = 0.1;
let startedAt;
let pausedAt;
function onMusicPlay() {
    if (musicStatus == MusicStatus.Stopped) {
        let context = getAudioContext(lastMusicSource);
        $("#music-status-main").text("Loading...");
        let connPromise = new Promise(function (resolve, reject) {
            try {
                if (typeof (websocketsConn) !== "undefined") {
                    addOutLine('Closing old connection...');
                    websocketsConn.socket.close();
                }
                addOutLine('Connecting...');
                websocketsConn = getWebsocketsConn(function () {
                    addOutLine("Connected.");
                    resolve();
                });
            }
            catch (ex) {
                reject(ex);
            }
        });
        connPromise.then(function () { return getMusicBuffer(context); }, function (reason) { addOutLine("Cannot connect to RGB server. Reason: " + reason); }).then(function (musicBuffer) {
            if (typeof (musicBuffer) === "undefined") {
                return;
            }
            let musicSource = getMusicSource(context, musicBuffer);
            musicSource.onended = function () {
                if (musicStatus == MusicStatus.Playing) {
                    musicStatus = MusicStatus.Stopped;
                }
            };
            analyserNode = getAnalyser(context);
            musicSource.connect(analyserNode);
            lastMusicSource = musicSource;
            musicStatus = MusicStatus.Paused;
            registerTimeDisplays(context);
            registerAnalyser(context);
            musicSource.start();
            startedAt = context.currentTime;
            musicStatus = MusicStatus.Playing;
        }, function (reason) {
            addOutLine("Cannot decode music. Reason: " + reason);
        });
    }
    else if (musicStatus == MusicStatus.Paused) {
        let context = lastMusicSource.context;
        let musicSource = getMusicSource(context, lastMusicSource.buffer);
        lastMusicSource.disconnect();
        musicSource.connect(analyserNode);
        musicSource.start(0, pausedAt - startedAt);
        // when it *would* have started if it didn't start in the middle
        startedAt = context.currentTime - (pausedAt - startedAt);
        lastMusicSource = musicSource;
        musicStatus = MusicStatus.Playing;
    }
    else {
        addOutLine("Already playing");
    }
}
function onMusicPause() {
    if (musicStatus == MusicStatus.Playing) {
        pausedAt = lastMusicSource.context.currentTime;
        lastMusicSource.stop();
        musicStatus = MusicStatus.Paused;
    }
    else {
        addOutLine("Not playing");
    }
}
function onMusicStop() {
    if (musicStatus == MusicStatus.Playing) {
        lastMusicSource.stop();
        musicStatus = MusicStatus.Stopped;
    }
    else if (musicStatus == MusicStatus.Paused) {
        musicStatus = MusicStatus.Stopped;
    }
    else {
        addOutLine("Already stopped");
    }
}
function getAudioContext(lastSource) {
    if (typeof (lastSource) !== "undefined") {
        return lastSource.context;
    }
    if ("AudioContext" in window) {
        return new AudioContext();
    }
    if ("webkitAudioContext" in window) {
        return (new webkitAudioContext());
    }
    throw new Error("Web Audio not supported.");
}
function getMusicSource(context, musicBuffer) {
    let musicSource = context.createBufferSource();
    musicSource.buffer = musicBuffer;
    return musicSource;
}
function getAnalyser(context) {
    let analyser = context.createAnalyser();
    analyser.connect(context.destination);
    analyser.minDecibels = -80;
    analyser.maxDecibels = -10;
    analyser.smoothingTimeConstant = 0.5;
    analyser.fftSize = 32;
    return analyser;
}
let timeDisplaysRegistered = false;
function registerTimeDisplays(context) {
    if (timeDisplaysRegistered) {
        return;
    }
    timeDisplaysRegistered = true;
    let outStatus = $("#music-status-main");
    let outTime = $("#music-status-time");
    let outTotal = $("#music-status-total");
    const ups = 10;
    const timeout = 1000.0 / ups;
    function updaterLoop() {
        let timeSec = 0.0;
        let totalSec = lastMusicSource.buffer.duration;
        if (musicStatus == MusicStatus.Stopped) {
            outStatus.text("Stopped");
        }
        else if (musicStatus == MusicStatus.Paused) {
            outStatus.text("Paused");
            timeSec = pausedAt - startedAt;
        }
        else {
            outStatus.text("Playing");
            timeSec = context.currentTime - startedAt;
        }
        let totalStr = secondsToStr(totalSec);
        let timeStr = secondsToStr(timeSec);
        outTime.text(timeStr);
        outTotal.text(totalStr);
        setTimeout(updaterLoop, timeout);
    }
    setTimeout(updaterLoop, timeout);
}
function secondsToStr(seconds) {
    let minStr = Math.floor(seconds / 60).toString();
    let secStr = Math.floor(seconds % 60).toString();
    if (secStr.length == 1) {
        secStr = "0" + secStr;
    }
    return minStr + ":" + secStr;
}
let analyserRegistered = false;
let lastRgb = undefined;
function registerAnalyser(context) {
    if (analyserRegistered) {
        return;
    }
    analyserRegistered = true;
    let canvas = $("#music-visualizer")[0];
    let fftBuffer = new Uint8Array(analyserNode.frequencyBinCount);
    let cWidth = canvas.width;
    let cHeight = canvas.height;
    let cCtx = canvas.getContext("2d");
    cCtx.clearRect(0, 0, cWidth, cHeight);
    let animationFrame;
    function draw() {
        animationFrame = requestAnimationFrame(draw);
        cCtx.fillStyle = "rgb(0,0,0)";
        cCtx.fillRect(0, 0, cWidth, cHeight);
        let barW = cWidth / fftBuffer.length;
        analyserNode.getByteFrequencyData(fftBuffer);
        // cCtx.fillStyle = "rgb(200,25,25)";
        let colorRgb = computeRgbFromFft(fftBuffer);
        cCtx.fillStyle = rgbToCssValue(colorRgb);
        for (let i = 0; i < fftBuffer.length; i++) {
            let barH = fftBuffer[i] / 255.0 * cHeight;
            cCtx.fillRect((barW + 1) * i, 0, barW, barH);
        }
        if (typeof (lastRgb) !== "undefined") {
            let distance = colorDistance(colorRgb, lastRgb);
            // https://en.wikipedia.org/wiki/Color_difference
            const jnd = 2.3;
            if (distance > jnd * jndDiffFactor) {
                setColorWs(rgbToHex(colorRgb[0], colorRgb[1], colorRgb[2]), websocketsConn);
                lastRgb = colorRgb;
            }
        }
        else {
            lastRgb = colorRgb;
        }
    }
    draw();
}
function computeRgbFromFft(fftBuffer) {
    let rCutoffInit = 0.15 * fftBuffer.length;
    let gCutoffInit = 0.60 * fftBuffer.length;
    // const maxFactor = 2;
    // function scale(x : number){
    //   return Math.min(Math.sqrt(x), maxFactor) / maxFactor;
    // }
    // for (let i = 0; i < fftBuffer.length; i++){
    //   let rInfluence = scale(Math.max(rCutoff - i, 0));
    //   let gInfluence = scale(Math.max((gCutoff - gMid) - Math.abs(i - gMid), 0));
    //   let bInfluence = scale(Math.max(i - gCutoff, 0));
    // }
    // TODO: replace with 2nd degree polynomials with a < 0 and yMax = 1
    // based on their roots:
    // Pr: roots -ceil(rCutoff), ceil(rCutoff)
    // Pg: roots floor(rCutoff), ceil(gCutoff)
    // Pb: roots floor(gCutoff), length + (length - floor(gCutoff))
    // all include overlap
    let overlap = 0.05 * fftBuffer.length;
    let rLimit = rCutoffInit + overlap + 1;
    let gLowLimit = rCutoffInit - overlap - 1;
    let gHiLimit = gCutoffInit + overlap + 1;
    let bLowLimit = gCutoffInit - overlap - 1;
    let bHiLimit = fftBuffer.length + (fftBuffer.length - bLowLimit);
    let polR = getPoly2FuncFromRoots(-rLimit, rLimit, 1);
    let polG = getPoly2FuncFromRoots(gLowLimit, gHiLimit, 1);
    let polB = getPoly2FuncFromRoots(bLowLimit, bHiLimit, 1);
    let r = 0;
    let g = 0;
    let b = 0;
    let rInfSum = 0;
    let gInfSum = 0;
    let bInfSum = 0;
    const rCorrection = 1.2;
    const gCorrection = 2.5;
    const bCorrection = 6;
    for (let i = 0; i < fftBuffer.length; i++) {
        let rInfluence = Math.max(polR(i), 0);
        let gInfluence = Math.max(polG(i), 0);
        let bInfluence = Math.max(polB(i), 0);
        r += fftBuffer[i] * rInfluence;
        g += fftBuffer[i] * gInfluence;
        b += fftBuffer[i] * bInfluence;
        rInfSum += rInfluence;
        gInfSum += gInfluence;
        bInfSum += bInfluence;
    }
    return linearToGamma([
        Math.min(r * rCorrection / rInfSum / 255.0, 1),
        Math.min(g * gCorrection / gInfSum / 255.0, 1),
        Math.min(b * bCorrection / bInfSum / 255.0, 1)
    ]);
}
function rgbToCssValue(color) {
    return "rgb(" + color[0].toString() + "," + color[1].toString() + "," + color[2].toString() + ")";
}
function getPoly2FuncFromRoots(root1, root2, max) {
    let root1S = root1 * root1;
    let root2S = root2 * root2;
    let sumS = (root1 + root2) * (root1 + root2);
    let diffS = (root1 - root2) * (root1 - root2);
    let a = -4 * max / diffS;
    let b = a * (root2S - root1S) / (root1 - root2);
    let c = -root1S * a - root1 * b;
    return function (x) {
        return a * x * x + b * x + c;
    };
}
function getMusicBuffer(context) {
    let input = $("#music-file-input");
    let asInput = input[0];
    let files = asInput.files;
    if (files.length == 0) {
        addOutLine("No files");
        return Promise.resolve(undefined);
    }
    return new Promise(function (resolve, reject) {
        let file = files[0];
        let reader = new FileReader();
        reader.onload = function (e) {
            let result = e.target.result;
            context.decodeAudioData(result).then(resolve, reject);
        };
        reader.readAsArrayBuffer(file);
    });
}
