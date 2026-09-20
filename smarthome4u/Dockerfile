ARG BUILD_FROM
FROM ${BUILD_FROM}

ENV LANG=C.UTF-8 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY requirements.txt /tmp/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /tmp/requirements.txt \
    && rm -f /tmp/requirements.txt

COPY app /opt/smarthome4u/app
COPY run.sh /run.sh
RUN chmod a+x /run.sh

WORKDIR /opt/smarthome4u

LABEL \
  io.hass.name="Smarthome4u" \
  io.hass.description="Jednoduché rozhraní pro Home Assistant" \
  io.hass.type="addon"

CMD [ "/run.sh" ]
