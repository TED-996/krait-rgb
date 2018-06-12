/// <reference path="../node_modules/@types/jquery/index.d.ts" />
// websocketsConn defined in rgb-utils.ts
// stopRequested defined in rgb-utils.ts
// gamma and invGamma defined in rgb-utils.ts
$(function () {
    clearOut();
    addOutLine('Connecting...');
    websocketsConn = getWebsocketsConn();
    $('#cmd-btn-set').on('click', onCmdSet);
    $('#cmd-btn-fade1').on('click', onCmdFade1);
    $('#cmd-btn-fade-rpt').on('click', onCmdFadeRepeat);
    $('#cmd-btn-fade-bpm').on('click', onCmdBpm);
    $('#cmd-btn-stop').on('click', onCmdStop);
});
function onCmdSet() {
    if (!checkConnOpen(websocketsConn)) {
        return;
    }
    let params = getParams();
    let color = getColorFromLine(params);
    if (color !== false) {
        setColorWs(color, websocketsConn);
    }
}
function onCmdFade1() {
    if (!checkConnOpen(websocketsConn)) {
        return;
    }
    if (stopRequested) {
        addOutLine('Waiting for routine to stop. Please retry.');
        return;
    }
    let colorsLinear = getParamsColorListLinear();
    if (colorsLinear === false) {
        return;
    }
    setTimeout(function () {
        cmdFadeLoop(colorsLinear, Date.now() / 1000.0, false);
    }, 0);
}
function onCmdFadeRepeat() {
    if (!checkConnOpen(websocketsConn)) {
        return;
    }
    if (stopRequested) {
        addOutLine('Waiting for routine to stop. Please retry.');
        return;
    }
    let colorsLinear = getParamsColorListLinear();
    if (colorsLinear === false) {
        return;
    }
    colorsLinear = colorsLinear;
    colorsLinear.push(colorsLinear[0]);
    setTimeout(function () {
        cmdFadeLoop(colorsLinear, Date.now() / 1000.0, true);
    }, 0);
}
function onCmdBpm() {
    let bpm;
    let params = getParams().trim();
    let lines = params.split(/[\r\n]+/);
    try {
        bpm = parseInt(lines[0]);
    }
    catch (ex) {
        addOutLine(ex.toString());
        return;
    }
    if (bpm < 10 || bpm > 200) {
        addOutLine('BPM out of range');
        return;
    }
    // insert a #000000 color after each one
    let colorsLinear = toColorListLinear(lines.slice(1));
    if (colorsLinear === false) {
        return;
    }
    colorsLinear = colorsLinear;
    for (let i = 1; i <= colorsLinear.length; i += 2) {
        colorsLinear.splice(i, 0, [0, 0, 0]);
    }
    colorsLinear.push(colorsLinear[0]);
    setTimeout(function () {
        cmdBpmLoop(colorsLinear, bpm, Date.now() / 1000.0);
    }, 0);
}
function getParamsColorListLinear() {
    let params = getParams().trim();
    let lines = params.split(/[\r\n]+/);
    return toColorListLinear(lines);
}
function toColorListLinear(lines) {
    if (lines.length == 0) {
        addOutLine('No colors to fade.');
        return false;
    }
    let colors = lines.map(getColorFromLine);
    if (colors
        .filter(function (c) {
        return c === false;
    })
        .length != 0) {
        // some parsing errors
        return false;
    }
    let colorsChecked = colors;
    let colorsLinear = colorsChecked.map(function (c) {
        return hexToRgb(c).map(compToLinear);
    });
    return colorsLinear;
}
function getBlendedInColors(colorsLinear, progress) {
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < colorsLinear.length; i++) {
        let influence = 1 - Math.abs(progress - i);
        if (influence <= 0) {
            continue;
        }
        // these are all gamma corrected
        r += colorsLinear[i][0] * influence;
        g += colorsLinear[i][1] * influence;
        b += colorsLinear[i][2] * influence;
    }
    let blendedComp = linearToGamma([r, g, b]);
    let blendedRgb = rgbToHex(blendedComp[0], blendedComp[1], blendedComp[2]);
    return blendedRgb;
}
function cmdFadeLoop(colorsLinear, startTime, repeat) {
    if (stopRequested) {
        addOutLine('Fade stopped');
        stopRequested = false;
        return;
    }
    let currTime = Date.now() / 1000.0;
    let elapsed = currTime - startTime;
    let progress = elapsed;
    if (progress >= colorsLinear.length - 1) {
        if (repeat) {
            progress = progress % (colorsLinear.length - 1);
        }
        else {
            // final set color
            progress = colorsLinear.length - 1;
        }
    }
    setColorWs(getBlendedInColors(colorsLinear, progress), websocketsConn);
    if (progress >= colorsLinear.length - 1 && !repeat) {
        return;
    }
    // 80ms step
    const step = 0.08;
    setTimeout(function () {
        cmdFadeLoop(colorsLinear, startTime, repeat);
    }, 1000 / (1.0 / step));
}
function cmdBpmLoop(colorsLinear, bpm, startTime) {
    if (stopRequested) {
        addOutLine('BPM stopped');
        stopRequested = false;
        return;
    }
    let currTime = Date.now() / 1000.0;
    let elapsed = currTime - startTime;
    let progress = (elapsed * 2 * (bpm / 60)) % (colorsLinear.length - 1);
    let progressStep = progress % 2;
    let progressBase = progress - progressStep;
    const dimPeriod = 1.2;
    const dimProgressStep = 0.9;
    if (progressStep < dimPeriod) {
        progress = progressBase + (dimProgressStep / dimPeriod) * progressStep;
    }
    else {
        progress = progressBase + dimProgressStep;
    }
    setColorWs(getBlendedInColors(colorsLinear, progress), websocketsConn);
    const step = 0.08;
    const timeout = 1000 / (1.0 / step);
    setTimeout(function () {
        cmdBpmLoop(colorsLinear, bpm, startTime);
    }, timeout);
}
function onCmdStop() {
    addOutLine('Stop requested.');
    stopRequested = true;
}
function getParams() {
    return $('#cmd-params').val();
}
function getColorFromLine(line) {
    line = line.trim();
    if (/^[0-9A-Fa-f]{6}$/.test(line)) {
        return line;
    }
    else if (/^#[0-9A-Fa-f]{6}$/.test(line)) {
        return line.substring(1);
    }
    else {
        addOutLine('Unrecognized color "' + line +
            '".\n  Should be a color in RGB hex format (with or without leading \'#\')');
        return false;
    }
}
