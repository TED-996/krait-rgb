import krait
from ctrl import direct_ws

if krait.websockets.request is None:
    krait.response = krait.ResponseNotFound()
else:
    protocols = krait.websockets.request.protocols
    if "rgb-direct" in protocols:
        krait.websockets.response = krait.websockets.WebsocketsResponse(direct_ws.WsRgbDirectController(), "rgb-direct")
    else:
        krait.response = krait.ResponseBadRequest()
