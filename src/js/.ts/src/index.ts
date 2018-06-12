/// <reference path="../node_modules/@types/jquery/index.d.ts" />
$(function(){
    let hsvForm = $("#form-hsv");
    hsvForm.submit(function(event) {
        event.preventDefault();

        onSubmitHsv();

        return false;
    });
    let hsvInputs = hsvForm.children("input");
    hsvInputs.on("input", onChangeHsv);

    // initialization
    onChangeHsv();

    let rgbForm = $("#form-rgb");
    rgbForm.submit(function(event){
        event.preventDefault();

        onSubmitRgb();

        return false;
    });

    let rgbInputs = rgbForm.children("input");
    rgbInputs.on("input", onChangeRgb);

    // initialization
    onChangeRgb();
});

function onSubmitHsv() {
    let rgb = getHsvRgb();
    setColorAjax(rgb[0], rgb[1], rgb[2]);
}

function onSubmitRgb() {
    let rgb = getFormRgb();
    setColorAjax(rgb[0], rgb[1], rgb[2]);
}

function onChangeHsv() {
    let rgb = getHsvRgb();
    let asHex = rgbToHex(rgb[0], rgb[1], rgb[2]);

    $("#hsv-out").css("background-color", "#" + asHex);
    setHsvFeedback();
}

function onChangeRgb() {
    let rgb = getFormRgb();

    let asHex = rgbToHex(rgb[0], rgb[1], rgb[2]);

    $("#rgb-out").css("background-color", "#" + asHex);
    setRgbFeedback();
}

function setHsvFeedback(){
    let hsv = getFormHsv();

    let form = $("#form-hsv");
    form.children("#feedback-h").text(hsv[0]);
    form.children("#feedback-s").text(hsv[1]);
    form.children("#feedback-v").text(hsv[2]);
}

function setRgbFeedback(){
    let rgb = getFormRgb();

    let form = $("#form-rgb");
    form.children("#feedback-r").text(rgb[0]);
    form.children("#feedback-g").text(rgb[1]);
    form.children("#feedback-b").text(rgb[2]);
}

function getFormHsv(){
    let form = $("#form-hsv");
    let hue = Number(form.children("#input-h").val());
    let sat = Number(form.children("#input-s").val());
    let val = Number(form.children("#input-v").val());
    
    return [hue, sat, val]
}

function getFormRgb(){
    let form = $("#form-rgb");
    let red = Number(form.children("#input-r").val());
    let green = Number(form.children("#input-g").val());
    let blue = Number(form.children("#input-b").val());
    
    return [red, green, blue]
}

function getHsvRgb() {
    let hsv = getFormHsv();
    return hsvToRgb(hsv[0], hsv[1], hsv[2]);
}
