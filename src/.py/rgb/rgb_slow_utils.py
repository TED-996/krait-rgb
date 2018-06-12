import os
from subprocess import check_call

pin_r = 11
pin_g = 2
pin_b = 3

dev_null = open(os.devnull, "w")


def init():
    check_call(["/usr/sbin/fast-gpio", "set-output", str(pin_r)], stdout=dev_null)
    check_call(["/usr/sbin/fast-gpio", "set-output", str(pin_g)], stdout=dev_null)
    check_call(["/usr/sbin/fast-gpio", "set-output", str(pin_b)], stdout=dev_null)


def convert_rgb(color_rgb):
    r = int(color_rgb[0:2], 16)
    g = int(color_rgb[2:4], 16)
    b = int(color_rgb[4:6], 16)

    return r, g, b

def set_color(color_rgb):
    r = int(color_rgb[0:2], 16)
    g = int(color_rgb[2:4], 16)
    b = int(color_rgb[4:6], 16)

    set_pin(pin_r, r * 100 / 255)
    set_pin(pin_g, g * 100 / 255)
    set_pin(pin_b, b * 100 / 255)


def set_color_faded(color0, color1, fraction):
    r0, g0, b0 = convert_rgb(color0)
    r1, g1, b1 = convert_rgb(color1)

    set_pin(pin_r, (r0 * (1 - fraction) + r1 * fraction) * 100 / 255)
    set_pin(pin_g, (g0 * (1 - fraction) + g1 * fraction) * 100 / 255)
    set_pin(pin_b, (b0 * (1 - fraction) + b1 * fraction) * 100 / 255)


def set_pin(pin, amount):
    if amount == 0:
        check_call(["/usr/sbin/fast-gpio", "set", str(pin), "0"], stdout=dev_null)
    elif amount == 100:
        check_call(["/usr/sbin/fast-gpio", "set", str(pin), "1"], stdout=dev_null)
    else:
        check_call(["/usr/sbin/fast-gpio", "pwm", str(pin), "100", str(int(amount))], stdout=dev_null)
