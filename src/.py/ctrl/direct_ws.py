from krait import websockets
from rgb import rgb_utils


class WsRgbDirectController(websockets.WebsocketsCtrlBase):
    def __init__(self):
        super(WsRgbDirectController, self).__init__(False)

    def on_thread_start(self):
        pass
    
    def on_in_message(self, message):
        rgb_utils.raw_set_color(message)
