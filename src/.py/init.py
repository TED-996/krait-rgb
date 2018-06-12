import sqlite3  # Import some modules at setup time (for performance)
import os
import atexit
import sys
from rgb import rgb_utils

import krait
from krait import config
from krait import mvc

rgb_utils.init()

# ==========================================
# Standard configuration (routing & caching)
# ==========================================


# First, configure the routes
# MVC routes are configured by the krait.mvc.route_ctrl_decorator decorators on the controller classes.
# Automatically import these controllers so that they add themselves as routes.
mvc.import_ctrls_from("ctrl")

config.routes.extend([
    # MVC routes have already been added.
    # Add special URLs
    config.Route("POST", url="/set_color"),  # POSTs must be explicitly routed
    config.Route("WEBSOCKET", url="/direct_ws"),  # Websocket requests must also be explicitly routed.
    config.Route()  # This final route is a default route: all GETs will resolve to files with the same name.
])

# Configure the caching. Caching uses regexes, so some characters have a special meaning (notably, ``.``)

# Allow JS, CSS and .map (if they exist) files to be cached by any clients.
config.cache_public = [".*\.js", ".*\.css", ".*\.map", ".*\.html"]

# Allow JS and CSS resources to be cached for a longer time.
# config.cache_long_term = [".*\.js", ".*\.css"]
# Not OK for debugging.

# Choose the caching max age (in seconds)
config.cache_max_age_default = 6 * 60  # 6 minutes
config.cache_max_age_long_term = 24 * 60 * 60  # 24 hours

# Finally, configure SSL

# Set SSL certificate
config.ssl_certificate_path = os.path.join(krait.site_root, ".private", "ssl", "cert.pem")
# Set SSL private key
config.ssl_private_key_path = os.path.join(krait.site_root, ".private", "ssl", "key.pem")
# Then the SSL key passphrase. We read this from a file, as this file (init.py) may be committed.
with open(os.path.join(krait.site_root, ".private", "ssl", "pk_passphrase")) as f:
    config.ssl_key_passphrase = f.read()
