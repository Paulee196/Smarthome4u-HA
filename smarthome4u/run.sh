#!/usr/bin/with-contenv bashio
# shellcheck shell=bash
set -e

bashio::log.info "Spouštím Smarthome4u..."

cd /opt/smarthome4u || bashio::exit.nok "Chybí adresář aplikace"

exec python3 -m app
