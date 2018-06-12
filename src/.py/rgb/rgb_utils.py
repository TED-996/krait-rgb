import time
import subprocess
import atexit


gamma_table = None
fifo_path = "/var/run/rgb"
fifo = None


def init():
    global gamma_table

    fast_rgb_pid = subprocess.check_output("pidof fast-rgb", shell=True)
    if not fast_rgb_pid or fast_rgb_pid.isspace():
        raise ValueError("Fast-rgb not running. Please run 'service rgbd start' first.")

    gamma_table = get_gamma_table()


def get_fifo():
    global fifo
    if fifo is None:
        fifo = open(fifo_path, "w", 0)
        atexit.register(lambda: fifo.close())

    return fifo


def get_gamma_table():
    return [
        int(round(cie1931(float(l) / 255) * 255)) for l in xrange(256)
    ]


def cie1931(x):
    x = x * 100.0
    if x <= 8:
        return x / 902.3
    else:
        return ((x + 16.0) / 116.0) ** 3


def convert_rgb(color_rgb):
    r = int(color_rgb[0:2], 16)
    g = int(color_rgb[2:4], 16)
    b = int(color_rgb[4:6], 16)

    return r, g, b


def convert_to_rgb(r, g, b):
    return hex(int(r))[2:].rjust(2, '0') +\
           hex(int(g))[2:].rjust(2, '0') +\
           hex(int(b))[2:].rjust(2, '0')


def gamma_convert_to_rgb(r, g, b):
    return hex(gamma_table[int(r)])[2:].rjust(2, '0') + \
           hex(gamma_table[int(g)])[2:].rjust(2, '0') + \
           hex(gamma_table[int(b)])[2:].rjust(2, '0')


def raw_set_color(color_rgb):
    assert len(color_rgb) == 6
    fifo = get_fifo()

    fifo.write(color_rgb)

def set_color(color_rgb):
    assert len(color_rgb) == 6

    color_rgb = gamma_convert_to_rgb(*convert_rgb(color_rgb))

    fifo = get_fifo()

    fifo.write(color_rgb)


def set_color_faded(color0, color1, fraction):
    r0, g0, b0 = convert_rgb(color0)
    r1, g1, b1 = convert_rgb(color1)

    r = (r0 * (1 - fraction) + r1 * fraction)
    g = (g0 * (1 - fraction) + g1 * fraction)
    b = (b0 * (1 - fraction) + b1 * fraction)

    raw_set_color(gamma_convert_to_rgb(r, g, b))
    

def callback_every(interval_count, interval_time, callback):
    last_time = time.time()
    for x in xrange(interval_count):
        next_time = last_time + interval_time
        time_now = time.time()

        last_time = next_time
        if time_now < next_time:
            time.sleep(next_time - time_now)
        else:
            print ("[WARNING]: callback_every {!r} {!r} {!r} is running out of time!"
                   .format(interval_count, interval_time, callback.__name))

        callback(x)
