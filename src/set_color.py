import json
from rgb import rgb_utils
import krait


def main():
    form = krait.request.get_post_form()
    color = form.get("color")
    if color is None:
        return krait.ResponseBadRequest()

    rgb_utils.raw_set_color(color)


krait.response = main()
