interface WebsocketsConn {
  socket : {
    send : (msg : string) => void;
    close: () => void
  };
  open : boolean;
  closed : boolean;
}

// const MOCK = true;
const MOCK =
    (location.href.search('localhost') != -1 ||
     location.href.search('127.0.0') != -1);
let websocketsConn : WebsocketsConn;

let stopRequested = false;

const gamma = 2.2;
const invGamma = 1 / gamma;

let addOutLine_impl : (msg : string) => void;

$(function() {
  if (typeof(addOutLine) !== "undefined"){
    addOutLine_impl = addOutLine as (msg : string) => void;
  }
  else {
    throw new Error("No addOutLine function");
  }
})

type Color3 = [number, number, number];
type ColorList = Color3[];

function compToHex(comp : number) {
  let result = comp.toString(16);
  if (result.length == 1) {
    return '0' + result;
  } else {
    return result;
  }
}

function rgbToHex(r : number, g : number, b : number) {
  return compToHex(r) + compToHex(g) + compToHex(b);
}

function compToLinear(comp : number) {
  return Math.pow(comp / 255, invGamma);
}

let last : string|undefined = undefined;

function setColorWs(color : string, websocketsConn : WebsocketsConn) {
  if (color == last) {
    addOutLine_impl('skip ' + color)
    return;
  }
  last = color;

  addOutLine_impl('set ' + color);
  websocketsConn.socket.send(color);
}

function setColorAjax(r : number, g : number, b : number) {
  let colorHex = rgbToHex(r, g, b);
  $.ajax({method : 'POST', data : {'color' : colorHex}, url : '/set_color'});
}

function hsvToRgb(h : number, s : number, v : number) {
  //https://en.wikipedia.org/wiki/HSL_and_HSV

  s = s / 100;
  v = v / 100;
  let h1 = h / 60.0;
  let chroma = v * s;
  let x = chroma * (1 - Math.abs((h1 % 2) - 1));

  let rgb1;
  if (h1 <= 1) {
    rgb1 = [chroma, x, 0];
  } else if (h1 <= 2) {
    rgb1 = [x, chroma, 0];
  } else if (h1 <= 3) {
    rgb1 = [0, chroma, x];
  } else if (h1 <= 4) {
    rgb1 = [0, x, chroma];
  } else if (h1 <= 5) {
    rgb1 = [x, 0, chroma];
  } else if (h1 <= 6) {
    rgb1 = [chroma, 0, x];
  } else {
    throw new Error('Hue > 360');
  }

  let m = v - chroma;
  return [rgb1[0] + m, rgb1[1] + m, rgb1[2] + m].map(function(x) {
    return Math.round(x * 255)
  });
}

function rgbToCielab(rgb : Color3) : Color3 {
  // https://en.wikipedia.org/wiki/CIELAB_color_space
  // http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html

  let rgbGamma = colorToLinear(rgb);
  const matrix : [Color3, Color3, Color3] = [
    [0.5767309, 0.1855540, 0.1881852],
    [0.2973769, 0.6273491, 0.0752741],
    [0.0270343, 0.0706872, 0.9911085]
  ]
  let xyz = matrixMult(matrix, rgbGamma);

  const cGamma = 6 / 29.0;
  const cGamma2 = cGamma * cGamma;
  const cGamma3 = cGamma2 * cGamma;
  function f(t : number){
    if (t > cGamma3){
      return Math.cbrt(t);
    }
    return t / (3 * cGamma2) + 4 / 29.0;
  }

  // Reference values are for Illuminant D50
  // chosen because the matrix above is for D50

  let fx = f(xyz[0] / 96.6797);
  let fy = f(xyz[1] / 100.0);
  let fz = f(xyz[2] / 82.5188);

  let l = 116 * fy - 16;
  let a = 500 * (fx - fy);
  let b = 200 * (fy - fz);

  return [l, a, b];
}

