FROM nginx:1.27-alpine
COPY src/index.html /usr/share/nginx/html/index.html
COPY nginx.conf /etc/nginx/nginx.conf
RUN rm -f /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
