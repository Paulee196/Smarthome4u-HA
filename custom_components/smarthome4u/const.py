"""Konstanty integrace Smarthome4u."""

DOMAIN = "smarthome4u"
VERSION = "0.4.5"

# Adresa panelu v postranní liště i v URL.
PANEL_URL = "smarthome4u"
PANEL_TITLE = "Smarthome4u"
PANEL_ICON = "mdi:home-lightbulb"

# Kde se servírují naše soubory a kde běží naše API.
STATIC_URL = "/smarthome4u-files"
API_BASE = "/api/smarthome4u"

# Modul, který se vkládá do frontendu Home Assistantu a schová jeho lištu.
TAKEOVER_URL = f"{STATIC_URL}/takeover.js"

# Jazyk, ve kterém se tahají popisky polí průvodce.
LANGUAGE = "cs"

# Volby uložené v config entry.
OPT_HIDE_SIDEBAR = "hide_sidebar"
OPT_LANDING = "landing"