function matrixMult(matrix : [Color3, Color3, Color3], vec : Color3) : Color3 {
  let x = matrix[0][0] * vec[0] + matrix[0][1] * vec[1] + matrix[0][2] * vec[2];
  let y = matrix[1][0] * vec[0] + matrix[1][1] * vec[1] + matrix[1][2] * vec[2];
  let z = matrix[2][0] * vec[0] + matrix[2][1] * vec[1] + matrix[2][2] * vec[2];

  return [x, y, x];
}

function hexToRgb(color : string) : Color3 {
  let r = parseInt(color.substring(0, 2), 16);
  let g = parseInt(color.substring(2, 4), 16);
  let b = parseInt(color.substring(4, 6), 16);

  return [r, g, b];
}

function linearToGamma(color : Color3) : Color3 {
  let r = Math.round(Math.pow(color[0], gamma) * 255);
  let g = Math.round(Math.pow(color[1], gamma) * 255);
  let b = Math.round(Math.pow(color[2], gamma) * 255);

  return [r, g, b];
}

function colorToLinear(color : Color3) : Color3 {
  return [
    compToLinear(color[0]),
    compToLinear(color[1]),
    compToLinear(color[2])
  ];
}

function colorDistance(color1 : Color3, color2 : Color3) {
  let cielab1 = rgbToCielab(color1);
  let cielab2 = rgbToCielab(color2);

  let deltaEStar = euclideanDist(cielab1, cielab2);
  return deltaEStar;
}

function euclideanDist(a : [number, number, number], b : [number, number, number]){
  return Math.sqrt(
    (a[0] - b[0]) * (a[0] - b[0]) +
    (a[1] - b[1]) * (a[1] - b[1]) +
    (a[2] - b[2]) * (a[2] - b[2])
  )
}

// WEBSOCKETS STUFF

function getWebsocketsConn(onopen? : (conn : WebsocketsConn) => void) : WebsocketsConn {
  if (MOCK) {
    addOutLine_impl('MOCK : Connection open, you can now use commands.');

    return {
      socket : {
        send :
            function(msg) {
              addOutLine_impl('MOCK : sent "' + msg + '"');
            },
        close: function() {}
      },
          open : true, closed : false
    }
  }

  let wsUrl = getWebsocketUrl('/direct_ws');
  let socket = {
    socket : new WebSocket(wsUrl, 'rgb-direct'),
    open : false,
    closed : false
  };
  socket.socket.onopen = function() {
    socket.open = true;
    addOutLine_impl('Connection open, you can now use commands.');

    if (typeof(onopen) !== "undefined"){
      onopen(socket);
    }
  };
  socket.socket.onclose = function() {
    socket.closed = true;
    socket.open = false;
    addOutLine_impl('Connection closed, please refresh for new connection.');
  };
  socket.socket.onmessage =
      function(event) {
    addOutLine_impl('Response : ' + event.data);
  }

  return socket;
}

function getWebsocketUrl(localUrl : string) {
  var loc = window.location;
  var newUrl;
  if (loc.protocol === 'https :') {
    newUrl = 'wss:';
  } else {
    newUrl = 'ws:';
  }
  newUrl += '//' + loc.host;
  newUrl += localUrl;
  return newUrl;
}

function checkConnOpen(websocketsConn : WebsocketsConn) {
  if (websocketsConn.closed) {
    addOutLine_impl('Error : connection closed, please refresh.');
    return false;
  }
  if (!websocketsConn.open) {
    addOutLine_impl('Error : connection not opened, please wait.');
    return false;
  }
  return true;
}

function addOutLine(line : string) {
  let out = $('#cmd-out');
  let text = out.text();
  const textLengthCutoff = 512;
  if (text.length == 0) {
    out.text(line);
  } else {
    if (text.length >= textLengthCutoff){
      text = text.substr(text.length - textLengthCutoff, textLengthCutoff);
    }
    out.text(text + '\n' + line.toString());
  }
  out[0].scrollTop = out[0].scrollHeight;
}

function clearOut() {
  let out = $('#cmd-out');
  out.text('');
}