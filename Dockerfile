FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY *.html /usr/share/nginx/html/
COPY style.css /usr/share/nginx/html/
COPY js /usr/share/nginx/html/js
COPY icon /usr/share/nginx/html/icon
COPY image /usr/share/nginx/html/image

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
